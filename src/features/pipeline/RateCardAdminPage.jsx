import { useMemo, useState } from 'react'
import { Plus, History, Trash2 } from 'lucide-react'
import { usePipeline } from './PipelineContext.jsx'
import { fmtMoney } from './quoteMath.js'
import { fmtDate } from './components.jsx'
import { Modal } from '../../components/ui/Modal.jsx'
import { useToast } from '../../context/ToastContext.jsx'

// ─────────────────────────────────────────────────────────────────────────────
// RateCardAdminPage — rates are VERSIONED DATA, not code. Edits accumulate in
// a local draft; "Publish" writes a NEW version. Existing quotes keep the
// version they were built on; new quotes pick up current. (The card is being
// actively revised for the new TVC facility — day-one need.)
//
// v1 editing surface: rates / names / descriptions inline, add a line to any
// section, remove a line, plus a raw-JSON escape hatch for structural edits
// (bundles, dependency rules, presets). Reordering = JSON editor for now.
// ─────────────────────────────────────────────────────────────────────────────

export function RateCardAdminPage() {
  const { ready, isAdmin, currentRateCard, rateCards, publishRateCardVersion } = usePipeline()
  const toast = useToast()

  const [draft, setDraft] = useState(null)      // working copy of card.data
  const [label, setLabel] = useState('')
  const [venue, setVenue] = useState('tvc')
  const [jsonOpen, setJsonOpen] = useState(false)
  const [addTo, setAddTo] = useState(null)      // section id pending line add
  const [publishing, setPublishing] = useState(false)

  const base = currentRateCard?.data
  const card = draft || base
  const dirty = !!draft

  const template = useMemo(() => card?.templates?.[venue], [card, venue])

  if (!ready) return null
  if (!isAdmin) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-10 text-center">
        <p className="text-sm text-orbital-subtle">The rate card is admin-only.</p>
      </div>
    )
  }
  if (!card) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-10 text-center">
        <p className="text-sm text-orbital-subtle">No rate card loaded yet.</p>
      </div>
    )
  }

  const startEdit = () => setDraft(JSON.parse(JSON.stringify(base)))

  const setLine = (lineId, patch) => {
    setDraft((d) => {
      const next = d ? { ...d } : JSON.parse(JSON.stringify(base))
      next.lines = { ...next.lines, [lineId]: { ...next.lines[lineId], ...patch } }
      return next
    })
  }

  const setLineRate = (lineId, venueKey, value) => {
    const line = card.lines[lineId]
    const num = value === '' ? null : Number(value)
    if (typeof line.rate === 'object' && line.rate !== null) {
      setLine(lineId, { rate: { ...line.rate, [venueKey]: num ?? 0 } })
    } else {
      setLine(lineId, { rate: num })
    }
  }

  const removeLine = (sectionId, lineId) => {
    setDraft((d) => {
      const next = d ? JSON.parse(JSON.stringify(d)) : JSON.parse(JSON.stringify(base))
      for (const v of Object.keys(next.templates)) {
        for (const s of next.templates[v].sections) {
          if (s.id === sectionId) s.lines = s.lines.filter((l) => l !== lineId)
        }
      }
      return next
    })
  }

  const addLine = ({ id, name, unit, rate, description }) => {
    setDraft((d) => {
      const next = d ? JSON.parse(JSON.stringify(d)) : JSON.parse(JSON.stringify(base))
      next.lines[id] = { name, unit, rate: rate === null ? undefined : rate, description, ...(rate === null ? { priceMode: 'manual' } : {}) }
      // Shared sections exist in both templates under the same id — add once
      // per template that carries the section.
      for (const v of Object.keys(next.templates)) {
        for (const s of next.templates[v].sections) {
          if (s.id === addTo && !s.lines.includes(id)) s.lines.push(id)
        }
      }
      return next
    })
    setAddTo(null)
  }

  const publish = async () => {
    if (!dirty || publishing) return
    setPublishing(true)
    const published = await publishRateCardVersion(
      draft,
      label.trim() || `v${(currentRateCard?.version || 0) + 1} — ${new Date().toISOString().slice(0, 10)}`,
    )
    setPublishing(false)
    if (published) {
      setDraft(null)
      setLabel('')
    }
  }

  return (
    <div className="max-w-5xl mx-auto px-3 sm:px-4 lg:px-6 py-5">
      <div className="flex items-center justify-between gap-3 mb-1 flex-wrap">
        <div>
          <p className="hud-label mb-1">JOB PIPELINE</p>
          <h1 className="text-xl sm:text-2xl font-semibold text-orbital-text tracking-tight">Rate Card</h1>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setJsonOpen(true)} className="btn-secondary text-xs">Advanced (JSON)</button>
          {!dirty ? (
            <button onClick={startEdit} className="btn-primary text-xs">Edit rates</button>
          ) : (
            <>
              <button onClick={() => { setDraft(null); setLabel('') }} className="btn-secondary text-xs">Discard</button>
              <button onClick={publish} disabled={publishing} className="btn-primary text-xs">
                {publishing ? 'Publishing…' : `Publish as v${(currentRateCard?.version || 0) + 1}`}
              </button>
            </>
          )}
        </div>
      </div>
      <p className="text-sm text-orbital-subtle mb-3">
        Current: <span className="text-orbital-text">v{currentRateCard?.version}</span> — {currentRateCard?.label}.
        Publishing creates a new version; existing quotes keep the version they were built on.
      </p>

      {dirty && (
        <div className="mb-4 max-w-md">
          <label className="label">Version label</label>
          <input className="input" placeholder="e.g. Stage-manager line added for new TVC facility"
            value={label} onChange={(e) => setLabel(e.target.value)} />
        </div>
      )}

      {/* Venue tab */}
      <div className="flex gap-1.5 mb-4">
        {[['tvc', 'TVC'], ['mobile', 'In Orbit (Mobile)']].map(([v, l]) => (
          <button key={v} onClick={() => setVenue(v)}
            className={venue === v ? 'btn-primary text-xs' : 'btn-secondary text-xs'}>
            {l}
          </button>
        ))}
      </div>

      <div className="space-y-4">
        {template.sections.map((section) => (
          <div key={section.id} className="card-elevated overflow-hidden">
            <div className="flex items-center justify-between px-4 py-2"
              style={{ background: 'rgba(59,130,246,0.05)', borderBottom: '1px solid var(--orbital-border)' }}>
              <p className="text-[12px] font-semibold text-orbital-text uppercase tracking-wider">{section.title}</p>
              {dirty && (
                <button onClick={() => setAddTo(section.id)} className="btn-ghost text-xs">
                  <Plus size={12} /> Add line
                </button>
              )}
            </div>
            <div className="divide-y" style={{ borderColor: 'var(--orbital-border)' }}>
              {section.lines.map((lineId) => {
                const line = card.lines[lineId]
                if (!line) return null
                const perVenue = typeof line.rate === 'object' && line.rate !== null
                const rateVal = perVenue ? line.rate[venue] : line.rate
                return (
                  <div key={lineId} className="px-4 py-2 flex items-center gap-3">
                    <div className="min-w-0 flex-1">
                      {dirty ? (
                        <input className="input py-1 text-[13px] font-medium mb-0.5" value={line.name}
                          onChange={(e) => setLine(lineId, { name: e.target.value })} />
                      ) : (
                        <p className="text-[13px] font-medium text-orbital-text truncate">
                          {line.name}
                          {perVenue && <span className="text-[9px] text-orbital-dim ml-1.5">(per-venue rate)</span>}
                        </p>
                      )}
                      {dirty ? (
                        <input className="input py-1 text-[11px]" value={line.description || ''}
                          onChange={(e) => setLine(lineId, { description: e.target.value })} />
                      ) : (
                        <p className="text-[11px] text-orbital-dim truncate">{line.description}</p>
                      )}
                    </div>
                    <span className="text-[10px] text-orbital-dim w-14 flex-shrink-0">{line.unit}</span>
                    <div className="w-28 text-right flex-shrink-0">
                      {dirty && line.priceMode !== 'manual' ? (
                        <input type="number" className="input py-1 text-right text-[12px] font-telemetry"
                          value={rateVal ?? ''}
                          onChange={(e) => setLineRate(lineId, venue, e.target.value)} />
                      ) : (
                        <span className="font-telemetry text-[12px] text-orbital-subtle">
                          {line.priceMode === 'manual' ? 'Manual'
                            : line.priceMode === 'range' && line.range ? `${fmtMoney(line.range[0])}–${fmtMoney(line.range[1])}`
                            : fmtMoney(rateVal ?? 0)}
                        </span>
                      )}
                    </div>
                    {dirty && (
                      <button onClick={() => removeLine(section.id, lineId)}
                        className="btn-ghost text-red-400 flex-shrink-0 p-1" title="Remove from this section">
                        <Trash2 size={13} />
                      </button>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Version history */}
      <div className="card-elevated p-4 mt-4">
        <p className="hud-label mb-2 flex items-center gap-1.5"><History size={11} /> VERSIONS</p>
        <div className="space-y-1">
          {rateCards.slice().reverse().map((c) => (
            <p key={c.id} className="text-[12px] text-orbital-subtle">
              <span className="font-telemetry text-orbital-text">v{c.version}</span> — {c.label}
              <span className="text-orbital-dim"> · {fmtDate(c.createdAt)}</span>
              {c.version === currentRateCard?.version && <span className="text-green-500 ml-1.5">CURRENT</span>}
            </p>
          ))}
        </div>
      </div>

      {addTo && <AddLineModal sectionId={addTo} card={card} onAdd={addLine} onClose={() => setAddTo(null)} />}

      <Modal open={jsonOpen} onClose={() => setJsonOpen(false)} title="Rate card — advanced JSON" size="xl">
        <JsonEditor
          card={card}
          onApply={(next) => {
            setDraft(next)
            setJsonOpen(false)
            toast.success('Draft updated — publish to make it live.')
          }}
        />
      </Modal>
    </div>
  )
}

function AddLineModal({ sectionId, card, onAdd, onClose }) {
  const [name, setName] = useState('')
  const [unit, setUnit] = useState('Days')
  const [rate, setRate] = useState('')
  const [description, setDescription] = useState('')
  const id = useMemo(() => {
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '') || 'line'
    let candidate = slug, i = 2
    while (card.lines[candidate]) candidate = `${slug}_${i++}`
    return candidate
  }, [name, card])

  return (
    <Modal open onClose={onClose} title="Add rate card line" size="sm">
      <div className="space-y-3">
        <div>
          <label className="label">Name *</label>
          <input className="input" autoFocus value={name} onChange={(e) => setName(e.target.value)}
            placeholder="Stage Manager" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Unit</label>
            <select className="input" value={unit} onChange={(e) => setUnit(e.target.value)}>
              {['Days', 'Weeks', 'Hours', 'Each', 'Allow', 'Trips', 'Panels'].map((u) => <option key={u}>{u}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Rate (empty = manual)</label>
            <input type="number" className="input" value={rate} onChange={(e) => setRate(e.target.value)} />
          </div>
        </div>
        <div>
          <label className="label">Description</label>
          <input className="input" value={description} onChange={(e) => setDescription(e.target.value)} />
        </div>
        <div className="flex justify-end gap-2">
          <button className="btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn-primary" disabled={!name.trim()}
            onClick={() => onAdd({ id, name: name.trim(), unit, rate: rate === '' ? null : Number(rate), description })}>
            Add to section
          </button>
        </div>
      </div>
    </Modal>
  )
}

function JsonEditor({ card, onApply }) {
  const [text, setText] = useState(() => JSON.stringify(card, null, 2))
  const [err, setErr] = useState(null)
  return (
    <div className="space-y-2">
      <p className="text-xs text-orbital-subtle">
        Full card document — bundles, dependency rules (<code>requires</code>), presets, section order.
        Applying replaces the draft; nothing is live until you publish.
      </p>
      <textarea
        className="input font-mono text-[11px] w-full"
        rows={20}
        value={text}
        onChange={(e) => { setText(e.target.value); setErr(null) }}
        spellCheck={false}
      />
      {err && <p className="text-[11px] text-red-400">{err}</p>}
      <div className="flex justify-end">
        <button className="btn-primary text-xs" onClick={() => {
          try {
            const parsed = JSON.parse(text)
            if (!parsed.lines || !parsed.templates) throw new Error('Card needs `lines` and `templates`.')
            onApply(parsed)
          } catch (e) {
            setErr(e.message)
          }
        }}>
          Apply to draft
        </button>
      </div>
    </div>
  )
}
