import { supabase } from '../supabase'

// ─── Types ─────────────────────────────────────────────────────────────────
export type NotificationType = 'task_assigned' | string

export interface AppNotification {
  id: string
  recipientId: string
  type: NotificationType
  entityType: string | null
  entityId: string | null
  productionId: string | null
  title: string
  body: string
  readAt: string | null
  createdAt: string
}

interface NotificationRow {
  id: string
  recipient_id: string
  type: NotificationType
  entity_type: string | null
  entity_id: string | null
  production_id: string | null
  title: string
  body: string
  read_at: string | null
  created_at: string
}

function fromRow(r: NotificationRow): AppNotification {
  return {
    id: r.id,
    recipientId: r.recipient_id,
    type: r.type,
    entityType: r.entity_type,
    entityId: r.entity_id,
    productionId: r.production_id,
    title: r.title,
    body: r.body,
    readAt: r.read_at,
    createdAt: r.created_at,
  }
}

// ─── Reads ─────────────────────────────────────────────────────────────────
// Pulls the most recent notifications addressed to a given recipient id.
// Frontend caller passes currentUser.id (the resolved legacy/UUID identity).
export async function listNotificationsFor(recipientId: string, limit = 50): Promise<AppNotification[]> {
  if (!recipientId) return []
  const { data, error } = await supabase
    .from('notifications')
    .select('*')
    .eq('recipient_id', recipientId)
    .order('created_at', { ascending: false })
    .limit(limit)
  if (error) throw error
  return (data as NotificationRow[]).map(fromRow)
}

// ─── Writes ────────────────────────────────────────────────────────────────
export async function markNotificationRead(id: string): Promise<void> {
  const { error } = await supabase
    .from('notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('id', id)
  if (error) throw error
}

export async function markAllNotificationsReadFor(recipientId: string): Promise<void> {
  const { error } = await supabase
    .from('notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('recipient_id', recipientId)
    .is('read_at', null)
  if (error) throw error
}

// ─── Realtime ──────────────────────────────────────────────────────────────
// Subscribes to INSERTs and UPDATEs for a specific recipient. Returns an
// unsubscribe function.
export function subscribeToNotificationsFor(
  recipientId: string,
  handler: (event: { type: 'INSERT' | 'UPDATE' | 'DELETE'; row: AppNotification | { id: string } }) => void,
): () => void {
  if (!recipientId) return () => {}
  const channel = supabase
    .channel(`notifications:${recipientId}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'notifications', filter: `recipient_id=eq.${recipientId}` },
      (payload) => {
        if (payload.eventType === 'INSERT') {
          handler({ type: 'INSERT', row: fromRow(payload.new as NotificationRow) })
        } else if (payload.eventType === 'UPDATE') {
          handler({ type: 'UPDATE', row: fromRow(payload.new as NotificationRow) })
        } else if (payload.eventType === 'DELETE') {
          handler({ type: 'DELETE', row: { id: (payload.old as { id: string }).id } })
        }
      },
    )
    .subscribe()
  return () => { supabase.removeChannel(channel) }
}
