import { supabase } from '../supabase'

// ─── LED walls data layer ───────────────────────────────────────────────────
// Gear database rows. AppContext keeps walls in local state as the single
// mutation point (assignment sync touches many walls in one updater), so this
// layer exposes whole-row upsert/delete + list + realtime; the context diffs
// state against its last-synced snapshot and writes through here.

export interface WallAssignment {
  id: string
  productionId: string
  startDate: string
  endDate: string
  notes: string
  createdAt?: string
  createdBy?: string
}

export interface LedWall {
  id: string
  name: string
  description: string
  photo: string
  status: string
  notes: string
  assignments: WallAssignment[]
  createdAt: string
  updatedAt: string
}

interface WallRow {
  id: string
  name: string
  description: string
  photo: string
  status: string
  notes: string
  assignments: WallAssignment[]
  created_at: string
  updated_at: string
}

function rowToWall(r: WallRow): LedWall {
  return {
    id: r.id,
    name: r.name,
    description: r.description ?? '',
    photo: r.photo ?? '',
    status: r.status ?? 'In Service',
    notes: r.notes ?? '',
    assignments: r.assignments ?? [],
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  }
}

function wallToRow(w: Partial<LedWall>): Record<string, unknown> {
  const row: Record<string, unknown> = {}
  if (w.id          !== undefined) row.id          = w.id
  if (w.name        !== undefined) row.name        = w.name
  if (w.description !== undefined) row.description = w.description ?? ''
  if (w.photo       !== undefined) row.photo       = w.photo ?? ''
  if (w.status      !== undefined) row.status      = w.status
  if (w.notes       !== undefined) row.notes       = w.notes ?? ''
  if (w.assignments !== undefined) row.assignments = w.assignments ?? []
  return row
}

export async function listLedWalls(): Promise<LedWall[]> {
  const { data, error } = await supabase
    .from('led_walls')
    .select('*')
    .order('created_at', { ascending: true })
  if (error) throw error
  return (data ?? []).map(r => rowToWall(r as WallRow))
}

// Whole-row upsert — the write-through unit for the context's state diffing.
export async function upsertLedWall(w: Partial<LedWall>): Promise<LedWall> {
  if (!w.id) throw new Error('Wall id required')
  const { data, error } = await supabase
    .from('led_walls')
    .upsert(wallToRow(w), { onConflict: 'id' })
    .select('*')
    .single()
  if (error) throw error
  return rowToWall(data as WallRow)
}

export async function deleteLedWallApi(id: string): Promise<void> {
  const { error } = await supabase.from('led_walls').delete().eq('id', id)
  if (error) throw error
}

export type LedWallChangeEvent =
  | { type: 'INSERT'; row: LedWall }
  | { type: 'UPDATE'; row: LedWall }
  | { type: 'DELETE'; id: string }

export function subscribeToLedWalls(
  onChange: (event: LedWallChangeEvent) => void,
): () => void {
  const channel = supabase
    .channel('led-walls-changes')
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'led_walls' },
      (payload) => {
        if (payload.eventType === 'INSERT') {
          onChange({ type: 'INSERT', row: rowToWall(payload.new as WallRow) })
        } else if (payload.eventType === 'UPDATE') {
          onChange({ type: 'UPDATE', row: rowToWall(payload.new as WallRow) })
        } else if (payload.eventType === 'DELETE') {
          const id = (payload.old as { id?: string })?.id
          if (id) onChange({ type: 'DELETE', id })
        }
      },
    )
    .subscribe()

  return () => { supabase.removeChannel(channel) }
}
