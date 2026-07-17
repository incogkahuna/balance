import { format, parseISO, isFuture, isPast, isToday } from 'date-fns'
import { AlertTriangle, Calendar, ChevronRight, Clock, Map, Users, User, Package, Film, MapPin } from 'lucide-react'
import { useApp } from '../../../context/AppContext.jsx'
import { MILESTONE_STATUS, CONCERN_STATUS, CONCERN_IMPACT } from '../../../data/models.js'
import {
  MILESTONE_TYPE_CONFIG, MILESTONE_STATUS_CONFIG,
  CONCERN_IMPACT_CONFIG, getUpcomingMilestones
} from './roadmapUtils.js'
import { MilestoneCard } from './MilestoneCard.jsx'
import clsx from 'clsx'

// The key bullets of the project — who / when / what / package basics.
function ProjectSummaryCard({ production }) {
  const { resolveAssignee, getContractor } = useApp()

  const orbitalTeam = (production.assignedMembers || [])
    .map(m => resolveAssignee(m.userId))
    .filter(Boolean)
  const stageManager = production.stageManagerId ? getContractor?.(production.stageManagerId) : null
  const keyPlayers = production.bible?.keyPlayers || []
  const pkgNotes  = production.instructionPackage?.notes || ''
  const pkgFiles  = production.instructionPackage?.files?.length || 0
  const addonCount = production.addons?.length || 0

  const dates = production.startDate
    ? `${format(parseISO(production.startDate), 'MMM d, yyyy')}${
        production.endDate && production.endDate !== production.startDate
          ? ` → ${format(parseISO(production.endDate), 'MMM d, yyyy')}` : ''}`
    : 'Dates TBD'

  const rows = [
    { icon: Calendar, label: 'When', value: dates },
    {
      icon: Film, label: 'What',
      value: [production.productionType, production.locationType].filter(Boolean).join(' · ') || 'Type TBD',
    },
    production.locationAddress && { icon: MapPin, label: 'Where', value: production.locationAddress },
    {
      icon: Users, label: 'Orbital team',
      value: orbitalTeam.length
        ? orbitalTeam.map(u => u.name).join(', ') + (stageManager ? ` · SM: ${stageManager.name}` : '')
        : (stageManager ? `SM: ${stageManager.name}` : 'No one assigned yet'),
    },
    {
      icon: User, label: 'Key players',
      value: keyPlayers.length
        ? keyPlayers.map(p => p.role ? `${p.name} (${p.role})` : p.name).join(', ')
        : 'None captured yet — add them in the Bible',
    },
    {
      icon: Package, label: 'Package',
      value: [
        pkgNotes ? (pkgNotes.length > 120 ? `${pkgNotes.slice(0, 120)}…` : pkgNotes) : null,
        pkgFiles ? `${pkgFiles} file${pkgFiles === 1 ? '' : 's'}` : null,
        addonCount ? `${addonCount} add-on${addonCount === 1 ? '' : 's'}` : null,
      ].filter(Boolean).join(' · ') || 'No package details yet',
    },
  ].filter(Boolean)

  return (
    <div className="rounded-lg border border-orbital-border overflow-hidden">
      <div className="px-4 py-2.5 bg-orbital-muted border-b border-orbital-border">
        <p className="hud-label text-[10px]">Project Summary</p>
      </div>
      <div className="divide-y divide-orbital-border/50">
        {rows.map(({ icon: Icon, label, value }) => (
          <div key={label} className="flex items-start gap-3 px-4 py-2.5">
            <Icon size={13} className="text-orbital-subtle flex-shrink-0 mt-0.5" />
            <span className="text-xs text-orbital-subtle w-20 flex-shrink-0 mt-0.5">{label}</span>
            <span className="text-sm text-orbital-text flex-1 min-w-0">{value}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

export function RoadmapSummary({
  roadmap, production, canEdit,
  onEdit, onDelete, onToggleComplete,
  onEditConcern, onSetSubTab,
}) {
  const { resolveAssignee } = useApp()
  const milestones = roadmap.milestones || []
  const concerns   = roadmap.logisticalConcerns || []

  // Next 3 upcoming milestones
  const next3 = getUpcomingMilestones(roadmap, 3)

  // All upcoming (for full timeline below strip)
  const upcoming = getUpcomingMilestones(roadmap)

  // Past milestones (completed or overdue)
  const past = milestones
    .filter(m => m.date && isPast(parseISO(m.date)) && !isToday(parseISO(m.date)))
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 5)

  // Open critical or high concerns
  const alertConcerns = concerns.filter(c =>
    (c.impactLevel === 'Critical' || c.impactLevel === 'High') &&
    c.status !== CONCERN_STATUS.RESOLVED && c.status !== CONCERN_STATUS.ACCEPTED
  ).sort((a, b) => a.impactLevel === 'Critical' ? -1 : 1)

  // At-risk items — surfaces what's actually behind the "At Risk" health
  // indicator on the production. Per Wilder's feedback: when the user sees
  // an At Risk badge, clicking through should reveal the actual offending
  // items (overdue milestones + critical concerns), each clickable so they
  // can be acted on directly.
  const now = new Date()
  const overdueMilestones = milestones.filter(m =>
    m.date && new Date(m.date) < now && m.status !== MILESTONE_STATUS.COMPLETE
  )
  const atRiskMilestones = milestones.filter(m =>
    m.status === MILESTONE_STATUS.AT_RISK
  )
  const criticalConcerns = concerns.filter(c =>
    c.impactLevel === CONCERN_IMPACT.CRITICAL &&
    c.status !== CONCERN_STATUS.RESOLVED && c.status !== CONCERN_STATUS.ACCEPTED
  )
  // Deduplicate (a milestone could be both overdue AND status=AT_RISK).
  const atRiskMilestoneIds = new Set()
  const atRiskMilestonesAll = [...overdueMilestones, ...atRiskMilestones]
    .filter(m => {
      if (atRiskMilestoneIds.has(m.id)) return false
      atRiskMilestoneIds.add(m.id); return true
    })
  const atRiskCount = atRiskMilestonesAll.length + criticalConcerns.length

  const isEmpty = milestones.length === 0 && concerns.length === 0

  return (
    <div className="space-y-6">

      {/* ── Project summary — the key bullets (Danny item 11): who's on it
          from Orbital, who the key players are, when, what type, and the
          basics of their package. Renders even with an empty roadmap so
          the Summary tab is never just a redirect to Timeline. ── */}
      <ProjectSummaryCard production={production} />

      {isEmpty && (
        <div className="text-center py-10 rounded-lg border border-orbital-border">
          <div className="w-14 h-14 rounded-2xl bg-orbital-muted flex items-center justify-center mx-auto mb-4">
            <Map size={22} className="text-orbital-subtle" />
          </div>
          <h3 className="font-semibold text-orbital-text mb-2">No roadmap yet</h3>
          <p className="text-sm text-orbital-subtle max-w-xs mx-auto mb-5">
            Add milestones to map out the timeline and log logistical concerns as they emerge.
          </p>
          {canEdit && (
            <button onClick={() => onSetSubTab('Timeline')} className="btn-primary">
              <Calendar size={15} /> Add First Milestone
            </button>
          )}
        </div>
      )}

      {/* At Risk alert — only renders when there's something actually wrong.
          Lists overdue milestones, at-risk-status milestones, and open
          critical concerns. Each row is clickable to open the relevant
          edit form (milestones) or jump to the concerns tab — per Wilder:
          clicking the at-risk indicator should reveal what's at risk. */}
      {atRiskCount > 0 && (
        <div
          className="rounded-lg p-4"
          style={{
            background: 'rgba(239,68,68,0.06)',
            border: '1px solid rgba(239,68,68,0.4)',
          }}
        >
          <h3 className="font-semibold text-sm flex items-center gap-2 mb-3" style={{ color: '#fca5a5' }}>
            <AlertTriangle size={14} />
            {atRiskCount} item{atRiskCount === 1 ? '' : 's'} at risk
          </h3>
          <ul className="space-y-1.5">
            {atRiskMilestonesAll.map(m => {
              const date = m.date ? parseISO(m.date) : null
              const isOverdue = date && date < now
              return (
                <li key={`m-${m.id}`}>
                  <button
                    onClick={() => onEdit?.(m)}
                    className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-md text-left transition-colors hover:bg-red-500/10"
                  >
                    <Clock size={12} className="text-red-400 flex-shrink-0" />
                    <span className="text-xs font-mono text-red-400/80 flex-shrink-0">
                      {isOverdue ? 'OVERDUE' : 'AT RISK'}
                    </span>
                    <span className="text-sm text-orbital-text truncate flex-1">{m.title}</span>
                    {date && (
                      <span className="text-xs text-orbital-subtle font-mono flex-shrink-0">
                        {format(date, 'MMM d')}
                      </span>
                    )}
                    <ChevronRight size={12} className="text-orbital-dim flex-shrink-0" />
                  </button>
                </li>
              )
            })}
            {criticalConcerns.map(c => (
              <li key={`c-${c.id}`}>
                <button
                  onClick={() => onEditConcern ? onEditConcern(c) : onSetSubTab('Concerns')}
                  className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-md text-left transition-colors hover:bg-red-500/10"
                >
                  <AlertTriangle size={12} className="text-red-400 flex-shrink-0" />
                  <span className="text-xs font-mono text-red-400/80 flex-shrink-0">CRITICAL</span>
                  <span className="text-sm text-orbital-text truncate flex-1">{c.title}</span>
                  <ChevronRight size={12} className="text-orbital-dim flex-shrink-0" />
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Priority strip — next 3 milestones */}
      {next3.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-orbital-text text-sm">Next Up</h3>
            {milestones.length > 3 && (
              <button
                onClick={() => onSetSubTab('Timeline')}
                className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1"
              >
                Full timeline <ChevronRight size={12} />
              </button>
            )}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {next3.map((m, i) => {
              const typeCfg = MILESTONE_TYPE_CONFIG[m.type] || MILESTONE_TYPE_CONFIG['Pre-Production']
              const owner   = m.ownerId ? resolveAssignee(m.ownerId) : null
              return (
                <div
                  key={m.id}
                  className={clsx(
                    'rounded-xl p-3.5 border-l-4 bg-orbital-muted border border-orbital-border',
                    m.status === MILESTONE_STATUS.AT_RISK ? 'border-l-amber-400' : ''
                  )}
                  style={m.status !== MILESTONE_STATUS.AT_RISK ? { borderLeftColor: typeCfg.color } : {}}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className={clsx('text-xs px-1.5 py-0.5 rounded font-medium', typeCfg.bg, typeCfg.text)}>
                      {m.type}
                    </span>
                    {i === 0 && (
                      <span className="text-xs text-orbital-subtle">Next</span>
                    )}
                  </div>
                  <p className="text-sm font-semibold text-orbital-text mt-1 mb-1">{m.title}</p>
                  {m.date && (
                    <p className="text-xs text-orbital-subtle">
                      {isToday(parseISO(m.date)) ? 'Today' : format(parseISO(m.date), 'MMM d')}
                      {m.date.includes('T') && m.date.slice(11, 16) !== '00:00' && (
                        <span className="ml-1">{format(parseISO(m.date), 'h:mm a')}</span>
                      )}
                    </p>
                  )}
                  {owner && (
                    <p className="text-xs text-orbital-subtle mt-1">{owner.name}</p>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Alert strip — critical/high open concerns */}
      {alertConcerns.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-orbital-text text-sm flex items-center gap-2">
              <AlertTriangle size={14} className="text-red-400" />
              Open Concerns Needing Action
            </h3>
            <button
              onClick={() => onSetSubTab('Concerns')}
              className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1"
            >
              View all <ChevronRight size={12} />
            </button>
          </div>
          <div className="space-y-2">
            {alertConcerns.slice(0, 3).map(c => {
              const impactCfg = CONCERN_IMPACT_CONFIG[c.impactLevel]
              return (
                <div
                  key={c.id}
                  className={clsx(
                    'flex items-start gap-3 p-3 rounded-lg border',
                    c.impactLevel === 'Critical'
                      ? 'bg-red-500/5 border-red-500/30'
                      : 'bg-amber-500/5 border-amber-500/30'
                  )}
                >
                  <span className={clsx('text-xs px-2 py-0.5 rounded border font-medium flex-shrink-0 mt-0.5', impactCfg.bg, impactCfg.text, impactCfg.border)}>
                    {c.impactLevel}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-orbital-text">{c.title}</p>
                    {c.actionRequired && (
                      <p className="text-xs text-orbital-subtle mt-0.5 truncate">{c.actionRequired}</p>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Upcoming milestones list */}
      {upcoming.length > 0 && (
        <div>
          <h3 className="font-semibold text-orbital-text text-sm mb-3">
            Upcoming ({upcoming.length})
          </h3>
          <div className="space-y-2">
            {upcoming.slice(0, 8).map(m => (
              <MilestoneCard
                key={m.id}
                milestone={m}
                canEdit={canEdit}
                onEdit={() => onEdit(m)}
                onDelete={() => onDelete(m.id)}
                onToggleComplete={onToggleComplete}
              />
            ))}
            {upcoming.length > 8 && (
              <button
                onClick={() => onSetSubTab('Timeline')}
                className="text-xs text-blue-400 hover:text-blue-300 w-full text-center py-2"
              >
                +{upcoming.length - 8} more — view full timeline →
              </button>
            )}
          </div>
        </div>
      )}

      {/* Recent past milestones */}
      {past.length > 0 && (
        <div>
          <h3 className="font-semibold text-orbital-subtle text-sm mb-3">Recent Past</h3>
          <div className="space-y-2 opacity-60">
            {past.slice(0, 3).map(m => (
              <MilestoneCard
                key={m.id}
                milestone={m}
                canEdit={canEdit}
                onEdit={() => onEdit(m)}
                onDelete={() => onDelete(m.id)}
                onToggleComplete={onToggleComplete}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
