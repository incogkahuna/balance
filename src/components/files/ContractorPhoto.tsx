import type { ReactNode } from 'react'
import { StoredImage } from './StoredImage'
import { BUCKETS } from '../../lib/storage'

export interface ContractorPhotoProps {
  /**
   * Either a Supabase Storage path (new uploads) or a legacy data: / http(s) URL.
   * Empty string and null are treated as "no photo" — the fallback renders.
   */
  photoUrl: string | null | undefined
  alt: string
  className?: string
  /** Rendered when photoUrl is missing or fails to resolve. */
  fallback?: ReactNode
}

const isLegacyUrl = (value: string): boolean =>
  value.startsWith('data:') || value.startsWith('http://') || value.startsWith('https://')

/**
 * Renders a contractor headshot from either:
 *   - a Supabase Storage path (resolved via signed URL), or
 *   - a legacy data: / http(s) URL (from base64 dev sample data),
 * falling back to the provided fallback when nothing usable is set.
 *
 * Once all contractor photos live in storage we can drop the legacy branch.
 */
export function ContractorPhoto({ photoUrl, alt, className, fallback = null }: ContractorPhotoProps) {
  if (!photoUrl) return <>{fallback}</>
  if (isLegacyUrl(photoUrl)) {
    // eslint-disable-next-line jsx-a11y/alt-text
    return <img src={photoUrl} alt={alt} className={className} />
  }
  return (
    <StoredImage
      bucket={BUCKETS.contractorPhotos}
      path={photoUrl}
      alt={alt}
      className={className}
      fallback={fallback}
    />
  )
}
