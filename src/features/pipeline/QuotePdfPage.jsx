import { useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Printer } from 'lucide-react'
import { usePipeline } from './PipelineContext.jsx'
import {
  resolveRate, lineSubtotal, computeTotals, fmtMoney, quoteExpiryDate,
} from './quoteMath.js'
import { fmtDate } from './components.jsx'

// ─────────────────────────────────────────────────────────────────────────────
// QuotePdfPage — the CLIENT-FACING render. This is Orbital's IP: the full
// master menu with $0.00 lines deliberately visible ("so you know what it
// costs if you figure out you do need tracking"). Structure mirrors the
// existing sheet — Services / Item / Description / QTY / Units / X / Rate /
// SubTotals — so clients don't perceive a tooling change.
//
// NEVER rendered here: internal floors, discount reasons, panel math. The
// discount LABEL prints (that's the anti-precedent mechanism); the internals
// don't. Export = browser print-to-PDF (print CSS below, page-break-safe).
// ─────────────────────────────────────────────────────────────────────────────

const PRINT_CSS = `
@media print {
  body { background: #fff !important; }
  .no-print { display: none !important; }
  .pdf-sheet {
    box-shadow: none !important; border: none !important;
    margin: 0 !important; padding: 0 !important; max-width: none !important;
  }
  .pdf-section { page-break-inside: avoid; }
  .pdf-sheet, .pdf-sheet * {
    -webkit-print-color-adjust: exact !important;
    print-color-adjust: exact !important;
  }
}
`

export function QuotePdfPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { ready, isAdmin, quotes, deals, rateCardByVersion } = usePipeline()

  const quote = quotes.find((q) => q.id === id)
  const deal = quote ? deals.find((d) => d.id === quote.dealId) : null
  const card = quote ? rateCardByVersion(quote.rateCardVersion) : null
  const totals = useMemo(() => (card && quote ? computeTotals(card, quote) : null), [card, quote])

  if (!ready) return null
  if (!isAdmin || !quote || !deal || !card) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-10 text-center">
        <p className="text-sm text-orbital-subtle">Quote not available.</p>
      </div>
    )
  }

  const template = card.templates[quote.venue]
  const discount = quote.discount
  const showValueAdd = discount?.display === 'value_add' && discount?.value > 0
  const discountLabel = discount?.label === 'Custom'
    ? (discount.customLabel || 'Custom')
    : discount?.label

  // Value-add mode: instead of a bottom-line subtraction, the discount renders
  // as "included" $0 lines next to the actives it covers. Brian's choice.
  const grandTotal = showValueAdd ? totals.subtotal - totals.discountAmount : totals.total

  return (
    <div className="max-w-4xl mx-auto px-3 sm:px-4 py-5">
      <style>{PRINT_CSS}</style>

      {/* Toolbar (screen only) */}
      <div className="no-print flex items-center justify-between mb-4">
        <button onClick={() => navigate(`/pipeline/quotes/${quote.id}`)}
          className="flex items-center gap-1 text-xs text-orbital-subtle hover:text-orbital-text">
          <ArrowLeft size={13} /> Build view
        </button>
        <button onClick={() => window.print()} className="btn-primary text-xs">
          <Printer size={13} /> Export PDF
        </button>
      </div>

      {/* ── The sheet — always light, print-faithful ── */}
      <div className="pdf-sheet bg-white text-neutral-900 shadow-xl border border-neutral-300 p-8"
        style={{ fontFamily: "'Inter Tight', 'Inter', system-ui, sans-serif" }}>

        {/* Header block */}
        <div className="flex items-start justify-between pb-4 mb-4" style={{ borderBottom: '3px solid #2a7bbb' }}>
          <div>
            <p className="text-[22px] font-bold tracking-wide" style={{ color: '#2a7bbb' }}>
              ORBITAL VIRTUAL STUDIOS
            </p>
            <p className="text-[11px] text-neutral-500 mt-0.5">
              {quote.venue === 'mobile' ? 'In Orbit — Mobile LED Production' : 'Television City — Virtual Production Stage'}
            </p>
          </div>
          <div className="text-right text-[11px] text-neutral-600">
            <p className="font-semibold text-[13px] text-neutral-900">{quote.title === 'Quote' ? 'PRODUCTION QUOTE' : quote.title.toUpperCase()}</p>
            <p>Date: {fmtDate(quote.issuedAt)}</p>
            <p className="font-medium mt-0.5">This bid is good for 30 business days</p>
          </div>
        </div>

        {/* Client + project + DAYS box */}
        <div className="flex items-start justify-between gap-4 mb-5">
          <div className="text-[12px]">
            <p><span className="text-neutral-500">Client:</span> <span className="font-semibold">{deal.clientCompany}</span></p>
            {deal.clientContact && <p><span className="text-neutral-500">Attn:</span> {deal.clientContact}</p>}
            <p><span className="text-neutral-500">Project:</span> <span className="font-semibold">{deal.projectName}</span></p>
            {quote.venue === 'mobile' && deal.mobileLocation && (
              <p><span className="text-neutral-500">Location:</span> {deal.mobileLocation}</p>
            )}
            {deal.startDate && (
              <p><span className="text-neutral-500">Dates:</span> {fmtDate(deal.startDate)}{deal.endDate ? ` – ${fmtDate(deal.endDate)}` : ''}</p>
            )}
          </div>
          {/* DAYS box */}
          <table className="text-[11px] border-collapse flex-shrink-0">
            <thead>
              <tr>
                {['Travel', 'Build', 'Shoot', 'Strike'].map((h) => (
                  <th key={h} className="border border-neutral-400 px-2 py-1 font-semibold"
                    style={{ background: '#e8f1f8' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr>
                {['travel', 'build', 'shoot', 'strike'].map((k) => (
                  <td key={k} className="border border-neutral-400 px-2 py-1 text-center font-semibold">
                    {quote.days?.[k] ?? 0}
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>

        {/* ── Master menu table ── */}
        <div style={{ overflowX: 'auto' }}>
          <table className="w-full border-collapse text-[11px]">
            <thead>
              <tr style={{ background: '#2a7bbb', color: '#fff' }}>
                <th className="px-2 py-1.5 text-left font-semibold w-[26%]">Item</th>
                <th className="px-2 py-1.5 text-left font-semibold">Description</th>
                <th className="px-2 py-1.5 text-center font-semibold w-12">QTY</th>
                <th className="px-2 py-1.5 text-center font-semibold w-14">Units</th>
                <th className="px-2 py-1.5 text-center font-semibold w-8">X</th>
                <th className="px-2 py-1.5 text-right font-semibold w-20">Rate</th>
                <th className="px-2 py-1.5 text-right font-semibold w-24">SubTotal</th>
              </tr>
            </thead>
            {template.sections.map((section) => {
              const secTotal = totals.sections.find((s) => s.id === section.id)?.subtotal ?? 0
              return (
                <tbody key={section.id} className="pdf-section">
                  <tr>
                    <td colSpan={7} className="px-2 py-1.5 font-bold uppercase tracking-wide text-[11px]"
                      style={{ background: '#e8f1f8', color: '#1c5a8a', borderTop: '1px solid #b9d2e4' }}>
                      {section.title}
                      {section.note && <span className="font-normal normal-case text-neutral-500"> — {section.note}</span>}
                    </td>
                  </tr>
                  {section.lines.map((lineId) => {
                    const line = card.lines[lineId]
                    if (!line) return null
                    const ql = quote.lines[lineId]
                    const active = !!ql?.x
                    const isIncl = line.unit === 'Incl'
                    const rate = resolveRate(line, quote.venue, ql)
                    const sub = lineSubtotal(line, quote.venue, ql)
                    return (
                      <LinePdfRow key={lineId}
                        line={line} ql={ql} active={active} isIncl={isIncl}
                        rate={rate} sub={sub} />
                    )
                  })}
                  <tr>
                    <td colSpan={6} className="px-2 py-1 text-right font-semibold text-neutral-600"
                      style={{ borderTop: '1px solid #d7e4ee' }}>
                      {section.title} subtotal
                    </td>
                    <td className="px-2 py-1 text-right font-semibold"
                      style={{ borderTop: '1px solid #d7e4ee' }}>
                      {fmtMoney(secTotal)}
                    </td>
                  </tr>
                </tbody>
              )
            })}
            <tbody className="pdf-section">
              {/* Discount + total block */}
              {discount?.value > 0 && !showValueAdd && (
                <tr>
                  <td colSpan={6} className="px-2 py-1.5 text-right font-semibold"
                    style={{ borderTop: '2px solid #2a7bbb' }}>
                    Discount — {discountLabel}
                    {discount.mode === 'percent' ? ` (${discount.value}%)` : ''}
                  </td>
                  <td className="px-2 py-1.5 text-right font-semibold"
                    style={{ borderTop: '2px solid #2a7bbb' }}>
                    −{fmtMoney(totals.discountAmount)}
                  </td>
                </tr>
              )}
              {showValueAdd && (
                <tr>
                  <td colSpan={7} className="px-2 py-1.5 text-[11px] font-medium"
                    style={{ borderTop: '2px solid #2a7bbb', color: '#1c5a8a' }}>
                    {discountLabel}: {fmtMoney(totals.discountAmount)} in services included at no charge on this engagement.
                  </td>
                </tr>
              )}
              <tr style={{ background: '#2a7bbb', color: '#fff' }}>
                <td colSpan={6} className="px-2 py-2 text-right font-bold text-[13px]">TOTAL</td>
                <td className="px-2 py-2 text-right font-bold text-[13px]">{fmtMoney(grandTotal)}</td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Footer */}
        <div className="mt-5 text-[10px] text-neutral-500 space-y-0.5">
          <p>This bid is good for 30 business days from {fmtDate(quote.issuedAt)} (through {fmtDate(quoteExpiryDate(quote.issuedAt))}).</p>
          <p>All G&E goes through MBS or the client pays a fee. Rates assume stated day lengths; overages billed at prevailing rates.</p>
          <p>Orbital Virtual Studios · Los Angeles, CA</p>
        </div>
      </div>
    </div>
  )
}

function LinePdfRow({ line, ql, active, isIncl, rate, sub }) {
  const showRate = isIncl ? null : (line.priceMode === 'manual' && !active && ql?.rateOverride == null ? null : rate)
  return (
    <tr style={{ borderTop: '1px solid #eef3f7', color: active ? '#171717' : '#8a8f98' }}>
      <td className="px-2 py-1 align-top font-medium">
        {line.name}
        {line.hours && <span className="text-[9px] text-neutral-400 ml-1">({line.hours})</span>}
      </td>
      <td className="px-2 py-1 align-top text-[10px]">
        {line.description}
        {line.bundle && (
          <span className="block text-[9px] text-neutral-500">Includes: {line.bundle.join(', ')}</span>
        )}
        {line.included && active && (
          <span className="block text-[9px] text-neutral-500">
            {line.included.map((c) => `${c.name} (${c.qty})`).join(' · ')} — Incl
          </span>
        )}
        {ql?.spec?.value && <span className="block text-[9px] text-neutral-500">Frame rate: {ql.spec.value}</span>}
      </td>
      <td className="px-2 py-1 text-center align-top">{isIncl ? '—' : (active ? (ql?.qty ?? 1) : '')}</td>
      <td className="px-2 py-1 text-center align-top">{line.unit}</td>
      <td className="px-2 py-1 text-center align-top">{isIncl ? '' : (active ? ql.x : 0)}</td>
      <td className="px-2 py-1 text-right align-top">
        {isIncl ? 'Incl' : showRate != null && showRate !== 0 ? fmtMoney(showRate) : line.priceMode === 'manual' ? 'Allow' : fmtMoney(showRate ?? 0)}
      </td>
      <td className="px-2 py-1 text-right align-top">{isIncl ? '$0.00' : fmtMoney(sub)}</td>
    </tr>
  )
}
