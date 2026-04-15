import { useState } from 'react'
import { Plus } from 'lucide-react'
import { useApp } from '../../../context/AppContext.jsx'
import { ROLES } from '../../../data/models.js'
import { RoadmapHealth } from './RoadmapHealth.jsx'
import { RoadmapSummary } from './RoadmapSummary.jsx'
import { Timeline } from './Timeline.jsx'
import { LogisticalConcerns } from './LogisticalConcerns.jsx'
import { MilestoneForm } from './MilestoneForm.jsx'
import { ConcernForm } from './ConcernForm.jsx'
import clsx from 'clsx'

const SUB_TABS = ['Summary', 'Timeline', 'Concerns']

export function RoadmapTab({ production }) {
  const {
    currentUser,
    addMilestone, updateMilestone, deleteMilestone,
    addConcern,   updateConcern,   deleteConcern,
  } = useApp()

  const [subTab, setSubTab] = useState('Summary')
  const [showMilestoneForm, setShowMilestoneForm] = useState(false)
  const [showConcernForm,   setShowConcernForm]   = useState(false)
  const [editingMilestone, setEditingMilestone]   = useState(null)
  const [editingConcern,   setEditingConcern]     = useState(null)

  const canEdit = currentUser?.role === ROLES.ADMIN || currentUser?.role === ROLES.SUPERVISOR
  const roadmap = production.roadmap || { milestones: [], logisticalConcerns: [] }

  // ─── Milestone handlers ────────────────────────────────────────────────────
  const openAddMilestone = () => { setEditingMilestone(null); setShowMilestoneForm(true) }
  const openEditMilestone = (m) => { setEditingMilestone(m); setShowMilestoneForm(true) }

  const handleMilestoneSubmit = (milestone) => {
    if (editingMilestone) {
      updateMilestone(production.id, milestone.id, milestone)
    } else {
      addMilestone(production.id, milestone)
    }
    setShowMilestoneForm(false)
    setEditingMilestone(null)
  }

  const handleDeleteMilestone = (milestoneId) => {
    deleteMilestone(production.id, milestoneId)
  }

  // ─── Concern handlers ──────────────────────────────────────────────────────
  const openAddConcern = () => { setEditingConcern(null); setShowConcernForm(true) }
  const openEditConcern = (c) => { setEditingConcern(c); setShowConcernForm(true) }

  const handleConcernSubmit = (concern) => {
    if (editingConcern) {
      updateConcern(production.id, concern.id, concern)
    } else {
      addConcern(production.id, concern)
    }
    setShowConcernForm(false)
    setEditingConcern(null)
  }

  const handleDeleteConcern = (concernId) => {
    deleteConcern(production.id, concernId)
  }

  // ─── Floating add button (context-aware) ──────────────────────────────────
  const FloatingAdd = canEdit && (
    <button
      onClick={subTab === 'Concerns' ? openAddConcern : openAddMilestone}
      className="fixed bottom-6 right-6 z-30 w-12 h-12 rounded-full bg-blue-600 hover:bg-blue-500 text-white shadow-lg flex items-center justify-center transition-all active:scale-95 lg:static lg:rounded-lg lg:w-auto lg:h-auto lg:px-3 lg:py-2 lg:shadow-none lg:btn-primary"
      title={subTab === 'Concerns' ? 'Add Concern' : 'Add Milestone'}
    >
      <Plus size={20} className="lg:hidden" />
      <span className="hidden lg:flex items-center gap-1.5">
        <Plus size={14} />
        {subTab === 'Concerns' ? 'Add Concern' : 'Add Milestone'}
      </span>
    </button>
  )

  return (
    <div>
      {/* Health + controls row */}
      <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <h2 className="font-semibold text-orbital-text">Roadmap</h2>
          <RoadmapHealth roadmap={roadmap} />
        </div>
        {/* Desktop add button */}
        <div className="hidden lg:block">{FloatingAdd}</div>
      </div>

      {/* Sub-tab nav */}
      <div className="flex gap-1 mb-6 border-b border-orbital-border pb-px">
        {SUB_TABS.map(t => (
          <button
            key={t}
            onClick={() => setSubTab(t)}
            className={clsx(
              'px-4 py-2 rounded-t-lg text-sm font-medium whitespace-nowrap transition-colors relative',
              subTab === t
                ? 'text-blue-400 bg-blue-600/10'
                : 'text-orbital-subtle hover:text-orbital-text hover:bg-orbital-muted'
            )}
          >
            {t}
            {t === 'Timeline' && roadmap.milestones.length > 0 && (
              <span className="ml-1.5 px-1.5 py-0.5 rounded-full bg-orbital-muted text-orbital-subtle text-xs">
                {roadmap.milestones.length}
              </span>
            )}
            {t === 'Concerns' && (roadmap.logisticalConcerns || []).filter(c =>
              c.status !== 'Resolved' && c.status !== 'Accepted Risk'
            ).length > 0 && (
              <span className="ml-1.5 px-1.5 py-0.5 rounded-full bg-amber-500/20 text-amber-400 text-xs">
                {(roadmap.logisticalConcerns || []).filter(c =>
                  c.status !== 'Resolved' && c.status !== 'Accepted Risk'
                ).length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Sub-tab content */}
      {subTab === 'Summary' && (
        <RoadmapSummary
          roadmap={roadmap}
          production={production}
          canEdit={canEdit}
          onEdit={openEditMilestone}
          onDelete={handleDeleteMilestone}
          onSetSubTab={setSubTab}
        />
      )}

      {subTab === 'Timeline' && (
        <Timeline
          milestones={roadmap.milestones || []}
          canEdit={canEdit}
          onEdit={openEditMilestone}
          onDelete={handleDeleteMilestone}
          onAdd={openAddMilestone}
        />
      )}

      {subTab === 'Concerns' && (
        <LogisticalConcerns
          concerns={roadmap.logisticalConcerns || []}
          canEdit={canEdit}
          onAdd={openAddConcern}
          onEdit={openEditConcern}
          onDelete={handleDeleteConcern}
        />
      )}

      {/* Mobile floating add button */}
      <div className="lg:hidden">{FloatingAdd}</div>

      {/* Forms */}
      {showMilestoneForm && (
        <MilestoneForm
          production={production}
          initial={editingMilestone}
          onSubmit={handleMilestoneSubmit}
          onCancel={() => { setShowMilestoneForm(false); setEditingMilestone(null) }}
        />
      )}

      {showConcernForm && (
        <ConcernForm
          production={production}
          initial={editingConcern}
          onSubmit={handleConcernSubmit}
          onCancel={() => { setShowConcernForm(false); setEditingConcern(null) }}
        />
      )}
    </div>
  )
}
