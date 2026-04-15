import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { format, parseISO, addDays, isToday, isTomorrow } from 'date-fns'
import { Calendar } from 'lucide-react'
import { useApp } from '../../../context/AppContext.jsx'
import { PRODUCTION_STATUS } from '../../../data/models.js'
import { MILESTONE_TYPE_CONFIG } from './roadmapUtils.js'
import clsx from 'clsx'

const HORIZON_DAYS = 7

export function UpcomingMilestones() {
  const { productions, resolveAssignee } = useApp()
  const navigate = useNavigate()

  const upcoming = useMemo(() => {
    const now      = new Date()
    const horizon  = addDays(now, HORIZON_DAYS)
    const results  = []

    productions
      .filter(p => p.status === PRODUCTION_STATUS.ACTIVE || p.status === PRODUCTION_STATUS.INCOMING)
      .forEach(p => {
        (p.roadmap?.milestones || []).forEach(m => {
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
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-semibold text-orbital-text flex items-center gap-2">
          <Calendar size={16} className="text-orbital-subtle" />
          Upcoming This Week
        </h2>
        <span className="text-xs text-orbital-subtle">{upcoming.length} milestone{upcoming.length !== 1 ? 's' : ''}</span>
      </div>

      <div className="space-y-2">
        {upcoming.slice(0, 7).map(m => {
          const d       = parseISO(m.date)
          const typeCfg = MILESTONE_TYPE_CONFIG[m.type] || MILESTONE_TYPE_CONFIG['Pre-Production']
          const owner   = m.ownerId ? resolveAssignee(m.ownerId) : null

          const dateLabel = isToday(d)
            ? 'Today'
            : isTomorrow(d)
            ? 'Tomorrow'
            : format(d, 'EEE MMM d')

          return (
            <div
              key={`${m.productionId}-${m.id}`}
              onClick={() => navigate(`/productions/${m.productionId}?tab=Roadmap`)}
              className="card p-3.5 cursor-pointer hover:border-orbital-muted transition-colors active:scale-[0.99]"
            >
              <div className="flex items-center gap-3">
                {/* Color indicator */}
                <div
                  className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                  style={{ backgroundColor: typeCfg.color }}
                />

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-orbital-text truncate">{m.title}</p>
                  <p className="text-xs text-orbital-subtle truncate">{m.productionName}</p>
                </div>

                {/* Right side */}
                <div className="text-right flex-shrink-0">
                  <p className={clsx(
                    'text-xs font-medium',
                    isToday(d) ? 'text-amber-400' : 'text-orbital-subtle'
                  )}>
                    {dateLabel}
                  </p>
                  {owner && (
                    <p className="text-xs text-orbital-subtle">{owner.name}</p>
                  )}
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </section>
  )
}
