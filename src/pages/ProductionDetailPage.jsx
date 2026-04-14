import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { format, parseISO } from 'date-fns'
import {
  ArrowLeft, Edit, Trash2, Plus, MapPin, Calendar,
  Film, Users, Package, AlertTriangle, Star, ChevronRight,
  CheckSquare, FileText, MessageSquare, BarChart2
} from 'lucide-react'
import { useApp } from '../context/AppContext.jsx'
import { ROLES, PRODUCTION_STATUS, TASK_STATUS, USERS } from '../data/models.js'
import { StatusBadge } from '../components/ui/StatusBadge.jsx'
import { Avatar } from '../components/ui/Avatar.jsx'
import { Modal } from '../components/ui/Modal.jsx'
import { ConfirmDialog } from '../components/ui/ConfirmDialog.jsx'
import { ProductionForm } from '../components/productions/ProductionForm.jsx'
import { TaskCard } from '../components/tasks/TaskCard.jsx'
import { TaskForm } from '../components/tasks/TaskForm.jsx'
import { AddonForm } from '../components/addons/AddonForm.jsx'
import { FeedbackForm } from '../components/feedback/FeedbackForm.jsx'
import { InstructionPackage } from '../components/instructions/InstructionPackage.jsx'
import { ProductionBible } from '../features/productionBible/ProductionBible.jsx'
import { TopBar } from '../components/layout/TopBar.jsx'
import clsx from 'clsx'

// Bible tab is conditionally appended for Admin/Supervisor — built below
const BASE_TABS = ['Overview', 'Tasks', 'Package', 'Add-ons', 'Debrief']

export function ProductionDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const {
    currentUser, getProduction, updateProduction, deleteProduction,
    getTasksForProduction, addTask, addAddon, deleteAddon,
    submitFeedback, updateInstructionPackage, resolveAssignee,
  } = useApp()

  const production = getProduction(id)
  const [tab, setTab] = useState('Overview')
  const [showEdit, setShowEdit] = useState(false)
  const [showDelete, setShowDelete] = useState(false)
  const [showAddTask, setShowAddTask] = useState(false)
  const [showAddAddon, setShowAddAddon] = useState(false)
  const [showFeedback, setShowFeedback] = useState(false)

  const tasks = getTasksForProduction(id)

  if (!production) {
    return (
      <div className="flex flex-col items-center justify-center h-screen">
        <p className="text-orbital-subtle mb-4">Production not found.</p>
        <button onClick={() => navigate('/productions')} className="btn-secondary">
          Back to Productions
        </button>
      </div>
    )
  }

  const isAdminOrSup = currentUser?.role === ROLES.ADMIN || currentUser?.role === ROLES.SUPERVISOR
  const canEdit = isAdminOrSup
  const canAddTask = isAdminOrSup
  const canAddAddon = true // everyone can log add-ons
  const canDebrief = isAdminOrSup

  // Bible tab is only surfaced for Admin and Supervisor
  const TABS = isAdminOrSup ? [...BASE_TABS, 'Bible'] : BASE_TABS

  const pendingTasks = tasks.filter(t => t.status !== TASK_STATUS.VERIFIED)
  const completedTasks = tasks.filter(t => t.status === TASK_STATUS.VERIFIED)

  return (
    <div>
      <TopBar />
      <div className="max-w-5xl mx-auto px-4 lg:px-8 py-6 lg:py-8">
        {/* Back */}
        <button
          onClick={() => navigate('/productions')}
          className="flex items-center gap-1.5 text-sm text-orbital-subtle hover:text-orbital-text mb-5 transition-colors"
        >
          <ArrowLeft size={16} /> All Productions
        </button>

        {/* Production header */}
        <div className="card p-5 mb-6">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-3 flex-wrap mb-1">
                <h1 className="text-xl font-bold text-orbital-text">{production.name}</h1>
                <StatusBadge status={production.status} />
              </div>
              <p className="text-orbital-subtle">{production.client}</p>

              <div className="flex flex-wrap gap-4 mt-3">
                <div className="flex items-center gap-1.5 text-xs text-orbital-subtle">
                  <Film size={13} />
                  <span>{production.productionType}</span>
                </div>
                <div className="flex items-center gap-1.5 text-xs text-orbital-subtle">
                  <MapPin size={13} />
                  <span>
                    {production.locationType === 'In-House (Orbital Studios)'
                      ? 'Orbital Studios'
                      : production.locationAddress || 'Mobile'}
                  </span>
                </div>
                {production.startDate && (
                  <div className="flex items-center gap-1.5 text-xs text-orbital-subtle">
                    <Calendar size={13} />
                    <span>
                      {format(parseISO(production.startDate), 'MMM d, yyyy')}
                      {production.endDate && ` – ${format(parseISO(production.endDate), 'MMM d, yyyy')}`}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {canEdit && (
              <div className="flex gap-2">
                <button onClick={() => setShowEdit(true)} className="btn-ghost">
                  <Edit size={15} /> Edit
                </button>
                <button
                  onClick={() => setShowDelete(true)}
                  className="btn-ghost text-red-400 hover:text-red-300 hover:bg-red-500/10"
                >
                  <Trash2 size={15} />
                </button>
              </div>
            )}
          </div>

          {/* Team */}
          {production.assignedMembers.length > 0 && (
            <div className="mt-4 pt-4 border-t border-orbital-border">
              <p className="section-title mb-2.5">Team</p>
              <div className="flex flex-wrap gap-2">
                {production.assignedMembers.map(({ userId, roleOnProduction }) => {
                  const person = resolveAssignee(userId)
                  if (!person) return null
                  const isContractor = person.type === 'contractor'
                  return (
                    <div
                      key={userId}
                      className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-orbital-muted border border-orbital-border"
                    >
                      <div
                        className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white overflow-hidden"
                        style={!person.photoUrl ? { backgroundColor: person.color || '#64748b' } : {}}
                      >
                        {person.photoUrl
                          ? <img src={person.photoUrl} alt={person.name} className="w-full h-full object-cover" />
                          : (person.avatar || person.name?.charAt(0).toUpperCase())
                        }
                      </div>
                      <span className="text-xs font-medium text-orbital-text">{person.name}</span>
                      {isContractor && (
                        <span className="text-xs text-orbital-subtle border border-orbital-border rounded px-1">contractor</span>
                      )}
                      {roleOnProduction && (
                        <span className="text-xs text-orbital-subtle">{roleOnProduction}</span>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-6 overflow-x-auto pb-px">
          {TABS.map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={clsx(
                'px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors',
                tab === t
                  ? 'bg-blue-600/15 text-blue-400'
                  : 'text-orbital-subtle hover:text-orbital-text hover:bg-orbital-muted'
              )}
            >
              {t}
              {t === 'Tasks' && pendingTasks.length > 0 && (
                <span className="ml-1.5 px-1.5 py-0.5 rounded-full bg-orbital-muted text-orbital-subtle text-xs">
                  {pendingTasks.length}
                </span>
              )}
              {t === 'Add-ons' && production.addons?.length > 0 && (
                <span className="ml-1.5 px-1.5 py-0.5 rounded-full bg-orbital-muted text-orbital-subtle text-xs">
                  {production.addons.length}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        {tab === 'Overview' && (
          <OverviewTab production={production} tasks={tasks} />
        )}

        {tab === 'Tasks' && (
          <TasksTab
            production={production}
            tasks={tasks}
            canAdd={canAddTask}
            onAddTask={() => setShowAddTask(true)}
          />
        )}

        {tab === 'Package' && (
          <PackageTab
            production={production}
            readOnly={!canEdit}
            onUpdate={(pkg) => updateInstructionPackage(id, pkg)}
          />
        )}

        {tab === 'Add-ons' && (
          <AddonsTab
            production={production}
            canAdd={canAddAddon}
            onAdd={() => setShowAddAddon(true)}
            onDelete={(addonId) => deleteAddon(id, addonId)}
            isAdminOrSup={isAdminOrSup}
          />
        )}

        {tab === 'Debrief' && (
          <DebriefTab
            production={production}
            canDebrief={canDebrief}
            onEdit={() => setShowFeedback(true)}
          />
        )}

        {tab === 'Bible' && isAdminOrSup && (
          <ProductionBible production={production} />
        )}
      </div>

      {/* Edit production */}
      <Modal open={showEdit} onClose={() => setShowEdit(false)} title="Edit Production" size="lg">
        <ProductionForm
          initial={production}
          onSubmit={(updated) => {
            updateProduction(id, updated)
            setShowEdit(false)
          }}
          onCancel={() => setShowEdit(false)}
        />
      </Modal>

      {/* Delete production */}
      <ConfirmDialog
        open={showDelete}
        onClose={() => setShowDelete(false)}
        onConfirm={() => { deleteProduction(id); navigate('/productions') }}
        title="Delete Production"
        message={`Delete "${production.name}"? All tasks and records will be permanently removed.`}
        confirmLabel="Delete Production"
        danger
      />

      {/* Add task */}
      <Modal open={showAddTask} onClose={() => setShowAddTask(false)} title="New Task" size="lg">
        <TaskForm
          productionId={id}
          onSubmit={(task) => { addTask(task); setShowAddTask(false) }}
          onCancel={() => setShowAddTask(false)}
        />
      </Modal>

      {/* Add addon */}
      <Modal open={showAddAddon} onClose={() => setShowAddAddon(false)} title="Log Add-on" size="md">
        <AddonForm
          productionId={id}
          onSubmit={(addon) => { addAddon(id, addon); setShowAddAddon(false) }}
          onCancel={() => setShowAddAddon(false)}
        />
      </Modal>

      {/* Feedback */}
      <Modal
        open={showFeedback}
        onClose={() => setShowFeedback(false)}
        title={production.feedback ? 'Edit Debrief' : 'Production Debrief'}
        size="lg"
      >
        <FeedbackForm
          productionId={id}
          initial={production.feedback}
          onSubmit={(fb) => { submitFeedback(id, fb); setShowFeedback(false) }}
          onCancel={() => setShowFeedback(false)}
        />
      </Modal>
    </div>
  )
}

// ─── Tab: Overview ────────────────────────────────────────────────────────────
function OverviewTab({ production, tasks }) {
  const total = tasks.length
  const verified = tasks.filter(t => t.status === TASK_STATUS.VERIFIED).length
  const reported = tasks.filter(t => t.status === TASK_STATUS.COMPLETE || t.status === TASK_STATUS.NEEDS_REVIEW).length
  const overdue = tasks.filter(t => t.dueDate && t.status !== TASK_STATUS.VERIFIED && new Date(t.dueDate) < new Date()).length

  return (
    <div className="space-y-5">
      {/* Task progress */}
      {total > 0 && (
        <div className="card p-5">
          <h3 className="font-semibold text-orbital-text mb-4">Task Progress</h3>
          <div className="grid grid-cols-3 gap-4 mb-4">
            <Stat label="Total" value={total} />
            <Stat label="Verified" value={verified} color="text-green-400" />
            <Stat label="Overdue" value={overdue} color={overdue > 0 ? 'text-red-400' : undefined} />
          </div>
          <div className="w-full h-2 bg-orbital-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-green-500 rounded-full transition-all"
              style={{ width: total > 0 ? `${(verified / total) * 100}%` : '0%' }}
            />
          </div>
          {reported > 0 && (
            <p className="text-xs text-amber-400 mt-2">{reported} task{reported !== 1 ? 's' : ''} reported complete, awaiting verification</p>
          )}
        </div>
      )}

      {/* Notes */}
      {production.instructionPackage?.notes && (
        <div className="card p-5">
          <h3 className="font-semibold text-orbital-text mb-2">Notes</h3>
          <p className="text-sm text-orbital-subtle">{production.instructionPackage.notes}</p>
        </div>
      )}

      {/* Add-ons summary */}
      {production.addons?.length > 0 && (
        <div className="card p-5">
          <h3 className="font-semibold text-orbital-text mb-3">Add-ons</h3>
          <div className="space-y-2">
            {production.addons.slice(0, 3).map(addon => (
              <div key={addon.id} className="flex items-center justify-between text-sm">
                <span className="text-orbital-text">{addon.equipment}</span>
                <div className="flex items-center gap-2">
                  {addon.damaged && (
                    <AlertTriangle size={12} className="text-red-400" />
                  )}
                  {addon.cost && <span className="text-orbital-subtle">${addon.cost}</span>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Feedback summary */}
      {production.feedback && (
        <div className="card p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-orbital-text">Debrief</h3>
            {production.feedback.rating && (
              <div className="flex items-center gap-1">
                {[1,2,3,4,5].map(n => (
                  <Star
                    key={n}
                    size={14}
                    className={n <= production.feedback.rating ? 'text-amber-400 fill-amber-400' : 'text-orbital-border'}
                  />
                ))}
              </div>
            )}
          </div>
          {production.feedback.whatHappened && (
            <p className="text-sm text-orbital-subtle line-clamp-3">{production.feedback.whatHappened}</p>
          )}
        </div>
      )}
    </div>
  )
}

function Stat({ label, value, color }) {
  return (
    <div className="text-center">
      <p className={`text-2xl font-bold ${color || 'text-orbital-text'}`}>{value}</p>
      <p className="text-xs text-orbital-subtle mt-0.5">{label}</p>
    </div>
  )
}

// ─── Tab: Tasks ───────────────────────────────────────────────────────────────
function TasksTab({ production, tasks, canAdd, onAddTask }) {
  const pending = tasks.filter(t => t.status !== TASK_STATUS.VERIFIED)
  const completed = tasks.filter(t => t.status === TASK_STATUS.VERIFIED)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold text-orbital-text">
          Tasks
          <span className="text-orbital-subtle font-normal ml-2 text-sm">{pending.length} pending</span>
        </h2>
        {canAdd && (
          <button onClick={onAddTask} className="btn-primary">
            <Plus size={15} /> Add Task
          </button>
        )}
      </div>

      {tasks.length === 0 && (
        <div className="card p-8 text-center">
          <p className="text-orbital-subtle text-sm mb-3">No tasks yet.</p>
          {canAdd && (
            <button onClick={onAddTask} className="btn-primary">
              <Plus size={15} /> Create first task
            </button>
          )}
        </div>
      )}

      {pending.length > 0 && (
        <div className="space-y-2">
          {pending.map(task => (
            <TaskCard key={task.id} task={task} productionId={production.id} />
          ))}
        </div>
      )}

      {completed.length > 0 && (
        <div>
          <p className="section-title mb-3">Completed ({completed.length})</p>
          <div className="space-y-2">
            {completed.map(task => (
              <TaskCard key={task.id} task={task} productionId={production.id} />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Tab: Package ─────────────────────────────────────────────────────────────
function PackageTab({ production, readOnly, onUpdate }) {
  return (
    <div>
      <h2 className="font-semibold text-orbital-text mb-5">Instruction Package</h2>
      <InstructionPackage
        pkg={production.instructionPackage}
        onChange={onUpdate}
        readOnly={readOnly}
      />
    </div>
  )
}

// ─── Tab: Add-ons ─────────────────────────────────────────────────────────────
function AddonsTab({ production, canAdd, onAdd, onDelete, isAdminOrSup }) {
  const addons = production.addons || []
  const totalCost = addons
    .filter(a => a.cost)
    .reduce((sum, a) => sum + parseFloat(a.cost || 0), 0)
  const damaged = addons.filter(a => a.damaged)

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-semibold text-orbital-text">Add-ons & Expenses</h2>
          {totalCost > 0 && (
            <p className="text-sm text-orbital-subtle mt-0.5">Total logged: ${totalCost.toFixed(2)}</p>
          )}
        </div>
        {canAdd && (
          <button onClick={onAdd} className="btn-primary">
            <Plus size={15} /> Log Add-on
          </button>
        )}
      </div>

      {damaged.length > 0 && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/20">
          <AlertTriangle size={16} className="text-red-400" />
          <span className="text-sm text-red-400 font-medium">{damaged.length} damaged item{damaged.length !== 1 ? 's' : ''} flagged</span>
        </div>
      )}

      {addons.length === 0 ? (
        <div className="card p-8 text-center">
          <p className="text-orbital-subtle text-sm mb-3">No add-ons logged yet.</p>
          {canAdd && (
            <button onClick={onAdd} className="btn-primary">
              <Plus size={15} /> Log first add-on
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {addons.map(addon => (
            <AddonCard
              key={addon.id}
              addon={addon}
              canDelete={isAdminOrSup}
              onDelete={() => onDelete(addon.id)}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function AddonCard({ addon, canDelete, onDelete }) {
  const loggedByUser = USERS.find(u => u.id === addon.loggedBy)
  const [showPhotos, setShowPhotos] = useState(false)

  return (
    <div className={`card p-4 ${addon.damaged ? 'border-red-500/20' : ''}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-medium text-orbital-text text-sm">{addon.equipment}</span>
            {addon.damaged && (
              <span className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-red-500/15 text-red-400 border border-red-500/30 text-xs">
                <AlertTriangle size={10} /> Damaged
              </span>
            )}
          </div>
          <div className="flex flex-wrap gap-3 mt-1.5">
            <span className="text-xs text-orbital-subtle">Qty: {addon.quantity}</span>
            {addon.duration && <span className="text-xs text-orbital-subtle">Duration: {addon.duration}</span>}
            {addon.cost && <span className="text-xs text-green-400 font-medium">${addon.cost}</span>}
          </div>
          {addon.notes && (
            <p className="text-xs text-orbital-subtle mt-2">{addon.notes}</p>
          )}
          <div className="flex items-center gap-2 mt-2">
            {loggedByUser && (
              <div className="flex items-center gap-1.5">
                <Avatar userId={addon.loggedBy} size="xs" />
                <span className="text-xs text-orbital-subtle">
                  {format(parseISO(addon.loggedAt), 'MMM d, h:mm a')}
                </span>
              </div>
            )}
          </div>
        </div>
        {canDelete && (
          <button
            onClick={onDelete}
            className="p-1.5 rounded hover:bg-red-500/10 text-orbital-subtle hover:text-red-400 transition-colors flex-shrink-0"
          >
            <Trash2 size={14} />
          </button>
        )}
      </div>

      {addon.damagePhotos?.length > 0 && (
        <div className="mt-3">
          <button
            onClick={() => setShowPhotos(s => !s)}
            className="text-xs text-blue-400 hover:text-blue-300"
          >
            {showPhotos ? 'Hide' : 'Show'} {addon.damagePhotos.length} damage photo{addon.damagePhotos.length !== 1 ? 's' : ''}
          </button>
          {showPhotos && (
            <div className="grid grid-cols-3 gap-2 mt-2">
              {addon.damagePhotos.map(photo => (
                <img
                  key={photo.id}
                  src={photo.url}
                  alt={photo.name}
                  className="w-full h-20 object-cover rounded-lg border border-orbital-border"
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Tab: Debrief ─────────────────────────────────────────────────────────────
function DebriefTab({ production, canDebrief, onEdit }) {
  const fb = production.feedback

  if (!fb) {
    return (
      <div className="card p-10 text-center">
        <p className="text-orbital-subtle mb-2 text-sm">No debrief submitted yet.</p>
        {canDebrief && (
          <>
            <p className="text-xs text-orbital-subtle mb-5">
              Submit a debrief to capture institutional knowledge for this production.
            </p>
            <button onClick={onEdit} className="btn-primary">
              <FileText size={15} /> Submit Debrief
            </button>
          </>
        )}
      </div>
    )
  }

  const submittedByUser = USERS.find(u => u.id === fb.submittedBy)

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h2 className="font-semibold text-orbital-text">Production Debrief</h2>
          {fb.rating && (
            <div className="flex items-center gap-1">
              {[1,2,3,4,5].map(n => (
                <Star
                  key={n}
                  size={16}
                  className={n <= fb.rating ? 'text-amber-400 fill-amber-400' : 'text-orbital-border'}
                />
              ))}
            </div>
          )}
        </div>
        {canDebrief && (
          <button onClick={onEdit} className="btn-ghost">
            <Edit size={14} /> Edit
          </button>
        )}
      </div>

      {fb.submittedBy && (
        <div className="flex items-center gap-2 text-xs text-orbital-subtle">
          {submittedByUser && <Avatar userId={fb.submittedBy} size="xs" />}
          <span>
            Submitted by {submittedByUser?.name || fb.submittedBy}
            {fb.submittedAt && ` on ${format(parseISO(fb.submittedAt), 'MMMM d, yyyy')}`}
          </span>
        </div>
      )}

      {[
        { label: 'Expectations going in', value: fb.expectations },
        { label: 'What actually happened', value: fb.whatHappened },
        { label: 'Issues encountered', value: fb.issues },
        { label: 'Extra charges incurred', value: fb.extraCharges },
      ].filter(item => item.value).map(({ label, value }) => (
        <div key={label} className="card p-4">
          <p className="section-title mb-2">{label}</p>
          <p className="text-sm text-orbital-subtle">{value}</p>
        </div>
      ))}
    </div>
  )
}
