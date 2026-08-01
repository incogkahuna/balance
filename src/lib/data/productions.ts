import { supabase } from '../supabase'

// ─── Types ─────────────────────────────────────────────────────────────────
// Mirror the postgres schema. Sub-objects stay loosely typed (Record/any) for
// now — they'll get tightened in 2c when those sub-objects move to their own
// tables. The shape matches what the existing localStorage code expects so
// components keep working with minimal changes.

export type ProductionStatus = 'Incoming' | 'Active' | 'Wrap' | 'Completed'
// Free-form since phase6b (the DB CHECK was dropped) — usually mirrors the
// picked LED wall's name. The old 'LED Volume' | 'Mobile Build' union was a lie.
export type ProductionType   = string
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

// production = client shoot; tour = travelling show; internal = studio project.
// Tours/internal skip production-only fields (type, location, LED wall).
export type ProjectKind = 'production' | 'tour' | 'internal'

export interface Production {
  id: string
  name: string
  client: string
  kind: ProjectKind
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
  // Quick notes captured during the production; compiled into the debrief.
  debriefNotes: Array<Record<string, unknown>>
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
  // Cheat-sheet facts that live nowhere else on the record (asset class,
  // content, day length, rented spaces). Editable straight on the card.
  sheet: { assetClass: string; content: string; hoursPerDay: number; spaces: string[] }
  // Card image / brand logo for visual differentiation on the card.
  cardImage: { bucket: string; path: string } | null
  // false = draft (only admin/sup can see), true = visible to all salary roster.
  // Drives visibility at the RLS layer; UI shows a DRAFT chip on unpublished
  // productions. New productions default to draft so admin can iron things
  // out before crew sees them ("like a social media post" model).
  published: boolean
  // Reference to an LED wall in the gear database. Nullable. Frontend
  // auto-syncs a matching wall assignment so picking a wall here actually
  // reserves it in /gear.
  ledWallId: string | null
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
  kind: ProjectKind | null
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
  debrief_notes: Array<Record<string, unknown>> | null
  feedback: Record<string, unknown> | null
  instruction_package: Production['instructionPackage']
  bible: Production['bible']
  roadmap: Production['roadmap']
  sheet: Production['sheet']
  card_image: Production['cardImage']
  published: boolean
  led_wall_id: string | null
  created_by: string | null
  created_at: string
  updated_at: string
}

function rowToProduction(r: ProductionRow): Production {
  return {
    id:                  r.id,
    name:                r.name,
    client:              r.client,
    // Pre-M4 rows/caches lack kind — they're all real productions.
    kind:                r.kind ?? 'production',
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
    debriefNotes:        r.debrief_notes ?? [],
    feedback:            r.feedback ?? null,
    instructionPackage:  r.instruction_package ?? { files: [], voiceMemos: [], notes: '' },
    bible:               r.bible ?? { keyPlayers: [], documents: [], concerns: [], frictionAndFlow: [] },
    roadmap:             r.roadmap ?? { milestones: [], logisticalConcerns: [] },
    // Rows created before the sheet column existed come back without it.
    sheet:               r.sheet ?? { assetClass: '', content: '', hoursPerDay: 10, spaces: [] },
    cardImage:           r.card_image ?? null,
    // Existing rows ship without `published` because the column was added
    // in a later migration with default true. Treat undefined as true so
    // old/cached rows render normally rather than appearing as drafts.
    published:           r.published ?? true,
    ledWallId:           r.led_wall_id ?? null,
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
  if (p.kind                !== undefined) row.kind                 = p.kind
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
  if (p.debriefNotes        !== undefined) row.debrief_notes        = p.debriefNotes
  if (p.feedback            !== undefined) row.feedback             = p.feedback
  if (p.instructionPackage  !== undefined) row.instruction_package  = p.instructionPackage
  if (p.bible               !== undefined) row.bible                = p.bible
  if (p.roadmap             !== undefined) row.roadmap              = p.roadmap
  if (p.sheet               !== undefined) row.sheet                = p.sheet
  if (p.cardImage           !== undefined) row.card_image           = p.cardImage
  if (p.published           !== undefined) row.published            = p.published
  if (p.ledWallId           !== undefined) row.led_wall_id          = p.ledWallId || null
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

// Columns added after the original schema (sheet 2026-07-25, card_image
// 2026-07-25). Until their ALTERs run on the live DB, a write carrying them
// errors. Rather than bricking every production create/update in that
// window, we retry once without the offending field — edits that were ONLY
// that field still surface the error so the missing SQL gets noticed.
const LATE_COLUMNS = ['sheet', 'card_image'] as const

// Postgres reports 42703 (undefined column); PostgREST reports PGRST204
// ("Could not find the 'x' column ... in the schema cache").
function missingLateColumn(
  error: { code?: string; message?: string } | null,
): string | null {
  if (!error) return null
  if (error.code !== '42703' && error.code !== 'PGRST204') return null
  return LATE_COLUMNS.find((c) => new RegExp(`\\b${c}\\b`).test(error.message || '')) || null
}

export async function createProduction(p: NewProduction): Promise<Production> {
  const row = productionToRow(p)
  if (!row.name) throw new Error('Production name is required')
  let { data, error } = await supabase
    .from('productions')
    .insert(row)
    .select('*')
    .single()
  // Strip late columns one at a time until the insert lands.
  for (let missing = missingLateColumn(error); missing; missing = missingLateColumn(error)) {
    console.warn(`[productions] ${missing} column missing — run the ALTER in RUN-THIS-SQL.md; inserting without it`)
    delete row[missing]
    ;({ data, error } = await supabase.from('productions').insert(row).select('*').single())
  }
  if (error) throw error
  return rowToProduction(data)
}

export async function updateProduction(
  id: string,
  patch: NewProduction,
): Promise<Production> {
  const row = productionToRow(patch)
  let { data, error } = await supabase
    .from('productions')
    .update(row)
    .eq('id', id)
    .select('*')
    .single()
  // Only sacrifice a late column on MIXED patches — a patch that was ONLY
  // that column would become an empty update; let it fail loudly instead.
  for (
    let missing = missingLateColumn(error);
    missing && Object.keys(row).length > 1;
    missing = missingLateColumn(error)
  ) {
    console.warn(`[productions] ${missing} column missing — run the ALTER in RUN-THIS-SQL.md; updating without it`)
    delete row[missing]
    ;({ data, error } = await supabase.from('productions').update(row).eq('id', id).select('*').single())
  }
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
