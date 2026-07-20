import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import clsx from 'clsx'
import { format, parseISO } from 'date-fns'
import { CheckCircle2, XCircle, AlertTriangle } from 'lucide-react'
import { usePipeline, STATUS_LABELS, STATUS_COLORS } from './PipelineContext.jsx'
import { fmtMoneyShort, quoteIsExpired, quoteExpiryDate, computeTotals } from './quoteMath.js'

// ── Small shared chips/badges for the pipeline domain ────────────────────────

export function DealStatusBadge({ status, className }) {
  const color = STATUS_COLORS[status] || '#52525b'
  return (
    <span className={clsx('inline-flex items-center gap-1.5 text-xs font-medium', className)}
      style={{ color }}>
      <span className="rounded-full flex-shrink-0" style={{ width: 6, height: 6, background: color }} />
      {STATUS_LABELS[status] || status}
    </span>
  )
}

export function VenueChip({ venue, location }) {
  return (
    <span className="inline-flex items-center text-[11px] font-medium px-1.5 py-0.5 rounded-sm"
      style={{
        color: venue === 'mobile' ? '#f59e0b' : '#60a5fa',
        background: venue === 'mobile' ? 'rgba(245,158,11,0.1)' : 'rgba(59,130,246,0.1)',
      }}>
      {venue === 'mobile' ? `In Orbit${location ? ` · ${location}` : ''}` : 'TVC'}
    </span>
  )
}

export function ModeChip({ mode }) {
  if (!mode || mode === 'standard') return null
  const label = mode === 'budget_first' ? 'Budget-First' : 'Comparison-Bid'
  return (
    <span className="inline-flex items-center text-[11px] font-medium px-1.5 py-0.5 rounded-sm"
      style={{ color: '#a78bfa', background: 'rgba(139,92,246,0.1)' }}>
      {label}
    </span>
  )
}

export function GateDot({ ok }) {
  return ok
    ? <CheckCircle2 size={13} className="text-green-500 flex-shrink-0" />
    : <XCircle size={13} className="text-orbital-dim flex-shrink-0" />
}

export function fmtDate(d) {
  if (!d) return '—'
  try { return format(parseISO(String(d).slice(0, 10)), 'MMM d, yyyy') } catch { return d }
}

// The three number states, admin-eyes only (callers already gate on
// canSeeMoney — this just renders).
export function MoneyTriple({ m }) {
  return (
    <span className="font-telemetry text-[11px] text-orbital-subtle whitespace-nowrap">
      {fmtMoneyShort(m?.quotedTotal)} → {fmtMoneyShort(m?.agreedTotal)} → {fmtMoneyShort(m?.actualTotal)}
    </span>
  )
}

// ── Client history — THE payback. One glance answers: what did we charge
// these guys last time, did they actually pay, what discount did they think
// was permanent? Reused on /pipeline/clients, deal detail, and deal creation.
export function ClientHistoryList({ company, excludeDealId, compact = false }) {
  const { deals, money, quotes, canSeeMoney, rateCardByVersion } = usePipeline()

  const rows = useMemo(() => {
    const needle = (company || '').trim().toLowerCase()
    if (!needle) return []
    return deals
      .filter((d) => d.clientCompany.toLowerCase() === needle && d.id !== excludeDealId)
      .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''))
      .map((d) => {
        const dealQuotes = quotes.filter((q) => q.dealId === d.id)
        const sent = dealQuotes.find((q) => q.status === 'accepted')
          || dealQuotes.find((q) => q.status === 'sent')
          || dealQuotes[0]
        const discount = sent?.discount && sent.discount.value
          ? sent.discount
          : null
        let discountAmount = null
        if (discount && canSeeMoney) {
          const card = rateCardByVersion(sent.rateCardVersion)
          discountAmount = computeTotals(card, sent).discountAmount
        }
        return {
          deal: d,
          money: money[d.id],
          quote: sent,
          discount,
          discountAmount,
          expired: sent && sent.status === 'sent' && quoteIsExpired(sent.issuedAt),
        }
      })
  }, [deals, money, quotes, company, excludeDealId, canSeeMoney, rateCardByVersion])

  if (!rows.length) return null

  return (
    <div className="space-y-2">
      {rows.map(({ deal, money: m, quote, discount, discountAmount, expired }) => (
        <Link key={deal.id} to={`/pipeline/deals/${deal.id}`}
          className="block px-3 py-2 rounded-sm transition-colors hover:bg-black/[0.04] dark:hover:bg-white/[0.04]"
          style={{ border: '1px solid var(--orbital-border)' }}>
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0">
              <p className="text-[13px] font-medium text-orbital-text truncate">
                {deal.projectName}
                <span className="text-orbital-dim font-normal"> · {fmtDate(deal.startDate || deal.createdAt)}</span>
              </p>
              <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                <VenueChip venue={deal.venue} location={deal.mobileLocation} />
                <DealStatusBadge status={deal.status} />
                {deal.status === 'dead' && deal.lostReason && (
                  <span className="text-[11px] text-orbital-dim truncate">({deal.lostReason})</span>
                )}
              </div>
            </div>
            {canSeeMoney && (
              <div className="text-right flex-shrink-0">
                <MoneyTriple m={m} />
                <p className="text-[11px] mt-0.5">
                  {m?.paid === true && <span className="text-green-500 font-medium">PAID</span>}
                  {m?.paid === false && <span className="text-red-400 font-medium">UNPAID</span>}
                  {discount && (
                    <span className="text-orbital-subtle">
                      {' '}· {discount.label}
                      {discountAmount != null ? ` −${fmtMoneyShort(discountAmount)}` : discount.mode === 'percent' ? ` −${discount.value}%` : ''}
                    </span>
                  )}
                </p>
              </div>
            )}
          </div>
          {expired && canSeeMoney && (
            <p className="flex items-center gap-1 mt-1 text-[11px] text-amber-500">
              <AlertTriangle size={11} />
              Quoted {fmtMoneyShort(m?.quotedTotal)} on {fmtDate(quote.issuedAt)} — EXPIRED {fmtDate(quoteExpiryDate(quote.issuedAt))}. Don't honor this number.
            </p>
          )}
          {!compact && deal.notes?.[0] && (
            <p className="mt-1 text-[11px] text-orbital-dim truncate">“{deal.notes[0].text}”</p>
          )}
        </Link>
      ))}
    </div>
  )
}
