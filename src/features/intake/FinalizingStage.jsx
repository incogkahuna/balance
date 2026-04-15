import { useEffect, useState } from 'react'
import { CheckCircle, Loader } from 'lucide-react'
import clsx from 'clsx'

const STEPS = [
  { id: 1, text: 'Creating production record',  delay: 0    },
  { id: 2, text: 'Seeding Production Bible',     delay: 500  },
  { id: 3, text: 'Building roadmap milestones',  delay: 950  },
  { id: 4, text: 'Creating starter tasks',       delay: 1400 },
]

const COMPLETE_DELAY = 1900
const REDIRECT_DELAY = 2600

export function FinalizingStage({ productionName, onRedirect }) {
  const [visibleSteps, setVisibleSteps] = useState([])
  const [done,         setDone]         = useState(false)

  useEffect(() => {
    const timers = []

    STEPS.forEach(step => {
      timers.push(setTimeout(() => {
        setVisibleSteps(prev => [...prev, step.id])
      }, step.delay))
    })

    timers.push(setTimeout(() => setDone(true), COMPLETE_DELAY))
    timers.push(setTimeout(() => onRedirect(),  REDIRECT_DELAY))

    return () => timers.forEach(clearTimeout)
  }, [onRedirect])

  return (
    <div className="flex flex-col items-center gap-8 py-10">

      {/* Central indicator */}
      <div className="relative flex items-center justify-center">
        <div className={clsx(
          'w-24 h-24 rounded-full border-2 flex items-center justify-center transition-all duration-700',
          done
            ? 'border-green-400 bg-green-500/10 scale-110'
            : 'border-blue-400/60 bg-blue-500/8'
        )}>
          {done
            ? <CheckCircle size={44} className="text-green-400" />
            : <Loader size={38} className="text-blue-400 animate-spin" />
          }
        </div>
        {done && (
          <div className="absolute w-24 h-24 rounded-full border border-green-400/30 animate-ping" />
        )}
      </div>

      {/* Status text */}
      <div className="text-center">
        <h2 className="text-xl font-semibold text-orbital-text">
          {done ? 'Production created!' : 'Building your production…'}
        </h2>
        {productionName && (
          <p className="text-sm text-orbital-subtle mt-1.5">
            {done ? `"${productionName}" is ready` : `Setting up "${productionName}"`}
          </p>
        )}
      </div>

      {/* Steps */}
      <div className="w-full max-w-xs space-y-3">
        {STEPS.map(step => {
          const visible  = visibleSteps.includes(step.id)
          const complete = done || visibleSteps[visibleSteps.length - 1] > step.id
          return (
            <div
              key={step.id}
              className={clsx(
                'flex items-center gap-3 transition-all duration-400',
                visible ? 'opacity-100' : 'opacity-0'
              )}
            >
              <div className={clsx(
                'w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 transition-all duration-300',
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
              {complete && <CheckCircle size={12} className="ml-auto text-green-400 flex-shrink-0" />}
            </div>
          )
        })}
      </div>

      {done && (
        <p className="text-xs text-orbital-subtle animate-pulse">
          Taking you to the production…
        </p>
      )}
    </div>
  )
}
