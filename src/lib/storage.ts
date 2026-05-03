import { supabase } from './supabase'

// ─── Bucket names ──────────────────────────────────────────────────────────
// Strongly-typed list of every bucket the app uses. Pass these to upload /
// download helpers so typos surface at compile time.
export const BUCKETS = {
  instructionPackages:   'instruction-packages',
  taskCompletionPhotos:  'task-completion-photos',
  damagePhotos:          'damage-photos',
  contractorPhotos:      'contractor-photos',
  voiceMemos:            'voice-memos',
} as const

export type BucketName = (typeof BUCKETS)[keyof typeof BUCKETS]

// ─── Path builders ─────────────────────────────────────────────────────────
// Centralised so the path conventions are obvious and the upload component
// doesn't have to remember the layout. Each function returns a path that
// is unique within its bucket.

const safeName = (filename: string): string => {
  // Strip everything weird; keep extension for content-type sniffing.
  const ext = filename.includes('.') ? filename.split('.').pop() : ''
  const base = filename.replace(/\.[^.]*$/, '').replace(/[^a-zA-Z0-9_-]+/g, '-').slice(0, 60)
  const fileId = crypto.randomUUID()
  return ext ? `${fileId}-${base}.${ext}` : `${fileId}-${base}`
}

export const paths = {
  instructionPackage: (productionId: string, filename: string) =>
    `${productionId}/${safeName(filename)}`,

  taskCompletionPhoto: (taskId: string, filename: string) =>
    `${taskId}/${safeName(filename)}`,

  damagePhoto: (productionId: string, addonId: string, filename: string) =>
    `${productionId}/${addonId}/${safeName(filename)}`,

  contractorPhoto: (contractorId: string, filename: string) => {
    const ext = filename.includes('.') ? filename.split('.').pop() : ''
    return ext ? `${contractorId}.${ext}` : contractorId
  },

  voiceMemo: (productionId: string, filename: string) =>
    `${productionId}/${safeName(filename)}`,
}

// ─── Upload ────────────────────────────────────────────────────────────────
export interface UploadResult {
  bucket: BucketName
  path: string
  size: number
  mimeType: string
  name: string
}

/**
 * Upload a File or Blob to a Supabase Storage bucket. Returns the storage
 * path, which should be persisted on the related record (e.g. saved into
 * production.instruction_package.files[].storage_path).
 */
export async function uploadFile(
  bucket: BucketName,
  path: string,
  file: File | Blob,
  options: { contentType?: string; upsert?: boolean } = {},
): Promise<UploadResult> {
  const { error } = await supabase.storage
    .from(bucket)
    .upload(path, file, {
      contentType: options.contentType || (file instanceof File ? file.type : 'application/octet-stream'),
      upsert: options.upsert ?? false,
    })
  if (error) throw error

  return {
    bucket,
    path,
    size: file.size,
    mimeType: file instanceof File ? file.type : 'application/octet-stream',
    name: file instanceof File ? file.name : 'upload',
  }
}

// ─── Read URLs ─────────────────────────────────────────────────────────────
/**
 * Generate a signed URL for a private bucket object. Valid for `expiresIn`
 * seconds (default 1 hour). Use this for <img>, <a href>, or download links.
 */
export async function signedUrl(
  bucket: BucketName,
  path: string,
  expiresIn = 3600,
): Promise<string> {
  const { data, error } = await supabase.storage
    .from(bucket)
    .createSignedUrl(path, expiresIn)
  if (error) throw error
  return data.signedUrl
}

/**
 * Generate signed URLs for many objects in one round-trip.
 */
export async function signedUrls(
  bucket: BucketName,
  paths: string[],
  expiresIn = 3600,
): Promise<Record<string, string>> {
  if (paths.length === 0) return {}
  const { data, error } = await supabase.storage
    .from(bucket)
    .createSignedUrls(paths, expiresIn)
  if (error) throw error
  const map: Record<string, string> = {}
  for (const item of data ?? []) {
    if (item.path && item.signedUrl) map[item.path] = item.signedUrl
  }
  return map
}

// ─── Delete ────────────────────────────────────────────────────────────────
export async function deleteFile(bucket: BucketName, path: string): Promise<void> {
  const { error } = await supabase.storage.from(bucket).remove([path])
  if (error) throw error
}
