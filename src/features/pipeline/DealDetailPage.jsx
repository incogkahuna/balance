import { useMemo, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import {
  ArrowLeft, Plus, FileText, Trash2, AlertTriangle, Calendar,
  StickyNote, Film, ShieldCheck,
} from 'lucide-react'
import { usePipeline, STATUS_ORDER, STATUS_LABELS, STATUS_COLORS } from './PipelineContext.jsx'
import {
  DealStatusBadge, VenueChip, ModeChip, ClientHistoryList, GateDot, fmtDate,
} from './components.jsx'
import { computeTotals, fmtMoney, fmtMoneyShort, quoteIsExpired, quoteExpiryDate } from './quoteMath.js'
import { ConfirmDialog } from '../../components/ui/ConfirmDialog.jsx'
import { Modal } from '../../components/ui/Modal.jsx'

// ─────────────────────────────────────────────────────────────────────────────
// DealDetailPage — one deal, everything about it, role-scoped.
// Status changes are ONE CLICK from here (never a separate ritual) — the
// yellow-lit / green-lit triggers ride them. Admin roles additionally see the
// numbers panel and quotes; production/pipeline roles simply have no money in
// their data.
// ─────────────────────────────────────────────────────────────────────────────

export function DealDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const {
    ready, deals, money, quotes, handoffs, canSeeMoney, isAdmin,
    setDealStatus, patchDeal, removeDeal, addDealNote, setDealMoney,
    addQuote, markQuoteSent, markQuoteAccepted, removeQuote,
    patchHandoff, rateCardByVersion,
  } = usePipeline()

  const deal = deals.find((d) => d.id === id)
  const dealMoney = money[id]
  const dealQuotes = useMemo(() => quotes.filter((q) => q.dealId === id), [quotes, id])
  const handoff = handoffs.find((h) => h.dealId === id)

  const [noteText, setNoteText] = useState('')
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deadOpen, setDeadOpen] = useState(false)
  const [lostReason, setLostReason] = useState('')

  if (!ready) {
    return <div className="max-w-5xl mx-auto px-4 py-10 text-center">
      <p className="font-telemetry text-[9px] tracking-[0.2em] text-orbital-subtle">LOADING</p>
    </div>
  }
  if (!deal) {
    return <div className="max-w-5xl mx-auto px-4 py-10 text-center">
      <p className="text-sm text-orbital-subtle">Deal not found.</p>
      <Link to="/pipeline" className="btn-secondary inline-flex mt-3">Back to pipeline</Link>
    </div>
  }

  const handleNewQuote = async () => {
    const title = deal.intakeMode === 'comparison_bid'
      ? `Variant ${dealQuotes.length + 1}`
      : dealQuotes.length ? `Quote v${dealQuotes.length + 1}` : 'Quote'
    const q = await addQuote(deal, title)
    if (q) navigate(`/pipeline/quotes/${q.id}`)
  }

  const handleAddNote = () => {
    if (!noteText.trim()) return
    addDealNote(deal.id, noteText)
    setNoteText('')
  }

  return (
    <div className="max-w-6xl mx-auto px-3 sm:px-4 lg:px-6 py-5">
      {/* ── Header ── */}
      <button onClick={() => navigate('/pipeline')} className="flex items-center gap-1 text-xs text-orbital-subtle hover:text-orbital-text mb-3">
        <ArrowLeft size={13} /> Pipeline
      </button>
      <div className="flex items-start justify-between gap-3 mb-1">
        <div className="min-w-0">
          <p className="hud-label mb-1">DEAL</p>
          <h1 className="text-xl sm:text-2xl font-semibold text-orbital-text tracking-tight truncate">
            {deal.clientCompany} <span className="text-orbital-dim font-normal">/</span> {deal.projectName}
          </h1>
          <div className="flex items-center gap-2 mt-1.5 flex-wrap">
            <VenueChip venue={deal.venue} location={deal.mobileLocation} />
            <ModeChip mode={deal.intakeMode} />
            {deal.assetClass && <span className="text-[11px] text-orbital-dim">{deal.assetClass}</span>}
            <DealStatusBadge status={deal.status} />
          </div>
        </div>
        {isAdmin && (
          <button onClick={() => setConfirmDelete(true)} className="btn-ghost text-red-400 flex-shrink-0" title="Delete deal">
            <Trash2 size={14} />
          </button>
        )}
      </div>

      {/* ── Status ladder — one click, triggers ride it ── */}
      {isAdmin && (
        <div className="flex items-center gap-1.5 mt-3 mb-5 flex-wrap">
          {STATUS_ORDER.map((s) => {
            const activeIdx = STATUS_ORDER.indexOf(deal.status)
            const idx = STATUS_ORDER.indexOf(s)
            const isCurrent = deal.status === s
            const reached = activeIdx >= idx && deal.status !== 'dead'
            return (
              <button key={s}
                onClick={() => !isCurrent && setDealStatus(deal.id, s)}
                className="px-2.5 py-1.5 text-[12px] font-medium transition-colors rounded-sm"
                style={{
                  color: reached ? STATUS_COLORS[s] : 'var(--orbital-dim)',
                  background: isCurrent ? `${STATUS_COLORS[s]}1a` : 'transparent',
                  border: `1px solid ${isCurrent ? STATUS_COLORS[s] : 'var(--orbital-border)'}`,
                }}>
                {STATUS_LABELS[s]}
                {s === 'agreement' && <span className="text-[9px] ml-1 opacity-70">YELLOW-LIT</span>}
                {s === 'green_light' && <span className="text-[9px] ml-1 opacity-70">GREEN-LIT</span>}
              </button>
            )
          })}
          <button
            onClick={() => setDeadOpen(true)}
            className="px-2.5 py-1.5 text-[12px] font-medium rounded-sm"
            style={{
              color: deal.status === 'dead' ? '#f87171' : 'var(--orbital-dim)',
              border: `1px solid ${deal.status === 'dead' ? '#f87171' : 'var(--orbital-border)'}`,
            }}>
            Dead
          </button>
          {deal.status === 'dead' && deal.lostReason && (
            <span className="text-[11px] text-orbital-dim">— {deal.lostReason}</span>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* ── Left: overview + notes + history ── */}
        <div className="lg:col-span-1 space-y-4">
          <div className="card-elevated p-4">
            <p className="hud-label mb-2.5">OVERVIEW</p>
            <dl className="space-y-1.5 text-[13px]">
              <Row k="Contact" v={deal.clientContact || '—'} />
              <Row k="Email" v={deal.clientEmail || '—'} />
              <Row k="Phone" v={deal.clientPhone || '—'} />
              <Row k="Dates" v={`${fmtDate(deal.startDate)}${deal.endDate ? ` → ${fmtDate(deal.endDate)}` : ''}`} />
              <Row k="Days" v={
                ['travel', 'build', 'shoot', 'strike']
                  .map((k) => `${deal.days?.[k] ?? 0}${k[0].toUpperCase()}`)
                  .join(' · ')
              } />
              <Row k="Created" v={fmtDate(deal.createdAt)} />
            </dl>
            {isAdmin && (
              <DaysEditor deal={deal} patchDeal={patchDeal} />
            )}
          </div>

          {/* Notes — Brian's paper-scrap replacement. Fast, timestamped. */}
          <div className="card-elevated p-4">
            <p className="hud-label mb-2.5 flex items-center gap-1.5"><StickyNote size={11} /> NOTES</p>
            {isAdmin && (
              <div className="flex gap-1.5 mb-3">
                <input className="input text-[13px]" placeholder="Call notes, decisions, context…"
                  value={noteText}
                  onChange={(e) => setNoteText(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleAddNote()} />
                <button onClick={handleAddNote} className="btn-secondary flex-shrink-0"><Plus size={14} /></button>
              </div>
            )}
            {(deal.notes || []).length === 0 ? (
              <p className="text-xs text-orbital-dim">No notes yet.</p>
            ) : (
              <div className="space-y-2 max-h-72 overflow-y-auto">
                {deal.notes.map((n) => (
                  <div key={n.id} className="text-[12px]">
                    <p className="text-orbital-text">{n.text}</p>
                    <p className="text-[10px] text-orbital-dim mt-0.5">
                      {n.by ? `${n.by} · ` : ''}{fmtDate(n.at)}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="card-elevated p-4">
            <p className="hud-label mb-2.5">CLIENT HISTORY — {deal.clientCompany.toUpperCase()}</p>
            <ClientHistoryList company={deal.clientCompany} excludeDealId={deal.id} />
            {!deals.some((d) => d.id !== deal.id && d.clientCompany.toLowerCase() === deal.clientCompany.toLowerCase()) && (
              <p className="text-xs text-orbital-dim">First deal with this client.</p>
            )}
          </div>
        </div>

        {/* ── Right: numbers + quotes (admin) + handoff (all roles) ── */}
        <div className="lg:col-span-2 space-y-4">
          {canSeeMoney && (
            <NumbersCard deal={deal} money={dealMoney} setDealMoney={setDealMoney} />
          )}

          {isAdmin && (
            <div className="card-elevated p-4">
              <div className="flex items-center justify-between mb-2.5">
                <p className="hud-label flex items-center gap-1.5"><FileText size={11} /> QUOTES</p>
                <button onClick={handleNewQuote} className="btn-secondary text-xs">
                  <Plus size={13} /> {deal.intakeMode === 'comparison_bid' ? 'New variant' : 'New quote'}
                </button>
              </div>
              {dealQuotes.length === 0 ? (
                <p className="text-xs text-orbital-dim">
                  No quotes — {deal.intakeMode === 'budget_first'
                    ? 'budget-first deals can go straight to Agreement without one.'
                    : 'create one to start building from the rate card.'}
                </p>
              ) : (
                <div className="space-y-2">
                  {dealQuotes.map((q) => (
                    <QuoteRow key={q.id} quote={q}
                      card={rateCardByVersion(q.rateCardVersion)}
                      onOpen={() => navigate(`/pipeline/quotes/${q.id}`)}
                      onSend={() => markQuoteSent(q)}
                      onAccept={() => markQuoteAccepted(q)}
                      onDelete={() => removeQuote(q.id)} />
                  ))}
                </div>
              )}
            </div>
          )}

          {handoff ? (
            <HandoffCard handoff={handoff} deal={deal} patchHandoff={patchHandoff} isAdmin={isAdmin} />
          ) : (
            <div className="card-elevated p-4">
              <p className="hud-label mb-2 flex items-center gap-1.5"><Film size={11} /> PRODUCTION</p>
              <p className="text-xs text-orbital-dim">
                Moving this deal to <span className="text-yellow-500">Agreement</span> auto-creates the
                production record for Mark — client, dates, crew, and tech specs, nothing re-typed.
              </p>
            </div>
          )}
        </div>
      </div>

      <ConfirmDialog
        open={confirmDelete}
        title="Delete this deal?"
        message={`"${deal.clientCompany} / ${deal.projectName}" and its quotes will be removed.`}
        confirmLabel="Delete"
        danger
        onConfirm={() => { removeDeal(deal.id); navigate('/pipeline') }}
        onClose={() => setConfirmDelete(false)}
      />

      <Modal open={deadOpen} onClose={() => setDeadOpen(false)} title="Mark deal dead" size="sm">
        <div className="space-y-3">
          <div>
            <label className="label">Lost reason (optional)</label>
            <input className="input" value={lostReason} onChange={(e) => setLostReason(e.target.value)}
              placeholder="Went with a greenscreen house on price" autoFocus />
          </div>
          <div className="flex justify-end gap-2">
            <button className="btn-secondary" onClick={() => setDeadOpen(false)}>Cancel</button>
            <button className="btn-danger" onClick={() => {
              setDealStatus(deal.id, 'dead', { lostReason })
              setDeadOpen(false)
            }}>Mark dead</button>
          </div>
        </div>
      </Modal>
    </div>
  )
}

function Row({ k, v }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="text-orbital-dim flex-shrink-0">{k}</dt>
      <dd className="text-orbital-text text-right truncate">{v}</dd>
    </div>
  )
}

function DaysEditor({ deal, patchDeal }) {
  const [editing, setEditing] = useState(false)
  const [days, setDays] = useState(deal.days || { travel: 0, build: 0, shoot: 0, strike: 0 })
  const [startDate, setStartDate] = useState(deal.startDate || '')
  if (!editing) {
    return (
      <button className="btn-ghost text-xs mt-2 px-0" onClick={() => {
        setDays(deal.days || { travel: 0, build: 0, shoot: 0, strike: 0 })
        setStartDate(deal.startDate || '')
        setEditing(true)
      }}>
        Edit dates & days
      </button>
    )
  }
  return (
    <div className="mt-3 pt-3" style={{ borderTop: '1px solid var(--orbital-border)' }}>
      <label className="label">Start date</label>
      <input type="date" className="input mb-2" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
      <div className="grid grid-cols-4 gap-1.5">
        {['travel', 'build', 'shoot', 'strike'].map((k) => (
          <div key={k}>
            <input type="number" min="0" className="input text-center text-[13px]" value={days[k]}
              onChange={(e) => setDays((d) => ({ ...d, [k]: Math.max(0, Number(e.target.value) || 0) }))} />
            <p className="text-[10px] text-orbital-dim text-center mt-0.5 capitalize">{k}</p>
          </div>
        ))}
      </div>
      <div className="flex justify-end gap-1.5 mt-2">
        <button className="btn-ghost text-xs" onClick={() => setEditing(false)}>Cancel</button>
        <button className="btn-secondary text-xs" onClick={() => {
          patchDeal(deal.id, { days, startDate: startDate || null })
          setEditing(false)
        }}>Save</button>
      </div>
    </div>
  )
}

// The three number states — quoted / agreed / actual. The sent quote and the
// real deal diverge immediately; this is where the real numbers live.
function NumbersCard({ deal, money, setDealMoney }) {
  const m = money || {}
  const [agreed, setAgreed] = useState(null)   // null = not editing
  const [actual, setActual] = useState(null)

  const numInput = (val, setVal, saved, field) => (
    <input
      type="number"
      className="input text-right font-telemetry"
      placeholder="—"
      value={val !== null ? val : (saved ?? '')}
      onChange={(e) => setVal(e.target.value)}
      onBlur={() => {
        if (val === null) return
        const n = val === '' ? null : Number(val)
        setDealMoney(deal.id, { [field]: Number.isNaN(n) ? null : n })
        setVal(null)
      }}
    />
  )

  const delta = m.quotedTotal != null && m.agreedTotal != null && m.quotedTotal !== 0
    ? ((m.quotedTotal - m.agreedTotal) / m.quotedTotal) * 100
    : null

  return (
    <div className="card-elevated p-4">
      <p className="hud-label mb-2.5">NUMBERS — QUOTED / AGREED / ACTUAL</p>
      <div className="grid grid-cols-3 gap-3">
        <div>
          <label className="label">Quoted</label>
          <p className="font-telemetry text-[15px] text-orbital-text py-1.5">
            {m.quotedTotal != null ? fmtMoneyShort(m.quotedTotal) : '—'}
          </p>
          <p className="text-[10px] text-orbital-dim">from the sent quote</p>
        </div>
        <div>
          <label className="label">Agreed</label>
          {numInput(agreed, setAgreed, m.agreedTotal, 'agreedTotal')}
          {delta != null && (
            <p className="text-[10px] mt-0.5" style={{ color: delta > 0 ? '#f59e0b' : '#22c55e' }}>
              {delta > 0 ? `−${delta.toFixed(1)}% off quoted` : delta < 0 ? `+${(-delta).toFixed(1)}% over quoted` : 'at quoted'}
            </p>
          )}
        </div>
        <div>
          <label className="label">Actual</label>
          {numInput(actual, setActual, m.actualTotal, 'actualTotal')}
          <p className="text-[10px] text-orbital-dim mt-0.5">what it became on the floor</p>
        </div>
      </div>
      <div className="flex items-center gap-2 mt-3 pt-3" style={{ borderTop: '1px solid var(--orbital-border)' }}>
        <span className="text-xs text-orbital-subtle">Paid?</span>
        {[[true, 'Yes'], [false, 'No'], [null, '—']].map(([v, label]) => (
          <button key={String(v)}
            onClick={() => setDealMoney(deal.id, { paid: v })}
            className="px-2 py-0.5 text-[11px] font-medium rounded-sm"
            style={{
              color: m.paid === v ? (v === true ? '#22c55e' : v === false ? '#f87171' : 'var(--orbital-subtle)') : 'var(--orbital-dim)',
              border: `1px solid ${m.paid === v ? 'currentColor' : 'var(--orbital-border)'}`,
            }}>
            {label}
          </button>
        ))}
      </div>
    </div>
  )
}

function QuoteRow({ quote, card, onOpen, onSend, onAccept, onDelete }) {
  const totals = computeTotals(card, quote)
  const expired = quote.status === 'sent' && quoteIsExpired(quote.issuedAt)
  const statusColor = {
    draft: 'var(--orbital-dim)', sent: '#8b5cf6', accepted: '#22c55e', superseded: 'var(--orbital-dim)',
  }[quote.status]
  return (
    <div className="flex items-center justify-between gap-2 px-3 py-2 rounded-sm"
      style={{ border: '1px solid var(--orbital-border)' }}>
      <button onClick={onOpen} className="min-w-0 text-left flex-1">
        <p className="text-[13px] font-medium text-orbital-text truncate">
          {quote.title}
          <span className="font-telemetry text-[10px] text-orbital-dim ml-2">v{quote.rateCardVersion} card</span>
        </p>
        <p className="text-[11px] mt-0.5">
          <span style={{ color: statusColor }} className="font-medium uppercase">{quote.status}</span>
          <span className="text-orbital-dim"> · issued {fmtDate(quote.issuedAt)}</span>
          {expired && (
            <span className="text-amber-500"> · EXPIRED {fmtDate(quoteExpiryDate(quote.issuedAt))}</span>
          )}
          {quote.discount?.value ? (
            <span className="text-orbital-subtle"> · {quote.discount.label}</span>
          ) : null}
        </p>
      </button>
      <div className="text-right flex-shrink-0">
        <p className="font-telemetry text-[13px] text-orbital-text">{fmtMoney(totals.total)}</p>
        <div className="flex items-center gap-1 justify-end mt-0.5">
          {quote.status === 'draft' && (
            <button onClick={onSend} className="text-[11px] text-blue-400 hover:underline">Mark sent</button>
          )}
          {quote.status === 'sent' && (
            <button onClick={onAccept} className="text-[11px] text-green-500 hover:underline">Accepted</button>
          )}
          {quote.status === 'draft' && (
            <button onClick={onDelete} className="text-[11px] text-orbital-dim hover:text-red-400 ml-1">Delete</button>
          )}
        </div>
      </div>
    </div>
  )
}

// ── The handoff — Mark's surface. Summary, crew, tech spec, gates, schedule.
// Zero money anywhere in this card (there is none in the underlying data).
function HandoffCard({ handoff, deal, patchHandoff, isAdmin }) {
  const gates = handoff.gates || {}
  const kickoff = handoff.handoff || {}
  const scoutBlocked = !gates.deposit || !gates.coi

  const toggleGate = (key) => patchHandoff(handoff.id, { gates: { ...gates, [key]: !gates[key] } })
  const toggleKickoff = (key) => patchHandoff(handoff.id, { handoff: { ...kickoff, [key]: !kickoff[key] } })

  const GATE_ITEMS = [
    ['deposit', 'Deposit received'],
    ['coi', 'COI received'],
    ['agreementSent', 'Fully executed agreement sent'],
    ['firstInvoiceSent', 'First invoice sent'],
    ['w9Sent', 'W9 sent'],
    ['rentalDueBeforePrelight', 'Full rental due before pre-light'],
  ]
  const KICKOFF_ITEMS = [
    ['markIntro', "Mark intro'd to client"],
    ['kickoffCall', 'Kickoff call scheduled'],
    ['creativeReceived', 'Creative received'],
  ]

  return (
    <div className="card-elevated p-4">
      <div className="flex items-center justify-between mb-2.5">
        <p className="hud-label flex items-center gap-1.5"><Film size={11} /> PRODUCTION</p>
        <span className="text-[11px] font-medium uppercase"
          style={{ color: handoff.state === 'active' ? '#22c55e' : '#eab308' }}>
          {handoff.state === 'active' ? 'ACTIVE' : 'PENDING — planning only'}
        </span>
      </div>

      {/* The three sentences */}
      <p className="text-[13px] text-orbital-text leading-relaxed mb-3">{handoff.summary}</p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <p className="hud-label mb-1.5">CREW</p>
          {(handoff.crew || []).length === 0 ? (
            <p className="text-xs text-orbital-dim">Derived when a quote exists.</p>
          ) : (
            <ul className="space-y-1">
              {handoff.crew.map((c, i) => (
                <li key={i} className="text-[12px] text-orbital-text">
                  {c.role} <span className="text-orbital-dim">· {c.source}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div>
          <p className="hud-label mb-1.5">TECH SPEC</p>
          <dl className="space-y-1 text-[12px]">
            <Row k="Frame rate" v={handoff.techSpec?.frameRate || '—'} />
            <Row k="Tracking" v={handoff.techSpec?.tracking ? 'Yes' : 'No'} />
            <Row k="Pre-light" v={handoff.techSpec?.preLight ? 'Yes' : 'No'} />
            <Row k="Wall" v={(handoff.techSpec?.wallConfig || []).join(', ') || '—'} />
            <Row k="Asset class" v={handoff.techSpec?.assetClass || '—'} />
          </dl>
          {(handoff.techSpec?.flags || []).map((f, i) => (
            <p key={i} className="flex items-start gap-1 mt-1.5 text-[11px] text-amber-500">
              <AlertTriangle size={11} className="mt-0.5 flex-shrink-0" /> {f}
            </p>
          ))}
        </div>
      </div>

      {/* Gates — deposit + COI hard-gate the tech scout */}
      <div className="mt-4 pt-3" style={{ borderTop: '1px solid var(--orbital-border)' }}>
        <p className="hud-label mb-1.5 flex items-center gap-1.5"><ShieldCheck size={11} /> GATES</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-1">
          {GATE_ITEMS.map(([key, label]) => (
            <button key={key} onClick={() => toggleGate(key)}
              className="flex items-center gap-2 py-1 text-[12px] text-left text-orbital-text hover:text-orbital-text">
              <GateDot ok={!!gates[key]} /> {label}
            </button>
          ))}
        </div>
        <p className="mt-1.5 text-[11px]" style={{ color: scoutBlocked ? '#f87171' : '#22c55e' }}>
          {scoutBlocked
            ? 'TECH SCOUT BLOCKED — deposit + COI required before anyone sets foot on stage.'
            : 'Tech scout unlocked — deposit + COI are in.'}
        </p>
      </div>

      {/* Kickoff container — auto-created; the intros stay human */}
      <div className="mt-3 pt-3" style={{ borderTop: '1px solid var(--orbital-border)' }}>
        <p className="hud-label mb-1.5">KICKOFF</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-1">
          {KICKOFF_ITEMS.map(([key, label]) => (
            <button key={key} onClick={() => toggleKickoff(key)}
              className="flex items-center gap-2 py-1 text-[12px] text-left text-orbital-text">
              <GateDot ok={!!kickoff[key]} /> {label}
            </button>
          ))}
        </div>
        <p className="text-[11px] text-orbital-dim mt-1">Creative deck slot: {kickoff.creativeDeck ? 'attached' : 'empty'}.</p>
      </div>

      {/* Calendar blocks (green-lit) */}
      {(handoff.schedule || []).length > 0 && (
        <div className="mt-3 pt-3" style={{ borderTop: '1px solid var(--orbital-border)' }}>
          <p className="hud-label mb-1.5 flex items-center gap-1.5"><Calendar size={11} /> CALENDAR HOLDS</p>
          <div className="space-y-0.5 max-h-44 overflow-y-auto">
            {handoff.schedule.map((b, i) => (
              <p key={i} className="text-[12px] text-orbital-text">
                <span className="font-telemetry text-orbital-subtle">{fmtDate(b.date)}</span>
                <span className="text-orbital-dim"> · {b.dayType} · </span>
                9:00–9:00 <span className="text-orbital-dim">(TBA — times to be adjusted)</span>
              </p>
            ))}
          </div>
          <p className="text-[11px] text-orbital-dim mt-1">
            Full-day holds — the day is taken; no tours get booked on top.
          </p>
        </div>
      )}

      {handoff.productionId && (
        <Link to={`/productions/${handoff.productionId}`} className="btn-secondary text-xs inline-flex mt-3">
          Open production record
        </Link>
      )}
    </div>
  )
}
