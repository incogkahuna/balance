import { useState } from 'react'
import { useApp } from '../../context/AppContext.jsx'
import {
  PRODUCTION_STATUS, PRODUCTION_TYPE, LOCATION_TYPE, ROLES,
  createProduction, USERS
} from '../../data/models.js'

export function ProductionForm({ initial, onSubmit, onCancel }) {
  const { currentUser } = useApp()

  const [form, setForm] = useState({
    name: initial?.name || '',
    client: initial?.client || '',
    locationType: initial?.locationType || LOCATION_TYPE.IN_HOUSE,
    locationAddress: initial?.locationAddress || '',
    productionType: initial?.productionType || PRODUCTION_TYPE.LED_VOLUME,
    status: initial?.status || PRODUCTION_STATUS.INCOMING,
    startDate: initial?.startDate || '',
    endDate: initial?.endDate || '',
    assignedMembers: initial?.assignedMembers || [],
    instructionNotes: initial?.instructionPackage?.notes || '',
  })

  const set = (key, val) => setForm(f => ({ ...f, [key]: val }))

  const toggleMember = (userId) => {
    const exists = form.assignedMembers.find(m => m.userId === userId)
    if (exists) {
      set('assignedMembers', form.assignedMembers.filter(m => m.userId !== userId))
    } else {
      set('assignedMembers', [...form.assignedMembers, { userId, roleOnProduction: '' }])
    }
  }

  const setMemberRole = (userId, role) => {
    set('assignedMembers', form.assignedMembers.map(m =>
      m.userId === userId ? { ...m, roleOnProduction: role } : m
    ))
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    const prod = createProduction({
      ...(initial || {}),
      name: form.name,
      client: form.client,
      locationType: form.locationType,
      locationAddress: form.locationAddress,
      productionType: form.productionType,
      status: form.status,
      startDate: form.startDate,
      endDate: form.endDate,
      assignedMembers: form.assignedMembers,
      instructionPackage: {
        ...(initial?.instructionPackage || { files: [], voiceMemos: [] }),
        notes: form.instructionNotes,
      },
      createdBy: initial?.createdBy || currentUser?.id,
    })
    onSubmit(prod)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div>
        <label className="label">Production Name *</label>
        <input
          className="input"
          value={form.name}
          onChange={e => set('name', e.target.value)}
          placeholder="e.g. Nike Airmax Campaign"
          required
        />
      </div>

      <div>
        <label className="label">Client</label>
        <input
          className="input"
          value={form.client}
          onChange={e => set('client', e.target.value)}
          placeholder="e.g. Nike / W+K Agency"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="label">Type</label>
          <select className="select" value={form.productionType} onChange={e => set('productionType', e.target.value)}>
            {Object.values(PRODUCTION_TYPE).map(t => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">Status</label>
          <select className="select" value={form.status} onChange={e => set('status', e.target.value)}>
            {Object.values(PRODUCTION_STATUS).map(s => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label className="label">Location</label>
        <select className="select mb-2" value={form.locationType} onChange={e => set('locationType', e.target.value)}>
          {Object.values(LOCATION_TYPE).map(l => (
            <option key={l} value={l}>{l}</option>
          ))}
        </select>
        {form.locationType === LOCATION_TYPE.MOBILE && (
          <input
            className="input mt-2"
            value={form.locationAddress}
            onChange={e => set('locationAddress', e.target.value)}
            placeholder="Sound stage address / name"
          />
        )}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="label">Start Date</label>
          <input type="date" className="input" value={form.startDate} onChange={e => set('startDate', e.target.value)} />
        </div>
        <div>
          <label className="label">End Date</label>
          <input type="date" className="input" value={form.endDate} onChange={e => set('endDate', e.target.value)} />
        </div>
      </div>

      {/* Team — Orbital Staff */}
      <div>
        <label className="label">Team</label>
        <div className="space-y-2">
          {USERS.map(user => {
            const assigned = form.assignedMembers.find(m => m.userId === user.id)
            return (
              <div key={user.id} className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => toggleMember(user.id)}
                  className={`flex items-center gap-2.5 flex-1 p-2.5 rounded-lg border text-left transition-colors ${
                    assigned
                      ? 'bg-blue-500/10 border-blue-500/40 text-orbital-text'
                      : 'bg-orbital-surface border-orbital-border text-orbital-subtle hover:border-orbital-muted'
                  }`}
                >
                  <div
                    className="w-7 h-7 rounded-full flex items-center justify-center font-semibold text-white text-xs flex-shrink-0"
                    style={{ backgroundColor: user.color }}
                  >
                    {user.avatar}
                  </div>
                  <div>
                    <p className="text-sm font-medium">{user.name}</p>
                    <p className="text-xs opacity-60 capitalize">{user.role}</p>
                  </div>
                  {assigned && (
                    <svg className="ml-auto w-4 h-4 text-blue-400" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  )}
                </button>
                {assigned && (
                  <input
                    className="input w-40 text-xs"
                    placeholder="Role on this job"
                    value={assigned.roleOnProduction}
                    onChange={e => setMemberRole(user.id, e.target.value)}
                  />
                )}
              </div>
            )
          })}
        </div>
      </div>

      <div>
        <label className="label">Package Notes</label>
        <textarea
          className="input min-h-[80px] resize-y"
          value={form.instructionNotes}
          onChange={e => set('instructionNotes', e.target.value)}
          placeholder="Stage config, special notes, key contacts..."
        />
      </div>

      <div className="flex gap-3 pt-2">
        <button type="button" onClick={onCancel} className="btn-secondary flex-1">Cancel</button>
        <button type="submit" className="btn-primary flex-1">
          {initial?.id ? 'Save Changes' : 'Create Production'}
        </button>
      </div>
    </form>
  )
}
