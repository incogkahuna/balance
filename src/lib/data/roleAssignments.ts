import { supabase } from '../supabase'

// ─── Types ─────────────────────────────────────────────────────────────────
export type AssignmentRole = 'admin' | 'supervisor' | 'crew'

export interface RoleAssignment {
  email: string
  role: AssignmentRole
  displayName: string | null
  displayColor: string
  createdAt: string
}

export type NewRoleAssignment = {
  email: string
  role: AssignmentRole
  displayName?: string
  displayColor?: string
}

interface RoleAssignmentRow {
  email: string
  role: AssignmentRole
  display_name: string | null
  display_color: string
  created_at: string
}

function fromRow(r: RoleAssignmentRow): RoleAssignment {
  return {
    email: r.email,
    role: r.role,
    displayName: r.display_name,
    displayColor: r.display_color,
    createdAt: r.created_at,
  }
}

// ─── Reads ─────────────────────────────────────────────────────────────────
// Admin-only per RLS. Non-admins get an empty list (with the RLS error caught).
export async function listRoleAssignments(): Promise<RoleAssignment[]> {
  const { data, error } = await supabase
    .from('role_assignments')
    .select('*')
    .order('created_at', { ascending: true })
  if (error) {
    // Non-admins are denied by RLS — that's expected, not a hard failure.
    if (error.code === 'PGRST301' || error.message?.includes('permission')) {
      return []
    }
    throw error
  }
  return (data as RoleAssignmentRow[]).map(fromRow)
}

// ─── Writes ────────────────────────────────────────────────────────────────
// Inserts or updates a role_assignments row. Pre-authorizes someone to sign in
// with the given email — when they hit "Continue with Google" for the first
// time, the handle_new_user trigger creates their profile with this role.
export async function upsertRoleAssignment(input: NewRoleAssignment): Promise<RoleAssignment> {
  const row = {
    email: input.email.toLowerCase().trim(),
    role: input.role,
    display_name: input.displayName ?? null,
    display_color: input.displayColor ?? '#6b7280',
  }
  const { data, error } = await supabase
    .from('role_assignments')
    .upsert(row, { onConflict: 'email' })
    .select()
    .single()
  if (error) throw error
  return fromRow(data as RoleAssignmentRow)
}

export async function deleteRoleAssignment(email: string): Promise<void> {
  const { error } = await supabase
    .from('role_assignments')
    .delete()
    .eq('email', email.toLowerCase().trim())
  if (error) throw error
}
