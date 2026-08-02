import { Trophy, AlertTriangle, Lightbulb, DollarSign, Users } from 'lucide-react'

// ─────────────────────────────────────────────────────────────────────────────
// SynthesisSheet — the AI-merged review across many debriefs.
//
// Danny asked for concerns "recorded by multiple people" to be sorted into
// production wins, production issues, and things learned. The value is the
// MERGE: one item per underlying thing, carrying every production and person
// that raised it, ordered most-repeated first. A "×3" badge means three
// separate debriefs said it — that's the signal worth acting on.
//
// Money gets its own category because an add-on named in a debrief that never
// reaches collection is the expensive failure mode.
//
// Shares the .debrief-sheet print styling so this prints as cleanly as a
// single debrief does.
// ─────────────────────────────────────────────────────────────────────────────

const CATEGORIES = [
  { key: 'wins',      title: 'Production wins',   icon: Trophy,        color: '#22c55e' },
  { key: 'issues',    title: 'Production issues', icon: AlertTriangle, color: '#f87171' },
  { key: 'learnings', title: 'Things learned',    icon: Lightbulb,     color: '#fbbf24' },
  { key: 'money',     title: 'To collect',        icon: DollarSign,    color: '#55c9ef' },
]

function Item({ item, color }) {
  return (
    <div className="pl-3 py-1.5" style={{ borderLeft: `2px solid ${color}` }}>
      <div className="flex items-baseline gap-2 flex-wrap">
        <p className="text-[13px] font-medium">{item.title}</p>
        {item.recurrence > 1 && (
          <span
            className="text-[10px] font-telemetry tracking-wider px-1.5 py-0.5 rounded-sm"
            style={{ color, border: `1px solid ${color}66` }}
            title={`Raised in ${item.recurrence} separate debriefs`}
          >
            ×{item.recurrence}
          </span>
        )}
      </div>
      {item.detail && (
        <p className="text-[12px] leading-relaxed sheet-muted mt-0.5">{item.detail}</p>
      )}
      {(item.productions.length > 0 || item.reportedBy.length > 0) && (
        <p className="text-[10px] sheet-muted mt-1 flex items-center gap-1.5 flex-wrap">
          {item.productions.length > 0 && <span>{item.productions.join(' · ')}</span>}
          {item.reportedBy.length > 0 && (
            <>
              <Users size={9} className="flex-shrink-0" />
              <span>{item.reportedBy.join(', ')}</span>
            </>
          )}
        </p>
      )}
    </div>
  )
}

export function SynthesisSheet({ synthesis, count }) {
  if (!synthesis) return null
  const populated = CATEGORIES.filter(c => (synthesis[c.key] || []).length > 0)

  return (
    <div className="debrief-sheet px-6 py-6 overflow-y-auto text-orbital-text">
      <header className="pb-4" style={{ borderBottom: '2px solid var(--orbital-border)' }}>
        <p className="text-[10px] font-telemetry tracking-[0.2em] uppercase sheet-muted">
          Orbital Studios · Debrief Review
        </p>
        <h2 className="text-2xl font-semibold tracking-tight mt-1.5">
          Across {count} debrief{count === 1 ? '' : 's'}
        </h2>
        {synthesis.summary && (
          <p className="text-[13px] leading-relaxed mt-2.5">{synthesis.summary}</p>
        )}
      </header>

      {populated.length === 0 ? (
        <p className="text-[13px] sheet-muted mt-6">
          Nothing clustered out of these debriefs — there may not be enough written
          detail in them yet.
        </p>
      ) : (
        populated.map(({ key, title, icon: Icon, color }) => (
          <section key={key} className="mt-5">
            <h3
              className="text-[11px] font-telemetry tracking-[0.12em] uppercase mb-2 flex items-center gap-1.5"
              style={{ color }}
            >
              <Icon size={12} /> {title}
              <span className="sheet-muted">({synthesis[key].length})</span>
            </h3>
            <div className="space-y-1.5">
              {synthesis[key].map((item, i) => (
                <Item key={`${key}-${i}`} item={item} color={color} />
              ))}
            </div>
          </section>
        ))
      )}

      <p className="text-[10px] sheet-muted mt-6 pt-3" style={{ borderTop: '1px solid var(--orbital-border)' }}>
        Synthesized by Claude from the submitted debriefs. Every item traces back to
        what people actually wrote — check the source debriefs before acting on anything
        contested.
      </p>
    </div>
  )
}
