import { useState, useRef } from 'react'
import { Link } from 'react-router-dom'
import { format, parseISO } from 'date-fns'
import {
  ChevronDown, ChevronUp, Trash2, Edit,
  Camera, X, Send, CheckCheck, RotateCcw,
} from 'lucide-react'
import { useApp } from '../../context/AppContext.jsx'
import { ROLES, TASK_STATUS } from '../../data/models.js'
import { TASK_STATUS_CONFIG } from '../../features/tasks/taskStatusConfig.js'
import { PriorityBadge } from '../ui/StatusBadge.jsx'
import { Avatar } from '../ui/Avatar.jsx'
import { Modal } from '../ui/Modal.jsx'
import { TaskForm } from './TaskForm.jsx'
import { ConfirmDialog } from '../ui/ConfirmDialog.jsx'
import clsx from 'clsx'

// `showProduction`: surfaces a clickable production-name link above the title.
// Used on the cross-production Tasks list view.
export function TaskCard({ task, productionId, showProduction = false }) {
  const { currentUser, updateTask, deleteTask, addComment, getProduction } = useApp()
  const production = showProduction ? getProduction(task.productionId) : null

  const [expanded, setExpanded] = useState(false)
  const [showEdit, setShowEdit] = useState(false)
  const [showDelete, setShowDelete] = useState(false)
  // Lightbox state for full-size photo view
  const [lightbox, setLightbox] = useState(null)

  // ── Completion flow state ──────────────────────────────────────────────────
  const [completionNote, setCompletionNote] = useState(task.completionNote || '')
  const [completionPhoto, setCompletionPhoto] = useState(null) // { url, name }
  const completionPhotoRef = useRef(null)

  // ── Comment flow state ─────────────────────────────────────────────────────
  const [commentText, setCommentText] = useState('')
  const [commentPhoto, setCommentPhoto] = useState(null) // { url, name }
  const commentPhotoRef = useRef(null)

  // ── Derived flags ──────────────────────────────────────────────────────────
  const isAssignee    = currentUser?.id === task.assigneeId
  const isAdminOrSup  = currentUser?.role === ROLES.ADMIN || currentUser?.role === ROLES.SUPERVISOR
  const canAct        = isAssignee || isAdminOrSup
  const isVerified    = task.status === TASK_STATUS.VERIFIED
  const isComplete    = task.status === TASK_STATUS.COMPLETE
  const isBlocked     = task.status === TASK_STATUS.BLOCKED
  const isOverdue     = task.dueDate && !isVerified && new Date(task.dueDate) < new Date()

  const completionPhotos = task.completionPhotos || []
  const comments         = task.comments || []

  // Status visual config
  const cfg = TASK_STATUS_CONFIG[task.status] || TASK_STATUS_CONFIG[TASK_STATUS.NOT_STARTED]
  const StatusIcon = cfg.icon

  // ── Photo helpers ──────────────────────────────────────────────────────────
  const readPhoto = (file, onDone) => {
    const reader = new FileReader()
    reader.onload = (e) => onDone({ url: e.target.result, name: file.name })
    reader.readAsDataURL(file)
  }

  const handleCompletionPhotoSelect = (e) => {
    const file = e.target.files?.[0]
    if (file) readPhoto(file, setCompletionPhoto)
    e.target.value = ''
  }

  const handleCommentPhotoSelect = (e) => {
    const file = e.target.files?.[0]
    if (file) readPhoto(file, setCommentPhoto)
    e.target.value = ''
  }

  // ── Task actions ───────────────────────────────────────────────────────────
  const handleMarkComplete = () => {
    const photos = completionPhoto
      ? [...completionPhotos, { id: crypto.randomUUID(), url: completionPhoto.url, name: completionPhoto.name, uploadedAt: new Date().toISOString(), uploadedBy: currentUser?.id }]
      : completionPhotos

    updateTask(task.id, {
      status: TASK_STATUS.COMPLETE,
      completionNote: completionNote.trim() || task.completionNote,
      completionPhotos: photos,
      statusHistory: [...(task.statusHistory || []), {
        from: task.status, to: TASK_STATUS.COMPLETE,
        by: currentUser?.id, byName: currentUser?.name,
        at: new Date().toISOString(), note: completionNote.trim(),
      }],
    })
    setCompletionPhoto(null)
  }

  const handleVerify = () => {
    updateTask(task.id, {
      status: TASK_STATUS.VERIFIED,
      statusHistory: [...(task.statusHistory || []), {
        from: task.status, to: TASK_STATUS.VERIFIED,
        by: currentUser?.id, byName: currentUser?.name,
        at: new Date().toISOString(), note: '',
      }],
    })
  }

  const handleUnverify = () => {
    updateTask(task.id, {
      status: TASK_STATUS.COMPLETE,
      statusHistory: [...(task.statusHistory || []), {
        from: TASK_STATUS.VERIFIED, to: TASK_STATUS.COMPLETE,
        by: currentUser?.id, byName: currentUser?.name,
        at: new Date().toISOString(), note: 'Verification reversed',
      }],
    })
  }

  const handleSendComment = () => {
    if (!commentText.trim() && !commentPhoto) return
    addComment(task.id, {
      id: crypto.randomUUID(),
      text: commentText.trim(),
      photoUrl: commentPhoto?.url || null,
      photoName: commentPhoto?.name || null,
      authorId: currentUser?.id,
      authorName: currentUser?.name,
      createdAt: new Date().toISOString(),
    })
    setCommentText('')
    setCommentPhoto(null)
  }

  return (
    <>
      {/* ── Card ──────────────────────────────────────────────────────────── */}
      <div className={clsx(
        'card transition-all',
        isVerified && 'opacity-60',
        isOverdue && !isVerified && 'border-red-500/30',
        isBlocked && 'border-red-500/25 bg-red-500/3',
      )}>

        {/* ── Collapsed header ────────────────────────────────────────────── */}
        <div
          className="p-4 cursor-pointer select-none"
          onClick={() => setExpanded(e => !e)}
        >
          <div className="flex items-start gap-3">
            {/* Status icon */}
            <div className={clsx(
              'w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5',
              cfg.bgClass,
            )}>
              <StatusIcon size={13} className={cfg.textClass} />
            </div>

            <div className="flex-1 min-w-0">
              {/* Production link (cross-list view) */}
              {showProduction && production && (
                <Link
                  to={`/productions/${production.id}`}
                  onClick={e => e.stopPropagation()}
                  className="block text-xs text-orbital-subtle hover:text-blue-400 transition-colors truncate mb-0.5"
                >
                  {production.name}
                </Link>
              )}

              {/* Title */}
              <span className={clsx(
                'text-sm font-medium leading-snug',
                isVerified ? 'line-through text-orbital-subtle' : 'text-orbital-text'
              )}>
                {task.title}
              </span>

              {/* Badges */}
              <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                {/* Status pill */}
                <span className={clsx('inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-md font-medium', cfg.pillClass)}>
                  <StatusIcon size={10} />
                  {task.status}
                </span>
                <PriorityBadge priority={task.priority} />
                {task.dueDate && (
                  <span className={clsx('text-xs', isOverdue ? 'text-red-400 font-medium' : 'text-orbital-subtle')}>
                    {isOverdue ? 'Overdue · ' : 'Due '}
                    {format(parseISO(task.dueDate), 'MMM d')}
                  </span>
                )}
                {completionPhotos.length > 0 && (
                  <span className="flex items-center gap-1 text-xs text-orbital-subtle">
                    <Camera size={10} /> {completionPhotos.length}
                  </span>
                )}
                {comments.length > 0 && (
                  <span className="text-xs text-orbital-subtle">{comments.length} comment{comments.length !== 1 ? 's' : ''}</span>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2 flex-shrink-0">
              <Avatar userId={task.assigneeId} size="xs" />
              {expanded
                ? <ChevronUp size={16} className="text-orbital-subtle" />
                : <ChevronDown size={16} className="text-orbital-subtle" />
              }
            </div>
          </div>
        </div>

        {/* ── Expanded body ────────────────────────────────────────────────── */}
        {expanded && (
          <div className="border-t border-orbital-border px-4 pb-5 pt-4 space-y-5">

            {/* Description */}
            {task.description && (
              <div>
                <p className="section-title mb-1.5">Description</p>
                <p className="text-sm text-orbital-subtle">{task.description}</p>
              </div>
            )}

            {/* Expectations note — from assigner */}
            {task.expectationsNote && (
              <div className="p-3 rounded-lg bg-blue-500/8 border border-blue-500/20">
                <p className="section-title mb-1 text-blue-400">From assigner</p>
                <p className="text-sm text-orbital-subtle italic">"{task.expectationsNote}"</p>
                <div className="flex items-center gap-1.5 mt-2">
                  <Avatar userId={task.assignedBy} size="xs" />
                  <span className="text-xs text-orbital-subtle">{task.assignedBy}</span>
                </div>
              </div>
            )}

            {/* Blocked reason */}
            {isBlocked && task.blockedReason && (
              <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/25">
                <p className="section-title mb-1 text-red-400">Blocked — reason</p>
                <p className="text-sm text-orbital-subtle">{task.blockedReason}</p>
              </div>
            )}

            {/* Completion note */}
            {task.completionNote && (
              <div className="p-3 rounded-lg bg-green-500/8 border border-green-500/20">
                <p className="section-title mb-1 text-green-400">Completion note</p>
                <p className="text-sm text-orbital-subtle italic">"{task.completionNote}"</p>
              </div>
            )}

            {/* Completion photos */}
            {completionPhotos.length > 0 && (
              <div>
                <p className="section-title mb-2">Completion Photo{completionPhotos.length !== 1 ? 's' : ''}</p>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {completionPhotos.map(photo => (
                    <button
                      key={photo.id}
                      onClick={() => setLightbox(photo.url)}
                      className="block aspect-video rounded-lg overflow-hidden border border-orbital-border bg-black/20 hover:border-blue-500/40 transition-colors"
                    >
                      <img
                        src={photo.url}
                        alt="Completion photo"
                        className="w-full h-full object-cover"
                      />
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Verification line */}
            {isVerified && (
              <div className="flex items-center gap-2 text-xs text-emerald-400">
                <CheckCheck size={13} />
                <span>
                  Verified by {task.statusHistory?.findLast?.(e => e.to === TASK_STATUS.VERIFIED)?.byName || 'Supervisor'}
                  {task.statusHistory?.findLast?.(e => e.to === TASK_STATUS.VERIFIED)?.at &&
                    ` · ${format(parseISO(task.statusHistory.findLast(e => e.to === TASK_STATUS.VERIFIED).at), 'MMM d, h:mm a')}`
                  }
                </span>
              </div>
            )}

            {/* ── Completion action ──────────────────────────────────────── */}
            {canAct && !isVerified && !isComplete && (
              <div className="space-y-3 pt-2 border-t border-orbital-border">
                <p className="section-title">Mark Complete</p>

                {/* Completion note textarea */}
                <textarea
                  className="input min-h-[64px] resize-none text-sm"
                  placeholder="Completion note — what was done, any issues... (optional)"
                  value={completionNote}
                  onChange={e => setCompletionNote(e.target.value)}
                />

                {/* ── Photo upload ─────────────────────────────────────── */}
                {/* Hidden input — capture="environment" opens rear camera on mobile */}
                <input
                  ref={completionPhotoRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="hidden"
                  onChange={handleCompletionPhotoSelect}
                />

                {completionPhoto ? (
                  /* Photo selected — show preview with replace/remove */
                  <div className="space-y-2">
                    <div className="relative rounded-xl overflow-hidden border border-orbital-border bg-black/20">
                      <img
                        src={completionPhoto.url}
                        alt="Completion photo preview"
                        className="w-full max-h-52 object-cover"
                      />
                      <button
                        onClick={() => setCompletionPhoto(null)}
                        className="absolute top-2 right-2 w-7 h-7 rounded-full bg-black/70 flex items-center justify-center hover:bg-black/90 transition-colors"
                      >
                        <X size={14} className="text-white" />
                      </button>
                    </div>
                    <button
                      type="button"
                      onClick={() => completionPhotoRef.current?.click()}
                      className="btn-ghost w-full text-xs"
                    >
                      <Camera size={13} /> Change photo
                    </button>
                  </div>
                ) : (
                  /* No photo yet — prominent Add Photo button */
                  <button
                    type="button"
                    onClick={() => completionPhotoRef.current?.click()}
                    className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl border-2 border-dashed border-orbital-border text-orbital-subtle hover:border-blue-500/40 hover:text-blue-400 transition-colors text-sm font-medium"
                  >
                    <Camera size={16} />
                    Add Completion Photo <span className="text-xs opacity-60">(optional)</span>
                  </button>
                )}

                <button onClick={handleMarkComplete} className="btn-primary w-full">
                  Mark Complete
                </button>
              </div>
            )}

            {/* Awaiting verification message + admin verify button */}
            {isComplete && (
              <div className="pt-2 border-t border-orbital-border space-y-3">
                {isAdminOrSup ? (
                  <button onClick={handleVerify} className="btn-primary w-full">
                    <CheckCheck size={15} /> Verify Complete
                  </button>
                ) : (
                  <p className="text-sm text-orbital-subtle text-center py-2">
                    Awaiting verification by a supervisor.
                  </p>
                )}
              </div>
            )}

            {/* Unverify (admin/sup only) */}
            {isVerified && isAdminOrSup && (
              <div className="pt-2 border-t border-orbital-border">
                <button onClick={handleUnverify} className="btn-ghost w-full text-xs text-orbital-subtle">
                  <RotateCcw size={12} /> Unverify
                </button>
              </div>
            )}

            {/* Edit / Delete */}
            {isAdminOrSup && (
              <div className="flex gap-2 pt-1 border-t border-orbital-border">
                <button onClick={() => setShowEdit(true)} className="btn-ghost flex-1">
                  <Edit size={14} /> Edit
                </button>
                <button
                  onClick={() => setShowDelete(true)}
                  className="btn-ghost flex-1 text-red-400 hover:text-red-300 hover:bg-red-500/10"
                >
                  <Trash2 size={14} /> Delete
                </button>
              </div>
            )}

            {/* ── Comments ──────────────────────────────────────────────── */}
            <div className="pt-2 border-t border-orbital-border space-y-4">
              <p className="section-title">
                Comments {comments.length > 0 && <span className="text-orbital-subtle font-normal">({comments.length})</span>}
              </p>

              {/* Existing comments */}
              {comments.length > 0 && (
                <div className="space-y-3">
                  {comments.map(c => (
                    <div key={c.id} className="flex gap-2.5">
                      <Avatar userId={c.authorId} size="xs" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-baseline gap-2">
                          <span className="text-xs font-semibold text-orbital-text">{c.authorName}</span>
                          <span className="text-xs text-orbital-subtle">
                            {format(parseISO(c.createdAt), 'MMM d, h:mm a')}
                          </span>
                        </div>
                        {c.text && (
                          <p className="text-sm text-orbital-subtle mt-0.5">{c.text}</p>
                        )}
                        {c.photoUrl && (
                          <button
                            onClick={() => setLightbox(c.photoUrl)}
                            className="mt-2 block rounded-lg overflow-hidden border border-orbital-border max-w-[240px] hover:border-blue-500/40 transition-colors"
                          >
                            <img
                              src={c.photoUrl}
                              alt={c.photoName || 'Comment photo'}
                              className="w-full object-cover"
                            />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* New comment input */}
              <div className="space-y-2">
                {/* Comment photo preview */}
                {commentPhoto && (
                  <div className="relative rounded-lg overflow-hidden border border-orbital-border bg-black/20 max-w-[240px]">
                    <img
                      src={commentPhoto.url}
                      alt="Comment photo preview"
                      className="w-full object-cover"
                    />
                    <button
                      onClick={() => setCommentPhoto(null)}
                      className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full bg-black/70 flex items-center justify-center hover:bg-black/90 transition-colors"
                    >
                      <X size={11} className="text-white" />
                    </button>
                  </div>
                )}

                <div className="flex items-end gap-2">
                  <div className="flex-1 relative">
                    <textarea
                      className="input min-h-[40px] max-h-24 resize-none text-sm pr-10 py-2.5"
                      placeholder="Add a comment..."
                      value={commentText}
                      onChange={e => setCommentText(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault()
                          handleSendComment()
                        }
                      }}
                      rows={1}
                    />
                    {/* Camera button inside the textarea */}
                    <button
                      type="button"
                      onClick={() => commentPhotoRef.current?.click()}
                      className="absolute right-2 bottom-2 p-1.5 rounded-lg text-orbital-subtle hover:text-blue-400 hover:bg-blue-500/10 transition-colors"
                      title="Attach photo"
                    >
                      <Camera size={15} />
                    </button>
                  </div>
                  <button
                    onClick={handleSendComment}
                    disabled={!commentText.trim() && !commentPhoto}
                    className="btn-primary py-2.5 px-3 flex-shrink-0 disabled:opacity-40"
                  >
                    <Send size={14} />
                  </button>
                </div>

                {/* Hidden comment photo input */}
                <input
                  ref={commentPhotoRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="hidden"
                  onChange={handleCommentPhotoSelect}
                />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── Edit modal ──────────────────────────────────────────────────────── */}
      <Modal open={showEdit} onClose={() => setShowEdit(false)} title="Edit Task" size="lg">
        <TaskForm
          productionId={productionId}
          initial={task}
          onSubmit={(updated) => {
            updateTask(task.id, updated)
            setShowEdit(false)
          }}
          onCancel={() => setShowEdit(false)}
        />
      </Modal>

      {/* ── Delete confirm ──────────────────────────────────────────────────── */}
      <ConfirmDialog
        open={showDelete}
        onClose={() => setShowDelete(false)}
        onConfirm={() => deleteTask(task.id)}
        title="Delete Task"
        message={`Delete "${task.title}"? This cannot be undone.`}
        confirmLabel="Delete"
        danger
      />

      {/* ── Lightbox ────────────────────────────────────────────────────────── */}
      {lightbox && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/90 p-4"
          onClick={() => setLightbox(null)}
        >
          <button
            className="absolute top-4 right-4 w-10 h-10 rounded-full bg-white/10 flex items-center justify-center text-white hover:bg-white/20 transition-colors"
            onClick={() => setLightbox(null)}
          >
            <X size={20} />
          </button>
          <img
            src={lightbox}
            alt="Full size photo"
            className="max-w-full max-h-[90vh] object-contain rounded-xl"
            onClick={e => e.stopPropagation()}
          />
        </div>
      )}
    </>
  )
}
