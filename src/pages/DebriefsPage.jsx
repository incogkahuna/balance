import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { format, parseISO } from 'date-fns'
import { FileText, Printer, X, Star, Briefcase } from 'lucide-react'
import { useApp } from '../context/AppContext.jsx'
import { usePipeline } from '../features/pipeline/PipelineContext.jsx'
import { EmptyState } from '../components/ui/EmptyState.jsx'

// ─────────────────────────────────────────────────────────────────────────────
// DebriefsPage — the folder where every SUBMITTED debrief lands (Danny's
// '!! Important'): each stays attached to its production, and here they're
// all reviewable together. Costed add-on totals ride up front — this is the
// money that has to make it to collection — with a jump to the production's
// pipeline deal when one is linked. Print = the PDF.
// ─────────────────────────────────────────────────────────────────────────────

const PRINT_CSS = `
@media print {
  body { background: #fff !important; }
  .no-print, nav, aside, header,
  div:has(> button[aria-label^="Send feedback"]) { display: none !important; }
  .no-print-overlay { position: static !important; inset: auto !important; }
  .no-print-overlay > div {
    position: static !important; max-height: none !important;
    border: none !important; margin: 0 !important; background: #fff !important;
  }
  .debrief-print-doc {
    color: #111 !important; background: #fff !important;
    border: none !important; max-height: none !important; overflow: visible !important;
  }
}
`

export function DebriefsPage() {
  const { productions, resolveUserName } = useApp()
  const { deals } = usePipeline()
  const [openSub, setOpenSub] = useState(null) // { production, submission }

  // Every submission across every production, newest first.
  const submissions = useMemo(() => {
    const out = []
    for (const p of productions) {
      for (const s of p.feedback?.submissions || []) {
        out.push({ production: p, submission: s })
      }
    }
    return out.sort((a, b) => (b.submission.submittedAt || '').localeCompare(a.submission.submittedAt || ''))
  }, [productions])

  const money = (n) => `$${(Number(n) || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}`
  const dealFor = (productionId) => deals.find(d => d.productionId === productionId)

  return (
    <div className="max-w-4xl mx-auto px-3 sm:px-4 lg:px-6 py-5">
      <style>{PRINT_CSS}</style>
      <div className="no-print">
        <p className="hud-label mb-1">WRAP REPORTS</p>
        <h1 className="text-xl sm:text-2xl font-semibold text-orbital-text tracking-tight mb-1">Debriefs</h1>
        <p className="text-sm text-orbital-subtle mb-5">
          Every submitted debrief, reviewed together — add-on charges up front so nothing
          misses collection. Submit from a production&apos;s Debrief tab.
        </p>
      </div>

      {submissions.length === 0 ? (
        <div className="no-print">
          <EmptyState
            icon={FileText}
            title="No submitted debriefs yet"
            description="Generate a debrief on a production's Debrief tab and hit Submit — it stays on the production and files here."
          />
        </div>
      ) : (
        <div className="space-y-2 no-print">
          {submissions.map(({ production: p, submission: s }) => {
            const deal = dealFor(p.id)
            return (
              <div key={s.id} className="card-elevated">
                <button
                  onClick={() => setOpenSub({ production: p, submission: s })}
                  className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-orbital-muted transition-colors"
                >
                  <FileText size={16} className="text-orbital-subtle flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-orbital-text truncate">
                      {p.name}
                      {p.client && <span className="text-orbital-dim font-normal"> · {p.client}</span>}
                    </p>
                    <p className="text-[11px] text-orbital-subtle mt-0.5 flex items-center gap-2 flex-wrap">
                      <span>{resolveUserName(s.submittedBy) || s.submittedByName || 'Unknown'}</span>
                      <span className="text-orbital-dim">·</span>
                      <span className="font-mono">{s.submittedAt ? format(parseISO(s.submittedAt), 'MMM d, yyyy') : ''}</span>
                      {s.rating != null && s.rating > 0 && (
                        <span className="inline-flex items-center gap-0.5 text-amber-400">
                          <Star size={10} className="fill-amber-400" /> {s.rating}/5
                        </span>
                      )}
                    </p>
                  </div>
                  {s.addonCount > 0 && (
                    <div className="text-right flex-shrink-0">
                      <p className="font-telemetry text-[13px] text-orbital-text">{money(s.addonTotal)}</p>
                      <p className="text-[10px] text-orbital-dim">
                        {s.addonCount} add-on{s.addonCount === 1 ? '' : 's'} to bill
                      </p>
                    </div>
                  )}
                </button>
                <div className="flex items-center gap-3 px-4 pb-2.5 -mt-1">
                  <Link to={`/productions/${p.id}`} className="text-[11px] text-orbital-subtle hover:text-orbital-text">
                    Open production →
                  </Link>
                  {deal && (
                    <Link
                      to={`/pipeline/deals/${deal.id}`}
                      className="inline-flex items-center gap-1 text-[11px] text-blue-400 hover:text-blue-300"
                      title="Carry these charges into the deal's actual number"
                    >
                      <Briefcase size={11} /> Open deal (bill add-ons) →
                    </Link>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Document viewer — print for a PDF */}
      {openSub && (
        <div className="fixed inset-0 z-50 no-print-overlay">
          <button
            className="absolute inset-0 no-print"
            style={{ background: 'rgba(0,0,0,0.6)' }}
            onClick={() => setOpenSub(null)}
            aria-label="Close"
          />
          <div
            className="relative max-w-2xl mx-auto mt-6 mb-6 rounded-lg flex flex-col max-h-[90vh]"
            style={{ background: 'var(--orbital-surface)', border: '1px solid var(--orbital-border)' }}
          >
            <div className="no-print flex items-center justify-between px-4 py-2.5" style={{ borderBottom: '1px solid var(--orbital-border)' }}>
              <p className="hud-label">
                DEBRIEF — {openSub.production.name.toUpperCase()}
              </p>
              <div className="flex items-center gap-2">
                <button onClick={() => window.print()} className="btn-secondary text-xs">
                  <Printer size={13} /> Print / PDF
                </button>
                <button
                  onClick={() => setOpenSub(null)}
                  className="p-2 text-orbital-subtle hover:text-orbital-text"
                  aria-label="Close"
                >
                  <X size={16} />
                </button>
              </div>
            </div>
            <pre className="debrief-print-doc p-5 text-xs text-orbital-text whitespace-pre-wrap overflow-y-auto font-mono">
              {openSub.submission.doc}
            </pre>
          </div>
        </div>
      )}
    </div>
  )
}
