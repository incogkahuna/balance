import { useState } from 'react'
import { format, parseISO } from 'date-fns'
import { Check, CheckCheck, ChevronDown, ChevronUp, Trash2, Edit, MessageSquare } from 'lucide-react'
import { useApp } from '../../context/AppContext.jsx'
import { ROLES } from '../../data/models.js'
import { TaskStatusBadge, PriorityBadge } from '../ui/StatusBadge.jsx'
import { Avatar } from '../ui/Avatar.jsx'
import { Modal } from '../ui/Modal.jsx'
import { TaskForm } from './TaskForm.jsx'
import { ConfirmDialog } from '../ui/ConfirmDialog.jsx'

export function TaskCard({ task, productionId }) {
  const { currentUser, updateTask, deleteTask } = useApp()
  const [expanded, setExpanded] = useState(false)
  const [completionNote, setCompletionNote] = useState(task.completionNote || '')
  const [showEdit, setShowEdit] = useState(false)
  const [showDelete, setShowDelete] = useState(false)

  const isAssignee = currentUser?.id === task.assigneeId
  const isAdminOrSup = currentUser?.role === ROLES.ADMIN || currentUser?.role === ROLES.SUPERVISOR
  const canEdit = isAdminOrSup
  const canDelete = isAdminOrSup

  const handleReportComplete = () => {
    updateTask(task.id, {
      reportedComplete: true,
      reportedCompleteAt: new Date().toISOString(),
      completionNote,
    })
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

  const isOverdue = task.dueDate && !task.verifiedComplete && new Date(task.dueDate) < new Date()

  return (
    <>
      <div className={`card transition-all ${
        task.verifiedComplete
          ? 'opacity-60'
          : isOverdue
          ? 'border-red-500/30'
          : ''
      }`}>
        {/* Header */}
        <div
          className="p-4 cursor-pointer"
          onClick={() => setExpanded(e => !e)}
        >
          <div className="flex items-start gap-3">
            {/* Completion checkbox */}
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
              <div className="flex items-center gap-2 flex-wrap">
                <span className={`text-sm font-medium leading-snug ${task.verifiedComplete ? 'line-through text-orbital-subtle' : 'text-orbital-text'}`}>
                  {task.title}
                </span>
              </div>
              <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                <TaskStatusBadge task={task} />
                <PriorityBadge priority={task.priority} />
                {task.dueDate && (
                  <span className={`text-xs ${isOverdue ? 'text-red-400' : 'text-orbital-subtle'}`}>
                    Due {format(parseISO(task.dueDate), 'MMM d')}
                  </span>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2 flex-shrink-0">
              <Avatar userId={task.assigneeId} size="xs" />
              {expanded ? <ChevronUp size={16} className="text-orbital-subtle" /> : <ChevronDown size={16} className="text-orbital-subtle" />}
            </div>
          </div>
        </div>

        {/* Expanded */}
        {expanded && (
          <div className="px-4 pb-4 border-t border-orbital-border pt-4 space-y-4">
            {/* Description */}
            {task.description && (
              <div>
                <p className="section-title mb-1.5">Description</p>
                <p className="text-sm text-orbital-subtle">{task.description}</p>
              </div>
            )}

            {/* Expectations note */}
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

            {/* Completion note */}
            {task.completionNote && (
              <div className="p-3 rounded-lg bg-green-500/8 border border-green-500/20">
                <p className="section-title mb-1 text-green-400">Completion note</p>
                <p className="text-sm text-orbital-subtle italic">"{task.completionNote}"</p>
              </div>
            )}

            {/* Verified by */}
            {task.verifiedComplete && (
              <div className="flex items-center gap-2">
                <CheckCheck size={14} className="text-green-400" />
                <span className="text-xs text-orbital-subtle">
                  Verified by {task.verifiedBy}
                  {task.verifiedCompleteAt && ` on ${format(parseISO(task.verifiedCompleteAt), 'MMM d, h:mm a')}`}
                </span>
              </div>
            )}

            {/* Actions */}
            <div className="flex flex-wrap gap-2">
              {/* Assignee: report complete */}
              {isAssignee && !task.reportedComplete && (
                <div className="w-full">
                  <textarea
                    className="input min-h-[60px] resize-none text-xs mb-2"
                    placeholder="Completion note (optional) — what happened, any issues..."
                    value={completionNote}
                    onChange={e => setCompletionNote(e.target.value)}
                  />
                  <button onClick={handleReportComplete} className="btn-primary w-full">
                    <Check size={14} /> Mark as Complete
                  </button>
                </div>
              )}

              {/* Assignee: unreport */}
              {isAssignee && task.reportedComplete && !task.verifiedComplete && (
                <button onClick={handleUnreport} className="btn-secondary text-xs">
                  Undo completion
                </button>
              )}

              {/* Admin/Sup: verify */}
              {isAdminOrSup && task.reportedComplete && !task.verifiedComplete && (
                <button onClick={handleVerify} className="btn-primary">
                  <CheckCheck size={14} /> Verify Complete
                </button>
              )}

              {/* Admin/Sup: unverify */}
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
                <button onClick={() => setShowDelete(true)} className="btn-ghost text-red-400 hover:text-red-300 hover:bg-red-500/10">
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
