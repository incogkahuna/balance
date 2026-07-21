import { useRef, useState, useEffect } from 'react'
import { ImagePlus, X, Loader2 } from 'lucide-react'
import { fileToBackdropDataUrl } from '../../context/BackgroundContext.jsx'
import { useToast } from '../../context/ToastContext.jsx'

// ─── ScreenshotAttach ────────────────────────────────────────────────────────
// Reusable screenshot picker for feedback: click to choose a file (camera on
// mobile via accept), OR paste an image from the clipboard while the report is
// focused. Compresses to a small JPEG data URL so it fits in the feedback
// row's text column. Shows a thumbnail with a remove button once attached.
//
// value: data URL string ('' = none). onChange(dataUrl | '').
// pasteScope: a ref to the element that should accept clipboard image pastes
// (usually the form/modal). Optional.
export function ScreenshotAttach({ value, onChange, pasteScope, compact = false, label = 'Attach screenshot', alt = 'Attached screenshot' }) {
  const toast = useToast()
  const inputRef = useRef(null)
  const [busy, setBusy] = useState(false)

  const ingest = async (file) => {
    if (!file) return
    setBusy(true)
    try {
      // Screenshots: smaller than backdrops (they live in a DB text column).
      const dataUrl = await fileToBackdropDataUrl(file, { max: 1400, quality: 0.7 })
      onChange(dataUrl)
    } catch (e) {
      toast.error(e?.message || "Couldn't read that image")
    } finally {
      setBusy(false)
    }
  }

  // Clipboard paste — the natural way to attach a screenshot you just grabbed.
  useEffect(() => {
    const el = pasteScope?.current
    if (!el) return
    const onPaste = (e) => {
      const item = [...(e.clipboardData?.items || [])].find(i => i.type.startsWith('image/'))
      if (!item) return
      const file = item.getAsFile()
      if (file) { e.preventDefault(); ingest(file) }
    }
    el.addEventListener('paste', onPaste)
    return () => el.removeEventListener('paste', onPaste)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pasteScope])

  if (value) {
    return (
      <div className="relative inline-block">
        <img
          src={value}
          alt={alt}
          className="rounded border border-orbital-border max-h-28 object-contain"
        />
        <button
          type="button"
          onClick={() => onChange('')}
          className="absolute -top-2 -right-2 w-5 h-5 flex items-center justify-center rounded-full bg-orbital-surface border border-orbital-border text-orbital-subtle hover:text-red-400"
          title="Remove screenshot"
          aria-label="Remove screenshot"
        >
          <X size={12} />
        </button>
      </div>
    )
  }

  return (
    <>
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={busy}
        className="inline-flex items-center gap-1.5 text-xs text-orbital-subtle hover:text-orbital-text transition-colors disabled:opacity-50"
      >
        {busy ? <Loader2 size={13} className="animate-spin" /> : <ImagePlus size={13} />}
        {busy ? 'Processing…' : (compact ? 'Screenshot' : label)}
        {!compact && <span className="text-orbital-dim">· or paste an image</span>}
      </button>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; ingest(f) }}
      />
    </>
  )
}
