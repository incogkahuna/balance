import { supabase } from '../supabase'

// ─── Types ─────────────────────────────────────────────────────────────────
export type ComingSoonSource = 'manual' | 'slack'

export interface ComingSoonItem {
  id: string
  text: string
  source: ComingSoonSource
  addedBy: string | null
  slackUserName: string | null
  slackChannelName: string | null
  isDone: boolean
  createdAt: string
  updatedAt: string
}

export type NewComingSoonItem = {
  text: string
  source?: ComingSoonSource
  slackUserName?: string
  slackChannelName?: string
}

interface ComingSoonRow {
  id: string
  text: string
  source: ComingSoonSource
  added_by: string | null
  slack_user_name: string | null
  slack_channel_name: string | null
  is_done: boolean
  created_at: string
  updated_at: string
}

function fromRow(r: ComingSoonRow): ComingSoonItem {
  return {
    id: r.id,
    text: r.text,
    source: r.source,
    addedBy: r.added_by,
    slackUserName: r.slack_user_name,
    slackChannelName: r.slack_channel_name,
    isDone: r.is_done,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  }
}

// ─── Reads ─────────────────────────────────────────────────────────────────
export async function listComingSoon(): Promise<ComingSoonItem[]> {
  const { data, error } = await supabase
    .from('coming_soon_items')
    .select('*')
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data as ComingSoonRow[]).map(fromRow)
}

// ─── Writes ────────────────────────────────────────────────────────────────
export async function createComingSoon(input: NewComingSoonItem): Promise<ComingSoonItem> {
  const row = {
    text: input.text.trim(),
    source: input.source || 'manual',
    slack_user_name: input.slackUserName ?? null,
    slack_channel_name: input.slackChannelName ?? null,
  }
  const { data, error } = await supabase
    .from('coming_soon_items')
    .insert(row)
    .select()
    .single()
  if (error) throw error
  return fromRow(data as ComingSoonRow)
}

export async function setComingSoonDone(id: string, isDone: boolean): Promise<void> {
  const { error } = await supabase
    .from('coming_soon_items')
    .update({ is_done: isDone })
    .eq('id', id)
  if (error) throw error
}

export async function deleteComingSoon(id: string): Promise<void> {
  const { error } = await supabase
    .from('coming_soon_items')
    .delete()
    .eq('id', id)
  if (error) throw error
}

// ─── Realtime ──────────────────────────────────────────────────────────────
export function subscribeToComingSoon(handler: (event: { type: 'INSERT' | 'UPDATE' | 'DELETE'; row: ComingSoonItem | { id: string } }) => void) {
  const channel = supabase
    .channel('coming_soon_items_changes')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'coming_soon_items' }, (payload) => {
      if (payload.eventType === 'INSERT') {
        handler({ type: 'INSERT', row: fromRow(payload.new as ComingSoonRow) })
      } else if (payload.eventType === 'UPDATE') {
        handler({ type: 'UPDATE', row: fromRow(payload.new as ComingSoonRow) })
      } else if (payload.eventType === 'DELETE') {
        handler({ type: 'DELETE', row: { id: (payload.old as { id: string }).id } })
      }
    })
    .subscribe()
  return () => { supabase.removeChannel(channel) }
}
