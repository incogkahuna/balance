import { supabase } from '../supabase'

// ─── Types ─────────────────────────────────────────────────────────────────
export type FeedbackKind = 'bug' | 'idea' | 'note'
export type FeedbackStatus = 'New' | 'Acknowledged' | 'In Progress' | 'Shipped' | "Won't Fix"

export interface FeedbackItem {
  id: string
  kind: FeedbackKind
  title: string
  description: string
  context: string
  screenshot: string
  status: FeedbackStatus
  submittedBy: string | null
  submittedByName: string
  resolutionNote: string
  submittedAt: string
  updatedAt: string
}

export type NewFeedbackItem = Partial<Omit<FeedbackItem, 'submittedAt' | 'updatedAt'>>

// ─── Row mapper ────────────────────────────────────────────────────────────
interface FeedbackRow {
  id: string
  kind: FeedbackKind
  title: string
  description: string
  context: string | null
  screenshot: string | null
  status: FeedbackStatus
  submitted_by: string | null
  submitted_by_name: string
  resolution_note: string
  created_at: string
  updated_at: string
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const asUuidOrNull = (v: unknown): string | null =>
  typeof v === 'string' && UUID_RE.test(v) ? v : null

function rowToItem(r: FeedbackRow): FeedbackItem {
  return {
    id:              r.id,
    kind:            r.kind,
    title:           r.title,
    description:     r.description,
    context:         r.context ?? '',
    screenshot:      r.screenshot ?? '',
    status:          r.status,
    submittedBy:     r.submitted_by,
    submittedByName: r.submitted_by_name,
    resolutionNote:  r.resolution_note,
    submittedAt:     r.created_at,
    updatedAt:       r.updated_at,
  }
}

function itemToRow(i: NewFeedbackItem): Partial<FeedbackRow> {
  const row: Partial<FeedbackRow> = {}
  if (i.id              !== undefined) row.id                = i.id
  if (i.kind            !== undefined) row.kind              = i.kind
  if (i.title           !== undefined) row.title             = i.title
  if (i.description     !== undefined) row.description       = i.description
  if (i.status          !== undefined) row.status            = i.status
  if (i.submittedBy     !== undefined) row.submitted_by      = asUuidOrNull(i.submittedBy)
  if (i.submittedByName !== undefined) row.submitted_by_name = i.submittedByName
  if (i.resolutionNote  !== undefined) row.resolution_note   = i.resolutionNote
  // Only reference the newer columns when they carry data, so a plain report
  // still inserts on a DB where the context/screenshot columns migration
  // hasn't been run yet. Empty values are omitted rather than sent as ''.
  if (i.context)    row.context    = i.context
  if (i.screenshot) row.screenshot = i.screenshot
  return row
}

// ─── CRUD ──────────────────────────────────────────────────────────────────
export async function listFeedbackItems(): Promise<FeedbackItem[]> {
  const { data, error } = await supabase
    .from('feedback_items')
    .select('*')
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []).map(r => rowToItem(r as FeedbackRow))
}

export async function createFeedbackItemApi(i: NewFeedbackItem): Promise<FeedbackItem> {
  if (!i.title) throw new Error('Feedback title is required')
  const { data, error } = await supabase
    .from('feedback_items')
    .insert(itemToRow(i))
    .select('*')
    .single()
  if (error) throw error
  return rowToItem(data as FeedbackRow)
}

export async function updateFeedbackItemApi(id: string, patch: NewFeedbackItem): Promise<FeedbackItem> {
  const { data, error } = await supabase
    .from('feedback_items')
    .update(itemToRow(patch))
    .eq('id', id)
    .select('*')
    .single()
  if (error) throw error
  return rowToItem(data as FeedbackRow)
}

export async function deleteFeedbackItemApi(id: string): Promise<void> {
  const { error } = await supabase.from('feedback_items').delete().eq('id', id)
  if (error) throw error
}

// ─── Realtime ──────────────────────────────────────────────────────────────
export type FeedbackChangeEvent =
  | { type: 'INSERT'; row: FeedbackItem }
  | { type: 'UPDATE'; row: FeedbackItem }
  | { type: 'DELETE'; id: string }

export function subscribeToFeedbackItems(
  onChange: (event: FeedbackChangeEvent) => void,
): () => void {
  const channel = supabase
    .channel('feedback-items-changes')
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'feedback_items' },
      (payload) => {
        if (payload.eventType === 'INSERT') {
          onChange({ type: 'INSERT', row: rowToItem(payload.new as FeedbackRow) })
        } else if (payload.eventType === 'UPDATE') {
          onChange({ type: 'UPDATE', row: rowToItem(payload.new as FeedbackRow) })
        } else if (payload.eventType === 'DELETE') {
          const id = (payload.old as { id?: string })?.id
          if (id) onChange({ type: 'DELETE', id })
        }
      },
    )
    .subscribe()

  return () => { supabase.removeChannel(channel) }
}
