import { parseISO, isToday, isPast, isFuture } from 'date-fns'
import { format } from '../../../lib/safeFormat.js'
import { Edit2, Trash2, AlertTriangle, Circle, CheckCircle2, Flame } from 'lucide-react'
import { useApp } from '../../../context/AppContext.jsx'
import { MILESTONE_STATUS, MILESTONE_PRIORITY } from '../../../data/models.js'
import { MILESTONE_TYPE_CONFIG, MILESTONE_STATUS_CONFIG, MILESTONE_PRIORITY_CONFIG } from './roadmapUtils.js'
import { ContractorPhoto } from '../../../components/files/ContractorPhoto.tsx'
import clsx from 'clsx'

export function MilestoneCard({ milestone, canEdit, onEdit, onDelete, onToggleComplete }) {
  const { resolveAssignee } = useApp()
  const typeCfg   = MILESTONE_TYPE_CONFIG[milestone.type]   || MILESTONE_TYPE_CONFIG['Pre-Production']
  const statusCfg = MILESTONE_STATUS_CONFIG[milestone.status] || MILESTONE_STATUS_CONFIG['Upcoming']
  const owner     = milestone.ownerId ? resolveAssignee(milestone.ownerId) : null
  const participants = (milestone.participantIds || [])
    .map(id => resolveAssignee(id))
    .filter(Boolean)
  const totalAssigned = (owner ? 1 : 0) + participants.length

  const date        = milestone.date ? parseISO(milestone.date) : null
  const isPastDate  = date && isPast(date)
  const isTodayDate = date && isToday(date)
  const isAtRisk    = milestone.status === MILESTONE_STATUS.AT_RISK
  const isComplete  = milestone.status === MILESTONE_STATUS.COMPLETE
  const isInProgress = milestone.status === MILESTONE_STATUS.IN_PROGRESS

  // Per-status visual treatment. In Progress always stays loud (even when
  // past-due, since that's active work that needs attention); Complete fades
  // back; Upcoming-past dims slightly; Upcoming-future is neutral.
  return (
    <div className={clsx(
      'relative rounded-lg border p-3.5 transition-all group',
      isInProgress ? 'border-blue-500/60 bg-blue-500/[0.08] shadow-[0_0_18px_rgba(59,130,246,0.18)]' :
      isAtRisk     ? 'border-amber-500/40 bg-amber-500/5' :
      isComplete   ? 'border-orbital-border bg-orbital-surface opacity-55' :
      isTodayDate  ? 'border-blue-500/40 bg-blue-500/5' :
                     'border-orbital-border bg-orbital-muted',
      // Past-dated Upcoming items dim slightly (the date slipped without
      // anyone touching them). In Progress overrides this.
      !isInProgress && !isComplete && !isAtRisk && isPastDate && 'opacity-70'
    )}>
      {/* In Progress accent: thick glowing left border */}
      {isInProgress && (
        <span
          className="absolute left-0 top-0 bottom-0 w-1 rounded-l-lg"
          style={{ background: '#3b82f6', boxShadow: '0 0 8px rgba(59,130,246,0.7)' }}
        />
      )}
      {/* Top row */}
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex items-center gap-2 flex-wrap flex-1 min-w-0">
          {/* Priority chip — only render for Top Priority. Medium is the
              default (most milestones are normal); Low is a visual signal
              that doesn't need a chip up front. Top Priority gets a flame
              icon + red treatment so it pops in a list. */}
          {milestone.priority === MILESTONE_PRIORITY.TOP && (
            <span
              className={clsx(
                'text-xs px-2 py-0.5 rounded border font-medium inline-flex items-center gap-1',
                MILESTONE_PRIORITY_CONFIG[MILESTONE_PRIORITY.TOP].bg,
                MILESTONE_PRIORITY_CONFIG[MILESTONE_PRIORITY.TOP].text,
                MILESTONE_PRIORITY_CONFIG[MILESTONE_PRIORITY.TOP].border,
              )}
              title="Top priority"
            >
              <Flame size={11} />
              Top Priority
            </span>
          )}
          {milestone.priority === MILESTONE_PRIORITY.LOW && (
            <span
              className={clsx(
                'text-xs px-2 py-0.5 rounded border font-medium',
                MILESTONE_PRIORITY_CONFIG[MILESTONE_PRIORITY.LOW].bg,
                MILESTONE_PRIORITY_CONFIG[MILESTONE_PRIORITY.LOW].text,
                MILESTONE_PRIORITY_CONFIG[MILESTONE_PRIORITY.LOW].border,
              )}
              title="Low priority"
            >
              Low
            </span>
          )}
          {/* Type badge */}
          <span className={clsx('text-xs px-2 py-0.5 rounded border font-medium', typeCfg.bg, typeCfg.text, typeCfg.border)}>
            {milestone.type}
          </span>
          {/* Status badge — In Progress is bumped up visually with a brighter
              background and a pulsing dot so it stands out from Complete /
              Upcoming chips. */}
          <span className={clsx(
            'text-xs px-2 py-0.5 rounded border inline-flex items-center gap-1.5',
            isInProgress
              ? 'border-blue-500/70 bg-blue-500/15 text-blue-300 font-semibold'
              : `${statusCfg.bg} ${statusCfg.text} ${statusCfg.border}`
          )}>
            {isInProgress && (
              <span className="relative inline-flex w-1.5 h-1.5 flex-shrink-0">
                <span className="absolute inline-flex w-full h-full rounded-full bg-blue-400 opacity-75 animate-ping" />
                <span className="relative inline-flex w-full h-full rounded-full bg-blue-400" />
              </span>
            )}
            {milestone.status}
          </span>
          {isAtRisk && <AlertTriangle size={13} className="text-amber-400 flex-shrink-0" />}
        </div>

        {/* Complete toggle (always visible to admin/sup) + Edit/Delete
            (hover-only on desktop). Per Wilder: there should be a fast way
            to mark a timeline event complete without opening the edit
            form. The checkbox icon stays visible at all times because
            it's the most frequent action on a milestone. */}
        {canEdit && (
          <div className="flex items-center gap-1 flex-shrink-0">
            {onToggleComplete && (
              <button
                onClick={() => onToggleComplete(milestone)}
                className="p-1.5 rounded hover:bg-orbital-surface transition-colors"
                title={isComplete ? 'Mark as upcoming' : 'Mark complete'}
                style={{ color: isComplete ? '#22c55e' : 'var(--orbital-subtle)' }}
              >
                {isComplete ? <CheckCircle2 size={16} /> : <Circle size={16} />}
              </button>
            )}
            <div className="flex gap-1 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
              <button
                onClick={onEdit}
                className="p-1.5 rounded hover:bg-orbital-surface text-orbital-subtle hover:text-orbital-text transition-colors"
              >
                <Edit2 size={13} />
              </button>
              <button
                onClick={onDelete}
                className="p-1.5 rounded hover:bg-red-500/10 text-orbital-subtle hover:text-red-400 transition-colors"
              >
                <Trash2 size={13} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Title */}
      <p className={clsx(
        'text-sm font-semibold mb-1',
        isComplete ? 'line-through text-orbital-subtle' : 'text-orbital-text'
      )}>
        {milestone.title}
      </p>

      {/* Date */}
      {date && (
        <p className={clsx('text-xs mb-2', isTodayDate ? 'text-blue-400 font-medium' : 'text-orbital-subtle')}>
          {isTodayDate ? '📅 Today — ' : ''}
          {format(date, 'MMM d, yyyy')}
          {milestone.date.includes('T') && milestone.date.slice(11, 16) !== '00:00' && (
            <span className="ml-1">{format(date, 'h:mm a')}</span>
          )}
          {isPastDate && !isComplete && !isTodayDate && (
            <span className="ml-2 text-red-400">overdue</span>
          )}
        </p>
      )}

      {/* Description */}
      {milestone.description && (
        <p className="text-xs text-orbital-subtle mb-2 line-clamp-2">{milestone.description}</p>
      )}

      {/* Assigned team — owner first (with OWNER tag), then participants.
          Each gets a small avatar + name pill so it's clear at a glance
          who's responsible for and contributing to this milestone. */}
      {totalAssigned > 0 && (
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mt-2">
          {owner && (
            <span
              className="inline-flex items-center gap-1.5 px-1.5 py-0.5"
              style={{
                background: 'rgba(96,165,250,0.12)',
                border: '1px solid rgba(96,165,250,0.35)',
              }}
              title={`${owner.name} · Owner`}
            >
              <span
                className="w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-bold text-white flex-shrink-0 overflow-hidden"
                style={!owner.photoUrl ? { backgroundColor: owner.color || '#64748b' } : {}}
              >
                <ContractorPhoto
                  photoUrl={owner.photoUrl}
                  alt={owner.name}
                  className="w-full h-full object-cover"
                  fallback={<>{owner.avatar}</>}
                />
              </span>
              <span className="text-xs text-orbital-text">{owner.name}</span>
              <span className="font-telemetry text-[8px] tracking-wider text-blue-400">OWNER</span>
            </span>
          )}
          {participants.map(person => (
            <span
              key={person.id}
              className="inline-flex items-center gap-1.5 px-1.5 py-0.5"
              style={{ border: '1px solid var(--orbital-border)' }}
              title={person.name}
            >
              <span
                className="w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-bold text-white flex-shrink-0 overflow-hidden"
                style={!person.photoUrl ? { backgroundColor: person.color || '#64748b' } : {}}
              >
                <ContractorPhoto
                  photoUrl={person.photoUrl}
                  alt={person.name}
                  className="w-full h-full object-cover"
                  fallback={<>{person.avatar}</>}
                />
              </span>
              <span className="text-xs text-orbital-subtle">{person.name}</span>
            </span>
          ))}
        </div>
      )}
    </div>
  )
}
