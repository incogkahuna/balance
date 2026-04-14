import clsx from 'clsx'
import { PRODUCTION_STATUS, TASK_PRIORITY, TASK_STATUS } from '../../data/models.js'
import { TASK_STATUS_CONFIG } from '../../features/tasks/taskStatusConfig.js'

const statusStyles = {
  [PRODUCTION_STATUS.INCOMING]:  'bg-blue-500/15 text-blue-400 border border-blue-500/30',
  [PRODUCTION_STATUS.ACTIVE]:    'bg-green-500/15 text-green-400 border border-green-500/30',
  [PRODUCTION_STATUS.WRAP]:      'bg-amber-500/15 text-amber-400 border border-amber-500/30',
  [PRODUCTION_STATUS.COMPLETED]: 'bg-zinc-600/30 text-zinc-400 border border-zinc-600/40',
}

const priorityStyles = {
  [TASK_PRIORITY.LOW]:      'bg-zinc-600/30 text-zinc-400 border border-zinc-600/40',
  [TASK_PRIORITY.MEDIUM]:   'bg-blue-500/15 text-blue-400 border border-blue-500/30',
  [TASK_PRIORITY.HIGH]:     'bg-amber-500/15 text-amber-400 border border-amber-500/30',
  [TASK_PRIORITY.CRITICAL]: 'bg-red-500/15 text-red-400 border border-red-500/30',
}

export function StatusBadge({ status, className }) {
  const style = statusStyles[status] || 'bg-zinc-600/30 text-zinc-400 border border-zinc-600/40'
  return (
    <span className={clsx('inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium', style, className)}>
      {status}
    </span>
  )
}

export function PriorityBadge({ priority, className }) {
  const style = priorityStyles[priority] || priorityStyles[TASK_PRIORITY.MEDIUM]
  return (
    <span className={clsx('inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium', style, className)}>
      {priority}
    </span>
  )
}

// Reads from task.status (new workflow engine) with graceful fallback
// for any legacy records that haven't been normalised yet.
export function TaskStatusBadge({ task, className }) {
  const status = task.status || (
    task.verifiedComplete ? TASK_STATUS.VERIFIED :
    task.reportedComplete ? TASK_STATUS.COMPLETE :
    TASK_STATUS.NOT_STARTED
  )
  const cfg = TASK_STATUS_CONFIG[status] || TASK_STATUS_CONFIG[TASK_STATUS.NOT_STARTED]
  const Icon = cfg.icon
  return (
    <span className={clsx('inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium', cfg.pillClass, className)}>
      <Icon size={10} />
      {status}
    </span>
  )
}
