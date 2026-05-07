import { supabase } from '../supabase'

// ─── Types ─────────────────────────────────────────────────────────────────
export type TaskPriority = 'Low' | 'Medium' | 'High' | 'Critical'
export type TaskStatus =
  | 'Not Started'
  | 'In Progress'
  | 'Needs Review'
  | 'Complete'
  | 'Verified'
  | 'Blocked'

export interface TaskComment {
  id: string
  taskId: string
  authorId: string | null
  text: string
  createdAt: string
}

export interface Task {
  id: string
  productionId: string
  title: string
  description: string
  assigneeId: string | null
  priority: TaskPriority
  status: TaskStatus
  statusHistory: Array<Record<string, unknown>>
  blockedReason: string
  dueDate: string | null
  completionPhotos: Array<Record<string, unknown>>
  comments: TaskComment[]
  instructionPackage: Record<string, unknown> | null
  createdBy: string | null
  createdAt: string
  updatedAt: string
}

export type NewTask = Partial<Omit<Task, 'createdAt' | 'updatedAt' | 'comments' | 'statusHistory'>>

// ─── Row mappers ───────────────────────────────────────────────────────────
interface TaskRow {
  id: string
  production_id: string
  title: string
  description: string
  assignee_id: string | null
  priority: TaskPriority
  status: TaskStatus
  blocked_reason: string
  due_date: string | null
  completion_photos: Array<Record<string, unknown>>
  instruction_package: Record<string, unknown> | null
  created_by: string | null
  created_at: string
  updated_at: string
}

interface CommentRow {
  id: string
  task_id: string
  author_id: string | null
  body: string
  created_at: string
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const asUuidOrNull = (v: unknown): string | null =>
  typeof v === 'string' && UUID_RE.test(v) ? v : null

function rowToTask(r: TaskRow, comments: TaskComment[] = []): Task {
  return {
    id:                  r.id,
    productionId:        r.production_id,
    title:               r.title,
    description:         r.description,
    assigneeId:          r.assignee_id,
    priority:            r.priority,
    status:              r.status,
    statusHistory:       [],
    blockedReason:       r.blocked_reason,
    dueDate:             r.due_date,
    completionPhotos:    r.completion_photos ?? [],
    comments,
    instructionPackage:  r.instruction_package,
    createdBy:           r.created_by,
    createdAt:           r.created_at,
    updatedAt:           r.updated_at,
  }
}

function rowToComment(r: CommentRow): TaskComment {
  return {
    id:        r.id,
    taskId:    r.task_id,
    authorId:  r.author_id,
    text:      r.body,
    createdAt: r.created_at,
  }
}

function taskToRow(t: NewTask): Partial<TaskRow> {
  const row: Partial<TaskRow> = {}
  if (t.id                  !== undefined) row.id                  = t.id
  if (t.productionId        !== undefined) row.production_id       = t.productionId
  if (t.title               !== undefined) row.title               = t.title
  if (t.description         !== undefined) row.description         = t.description
  if (t.assigneeId          !== undefined) row.assignee_id         = t.assigneeId
  if (t.priority            !== undefined) row.priority            = t.priority
  if (t.status              !== undefined) row.status              = t.status
  if (t.blockedReason       !== undefined) row.blocked_reason      = t.blockedReason
  if (t.dueDate             !== undefined) row.due_date            = t.dueDate || null
  if (t.completionPhotos    !== undefined) row.completion_photos   = t.completionPhotos
  if (t.instructionPackage  !== undefined) row.instruction_package = t.instructionPackage
  if (t.createdBy           !== undefined) row.created_by          = asUuidOrNull(t.createdBy)
  return row
}

// ─── CRUD ──────────────────────────────────────────────────────────────────

/**
 * Fetch all tasks visible to the current user (RLS-filtered) along with their
 * comments. Comments are fetched separately and grouped, so this is two
 * round-trips. Acceptable at studio scale (low hundreds of tasks).
 */
export async function listTasks(): Promise<Task[]> {
  const { data: tasks, error: tasksErr } = await supabase
    .from('tasks')
    .select('*')
    .order('created_at', { ascending: false })
  if (tasksErr) throw tasksErr
  if (!tasks || tasks.length === 0) return []

  const taskIds = tasks.map(t => t.id)
  const { data: comments, error: commentsErr } = await supabase
    .from('task_comments')
    .select('*')
    .in('task_id', taskIds)
    .order('created_at', { ascending: true })
  if (commentsErr) throw commentsErr

  const byTask: Record<string, TaskComment[]> = {}
  for (const c of comments ?? []) {
    const mapped = rowToComment(c as CommentRow)
    if (!byTask[mapped.taskId]) byTask[mapped.taskId] = []
    byTask[mapped.taskId].push(mapped)
  }

  return tasks.map(t => rowToTask(t as TaskRow, byTask[t.id] || []))
}

export async function createTask(t: NewTask): Promise<Task> {
  if (!t.title || !t.productionId) {
    throw new Error('Task title and productionId are required')
  }
  const { data, error } = await supabase
    .from('tasks')
    .insert(taskToRow(t))
    .select('*')
    .single()
  if (error) throw error
  return rowToTask(data as TaskRow, [])
}

export async function updateTask(id: string, patch: NewTask): Promise<Task> {
  const { data, error } = await supabase
    .from('tasks')
    .update(taskToRow(patch))
    .eq('id', id)
    .select('*')
    .single()
  if (error) throw error
  return rowToTask(data as TaskRow, [])
}

export async function deleteTask(id: string): Promise<void> {
  const { error } = await supabase.from('tasks').delete().eq('id', id)
  if (error) throw error
}

// ─── Comments ──────────────────────────────────────────────────────────────

/**
 * Insert a comment on a task. The author MUST equal the current authenticated
 * user's id (enforced by RLS). Returns the persisted comment.
 */
export async function createComment(
  taskId: string,
  authorId: string,
  text: string,
): Promise<TaskComment> {
  const { data, error } = await supabase
    .from('task_comments')
    .insert({
      task_id:   taskId,
      author_id: asUuidOrNull(authorId),
      body:      text,
    })
    .select('*')
    .single()
  if (error) throw error
  return rowToComment(data as CommentRow)
}

// ─── Realtime ──────────────────────────────────────────────────────────────

export type TaskChangeEvent =
  | { type: 'INSERT'; row: Task }
  | { type: 'UPDATE'; row: Task }
  | { type: 'DELETE'; id: string }

export type CommentChangeEvent =
  | { type: 'INSERT'; row: TaskComment }
  | { type: 'DELETE'; id: string; taskId: string }

export function subscribeToTasks(
  onChange: (event: TaskChangeEvent) => void,
): () => void {
  const channel = supabase
    .channel('tasks-changes')
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'tasks' },
      (payload) => {
        if (payload.eventType === 'INSERT') {
          onChange({ type: 'INSERT', row: rowToTask(payload.new as TaskRow, []) })
        } else if (payload.eventType === 'UPDATE') {
          onChange({ type: 'UPDATE', row: rowToTask(payload.new as TaskRow, []) })
        } else if (payload.eventType === 'DELETE') {
          const id = (payload.old as { id?: string })?.id
          if (id) onChange({ type: 'DELETE', id })
        }
      },
    )
    .subscribe()

  return () => { supabase.removeChannel(channel) }
}

export function subscribeToComments(
  onChange: (event: CommentChangeEvent) => void,
): () => void {
  const channel = supabase
    .channel('task-comments-changes')
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'task_comments' },
      (payload) => {
        if (payload.eventType === 'INSERT') {
          onChange({ type: 'INSERT', row: rowToComment(payload.new as CommentRow) })
        } else if (payload.eventType === 'DELETE') {
          const old = payload.old as { id?: string; task_id?: string }
          if (old.id && old.task_id) {
            onChange({ type: 'DELETE', id: old.id, taskId: old.task_id })
          }
        }
      },
    )
    .subscribe()

  return () => { supabase.removeChannel(channel) }
}
