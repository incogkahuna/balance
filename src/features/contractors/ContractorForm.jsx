import { useState, useRef } from 'react'
import { Camera, X } from 'lucide-react'
import { useApp } from '../../context/AppContext.jsx'
import {
  ROLES, AVAILABILITY_STATUS, EXPERIENCE_LEVEL, CONTRACTOR_FLAG,
  createContractor,
} from '../../data/models.js'

export function ContractorForm({ initial, onSubmit, onCancel }) {
  const { currentUser } = useApp()
  const isAdmin = currentUser?.role === ROLES.ADMIN
  const photoInputRef = useRef(null)

  const [form, setForm] = useState({
    name:              initial?.name || '',
    photoUrl:          initial?.photoUrl || null,
    phone:             initial?.phone || '',
    email:             initial?.email || '',
    location:          initial?.location || '',
    availability:      initial?.availability || AVAILABILITY_STATUS.AVAILABLE,
    primaryRole:       initial?.primaryRole || '',
    secondaryRoles:    initial?.secondaryRoles?.join(', ') || '',
    skills:            initial?.skills?.join(', ') || '',
    experienceLevel:   initial?.experienceLevel || EXPERIENCE_LEVEL.MID,
    flag:              initial?.flag || CONTRACTOR_FLAG.NEUTRAL,
    notes:             initial?.notes || '',
    dayRate:           initial?.dayRate || '',
    weeklyRate:        initial?.weeklyRate || '',
    rateNotes:         initial?.rateNotes || '',
    ecName:            initial?.emergencyContact?.name || '',
    ecRelationship:    initial?.emergencyContact?.relationship || '',
    ecPhone:           initial?.emergencyContact?.phone || '',
  })

  const set = (key, val) => setForm(f => ({ ...f, [key]: val }))

  const handlePhoto = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => set('photoUrl', ev.target.result)
    reader.readAsDataURL(file)
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    const contractor = createContractor({
      ...(initial || {}),
      name:           form.name.trim(),
      photoUrl:       form.photoUrl,
      phone:          form.phone.trim(),
      email:          form.email.trim(),
      location:       form.location.trim(),
      availability:   form.availability,
      primaryRole:    form.primaryRole.trim(),
      secondaryRoles: form.secondaryRoles.split(',').map(s => s.trim()).filter(Boolean),
      skills:         form.skills.split(',').map(s => s.trim()).filter(Boolean),
      experienceLevel: form.experienceLevel,
      flag:           form.flag,
      notes:          form.notes.trim(),
      dayRate:        form.dayRate.trim(),
      weeklyRate:     form.weeklyRate.trim(),
      rateNotes:      form.rateNotes.trim(),
      emergencyContact: {
        name:         form.ecName.trim(),
        relationship: form.ecRelationship.trim(),
        phone:        form.ecPhone.trim(),
      },
    })
    onSubmit(contractor)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* Photo */}
      <div className="flex items-center gap-4">
        <div
          className="w-16 h-16 rounded-full bg-orbital-muted flex items-center justify-center overflow-hidden flex-shrink-0 border border-orbital-border cursor-pointer"
          onClick={() => photoInputRef.current?.click()}
        >
          {form.photoUrl
            ? <img src={form.photoUrl} alt="Photo" className="w-full h-full object-cover" />
            : <Camera size={20} className="text-orbital-subtle" />
          }
        </div>
        <div>
          <button
            type="button"
            onClick={() => photoInputRef.current?.click()}
            className="btn-ghost text-xs"
          >
            {form.photoUrl ? 'Change photo' : 'Add photo'}
          </button>
          {form.photoUrl && (
            <button
              type="button"
              onClick={() => set('photoUrl', null)}
              className="ml-2 text-xs text-orbital-subtle hover:text-red-400 transition-colors"
            >
              Remove
            </button>
          )}
          <p className="text-xs text-orbital-subtle mt-1">Optional. Stores locally.</p>
        </div>
        <input
          ref={photoInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={handlePhoto}
        />
      </div>

      {/* Name */}
      <div>
        <label className="label">Full Name *</label>
        <input
          className="input"
          value={form.name}
          onChange={e => set('name', e.target.value)}
          placeholder="e.g. Jake Morrison"
          required
        />
      </div>

      {/* Contact */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label className="label">Phone</label>
          <input
            className="input"
            type="tel"
            value={form.phone}
            onChange={e => set('phone', e.target.value)}
            placeholder="+1 (310) 555-0142"
          />
        </div>
        <div>
          <label className="label">Email</label>
          <input
            className="input"
            type="email"
            value={form.email}
            onChange={e => set('email', e.target.value)}
            placeholder="name@gmail.com"
          />
        </div>
      </div>

      <div>
        <label className="label">Location</label>
        <input
          className="input"
          value={form.location}
          onChange={e => set('location', e.target.value)}
          placeholder="City, State"
        />
      </div>

      {/* Roles */}
      <div>
        <label className="label">Primary Role *</label>
        <input
          className="input"
          value={form.primaryRole}
          onChange={e => set('primaryRole', e.target.value)}
          placeholder="e.g. LED Wall Operator"
          required
        />
      </div>

      <div>
        <label className="label">Secondary Roles</label>
        <input
          className="input"
          value={form.secondaryRoles}
          onChange={e => set('secondaryRoles', e.target.value)}
          placeholder="Stage Technician, Rigging Tech  (comma-separated)"
        />
      </div>

      <div>
        <label className="label">Skills</label>
        <input
          className="input"
          value={form.skills}
          onChange={e => set('skills', e.target.value)}
          placeholder="ROE, Brompton, Tessera, Disguise  (comma-separated)"
        />
      </div>

      {/* Experience + Availability */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="label">Experience Level</label>
          <select
            className="select"
            value={form.experienceLevel}
            onChange={e => set('experienceLevel', e.target.value)}
          >
            {Object.values(EXPERIENCE_LEVEL).map(l => (
              <option key={l} value={l}>{l}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">Availability</label>
          <select
            className="select"
            value={form.availability}
            onChange={e => set('availability', e.target.value)}
          >
            {Object.values(AVAILABILITY_STATUS).map(s => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Flag */}
      <div>
        <label className="label">Flag</label>
        <select
          className="select"
          value={form.flag}
          onChange={e => set('flag', e.target.value)}
        >
          {Object.values(CONTRACTOR_FLAG).map(f => (
            <option key={f} value={f}>{f}</option>
          ))}
        </select>
      </div>

      {/* Notes */}
      <div>
        <label className="label">Notes</label>
        <textarea
          className="input min-h-[72px] resize-y"
          value={form.notes}
          onChange={e => set('notes', e.target.value)}
          placeholder="Reliability, preferences, anything worth knowing..."
        />
      </div>

      {/* Admin-only: Rates */}
      {isAdmin && (
        <fieldset className="space-y-4 pt-2 border-t border-orbital-border">
          <legend className="section-title pt-2">Rates (Admin only)</legend>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Day Rate ($)</label>
              <input
                className="input"
                type="number"
                min="0"
                value={form.dayRate}
                onChange={e => set('dayRate', e.target.value)}
                placeholder="850"
              />
            </div>
            <div>
              <label className="label">Weekly Rate ($)</label>
              <input
                className="input"
                type="number"
                min="0"
                value={form.weeklyRate}
                onChange={e => set('weeklyRate', e.target.value)}
                placeholder="3800"
              />
            </div>
          </div>
          <div>
            <label className="label">Rate Notes</label>
            <input
              className="input"
              value={form.rateNotes}
              onChange={e => set('rateNotes', e.target.value)}
              placeholder="Kit fees, OT policy, travel terms..."
            />
          </div>
        </fieldset>
      )}

      {/* Admin-only: Emergency Contact */}
      {isAdmin && (
        <fieldset className="space-y-4 pt-2 border-t border-orbital-border">
          <legend className="section-title pt-2">Emergency Contact (Admin only)</legend>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="label">Name</label>
              <input
                className="input"
                value={form.ecName}
                onChange={e => set('ecName', e.target.value)}
                placeholder="Lisa Morrison"
              />
            </div>
            <div>
              <label className="label">Relationship</label>
              <input
                className="input"
                value={form.ecRelationship}
                onChange={e => set('ecRelationship', e.target.value)}
                placeholder="Spouse"
              />
            </div>
          </div>
          <div>
            <label className="label">Phone</label>
            <input
              className="input"
              type="tel"
              value={form.ecPhone}
              onChange={e => set('ecPhone', e.target.value)}
              placeholder="+1 (310) 555-0198"
            />
          </div>
        </fieldset>
      )}

      <div className="flex gap-3 pt-2">
        <button type="button" onClick={onCancel} className="btn-secondary flex-1">
          Cancel
        </button>
        <button type="submit" className="btn-primary flex-1">
          {initial?.id ? 'Save Changes' : 'Add Contractor'}
        </button>
      </div>
    </form>
  )
}
