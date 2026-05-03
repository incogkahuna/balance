import { useRef, useState, type ReactNode } from 'react'
import { Upload } from 'lucide-react'
import { uploadFile, type BucketName, type UploadResult } from '../../lib/storage'

export interface FileUploadButtonProps {
  bucket: BucketName
  /** Function returning the storage path for a chosen file. Use the path
   *  builders in src/lib/storage.ts. */
  pathFor: (file: File) => string
  /** Called once each file finishes uploading. */
  onUploaded: (result: UploadResult) => void
  /** Standard <input> accept attribute, e.g. "image/*" or "application/pdf,image/*". */
  accept?: string
  /** Use the device camera on mobile when capturing image inputs. */
  capture?: 'user' | 'environment'
  multiple?: boolean
  disabled?: boolean
  children?: ReactNode
  className?: string
}

/**
 * Reusable file picker that uploads to a Supabase Storage bucket and calls
 * back with the persisted path. Handles progress state and surfaces errors
 * inline. Mobile-friendly via the `capture` prop.
 */
export function FileUploadButton({
  bucket,
  pathFor,
  onUploaded,
  accept,
  capture,
  multiple = false,
  disabled = false,
  children,
  className,
}: FileUploadButtonProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [progressLabel, setProgressLabel] = useState<string>('')

  const handleClick = () => {
    if (disabled || uploading) return
    inputRef.current?.click()
  }

  const handleChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    if (files.length === 0) return
    setError(null)
    setUploading(true)
    try {
      let i = 0
      for (const file of files) {
        i += 1
        setProgressLabel(`Uploading ${i}/${files.length}`)
        const path = pathFor(file)
        const result = await uploadFile(bucket, path, file, { contentType: file.type })
        onUploaded(result)
      }
      setProgressLabel('')
    } catch (err) {
      console.error('[FileUploadButton] upload failed:', err)
      setError(err instanceof Error ? err.message : 'Upload failed')
    } finally {
      setUploading(false)
      // Allow uploading the same filename twice.
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  return (
    <div className="inline-flex flex-col gap-1">
      <button
        type="button"
        onClick={handleClick}
        disabled={disabled || uploading}
        className={
          className ||
          'inline-flex items-center gap-2 px-3 py-1.5 rounded-md bg-orbital-surface border border-orbital-border text-sm text-orbital-text hover:border-blue-500/50 hover:bg-orbital-muted transition-all disabled:opacity-50 disabled:cursor-not-allowed'
        }
      >
        {uploading
          ? <span className="font-telemetry text-[9px] tracking-[0.2em] text-orbital-subtle">{progressLabel || 'UPLOADING'}</span>
          : (children ?? <><Upload size={12} /> Upload</>)
        }
      </button>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        capture={capture}
        multiple={multiple}
        onChange={handleChange}
        className="hidden"
      />
      {error && (
        <p className="text-xs text-red-400">{error}</p>
      )}
    </div>
  )
}
