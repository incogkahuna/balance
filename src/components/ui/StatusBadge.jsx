import clsx from 'clsx'
import { PRODUCTION_STATUS, TASK_PRIORITY, TASK_STATUS } from '../../data/models.js'
import { TASK_STATUS_CONFIG } from '../../features/tasks/taskStatusConfig.js'

// ── Status color map — color used for dot, text, and left borders ─────────────
export const STATUS_COLOR = {
  [PRODUCTION_STATUS.INCOMING]:  '#3b82f6',
  [PRODUCTION_STATUS.ACTIVE]:    '#22c55e',
  [PRODUCTION_STATUS.WRAP]:      '#f59e0b',
  [PRODUCTION_STATUS.COMPLETED]: '#52525b',
}

const STATUS_TEXT = {
  [PRODUCTION_STATUS.INCOMING]:  '#60a5fa',
  [PRODUCTION_STATUS.ACTIVE]:    '#4ade80',
  [PRODUCTION_STATUS.WRAP]:      '#fbbf24',
  [PRODUCTION_STATUS.COMPLETED]: '#71717a',
}

const PRIORITY_COLOR = {
  [TASK_PRIORITY.LOW]:      { text: '#71717a', bg: 'rgba(113,113,122,0.12)' },
  [TASK_PRIORITY.MEDIUM]:   { text: '#60a5fa', bg: 'rgba(59,130,246,0.1)'   },
  [TASK_PRIORITY.HIGH]:     { text: '#fbbf24', bg: 'rgba(245,158,11,0.1)'   },
  [TASK_PRIORITY.CRITICAL]: { text: '#f87171', bg: 'rgba(239,68,68,0.12)'   },
}

// ── Production status ─────────────────────────────────────────────────────────
export function StatusBadge({ status, className }) {
  if (!status) return null
  const dot  = STATUS_COLOR[status]  || '#52525b'
  const text = STATUS_TEXT[status]   || '#71717a'
  return (
    <span
      className={clsx('inline-flex items-center gap-1.5 text-xs font-medium', className)}
      style={{ color: text }}
    >
      <span
        className="rounded-full flex-shrink-0"
        style={{ width: 6, height: 6, background: dot }}
      />
      {status}
    </span>
  )
}

// ── Priority ──────────────────────────────────────────────────────────────────
export function PriorityBadge({ priority, className }) {
  if (!priority) return null
  const cfg = PRIORITY_COLOR[priority] || PRIORITY_COLOR[TASK_PRIORITY.MEDIUM]
  return (
    <span
      className={clsx('inline-flex items-center text-[11px] font-medium px-1.5 py-0', className)}
      style={{ color: cfg.text, background: cfg.bg }}
    >
      {priority}
    </span>
  )
}

// ── Task workflow status ──────────────────────────────────────────────────────
export function TaskStatusBadge({ task, className }) {
  if (!task) return null
  const status = task.status || (
    task.verifiedComplete ? TASK_STATUS.VERIFIED :
    task.reportedComplete ? TASK_STATUS.COMPLETE :
    TASK_STATUS.NOT_STARTED
  )
  const cfg  = TASK_STATUS_CONFIG[status] || TASK_STATUS_CONFIG[TASK_STATUS.NOT_STARTED]
  const Icon = cfg.icon
  return (
    <span
      className={clsx('inline-flex items-center gap-1 text-[11px] font-medium', cfg.pillClass, className)}
      style={{ padding: '1px 6px', borderRadius: 2 }}
    >
      <Icon size={9} />
      {status}
    </span>
  )
}
