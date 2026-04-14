import { useState, useRef } from 'react'
import { AlertTriangle, Camera, X } from 'lucide-react'
import { useApp } from '../../context/AppContext.jsx'
import { createAddon } from '../../data/models.js'

export function AddonForm({ productionId, initial, onSubmit, onCancel }) {
  const { currentUser } = useApp()
  const fileRef = useRef()

  const [form, setForm] = useState({
    equipment: initial?.equipment || '',
    quantity: initial?.quantity || 1,
    duration: initial?.duration || '',
    cost: initial?.cost || '',
    damaged: initial?.damaged || false,
    notes: initial?.notes || '',
    damagePhotos: initial?.damagePhotos || [],
  })

  const set = (key, val) => setForm(f => ({ ...f, [key]: val }))

  const handlePhotoUpload = (e) => {
    const files = Array.from(e.target.files)
    files.forEach(file => {
      const reader = new FileReader()
      reader.onload = (ev) => {
        set('damagePhotos', [...form.damagePhotos, {
          id: crypto.randomUUID(),
          name: file.name,
          url: ev.target.result,
          uploadedAt: new Date().toISOString(),
        }])
      }
      reader.readAsDataURL(file)
    })
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    const addon = createAddon({
      ...(initial || {}),
      productionId,
      equipment: form.equipment,
      quantity: form.quantity,
      duration: form.duration,
      cost: form.cost,
      damaged: form.damaged,
      notes: form.notes,
      damagePhotos: form.damagePhotos,
      loggedBy: initial?.loggedBy || currentUser?.id,
    })
    onSubmit(addon)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="label">Equipment / Item *</label>
        <input
          className="input"
          value={form.equipment}
          onChange={e => set('equipment', e.target.value)}
          placeholder="e.g. Scissor lift, Forklift, 4x LED panels..."
          required
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
              multiple
              className="hidden"
              onChange={handlePhotoUpload}
            />
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="btn-secondary w-full"
            >
              <Camera size={16} /> Upload Damage Photos
            </button>
            {form.damagePhotos.length > 0 && (
              <div className="grid grid-cols-3 gap-2 mt-3">
                {form.damagePhotos.map(photo => (
                  <div key={photo.id} className="relative group">
                    <img
                      src={photo.url}
                      alt={photo.name}
                      className="w-full h-20 object-cover rounded-lg border border-orbital-border"
                    />
                    <button
                      type="button"
                      onClick={() => set('damagePhotos', form.damagePhotos.filter(p => p.id !== photo.id))}
                      className="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/70 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
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
        <button type="button" onClick={onCancel} className="btn-secondary flex-1">Cancel</button>
        <button type="submit" className="btn-primary flex-1">
          {initial?.id ? 'Save Add-on' : 'Log Add-on'}
        </button>
      </div>
    </form>
  )
}
