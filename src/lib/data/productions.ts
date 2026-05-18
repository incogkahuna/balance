import { supabase } from '../supabase'

// ─── Types ─────────────────────────────────────────────────────────────────
// Mirror the postgres schema. Sub-objects stay loosely typed (Record/any) for
// now — they'll get tightened in 2c when those sub-objects move to their own
// tables. The shape matches what the existing localStorage code expects so
// components keep working with minimal changes.

export type ProductionStatus = 'Incoming' | 'Active' | 'Wrap' | 'Completed'
export type ProductionType   = 'LED Volume' | 'Mobile Build' | 'Other'
export type LocationType     = 'In-House (Orbital Studios)' | 'Mobile'

export interface AssignedMember {
  userId: string
  roleOnProduction: string
}

export interface AssignedContractor {
  contractorId: string
  role: string
  assignedAt?: string
  assignedBy?: string
}

export interface Production {
  id: string
  name: string
  client: string
  locationType: LocationType
  locationAddress: string
  productionType: ProductionType
  status: ProductionStatus
  startDate: string | null
  endDate: string | null
  // Optional working-window list for projects that span weeks but only run
  // on certain days. Each entry: { start: 'YYYY-MM-DD', end: 'YYYY-MM-DD' }.
  // Empty array = single-window project; use startDate/endDate directly.
  dateRanges: Array<{ start: string; end: string }>
  stageManagerId: string | null
  assignedMembers: AssignedMember[]
  assignedContractors: AssignedContractor[]
  tasks: string[]
  addons: Array<Record<string, unknown>>
  feedback: Record<string, unknown> | null
  instructionPackage: {
    files: Array<Record<string, unknown>>
    voiceMemos: Array<Record<string, unknown>>
    notes: string
  }
  bible: {
    keyPlayers: Array<Record<string, unknown>>
    documents: Array<Record<string, unknown>>
    concerns: Array<Record<string, unknown>>
    frictionAndFlow: Array<Record<string, unknown>>
  }
  roadmap: {
    milestones: Array<Record<string, unknown>>
    logisticalConcerns: Array<Record<string, unknown>>
  }
  createdBy: string | null
  createdAt: string
  updatedAt: string
}

export type NewProduction = Partial<Omit<Production, 'createdAt' | 'updatedAt'>>

// ─── Snake-case ↔ camelCase mapping ───────────────────────────────────────
// Postgres uses snake_case columns; the rest of the app (and the legacy
// localStorage shape) uses camelCase. We translate at the boundary so the
// UI doesn't have to think about it.

interface ProductionRow {
  id: string
  name: string
  client: string
  location_type: LocationType
  location_address: string
  production_type: ProductionType
  status: ProductionStatus
  start_date: string | null
  end_date: string | null
  date_ranges: Array<{ start: string; end: string }>
  stage_manager_id: string | null
  assigned_members: AssignedMember[]
  assigned_contractors: AssignedContractor[]
  task_ids: string[]
  addons: Array<Record<string, unknown>>
  feedback: Record<string, unknown> | null
  instruction_package: Production['instructionPackage']
  bible: Production['bible']
  roadmap: Production['roadmap']
  created_by: string | null
  created_at: string
  updated_at: string
}

function rowToProduction(r: ProductionRow): Production {
  return {
    id:                  r.id,
    name:                r.name,
    client:              r.client,
    locationType:        r.location_type,
    locationAddress:     r.location_address,
    productionType:      r.production_type,
    status:              r.status,
    startDate:           r.start_date,
    endDate:             r.end_date,
    dateRanges:          r.date_ranges ?? [],
    stageManagerId:      r.stage_manager_id,
    assignedMembers:     r.assigned_members ?? [],
    assignedContractors: r.assigned_contractors ?? [],
    tasks:               r.task_ids ?? [],
    addons:              r.addons ?? [],
    feedback:            r.feedback ?? null,
    instructionPackage:  r.instruction_package ?? { files: [], voiceMemos: [], notes: '' },
    bible:               r.bible ?? { keyPlayers: [], documents: [], concerns: [], frictionAndFlow: [] },
    roadmap:             r.roadmap ?? { milestones: [], logisticalConcerns: [] },
    createdBy:           r.created_by,
    createdAt:           r.created_at,
    updatedAt:           r.updated_at,
  }
}

// Scrub non-UUID values to null so they don't blow up FK columns (e.g. when
// the dev profile switcher impersonates a legacy 'mark' user — the form fills
// createdBy with the legacy string id, which fails the UUID FK constraint).
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function asUuidOrNull(v: unknown): string | null {
  if (typeof v !== 'string' || !UUID_RE.test(v)) return null
  return v
}

function productionToRow(p: NewProduction): Partial<ProductionRow> {
  const row: Partial<ProductionRow> = {}
  // Pass through client-supplied id when present (e.g. factory-generated UUID
  // from the legacy createProduction() helper). Otherwise the DB default
  // gen_random_uuid() takes over.
  if (p.id                  !== undefined) row.id                   = p.id
  if (p.name                !== undefined) row.name                 = p.name
  if (p.client              !== undefined) row.client               = p.client
  if (p.locationType        !== undefined) row.location_type        = p.locationType
  if (p.locationAddress     !== undefined) row.location_address     = p.locationAddress
  if (p.productionType      !== undefined) row.production_type      = p.productionType
  if (p.status              !== undefined) row.status               = p.status
  if (p.startDate           !== undefined) row.start_date           = p.startDate || null
  if (p.endDate             !== undefined) row.end_date             = p.endDate   || null
  if (p.dateRanges          !== undefined) row.date_ranges          = p.dateRanges
  if (p.stageManagerId      !== undefined) row.stage_manager_id     = p.stageManagerId
  if (p.assignedMembers     !== undefined) row.assigned_members     = p.assignedMembers
  if (p.assignedContractors !== undefined) row.assigned_contractors = p.assignedContractors
  if (p.tasks               !== undefined) row.task_ids             = p.tasks
  if (p.addons              !== undefined) row.addons               = p.addons
  if (p.feedback            !== undefined) row.feedback             = p.feedback
  if (p.instructionPackage  !== undefined) row.instruction_package  = p.instructionPackage
  if (p.bible               !== undefined) row.bible                = p.bible
  if (p.roadmap             !== undefined) row.roadmap              = p.roadmap
  if (p.createdBy           !== undefined) row.created_by           = asUuidOrNull(p.createdBy)
  return row
}

// ─── CRUD ──────────────────────────────────────────────────────────────────

export async function listProductions(): Promise<Production[]> {
  const { data, error } = await supabase
    .from('productions')
    .select('*')
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []).map(rowToProduction)
}

export async function getProduction(id: string): Promise<Production | null> {
  const { data, error } = await supabase
    .from('productions')
    .select('*')
    .eq('id', id)
    .maybeSingle()
  if (error) throw error
  return data ? rowToProduction(data) : null
}

export async function createProduction(p: NewProduction): Promise<Production> {
  const row = productionToRow(p)
  if (!row.name) throw new Error('Production name is required')
  const { data, error } = await supabase
    .from('productions')
    .insert(row)
    .select('*')
    .single()
  if (error) throw error
  return rowToProduction(data)
}

export async function updateProduction(
  id: string,
  patch: NewProduction,
): Promise<Production> {
  const row = productionToRow(patch)
  const { data, error } = await supabase
    .from('productions')
    .update(row)
    .eq('id', id)
    .select('*')
    .single()
  if (error) throw error
  return rowToProduction(data)
}

export async function deleteProduction(id: string): Promise<void> {
  const { error } = await supabase.from('productions').delete().eq('id', id)
  if (error) throw error
}

// ─── Realtime subscription ─────────────────────────────────────────────────
// Subscribe to INSERT / UPDATE / DELETE events on the productions table.
// Returns an unsubscribe function.

export type ProductionsChangeEvent =
  | { type: 'INSERT'; row: Production }
  | { type: 'UPDATE'; row: Production }
  | { type: 'DELETE'; id: string }

export function subscribeToProductions(
  onChange: (event: ProductionsChangeEvent) => void,
): () => void {
  const channel = supabase
    .channel('productions-changes')
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'productions' },
      (payload) => {
        if (payload.eventType === 'INSERT') {
          onChange({ type: 'INSERT', row: rowToProduction(payload.new as ProductionRow) })
        } else if (payload.eventType === 'UPDATE') {
          onChange({ type: 'UPDATE', row: rowToProduction(payload.new as ProductionRow) })
        } else if (payload.eventType === 'DELETE') {
          const id = (payload.old as { id?: string })?.id
          if (id) onChange({ type: 'DELETE', id })
        }
      },
    )
    .subscribe()

  return () => {
    supabase.removeChannel(channel)
  }
}
