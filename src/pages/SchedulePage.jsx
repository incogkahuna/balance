import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  startOfWeek, endOfWeek, startOfMonth, endOfMonth,
  eachDayOfInterval, format, parseISO, isWithinInterval,
  addWeeks, subWeeks, addMonths, subMonths, isSameDay,
  differenceInDays, max, min
} from 'date-fns'
import { ChevronLeft, ChevronRight, Users, MapPin } from 'lucide-react'
import { useApp } from '../context/AppContext.jsx'
import { USERS, PRODUCTION_STATUS } from '../data/models.js'
import { StatusBadge } from '../components/ui/StatusBadge.jsx'
import { TopBar } from '../components/layout/TopBar.jsx'
import clsx from 'clsx'

const STATUS_COLORS = {
  [PRODUCTION_STATUS.INCOMING]:  { bg: 'bg-blue-500', text: 'text-blue-400', bar: '#3b82f6' },
  [PRODUCTION_STATUS.ACTIVE]:    { bg: 'bg-green-500', text: 'text-green-400', bar: '#22c55e' },
  [PRODUCTION_STATUS.WRAP]:      { bg: 'bg-amber-500', text: 'text-amber-400', bar: '#f59e0b' },
  [PRODUCTION_STATUS.COMPLETED]: { bg: 'bg-zinc-500', text: 'text-zinc-400', bar: '#71717a' },
}

export function SchedulePage() {
  const [view, setView] = useState('week')  // 'week' | 'month'
  const [mode, setMode] = useState('team')  // 'team' | 'stage'
  const [reference, setReference] = useState(new Date())
  const navigate = useNavigate()

  const { productions } = useApp()

  // Date range
  const range = useMemo(() => {
    if (view === 'week') {
      return {
        start: startOfWeek(reference, { weekStartsOn: 1 }),
        end: endOfWeek(reference, { weekStartsOn: 1 }),
      }
    } else {
      return {
        start: startOfMonth(reference),
        end: endOfMonth(reference),
      }
    }
  }, [view, reference])

  const days = useMemo(() =>
    eachDayOfInterval({ start: range.start, end: range.end }),
    [range]
  )

  const navigate_ = (dir) => {
    if (view === 'week') {
      setReference(r => dir === 'prev' ? subWeeks(r, 1) : addWeeks(r, 1))
    } else {
      setReference(r => dir === 'prev' ? subMonths(r, 1) : addMonths(r, 1))
    }
  }

  // Productions that overlap the visible range
  const visibleProductions = useMemo(() =>
    productions.filter(p => {
      if (!p.startDate || !p.endDate) return false
      const start = parseISO(p.startDate)
      const end = parseISO(p.endDate)
      return start <= range.end && end >= range.start
    }),
    [productions, range]
  )

  // Team rows: one row per user, bars = productions they're on
  const teamRows = USERS.map(user => ({
    user,
    productions: visibleProductions.filter(p =>
      p.assignedMembers.some(m => m.userId === user.id)
    ),
  })).filter(row => row.productions.length > 0)

  // Stage rows
  const stageMap = {}
  visibleProductions.forEach(p => {
    const key = p.locationType === 'In-House (Orbital Studios)'
      ? 'Orbital Studios (In-House)'
      : (p.locationAddress || 'Mobile — Unknown Stage')
    if (!stageMap[key]) stageMap[key] = []
    stageMap[key].push(p)
  })
  const stageRows = Object.entries(stageMap).map(([name, prods]) => ({ name, productions: prods }))

  const today = new Date()

  return (
    <div>
      <TopBar />
      <div className="max-w-6xl mx-auto px-4 lg:px-8 py-6 lg:py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-6 gap-4 flex-wrap">
          <h1 className="text-xl font-bold text-orbital-text">Schedule</h1>

          {/* Controls */}
          <div className="flex items-center gap-3 flex-wrap">
            {/* Mode toggle */}
            <div className="flex rounded-lg border border-orbital-border overflow-hidden">
              {[['team', Users, 'Team'], ['stage', MapPin, 'Stage']].map(([val, Icon, label]) => (
                <button
                  key={val}
                  onClick={() => setMode(val)}
                  className={clsx(
                    'flex items-center gap-1.5 px-3 py-2 text-sm font-medium transition-colors',
                    mode === val
                      ? 'bg-blue-600 text-white'
                      : 'bg-orbital-surface text-orbital-subtle hover:text-orbital-text'
                  )}
                >
                  <Icon size={14} />{label}
                </button>
              ))}
            </div>

            {/* View toggle */}
            <div className="flex rounded-lg border border-orbital-border overflow-hidden">
              {['week', 'month'].map(v => (
                <button
                  key={v}
                  onClick={() => setView(v)}
                  className={clsx(
                    'px-3 py-2 text-sm font-medium capitalize transition-colors',
                    view === v
                      ? 'bg-blue-600 text-white'
                      : 'bg-orbital-surface text-orbital-subtle hover:text-orbital-text'
                  )}
                >
                  {v}
                </button>
              ))}
            </div>

            {/* Navigation */}
            <div className="flex items-center gap-1">
              <button onClick={() => navigate_('prev')} className="btn-ghost p-2">
                <ChevronLeft size={16} />
              </button>
              <span className="text-sm font-medium text-orbital-text px-2 whitespace-nowrap">
                {view === 'week'
                  ? `${format(range.start, 'MMM d')} – ${format(range.end, 'MMM d, yyyy')}`
                  : format(reference, 'MMMM yyyy')
                }
              </span>
              <button onClick={() => navigate_('next')} className="btn-ghost p-2">
                <ChevronRight size={16} />
              </button>
              <button
                onClick={() => setReference(new Date())}
                className="btn-ghost text-xs px-2 py-1.5 ml-1"
              >
                Today
              </button>
            </div>
          </div>
        </div>

        {/* Gantt chart */}
        <div className="card overflow-hidden">
          <GanttChart
            days={days}
            rows={mode === 'team' ? teamRows : stageRows}
            mode={mode}
            today={today}
            range={range}
            onClickProduction={(prodId) => navigate(`/productions/${prodId}`)}
          />
        </div>

        {/* Legend */}
        <div className="flex flex-wrap gap-4 mt-4">
          {Object.entries(STATUS_COLORS).map(([status, colors]) => (
            <div key={status} className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded" style={{ backgroundColor: colors.bar }} />
              <span className="text-xs text-orbital-subtle">{status}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function GanttChart({ days, rows, mode, today, range, onClickProduction }) {
  const LABEL_WIDTH = 140
  const DAY_WIDTH = Math.max(28, Math.min(48, Math.floor((800 - LABEL_WIDTH) / days.length)))

  if (rows.length === 0) {
    return (
      <div className="p-12 text-center">
        <p className="text-orbital-subtle text-sm">
          No productions scheduled in this {days.length <= 7 ? 'week' : 'month'}.
        </p>
      </div>
    )
  }

  return (
    <div className="overflow-x-auto">
      <div style={{ minWidth: LABEL_WIDTH + days.length * DAY_WIDTH }}>
        {/* Header: day labels */}
        <div className="flex border-b border-orbital-border sticky top-0 bg-orbital-surface z-10">
          <div style={{ width: LABEL_WIDTH, minWidth: LABEL_WIDTH }} className="px-4 py-3 flex-shrink-0">
            <span className="text-xs text-orbital-subtle font-medium">
              {mode === 'team' ? 'Team Member' : 'Location'}
            </span>
          </div>
          {days.map(day => {
            const isToday = isSameDay(day, today)
            return (
              <div
                key={day.toISOString()}
                style={{ width: DAY_WIDTH, minWidth: DAY_WIDTH }}
                className={clsx(
                  'flex-shrink-0 text-center py-3 border-l border-orbital-border',
                  isToday ? 'bg-blue-600/10' : ''
                )}
              >
                <div className={clsx('text-xs', isToday ? 'text-blue-400 font-bold' : 'text-orbital-subtle')}>
                  {format(day, days.length <= 7 ? 'EEE' : 'd')}
                </div>
                {days.length <= 7 && (
                  <div className={clsx('text-xs mt-0.5', isToday ? 'text-blue-400' : 'text-orbital-subtle opacity-60')}>
                    {format(day, 'd')}
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {/* Rows */}
        {rows.map((row, rowIdx) => {
          const label = mode === 'team' ? row.user?.name : row.name
          const sublabel = mode === 'team' ? row.user?.role : null

          return (
            <div
              key={label}
              className={clsx(
                'flex relative',
                rowIdx % 2 === 0 ? '' : 'bg-white/[0.015]'
              )}
            >
              {/* Label */}
              <div
                style={{ width: LABEL_WIDTH, minWidth: LABEL_WIDTH }}
                className="px-4 py-4 flex-shrink-0 border-b border-orbital-border flex items-center gap-2"
              >
                {mode === 'team' && row.user && (
                  <div
                    className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
                    style={{ backgroundColor: row.user.color }}
                  >
                    {row.user.avatar}
                  </div>
                )}
                {mode === 'stage' && (
                  <div className="w-7 h-7 rounded-full bg-orbital-muted flex items-center justify-center flex-shrink-0">
                    <MapPin size={12} className="text-orbital-subtle" />
                  </div>
                )}
                <div className="min-w-0">
                  <p className="text-xs font-medium text-orbital-text truncate">{label}</p>
                  {sublabel && <p className="text-xs text-orbital-subtle capitalize truncate">{sublabel}</p>}
                </div>
              </div>

              {/* Grid cells */}
              <div className="flex flex-1 relative border-b border-orbital-border" style={{ height: 56 }}>
                {days.map(day => {
                  const isToday = isSameDay(day, today)
                  return (
                    <div
                      key={day.toISOString()}
                      style={{ width: DAY_WIDTH, minWidth: DAY_WIDTH }}
                      className={clsx(
                        'flex-shrink-0 border-l border-orbital-border h-full',
                        isToday ? 'bg-blue-600/8' : ''
                      )}
                    />
                  )
                })}

                {/* Production bars */}
                {row.productions.map(prod => {
                  const prodStart = parseISO(prod.startDate)
                  const prodEnd = parseISO(prod.endDate)
                  const visStart = max([prodStart, range.start])
                  const visEnd = min([prodEnd, range.end])

                  const offsetDays = differenceInDays(visStart, range.start)
                  const spanDays = differenceInDays(visEnd, visStart) + 1
                  const colors = STATUS_COLORS[prod.status] || STATUS_COLORS[PRODUCTION_STATUS.INCOMING]

                  const left = offsetDays * DAY_WIDTH
                  const width = spanDays * DAY_WIDTH - 4

                  return (
                    <button
                      key={prod.id}
                      title={`${prod.name}\n${prod.client}`}
                      onClick={() => onClickProduction(prod.id)}
                      style={{
                        position: 'absolute',
                        left: left + 2,
                        width: Math.max(width, 20),
                        top: '50%',
                        transform: 'translateY(-50%)',
                        height: 28,
                        backgroundColor: colors.bar + '33',
                        borderLeft: `3px solid ${colors.bar}`,
                      }}
                      className="rounded-r-md flex items-center px-2 hover:brightness-125 transition-all z-10 group"
                    >
                      <span className="text-xs font-medium truncate" style={{ color: colors.bar }}>
                        {spanDays * DAY_WIDTH > 60 ? prod.name : ''}
                      </span>
                    </button>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
