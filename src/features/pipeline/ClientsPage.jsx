import { useMemo, useState } from 'react'
import { Search, Users } from 'lucide-react'
import { usePipeline } from './PipelineContext.jsx'
import { ClientHistoryList, PipelineNoAccess } from './components.jsx'
import { fmtMoneyShort } from './quoteMath.js'

// ─────────────────────────────────────────────────────────────────────────────
// ClientsPage — the retrieval payback. Type a client name → every past deal:
// what was quoted, what it closed at, what discount was given and why,
// whether they paid, and whether old quotes have expired. This is the reason
// Brian feeds the system: it pays him back on his first use.
// ─────────────────────────────────────────────────────────────────────────────

export function ClientsPage() {
  const { ready, deals, money, canSeeMoney, pipelineRole } = usePipeline()
  const [search, setSearch] = useState('')

  const clients = useMemo(() => {
    const byName = new Map()
    for (const d of deals) {
      const key = d.clientCompany.trim()
      if (!key) continue
      const entry = byName.get(key.toLowerCase()) || {
        name: key, contact: '', dealCount: 0, wonCount: 0, totalActual: 0, lastAt: '',
      }
      entry.dealCount += 1
      if (d.status === 'green_light') entry.wonCount += 1
      if (d.clientContact) entry.contact = d.clientContact
      const m = money[d.id]
      if (m?.actualTotal) entry.totalActual += m.actualTotal
      else if (m?.agreedTotal && d.status === 'green_light') entry.totalActual += m.agreedTotal
      if ((d.createdAt || '') > entry.lastAt) entry.lastAt = d.createdAt || ''
      byName.set(key.toLowerCase(), entry)
    }
    const needle = search.trim().toLowerCase()
    return [...byName.values()]
      .filter((c) => !needle || c.name.toLowerCase().includes(needle))
      .sort((a, b) => b.lastAt.localeCompare(a.lastAt))
  }, [deals, money, search])

  const [openClient, setOpenClient] = useState(null)

  if (!pipelineRole) return <PipelineNoAccess />

  return (
    <div className="max-w-4xl mx-auto px-3 sm:px-4 lg:px-6 py-5">
      <p className="hud-label mb-1">JOB PIPELINE</p>
      <h1 className="text-xl sm:text-2xl font-semibold text-orbital-text tracking-tight mb-1">Clients</h1>
      <p className="text-sm text-orbital-subtle mb-4">
        Every past deal per client — quoted → agreed → actual, discounts and their labels, paid or not.
      </p>

      <div className="relative mb-5 max-w-md">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-orbital-dim" />
        <input className="input pl-9" autoFocus placeholder="Type a client name…"
          value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      {!ready ? null : clients.length === 0 ? (
        <div className="card-elevated p-8 text-center">
          <Users size={32} className="mx-auto text-orbital-dim mb-3" />
          <p className="text-sm text-orbital-subtle">No clients {search ? 'match' : 'yet'}.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {clients.map((c) => {
            const open = openClient === c.name.toLowerCase() || clients.length === 1 || !!search.trim()
            return (
              <div key={c.name} className="card-elevated">
                <button
                  className="w-full px-4 py-3 flex items-center justify-between gap-3 text-left"
                  onClick={() => setOpenClient(open && !search.trim() ? null : c.name.toLowerCase())}>
                  <div className="min-w-0">
                    <p className="text-[14px] font-semibold text-orbital-text truncate">{c.name}</p>
                    <p className="text-[11px] text-orbital-dim">
                      {c.dealCount} deal{c.dealCount === 1 ? '' : 's'} · {c.wonCount} green-lit
                      {c.contact ? ` · ${c.contact}` : ''}
                    </p>
                  </div>
                  {canSeeMoney && c.totalActual > 0 && (
                    <span className="font-telemetry text-[12px] text-orbital-subtle flex-shrink-0">
                      {fmtMoneyShort(c.totalActual)} lifetime
                    </span>
                  )}
                </button>
                {open && (
                  <div className="px-4 pb-3">
                    <ClientHistoryList company={c.name} />
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
