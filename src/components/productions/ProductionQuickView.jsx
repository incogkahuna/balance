import { format, parseISO, differenceInCalendarDays } from 'date-fns'
import {
  Calendar, MapPin, Package, AlertCircle, AlertTriangle, ArrowRight, Users,
} from 'lucide-react'
import { useApp } from '../../context/AppContext.jsx'
import { TASK_STATUS } from '../../data/models.js'
import { isTaskDone } from '../../features/tasks/taskStatusConfig.js'
import { computeRoadmapHealth, HEALTH_CONFIG } from '../../features/productions/roadmap/roadmapUtils.js'
import { StatusBadge, STATUS_COLOR } from '../ui/StatusBadge.jsx'
import { AvatarGroup } from '../ui/Avatar.jsx'
import { Modal } from '../ui/Modal.jsx'

// ──────────────────────────────────────────────────────────────────────────────
// ProductionQuickView — shared popup that summarises a production at a glance.
//
// Used in two places:
//   1. ProductionsPage  — tap a card on mobile to preview without losing scroll
//   2. Gantt chart       — click a bar to see who's on it + any conflicts
//
// Both call sites pass the full Production object from AppContext (so all the
// roadmap/contractor lookups work). The optional `conflicts` prop lights up an
// extra panel listing resources that are double-booked with other productions —
// the Gantt computes this and passes it in so issues are obvious at a glance.
// ──────────────────────────────────────────────────────────────────────────────

// Production type tint colours — kept here so Gantt and Productions agree on
// how each production type is colour-coded in the popup. Synced with the same
// table on ProductionsPage; if you add a new type, add it in both spots (or
// extract this to its own module — at >2 sites it's worth doing).
const PROD_TYPE_TINT = {
  'TVC AOTO':               { bg: 'rgba(59,130,246,0.12)',  border: 'rgba(59,130,246,0.35)',  text: '#60a5fa' },
  'Mobile CAR process CLI': { bg: 'rgba(251,191,36,0.12)',  border: 'rgba(251,191,36,0.35)',  text: '#fbbf24' },
  'Little Dipper':          { bg: 'rgba(167,139,250,0.12)', border: 'rgba(167,139,250,0.35)', text: '#a78bfa' },
  'LED Volume':             { bg: 'rgba(59,130,246,0.12)',  border: 'rgba(59,130,246,0.35)',  text: '#60a5fa' },
  'Mobile Build':           { bg: 'rgba(251,191,36,0.12)',  border: 'rgba(251,191,36,0.35)',  text: '#fbbf24' },
  'Other':                  { bg: 'rgba(148,163,184,0.12)', border: 'rgba(148,163,184,0.35)', text: '#94a3b8' },
}
const FALLBACK_TINT = { bg: 'rgba(148,163,184,0.12)', border: 'rgba(148,163,184,0.35)', text: '#94a3b8' }

function computeCountdown(prod) {
  if (!prod.startDate) return null
  const today = new Date()
  const start = parseISO(prod.startDate)
  const end   = prod.endDate ? parseISO(prod.endDate) : start
  const daysToStart  = differenceInCalendarDays(start, today)
  const daysSinceEnd = differenceInCalendarDays(today, end)

  if (daysToStart > 0) {
    return { label: `T-${daysToStart}`, sub: daysToStart === 1 ? 'DAY' : 'DAYS', accent: '#60a5fa' }
  }
  if (daysSinceEnd > 0) {
    return { label: `+${daysSinceEnd}`, sub: daysSinceEnd === 1 ? 'DAY AGO' : 'DAYS AGO', accent: '#71717a' }
  }
  const totalDays = differenceInCalendarDays(end, start) + 1
  const dayNum    = differenceInCalendarDays(today, start) + 1
  return { label: `DAY ${dayNum}`, sub: `OF ${totalDays}`, accent: '#34d399' }
}

function getNextMilestone(roadmap) {
  if (!roadmap?.milestones?.length) return null
  return roadmap.milestones.find(m => m.status !== 'Complete') || null
}

export function ProductionQuickView({ production, onClose, onOpenFull, conflicts = [] }) {
  const { tasks, getContractor } = useApp()

  if (!production) return null

  const prod           = production
  const prodTasks      = tasks.filter(t => t.productionId === prod.id)
  const completedTasks = prodTasks.filter(isTaskDone).length
  const memberIds      = (prod.assignedMembers || []).map(m => m.userId)
  const stageManager   = prod.stageManagerId ? getContractor(prod.stageManagerId) : null
  const health         = computeRoadmapHealth(prod.roadmap)
  const borderColor    = prod.cardColor || STATUS_COLOR[prod.status] || '#52525b'
  const pct            = prodTasks.length > 0 ? (completedTasks / prodTasks.length) * 100 : 0

  const typeTint     = PROD_TYPE_TINT[prod.productionType] || FALLBACK_TINT
  const countdown    = computeCountdown(prod)
  const nextMile     = getNextMilestone(prod.roadmap)
  const addonCount   = prod.addons?.length || 0
  const damageCount  = prod.addons?.filter(a => a.damaged).length || 0
  const concernCount = prod.bible?.concerns?.length || 0

  const locationLabel = prod.locationType === 'In-House (Orbital Studios)'
    ? 'Orbital Studios'
    : prod.locationAddress || 'Mobile'

  const hasConflicts = Array.isArray(conflicts) && conflicts.length > 0

  return (
    <Modal open={true} onClose={onClose} title={prod.name} size="md">
      {/* Coloured strap under the modal header — uses the same accent as
          the production card on the list view so the popup feels like a
          continuation of the card. */}
      <div
        className="-mx-5 -mt-5 px-5 pt-3 pb-4 mb-4"
        style={{ borderBottom: '1px solid var(--orbital-border)', borderLeft: `3px solid ${borderColor}` }}
      >
        <p className="text-sm text-orbital-subtle">{prod.client}</p>
        <div className="flex items-center gap-2 mt-2 flex-wrap">
          <StatusBadge status={prod.status} />
          {prod.published === false && (
            <span
              className="text-[10px] font-medium px-1.5 py-0.5 font-telemetry tracking-wider uppercase"
              style={{
                color: '#fbbf24',
                background: 'rgba(251,191,36,0.1)',
                border: '1px solid rgba(251,191,36,0.35)',
              }}
            >
              Draft
            </span>
          )}
          {health !== 'On Track' && HEALTH_CONFIG[health] && (
            <span
              className="text-[11px] font-medium px-2 py-0.5 inline-flex items-center gap-1"
              style={{
                color: '#fb923c',
                background: 'rgba(251,146,60,0.1)',
                border: '1px solid rgba(251,146,60,0.25)',
              }}
            >
              <AlertTriangle size={11} />
              {health}
            </span>
          )}
          {countdown && (
            <span className="font-telemetry text-xs tabular-nums" style={{ color: countdown.accent }}>
              {countdown.label} <span className="text-orbital-subtle text-[10px]">{countdown.sub}</span>
            </span>
          )}
        </div>
      </div>

      <div className="space-y-4">
        {/* Type + date range */}
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <span
            className="font-telemetry tracking-wider uppercase whitespace-nowrap text-[10px] px-2 py-0.5"
            style={{
              background: typeTint.bg,
              border: `1px solid ${typeTint.border}`,
              color: typeTint.text,
            }}
          >
            {prod.productionType}
          </span>
          {prod.startDate && (
            <span className="flex items-center gap-1.5 text-orbital-subtle font-mono text-xs">
              <Calendar size={12} className="flex-shrink-0" />
              {format(parseISO(prod.startDate), 'MMM d, yyyy')}
              {prod.endDate && ` – ${format(parseISO(prod.endDate), 'MMM d, yyyy')}`}
            </span>
          )}
        </div>

        {/* Location + SM */}
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center gap-1.5 text-orbital-subtle text-xs">
            <MapPin size={12} className="flex-shrink-0" />
            <span className="truncate">{locationLabel}</span>
          </div>
          {stageManager && (
            <div className="text-orbital-subtle text-xs">
              SM: <span className="text-orbital-text">{stageManager.name}</span>
            </div>
          )}
        </div>

        {/* Conflicts — Gantt-specific, only renders when caller passes any.
            Red panel so it's the most visually loud thing in the popup
            (Danny's ask: "all the issues should be pretty obvious"). */}
        {hasConflicts && (
          <div
            className="rounded-md p-3"
            style={{
              background: 'rgba(239,68,68,0.08)',
              border: '1px solid rgba(239,68,68,0.35)',
            }}
          >
            <p className="font-telemetry tracking-wider text-[9px] mb-2 flex items-center gap-1.5" style={{ color: '#fca5a5' }}>
              <AlertTriangle size={11} />
              {conflicts.length} CONFLICT{conflicts.length === 1 ? '' : 'S'} — DOUBLE-BOOKED
            </p>
            <ul className="space-y-1.5">
              {conflicts.map((c, i) => (
                <li key={i} className="text-xs flex items-baseline justify-between gap-3">
                  <span className="text-orbital-text font-medium truncate">{c.resourceName}</span>
                  <span className="text-orbital-subtle text-[11px] truncate">
                    also on <span className="text-orbital-text">{c.otherProductionName}</span>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Next milestone */}
        {nextMile && (
          <div className="rounded-md p-3" style={{ background: 'var(--orbital-muted)', border: '1px solid var(--orbital-border)' }}>
            <p className="font-telemetry tracking-wider text-orbital-dim text-[9px] mb-1">NEXT MILESTONE</p>
            <div className="flex items-baseline justify-between gap-3">
              <p className="text-orbital-text text-sm truncate">{nextMile.title}</p>
              {nextMile.date && (
                <span className="font-mono text-orbital-subtle whitespace-nowrap text-xs">
                  {format(parseISO(nextMile.date), 'MMM d')}
                </span>
              )}
            </div>
          </div>
        )}

        {/* Counts row */}
        {(addonCount > 0 || concernCount > 0) && (
          <div className="flex items-center gap-4">
            {addonCount > 0 && (
              <span className="inline-flex items-center gap-1.5 text-xs" style={{ color: damageCount > 0 ? '#fb923c' : 'var(--orbital-text)' }}>
                <Package size={12} />
                <span className="font-semibold tabular-nums">{addonCount}</span>
                <span className="text-orbital-subtle">
                  add-on{addonCount === 1 ? '' : 's'}{damageCount > 0 && ` · ${damageCount} dmg`}
                </span>
              </span>
            )}
            {concernCount > 0 && (
              <span className="inline-flex items-center gap-1.5 text-xs" style={{ color: '#fb923c' }}>
                <AlertCircle size={12} />
                <span className="font-semibold tabular-nums">{concernCount}</span>
                <span className="text-orbital-subtle">
                  concern{concernCount === 1 ? '' : 's'}
                </span>
              </span>
            )}
          </div>
        )}

        {/* Team + task progress */}
        <div
          className="flex items-center justify-between pt-3 gap-4"
          style={{ borderTop: '1px solid var(--orbital-border)' }}
        >
          <div className="min-w-0">
            <p className="font-telemetry tracking-wider text-orbital-dim text-[9px] mb-1.5 flex items-center gap-1.5">
              <Users size={10} /> TEAM
            </p>
            {memberIds.length > 0
              ? <AvatarGroup userIds={memberIds} size="sm" max={6} />
              : <span className="text-xs text-orbital-dim">Nobody assigned</span>}
          </div>
          <div className="text-right">
            <p className="font-telemetry tracking-wider text-orbital-dim text-[9px] mb-1.5">TASKS</p>
            {prodTasks.length > 0 ? (
              <div className="flex items-center gap-2.5">
                <div className="h-1 w-20" style={{ background: 'var(--orbital-border)' }}>
                  <div
                    className="h-full transition-all duration-300"
                    style={{ width: `${pct}%`, background: borderColor }}
                  />
                </div>
                <span className="text-orbital-subtle font-mono tabular-nums text-xs">
                  {completedTasks}/{prodTasks.length}
                </span>
              </div>
            ) : (
              <span className="text-orbital-dim text-xs">No tasks</span>
            )}
          </div>
        </div>

        {/* CTA */}
        {onOpenFull && (
          <button
            onClick={onOpenFull}
            className="btn-primary w-full justify-center mt-2"
          >
            View full page
            <ArrowRight size={14} />
          </button>
        )}
      </div>
    </Modal>
  )
}
