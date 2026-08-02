import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { parseISO } from 'date-fns'
import { format } from '../lib/safeFormat.js'
import {
  FileText, Printer, X, Star, Briefcase, Sparkles, CheckSquare, Square,
} from 'lucide-react'
import { useApp } from '../context/AppContext.jsx'
import { useToast } from '../context/ToastContext.jsx'
import { usePipeline } from '../features/pipeline/PipelineContext.jsx'
import { EmptyState } from '../components/ui/EmptyState.jsx'
import { DebriefSheet, debriefPrintCss } from '../features/debriefs/DebriefSheet.jsx'
import { SynthesisSheet } from '../features/debriefs/SynthesisSheet.jsx'
import { synthesizeDebriefs } from '../lib/synthesizeDebriefs.ts'

// ─────────────────────────────────────────────────────────────────────────────
// DebriefsPage — the folder where every SUBMITTED debrief lands (Danny's
// '!! Important'): each stays attached to its production, and here they're
// all reviewable together. Costed add-on totals ride up front — this is the
// money that has to make it to collection — with a jump to the production's
// pipeline deal when one is linked. Print = the PDF.
// ─────────────────────────────────────────────────────────────────────────────

// Print rules ship with the sheet component so the production's review modal
// and this folder print identically; the feedback widget is page-specific.
const PRINT_CSS = `${debriefPrintCss}
@media print {
  div:has(> button[aria-label^="Send feedback"]) { display: none !important; }
}
`

export function DebriefsPage() {
  const { productions, resolveUserName } = useApp()
  const { deals } = usePipeline()
  const toast = useToast()
  const [openSub, setOpenSub] = useState(null) // { production, submission }

  // ── Synthesis (Danny: "AI attached that can sort out concerns recorded by
  // multiple people"). Select debriefs → one merged review document.
  const [selectedIds, setSelectedIds] = useState(() => new Set())
  const [synthesis, setSynthesis] = useState(null)
  const [synthesizing, setSynthesizing] = useState(false)

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

  const toggleSelect = (id) => setSelectedIds(prev => {
    const next = new Set(prev)
    next.has(id) ? next.delete(id) : next.add(id)
    return next
  })
  const selectAll = () => setSelectedIds(new Set(submissions.map(x => x.submission.id)))
  const clearSelection = () => setSelectedIds(new Set())

  const runSynthesis = async () => {
    const chosen = submissions.filter(x => selectedIds.has(x.submission.id))
    if (chosen.length === 0) return
    setSynthesizing(true)
    setSynthesis(null)
    try {
      const result = await synthesizeDebriefs(chosen.map(({ production: p, submission: s }) => ({
        production: p.name || '',
        client: p.client || '',
        submittedByName: resolveUserName(s.submittedBy) || s.submittedByName || 'Unknown',
        submittedAt: s.submittedAt || '',
        // The stored text snapshot is the source of truth for what was filed.
        text: s.doc || '',
      })))
      setSynthesis({ result, count: chosen.length })
    } catch (err) {
      toast.error(
        err?.status === 503
          ? 'AI synthesis isn\'t deployed yet — run the function deploy.'
          : `Couldn't synthesize — ${err?.message || 'unknown error'}`,
      )
    } finally {
      setSynthesizing(false)
    }
  }

  return (
    <div className="max-w-4xl mx-auto px-3 sm:px-4 lg:px-6 py-5">
      <style>{PRINT_CSS}</style>
      <div className="no-print">
        <p className="hud-label mb-1">WRAP REPORTS</p>
        <h1 className="text-xl sm:text-2xl font-semibold text-orbital-text tracking-tight mb-1">Debriefs</h1>
        <p className="text-sm text-orbital-subtle mb-4">
          Every submitted debrief, reviewed together — add-on charges up front so nothing
          misses collection. Submit from a production&apos;s Debrief tab.
        </p>

        {/* Synthesis bar — pick debriefs, get one merged review document */}
        {submissions.length > 0 && (
          <div className="card-elevated p-3 mb-5 flex items-center gap-2 flex-wrap">
            <Sparkles size={14} style={{ color: 'var(--accent-bright)' }} className="flex-shrink-0" />
            <p className="text-[12px] text-orbital-subtle flex-1 min-w-[180px]">
              {selectedIds.size === 0
                ? 'Select debriefs to merge them into one review — wins, issues, things learned, money to collect.'
                : `${selectedIds.size} selected.`}
            </p>
            <button
              onClick={selectedIds.size === submissions.length ? clearSelection : selectAll}
              className="btn-ghost text-xs"
            >
              {selectedIds.size === submissions.length ? 'Clear' : 'Select all'}
            </button>
            <button
              onClick={runSynthesis}
              disabled={selectedIds.size === 0 || synthesizing}
              className="btn-primary text-xs"
            >
              <Sparkles size={13} />
              {synthesizing ? 'Synthesizing…' : 'Synthesize'}
            </button>
          </div>
        )}
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
              <div key={s.id} className="card-elevated flex items-stretch">
                {/* Selection sits OUTSIDE the open button — nested buttons are
                    invalid, and picking for synthesis shouldn't open the doc. */}
                <button
                  onClick={() => toggleSelect(s.id)}
                  className="pl-4 pr-1 flex items-center flex-shrink-0 transition-colors"
                  style={{ color: selectedIds.has(s.id) ? 'var(--accent-bright)' : 'var(--orbital-dim)' }}
                  aria-pressed={selectedIds.has(s.id)}
                  title={selectedIds.has(s.id) ? 'Remove from synthesis' : 'Include in synthesis'}
                >
                  {selectedIds.has(s.id) ? <CheckSquare size={16} /> : <Square size={16} />}
                </button>
                <div className="flex-1 min-w-0">
                <button
                  onClick={() => setOpenSub({ production: p, submission: s })}
                  className="w-full flex items-center gap-3 pl-2 pr-4 py-3 text-left hover:bg-orbital-muted transition-colors"
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
                <div className="flex items-center gap-3 pl-2 pr-4 pb-2.5 -mt-1">
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
              </div>
            )
          })}
        </div>
      )}

      {/* Synthesis viewer — the merged review across the selected debriefs */}
      {synthesis && (
        <div className="fixed inset-0 z-50 no-print-overlay">
          <button
            className="absolute inset-0 no-print"
            style={{ background: 'rgba(0,0,0,0.6)' }}
            onClick={() => setSynthesis(null)}
            aria-label="Close"
          />
          <div
            className="relative max-w-2xl mx-auto mt-6 mb-6 rounded-lg flex flex-col max-h-[90vh]"
            style={{ background: 'var(--orbital-surface)', border: '1px solid var(--orbital-border)' }}
          >
            <div className="no-print flex items-center justify-between px-4 py-2.5" style={{ borderBottom: '1px solid var(--orbital-border)' }}>
              <p className="hud-label">DEBRIEF REVIEW — {synthesis.count} SOURCE{synthesis.count === 1 ? '' : 'S'}</p>
              <div className="flex items-center gap-2">
                <button onClick={() => window.print()} className="btn-secondary text-xs">
                  <Printer size={13} /> Print / PDF
                </button>
                <button
                  onClick={() => setSynthesis(null)}
                  className="p-2 text-orbital-subtle hover:text-orbital-text"
                  aria-label="Close"
                >
                  <X size={16} />
                </button>
              </div>
            </div>
            <SynthesisSheet synthesis={synthesis.result} count={synthesis.count} />
          </div>
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
            {/* Submissions filed before the formatted sheet shipped only carry
                the plain-text doc — render that rather than showing nothing. */}
            {openSub.submission.data ? (
              <DebriefSheet
                data={openSub.submission.data}
                submittedByName={resolveUserName(openSub.submission.submittedBy) || openSub.submission.submittedByName}
                submittedAt={openSub.submission.submittedAt}
              />
            ) : (
              <pre className="debrief-sheet p-5 text-xs text-orbital-text whitespace-pre-wrap overflow-y-auto font-mono">
                {openSub.submission.doc}
              </pre>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
