import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useApp } from '../../context/AppContext.jsx'
import { TASK_STATUS, TASK_PRIORITY, PRODUCTION_STATUS } from '../../data/models.js'
import clsx from 'clsx'

// ─── Status config for ticker display ────────────────────────────────────────
const TICKER_STATUS = {
  [TASK_STATUS.IN_PROGRESS]:  { dot: '#22c55e',  label: 'IN PROGRESS',   arrow: '▶' },
  [TASK_STATUS.NEEDS_REVIEW]: { dot: '#f59e0b',  label: 'NEEDS REVIEW',  arrow: '◈' },
  [TASK_STATUS.COMPLETE]:     { dot: '#8b5cf6',  label: 'VERIFY',        arrow: '✓' },
  [TASK_STATUS.BLOCKED]:      { dot: '#ef4444',  label: 'BLOCKED',       arrow: '✕' },
  [TASK_STATUS.AT_RISK]:      { dot: '#f59e0b',  label: 'AT RISK',       arrow: '⚠' },
}

const PRIORITY_CONFIG = {
  [TASK_PRIORITY.CRITICAL]: { label: '▲▲ CRIT',  color: '#ef4444' },
  [TASK_PRIORITY.HIGH]:     { label: '▲ HIGH',    color: '#f59e0b' },
  [TASK_PRIORITY.MEDIUM]:   { label: null,         color: null },
  [TASK_PRIORITY.LOW]:      { label: null,         color: null },
}

// ─── Single ticker item ───────────────────────────────────────────────────────
function TickerItem({ task, productionName, onClick }) {
  const statusCfg   = TICKER_STATUS[task.status]
  const priorityCfg = PRIORITY_CONFIG[task.priority]
  if (!statusCfg) return null

  return (
    <button
      onClick={onClick}
      className="inline-flex items-center gap-2 px-4 hover:bg-white/5 transition-colors h-full"
    >
      {/* Status dot */}
      <span
        className="w-1.5 h-1.5 rounded-full flex-shrink-0 animate-pulse"
        style={{ backgroundColor: statusCfg.dot, animationDuration: '2s' }}
      />

      {/* Status label */}
      <span
        className="text-[10px] font-bold tracking-widest flex-shrink-0 font-mono"
        style={{ color: statusCfg.dot }}
      >
        {statusCfg.label}
      </span>

      {/* Task title */}
      <span className="text-xs font-medium text-orbital-text whitespace-nowrap">
        {task.title}
      </span>

      {/* Production */}
      <span className="text-[11px] text-orbital-subtle whitespace-nowrap">
        · {productionName}
      </span>

      {/* Priority */}
      {priorityCfg?.label && (
        <span
          className="text-[10px] font-bold font-mono flex-shrink-0"
          style={{ color: priorityCfg.color }}
        >
          {priorityCfg.label}
        </span>
      )}

      {/* Separator */}
      <span className="text-orbital-border text-xs select-none ml-2">⬥</span>
    </button>
  )
}

// ─── TickerBanner ─────────────────────────────────────────────────────────────
export function TickerBanner() {
  const { tasks, productions } = useApp()
  const navigate = useNavigate()
  const [paused, setPaused] = useState(false)

  // Only tasks on active/incoming productions worth surfacing
  const activeProductionIds = useMemo(() => new Set(
    productions
      .filter(p => p.status === PRODUCTION_STATUS.ACTIVE || p.status === PRODUCTION_STATUS.INCOMING)
      .map(p => p.id)
  ), [productions])

  const tickerItems = useMemo(() => {
    const PRIORITY_ORDER = {
      [TASK_PRIORITY.CRITICAL]: 0,
      [TASK_PRIORITY.HIGH]:     1,
      [TASK_PRIORITY.MEDIUM]:   2,
      [TASK_PRIORITY.LOW]:      3,
    }

    return tasks
      .filter(t =>
        activeProductionIds.has(t.productionId) &&
        TICKER_STATUS[t.status]
      )
      .sort((a, b) => {
        // Critical first, then by status urgency
        const pa = PRIORITY_ORDER[a.priority] ?? 9
        const pb = PRIORITY_ORDER[b.priority] ?? 9
        return pa - pb
      })
      .map(t => ({
        task: t,
        productionName: productions.find(p => p.id === t.productionId)?.name || '',
      }))
  }, [tasks, productions, activeProductionIds])

  if (tickerItems.length === 0) return null

  // Duration scales with content — ~6 seconds per item, min 24s
  const duration = `${Math.max(24, tickerItems.length * 6)}s`

  // Keyframe injected once — Tailwind can't do custom keyframes inline
  const keyframes = `@keyframes ticker-scroll { from { transform: translateX(0); } to { transform: translateX(-50%); } }`

  return (
    <>
      <style>{keyframes}</style>

      <div
        className="w-full overflow-hidden border-y border-orbital-border/60 bg-[#080b0f] relative select-none"
        style={{ height: 36 }}
        onMouseEnter={() => setPaused(true)}
        onMouseLeave={() => setPaused(false)}
      >
        {/* Left label — fixed, not scrolling */}
        <div className="absolute left-0 top-0 bottom-0 z-10 flex items-center px-3 gap-2 bg-[#080b0f] border-r border-orbital-border/40">
          <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" style={{ animationDuration: '1.5s' }} />
          <span className="text-[10px] font-bold tracking-[0.2em] text-orbital-subtle font-mono uppercase">Live</span>
        </div>

        {/* Scrolling content — duplicated for seamless loop */}
        <div
          className="inline-flex items-center h-full pl-[72px] whitespace-nowrap"
          style={{
            animation: `ticker-scroll ${duration} linear infinite`,
            animationPlayState: paused ? 'paused' : 'running',
          }}
        >
          {/* Render twice for seamless loop — animation moves exactly -50% */}
          {[...tickerItems, ...tickerItems].map(({ task, productionName }, i) => (
            <TickerItem
              key={`${task.id}-${i}`}
              task={task}
              productionName={productionName}
              onClick={() => navigate(`/productions/${task.productionId}`)}
            />
          ))}
        </div>

        {/* Right fade-out gradient */}
        <div className="absolute top-0 right-0 bottom-0 w-16 bg-gradient-to-l from-[#080b0f] to-transparent pointer-events-none" />

        {/* Pause indicator */}
        {paused && (
          <div className="absolute top-0 right-3 bottom-0 flex items-center">
            <span className="text-[9px] text-orbital-subtle tracking-widest font-mono">PAUSED</span>
          </div>
        )}
      </div>
    </>
  )
}
