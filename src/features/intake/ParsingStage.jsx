import { useEffect, useState } from 'react'
import { CheckCircle, Loader } from 'lucide-react'
import clsx from 'clsx'

const STEPS = [
  { id: 1, text: 'Reading inputs',                delay: 0    },
  { id: 2, text: 'Scanning for dates & timelines', delay: 420  },
  { id: 3, text: 'Finding contacts & key players', delay: 860  },
  { id: 4, text: 'Detecting production type',      delay: 1280 },
  { id: 5, text: 'Identifying concerns & risks',   delay: 1700 },
  { id: 6, text: 'Building your draft',            delay: 2100 },
]

const TOTAL_DURATION = 2700 // ms before advancing

export function ParsingStage({ parsingSummary = [], onComplete }) {
  const [visibleSteps, setVisibleSteps] = useState([])
  const [done,         setDone]         = useState(false)

  useEffect(() => {
    const timers = []

    STEPS.forEach(step => {
      timers.push(setTimeout(() => {
        setVisibleSteps(prev => [...prev, step.id])
      }, step.delay))
    })

    // Mark complete + advance
    timers.push(setTimeout(() => {
      setDone(true)
    }, TOTAL_DURATION - 200))

    timers.push(setTimeout(() => {
      onComplete()
    }, TOTAL_DURATION))

    return () => timers.forEach(clearTimeout)
  }, [onComplete])

  return (
    <div className="flex flex-col items-center gap-8 py-8">

      {/* Central animation */}
      <div className="relative flex items-center justify-center">
        <div className={clsx(
          'w-20 h-20 rounded-full border-2 flex items-center justify-center transition-all duration-700',
          done ? 'border-green-400 bg-green-500/10' : 'border-blue-400/50 bg-blue-500/10'
        )}>
          {done
            ? <CheckCircle size={36} className="text-green-400" />
            : <Loader size={32} className="text-blue-400 animate-spin" />
          }
        </div>
        {/* Pulse ring */}
        {!done && (
          <div className="absolute w-20 h-20 rounded-full border border-blue-400/30 animate-ping" />
        )}
      </div>

      {/* Title */}
      <div className="text-center">
        <h2 className="text-lg font-semibold text-orbital-text">
          {done ? 'Analysis complete' : 'Analysing your inputs…'}
        </h2>
        <p className="text-sm text-orbital-subtle mt-1">
          {done ? 'Building your draft now' : 'Finding everything I can'}
        </p>
      </div>

      {/* Step list */}
      <div className="w-full max-w-sm space-y-2">
        {STEPS.map(step => {
          const visible  = visibleSteps.includes(step.id)
          const complete = done || (visible && visibleSteps[visibleSteps.length - 1] > step.id)
          return (
            <div
              key={step.id}
              className={clsx(
                'flex items-center gap-3 transition-all duration-300',
                visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-1'
              )}
            >
              <div className={clsx(
                'w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 transition-colors duration-300',
                complete ? 'bg-green-500/20' : 'bg-blue-500/20'
              )}>
                {complete
                  ? <div className="w-2 h-2 rounded-full bg-green-400" />
                  : <div className="w-2 h-2 rounded-full bg-blue-400 animate-pulse" />
                }
              </div>
              <span className={clsx(
                'text-sm transition-colors duration-300',
                complete ? 'text-orbital-subtle' : 'text-orbital-text'
              )}>
                {step.text}
              </span>
              {complete && (
                <CheckCircle size={12} className="ml-auto text-green-400 flex-shrink-0" />
              )}
            </div>
          )
        })}
      </div>

      {/* What was found */}
      {done && parsingSummary.length > 0 && (
        <div className="w-full max-w-sm rounded-xl border border-orbital-border/50 bg-white/[0.02] p-4 space-y-1.5">
          <p className="text-xs font-medium text-orbital-subtle uppercase tracking-wider mb-2">Found</p>
          {parsingSummary.map((line, i) => (
            <div key={i} className="flex items-start gap-2">
              <span className="text-green-400 text-xs mt-0.5 flex-shrink-0">✓</span>
              <span className="text-xs text-orbital-text">{line}</span>
            </div>
          ))}
        </div>
      )}

    </div>
  )
}
