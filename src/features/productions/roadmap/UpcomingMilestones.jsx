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
      {/* Instrument panel section header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2.5">
          <div className="w-0.5 h-3.5 flex-shrink-0" style={{ background: 'rgba(14,165,233,0.65)' }} />
          <span className="font-telemetry text-[9px] tracking-[0.2em]" style={{ color: '#7090a8' }}>
            UPCOMING MILESTONES
          </span>
          <div className="h-px w-10"
            style={{ background: 'linear-gradient(90deg, rgba(255,255,255,0.07), transparent)' }} />
        </div>
        <span className="font-telemetry text-[8px] tracking-[0.1em]" style={{ color: '#4d6a82' }}>
          {upcoming.length} {upcoming.length !== 1 ? 'ITEMS' : 'ITEM'} · 7 DAY HORIZON
        </span>
      </div>

      <div className="space-y-1.5">
        {upcoming.slice(0, 7).map(m => {
          const d       = parseISO(m.date)
          const typeCfg = MILESTONE_TYPE_CONFIG[m.type] || MILESTONE_TYPE_CONFIG['Pre-Production']
          const owner   = m.ownerId ? resolveAssignee(m.ownerId) : null

          const dateLabel = isToday(d)
            ? 'TODAY'
            : isTomorrow(d)
            ? 'TOMORROW'
            : format(d, 'EEE MMM d').toUpperCase()

          return (
            <div
              key={`${m.productionId}-${m.id}`}
              onClick={() => navigate(`/productions/${m.productionId}?tab=Roadmap`)}
              className="card p-3 cursor-pointer transition-all active:scale-[0.99]"
              style={{ borderLeft: `2px solid ${typeCfg.color}` }}
            >
              <div className="flex items-center gap-3">
                {/* Type dot */}
                <div className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                  style={{ backgroundColor: typeCfg.color, boxShadow: `0 0 4px ${typeCfg.color}` }} />

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-orbital-text truncate">{m.title}</p>
                  <p className="font-telemetry text-[8px] tracking-[0.08em] mt-0.5" style={{ color: '#5a7a92' }}>
                    {m.productionName?.toUpperCase()}
                  </p>
                </div>

                {/* Date + owner */}
                <div className="text-right flex-shrink-0">
                  <p className={clsx(
                    'font-telemetry text-[9px] tracking-[0.08em]',
                    isToday(d) ? 'text-amber-400' : 'text-orbital-subtle'
                  )}>
                    {dateLabel}
                  </p>
                  {owner && (
                    <p className="font-telemetry text-[8px] tracking-[0.06em] mt-0.5" style={{ color: '#4d6a82' }}>
                      {owner.name?.toUpperCase()}
                    </p>
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
