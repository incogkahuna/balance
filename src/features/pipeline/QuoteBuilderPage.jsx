import { useMemo, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { ArrowLeft, AlertTriangle, Eye, Send, Lock, Sparkles } from 'lucide-react'
import { usePipeline } from './PipelineContext.jsx'
import { fmtDate, PipelineNoAccess } from './components.jsx'
import {
  resolveRate, proposedQty, lineSubtotal, computeTotals, resolveDependencies,
  dependencyViolations, activeFlags, internalFloor, fmtMoney,
  quoteExpiryDate, discountIsValid,
} from './quoteMath.js'
import { useToast } from '../../context/ToastContext.jsx'
import { Modal } from '../../components/ui/Modal.jsx'

// ─────────────────────────────────────────────────────────────────────────────
// QuoteBuilderPage — the INTERNAL build view. Master menu with toggles
// (QTY × X × Rate = SubTotal, inactive lines visible at $0), venue template
// picked by the deal, Big Dipper preset, day-driven quantities (the app
// proposes, Brian disposes), live dependency rules, discount block, internal
// floor annotations. The client-facing render lives at /pipeline/quotes/:id/pdf.
// ─────────────────────────────────────────────────────────────────────────────

export function QuoteBuilderPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const toast = useToast()
  const {
    ready, isAdmin, pipelineRole, quotes, deals, patchQuote, markQuoteSent, markQuoteAccepted,
    rateCardByVersion,
  } = usePipeline()

  const quote = quotes.find((q) => q.id === id)
  const deal = quote ? deals.find((d) => d.id === quote.dealId) : null
  const card = quote ? rateCardByVersion(quote.rateCardVersion) : null

  const [assetPrompt, setAssetPrompt] = useState(null) // lineId pending asset count
  const [trackingPrompt, setTrackingPrompt] = useState(false)

  const totals = useMemo(() => (card && quote ? computeTotals(card, quote) : null), [card, quote])
  const violations = useMemo(() => (card && quote ? dependencyViolations(card, quote) : []), [card, quote])
  const flags = useMemo(() => (card && quote ? activeFlags(card, quote) : []), [card, quote])
  const floors = useMemo(() => (card && quote ? internalFloor(card, quote) : []), [card, quote])

  if (!pipelineRole) return <PipelineNoAccess />
  if (!ready) return <Center>LOADING</Center>
  if (!isAdmin) return <Center>Quotes are visible to admin roles only.</Center>
  if (!quote || !deal || !card) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-10 text-center">
        <p className="text-sm text-orbital-subtle">Quote not found.</p>
        <Link to="/pipeline" className="btn-secondary inline-flex mt-3">Back to pipeline</Link>
      </div>
    )
  }

  const template = card.templates[quote.venue]
  const locked = quote.status === 'accepted' || quote.status === 'superseded'

  // ── line mutation helpers — deltas only, persisted through patchQuote ──────
  // All of these use the FUNCTIONAL patch form so consecutive toggles compose
  // against the latest quote state instead of a stale render snapshot.
  const setLine = (lineId, patch) => {
    patchQuote(quote.id, (q) => ({
      lines: { ...q.lines, [lineId]: { ...(q.lines[lineId] || { x: 0, qty: 1 }), ...patch } },
    }))
  }

  const toggleLine = (lineId) => {
    if (locked) return
    const line = card.lines[lineId]
    const prev = quote.lines[lineId]
    if (prev?.x) {
      setLine(lineId, { x: 0 })
      return
    }
    // Per-asset lines ask for the count before activating.
    if (line.perAsset && !prev?.qty) {
      setAssetPrompt(lineId)
      return
    }
    activateLine(lineId)
  }

  const activateLine = (lineId, qtyOverride) => {
    const line = card.lines[lineId]
    let notes = []
    patchQuote(quote.id, (q) => {
      const dep = resolveDependencies(card, q, lineId)
      notes = dep.notes
      const proposed = qtyOverride ?? q.lines[lineId]?.qty ?? proposedQty(line, q.days) ?? 1
      const nextLines = { ...q.lines, ...dep.adds }
      nextLines[lineId] = { ...(nextLines[lineId] || {}), x: 1, qty: proposed }
      return { lines: nextLines }
    })
    for (const n of notes) toast.info(n)
  }

  // Big Dipper preset: one choice replaces six toggles; tracking is a question.
  const applyBigDipper = () => {
    const preset = card.presets?.bigDipper
    if (!preset) return
    patchQuote(quote.id, (q) => {
      const nextLines = { ...q.lines }
      for (const lid of preset.activates) {
        const line = card.lines[lid]
        nextLines[lid] = {
          ...(nextLines[lid] || {}),
          x: 1,
          qty: nextLines[lid]?.qtyManual ? nextLines[lid].qty : (proposedQty(line, q.days) ?? 1),
        }
      }
      return { lines: nextLines }
    })
    setTrackingPrompt(true)
  }

  // Day header edits re-propose quantities for active auto lines that Brian
  // hasn't manually overridden (qtyManual flag).
  const setDays = (k, v) => {
    patchQuote(quote.id, (q) => {
      const days = { ...q.days, [k]: Math.max(0, Number(v) || 0) }
      const lines = { ...q.lines }
      for (const [lid, ql] of Object.entries(lines)) {
        if (!ql?.x || ql.qtyManual) continue
        const p = proposedQty(card.lines[lid], days)
        if (p != null) lines[lid] = { ...ql, qty: p }
      }
      return { days, lines }
    })
  }

  const discount = quote.discount || { mode: 'percent', value: 0, label: '', reason: '', display: 'subtract' }
  const setDiscount = (patch) => patchQuote(quote.id, (q) => ({
    discount: { ...(q.discount || { mode: 'percent', value: 0, label: '', reason: '', display: 'subtract' }), ...patch },
  }))

  const handleSend = () => {
    if (!discountIsValid(quote.discount)) {
      toast.error('Discount needs a label — that label prints on the PDF and is what stops precedent-creep.')
      return
    }
    if (markQuoteSent(quote)) toast.success('Quote marked sent — deal advanced.')
  }

  return (
    <div className="max-w-5xl mx-auto px-3 sm:px-4 lg:px-6 py-5">
      {/* ── Header ── */}
      <button onClick={() => navigate(`/pipeline/deals/${deal.id}`)}
        className="flex items-center gap-1 text-xs text-orbital-subtle hover:text-orbital-text mb-3">
        <ArrowLeft size={13} /> {deal.clientCompany} / {deal.projectName}
      </button>
      <div className="flex items-start justify-between gap-3 mb-4 flex-wrap">
        <div className="min-w-0">
          <p className="hud-label mb-1">QUOTE BUILD — {template.title.toUpperCase()}</p>
          <input
            className="text-xl font-semibold text-orbital-text tracking-tight bg-transparent border-none outline-none w-full"
            value={quote.title}
            disabled={locked}
            onChange={(e) => patchQuote(quote.id, { title: e.target.value })}
          />
          <p className="text-[11px] text-orbital-dim mt-0.5">
            Rate card v{quote.rateCardVersion} · issued {fmtDate(quote.issuedAt)} ·
            good for 30 business days (expires {fmtDate(quoteExpiryDate(quote.issuedAt))}) ·
            status <span className="uppercase font-medium text-orbital-subtle">{quote.status}</span>
            {locked && <Lock size={10} className="inline ml-1" />}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <Link to={`/pipeline/quotes/${quote.id}/pdf`} className="btn-secondary text-xs">
            <Eye size={13} /> Client PDF
          </Link>
          {quote.status === 'draft' && (
            <button onClick={handleSend} disabled={violations.length > 0} className="btn-primary text-xs"
              title={violations.length ? violations[0].message : 'Mark sent'}>
              <Send size={13} /> Mark sent
            </button>
          )}
          {quote.status === 'sent' && (
            <button onClick={() => markQuoteAccepted(quote)} className="btn-primary text-xs">
              Accepted
            </button>
          )}
        </div>
      </div>

      {/* ── Violations / flags ── */}
      {violations.length > 0 && (
        <div className="mb-3 px-3 py-2 rounded-sm text-[12px] text-red-400"
          style={{ border: '1px solid rgba(239,68,68,0.4)', background: 'rgba(239,68,68,0.06)' }}>
          {violations.map((v, i) => <p key={i} className="flex items-center gap-1.5"><AlertTriangle size={12} />{v.message}</p>)}
          <p className="text-[11px] text-orbital-dim mt-0.5">This quote can't be sent until these are resolved.</p>
        </div>
      )}
      {flags.length > 0 && (
        <div className="mb-3 px-3 py-2 rounded-sm text-[12px] text-amber-500"
          style={{ border: '1px solid rgba(245,158,11,0.35)', background: 'rgba(245,158,11,0.05)' }}>
          {flags.map((f, i) => <p key={i} className="flex items-center gap-1.5"><AlertTriangle size={12} />{f.message}</p>)}
        </div>
      )}

      {/* ── DAYS header — drives quantities, always overridable ── */}
      <div className="card-elevated p-3 mb-4 flex items-center gap-3 flex-wrap">
        <p className="hud-label">DAYS</p>
        {['travel', 'build', 'shoot', 'strike'].map((k) => (
          <label key={k} className="flex items-center gap-1.5 text-[12px] text-orbital-subtle capitalize">
            {k}
            <input type="number" min="0" disabled={locked}
              className="input w-16 text-center py-1"
              value={quote.days?.[k] ?? 0}
              onChange={(e) => setDays(k, e.target.value)} />
          </label>
        ))}
        <span className="text-[11px] text-orbital-dim">Counts flow into day-based lines; edit any qty to override.</span>
        {quote.venue === 'tvc' && !locked && (
          <button onClick={applyBigDipper} className="btn-secondary text-xs ml-auto">
            <Sparkles size={13} /> Big Dipper preset
          </button>
        )}
      </div>

      {/* ── Master menu ── */}
      <div className="space-y-4">
        {template.sections.map((section) => (
          <SectionBlock key={section.id}
            section={section} card={card} quote={quote} locked={locked}
            onToggle={toggleLine} onSetLine={setLine}
            sectionTotal={totals.sections.find((s) => s.id === section.id)?.subtotal ?? 0} />
        ))}
      </div>

      {/* ── Discount block ── */}
      <div className="card-elevated p-4 mt-4">
        <p className="hud-label mb-2.5">DISCOUNT — AMOUNT + LABEL (label prints on the PDF)</p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div>
            <label className="label">Type</label>
            <select className="input" disabled={locked} value={discount.mode}
              onChange={(e) => setDiscount({ mode: e.target.value })}>
              <option value="percent">Percent</option>
              <option value="fixed">Fixed $</option>
            </select>
          </div>
          <div>
            <label className="label">{discount.mode === 'percent' ? 'Percent' : 'Amount'}</label>
            <input type="number" min="0" className="input" disabled={locked}
              value={discount.value || ''}
              onChange={(e) => setDiscount({ value: Number(e.target.value) || 0 })} />
          </div>
          <div>
            <label className="label">Label {discount.value ? '*' : ''}</label>
            <select className="input" disabled={locked} value={discount.label}
              onChange={(e) => setDiscount({ label: e.target.value })}>
              <option value="">—</option>
              {(card.discountLabels || []).map((l) => <option key={l} value={l}>{l}</option>)}
            </select>
            {discount.label === 'Custom' && (
              <input className="input mt-1.5" placeholder="Custom label" disabled={locked}
                value={discount.customLabel || ''}
                onChange={(e) => setDiscount({ customLabel: e.target.value })} />
            )}
          </div>
          <div>
            <label className="label">Display on PDF</label>
            <select className="input" disabled={locked} value={discount.display}
              onChange={(e) => setDiscount({ display: e.target.value })}>
              <option value="subtract">Bottom-line subtraction</option>
              <option value="value_add">Value-add ($0 lines)</option>
            </select>
          </div>
        </div>
        <div className="mt-2">
          <label className="label">Internal reason (never on the PDF)</label>
          <input className="input" disabled={locked} placeholder="Why this discount exists…"
            value={discount.reason || ''}
            onChange={(e) => setDiscount({ reason: e.target.value })} />
        </div>
        {discount.value > 0 && !discountIsValid(quote.discount) && (
          <p className="text-[11px] text-red-400 mt-1.5">A discount without a label becomes invisible precedent — pick one.</p>
        )}
      </div>

      {/* ── Internal floor — Brian's eyes only ── */}
      {floors.length > 0 && (
        <div className="mt-4 px-4 py-3 rounded-sm"
          style={{ border: '1px dashed rgba(245,158,11,0.5)', background: 'rgba(245,158,11,0.04)' }}>
          <p className="hud-label mb-1.5 text-amber-500">INTERNAL FLOOR — NEVER ON THE CLIENT PDF</p>
          {floors.map((f) => (
            <p key={f.lineId} className="text-[12px] text-orbital-text">
              <span className="font-medium">{f.name}:</span>{' '}
              {f.panels && f.perPanel ? `${f.panels} panels × ${fmtMoney(f.perPanel)} = ${fmtMoney(f.panels * f.perPanel)}. ` : ''}
              <span className="text-orbital-subtle">{f.note}</span>
            </p>
          ))}
        </div>
      )}

      {/* ── Totals ── */}
      <div className="card-elevated p-4 mt-4">
        <div className="max-w-sm ml-auto space-y-1 text-[13px]">
          <div className="flex justify-between text-orbital-subtle">
            <span>Subtotal</span><span className="font-telemetry">{fmtMoney(totals.subtotal)}</span>
          </div>
          {totals.discountAmount > 0 && (
            <div className="flex justify-between text-orbital-subtle">
              <span>Discount{discount.label ? ` — ${discount.label === 'Custom' ? (discount.customLabel || 'Custom') : discount.label}` : ''}</span>
              <span className="font-telemetry">−{fmtMoney(totals.discountAmount)}</span>
            </div>
          )}
          <div className="flex justify-between text-orbital-text font-semibold text-[15px] pt-1"
            style={{ borderTop: '1px solid var(--orbital-border)' }}>
            <span>Total</span><span className="font-telemetry">{fmtMoney(totals.total)}</span>
          </div>
        </div>
      </div>

      {/* ── Per-asset prompt (multi-cam optimization) ── */}
      <Modal open={!!assetPrompt} onClose={() => setAssetPrompt(null)} title="How many assets?" size="sm">
        <AssetCountForm
          onSubmit={(n) => {
            activateLine(assetPrompt, n)
            setAssetPrompt(null)
            toast.success(`${card.lines[assetPrompt]?.name}: allow ${n} additional optimization day${n === 1 ? '' : 's'} (1 per asset).`)
          }}
          onCancel={() => setAssetPrompt(null)}
        />
      </Modal>

      {/* ── Big Dipper tracking question — always ask ── */}
      <Modal open={trackingPrompt} onClose={() => setTrackingPrompt(false)} title="Big Dipper stack applied" size="sm">
        <p className="text-sm text-orbital-subtle mb-4">{card.presets?.bigDipper?.optionalPrompt}</p>
        <div className="flex justify-end gap-2">
          <button className="btn-secondary" onClick={() => setTrackingPrompt(false)}>No tracking</button>
          <button className="btn-primary" onClick={() => { activateLine('bd_tracking'); setTrackingPrompt(false) }}>
            Add tracking
          </button>
        </div>
      </Modal>
    </div>
  )
}

function Center({ children }) {
  return (
    <div className="max-w-4xl mx-auto px-4 py-10 text-center">
      <p className="font-telemetry text-[9px] tracking-[0.2em] text-orbital-subtle">{children}</p>
    </div>
  )
}

function AssetCountForm({ onSubmit, onCancel }) {
  const [n, setN] = useState(1)
  return (
    <div className="space-y-3">
      <p className="text-sm text-orbital-subtle">Multi-cam optimization allows 1 additional optimization day per asset.</p>
      <input type="number" min="1" className="input" autoFocus value={n}
        onChange={(e) => setN(Math.max(1, Number(e.target.value) || 1))}
        onKeyDown={(e) => e.key === 'Enter' && onSubmit(n)} />
      <div className="flex justify-end gap-2">
        <button className="btn-secondary" onClick={onCancel}>Cancel</button>
        <button className="btn-primary" onClick={() => onSubmit(n)}>Activate</button>
      </div>
    </div>
  )
}

function SectionBlock({ section, card, quote, locked, onToggle, onSetLine, sectionTotal }) {
  return (
    <div className="card-elevated overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2"
        style={{ background: 'rgba(59,130,246,0.05)', borderBottom: '1px solid var(--orbital-border)' }}>
        <p className="text-[12px] font-semibold text-orbital-text uppercase tracking-wider">{section.title}</p>
        <p className="font-telemetry text-[12px] text-orbital-subtle">{fmtMoney(sectionTotal)}</p>
      </div>
      {section.note && (
        <p className="px-4 pt-2 text-[11px] text-orbital-dim italic">{section.note}</p>
      )}
      <div className="divide-y" style={{ borderColor: 'var(--orbital-border)' }}>
        {section.lines.map((lineId) => (
          <LineRow key={lineId}
            lineId={lineId} line={card.lines[lineId]} quote={quote} locked={locked}
            onToggle={onToggle} onSetLine={onSetLine} />
        ))}
      </div>
    </div>
  )
}

function LineRow({ lineId, line, quote, locked, onToggle, onSetLine }) {
  if (!line) return null
  const ql = quote.lines[lineId]
  const active = !!ql?.x
  const rate = resolveRate(line, quote.venue, ql)
  const sub = lineSubtotal(line, quote.venue, ql)
  const editableRate = line.priceMode === 'manual' || line.priceMode === 'range' || ql?.rateOverride != null
  const isIncl = line.unit === 'Incl'

  return (
    <div className={`px-4 py-2 ${active ? '' : 'opacity-60'}`}
      style={active ? { background: 'rgba(34,197,94,0.03)' } : undefined}>
      <div className="flex items-center gap-3">
        {/* X toggle */}
        <button
          onClick={() => onToggle(lineId)}
          disabled={locked || isIncl}
          className="flex-shrink-0 w-8 h-6 text-[12px] font-telemetry font-semibold rounded-sm transition-colors"
          style={{
            color: active ? '#22c55e' : 'var(--orbital-dim)',
            border: `1px solid ${active ? '#22c55e' : 'var(--orbital-border)'}`,
            background: active ? 'rgba(34,197,94,0.08)' : 'transparent',
          }}
          title={active ? 'Deactivate (stays on menu at $0)' : 'Activate'}>
          {active ? (ql.x > 1 ? `×${ql.x}` : '✓') : '—'}
        </button>

        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-medium text-orbital-text truncate">
            {line.name}
            {line.hours && <span className="text-[10px] text-orbital-dim ml-1.5">({line.hours})</span>}
            {line.internal && <span className="text-[9px] text-amber-500 ml-1.5 font-telemetry">INTERNAL FLOOR ↓</span>}
          </p>
          {line.description && (
            <p className="text-[11px] text-orbital-dim truncate">{line.description}</p>
          )}
          {line.bundle && active && (
            <p className="text-[11px] text-orbital-subtle mt-0.5">
              Includes: {line.bundle.join(' · ')}
            </p>
          )}
        </div>

        {/* QTY */}
        <div className="flex items-center gap-1.5 flex-shrink-0">
          {!isIncl && (
            <input type="number" min="0"
              className="input w-16 text-center py-1 text-[12px]"
              disabled={locked || !active}
              value={ql?.qty ?? ''}
              placeholder="1"
              onChange={(e) => onSetLine(lineId, { qty: Math.max(0, Number(e.target.value) || 0), qtyManual: true })} />
          )}
          <span className="text-[10px] text-orbital-dim w-12">{line.unit}</span>
        </div>

        {/* Rate */}
        <div className="w-24 text-right flex-shrink-0">
          {isIncl ? (
            <span className="text-[11px] text-orbital-dim">Incl</span>
          ) : editableRate ? (
            <input type="number" min="0"
              className="input w-24 text-right py-1 text-[12px] font-telemetry"
              disabled={locked}
              placeholder={line.range ? `${line.range[0]}–${line.range[1]}` : 'manual'}
              value={ql?.rateOverride ?? (line.priceMode === 'manual' ? '' : rate) ?? ''}
              onChange={(e) => onSetLine(lineId, { rateOverride: e.target.value === '' ? null : Number(e.target.value) })} />
          ) : (
            <span className="font-telemetry text-[12px] text-orbital-subtle">{fmtMoney(rate)}</span>
          )}
        </div>

        {/* Subtotal */}
        <p className="w-24 text-right font-telemetry text-[12px] flex-shrink-0"
          style={{ color: active && sub > 0 ? 'var(--orbital-text)' : 'var(--orbital-dim)' }}>
          {fmtMoney(sub)}
        </p>
      </div>

      {/* Spec capture (Genlock frame rate…) */}
      {active && line.spec && (
        <div className="flex items-center gap-2 mt-1.5 ml-11">
          <label className="text-[11px] text-orbital-subtle">{line.spec.label}{line.spec.required ? ' *' : ''}</label>
          <select
            className="input w-28 py-1 text-[12px]"
            disabled={locked}
            value={ql?.spec?.value || ''}
            onChange={(e) => onSetLine(lineId, { spec: { value: e.target.value } })}>
            <option value="">—</option>
            {line.spec.options.map((o) => <option key={o} value={o}>{o}</option>)}
          </select>
          {line.spec.required && !ql?.spec?.value && (
            <span className="text-[11px] text-red-400">required before send</span>
          )}
        </div>
      )}

      {/* Included ($0 Incl) components under a package line */}
      {active && line.included && (
        <div className="mt-1.5 ml-11 grid grid-cols-1 sm:grid-cols-2 gap-x-4">
          {line.included.map((c) => (
            <p key={c.name} className="text-[11px] text-orbital-dim flex justify-between">
              <span className="truncate">{c.name} ({c.qty})</span>
              <span className="font-telemetry flex-shrink-0 ml-2">$0.00 Incl</span>
            </p>
          ))}
        </div>
      )}
    </div>
  )
}
