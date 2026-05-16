import { useState } from 'react'
import { ResourceRiver } from '../features/prototype/ResourceRiver.jsx'
import { Constellation } from '../features/prototype/Constellation.jsx'

const VIEWS = [
  { id: 'constellation', label: 'Constellation' },
  { id: 'river',     label: 'Resource River' },
]

export function PrototypePage() {
  const [view, setView] = useState('constellation')

  return (
    <div className="min-h-screen pb-12">
      {/* ── View switcher ─────────────────────────────────────────────── */}
      <div
        className="sticky top-0 z-20 flex items-center justify-between px-6 py-3"
        style={{
          background: 'var(--orbital-bg)',
          borderBottom: '1px solid var(--orbital-border)',
        }}
      >
        <div className="flex items-center gap-3">
          <span className="font-telemetry text-[9px] text-orbital-subtle tracking-[0.25em]">
            PROTOTYPE · RESOURCE ALLOCATION
          </span>
          <span className="px-2 py-0.5 font-telemetry text-[9px] tracking-widest"
            style={{
              background: 'rgba(232,121,249,0.12)',
              border: '1px solid rgba(232,121,249,0.4)',
              color: '#e879f9',
            }}>
            PITCH RENDER
          </span>
        </div>

        <div
          className="relative flex items-center"
          style={{
            background: 'var(--orbital-muted)',
            border: '1px solid var(--orbital-border)',
          }}
        >
          {VIEWS.map(v => (
            <button
              key={v.id}
              onClick={() => setView(v.id)}
              className="relative px-4 py-1.5 text-[12px] font-medium tracking-wide transition-colors"
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

      {/* ── Content ───────────────────────────────────────────────────── */}
      <div className="animate-hud-in" key={view}>
        {view === 'river' && <ResourceRiver />}
        {view === 'constellation' && <Constellation />}
      </div>
    </div>
  )
}
