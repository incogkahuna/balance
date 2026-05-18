import { format, parseISO, isToday, isPast, isFuture } from 'date-fns'
import { Edit2, Trash2, AlertTriangle } from 'lucide-react'
import { useApp } from '../../../context/AppContext.jsx'
import { MILESTONE_STATUS } from '../../../data/models.js'
import { MILESTONE_TYPE_CONFIG, MILESTONE_STATUS_CONFIG } from './roadmapUtils.js'
import { ContractorPhoto } from '../../../components/files/ContractorPhoto.tsx'
import clsx from 'clsx'

export function MilestoneCard({ milestone, canEdit, onEdit, onDelete }) {
  const { resolveAssignee } = useApp()
  const typeCfg   = MILESTONE_TYPE_CONFIG[milestone.type]   || MILESTONE_TYPE_CONFIG['Pre-Production']
  const statusCfg = MILESTONE_STATUS_CONFIG[milestone.status] || MILESTONE_STATUS_CONFIG['Upcoming']
  const owner     = milestone.ownerId ? resolveAssignee(milestone.ownerId) : null

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

        {/* Edit/Delete — only visible to admins/sups on hover */}
        {canEdit && (
          <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
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

      {/* Owner */}
      {owner && (
        <div className="flex items-center gap-1.5 mt-1">
          <div
            className="w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-bold text-white flex-shrink-0 overflow-hidden"
            style={!owner.photoUrl ? { backgroundColor: owner.color || '#64748b' } : {}}
          >
            <ContractorPhoto
              photoUrl={owner.photoUrl}
              alt={owner.name}
              className="w-full h-full object-cover"
              fallback={<>{owner.avatar}</>}
            />
          </div>
          <span className="text-xs text-orbital-subtle">{owner.name}</span>
        </div>
      )}
    </div>
  )
}
