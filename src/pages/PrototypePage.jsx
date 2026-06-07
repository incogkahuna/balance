import { useState } from 'react'
import { Constellation } from '../features/prototype/Constellation.jsx'
import { GravMap } from '../features/prototype/GravMap.jsx'
import { Gantt } from '../features/prototype/Gantt.jsx'
import { usePrototypeData } from '../features/prototype/dataSource.js'
import { Radio, Database } from 'lucide-react'

const VIEWS = [
  { id: 'gravmap',       label: 'Grav Map' },
  { id: 'constellation', label: 'Constellation' },
  { id: 'gantt',         label: 'Gantt' },
]

export function PrototypePage() {
  const [view, setView] = useState('gravmap')
  const data = usePrototypeData()

  return (
    <div className="min-h-screen pb-12">
      {/* ── View switcher — wraps to two rows on mobile so the view tabs
              get a full-width track underneath the page label. */}
      <div
        className="sticky top-0 z-20 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-4 px-4 sm:px-6 py-2.5 sm:py-3"
        style={{
          background: 'var(--orbital-bg)',
          borderBottom: '1px solid var(--orbital-border)',
        }}
      >
        <div className="flex items-center gap-3 flex-wrap">
          <span className="font-telemetry text-[9px] text-orbital-subtle tracking-[0.25em]">
            RESOURCES · LIVE ALLOCATION
          </span>
          <DataSourceBadge source={data.source} />
        </div>

        <div
          className="flex items-center overflow-x-auto"
          style={{
            background: 'var(--orbital-muted)',
            border: '1px solid var(--orbital-border)',
          }}
        >
          {VIEWS.map(v => (
            <button
              key={v.id}
              onClick={() => setView(v.id)}
              className="relative px-4 py-2 sm:py-1.5 text-[12px] font-medium tracking-wide whitespace-nowrap transition-colors flex-1 sm:flex-initial"
              style={{
                color: view === v.id ? '#fff' : 'var(--orbital-subtle)',
                background: view === v.id ? '#2563eb' : 'transparent',
                boxShadow: view === v.id ? '0 0 12px rgba(59,130,246,0.45)' : 'none',
              }}
            >
              {v.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Live snapshot — proof that real assignments are flowing in ── */}
      {data.source === 'live' && <LiveSnapshot data={data} />}

      {/* ── Content ───────────────────────────────────────────────────── */}
      <div className="animate-hud-in" key={view}>
        {view === 'gravmap' && <GravMap />}
        {view === 'constellation' && <Constellation />}
        {view === 'gantt' && <Gantt />}
      </div>
    </div>
  )
}

// ── Telemetric badge surfaced in the toolbar ───────────────────────────────
function DataSourceBadge({ source }) {
  if (source === 'live') {
    return (
      <span className="px-2 py-0.5 font-telemetry text-[9px] tracking-widest inline-flex items-center gap-1.5"
        style={{
          background: 'rgba(52,211,153,0.12)',
          border: '1px solid rgba(52,211,153,0.45)',
          color: '#34d399',
        }}>
        <Radio size={9} />
        LIVE DATA
      </span>
    )
  }
  return (
    <span className="px-2 py-0.5 font-telemetry text-[9px] tracking-widest inline-flex items-center gap-1.5"
      style={{
        background: 'rgba(232,121,249,0.12)',
        border: '1px solid rgba(232,121,249,0.4)',
        color: '#e879f9',
      }}>
      <Database size={9} />
      SEED DATA
    </span>
  )
}

// ── Live snapshot panel ────────────────────────────────────────────────────
// Rendered when the adapter detected real productions in AppContext. Shows
// what the visualizations *would* render once they're refactored to consume
// the adapter — in the meantime it proves milestone assignments are landing
// where they need to.
function LiveSnapshot({ data }) {
  const { productions, resources, commitments } = data
  const conflictedResources = resources.filter(r => data.hasConflict(r.id))
  return (
    <div className="px-6 py-4 border-b" style={{ borderColor: 'var(--orbital-border)' }}>
      <div className="flex items-baseline justify-between mb-3">
        <p className="font-telemetry text-[10px] tracking-[0.22em] text-orbital-subtle">
          LIVE SNAPSHOT · DERIVED FROM YOUR PRODUCTIONS + MILESTONES
        </p>
        <p className="font-telemetry text-[9px] tracking-wider text-orbital-dim">
          {data.windowDays} DAY WINDOW · {format(data.windowStart)} → {format(data.windowEnd)}
        </p>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-3">
        <StatCell label="PRODUCTIONS" value={productions.length} accent="#60a5fa" />
        <StatCell label="PEOPLE TRACKED" value={resources.length} accent="#34d399" />
        <StatCell label="COMMITMENTS" value={commitments.length} accent="#fbbf24" />
        <StatCell
          label="CONFLICTS"
          value={conflictedResources.length}
          accent={conflictedResources.length > 0 ? '#ef4444' : '#71717a'}
        />
      </div>
      <p className="text-[11px] text-orbital-dim leading-relaxed">
        <strong className="text-orbital-subtle">Gantt</strong> and <strong className="text-orbital-subtle">Grav Map</strong> render
        live data — switch tabs to see your real productions and milestone assignments.{' '}
        <strong className="text-orbital-subtle">Constellation</strong> still uses the curated demo
        dataset (its 4-corner layout is hardcoded for 4 productions).
      </p>
    </div>
  )
}

function StatCell({ label, value, accent }) {
  return (
    <div className="card-elevated px-3 py-2.5" style={{ borderTop: `2px solid ${accent}` }}>
      <p className="font-telemetry text-[9px] tracking-wider text-orbital-subtle mb-1">{label}</p>
      <p className="font-telemetry text-xl text-orbital-text tabular-nums">
        {String(value).padStart(2, '0')}
      </p>
    </div>
  )
}

function format(date) {
  if (!date) return ''
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }).toUpperCase()
}
