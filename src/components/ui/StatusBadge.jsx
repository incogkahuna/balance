import clsx from 'clsx'
import { PRODUCTION_STATUS, TASK_PRIORITY, TASK_STATUS } from '../../data/models.js'
import { TASK_STATUS_CONFIG } from '../../features/tasks/taskStatusConfig.js'

// ── Aerospace-style indicator configs ─────────────────────────────────────────
const STATUS_CFG = {
  [PRODUCTION_STATUS.INCOMING]:  { color: '#60a5fa', border: 'rgba(96,165,250,0.45)',  bg: 'rgba(59,130,246,0.07)'  },
  [PRODUCTION_STATUS.ACTIVE]:    { color: '#4ade80', border: 'rgba(74,222,128,0.45)',  bg: 'rgba(34,197,94,0.07)'   },
  [PRODUCTION_STATUS.WRAP]:      { color: '#fbbf24', border: 'rgba(251,191,36,0.45)',  bg: 'rgba(245,158,11,0.07)'  },
  [PRODUCTION_STATUS.COMPLETED]: { color: '#64748b', border: 'rgba(100,116,139,0.35)', bg: 'rgba(100,116,139,0.06)' },
}

const PRIORITY_CFG = {
  [TASK_PRIORITY.LOW]:      { color: '#64748b', border: 'rgba(100,116,139,0.35)', bg: 'rgba(100,116,139,0.06)' },
  [TASK_PRIORITY.MEDIUM]:   { color: '#60a5fa', border: 'rgba(96,165,250,0.4)',   bg: 'rgba(59,130,246,0.07)'  },
  [TASK_PRIORITY.HIGH]:     { color: '#fbbf24', border: 'rgba(251,191,36,0.4)',   bg: 'rgba(245,158,11,0.07)'  },
  [TASK_PRIORITY.CRITICAL]: { color: '#f87171', border: 'rgba(248,113,113,0.45)', bg: 'rgba(239,68,68,0.08)'   },
}

// ── Production status — lit indicator with glow dot ───────────────────────────
export function StatusBadge({ status, className }) {
  const cfg = STATUS_CFG[status] || STATUS_CFG[PRODUCTION_STATUS.COMPLETED]
  return (
    <span
      className={clsx('inline-flex items-center gap-1.5 font-telemetry', className)}
      style={{
        fontSize: '9px',
        letterSpacing: '0.14em',
        lineHeight: 1.4,
        color: cfg.color,
        background: cfg.bg,
        border: `1px solid ${cfg.border}`,
        borderLeftWidth: '2px',
        borderLeftColor: cfg.color,
        padding: '2px 8px 2px 5px',
      }}
    >
      <span style={{
        width: 4, height: 4, borderRadius: '50%',
        background: cfg.color,
        boxShadow: `0 0 5px ${cfg.color}`,
        flexShrink: 0,
      }} />
      {status.toUpperCase()}
    </span>
  )
}

// ── Priority — rectangular tag ────────────────────────────────────────────────
export function PriorityBadge({ priority, className }) {
  const cfg = PRIORITY_CFG[priority] || PRIORITY_CFG[TASK_PRIORITY.MEDIUM]
  return (
    <span
      className={clsx('inline-flex items-center font-telemetry', className)}
      style={{
        fontSize: '9px',
        letterSpacing: '0.12em',
        lineHeight: 1.4,
        color: cfg.color,
        background: cfg.bg,
        border: `1px solid ${cfg.border}`,
        padding: '2px 6px',
      }}
    >
      {priority.toUpperCase()}
    </span>
  )
}

// ── Task workflow status — icon + label ───────────────────────────────────────
export function TaskStatusBadge({ task, className }) {
  const status = task.status || (
    task.verifiedComplete ? TASK_STATUS.VERIFIED :
    task.reportedComplete ? TASK_STATUS.COMPLETE :
    TASK_STATUS.NOT_STARTED
  )
  const cfg  = TASK_STATUS_CONFIG[status] || TASK_STATUS_CONFIG[TASK_STATUS.NOT_STARTED]
  const Icon = cfg.icon
  return (
    <span
      className={clsx('inline-flex items-center gap-1 font-telemetry', cfg.pillClass, className)}
      style={{ fontSize: '9px', letterSpacing: '0.1em', lineHeight: 1.4, padding: '2px 6px', borderRadius: 0 }}
    >
      <Icon size={9} />
      {status.toUpperCase()}
    </span>
  )
}
