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
  authorName: string
  text: string
  photoStoragePath: string | null
  photoName: string | null
  createdAt: string
}

// One entry in a task's status trail. Persisted rows come from the
// task_status_history table (trigger-written); optimistic entries appended
// client-side carry byName directly.
export interface TaskStatusEntry {
  from: string | null
  to: string
  by: string | null      // profile UUID (changed_by) — resolve name via profiles
  byName?: string        // present on optimistic client-side entries
  at: string
  note: string | null
}

export type TaskVisibility = 'team' | 'personal'

export interface Task {
  id: string
  productionId: string | null   // null = freestanding to-do (M2)
  title: string
  description: string
  assigneeId: string | null
  assignedBy: string | null
  priority: TaskPriority
  status: TaskStatus
  statusHistory: TaskStatusEntry[]
  blockedReason: string
  expectationsNote: string
  completionNote: string
  dueDate: string | null
  visibility: TaskVisibility
  completedAt: string | null    // trigger-stamped on entering Complete/Verified
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
  production_id: string | null
  title: string
  description: string
  assignee_id: string | null
  assigned_by: string | null
  priority: TaskPriority
  status: TaskStatus
  blocked_reason: string
  expectations_note: string
  completion_note: string
  due_date: string | null
  visibility: TaskVisibility | null
  completed_at: string | null
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
  author_name: string | null
  body: string
  photo_storage_path: string | null
  photo_name: string | null
  created_at: string
}

interface StatusHistoryRow {
  id: string
  task_id: string
  from_status: string | null
  to_status: string
  changed_by: string | null
  changed_at: string
  note: string | null
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const asUuidOrNull = (v: unknown): string | null =>
  typeof v === 'string' && UUID_RE.test(v) ? v : null

function rowToTask(
  r: TaskRow,
  comments: TaskComment[] = [],
  statusHistory: TaskStatusEntry[] = [],
): Task {
  return {
    id:                  r.id,
    productionId:        r.production_id,
    title:               r.title,
    description:         r.description,
    assigneeId:          r.assignee_id,
    assignedBy:          r.assigned_by,
    priority:            r.priority,
    status:              r.status,
    statusHistory,
    blockedReason:       r.blocked_reason,
    expectationsNote:    r.expectations_note ?? '',
    completionNote:      r.completion_note ?? '',
    dueDate:             r.due_date,
    visibility:          r.visibility ?? 'team',
    completedAt:         r.completed_at ?? null,
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
    id:               r.id,
    taskId:           r.task_id,
    authorId:         r.author_id,
    authorName:       r.author_name ?? '',
    text:             r.body,
    photoStoragePath: r.photo_storage_path,
    photoName:        r.photo_name,
    createdAt:        r.created_at,
  }
}

function rowToStatusEntry(r: StatusHistoryRow): TaskStatusEntry {
  return {
    from: r.from_status,
    to:   r.to_status,
    by:   r.changed_by,
    at:   r.changed_at,
    note: r.note,
  }
}

function taskToRow(t: NewTask): Partial<TaskRow> {
  const row: Partial<TaskRow> = {}
  if (t.id                  !== undefined) row.id                  = t.id
  // '' → null: a freestanding to-do has no production (M2)
  if (t.productionId        !== undefined) row.production_id       = t.productionId || null
  if (t.visibility          !== undefined) row.visibility          = t.visibility
  // completed_at is trigger-owned server-side — never sent from the client
  if (t.title               !== undefined) row.title               = t.title
  if (t.description         !== undefined) row.description         = t.description
  if (t.assigneeId          !== undefined) row.assignee_id         = t.assigneeId
  if (t.priority            !== undefined) row.priority            = t.priority
  if (t.status              !== undefined) row.status              = t.status
  if (t.blockedReason       !== undefined) row.blocked_reason      = t.blockedReason
  if (t.expectationsNote    !== undefined) row.expectations_note   = t.expectationsNote
  if (t.completionNote      !== undefined) row.completion_note     = t.completionNote
  if (t.assignedBy          !== undefined) row.assigned_by         = t.assignedBy || null
  if (t.dueDate             !== undefined) row.due_date            = t.dueDate || null
  if (t.completionPhotos    !== undefined) row.completion_photos   = t.completionPhotos
  if (t.instructionPackage  !== undefined) row.instruction_package = t.instructionPackage
  if (t.createdBy           !== undefined) row.created_by          = asUuidOrNull(t.createdBy)
  return row
}

// ─── CRUD ──────────────────────────────────────────────────────────────────

/**
 * Fetch all tasks visible to the current user (RLS-filtered) along with their
 * comments and status history. Comments/history are fetched separately and
 * grouped, so this is three round-trips. Acceptable at studio scale (low
 * hundreds of tasks).
 */
export async function listTasks(): Promise<Task[]> {
  const { data: tasks, error: tasksErr } = await supabase
    .from('tasks')
    .select('*')
    .order('created_at', { ascending: false })
  if (tasksErr) throw tasksErr
  if (!tasks || tasks.length === 0) return []

  const taskIds = tasks.map(t => t.id)
  const [commentsRes, historyRes] = await Promise.all([
    supabase
      .from('task_comments')
      .select('*')
      .in('task_id', taskIds)
      .order('created_at', { ascending: true }),
    supabase
      .from('task_status_history')
      .select('*')
      .in('task_id', taskIds)
      .order('changed_at', { ascending: true }),
  ])
  if (commentsRes.error) throw commentsRes.error
  // History is best-effort — an RLS hiccup here shouldn't sink the task list.
  if (historyRes.error) console.warn('[tasks] status history fetch failed:', historyRes.error.message)

  const byTask: Record<string, TaskComment[]> = {}
  for (const c of commentsRes.data ?? []) {
    const mapped = rowToComment(c as CommentRow)
    if (!byTask[mapped.taskId]) byTask[mapped.taskId] = []
    byTask[mapped.taskId].push(mapped)
  }

  const historyByTask: Record<string, TaskStatusEntry[]> = {}
  for (const h of historyRes.data ?? []) {
    const row = h as StatusHistoryRow
    if (!historyByTask[row.task_id]) historyByTask[row.task_id] = []
    historyByTask[row.task_id].push(rowToStatusEntry(row))
  }

  return tasks.map(t =>
    rowToTask(t as TaskRow, byTask[t.id] || [], historyByTask[t.id] || []),
  )
}

export async function createTask(t: NewTask): Promise<Task> {
  // productionId is optional since M2 — null means a freestanding to-do.
  if (!t.title) {
    throw new Error('Task title is required')
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
  comment: {
    text: string
    authorName?: string
    photoStoragePath?: string | null
    photoName?: string | null
  },
): Promise<TaskComment> {
  const { data, error } = await supabase
    .from('task_comments')
    .insert({
      task_id:            taskId,
      author_id:          asUuidOrNull(authorId),
      author_name:        comment.authorName || '',
      body:               comment.text,
      photo_storage_path: comment.photoStoragePath || null,
      photo_name:         comment.photoName || null,
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
