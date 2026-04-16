import { useMemo, useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { format, parseISO, isToday, isTomorrow, isPast, addDays } from 'date-fns'
import { Settings, X } from 'lucide-react'
import { useApp } from '../../context/AppContext.jsx'
import { useLocalStorage } from '../../hooks/useLocalStorage.js'
import { TASK_STATUS, TASK_PRIORITY, PRODUCTION_STATUS } from '../../data/models.js'

// ─── Settings defaults ────────────────────────────────────────────────────────
const DEFAULT_SETTINGS = {
  types: {
    statuses:    true,   // In Progress / Blocked / Needs Review / Verify
    overdue:     true,   // Overdue tasks
    dueSoon:     true,   // Due today / tomorrow
    milestones:  true,   // Upcoming milestones (7-day horizon)
    productions: true,   // Active / incoming productions
  },
  // Pixels per second — actual content width is estimated; we use a time-per-unit approach
  speed: 'normal',       // 'slow' | 'normal' | 'fast'
}

const SPEED_LABEL = { slow: 'Slow', normal: 'Normal', fast: 'Fast' }

// seconds per logical item (items are padded to ≥12 before the DOM doubling)
const SPEED_SPX = { slow: 4.5, normal: 2.2, fast: 1.0 }

// ─── Status config ────────────────────────────────────────────────────────────
const TASK_STATUS_CFG = {
  [TASK_STATUS.IN_PROGRESS]:  { dot: '#22c55e', label: 'IN PROGRESS' },
  [TASK_STATUS.NEEDS_REVIEW]: { dot: '#f59e0b', label: 'REVIEW'      },
  [TASK_STATUS.COMPLETE]:     { dot: '#8b5cf6', label: 'VERIFY'      },
  [TASK_STATUS.BLOCKED]:      { dot: '#ef4444', label: 'BLOCKED'     },
}

const PRIORITY_CFG = {
  [TASK_PRIORITY.CRITICAL]: { label: '▲▲ CRIT', color: '#ef4444' },
  [TASK_PRIORITY.HIGH]:     { label: '▲ HIGH',  color: '#f59e0b' },
}

// ─── Divider between entries ──────────────────────────────────────────────────
function Div() {
  return (
    <span
      className="inline-block w-px flex-shrink-0 mx-2.5 self-stretch opacity-30"
      style={{ background: 'var(--orbital-chrome)', marginTop: 8, marginBottom: 8 }}
    />
  )
}

// ─── Entry component helpers ──────────────────────────────────────────────────
function Tag({ label, color }) {
  return (
    <span className="inline-flex items-center gap-1 flex-shrink-0">
      <span
        className="inline-block w-1.5 h-1.5 rounded-full flex-shrink-0"
        style={{ backgroundColor: color }}
      />
      <span
        className="text-[10px] font-bold tracking-[0.12em] font-mono whitespace-nowrap"
        style={{ color }}
      >
        {label}
      </span>
    </span>
  )
}

function EntryBtn({ onClick, children }) {
  return (
    <button
      onClick={onClick}
      className="inline-flex items-center gap-2 h-full px-2 hover:bg-black/[0.04] dark:hover:bg-white/[0.04] transition-colors whitespace-nowrap flex-shrink-0"
    >
      {children}
      <Div />
    </button>
  )
}

// ─── Entry types ──────────────────────────────────────────────────────────────
function TaskStatusEntry({ task, productionName, onClick }) {
  const cfg = TASK_STATUS_CFG[task.status]
  if (!cfg) return null
  const pri = PRIORITY_CFG[task.priority]
  return (
    <EntryBtn onClick={onClick}>
      <Tag label={cfg.label} color={cfg.dot} />
      <span className="text-xs text-orbital-text font-medium">{task.title}</span>
      <span className="text-[11px] text-orbital-subtle">· {productionName}</span>
      {pri && (
        <span className="text-[10px] font-bold font-mono flex-shrink-0" style={{ color: pri.color }}>
          {pri.label}
        </span>
      )}
    </EntryBtn>
  )
}

function DueDateEntry({ task, productionName, onClick }) {
  const d = parseISO(task.dueDate)
  let label, color
  if (isPast(d) && task.status !== TASK_STATUS.VERIFIED) {
    label = 'OVERDUE'; color = '#ef4444'
  } else if (isToday(d)) {
    label = 'DUE TODAY'; color = '#f59e0b'
  } else {
    label = 'DUE TOMORROW'; color = '#3b82f6'
  }
  return (
    <EntryBtn onClick={onClick}>
      <Tag label={label} color={color} />
      <span className="text-xs text-orbital-text font-medium">{task.title}</span>
      <span className="text-[11px] text-orbital-subtle">· {productionName}</span>
    </EntryBtn>
  )
}

function MilestoneEntry({ milestone, productionName, onClick }) {
  const d = parseISO(milestone.date)
  const dateStr = isToday(d) ? 'TODAY' : isTomorrow(d) ? 'TOMORROW' : format(d, 'MMM d').toUpperCase()
  return (
    <EntryBtn onClick={onClick}>
      <Tag label="MILESTONE" color="#a78bfa" />
      <span className="text-xs text-orbital-text font-medium">{milestone.title}</span>
      <span className="text-[11px] text-orbital-subtle">· {productionName}</span>
      <span
        className="text-[10px] font-mono flex-shrink-0"
        style={{ color: isToday(d) ? '#f59e0b' : 'var(--orbital-subtle)' }}
      >
        {dateStr}
      </span>
    </EntryBtn>
  )
}

function ProductionEntry({ production, onClick }) {
  const isActive = production.status === PRODUCTION_STATUS.ACTIVE
  const color  = isActive ? '#22c55e' : '#3b82f6'
  const label  = isActive ? 'ACTIVE' : 'INCOMING'
  return (
    <EntryBtn onClick={onClick}>
      <Tag label={label} color={color} />
      <span className="text-xs text-orbital-text font-medium">{production.name}</span>
      <span className="text-[11px] text-orbital-subtle">· {production.client}</span>
      {production.startDate && (
        <span className="text-[10px] font-mono text-orbital-dim flex-shrink-0">
          {format(parseISO(production.startDate), 'MMM d')}
        </span>
      )}
    </EntryBtn>
  )
}

// ─── Settings panel ───────────────────────────────────────────────────────────
const TYPE_LABELS = {
  statuses:    'Task statuses',
  overdue:     'Overdue tasks',
  dueSoon:     'Due today / tomorrow',
  milestones:  'Upcoming milestones',
  productions: 'Active productions',
}

function SettingsPanel({ settings, onChange, onClose }) {
  const panelRef = useRef(null)

  useEffect(() => {
    const handler = (e) => {
      if (panelRef.current && !panelRef.current.contains(e.target)) onClose()
    }
    // Slight delay so the click that opened it doesn't immediately close it
    const t = setTimeout(() => document.addEventListener('mousedown', handler), 50)
    return () => { clearTimeout(t); document.removeEventListener('mousedown', handler) }
  }, [onClose])

  const toggleType = (key) => {
    onChange({ ...settings, types: { ...settings.types, [key]: !settings.types[key] } })
  }
  const setSpeed = (speed) => onChange({ ...settings, speed })

  return (
    <div
      ref={panelRef}
      className="absolute right-0 top-full z-50 w-64 animate-hud-in"
      style={{
        background: 'var(--orbital-surface)',
        border: '1px solid var(--orbital-border)',
        boxShadow: '0 6px 20px rgba(0,0,0,0.2)',
        marginTop: 1,
      }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-3 py-2"
        style={{ borderBottom: '1px solid var(--orbital-border)' }}
      >
        <span className="text-[11px] font-semibold text-orbital-subtle uppercase tracking-wider">
          Ticker settings
        </span>
        <button onClick={onClose} className="text-orbital-dim hover:text-orbital-subtle transition-colors">
          <X size={13} />
        </button>
      </div>

      {/* Content types */}
      <div className="px-3 py-2.5" style={{ borderBottom: '1px solid var(--orbital-border)' }}>
        <p className="text-[10px] font-semibold uppercase tracking-wider text-orbital-dim mb-2">
          Show in ticker
        </p>
        <div className="space-y-1.5">
          {Object.entries(TYPE_LABELS).map(([key, label]) => (
            <label
              key={key}
              className="flex items-center gap-2.5 cursor-pointer group"
            >
              <div
                className="w-3.5 h-3.5 flex items-center justify-center flex-shrink-0 transition-colors"
                style={{
                  border: `1px solid ${settings.types[key] ? '#3b82f6' : 'var(--orbital-chrome)'}`,
                  background: settings.types[key] ? '#3b82f6' : 'transparent',
                }}
                onClick={() => toggleType(key)}
              >
                {settings.types[key] && (
                  <svg width="8" height="8" viewBox="0 0 8 8" fill="none">
                    <path d="M1 4l2.5 2.5L7 1.5" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                )}
              </div>
              <span
                className="text-xs transition-colors"
                style={{ color: settings.types[key] ? 'var(--orbital-text)' : 'var(--orbital-subtle)' }}
                onClick={() => toggleType(key)}
              >
                {label}
              </span>
            </label>
          ))}
        </div>
      </div>

      {/* Speed */}
      <div className="px-3 py-2.5">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-orbital-dim mb-2">
          Scroll speed
        </p>
        <div className="flex gap-1">
          {(['slow', 'normal', 'fast']).map(s => (
            <button
              key={s}
              onClick={() => setSpeed(s)}
              className="flex-1 py-1 text-xs font-medium transition-colors"
              style={{
                background: settings.speed === s ? '#3b82f6' : 'var(--btn-secondary-bg)',
                border: `1px solid ${settings.speed === s ? '#3b82f6' : 'var(--btn-secondary-border)'}`,
                color: settings.speed === s ? '#fff' : 'var(--orbital-subtle)',
              }}
            >
              {SPEED_LABEL[s]}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

// ─── TickerBanner ─────────────────────────────────────────────────────────────
export function TickerBanner() {
  const { tasks, productions } = useApp()
  const navigate  = useNavigate()
  const [paused, setPaused]       = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [settings, setSettings]   = useLocalStorage('balance_ticker_settings', DEFAULT_SETTINGS)

  // Merge in any missing keys if stored version is older
  const mergedSettings = useMemo(() => ({
    types: { ...DEFAULT_SETTINGS.types, ...settings?.types },
    speed: settings?.speed || 'normal',
  }), [settings])

  const activeProductionIds = useMemo(() => new Set(
    productions
      .filter(p => p.status === PRODUCTION_STATUS.ACTIVE || p.status === PRODUCTION_STATUS.INCOMING)
      .map(p => p.id)
  ), [productions])

  // Build entries based on enabled types
  const entries = useMemo(() => {
    const { types } = mergedSettings
    const items = []
    const now     = new Date()
    const horizon = addDays(now, 7)

    const PRIORITY_ORDER = {
      [TASK_PRIORITY.CRITICAL]: 0,
      [TASK_PRIORITY.HIGH]: 1,
      [TASK_PRIORITY.MEDIUM]: 2,
      [TASK_PRIORITY.LOW]: 3,
    }

    const activeTasks = tasks
      .filter(t => activeProductionIds.has(t.productionId))
      .sort((a, b) => (PRIORITY_ORDER[a.priority] ?? 9) - (PRIORITY_ORDER[b.priority] ?? 9))

    // 1 — Actionable task statuses
    if (types.statuses) {
      activeTasks
        .filter(t => TASK_STATUS_CFG[t.status])
        .forEach(t => {
          const prod = productions.find(p => p.id === t.productionId)
          items.push({
            key: `status-${t.id}`,
            sort: PRIORITY_ORDER[t.priority] ?? 9,
            el: (
              <TaskStatusEntry
                key={`status-${t.id}`}
                task={t}
                productionName={prod?.name || ''}
                onClick={() => navigate(`/productions/${t.productionId}`)}
              />
            ),
          })
        })
    }

    // 2 — Overdue tasks
    if (types.overdue) {
      activeTasks
        .filter(t =>
          t.dueDate &&
          isPast(parseISO(t.dueDate)) &&
          t.status !== TASK_STATUS.VERIFIED &&
          !TASK_STATUS_CFG[t.status]
        )
        .forEach(t => {
          const prod = productions.find(p => p.id === t.productionId)
          items.push({
            key: `overdue-${t.id}`,
            sort: -1,
            el: (
              <DueDateEntry
                key={`overdue-${t.id}`}
                task={t}
                productionName={prod?.name || ''}
                onClick={() => navigate(`/productions/${t.productionId}`)}
              />
            ),
          })
        })
    }

    // 3 — Due today / tomorrow
    if (types.dueSoon) {
      activeTasks
        .filter(t =>
          t.dueDate &&
          !isPast(parseISO(t.dueDate)) &&
          (isToday(parseISO(t.dueDate)) || isTomorrow(parseISO(t.dueDate))) &&
          t.status !== TASK_STATUS.VERIFIED
        )
        .forEach(t => {
          const prod = productions.find(p => p.id === t.productionId)
          items.push({
            key: `soon-${t.id}`,
            sort: 0.5,
            el: (
              <DueDateEntry
                key={`soon-${t.id}`}
                task={t}
                productionName={prod?.name || ''}
                onClick={() => navigate(`/productions/${t.productionId}`)}
              />
            ),
          })
        })
    }

    // 4 — Upcoming milestones
    if (types.milestones) {
      productions
        .filter(p => activeProductionIds.has(p.id))
        .forEach(p => {
          ;(p.roadmap?.milestones || [])
            .filter(m => m.date && m.status !== 'Complete')
            .filter(m => { const d = parseISO(m.date); return d >= now && d <= horizon })
            .forEach(m => {
              items.push({
                key: `ms-${p.id}-${m.id}`,
                sort: isToday(parseISO(m.date)) ? 0.1 : 5,
                el: (
                  <MilestoneEntry
                    key={`ms-${p.id}-${m.id}`}
                    milestone={m}
                    productionName={p.name}
                    onClick={() => navigate(`/productions/${p.id}?tab=Roadmap`)}
                  />
                ),
              })
            })
        })
    }

    // 5 — Productions
    if (types.productions) {
      productions
        .filter(p => p.status === PRODUCTION_STATUS.ACTIVE || p.status === PRODUCTION_STATUS.INCOMING)
        .slice(0, 5)
        .forEach(p => {
          items.push({
            key: `prod-${p.id}`,
            sort: 10,
            el: (
              <ProductionEntry
                key={`prod-${p.id}`}
                production={p}
                onClick={() => navigate(`/productions/${p.id}`)}
              />
            ),
          })
        })
    }

    return items
      .sort((a, b) => a.sort - b.sort)
      .map(e => e.el)
  }, [tasks, productions, activeProductionIds, mergedSettings, navigate])

  if (entries.length === 0) return null

  // Pad to fill space — repeat until ≥ 10 items, then double for loop
  const MIN = 10
  const reps = Math.ceil(MIN / Math.max(1, entries.length))
  const base  = Array.from({ length: reps }, () => entries).flat()

  const sPerItem = SPEED_SPX[mergedSettings.speed] || SPEED_SPX.normal
  const duration = `${Math.max(16, base.length * sPerItem)}s`

  const keyframes = `@keyframes ticker-scroll { from { transform: translateX(0); } to { transform: translateX(-50%); } }`

  return (
    <>
      <style>{keyframes}</style>
      <div
        className="w-full overflow-hidden relative select-none"
        style={{
          height: 32,
          background: 'var(--orbital-muted)',
          borderBottom: '1px solid var(--orbital-border)',
        }}
        onMouseEnter={() => setPaused(true)}
        onMouseLeave={() => setPaused(false)}
      >
        {/* Fixed LIVE label */}
        <div
          className="absolute left-0 top-0 bottom-0 z-10 flex items-center gap-2 px-3 flex-shrink-0"
          style={{
            background: 'var(--orbital-muted)',
            borderRight: '1px solid var(--orbital-border)',
          }}
        >
          <span
            className="w-1.5 h-1.5 rounded-full bg-green-500 animate-indicator-pulse flex-shrink-0"
          />
          <span className="text-[10px] font-bold tracking-[0.15em] text-orbital-subtle font-mono">
            LIVE
          </span>
        </div>

        {/* Scrolling track — doubled for seamless loop */}
        <div
          className="inline-flex items-center h-full whitespace-nowrap"
          style={{
            paddingLeft: 68,
            animation: `ticker-scroll ${duration} linear infinite`,
            animationPlayState: paused ? 'paused' : 'running',
          }}
        >
          {[...base, ...base]}
        </div>

        {/* Right controls area — settings button + fade */}
        <div
          className="absolute top-0 right-0 bottom-0 flex items-center z-10"
          style={{ background: 'linear-gradient(to left, var(--orbital-muted) 60%, transparent)' }}
        >
          <div className="relative mr-1">
            <button
              onMouseDown={(e) => e.stopPropagation()}
              onClick={(e) => { e.stopPropagation(); setShowSettings(s => !s) }}
              onMouseEnter={() => setPaused(true)}
              className={`p-1.5 transition-colors flex items-center justify-center ${
                showSettings ? 'text-orbital-text' : 'text-orbital-dim hover:text-orbital-subtle'
              }`}
              title="Ticker settings"
            >
              <Settings size={12} />
            </button>

            {showSettings && (
              <SettingsPanel
                settings={mergedSettings}
                onChange={setSettings}
                onClose={() => setShowSettings(false)}
              />
            )}
          </div>
        </div>

        {/* Pause label */}
        {paused && !showSettings && (
          <div className="absolute top-0 right-10 bottom-0 flex items-center z-10 pointer-events-none">
            <span className="text-[9px] text-orbital-dim tracking-widest font-mono">PAUSED</span>
          </div>
        )}
      </div>
    </>
  )
}
