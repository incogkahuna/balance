import { parseISO } from 'date-fns'
import { format } from '../../lib/safeFormat.js'
import { Star, AlertTriangle } from 'lucide-react'

// ─────────────────────────────────────────────────────────────────────────────
// DebriefSheet — the debrief as a DOCUMENT, not a text dump (Danny: "right now
// the debrief has no formatting, it's just a txt file").
//
// Renders from a structured snapshot so the same component serves the review
// modal on the production, the folder view on /debriefs, and the print/PDF
// output. Submissions made before this shipped only carry the plain-text
// `doc` — callers fall back to that, so nothing already filed goes blank.
//
// Print rules live in debriefPrintCss: white page, black text, no chrome.
// ─────────────────────────────────────────────────────────────────────────────

export const debriefPrintCss = `
@media print {
  body { background: #fff !important; }
  .no-print, nav, aside, header { display: none !important; }
  .no-print-overlay { position: static !important; inset: auto !important; }
  .no-print-overlay > div {
    position: static !important; max-height: none !important;
    border: none !important; margin: 0 !important; box-shadow: none !important;
  }
  .debrief-sheet {
    color: #111 !important; background: #fff !important;
    max-height: none !important; overflow: visible !important;
  }
  .debrief-sheet * { color: #111 !important; border-color: #ccc !important; }
  .debrief-sheet .sheet-muted { color: #555 !important; }
  .debrief-sheet .sheet-band { background: #f3f4f6 !important; }
  .debrief-sheet section { break-inside: avoid; }
}
`

const money = (v) => {
  const n = parseFloat(v)
  return Number.isFinite(n)
    ? `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
    : '—'
}

const safeDay = (iso, fallback = '') => {
  if (!iso) return fallback
  try { return format(parseISO(iso), 'MMM d, yyyy') } catch { return fallback }
}

// Build the structured snapshot a sheet renders from. Stored on the submission
// so the folder view doesn't have to re-derive it from a live production that
// may have moved on since.
export function buildDebriefData(production) {
  const fb = production.feedback || {}
  const addons = production.addons || []
  return {
    name: production.name || '',
    client: production.client || '',
    startDate: production.startDate || '',
    endDate: production.endDate || '',
    productionType: production.productionType || '',
    locationType: production.locationType || '',
    rating: fb.rating || null,
    expectations: fb.expectations || '',
    whatHappened: fb.whatHappened || '',
    issues: fb.issues || '',
    extraCharges: fb.extraCharges || '',
    addons: addons.map(a => ({
      id: a.id,
      equipment: a.equipment || '',
      quantity: a.quantity || 1,
      dayRate: a.dayRate || '',
      days: a.days || '',
      cost: a.cost || '',
      damaged: !!a.damaged,
    })),
    addonTotal: addons.reduce((sum, a) => sum + (parseFloat(a.cost) || 0), 0),
    notes: (production.debriefNotes || []).map(n => ({
      id: n.id, text: n.text || '', authorName: n.authorName || '', at: n.at || '',
    })),
  }
}

// Plain-text rendering — still generated because it's what pastes into Slack
// and email. The formatted sheet is what gets read and printed.
export function debriefToText(d) {
  const lines = [
    `PRODUCTION DEBRIEF — ${d.name}`,
    d.client ? `Client: ${d.client}` : null,
    d.startDate ? `Dates: ${d.startDate}${d.endDate ? ` → ${d.endDate}` : ''}` : null,
    d.rating ? `Rating: ${d.rating}/5` : null,
    '',
    d.expectations ? `EXPECTATIONS GOING IN\n${d.expectations}\n` : null,
    d.whatHappened ? `WHAT ACTUALLY HAPPENED\n${d.whatHappened}\n` : null,
    d.issues ? `ISSUES ENCOUNTERED\n${d.issues}\n` : null,
    d.extraCharges ? `EXTRA CHARGES\n${d.extraCharges}\n` : null,
    d.addons.length > 0 ? [
      'ADD-ONS (COSTED)',
      ...d.addons.map(a => {
        const qty = a.quantity && a.quantity !== 1 ? ` ×${a.quantity}` : ''
        const rate = a.dayRate && a.days ? ` — ${money(a.dayRate)}/day × ${a.days}d` : ''
        return `- ${a.equipment}${qty}${rate}: ${money(a.cost)}${a.damaged ? '  [DAMAGED]' : ''}`
      }),
      `Total: ${money(d.addonTotal)}`,
      '',
    ].join('\n') : null,
    d.notes.length > 0 ? [
      'NOTES FROM THE FLOOR',
      ...d.notes.map(n => `- ${n.text}${n.authorName ? ` (${n.authorName}${n.at ? `, ${safeDay(n.at)}` : ''})` : ''}`),
      '',
    ].join('\n') : null,
  ].filter(l => l !== null)
  return lines.join('\n')
}

function Section({ title, children }) {
  return (
    <section className="mt-5">
      <h3 className="text-[11px] font-telemetry tracking-[0.12em] uppercase sheet-muted mb-1.5">{title}</h3>
      {children}
    </section>
  )
}

function Prose({ text }) {
  return <p className="text-[13px] leading-relaxed whitespace-pre-wrap">{text}</p>
}

export function DebriefSheet({ data, submittedByName, submittedAt }) {
  if (!data) return null
  const dates = data.startDate
    ? `${safeDay(data.startDate, data.startDate)}${data.endDate && data.endDate !== data.startDate ? ` – ${safeDay(data.endDate, data.endDate)}` : ''}`
    : 'Dates not set'
  const meta = [data.productionType, data.locationType].filter(Boolean).join(' · ')

  return (
    <div className="debrief-sheet px-6 py-6 overflow-y-auto text-orbital-text">
      {/* Masthead */}
      <header className="pb-4" style={{ borderBottom: '2px solid var(--orbital-border)' }}>
        <p className="text-[10px] font-telemetry tracking-[0.2em] uppercase sheet-muted">
          Orbital Studios · Production Debrief
        </p>
        <h2 className="text-2xl font-semibold tracking-tight mt-1.5">{data.name || 'Untitled production'}</h2>
        <div className="flex items-baseline gap-x-4 gap-y-1 flex-wrap mt-1 text-[12px] sheet-muted">
          {data.client && <span>{data.client}</span>}
          <span>{dates}</span>
          {meta && <span>{meta}</span>}
        </div>
        <div className="flex items-center gap-3 flex-wrap mt-3">
          {data.rating > 0 && (
            <span className="inline-flex items-center gap-1 text-[12px]">
              {[1, 2, 3, 4, 5].map(n => (
                <Star
                  key={n}
                  size={13}
                  className={n <= data.rating ? 'text-amber-400 fill-amber-400' : 'text-orbital-border'}
                />
              ))}
              <span className="ml-1 sheet-muted">{data.rating}/5</span>
            </span>
          )}
          {(submittedByName || submittedAt) && (
            <span className="text-[11px] sheet-muted">
              Submitted{submittedByName ? ` by ${submittedByName}` : ''}
              {submittedAt ? ` · ${safeDay(submittedAt)}` : ''}
            </span>
          )}
        </div>
      </header>

      {/* Money first — this is what has to reach collection */}
      {data.addons.length > 0 && (
        <section className="mt-5">
          <div className="flex items-baseline justify-between mb-1.5">
            <h3 className="text-[11px] font-telemetry tracking-[0.12em] uppercase sheet-muted">
              Add-ons to bill
            </h3>
            <span className="text-[15px] font-semibold font-telemetry">{money(data.addonTotal)}</span>
          </div>
          <table className="w-full text-[12px]" style={{ borderCollapse: 'collapse' }}>
            <thead>
              <tr className="sheet-band" style={{ background: 'var(--orbital-muted)' }}>
                <th className="text-left font-medium px-2 py-1.5">Item</th>
                <th className="text-center font-medium px-2 py-1.5 w-12">Qty</th>
                <th className="text-right font-medium px-2 py-1.5 w-32">Rate</th>
                <th className="text-right font-medium px-2 py-1.5 w-24">Cost</th>
              </tr>
            </thead>
            <tbody>
              {data.addons.map(a => (
                <tr key={a.id} style={{ borderTop: '1px solid var(--orbital-border)' }}>
                  <td className="px-2 py-1.5">
                    {a.equipment || '—'}
                    {a.damaged && (
                      <span className="inline-flex items-center gap-1 ml-2 text-[10px] text-orange-400">
                        <AlertTriangle size={10} /> DAMAGED
                      </span>
                    )}
                  </td>
                  <td className="px-2 py-1.5 text-center">{a.quantity || 1}</td>
                  <td className="px-2 py-1.5 text-right sheet-muted">
                    {a.dayRate && a.days ? `${money(a.dayRate)}/day × ${a.days}` : '—'}
                  </td>
                  <td className="px-2 py-1.5 text-right font-telemetry">{money(a.cost)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {data.expectations && <Section title="Expectations going in"><Prose text={data.expectations} /></Section>}
      {data.whatHappened && <Section title="What actually happened"><Prose text={data.whatHappened} /></Section>}
      {data.issues && <Section title="Issues encountered"><Prose text={data.issues} /></Section>}
      {data.extraCharges && <Section title="Extra charges"><Prose text={data.extraCharges} /></Section>}

      {data.notes.length > 0 && (
        <Section title={`Notes from the floor (${data.notes.length})`}>
          <div className="space-y-2.5">
            {data.notes.map(n => (
              <div key={n.id} className="pl-3" style={{ borderLeft: '2px solid var(--orbital-border)' }}>
                <p className="text-[13px] leading-relaxed whitespace-pre-wrap">{n.text}</p>
                {(n.authorName || n.at) && (
                  <p className="text-[10px] sheet-muted mt-0.5">
                    {n.authorName}{n.authorName && n.at ? ' · ' : ''}{safeDay(n.at)}
                  </p>
                )}
              </div>
            ))}
          </div>
        </Section>
      )}

      {!data.expectations && !data.whatHappened && !data.issues
        && !data.extraCharges && data.notes.length === 0 && data.addons.length === 0 && (
        <p className="text-[13px] sheet-muted mt-6">
          Nothing captured for this production yet.
        </p>
      )}
    </div>
  )
}
