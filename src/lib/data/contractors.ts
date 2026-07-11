import { supabase } from '../supabase'

// ─── Types ─────────────────────────────────────────────────────────────────
export type ContractorAvailability = 'Available' | 'Booked' | 'Tentative' | 'Unavailable'
export type ContractorExperience   = 'Junior' | 'Mid' | 'Senior' | 'Lead'
export type ContractorFlag         = 'Recommended' | 'Neutral' | 'Do Not Rehire'

export interface ContractorEmergencyContact {
  name: string
  relationship: string
  phone: string
}

export interface Contractor {
  id: string
  name: string
  primaryRole: string
  secondaryRoles: string[]
  skills: string[]
  phone: string
  email: string
  location: string
  availability: ContractorAvailability
  experienceLevel: ContractorExperience
  specialties: string[]
  photoUrl: string
  companyName: string
  companyRole: string
  // Client-side name is dayRate; persists to the pre-existing rate_per_day
  // column. ratePerDay is kept as an alias for older call sites.
  dayRate: string
  ratePerDay: string
  weeklyRate: string
  rateNotes: string
  emergencyContact: ContractorEmergencyContact | null
  flag: ContractorFlag
  notes: string
  createdAt: string
  updatedAt: string
}

export type NewContractor = Partial<Omit<Contractor, 'createdAt' | 'updatedAt'>>

// ─── Row mapper ────────────────────────────────────────────────────────────
interface ContractorRow {
  id: string
  name: string
  primary_role: string
  secondary_roles: string[]
  skills: string[]
  phone: string
  email: string
  location: string
  availability: ContractorAvailability
  experience_level: ContractorExperience
  specialties: string[]
  photo_url: string
  company_name: string
  company_role: string
  rate_per_day: string
  weekly_rate: string
  rate_notes: string
  emergency_contact: ContractorEmergencyContact | null
  flag: ContractorFlag
  notes: string
  created_at: string
  updated_at: string
}

function rowToContractor(r: ContractorRow): Contractor {
  return {
    id:               r.id,
    name:             r.name,
    primaryRole:      r.primary_role,
    secondaryRoles:   r.secondary_roles ?? [],
    skills:           r.skills ?? [],
    phone:            r.phone,
    email:            r.email,
    location:         r.location ?? '',
    availability:     r.availability,
    experienceLevel:  r.experience_level,
    specialties:      r.specialties ?? [],
    photoUrl:         r.photo_url,
    companyName:      r.company_name,
    companyRole:      r.company_role,
    dayRate:          r.rate_per_day ?? '',
    ratePerDay:       r.rate_per_day ?? '',
    weeklyRate:       r.weekly_rate ?? '',
    rateNotes:        r.rate_notes ?? '',
    emergencyContact: r.emergency_contact ?? null,
    flag:             r.flag,
    notes:            r.notes,
    createdAt:        r.created_at,
    updatedAt:        r.updated_at,
  }
}

function contractorToRow(c: NewContractor): Partial<ContractorRow> {
  const row: Partial<ContractorRow> = {}
  if (c.id               !== undefined) row.id                = c.id
  if (c.name             !== undefined) row.name              = c.name
  if (c.primaryRole      !== undefined) row.primary_role      = c.primaryRole
  if (c.secondaryRoles   !== undefined) row.secondary_roles   = c.secondaryRoles
  if (c.skills           !== undefined) row.skills            = c.skills
  if (c.phone            !== undefined) row.phone             = c.phone
  if (c.email            !== undefined) row.email             = c.email
  if (c.location         !== undefined) row.location          = c.location
  if (c.availability     !== undefined) row.availability      = c.availability
  if (c.experienceLevel  !== undefined) row.experience_level  = c.experienceLevel
  if (c.specialties      !== undefined) row.specialties       = c.specialties
  if (c.photoUrl         !== undefined) row.photo_url         = c.photoUrl
  if (c.companyName      !== undefined) row.company_name      = c.companyName
  if (c.companyRole      !== undefined) row.company_role      = c.companyRole
  // dayRate (form field) wins over the legacy ratePerDay alias when both set.
  if (c.ratePerDay       !== undefined) row.rate_per_day      = c.ratePerDay
  if (c.dayRate          !== undefined) row.rate_per_day      = c.dayRate
  if (c.weeklyRate       !== undefined) row.weekly_rate       = c.weeklyRate
  if (c.rateNotes        !== undefined) row.rate_notes        = c.rateNotes
  if (c.emergencyContact !== undefined) row.emergency_contact = c.emergencyContact
  if (c.flag             !== undefined) row.flag              = c.flag
  if (c.notes            !== undefined) row.notes             = c.notes
  return row
}

// ─── CRUD ──────────────────────────────────────────────────────────────────

export async function listContractors(): Promise<Contractor[]> {
  const { data, error } = await supabase
    .from('contractors')
    .select('*')
    .order('name', { ascending: true })
  if (error) throw error
  return (data ?? []).map(r => rowToContractor(r as ContractorRow))
}

export async function createContractor(c: NewContractor): Promise<Contractor> {
  if (!c.name) throw new Error('Contractor name is required')
  const { data, error } = await supabase
    .from('contractors')
    .insert(contractorToRow(c))
    .select('*')
    .single()
  if (error) throw error
  return rowToContractor(data as ContractorRow)
}

export async function updateContractor(id: string, patch: NewContractor): Promise<Contractor> {
  const { data, error } = await supabase
    .from('contractors')
    .update(contractorToRow(patch))
    .eq('id', id)
    .select('*')
    .single()
  if (error) throw error
  return rowToContractor(data as ContractorRow)
}

export async function deleteContractor(id: string): Promise<void> {
  const { error } = await supabase.from('contractors').delete().eq('id', id)
  if (error) throw error
}

// ─── Realtime ──────────────────────────────────────────────────────────────

export type ContractorChangeEvent =
  | { type: 'INSERT'; row: Contractor }
  | { type: 'UPDATE'; row: Contractor }
  | { type: 'DELETE'; id: string }

export function subscribeToContractors(
  onChange: (event: ContractorChangeEvent) => void,
): () => void {
  const channel = supabase
    .channel('contractors-changes')
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'contractors' },
      (payload) => {
        if (payload.eventType === 'INSERT') {
          onChange({ type: 'INSERT', row: rowToContractor(payload.new as ContractorRow) })
        } else if (payload.eventType === 'UPDATE') {
          onChange({ type: 'UPDATE', row: rowToContractor(payload.new as ContractorRow) })
        } else if (payload.eventType === 'DELETE') {
          const id = (payload.old as { id?: string })?.id
          if (id) onChange({ type: 'DELETE', id })
        }
      },
    )
    .subscribe()

  return () => { supabase.removeChannel(channel) }
}
