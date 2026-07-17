import { supabase } from '../supabase'

// ─── Types ─────────────────────────────────────────────────────────────────
export type ActivityVerb =
  | 'created'
  | 'updated'
  | 'deleted'
  | 'completed'
  | 'assigned'
  | 'status_changed'
  | 'commented'

export type ActivityEntityType =
  | 'task'
  | 'production'
  | 'contractor'
  | 'milestone'
  | 'concern'
  | 'feedback'

export interface ActivityEvent {
  id: string
  actorId: string | null
  actorName: string
  verb: ActivityVerb
  entityType: ActivityEntityType
  entityId: string
  entityLabel: string
  productionId: string | null
  meta: Record<string, unknown>
  createdAt: string
}

export interface NewActivityEvent {
  actorId: string
  actorName: string
  verb: ActivityVerb
  entityType: ActivityEntityType
  entityId?: string
  entityLabel?: string
  productionId?: string | null
  meta?: Record<string, unknown>
}

// ─── Row mapper ────────────────────────────────────────────────────────────
interface ActivityRow {
  id: string
  actor_id: string | null
  actor_name: string
  verb: ActivityVerb
  entity_type: ActivityEntityType
  entity_id: string
  entity_label: string
  production_id: string | null
  meta: Record<string, unknown>
  created_at: string
}

function rowToEvent(r: ActivityRow): ActivityEvent {
  return {
    id:           r.id,
    actorId:      r.actor_id,
    actorName:    r.actor_name,
    verb:         r.verb,
    entityType:   r.entity_type,
    entityId:     r.entity_id,
    entityLabel:  r.entity_label,
    productionId: r.production_id,
    meta:         r.meta ?? {},
    createdAt:    r.created_at,
  }
}

// ─── API ───────────────────────────────────────────────────────────────────

/**
 * Append one activity event. Fire-and-forget from the caller's perspective —
 * the AppContext helper swallows failures (e.g. the table not existing yet
 * before Danny runs the M1 migration) so activity logging can never break a
 * user action.
 */
export async function recordActivity(e: NewActivityEvent): Promise<void> {
  const { error } = await supabase.from('activity_events').insert({
    actor_id:      e.actorId,
    actor_name:    e.actorName,
    verb:          e.verb,
    entity_type:   e.entityType,
    entity_id:     e.entityId ?? '',
    entity_label:  e.entityLabel ?? '',
    production_id: e.productionId ?? null,
    meta:          e.meta ?? {},
  })
  if (error) throw error
}

/**
 * Fetch the most recent activity, newest first. `sinceDays` bounds the window
 * (Analytics defaults to 90); `limit` caps the payload.
 */
export async function listActivityEvents(
  opts: { sinceDays?: number; limit?: number } = {},
): Promise<ActivityEvent[]> {
  const { sinceDays = 90, limit = 2000 } = opts
  const since = new Date(Date.now() - sinceDays * 24 * 60 * 60 * 1000).toISOString()
  const { data, error } = await supabase
    .from('activity_events')
    .select('*')
    .gte('created_at', since)
    .order('created_at', { ascending: false })
    .limit(limit)
  if (error) throw error
  return (data ?? []).map(r => rowToEvent(r as ActivityRow))
}

export type ActivityChangeEvent = { type: 'INSERT'; row: ActivityEvent }

export function subscribeToActivity(
  onChange: (event: ActivityChangeEvent) => void,
): () => void {
  const channel = supabase
    .channel('activity-events-changes')
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'activity_events' },
      (payload) => {
        onChange({ type: 'INSERT', row: rowToEvent(payload.new as ActivityRow) })
      },
    )
    .subscribe()

  return () => { supabase.removeChannel(channel) }
}
