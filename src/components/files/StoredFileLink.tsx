import { useState } from 'react'
import { Download, FileText } from 'lucide-react'
import { signedUrl, type BucketName } from '../../lib/storage'

export interface StoredFileLinkProps {
  bucket: BucketName
  path: string
  label: string
  icon?: React.ReactNode
  className?: string
  expiresIn?: number
}

/**
 * Click-to-open link to a private Storage object. Resolves a fresh signed
 * URL on click rather than mount, so we don't hammer Supabase for every
 * file in a long list — only the ones the user actually opens.
 */
export function StoredFileLink({
  bucket,
  path,
  label,
  icon = <FileText size={12} />,
  className,
  expiresIn = 3600,
}: StoredFileLinkProps) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleOpen = async (e: React.MouseEvent) => {
    e.preventDefault()
    if (busy) return
    setBusy(true)
    setError(null)
    try {
      const url = await signedUrl(bucket, path, expiresIn)
      window.open(url, '_blank', 'noopener,noreferrer')
    } catch (err) {
      console.error('[StoredFileLink] failed to open:', err)
      setError(err instanceof Error ? err.message : 'Could not open file')
    } finally {
      setBusy(false)
    }
  }

  return (
    <span className="inline-flex flex-col gap-0.5">
      <a
        href="#"
        onClick={handleOpen}
        className={
          className ||
          'inline-flex items-center gap-1.5 text-xs text-orbital-text hover:text-blue-400 transition-colors'
        }
      >
        {icon}
        <span className="truncate">{label}</span>
        {busy ? null : <Download size={10} className="opacity-50" />}
      </a>
      {error && <span className="text-[10px] text-red-400">{error}</span>}
    </span>
  )
}
