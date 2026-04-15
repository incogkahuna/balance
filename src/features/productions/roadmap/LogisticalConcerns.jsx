import { useState, useMemo } from 'react'
import { Plus, Filter } from 'lucide-react'
import { CONCERN_IMPACT, CONCERN_STATUS, CONCERN_CATEGORY } from '../../../data/models.js'
import { ConcernCard } from './ConcernCard.jsx'
import clsx from 'clsx'

const IMPACT_ORDER = {
  [CONCERN_IMPACT.CRITICAL]: 0,
  [CONCERN_IMPACT.HIGH]:     1,
  [CONCERN_IMPACT.MEDIUM]:   2,
  [CONCERN_IMPACT.LOW]:      3,
}

export function LogisticalConcerns({ concerns, canEdit, onAdd, onEdit, onDelete }) {
  const [showResolved, setShowResolved] = useState(false)
  const [filterCategory, setFilterCategory] = useState('all')

  const isResolved = (c) =>
    c.status === CONCERN_STATUS.RESOLVED || c.status === CONCERN_STATUS.ACCEPTED

  const activeCount   = concerns.filter(c => !isResolved(c)).length
  const resolvedCount = concerns.filter(c => isResolved(c)).length

  const categories = useMemo(() => {
    const cats = new Set(concerns.map(c => c.category))
    return ['all', ...Array.from(cats).sort()]
  }, [concerns])

  const filtered = useMemo(() => {
    return concerns
      .filter(c => {
        if (!showResolved && isResolved(c)) return false
        if (filterCategory !== 'all' && c.category !== filterCategory) return false
        return true
      })
      .sort((a, b) => {
        // Sort by resolved last, then by impact
        const aResolved = isResolved(a) ? 1 : 0
        const bResolved = isResolved(b) ? 1 : 0
        if (aResolved !== bResolved) return aResolved - bResolved
        return (IMPACT_ORDER[a.impactLevel] ?? 9) - (IMPACT_ORDER[b.impactLevel] ?? 9)
      })
  }, [concerns, showResolved, filterCategory])

  if (concerns.length === 0) {
    return (
      <div className="text-center py-16">
        <div className="w-12 h-12 rounded-xl bg-orbital-muted flex items-center justify-center mx-auto mb-3">
          <span className="text-2xl">🔧</span>
        </div>
        <p className="text-orbital-text font-medium mb-1">No logistical concerns logged</p>
        <p className="text-sm text-orbital-subtle mb-4">
          Document operational challenges, transport issues, and technical requirements here.
        </p>
        {canEdit && (
          <button onClick={onAdd} className="btn-primary">
            <Plus size={15} /> Log First Concern
          </button>
        )}
      </div>
    )
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <h3 className="font-semibold text-orbital-text">Logistical Concerns</h3>
          {activeCount > 0 && (
            <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400 text-xs font-medium">
              {activeCount} open
            </span>
          )}
        </div>
        {canEdit && (
          <button onClick={onAdd} className="btn-ghost text-xs py-1.5">
            <Plus size={13} /> Add Concern
          </button>
        )}
      </div>

      {/* Filters */}
      {categories.length > 2 && (
        <div className="flex gap-2 mb-4 overflow-x-auto pb-1">
          {categories.map(cat => (
            <button
              key={cat}
              onClick={() => setFilterCategory(cat)}
              className={clsx(
                'px-2.5 py-1 rounded-lg text-xs whitespace-nowrap transition-colors flex-shrink-0',
                filterCategory === cat
                  ? 'bg-blue-600 text-white'
                  : 'bg-orbital-surface border border-orbital-border text-orbital-subtle hover:text-orbital-text'
              )}
            >
              {cat === 'all' ? 'All' : cat}
            </button>
          ))}
        </div>
      )}

      {/* Concern cards */}
      <div className="space-y-3">
        {filtered.map(concern => (
          <ConcernCard
            key={concern.id}
            concern={concern}
            canEdit={canEdit}
            onEdit={() => onEdit(concern)}
            onDelete={() => onDelete(concern.id)}
          />
        ))}
      </div>

      {/* Show / hide resolved */}
      {resolvedCount > 0 && (
        <button
          onClick={() => setShowResolved(s => !s)}
          className="mt-4 text-xs text-orbital-subtle hover:text-orbital-text transition-colors flex items-center gap-1"
        >
          {showResolved ? '▲ Hide' : '▼ Show'} {resolvedCount} resolved concern{resolvedCount !== 1 ? 's' : ''}
        </button>
      )}
    </div>
  )
}
