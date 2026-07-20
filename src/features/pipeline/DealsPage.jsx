import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Search, Briefcase, Sparkles } from 'lucide-react'
import { usePipeline, STATUS_ORDER, STATUS_LABELS, ROLE_LABELS } from './PipelineContext.jsx'
import { DealStatusBadge, VenueChip, ModeChip, MoneyTriple, ClientHistoryList, fmtDate } from './components.jsx'
import { Modal } from '../../components/ui/Modal.jsx'
import { useToast } from '../../context/ToastContext.jsx'
import { seedDemoData } from './demoSeed.js'

// ─────────────────────────────────────────────────────────────────────────────
// DealsPage — the pipeline board. Deals grouped by status ladder; creating a
// deal takes under 30 seconds (name, client, venue, mode, dates — everything
// else comes later). Role-aware: money renders for admin roles only, and the
// data layer guarantees non-admins never received it in the first place.
// ─────────────────────────────────────────────────────────────────────────────

export function DealsPage() {
  const { ready, deals, money, handoffs, canSeeMoney, isAdmin, pipelineRole, refresh } = usePipeline()
  const toast = useToast()
  const navigate = useNavigate()
  const [search, setSearch] = useState('')
  const [createOpen, setCreateOpen] = useState(false)
  const [seeding, setSeeding] = useState(false)

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase()
    if (!needle) return deals
    return deals.filter((d) =>
      d.clientCompany.toLowerCase().includes(needle) ||
      d.projectName.toLowerCase().includes(needle) ||
      (d.clientContact || '').toLowerCase().includes(needle))
  }, [deals, search])

  const grouped = useMemo(() => {
    const buckets = {}
    for (const s of [...STATUS_ORDER, 'dead']) buckets[s] = []
    for (const d of filtered) (buckets[d.status] || (buckets[d.status] = [])).push(d)
    return buckets
  }, [filtered])

  const handleSeed = async () => {
    setSeeding(true)
    try {
      await seedDemoData()
      await refresh()
      toast.success('Demo deals seeded')
    } catch (err) {
      console.error('[Pipeline] demo seed failed:', err)
      toast.error(`Seed failed — ${err?.message || 'unknown error'}`)
    } finally {
      setSeeding(false)
    }
  }

  return (
    <div className="max-w-6xl mx-auto px-3 sm:px-4 lg:px-6 py-5">
      <div className="flex items-center justify-between mb-2 gap-3">
        <div>
          <p className="hud-label mb-1">JOB PIPELINE</p>
          <h1 className="text-xl sm:text-2xl font-semibold text-orbital-text tracking-tight">Deals</h1>
        </div>
        {isAdmin && (
          <button onClick={() => setCreateOpen(true)} className="btn-primary">
            <Plus size={14} />
            <span className="hidden sm:inline">New Deal</span>
            <span className="sm:hidden">New</span>
          </button>
        )}
      </div>
      <p className="text-sm text-orbital-subtle mb-4">
        {pipelineRole && (
          <>Viewing as <span className="text-orbital-text">{ROLE_LABELS[pipelineRole] || pipelineRole}</span>. </>
        )}
        Type a client to pull every past deal instantly.
      </p>

      {/* Search — the retrieval payback starts here */}
      <div className="relative mb-5 max-w-md">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-orbital-dim" />
        <input
          className="input pl-9"
          placeholder="Search clients, projects, contacts…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {!ready ? (
        <div className="card-elevated p-8 text-center">
          <p className="font-telemetry text-[9px] tracking-[0.2em] text-orbital-subtle">LOADING PIPELINE</p>
        </div>
      ) : deals.length === 0 ? (
        <div className="card-elevated p-8 text-center">
          <Briefcase size={32} className="mx-auto text-orbital-dim mb-3" />
          <p className="text-sm text-orbital-subtle mb-1">No deals yet.</p>
          <p className="text-xs text-orbital-dim mb-4">
            Every job starts here — email arrives, call happens, deal gets created in under 30 seconds.
          </p>
          {isAdmin && (
            <div className="flex items-center justify-center gap-2">
              <button onClick={() => setCreateOpen(true)} className="btn-primary inline-flex">
                <Plus size={14} /> First deal
              </button>
              <button onClick={handleSeed} disabled={seeding} className="btn-secondary inline-flex">
                <Sparkles size={14} /> {seeding ? 'Seeding…' : 'Seed demo deals'}
              </button>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-6">
          {[...STATUS_ORDER, 'dead'].map((status) => {
            const bucket = grouped[status] || []
            if (!bucket.length && status === 'dead') return null
            return (
              <section key={status}>
                <p className="hud-label mb-2">
                  {STATUS_LABELS[status].toUpperCase()}
                  <span className="text-orbital-dim ml-2">{bucket.length}</span>
                </p>
                {bucket.length === 0 ? (
                  <p className="text-xs text-orbital-dim px-1">Nothing here.</p>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2.5">
                    {bucket.map((d) => (
                      <DealCard
                        key={d.id}
                        deal={d}
                        money={canSeeMoney ? money[d.id] : null}
                        handoff={handoffs.find((h) => h.dealId === d.id)}
                        onOpen={() => navigate(`/pipeline/deals/${d.id}`)}
                      />
                    ))}
                  </div>
                )}
              </section>
            )
          })}
        </div>
      )}

      {createOpen && <DealCreateModal onClose={() => setCreateOpen(false)} />}
    </div>
  )
}

function DealCard({ deal, money, handoff, onOpen }) {
  return (
    <button onClick={onOpen} className="card text-left p-3 w-full">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[14px] font-semibold text-orbital-text truncate">{deal.projectName}</p>
          <p className="text-[12px] text-orbital-subtle truncate">{deal.clientCompany}</p>
        </div>
        <DealStatusBadge status={deal.status} className="flex-shrink-0" />
      </div>
      <div className="flex items-center gap-1.5 mt-2 flex-wrap">
        <VenueChip venue={deal.venue} location={deal.mobileLocation} />
        <ModeChip mode={deal.intakeMode} />
        {deal.assetClass && (
          <span className="text-[11px] text-orbital-dim">{deal.assetClass}</span>
        )}
      </div>
      <div className="flex items-center justify-between mt-2">
        <span className="text-[11px] text-orbital-dim">{fmtDate(deal.startDate)}</span>
        {money && <MoneyTriple m={money} />}
      </div>
      {handoff && (
        <p className="mt-1.5 text-[11px]" style={{ color: handoff.state === 'active' ? '#22c55e' : '#eab308' }}>
          Production {handoff.state === 'active' ? 'ACTIVE' : 'PENDING'}
        </p>
      )}
    </button>
  )
}

// ── 30-second deal creation — name, client, venue, mode, dates. Done. ────────
function DealCreateModal({ onClose }) {
  const { deals, addDeal } = usePipeline()
  const navigate = useNavigate()
  const [form, setForm] = useState({
    projectName: '', clientCompany: '', clientContact: '', clientEmail: '', clientPhone: '',
    venue: 'tvc', mobileLocation: '', intakeMode: 'standard', assetClass: '',
    startDate: '', days: { travel: 0, build: 0, shoot: 1, strike: 0 },
  })
  const [saving, setSaving] = useState(false)
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }))
  const setDay = (k, v) => setForm((f) => ({ ...f, days: { ...f.days, [k]: Math.max(0, Number(v) || 0) } }))

  const knownClients = useMemo(() => {
    const names = [...new Set(deals.map((d) => d.clientCompany))]
    return names.sort((a, b) => a.localeCompare(b))
  }, [deals])
  const isKnownClient = knownClients.some(
    (c) => c.toLowerCase() === form.clientCompany.trim().toLowerCase())

  const canSave = form.projectName.trim() && form.clientCompany.trim()

  const handleSave = async () => {
    if (!canSave || saving) return
    setSaving(true)
    const created = await addDeal({
      ...form,
      projectName: form.projectName.trim(),
      clientCompany: form.clientCompany.trim(),
      startDate: form.startDate || null,
      endDate: null,
    })
    setSaving(false)
    if (created) {
      onClose()
      navigate(`/pipeline/deals/${created.id}`)
    }
  }

  return (
    <Modal open onClose={onClose} title="New Deal">
      <div className="space-y-3">
        <div>
          <label className="label">Project name *</label>
          <input className="input" autoFocus value={form.projectName}
            onChange={(e) => set('projectName', e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSave()}
            placeholder="Desert Spot" />
        </div>
        <div>
          <label className="label">Client company *</label>
          <input className="input" list="pipeline-clients" value={form.clientCompany}
            onChange={(e) => set('clientCompany', e.target.value)}
            placeholder="Cascade Media" />
          <datalist id="pipeline-clients">
            {knownClients.map((c) => <option key={c} value={c} />)}
          </datalist>
        </div>

        {/* Known client → their history surfaces inline, right now. */}
        {isKnownClient && (
          <div>
            <p className="hud-label mb-1.5">HISTORY WITH {form.clientCompany.trim().toUpperCase()}</p>
            <ClientHistoryList company={form.clientCompany} compact />
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Contact</label>
            <input className="input" value={form.clientContact}
              onChange={(e) => set('clientContact', e.target.value)} placeholder="Name" />
          </div>
          <div>
            <label className="label">Email / phone</label>
            <input className="input" value={form.clientEmail}
              onChange={(e) => set('clientEmail', e.target.value)} placeholder="email@client.com" />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Venue * <span className="text-orbital-dim normal-case">(picks the quote template)</span></label>
            <div className="flex gap-1.5">
              {[['tvc', 'TVC'], ['mobile', 'In Orbit (Mobile)']].map(([v, label]) => (
                <button key={v} type="button"
                  onClick={() => set('venue', v)}
                  className={form.venue === v ? 'btn-primary flex-1 justify-center' : 'btn-secondary flex-1 justify-center'}>
                  {label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="label">Intake mode</label>
            <select className="input" value={form.intakeMode} onChange={(e) => set('intakeMode', e.target.value)}>
              <option value="standard">Standard</option>
              <option value="budget_first">Budget-First</option>
              <option value="comparison_bid">Comparison-Bid</option>
            </select>
          </div>
        </div>

        {form.venue === 'mobile' && (
          <div>
            <label className="label">Location</label>
            <input className="input" value={form.mobileLocation}
              onChange={(e) => set('mobileLocation', e.target.value)}
              placeholder="Cinespace Chicago" />
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Start date</label>
            <input type="date" className="input" value={form.startDate}
              onChange={(e) => set('startDate', e.target.value)} />
          </div>
          <div>
            <label className="label">Asset class</label>
            <select className="input" value={form.assetClass} onChange={(e) => set('assetClass', e.target.value)}>
              <option value="">—</option>
              <option value="2D">2D</option>
              <option value="2.5D">2.5D</option>
              <option value="3D">3D</option>
              <option value="3D+tracking">3D + tracking</option>
            </select>
          </div>
        </div>

        <div>
          <label className="label">Days — travel / build / shoot / strike</label>
          <div className="grid grid-cols-4 gap-2">
            {['travel', 'build', 'shoot', 'strike'].map((k) => (
              <div key={k}>
                <input type="number" min="0" className="input text-center" value={form.days[k]}
                  onChange={(e) => setDay(k, e.target.value)} />
                <p className="text-[10px] text-orbital-dim text-center mt-0.5 capitalize">{k}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-1">
          <button onClick={onClose} className="btn-secondary">Cancel</button>
          <button onClick={handleSave} disabled={!canSave || saving} className="btn-primary">
            {saving ? 'Creating…' : 'Create deal'}
          </button>
        </div>
      </div>
    </Modal>
  )
}
