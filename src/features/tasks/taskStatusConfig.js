import { Circle, PlayCircle, Eye, CheckCircle, CheckCheck, XCircle } from 'lucide-react'
import { TASK_STATUS, ROLES } from '../../data/models.js'

// Visual config for each status — single source of truth used by badges,
// cards, the status sheet, and any future views (Kanban, etc.)
export const TASK_STATUS_CONFIG = {
  [TASK_STATUS.NOT_STARTED]: {
    icon: Circle,
    textClass:   'text-orbital-subtle',
    bgClass:     'bg-orbital-muted/40',
    borderClass: 'border-orbital-border',
    dotClass:    'bg-orbital-subtle',
    pillClass:   'bg-orbital-muted text-orbital-subtle border border-orbital-border',
    description: 'Not yet started',
  },
  [TASK_STATUS.IN_PROGRESS]: {
    icon: PlayCircle,
    textClass:   'text-blue-400',
    bgClass:     'bg-blue-500/8',
    borderClass: 'border-blue-500/25',
    dotClass:    'bg-blue-400',
    pillClass:   'bg-blue-500/15 text-blue-400 border border-blue-500/30',
    description: 'Work is underway',
  },
  [TASK_STATUS.NEEDS_REVIEW]: {
    icon: Eye,
    textClass:   'text-amber-400',
    bgClass:     'bg-amber-500/8',
    borderClass: 'border-amber-500/25',
    dotClass:    'bg-amber-400',
    pillClass:   'bg-amber-500/15 text-amber-400 border border-amber-500/30',
    description: 'Flagged for supervisor review',
  },
  [TASK_STATUS.COMPLETE]: {
    icon: CheckCircle,
    textClass:   'text-green-400',
    bgClass:     'bg-green-500/8',
    borderClass: 'border-green-500/25',
    dotClass:    'bg-green-400',
    pillClass:   'bg-green-500/15 text-green-400 border border-green-500/30',
    description: 'Done — awaiting verification',
  },
  [TASK_STATUS.VERIFIED]: {
    icon: CheckCheck,
    textClass:   'text-emerald-400',
    bgClass:     'bg-emerald-500/8',
    borderClass: 'border-emerald-500/25',
    dotClass:    'bg-emerald-400',
    pillClass:   'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30',
    description: 'Confirmed complete',
  },
  [TASK_STATUS.BLOCKED]: {
    icon: XCircle,
    textClass:   'text-red-400',
    bgClass:     'bg-red-500/8',
    borderClass: 'border-red-500/25',
    dotClass:    'bg-red-400',
    pillClass:   'bg-red-500/15 text-red-400 border border-red-500/30',
    description: 'Cannot progress — reason required',
  },
}

/**
 * Returns the list of valid next statuses for a given current status,
 * user role, and whether the current user is the task's assignee.
 *
 * Rules:
 *  - Admin/Supervisor can move to any state except staying in place.
 *  - Crew assignee moves forward only (no skipping to Verified).
 *  - Non-assignee crew cannot change status.
 */
export function getValidTransitions(currentStatus, userRole, isAssignee) {
  const isAdminOrSup = userRole === ROLES.ADMIN || userRole === ROLES.SUPERVISOR

  if (isAdminOrSup) {
    return Object.values(TASK_STATUS).filter(s => s !== currentStatus)
  }

  if (!isAssignee) return []

  // Crew assignee — forward-only with select back-steps allowed
  const map = {
    [TASK_STATUS.NOT_STARTED]:  [TASK_STATUS.IN_PROGRESS, TASK_STATUS.BLOCKED],
    [TASK_STATUS.IN_PROGRESS]:  [TASK_STATUS.NEEDS_REVIEW, TASK_STATUS.COMPLETE, TASK_STATUS.BLOCKED],
    [TASK_STATUS.NEEDS_REVIEW]: [TASK_STATUS.IN_PROGRESS, TASK_STATUS.BLOCKED],
    // Once Complete, assignee can only pull it back to In Progress
    [TASK_STATUS.COMPLETE]:     [TASK_STATUS.IN_PROGRESS],
    // Verified is locked for crew
    [TASK_STATUS.VERIFIED]:     [],
    // Unblocking goes back to In Progress
    [TASK_STATUS.BLOCKED]:      [TASK_STATUS.IN_PROGRESS],
  }

  return map[currentStatus] || []
}

/** Quick helper: is a task considered "done" (no further crew action needed) */
export function isTaskDone(task) {
  return task.status === TASK_STATUS.VERIFIED
}

/** Is a task blocking progress (blocked or overdue and not verified) */
export function isTaskBlocking(task) {
  return task.status === TASK_STATUS.BLOCKED
}
