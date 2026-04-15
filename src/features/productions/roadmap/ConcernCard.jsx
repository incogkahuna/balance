import { format, parseISO, isPast } from 'date-fns'
import { Edit2, Trash2, AlertTriangle, CheckCircle } from 'lucide-react'
import { useApp } from '../../../context/AppContext.jsx'
import { CONCERN_STATUS } from '../../../data/models.js'
import {
  CONCERN_IMPACT_CONFIG, CONCERN_STATUS_CONFIG
} from './roadmapUtils.js'
import clsx from 'clsx'

export function ConcernCard({ concern, canEdit, onEdit, onDelete }) {
  const { resolveAssignee } = useApp()
  const impactCfg = CONCERN_IMPACT_CONFIG[concern.impactLevel] || CONCERN_IMPACT_CONFIG['Medium']
  const statusCfg = CONCERN_STATUS_CONFIG[concern.status]      || CONCERN_STATUS_CONFIG['Open']
  const owner = concern.ownerId ? resolveAssignee(concern.ownerId) : null

  const isCritical = concern.impactLevel === 'Critical'
  const isResolved = concern.status === CONCERN_STATUS.RESOLVED || concern.status === CONCERN_STATUS.ACCEPTED
  const isDueOverdue = concern.dueDate && !isResolved && isPast(parseISO(concern.dueDate))

  return (
    <div className={clsx(
      'rounded-lg border p-4 transition-all group',
      isCritical && !isResolved ? 'border-red-500/40 bg-red-500/5' :
      isResolved                ? 'border-orbital-border bg-orbital-surface opacity-65' :
                                  'border-orbital-border bg-orbital-muted'
    )}>
      {/* Top row */}
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex items-center gap-2 flex-wrap flex-1 min-w-0">
          {/* Impact badge */}
          <span className={clsx('text-xs px-2 py-0.5 rounded border font-medium', impactCfg.bg, impactCfg.text, impactCfg.border)}>
            {concern.impactLevel}
          </span>
          {/* Category badge */}
          <span className="text-xs px-2 py-0.5 rounded bg-orbital-surface border border-orbital-border text-orbital-subtle">
            {concern.category}
          </span>
          {/* Status badge */}
          <span className={clsx('text-xs px-2 py-0.5 rounded border', statusCfg.bg, statusCfg.text, statusCfg.border)}>
            {concern.status}
          </span>
        </div>

        {canEdit && (
          <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
            <button onClick={onEdit} className="p-1.5 rounded hover:bg-orbital-surface text-orbital-subtle hover:text-orbital-text transition-colors">
              <Edit2 size={13} />
            </button>
            <button onClick={onDelete} className="p-1.5 rounded hover:bg-red-500/10 text-orbital-subtle hover:text-red-400 transition-colors">
              <Trash2 size={13} />
            </button>
          </div>
        )}
      </div>

      {/* Title */}
      <p className={clsx('text-sm font-semibold mb-1', isResolved ? 'text-orbital-subtle' : 'text-orbital-text')}>
        {concern.title}
      </p>

      {/* Description */}
      {concern.description && (
        <p className="text-xs text-orbital-subtle mb-2 line-clamp-2">{concern.description}</p>
      )}

      {/* Action required */}
      {concern.actionRequired && !isResolved && (
        <div className="flex items-start gap-1.5 mb-2 p-2 rounded bg-orbital-surface border border-orbital-border">
          <AlertTriangle size={11} className="text-orbital-subtle mt-0.5 flex-shrink-0" />
          <p className="text-xs text-orbital-subtle">{concern.actionRequired}</p>
        </div>
      )}

      {/* Resolution notes */}
      {isResolved && concern.resolutionNotes && (
        <div className="flex items-start gap-1.5 mb-2 p-2 rounded bg-green-500/5 border border-green-500/20">
          <CheckCircle size={11} className="text-green-400 mt-0.5 flex-shrink-0" />
          <p className="text-xs text-green-400">{concern.resolutionNotes}</p>
        </div>
      )}

      {/* Footer: owner + due date */}
      <div className="flex items-center justify-between mt-2">
        {owner ? (
          <div className="flex items-center gap-1.5">
            <div
              className="w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-bold text-white flex-shrink-0 overflow-hidden"
              style={!owner.photoUrl ? { backgroundColor: owner.color || '#64748b' } : {}}
            >
              {owner.photoUrl
                ? <img src={owner.photoUrl} alt={owner.name} className="w-full h-full object-cover" />
                : owner.avatar
              }
            </div>
            <span className="text-xs text-orbital-subtle">{owner.name}</span>
          </div>
        ) : <span />}

        {concern.dueDate && (
          <span className={clsx('text-xs', isDueOverdue ? 'text-red-400 font-medium' : 'text-orbital-subtle')}>
            {isDueOverdue ? 'Overdue · ' : 'Due '}
            {format(parseISO(concern.dueDate), 'MMM d')}
          </span>
        )}
      </div>
    </div>
  )
}
