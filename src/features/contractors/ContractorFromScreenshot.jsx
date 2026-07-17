import { useState, useRef, useCallback } from 'react'
import { Upload, Loader, UserPlus, RotateCcw } from 'lucide-react'
import { parseIntakeInputs, ParseIntakeError } from '../../lib/parseIntake.ts'

// ─── Add-from-screenshot (M3 / #11) ──────────────────────────────────────────
// Drop / paste / pick an image of a call sheet, email signature, or business
// card; the deployed `parse-intake` function (Claude vision) pulls out the
// contacts; picking one prefills the normal ContractorForm. Reuses the intake
// parser as-is — contacts[] already carries name/email/phone/company/role.

export function ContractorFromScreenshot({ onUse }) {
  const [preview, setPreview]     = useState(null)
  const [fileName, setFileName]   = useState('')
  const [extracting, setExtracting] = useState(false)
  const [contacts, setContacts]   = useState(null)  // null = not run yet
  const [error, setError]         = useState(null)
  const fileRef = useRef(null)

  const acceptFile = useCallback((file) => {
    if (!file || !file.type.startsWith('image/')) return
    const reader = new FileReader()
    reader.onload = () => {
      setPreview(reader.result)
      setFileName(file.name || 'screenshot')
      setContacts(null)
      setError(null)
    }
    reader.readAsDataURL(file)
  }, [])

  const handlePaste = (e) => {
    const item = [...(e.clipboardData?.items || [])].find(i => i.type.startsWith('image/'))
    if (item) acceptFile(item.getAsFile())
  }

  const handleDrop = (e) => {
    e.preventDefault()
    acceptFile(e.dataTransfer?.files?.[0])
  }

  const extract = async () => {
    if (!preview) return
    setExtracting(true)
    setError(null)
    try {
      const res = await parseIntakeInputs([
        { id: 'contractor-shot', type: 'image', preview, fileName },
      ])
      setContacts(res.contacts || [])
    } catch (err) {
      setError(err instanceof ParseIntakeError && err.status === 401
        ? 'Sign-in expired — refresh and try again.'
        : (err?.message || 'Extraction failed'))
    } finally {
      setExtracting(false)
    }
  }

  const useContact = (c) => {
    onUse({
      name:        c.name || '',
      email:       c.email || '',
      phone:       c.phone || '',
      primaryRole: c.role || '',
      notes:       c.company ? `Company: ${c.company}` : '',
    })
  }

  return (
    <div className="space-y-4" onPaste={handlePaste}>
      {/* Drop zone / preview */}
      <div
        onDragOver={e => e.preventDefault()}
        onDrop={handleDrop}
        onClick={() => fileRef.current?.click()}
        className="border-2 border-dashed border-orbital-border hover:border-blue-500/40 transition-colors cursor-pointer p-4 text-center"
      >
        {preview ? (
          <img src={preview} alt={fileName} className="max-h-56 mx-auto" />
        ) : (
          <div className="py-8 text-orbital-subtle text-sm">
            <Upload size={20} className="mx-auto mb-2" />
            Drop a call sheet / email signature / business card here,
            <br />paste a screenshot (Ctrl+V), or click to pick a file.
          </div>
        )}
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={e => { acceptFile(e.target.files?.[0]); e.target.value = '' }}
        />
      </div>

      {preview && contacts === null && (
        <button onClick={extract} disabled={extracting} className="btn-primary w-full disabled:opacity-60">
          {extracting
            ? <><Loader size={14} className="animate-spin" /> Reading the image…</>
            : <>Extract contacts</>}
        </button>
      )}

      {error && <p className="text-xs text-red-400">{error}</p>}

      {/* Results */}
      {contacts !== null && (
        contacts.length === 0 ? (
          <div className="text-center py-4">
            <p className="text-sm text-orbital-subtle">No contacts found in that image.</p>
            <button
              onClick={() => { setContacts(null); setPreview(null) }}
              className="text-xs text-blue-400 hover:text-blue-300 mt-2 inline-flex items-center gap-1"
            >
              <RotateCcw size={11} /> Try another image
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            <p className="hud-label text-[10px]">Found {contacts.length} contact{contacts.length === 1 ? '' : 's'} — pick one to prefill the form</p>
            {contacts.map((c, i) => (
              <button
                key={i}
                onClick={() => useContact(c)}
                className="w-full card-elevated px-3 py-2.5 flex items-center gap-3 text-left hover:border-orbital-chrome transition-colors"
              >
                <UserPlus size={15} className="text-blue-400 flex-shrink-0" />
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium text-orbital-text truncate">
                    {c.name || 'Unnamed'}
                    {c.role && <span className="text-orbital-subtle font-normal"> — {c.role}</span>}
                  </span>
                  <span className="block text-xs text-orbital-subtle truncate">
                    {[c.email, c.phone, c.company].filter(Boolean).join(' · ') || 'No details'}
                  </span>
                </span>
              </button>
            ))}
          </div>
        )
      )}
    </div>
  )
}
