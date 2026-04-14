import clsx from 'clsx'
import { PRODUCTION_STATUS, TASK_PRIORITY } from '../../data/models.js'

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

export function TaskStatusBadge({ task, className }) {
  if (task.verifiedComplete) {
    return (
      <span className={clsx('inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium bg-green-500/15 text-green-400 border border-green-500/30', className)}>
        <span className="w-1.5 h-1.5 rounded-full bg-green-400" />
        Verified
      </span>
    )
  }
  if (task.reportedComplete) {
    return (
      <span className={clsx('inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium bg-amber-500/15 text-amber-400 border border-amber-500/30', className)}>
        <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
        Reported
      </span>
    )
  }
  const isOverdue = task.dueDate && new Date(task.dueDate) < new Date()
  if (isOverdue) {
    return (
      <span className={clsx('inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium bg-red-500/15 text-red-400 border border-red-500/30', className)}>
        <span className="w-1.5 h-1.5 rounded-full bg-red-400" />
        Overdue
      </span>
    )
  }
  return (
    <span className={clsx('inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium bg-zinc-600/30 text-zinc-400 border border-zinc-600/40', className)}>
      <span className="w-1.5 h-1.5 rounded-full bg-zinc-400" />
      Pending
    </span>
  )
}
