import { useState, useEffect, useRef } from 'react'
import {
  startOfWeek, endOfWeek, startOfMonth, endOfMonth,
  eachDayOfInterval, format, isSameMonth, isSameDay,
  addMonths, subMonths,
} from 'date-fns'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import clsx from 'clsx'

// ─────────────────────────────────────────────────────────────────────────────
// MiniCalendar — compact month-view date picker with blue-dot indicators on
// days that have events. Replaces native <input type="date"> in places where
// we want to decorate the calendar (the browser's calendar can't be styled).
//
// Used by:
//   - SchedulePage (jump-to-date for the team/stage gantt)
//   - GravMap     (jump-to-date for the 3D scrubber)
//
// Props:
//   - selected   : Date currently selected (highlighted)
//   - eventDays  : Set<string> of 'yyyy-MM-dd' keys to mark with a blue dot
//   - onPick     : (date) => void — fires when the user picks a day
//   - onClose    : () => void — fires when the popover should close
//   - anchor     : 'center' (default) | 'right' — horizontal placement of the
//                  popover relative to its parent. Use 'right' when the
//                  parent sits in the right half of a tight row to avoid
//                  the calendar getting clipped.
// ─────────────────────────────────────────────────────────────────────────────

export function MiniCalendar({ selected, eventDays, onPick, onClose, anchor = 'center' }) {
  const [month, setMonth] = useState(() => startOfMonth(selected || new Date()))
  const wrapperRef = useRef(null)

  // Close on outside click. Delayed registration so the click that opened
  // the picker doesn't immediately close it.
  useEffect(() => {
    const onDocClick = (e) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
        onClose()
      }
    }
    const t = setTimeout(() => document.addEventListener('mousedown', onDocClick), 50)
    return () => { clearTimeout(t); document.removeEventListener('mousedown', onDocClick) }
  }, [onClose])

  const gridStart = startOfWeek(startOfMonth(month), { weekStartsOn: 1 })
  const gridEnd   = endOfWeek(endOfMonth(month),     { weekStartsOn: 1 })
  const days = eachDayOfInterval({ start: gridStart, end: gridEnd })
  const today = new Date()

  const anchorClass = anchor === 'right'
    ? 'absolute top-full right-0 mt-1'
    : 'absolute top-full left-1/2 -translate-x-1/2 mt-1'

  return (
    <div
      ref={wrapperRef}
      className={`${anchorClass} z-30 w-[280px] p-3 rounded-lg shadow-xl`}
      style={{
        background: 'var(--orbital-surface)',
        border: '1px solid var(--orbital-border)',
        boxShadow: '0 8px 24px rgba(0,0,0,0.35)',
      }}
    >
      {/* Month header */}
      <div className="flex items-center justify-between mb-2">
        <button
          onClick={() => setMonth(m => subMonths(m, 1))}
          className="p-1 rounded hover:bg-orbital-muted text-orbital-subtle hover:text-orbital-text transition-colors"
          aria-label="Previous month"
        >
          <ChevronLeft size={14} />
        </button>
        <span className="text-sm font-semibold text-orbital-text">
          {format(month, 'MMMM yyyy')}
        </span>
        <button
          onClick={() => setMonth(m => addMonths(m, 1))}
          className="p-1 rounded hover:bg-orbital-muted text-orbital-subtle hover:text-orbital-text transition-colors"
          aria-label="Next month"
        >
          <ChevronRight size={14} />
        </button>
      </div>

      {/* Day-of-week header */}
      <div className="grid grid-cols-7 gap-0.5 mb-1">
        {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d, i) => (
          <div key={i} className="text-[10px] font-mono text-orbital-dim text-center py-1 tracking-wider">
            {d}
          </div>
        ))}
      </div>

      {/* Date grid */}
      <div className="grid grid-cols-7 gap-0.5">
        {days.map(day => {
          const inMonth  = isSameMonth(day, month)
          const isPicked = selected && isSameDay(day, selected)
          const isToday  = isSameDay(day, today)
          const hasEvent = eventDays?.has?.(format(day, 'yyyy-MM-dd'))
          return (
            <button
              key={day.toISOString()}
              onClick={() => onPick(day)}
              className={clsx(
                'relative h-8 rounded text-xs font-medium transition-colors flex items-center justify-center',
                isPicked
                  ? 'bg-blue-600 text-white'
                  : isToday
                  ? 'bg-blue-500/15 text-blue-300 hover:bg-blue-500/25'
                  : inMonth
                  ? 'text-orbital-text hover:bg-orbital-muted'
                  : 'text-orbital-dim hover:bg-orbital-muted'
              )}
            >
              {format(day, 'd')}
              {hasEvent && !isPicked && (
                <span
                  className="absolute bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full"
                  style={{ background: '#3b82f6' }}
                />
              )}
            </button>
          )
        })}
      </div>

      {/* Today shortcut + legend */}
      <div className="mt-2 pt-2 border-t border-orbital-border flex items-center justify-between">
        <button
          onClick={() => onPick(new Date())}
          className="text-xs text-blue-400 hover:text-blue-300 transition-colors"
        >
          Today
        </button>
        <span className="text-[10px] text-orbital-dim flex items-center gap-1.5">
          <span className="w-1 h-1 rounded-full bg-blue-500" />
          Day with production
        </span>
      </div>
    </div>
  )
}
