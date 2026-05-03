import { useEffect, useState } from 'react'
import { signedUrl, type BucketName } from '../../lib/storage'

export interface StoredImageProps {
  bucket: BucketName
  /** Storage path within the bucket (e.g. "{productionId}/{photoId}.jpg"). */
  path: string | null | undefined
  alt: string
  className?: string
  /** Signed-URL TTL in seconds. Default: 1 hour. */
  expiresIn?: number
  /** Fallback shown while loading or if the path is missing. */
  fallback?: React.ReactNode
}

/**
 * Renders an <img> backed by a private Supabase Storage object. Resolves the
 * signed URL on mount and re-resolves if the path changes. Handles missing
 * paths gracefully with a fallback.
 */
export function StoredImage({
  bucket,
  path,
  alt,
  className,
  expiresIn = 3600,
  fallback = null,
}: StoredImageProps) {
  const [url, setUrl] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!path) {
      setUrl(null)
      return
    }
    let cancelled = false
    setError(null)
    signedUrl(bucket, path, expiresIn)
      .then((u) => {
        if (!cancelled) setUrl(u)
      })
      .catch((err) => {
        if (cancelled) return
        console.error('[StoredImage] signedUrl failed:', err)
        setError(err instanceof Error ? err.message : String(err))
      })
    return () => { cancelled = true }
  }, [bucket, path, expiresIn])

  if (!path || error) return <>{fallback}</>
  if (!url) return <>{fallback}</>
  // eslint-disable-next-line jsx-a11y/alt-text
  return <img src={url} alt={alt} className={className} />
}
