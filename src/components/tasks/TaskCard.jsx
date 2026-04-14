import { useState, useRef } from 'react'
import { Link } from 'react-router-dom'
import { format, parseISO } from 'date-fns'
import { Check, CheckCheck, ChevronDown, ChevronUp, Trash2, Edit, Camera, X } from 'lucide-react'
import { useApp } from '../../context/AppContext.jsx'
import { ROLES } from '../../data/models.js'
import { TaskStatusBadge, PriorityBadge } from '../ui/StatusBadge.jsx'
import { Avatar } from '../ui/Avatar.jsx'
import { Modal } from '../ui/Modal.jsx'
import { TaskForm } from './TaskForm.jsx'
import { ConfirmDialog } from '../ui/ConfirmDialog.jsx'

// `showProduction`: when true, surfaces a clickable production-name link
// above the task title. Used on the cross-production Tasks list view.
export function TaskCard({ task, productionId, showProduction = false }) {
  const { currentUser, updateTask, deleteTask, getProduction } = useApp()
  const production = showProduction ? getProduction(task.productionId) : null

  const [expanded, setExpanded] = useState(false)
  const [completionNote, setCompletionNote] = useState(task.completionNote || '')
  const [pendingPhoto, setPendingPhoto] = useState(null) // { id, url, uploadedAt, uploadedBy }
  const [showEdit, setShowEdit] = useState(false)
  const [showDelete, setShowDelete] = useState(false)

  // Hidden file input — `capture="environment"` opens rear camera on mobile,
  // falls back to file picker on desktop.
  const photoInputRef = useRef(null)

  const isAssignee = currentUser?.id === task.assigneeId
  const isAdminOrSup = currentUser?.role === ROLES.ADMIN || currentUser?.role === ROLES.SUPERVISOR
  const canEdit = isAdminOrSup
  const canDelete = isAdminOrSup
  const isOverdue = task.dueDate && !task.verifiedComplete && new Date(task.dueDate) < new Date()

  // ─── Photo selection ───────────────────────────────────────────────────────
  const handlePhotoSelect = (e) => {
    const file = e.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (ev) => {
      setPendingPhoto({
        id: crypto.randomUUID(),
        url: ev.target.result, // base64 — swap for Supabase upload in v2
        uploadedAt: new Date().toISOString(),
        uploadedBy: currentUser?.id,
      })
    }
    reader.readAsDataURL(file)
    // Reset so the same file can be re-selected if user clears and re-picks
    e.target.value = ''
  }

  // ─── Task actions ──────────────────────────────────────────────────────────
  const handleReportComplete = () => {
    const existingPhotos = task.completionPhotos || []
    updateTask(task.id, {
      reportedComplete: true,
      reportedCompleteAt: new Date().toISOString(),
      completionNote,
      completionPhotos: pendingPhoto
        ? [...existingPhotos, pendingPhoto]
        : existingPhotos,
    })
    setPendingPhoto(null)
  }

  const handleUnreport = () => {
    updateTask(task.id, {
      reportedComplete: false,
      reportedCompleteAt: null,
      verifiedComplete: false,
      verifiedCompleteAt: null,
      verifiedBy: null,
    })
  }

  const handleVerify = () => {
    updateTask(task.id, {
      verifiedComplete: true,
      verifiedCompleteAt: new Date().toISOString(),
      verifiedBy: currentUser?.id,
    })
  }

  const handleUnverify = () => {
    updateTask(task.id, {
      verifiedComplete: false,
      verifiedCompleteAt: null,
      verifiedBy: null,
    })
  }

  const completionPhotos = task.completionPhotos || []

  return (
    <>
      <div className={`card transition-all ${
        task.verifiedComplete ? 'opacity-60' : isOverdue ? 'border-red-500/30' : ''
      }`}>

        {/* ── Card header ─────────────────────────────────────────────────── */}
        <div className="p-4 cursor-pointer" onClick={() => setExpanded(e => !e)}>
          <div className="flex items-start gap-3">

            {/* Status icon */}
            <div className="flex-shrink-0 mt-0.5">
              {task.verifiedComplete ? (
                <div className="w-6 h-6 rounded-full bg-green-500/20 flex items-center justify-center">
                  <CheckCheck size={14} className="text-green-400" />
                </div>
              ) : task.reportedComplete ? (
                <div className="w-6 h-6 rounded-full bg-amber-500/20 flex items-center justify-center">
                  <Check size={14} className="text-amber-400" />
                </div>
              ) : (
                <div className="w-6 h-6 rounded-full border-2 border-orbital-border" />
              )}
            </div>

            <div className="flex-1 min-w-0">
              {showProduction && production && (
                <Link
                  to={`/productions/${production.id}`}
                  onClick={(e) => e.stopPropagation()}
                  className="block text-xs text-orbital-subtle hover:text-blue-400 transition-colors truncate mb-0.5"
                >
                  {production.name}
                </Link>
              )}
              <span className={`text-sm font-medium leading-snug ${task.verifiedComplete ? 'line-through text-orbital-subtle' : 'text-orbital-text'}`}>
                {task.title}
              </span>
              <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                <TaskStatusBadge task={task} />
                <PriorityBadge priority={task.priority} />
                {task.dueDate && (
                  <span className={`text-xs ${isOverdue ? 'text-red-400' : 'text-orbital-subtle'}`}>
                    Due {format(parseISO(task.dueDate), 'MMM d')}
                  </span>
                )}
                {completionPhotos.length > 0 && (
                  <span className="flex items-center gap-1 text-xs text-orbital-subtle">
                    <Camera size={11} /> {completionPhotos.length}
                  </span>
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
          <div className="px-4 pb-4 border-t border-orbital-border pt-4 space-y-4">

            {task.description && (
              <div>
                <p className="section-title mb-1.5">Description</p>
                <p className="text-sm text-orbital-subtle">{task.description}</p>
              </div>
            )}

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

            {task.completionNote && (
              <div className="p-3 rounded-lg bg-green-500/8 border border-green-500/20">
                <p className="section-title mb-1 text-green-400">Completion note</p>
                <p className="text-sm text-orbital-subtle italic">"{task.completionNote}"</p>
              </div>
            )}

            {/* Completion photos — visible to assignee, admin, and supervisor */}
            {completionPhotos.length > 0 && (isAdminOrSup || isAssignee) && (
              <div>
                <p className="section-title mb-2">Completion Photos</p>
                <div className="grid grid-cols-2 gap-2">
                  {completionPhotos.map(photo => (
                    <img
                      key={photo.id}
                      src={photo.url}
                      alt="Completion photo"
                      className="w-full rounded-lg border border-orbital-border object-cover aspect-video bg-black/20"
                    />
                  ))}
                </div>
              </div>
            )}

            {task.verifiedComplete && (
              <div className="flex items-center gap-2">
                <CheckCheck size={14} className="text-green-400" />
                <span className="text-xs text-orbital-subtle">
                  Verified by {task.verifiedBy}
                  {task.verifiedCompleteAt && ` on ${format(parseISO(task.verifiedCompleteAt), 'MMM d, h:mm a')}`}
                </span>
              </div>
            )}

            {/* ── Actions ─────────────────────────────────────────────────── */}
            <div className="flex flex-wrap gap-2">

              {/* Assignee: completion flow with optional photo */}
              {isAssignee && !task.reportedComplete && (
                <div className="w-full space-y-2">
                  <textarea
                    className="input min-h-[60px] resize-none text-xs"
                    placeholder="Completion note (optional) — what happened, any issues..."
                    value={completionNote}
                    onChange={e => setCompletionNote(e.target.value)}
                  />

                  {/* Hidden file input — opens camera on mobile, picker on desktop */}
                  <input
                    ref={photoInputRef}
                    type="file"
                    accept="image/*"
                    capture="environment"
                    className="hidden"
                    onChange={handlePhotoSelect}
                  />

                  {/* Photo preview — only shown once a photo is selected */}
                  {pendingPhoto && (
                    <div className="relative">
                      <img
                        src={pendingPhoto.url}
                        alt="Completion photo preview"
                        className="w-full rounded-lg border border-orbital-border object-cover max-h-48 bg-black/20"
                      />
                      <button
                        onClick={() => setPendingPhoto(null)}
                        className="absolute top-2 right-2 w-7 h-7 rounded-full bg-black/60 flex items-center justify-center hover:bg-black/80 transition-colors"
                        aria-label="Remove photo"
                      >
                        <X size={14} className="text-white" />
                      </button>
                    </div>
                  )}

                  <div className="flex gap-2">
                    <button
                      onClick={() => photoInputRef.current?.click()}
                      className="btn-secondary flex-1"
                    >
                      <Camera size={14} />
                      {pendingPhoto ? 'Change photo' : 'Add photo'}
                    </button>
                    <button onClick={handleReportComplete} className="btn-primary flex-1">
                      <Check size={14} /> Mark Complete
                    </button>
                  </div>
                </div>
              )}

              {isAssignee && task.reportedComplete && !task.verifiedComplete && (
                <button onClick={handleUnreport} className="btn-secondary text-xs">
                  Undo completion
                </button>
              )}

              {isAdminOrSup && task.reportedComplete && !task.verifiedComplete && (
                <button onClick={handleVerify} className="btn-primary">
                  <CheckCheck size={14} /> Verify Complete
                </button>
              )}

              {isAdminOrSup && task.verifiedComplete && (
                <button onClick={handleUnverify} className="btn-ghost text-xs">
                  Unverify
                </button>
              )}

              {canEdit && (
                <button onClick={() => setShowEdit(true)} className="btn-ghost">
                  <Edit size={14} /> Edit
                </button>
              )}
              {canDelete && (
                <button
                  onClick={() => setShowDelete(true)}
                  className="btn-ghost text-red-400 hover:text-red-300 hover:bg-red-500/10"
                >
                  <Trash2 size={14} /> Delete
                </button>
              )}
            </div>
          </div>
        )}
      </div>

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

      <ConfirmDialog
        open={showDelete}
        onClose={() => setShowDelete(false)}
        onConfirm={() => deleteTask(task.id)}
        title="Delete Task"
        message={`Delete "${task.title}"? This cannot be undone.`}
        confirmLabel="Delete"
        danger
      />
    </>
  )
}
