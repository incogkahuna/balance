import { supabase } from '../supabase'

// Thin read-only access to the profiles table (auth UUIDs → display info).
// RLS: any authenticated user may SELECT profiles, so this is safe for all
// roles. Used to resolve `changed_by` / `author_id` UUIDs to names in the UI.
// This is also groundwork for the identity-unification migration — once
// legacy string ids are gone, profiles becomes the roster source of truth.

export interface Profile {
  id: string
  email: string
  name: string
  role: 'admin' | 'supervisor' | 'crew'
  avatarUrl: string | null
  color: string | null
}

interface ProfileRow {
  id: string
  email: string
  name: string
  role: Profile['role']
  avatar_url: string | null
  color: string | null
}

export async function listProfiles(): Promise<Profile[]> {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, email, name, role, avatar_url, color')
  if (error) throw error
  return (data ?? []).map((r) => {
    const row = r as ProfileRow
    return {
      id: row.id,
      email: row.email,
      name: row.name,
      role: row.role,
      avatarUrl: row.avatar_url,
      color: row.color,
    }
  })
}
