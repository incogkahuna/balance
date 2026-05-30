import { useState, useRef, useEffect } from 'react'
import { AlertTriangle, Camera, X } from 'lucide-react'
import { useApp } from '../../context/AppContext.jsx'
import { useAutoSave } from '../../hooks/useAutoSave.js'
import { SaveStatusPill } from '../ui/SaveStatusPill.jsx'
import { createAddon } from '../../data/models.js'
import { StoredImage } from '../files/StoredImage.tsx'
import { uploadFile, BUCKETS, paths } from '../../lib/storage.ts'

export function AddonForm({ productionId, initial, onClose }) {
  const { currentUser, addAddon, updateAddon, deleteAddon } = useApp()
  const fileRef = useRef()

  // Stable id for the addon — needed in the storage path for photo uploads
  // AND used by the eager-create placeholder so the auto-save effect knows
  // which addon row to update.
  const [addonId] = useState(() => initial?.id || crypto.randomUUID())

  // ── Eager-create placeholder ──────────────────────────────────────────────
  const workingIdRef = useRef(initial?.id || null)
  const createdHereRef = useRef(false)

  useEffect(() => {
    if (initial?.id || workingIdRef.current) return
    const placeholder = createAddon({
      id: addonId,
      productionId,
      equipment: '',
      quantity: 1,
      duration: '',
      cost: '',
      damaged: false,
      notes: '',
      damagePhotos: [],
      loggedBy: currentUser?.id || '',
    })
    workingIdRef.current = addonId
    createdHereRef.current = true
    addAddon(productionId, placeholder)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const [form, setForm] = useState({
    equipment: initial?.equipment || '',
    quantity: initial?.quantity || 1,
    duration: initial?.duration || '',
    cost: initial?.cost || '',
    damaged: initial?.damaged || false,
    notes: initial?.notes || '',
    damagePhotos: initial?.damagePhotos || [],
  })

  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState(null)

  const set = (key, val) => setForm(f => ({ ...f, [key]: val }))

  // ── Auto-save ─────────────────────────────────────────────────────────────
  const enabled = !!workingIdRef.current
  const { status: saveStatus, lastSavedAt, error: saveError } = useAutoSave(
    form,
    (value) => {
      const id = workingIdRef.current
      if (!id) return
      updateAddon(productionId, id, value)
    },
    { enabled, delay: 600 }
  )

  // Close: drop placeholder if equipment field was never filled in
  const handleClose = () => {
    const id = workingIdRef.current
    if (id && createdHereRef.current && !form.equipment.trim()) {
      deleteAddon(productionId, id)
    }
    onClose?.()
  }

  const handlePhotoUpload = async (e) => {
    const files = Array.from(e.target.files || [])
    e.target.value = ''
    if (files.length === 0) return

    setUploadError(null)
    setUploading(true)
    try {
      const uploaded = []
      for (const file of files) {
        const path = paths.damagePhoto(productionId, addonId, file.name)
        await uploadFile(BUCKETS.damagePhotos, path, file, { contentType: file.type })
        uploaded.push({
          id: crypto.randomUUID(),
          name: file.name,
          storage_path: path,
          uploadedAt: new Date().toISOString(),
        })
      }
      setForm(f => ({ ...f, damagePhotos: [...f.damagePhotos, ...uploaded] }))
    } catch (err) {
      console.error('[AddonForm] damage photo upload failed:', err)
      setUploadError(err instanceof Error ? err.message : 'Upload failed')
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-end">
        <SaveStatusPill status={saveStatus} lastSavedAt={lastSavedAt} error={saveError} compact />
      </div>

      <div>
        <label className="label">Equipment / Item *</label>
        <input
          className="input"
          value={form.equipment}
          onChange={e => set('equipment', e.target.value)}
          placeholder="e.g. Scissor lift, Forklift, 4x LED panels..."
          autoFocus
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="label">Quantity</label>
          <input
            type="number"
            min={1}
            className="input"
            value={form.quantity}
            onChange={e => set('quantity', parseInt(e.target.value) || 1)}
          />
        </div>
        <div>
          <label className="label">Duration</label>
          <input
            className="input"
            value={form.duration}
            onChange={e => set('duration', e.target.value)}
            placeholder="e.g. 2 days, 4 hours"
          />
        </div>
      </div>

      <div>
        <label className="label">Cost (if known)</label>
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-orbital-subtle text-sm">$</span>
          <input
            className="input pl-7"
            value={form.cost}
            onChange={e => set('cost', e.target.value)}
            placeholder="0.00"
          />
        </div>
      </div>

      <div>
        <label className="label">Notes</label>
        <textarea
          className="input min-h-[60px] resize-y"
          value={form.notes}
          onChange={e => set('notes', e.target.value)}
          placeholder="Additional context, reason for add-on..."
        />
      </div>

      {/* Damage flag */}
      <div>
        <button
          type="button"
          onClick={() => set('damaged', !form.damaged)}
          className={`flex items-center gap-3 w-full p-3.5 rounded-xl border transition-colors ${
            form.damaged
              ? 'bg-red-500/10 border-red-500/40 text-red-400'
              : 'bg-orbital-surface border-orbital-border text-orbital-subtle hover:border-orbital-muted'
          }`}
        >
          <AlertTriangle size={18} />
          <div className="text-left flex-1">
            <p className="text-sm font-medium">Flag as Damaged</p>
            <p className="text-xs opacity-70 mt-0.5">Mark if equipment was damaged</p>
          </div>
          <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
            form.damaged ? 'border-red-400 bg-red-400' : 'border-orbital-border'
          }`}>
            {form.damaged && (
              <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
            )}
          </div>
        </button>

        {form.damaged && (
          <div className="mt-3">
            <input
              type="file"
              ref={fileRef}
              accept="image/*"
              capture="environment"
              multiple
              className="hidden"
              onChange={handlePhotoUpload}
            />
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              className="btn-secondary w-full disabled:opacity-50"
            >
              <Camera size={16} /> {uploading ? 'Uploading...' : 'Upload Damage Photos'}
            </button>
            {uploadError && (
              <p className="text-xs text-red-400 mt-2">{uploadError}</p>
            )}
            {form.damagePhotos.length > 0 && (
              <div className="grid grid-cols-3 gap-2 mt-3">
                {form.damagePhotos.map(photo => (
                  <div key={photo.id} className="relative group">
                    <DamagePhotoThumb photo={photo} />
                    <button
                      type="button"
                      onClick={() => set('damagePhotos', form.damagePhotos.filter(p => p.id !== photo.id))}
                      className="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/70 flex items-center justify-center sm:opacity-0 sm:group-hover:opacity-100 transition-opacity"
                    >
                      <X size={12} className="text-white" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      <div className="flex gap-3 pt-1">
        <button type="button" onClick={handleClose} className="btn-primary flex-1" disabled={uploading}>
          Done
        </button>
      </div>
    </div>
  )
}

// Damage photos store either `storage_path` (new) or `url` (legacy base64).
function DamagePhotoThumb({ photo }) {
  if (photo.storage_path) {
    return (
      <StoredImage
        bucket={BUCKETS.damagePhotos}
        path={photo.storage_path}
        alt={photo.name || 'Damage photo'}
        className="w-full h-20 object-cover rounded-lg border border-orbital-border"
      />
    )
  }
  return (
    <img
      src={photo.url}
      alt={photo.name}
      className="w-full h-20 object-cover rounded-lg border border-orbital-border"
    />
  )
}
