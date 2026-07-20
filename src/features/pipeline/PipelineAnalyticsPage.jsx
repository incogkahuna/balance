import { useMemo } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
} from 'recharts'
import { usePipeline, STATUS_LABELS, STATUS_COLORS } from './PipelineContext.jsx'
import { PipelineNoAccess } from './components.jsx'
import { fmtMoneyShort } from './quoteMath.js'

// ─────────────────────────────────────────────────────────────────────────────
// PipelineAnalyticsPage — Wilder's layer. Every metric derives from data
// Brian enters for his own workflow; zero extra entry. Aggregate, not
// per-deal money: admin roles compute money stats from their own scoped data;
// the pipeline role gets SQL-side aggregates (pipeline_money_aggregates RPC)
// in remote mode and the same shapes computed from scoped (= empty money)
// data locally — so a non-admin can never reconstruct per-deal numbers.
// ─────────────────────────────────────────────────────────────────────────────

const DAY_MS = 86400000

export function PipelineAnalyticsPage() {
  const { ready, deals, money, quotes, canSeeMoney, pipelineRole, rateCardByVersion, remoteAggregates } = usePipeline()

  const stats = useMemo(() => {
    const total = deals.length
    const byStatus = {}
    for (const d of deals) byStatus[d.status] = (byStatus[d.status] || 0) + 1

    // Close rate: of deals that got a quote sent (or further), how many
    // reached agreement or beyond?
    const reached = (d, s) => (d.statusHistory || []).some((h) => h.status === s) || d.status === s
    const sentPool = deals.filter((d) => reached(d, 'quote_sent') || reached(d, 'agreement') || reached(d, 'green_light'))
    const closedPool = sentPool.filter((d) => reached(d, 'agreement') || reached(d, 'green_light'))
    const closeRate = sentPool.length ? (closedPool.length / sentPool.length) * 100 : null

    // Cycle time per stage from status_history timestamps.
    const stageDurations = { new: [], quote_sent: [], agreement: [] }
    for (const d of deals) {
      const hist = (d.statusHistory || []).slice().sort((a, b) => a.at.localeCompare(b.at))
      for (let i = 0; i < hist.length - 1; i++) {
        const from = hist[i], to = hist[i + 1]
        const days = (new Date(to.at) - new Date(from.at)) / DAY_MS
        if (stageDurations[from.status] && days >= 0) stageDurations[from.status].push(days)
      }
    }
    const avg = (arr) => (arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : null)

    // Venue / asset / mode mixes
    const venueMix = { tvc: 0, mobile: 0 }
    const assetMix = {}
    for (const d of deals) {
      venueMix[d.venue] = (venueMix[d.venue] || 0) + 1
      if (d.assetClass) assetMix[d.assetClass] = (assetMix[d.assetClass] || 0) + 1
    }

    // Monthly deal flow (+revenue when visible)
    const monthly = {}
    for (const d of deals) {
      const m = (d.createdAt || '').slice(0, 7)
      if (!m) continue
      monthly[m] = monthly[m] || { month: m, count: 0, revenue: 0 }
      monthly[m].count += 1
      const mm = money[d.id]
      const rev = mm?.actualTotal ?? mm?.agreedTotal
      if (rev && (d.status === 'green_light')) monthly[m].revenue += rev
    }
    const monthlyList = Object.values(monthly).sort((a, b) => a.month.localeCompare(b.month)).slice(-12)

    // Money-derived aggregates — computed from scoped data (admins have it,
    // non-admins fall through to the RPC result).
    let deltaBuckets = null
    let discountStats = null
    if (canSeeMoney) {
      const buckets = {}
      for (const m of Object.values(money)) {
        if (m.quotedTotal && m.agreedTotal != null && m.quotedTotal !== 0) {
          const pct = ((m.quotedTotal - m.agreedTotal) / m.quotedTotal) * 100
          const b = Math.floor(pct / 5) * 5
          buckets[b] = (buckets[b] || 0) + 1
        }
      }
      deltaBuckets = Object.entries(buckets)
        .map(([bucket, count]) => ({ bucket: Number(bucket), count }))
        .sort((a, b) => a.bucket - b.bucket)

      const byLabel = {}
      for (const q of quotes) {
        if (q.status === 'draft' || !q.discount?.value || !q.discount.label) continue
        const label = q.discount.label === 'Custom' ? (q.discount.customLabel || 'Custom') : q.discount.label
        byLabel[label] = byLabel[label] || { label, count: 0, pcts: [] }
        byLabel[label].count += 1
        if (q.discount.mode === 'percent') byLabel[label].pcts.push(q.discount.value)
      }
      discountStats = Object.values(byLabel)
        .map((x) => ({ label: x.label, count: x.count, avgPct: x.pcts.length ? x.pcts.reduce((a, b) => a + b, 0) / x.pcts.length : null }))
        .sort((a, b) => b.count - a.count)
    } else if (remoteAggregates) {
      deltaBuckets = remoteAggregates.deltaBuckets || []
      discountStats = (remoteAggregates.discounts || []).map((d) => ({ label: d.label, count: d.count, avgPct: d.avgPct }))
    }

    // Line-item popularity (what gets bought) — admin only (quotes are money).
    let lineStats = null
    if (canSeeMoney && quotes.length) {
      const activeCounts = {}
      let quoteCount = 0
      for (const q of quotes) {
        if (q.status === 'draft') continue
        quoteCount += 1
        const card = rateCardByVersion(q.rateCardVersion)
        for (const [lid, ql] of Object.entries(q.lines || {})) {
          if (!ql?.x) continue
          const name = card.lines[lid]?.name || lid
          activeCounts[name] = (activeCounts[name] || 0) + 1
        }
      }
      lineStats = Object.entries(activeCounts)
        .map(([name, count]) => ({ name, count, pct: quoteCount ? (count / quoteCount) * 100 : 0 }))
        .sort((a, b) => b.count - a.count)
    }

    return {
      total, byStatus, closeRate,
      cycle: {
        new: avg(stageDurations.new),
        quote_sent: avg(stageDurations.quote_sent),
        agreement: avg(stageDurations.agreement),
      },
      venueMix, assetMix, monthlyList, deltaBuckets, discountStats, lineStats,
    }
  }, [deals, money, quotes, canSeeMoney, rateCardByVersion, remoteAggregates])

  if (!pipelineRole) return <PipelineNoAccess />
  if (!ready) return null

  const s = stats
  return (
    <div className="max-w-6xl mx-auto px-3 sm:px-4 lg:px-6 py-5">
      <p className="hud-label mb-1">JOB PIPELINE</p>
      <h1 className="text-xl sm:text-2xl font-semibold text-orbital-text tracking-tight mb-1">Pipeline Analytics</h1>
      <p className="text-sm text-orbital-subtle mb-5">
        Close rates, cycle times, and what actually gets bought — all derived from the deals Brian
        already tracks for himself. {!canSeeMoney && 'Money metrics shown as aggregates only.'}
      </p>

      {s.total === 0 ? (
        <div className="card-elevated p-8 text-center">
          <p className="text-sm text-orbital-subtle">No deals yet — analytics light up as the pipeline fills.</p>
        </div>
      ) : (
        <>
          {/* Stat tiles */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
            <Tile label="DEALS" value={s.total} sub={`${s.byStatus.green_light || 0} green-lit · ${s.byStatus.dead || 0} dead`} />
            <Tile label="CLOSE RATE" value={s.closeRate != null ? `${s.closeRate.toFixed(0)}%` : '—'} sub="sent → agreement" />
            <Tile label="VENUE MIX" value={`${s.venueMix.tvc || 0} / ${s.venueMix.mobile || 0}`} sub="TVC / Mobile" />
            <Tile label="AVG CYCLE" value={
              s.cycle.quote_sent != null ? `${s.cycle.quote_sent.toFixed(1)}d` : '—'
            } sub="quote sent → next stage" />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Status funnel */}
            <div className="card-elevated p-4">
              <p className="hud-label mb-3">PIPELINE FUNNEL</p>
              <div className="space-y-1.5">
                {['new', 'quote_sent', 'agreement', 'green_light', 'dead'].map((st) => {
                  const n = s.byStatus[st] || 0
                  const pct = s.total ? (n / s.total) * 100 : 0
                  return (
                    <div key={st} className="flex items-center gap-2">
                      <span className="text-[11px] text-orbital-subtle w-24 flex-shrink-0">{STATUS_LABELS[st]}</span>
                      <div className="flex-1 h-4 rounded-sm overflow-hidden" style={{ background: 'var(--orbital-border)' }}>
                        <div className="h-full" style={{ width: `${pct}%`, background: STATUS_COLORS[st] }} />
                      </div>
                      <span className="font-telemetry text-[11px] text-orbital-subtle w-6 text-right">{n}</span>
                    </div>
                  )
                })}
              </div>
              {/* Cycle detail */}
              <div className="mt-3 pt-3 text-[11px] text-orbital-subtle space-y-0.5"
                style={{ borderTop: '1px solid var(--orbital-border)' }}>
                <p>New → Quote Sent: <span className="font-telemetry">{s.cycle.new != null ? `${s.cycle.new.toFixed(1)} days avg` : '—'}</span></p>
                <p>Quote Sent → Agreement: <span className="font-telemetry">{s.cycle.quote_sent != null ? `${s.cycle.quote_sent.toFixed(1)} days avg` : '—'}</span></p>
                <p>Agreement → Green Light: <span className="font-telemetry">{s.cycle.agreement != null ? `${s.cycle.agreement.toFixed(1)} days avg` : '—'}</span></p>
              </div>
            </div>

            {/* Monthly flow */}
            <div className="card-elevated p-4">
              <p className="hud-label mb-3">MONTHLY DEAL FLOW{canSeeMoney ? ' + REVENUE' : ''}</p>
              {s.monthlyList.length === 0 ? (
                <p className="text-xs text-orbital-dim">No dated deals.</p>
              ) : (
                <ResponsiveContainer width="100%" height={180}>
                  <BarChart data={s.monthlyList}>
                    <XAxis dataKey="month" tick={{ fontSize: 10, fill: 'var(--orbital-dim)' }} tickFormatter={(m) => m.slice(5)} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 10, fill: 'var(--orbital-dim)' }} width={24} />
                    <Tooltip
                      contentStyle={{ background: 'var(--orbital-surface)', border: '1px solid var(--orbital-border)', fontSize: 11 }}
                      formatter={(v, name) => name === 'revenue' ? fmtMoneyShort(v) : v}
                    />
                    <Bar dataKey="count" name="deals" fill="#3b82f6" radius={[2, 2, 0, 0]} />
                    {canSeeMoney && null /* revenue shown in the table below to keep one axis */}
                  </BarChart>
                </ResponsiveContainer>
              )}
              {canSeeMoney && s.monthlyList.some((m) => m.revenue > 0) && (
                <div className="mt-2 text-[11px] text-orbital-subtle space-y-0.5">
                  {s.monthlyList.filter((m) => m.revenue > 0).map((m) => (
                    <p key={m.month}>{m.month}: <span className="font-telemetry">{fmtMoneyShort(m.revenue)}</span> green-lit revenue</p>
                  ))}
                </div>
              )}
            </div>

            {/* Quoted → agreed delta distribution */}
            <div className="card-elevated p-4">
              <p className="hud-label mb-3">QUOTED → AGREED DELTA (what negotiation costs)</p>
              {!s.deltaBuckets || s.deltaBuckets.length === 0 ? (
                <p className="text-xs text-orbital-dim">Needs deals with both quoted and agreed numbers.</p>
              ) : (
                <ResponsiveContainer width="100%" height={160}>
                  <BarChart data={s.deltaBuckets}>
                    <XAxis dataKey="bucket" tick={{ fontSize: 10, fill: 'var(--orbital-dim)' }} tickFormatter={(b) => `${b}%`} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 10, fill: 'var(--orbital-dim)' }} width={24} />
                    <Tooltip
                      contentStyle={{ background: 'var(--orbital-surface)', border: '1px solid var(--orbital-border)', fontSize: 11 }}
                      labelFormatter={(b) => `${b}–${Number(b) + 5}% off quoted`}
                    />
                    <Bar dataKey="count" name="deals" radius={[2, 2, 0, 0]}>
                      {s.deltaBuckets.map((b, i) => (
                        <Cell key={i} fill={b.bucket <= 0 ? '#22c55e' : b.bucket < 10 ? '#eab308' : '#f87171'} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>

            {/* Discounts */}
            <div className="card-elevated p-4">
              <p className="hud-label mb-3">DISCOUNTS — FREQUENCY / SIZE / LABEL</p>
              {!s.discountStats || s.discountStats.length === 0 ? (
                <p className="text-xs text-orbital-dim">No labeled discounts on sent quotes yet.</p>
              ) : (
                <div className="space-y-1.5">
                  {s.discountStats.map((d) => (
                    <div key={d.label} className="flex items-center justify-between text-[12px]">
                      <span className="text-orbital-text">{d.label}</span>
                      <span className="font-telemetry text-orbital-subtle">
                        ×{d.count}{d.avgPct != null ? ` · avg ${Number(d.avgPct).toFixed(1)}%` : ''}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Asset class mix */}
            <div className="card-elevated p-4">
              <p className="hud-label mb-3">ASSET CLASS MIX</p>
              {Object.keys(s.assetMix).length === 0 ? (
                <p className="text-xs text-orbital-dim">No asset classes recorded.</p>
              ) : (
                <div className="space-y-1.5">
                  {Object.entries(s.assetMix).sort((a, b) => b[1] - a[1]).map(([k, n]) => (
                    <div key={k} className="flex items-center gap-2">
                      <span className="text-[11px] text-orbital-subtle w-20 flex-shrink-0">{k}</span>
                      <div className="flex-1 h-4 rounded-sm overflow-hidden" style={{ background: 'var(--orbital-border)' }}>
                        <div className="h-full bg-blue-500" style={{ width: `${(n / s.total) * 100}%` }} />
                      </div>
                      <span className="font-telemetry text-[11px] text-orbital-subtle w-6 text-right">{n}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Line-item popularity (admin) */}
            {s.lineStats && (
              <div className="card-elevated p-4">
                <p className="hud-label mb-3">WHAT GETS BOUGHT (active lines on sent quotes)</p>
                <div className="space-y-1 max-h-56 overflow-y-auto">
                  {s.lineStats.slice(0, 14).map((l) => (
                    <div key={l.name} className="flex items-center justify-between text-[12px]">
                      <span className="text-orbital-text truncate">{l.name}</span>
                      <span className="font-telemetry text-orbital-subtle flex-shrink-0 ml-2">{l.pct.toFixed(0)}%</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}

function Tile({ label, value, sub }) {
  return (
    <div className="card-elevated p-3">
      <p className="hud-label mb-1">{label}</p>
      <p className="font-telemetry text-xl text-orbital-text">{value}</p>
      {sub && <p className="text-[10px] text-orbital-dim mt-0.5">{sub}</p>}
    </div>
  )
}
