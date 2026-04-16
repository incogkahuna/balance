import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { format, parseISO, addDays, isToday, isTomorrow } from 'date-fns'
import { useApp } from '../../../context/AppContext.jsx'
import { PRODUCTION_STATUS } from '../../../data/models.js'
import { MILESTONE_TYPE_CONFIG } from './roadmapUtils.js'
import clsx from 'clsx'

const HORIZON_DAYS = 7

export function UpcomingMilestones() {
  const { productions, resolveAssignee } = useApp()
  const navigate = useNavigate()

  const upcoming = useMemo(() => {
    const now     = new Date()
    const horizon = addDays(now, HORIZON_DAYS)
    const results = []

    productions
      .filter(p => p.status === PRODUCTION_STATUS.ACTIVE || p.status === PRODUCTION_STATUS.INCOMING)
      .forEach(p => {
        ;(p.roadmap?.milestones || []).forEach(m => {
          if (!m.date) return
          const d = parseISO(m.date)
          if (d >= now && d <= horizon && m.status !== 'Complete') {
            results.push({ ...m, productionId: p.id, productionName: p.name })
          }
        })
      })

    return results.sort((a, b) => a.date.localeCompare(b.date))
  }, [productions])

  if (upcoming.length === 0) return null

  return (
    <section>
      {/* Section header — matches DashboardPage SectionHeader style */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="w-0.5 h-3" style={{ background: '#3b82f6' }} />
          <h2 className="text-xs font-semibold uppercase tracking-widest text-orbital-subtle"
            style={{ letterSpacing: '0.08em' }}>
            Upcoming Milestones
          </h2>
        </div>
        <span className="text-[11px] text-orbital-dim">
          {upcoming.length} {upcoming.length !== 1 ? 'items' : 'item'} · 7-day horizon
        </span>
      </div>

      <div className="card divide-y" style={{ borderColor: 'var(--orbital-border)' }}>
        {upcoming.slice(0, 7).map(m => {
          const d       = parseISO(m.date)
          const typeCfg = MILESTONE_TYPE_CONFIG[m.type] || MILESTONE_TYPE_CONFIG['Pre-Production']
          const owner   = m.ownerId ? resolveAssignee(m.ownerId) : null

          return (
            <div
              key={`${m.productionId}-${m.id}`}
              onClick={() => navigate(`/productions/${m.productionId}?tab=Roadmap`)}
              className="flex items-center gap-3 px-3 py-2.5 cursor-pointer hover:bg-orbital-panel transition-colors"
              style={{ borderLeft: `2px solid ${typeCfg.color}` }}
            >
              {/* Info */}
              <div className="flex-1 min-w-0">
                <p className="text-sm text-orbital-text truncate">{m.title}</p>
                <p className="text-[11px] text-orbital-subtle mt-0.5 truncate">{m.productionName}</p>
              </div>

              {/* Date + owner */}
              <div className="text-right flex-shrink-0">
                <p className={clsx(
                  'text-xs font-medium',
                  isToday(d)    ? 'text-amber-400' :
                  isTomorrow(d) ? 'text-blue-400'  :
                  'text-orbital-subtle'
                )}>
                  {isToday(d)
                    ? 'Today'
                    : isTomorrow(d)
                    ? 'Tomorrow'
                    : format(d, 'EEE MMM d')}
                </p>
                {owner && (
                  <p className="text-[11px] text-orbital-dim mt-0.5">{owner.name}</p>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </section>
  )
}
