import { supabase } from '../supabase'

// ─────────────────────────────────────────────────────────────────────────────
// Pipeline data layer — deals / money / quotes / handoffs / rate cards.
//
// DUAL-MODE, like feedbackItems (M5): 'remote' talks to Supabase (RLS is the
// real enforcement — money tables return zero rows to non-admin roles);
// 'local' runs on localStorage for dev-bypass sessions and pre-migration live,
// applying the SAME role scoping in code so the role UX is testable anywhere.
// PipelineContext picks the mode after probing the tables.
//
// The Mike Sill rule lives HERE, not in components: a production-role caller
// asking for quotes/money gets empty data from this module in both modes.
// ─────────────────────────────────────────────────────────────────────────────

export type PipelineRole = 'admin_finance' | 'admin_exec' | 'production' | 'pipeline'
export type Venue = 'tvc' | 'mobile'
export type IntakeMode = 'standard' | 'budget_first' | 'comparison_bid'
export type DealStatus = 'new' | 'quote_sent' | 'agreement' | 'green_light' | 'dead'
export type QuoteStatus = 'draft' | 'sent' | 'accepted' | 'superseded'

export interface DealDays { travel: number; build: number; shoot: number; strike: number }
export interface DealNote { id: string; text: string; at: string; by: string }

export interface Deal {
  id: string
  clientCompany: string
  clientContact: string
  clientEmail: string
  clientPhone: string
  projectName: string
  venue: Venue
  mobileLocation: string
  intakeMode: IntakeMode
  assetClass: string
  status: DealStatus
  lostReason: string
  startDate: string | null
  endDate: string | null
  days: DealDays
  notes: DealNote[]
  statusHistory: Array<{ status: DealStatus; at: string }>
  productionId: string | null
  createdBy: string | null
  createdAt: string
  updatedAt: string
}

export interface DealMoney {
  dealId: string
  quotedTotal: number | null
  agreedTotal: number | null
  actualTotal: number | null
  paid: boolean | null
}

export interface QuoteDiscount {
  mode: 'fixed' | 'percent'
  value: number
  label: string
  reason: string
  display: 'subtract' | 'value_add'
}

export interface Quote {
  id: string
  dealId: string
  title: string
  rateCardVersion: number
  venue: Venue
  days: DealDays
  lines: Record<string, { x: number; qty: number; rateOverride?: number | null; spec?: { value: string } | null; note?: string }>
  discount: QuoteDiscount | null
  status: QuoteStatus
  issuedAt: string
  sentAt: string | null
  createdAt: string
  updatedAt: string
}

export interface Handoff {
  id: string
  dealId: string
  productionId: string | null
  state: 'pending' | 'active'
  summary: string
  crew: Array<{ role: string; source: string }>
  techSpec: Record<string, unknown>
  schedule: Array<{ date: string; dayType: string; label: string }>
  gates: Record<string, boolean>
  handoff: Record<string, unknown>
  createdAt: string
  updatedAt: string
}

export interface RateCard {
  id: string
  version: number
  label: string
  data: Record<string, any>
  createdAt: string
}

export const PIPELINE_ADMIN_ROLES: PipelineRole[] = ['admin_finance', 'admin_exec']
export const isPipelineAdmin = (role: PipelineRole | null) =>
  role != null && PIPELINE_ADMIN_ROLES.includes(role)

// ─── Mode + local-role plumbing ─────────────────────────────────────────────
type Mode = 'remote' | 'local'
let mode: Mode = 'remote'
let localRole: PipelineRole | null = null

export function setPipelineMode(m: Mode) { mode = m }
export function getPipelineMode(): Mode { return mode }
// Local-mode scoping only — in remote mode RLS is the enforcement.
export function setLocalPipelineRole(role: PipelineRole | null) { localRole = role }

// ─── Local store ────────────────────────────────────────────────────────────
const LOCAL_KEY = 'balance_pipeline_v1'

interface LocalStore {
  deals: any[]
  money: Record<string, any>
  quotes: any[]
  handoffs: any[]
  rateCards: any[]
}

function readLocal(): LocalStore {
  try {
    const raw = window.localStorage.getItem(LOCAL_KEY)
    const parsed = raw ? JSON.parse(raw) : null
    if (parsed && typeof parsed === 'object') {
      return {
        deals: parsed.deals || [], money: parsed.money || {},
        quotes: parsed.quotes || [], handoffs: parsed.handoffs || [],
        rateCards: parsed.rateCards || [],
      }
    }
  } catch { /* fall through */ }
  return { deals: [], money: {}, quotes: [], handoffs: [], rateCards: [] }
}

function writeLocal(store: LocalStore) {
  try { window.localStorage.setItem(LOCAL_KEY, JSON.stringify(store)) } catch { /* quota */ }
}

const uuid = () =>
  (typeof crypto !== 'undefined' && crypto.randomUUID)
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`

const nowIso = () => new Date().toISOString()

// ─── Row mapping (snake ↔ camel at the boundary) ────────────────────────────
function rowToDeal(r: any): Deal {
  return {
    id: r.id,
    clientCompany: r.client_company,
    clientContact: r.client_contact ?? '',
    clientEmail: r.client_email ?? '',
    clientPhone: r.client_phone ?? '',
    projectName: r.project_name,
    venue: r.venue,
    mobileLocation: r.mobile_location ?? '',
    intakeMode: r.intake_mode ?? 'standard',
    assetClass: r.asset_class ?? '',
    status: r.status ?? 'new',
    lostReason: r.lost_reason ?? '',
    startDate: r.start_date ?? null,
    endDate: r.end_date ?? null,
    days: r.days ?? { travel: 0, build: 0, shoot: 0, strike: 0 },
    notes: r.notes ?? [],
    statusHistory: r.status_history ?? [],
    productionId: r.production_id ?? null,
    createdBy: r.created_by ?? null,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  }
}

function dealToRow(d: Partial<Deal>): Record<string, unknown> {
  const row: Record<string, unknown> = {}
  if (d.id !== undefined) row.id = d.id
  if (d.clientCompany !== undefined) row.client_company = d.clientCompany
  if (d.clientContact !== undefined) row.client_contact = d.clientContact
  if (d.clientEmail !== undefined) row.client_email = d.clientEmail
  if (d.clientPhone !== undefined) row.client_phone = d.clientPhone
  if (d.projectName !== undefined) row.project_name = d.projectName
  if (d.venue !== undefined) row.venue = d.venue
  if (d.mobileLocation !== undefined) row.mobile_location = d.mobileLocation
  if (d.intakeMode !== undefined) row.intake_mode = d.intakeMode
  if (d.assetClass !== undefined) row.asset_class = d.assetClass
  if (d.status !== undefined) row.status = d.status
  if (d.lostReason !== undefined) row.lost_reason = d.lostReason
  if (d.startDate !== undefined) row.start_date = d.startDate || null
  if (d.endDate !== undefined) row.end_date = d.endDate || null
  if (d.days !== undefined) row.days = d.days
  if (d.notes !== undefined) row.notes = d.notes
  if (d.statusHistory !== undefined) row.status_history = d.statusHistory
  if (d.productionId !== undefined) row.production_id = d.productionId
  if (d.createdBy !== undefined) row.created_by = d.createdBy
  return row
}

function rowToQuote(r: any): Quote {
  return {
    id: r.id, dealId: r.deal_id, title: r.title ?? 'Quote',
    rateCardVersion: r.rate_card_version, venue: r.venue,
    days: r.days ?? { travel: 0, build: 0, shoot: 0, strike: 0 },
    lines: r.lines ?? {}, discount: r.discount ?? null,
    status: r.status ?? 'draft', issuedAt: r.issued_at,
    sentAt: r.sent_at ?? null, createdAt: r.created_at, updatedAt: r.updated_at,
  }
}

function quoteToRow(q: Partial<Quote>): Record<string, unknown> {
  const row: Record<string, unknown> = {}
  if (q.id !== undefined) row.id = q.id
  if (q.dealId !== undefined) row.deal_id = q.dealId
  if (q.title !== undefined) row.title = q.title
  if (q.rateCardVersion !== undefined) row.rate_card_version = q.rateCardVersion
  if (q.venue !== undefined) row.venue = q.venue
  if (q.days !== undefined) row.days = q.days
  if (q.lines !== undefined) row.lines = q.lines
  if (q.discount !== undefined) row.discount = q.discount
  if (q.status !== undefined) row.status = q.status
  if (q.issuedAt !== undefined) row.issued_at = q.issuedAt
  if (q.sentAt !== undefined) row.sent_at = q.sentAt
  return row
}

function rowToHandoff(r: any): Handoff {
  return {
    id: r.id, dealId: r.deal_id, productionId: r.production_id ?? null,
    state: r.state ?? 'pending', summary: r.summary ?? '',
    crew: r.crew ?? [], techSpec: r.tech_spec ?? {}, schedule: r.schedule ?? [],
    gates: r.gates ?? {}, handoff: r.handoff ?? {},
    createdAt: r.created_at, updatedAt: r.updated_at,
  }
}

function handoffToRow(h: Partial<Handoff>): Record<string, unknown> {
  const row: Record<string, unknown> = {}
  if (h.id !== undefined) row.id = h.id
  if (h.dealId !== undefined) row.deal_id = h.dealId
  if (h.productionId !== undefined) row.production_id = h.productionId
  if (h.state !== undefined) row.state = h.state
  if (h.summary !== undefined) row.summary = h.summary
  if (h.crew !== undefined) row.crew = h.crew
  if (h.techSpec !== undefined) row.tech_spec = h.techSpec
  if (h.schedule !== undefined) row.schedule = h.schedule
  if (h.gates !== undefined) row.gates = h.gates
  if (h.handoff !== undefined) row.handoff = h.handoff
  return row
}

function rowToMoney(r: any): DealMoney {
  return {
    dealId: r.deal_id, quotedTotal: r.quoted_total != null ? Number(r.quoted_total) : null,
    agreedTotal: r.agreed_total != null ? Number(r.agreed_total) : null,
    actualTotal: r.actual_total != null ? Number(r.actual_total) : null,
    paid: r.paid ?? null,
  }
}

// ─── Probe — is the remote pipeline usable? ─────────────────────────────────
// Called once by PipelineContext when a session exists. Missing table (42P01)
// or RLS refusal → fall back to local.
export async function probeRemotePipeline(): Promise<boolean> {
  try {
    const { error } = await supabase.from('pipeline_deals').select('id').limit(1)
    return !error
  } catch { return false }
}

// ─── Deals ──────────────────────────────────────────────────────────────────
export async function listDeals(): Promise<Deal[]> {
  if (mode === 'local') {
    if (!localRole) return []
    return readLocal().deals.slice().sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''))
  }
  const { data, error } = await supabase
    .from('pipeline_deals').select('*').order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []).map(rowToDeal)
}

export async function createDeal(d: Partial<Deal>): Promise<Deal> {
  if (mode === 'local') {
    if (!isPipelineAdmin(localRole)) throw new Error('Only admin roles can create deals')
    const store = readLocal()
    const deal: Deal = {
      id: d.id || uuid(),
      clientCompany: d.clientCompany || '', clientContact: d.clientContact || '',
      clientEmail: d.clientEmail || '', clientPhone: d.clientPhone || '',
      projectName: d.projectName || '', venue: (d.venue as Venue) || 'tvc',
      mobileLocation: d.mobileLocation || '',
      intakeMode: (d.intakeMode as IntakeMode) || 'standard',
      assetClass: d.assetClass || '', status: d.status || 'new',
      lostReason: d.lostReason || '',
      startDate: d.startDate || null, endDate: d.endDate || null,
      days: d.days || { travel: 0, build: 0, shoot: 0, strike: 0 },
      notes: d.notes || [],
      statusHistory: d.statusHistory || [{ status: 'new', at: nowIso() }],
      productionId: null, createdBy: d.createdBy || null,
      createdAt: nowIso(), updatedAt: nowIso(),
    }
    store.deals.unshift(deal)
    writeLocal(store)
    return deal
  }
  const { data, error } = await supabase
    .from('pipeline_deals').insert(dealToRow(d)).select('*').single()
  if (error) throw error
  return rowToDeal(data)
}

export async function updateDeal(id: string, patch: Partial<Deal>): Promise<Deal> {
  if (mode === 'local') {
    const store = readLocal()
    const i = store.deals.findIndex((x) => x.id === id)
    if (i < 0) throw new Error('Deal not found')
    store.deals[i] = { ...store.deals[i], ...patch, updatedAt: nowIso() }
    writeLocal(store)
    return store.deals[i]
  }
  const { data, error } = await supabase
    .from('pipeline_deals').update(dealToRow(patch)).eq('id', id).select('*').single()
  if (error) throw error
  return rowToDeal(data)
}

export async function deleteDeal(id: string): Promise<void> {
  if (mode === 'local') {
    const store = readLocal()
    store.deals = store.deals.filter((x) => x.id !== id)
    store.quotes = store.quotes.filter((q) => q.dealId !== id)
    store.handoffs = store.handoffs.filter((h) => h.dealId !== id)
    delete store.money[id]
    writeLocal(store)
    return
  }
  const { error } = await supabase.from('pipeline_deals').delete().eq('id', id)
  if (error) throw error
}

// ─── Deal money (admin-only in both modes) ──────────────────────────────────
export async function listDealMoney(): Promise<Record<string, DealMoney>> {
  if (mode === 'local') {
    if (!isPipelineAdmin(localRole)) return {}
    return { ...readLocal().money }
  }
  const { data, error } = await supabase.from('pipeline_deal_money').select('*')
  // RLS returns zero rows (not an error) for non-admin roles — exactly right.
  if (error) {
    // Non-admin roles may see a hard refusal depending on policy shape — treat
    // as "no visibility", matching the contractors PGRST301 precedent.
    return {}
  }
  const out: Record<string, DealMoney> = {}
  for (const r of data ?? []) out[r.deal_id] = rowToMoney(r)
  return out
}

export async function upsertDealMoney(dealId: string, patch: Partial<DealMoney>): Promise<DealMoney> {
  if (mode === 'local') {
    if (!isPipelineAdmin(localRole)) throw new Error('Money is admin-only')
    const store = readLocal()
    const prev = store.money[dealId] || { dealId, quotedTotal: null, agreedTotal: null, actualTotal: null, paid: null }
    store.money[dealId] = { ...prev, ...patch, dealId }
    writeLocal(store)
    return store.money[dealId]
  }
  const row: Record<string, unknown> = { deal_id: dealId }
  if (patch.quotedTotal !== undefined) row.quoted_total = patch.quotedTotal
  if (patch.agreedTotal !== undefined) row.agreed_total = patch.agreedTotal
  if (patch.actualTotal !== undefined) row.actual_total = patch.actualTotal
  if (patch.paid !== undefined) row.paid = patch.paid
  const { data, error } = await supabase
    .from('pipeline_deal_money').upsert(row, { onConflict: 'deal_id' }).select('*').single()
  if (error) throw error
  return rowToMoney(data)
}

// ─── Quotes (admin-only in both modes) ──────────────────────────────────────
export async function listQuotes(): Promise<Quote[]> {
  if (mode === 'local') {
    if (!isPipelineAdmin(localRole)) return []
    return readLocal().quotes.slice()
  }
  const { data, error } = await supabase
    .from('pipeline_quotes').select('*').order('created_at', { ascending: true })
  if (error) return []
  return (data ?? []).map(rowToQuote)
}

export async function createQuote(q: Partial<Quote>): Promise<Quote> {
  if (mode === 'local') {
    if (!isPipelineAdmin(localRole)) throw new Error('Quotes are admin-only')
    const store = readLocal()
    const quote: Quote = {
      id: q.id || uuid(), dealId: q.dealId!, title: q.title || 'Quote',
      rateCardVersion: q.rateCardVersion || 1, venue: (q.venue as Venue) || 'tvc',
      days: q.days || { travel: 0, build: 0, shoot: 0, strike: 0 },
      lines: q.lines || {}, discount: q.discount ?? null,
      status: q.status || 'draft',
      issuedAt: q.issuedAt || nowIso().slice(0, 10), sentAt: q.sentAt ?? null,
      createdAt: nowIso(), updatedAt: nowIso(),
    }
    store.quotes.push(quote)
    writeLocal(store)
    return quote
  }
  const { data, error } = await supabase
    .from('pipeline_quotes').insert(quoteToRow(q)).select('*').single()
  if (error) throw error
  return rowToQuote(data)
}

export async function updateQuote(id: string, patch: Partial<Quote>): Promise<Quote> {
  if (mode === 'local') {
    const store = readLocal()
    const i = store.quotes.findIndex((x) => x.id === id)
    if (i < 0) throw new Error('Quote not found')
    store.quotes[i] = { ...store.quotes[i], ...patch, updatedAt: nowIso() }
    writeLocal(store)
    return store.quotes[i]
  }
  const { data, error } = await supabase
    .from('pipeline_quotes').update(quoteToRow(patch)).eq('id', id).select('*').single()
  if (error) throw error
  return rowToQuote(data)
}

export async function deleteQuote(id: string): Promise<void> {
  if (mode === 'local') {
    const store = readLocal()
    store.quotes = store.quotes.filter((x) => x.id !== id)
    writeLocal(store)
    return
  }
  const { error } = await supabase.from('pipeline_quotes').delete().eq('id', id)
  if (error) throw error
}

// ─── Handoffs ───────────────────────────────────────────────────────────────
export async function listHandoffs(): Promise<Handoff[]> {
  if (mode === 'local') {
    if (!localRole) return []
    return readLocal().handoffs.slice()
  }
  const { data, error } = await supabase.from('pipeline_handoffs').select('*')
  if (error) throw error
  return (data ?? []).map(rowToHandoff)
}

export async function createHandoff(h: Partial<Handoff>): Promise<Handoff> {
  if (mode === 'local') {
    const store = readLocal()
    const handoff: Handoff = {
      id: h.id || uuid(), dealId: h.dealId!, productionId: h.productionId ?? null,
      state: h.state || 'pending', summary: h.summary || '',
      crew: h.crew || [], techSpec: h.techSpec || {}, schedule: h.schedule || [],
      gates: h.gates || {
        deposit: false, coi: false, agreementSent: false,
        firstInvoiceSent: false, w9Sent: false, rentalDueBeforePrelight: false,
      },
      handoff: h.handoff || { creativeDeck: null, markIntro: false, kickoffCall: false, creativeReceived: false },
      createdAt: nowIso(), updatedAt: nowIso(),
    }
    store.handoffs.push(handoff)
    writeLocal(store)
    return handoff
  }
  const { data, error } = await supabase
    .from('pipeline_handoffs').insert(handoffToRow(h)).select('*').single()
  if (error) throw error
  return rowToHandoff(data)
}

export async function updateHandoff(id: string, patch: Partial<Handoff>): Promise<Handoff> {
  if (mode === 'local') {
    const store = readLocal()
    const i = store.handoffs.findIndex((x) => x.id === id)
    if (i < 0) throw new Error('Handoff not found')
    store.handoffs[i] = { ...store.handoffs[i], ...patch, updatedAt: nowIso() }
    writeLocal(store)
    return store.handoffs[i]
  }
  const { data, error } = await supabase
    .from('pipeline_handoffs').update(handoffToRow(patch)).eq('id', id).select('*').single()
  if (error) throw error
  return rowToHandoff(data)
}

// ─── Rate cards (admin-only; versioned) ─────────────────────────────────────
export async function listRateCards(): Promise<RateCard[]> {
  if (mode === 'local') {
    if (!isPipelineAdmin(localRole)) return []
    return readLocal().rateCards.slice().sort((a, b) => a.version - b.version)
  }
  const { data, error } = await supabase
    .from('pipeline_rate_cards').select('*').order('version', { ascending: true })
  if (error) return []
  return (data ?? []).map((r: any) => ({
    id: r.id, version: r.version, label: r.label, data: r.data, createdAt: r.created_at,
  }))
}

export async function createRateCardVersion(
  data: Record<string, any>, label: string, createdBy: string | null,
): Promise<RateCard> {
  if (mode === 'local') {
    if (!isPipelineAdmin(localRole)) throw new Error('Rate card is admin-only')
    const store = readLocal()
    const version = store.rateCards.reduce((m, c) => Math.max(m, c.version), 0) + 1
    const card: RateCard = {
      id: uuid(), version, label, data: { ...data, version, label }, createdAt: nowIso(),
    }
    store.rateCards.push(card)
    writeLocal(store)
    return card
  }
  const { data: existing } = await supabase
    .from('pipeline_rate_cards').select('version').order('version', { ascending: false }).limit(1)
  const version = ((existing && existing[0]?.version) || 0) + 1
  const { data: row, error } = await supabase
    .from('pipeline_rate_cards')
    .insert({ version, label, data: { ...data, version, label }, created_by: createdBy })
    .select('*').single()
  if (error) throw error
  return { id: row.id, version: row.version, label: row.label, data: row.data, createdAt: row.created_at }
}

// ─── Analytics aggregates (Wilder's money-derived layer) ────────────────────
export async function fetchMoneyAggregates(): Promise<{ deltaBuckets: any[]; discounts: any[] } | null> {
  if (mode === 'local') return null // computed client-side from scoped data
  try {
    const { data, error } = await supabase.rpc('pipeline_money_aggregates')
    if (error) return null
    return data
  } catch { return null }
}

// ─── Realtime ───────────────────────────────────────────────────────────────
export type PipelineChangeEvent =
  | { table: 'deals'; type: 'INSERT' | 'UPDATE'; row: Deal }
  | { table: 'deals'; type: 'DELETE'; id: string }
  | { table: 'quotes'; type: 'INSERT' | 'UPDATE'; row: Quote }
  | { table: 'quotes'; type: 'DELETE'; id: string }
  | { table: 'handoffs'; type: 'INSERT' | 'UPDATE'; row: Handoff }
  | { table: 'handoffs'; type: 'DELETE'; id: string }
  | { table: 'money'; type: 'INSERT' | 'UPDATE'; row: DealMoney }
  | { table: 'money'; type: 'DELETE'; id: string }

export function subscribeToPipeline(onChange: (e: PipelineChangeEvent) => void): () => void {
  if (mode === 'local') return () => {}
  const wire = (
    table: string, key: PipelineChangeEvent['table'], map: (r: any) => any, idCol = 'id',
  ) => (payload: any) => {
    if (payload.eventType === 'INSERT') onChange({ table: key, type: 'INSERT', row: map(payload.new) } as PipelineChangeEvent)
    else if (payload.eventType === 'UPDATE') onChange({ table: key, type: 'UPDATE', row: map(payload.new) } as PipelineChangeEvent)
    else if (payload.eventType === 'DELETE') {
      const id = payload.old?.[idCol]
      if (id) onChange({ table: key, type: 'DELETE', id } as PipelineChangeEvent)
    }
  }
  const channel = supabase
    .channel('pipeline-changes')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'pipeline_deals' }, wire('pipeline_deals', 'deals', rowToDeal))
    .on('postgres_changes', { event: '*', schema: 'public', table: 'pipeline_quotes' }, wire('pipeline_quotes', 'quotes', rowToQuote))
    .on('postgres_changes', { event: '*', schema: 'public', table: 'pipeline_handoffs' }, wire('pipeline_handoffs', 'handoffs', rowToHandoff))
    .on('postgres_changes', { event: '*', schema: 'public', table: 'pipeline_deal_money' }, wire('pipeline_deal_money', 'money', rowToMoney, 'deal_id'))
    .subscribe()
  return () => { supabase.removeChannel(channel) }
}
