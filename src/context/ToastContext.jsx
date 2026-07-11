import { createContext, useContext, useCallback, useState, useRef } from 'react'
import { AlertTriangle, CheckCircle2, Info, X } from 'lucide-react'
import clsx from 'clsx'

// ─── Toast system ─────────────────────────────────────────────────────────────
// Small global notification stack, primarily for surfacing failed Supabase
// writes (which previously died silently in console.error — audit issue #3).
// API: const toast = useToast(); toast.error('...'); toast.success('...');
// toast.info('...'). Auto-dismisses (errors linger longer); manual X always
// available. Renders above MobileNav on phones, bottom-right on desktop.

const ToastContext = createContext(null)

const TYPE_META = {
  error:   { icon: AlertTriangle, ttl: 8000, accent: '#ef4444', bg: 'rgba(239,68,68,0.12)',  border: 'rgba(239,68,68,0.4)'  },
  success: { icon: CheckCircle2,  ttl: 4000, accent: '#22c55e', bg: 'rgba(34,197,94,0.12)',  border: 'rgba(34,197,94,0.4)'  },
  info:    { icon: Info,          ttl: 5000, accent: '#3b82f6', bg: 'rgba(59,130,246,0.12)', border: 'rgba(59,130,246,0.4)' },
}

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])
  const timersRef = useRef(new Map())

  const dismiss = useCallback((id) => {
    setToasts(prev => prev.filter(t => t.id !== id))
    const timer = timersRef.current.get(id)
    if (timer) {
      clearTimeout(timer)
      timersRef.current.delete(id)
    }
  }, [])

  const push = useCallback((type, message) => {
    if (!message) return
    const id = crypto.randomUUID()
    setToasts(prev => {
      // Collapse exact-duplicate messages already showing (e.g. an auto-save
      // retrying against a down network would otherwise stack identical rows).
      if (prev.some(t => t.message === message && t.type === type)) return prev
      return [...prev.slice(-3), { id, type, message }]
    })
    const ttl = TYPE_META[type]?.ttl ?? 5000
    timersRef.current.set(id, setTimeout(() => dismiss(id), ttl))
  }, [dismiss])

  const value = {
    error:   useCallback((msg) => push('error', msg),   [push]),
    success: useCallback((msg) => push('success', msg), [push]),
    info:    useCallback((msg) => push('info', msg),    [push]),
  }

  return (
    <ToastContext.Provider value={value}>
      {children}
      {/* Stack — above MobileNav (bottom-16) on phones, bottom-right on lg+ */}
      <div
        className="fixed z-[80] left-3 right-3 bottom-20 lg:left-auto lg:right-5 lg:bottom-5 lg:w-96 space-y-2 pointer-events-none"
        role="status"
        aria-live="polite"
      >
        {toasts.map(t => {
          const meta = TYPE_META[t.type] || TYPE_META.info
          const Icon = meta.icon
          return (
            <div
              key={t.id}
              className={clsx(
                'pointer-events-auto flex items-start gap-2.5 px-3.5 py-3 rounded-lg shadow-lg',
                'backdrop-blur-sm animate-toast-in',
              )}
              style={{
                background: 'var(--orbital-panel)',
                border: `1px solid ${meta.border}`,
                borderLeft: `3px solid ${meta.accent}`,
              }}
            >
              <Icon size={15} style={{ color: meta.accent }} className="flex-shrink-0 mt-0.5" />
              <p className="flex-1 text-sm text-orbital-text leading-snug">{t.message}</p>
              <button
                onClick={() => dismiss(t.id)}
                aria-label="Dismiss"
                className="flex-shrink-0 text-orbital-subtle hover:text-orbital-text transition-colors"
              >
                <X size={14} />
              </button>
            </div>
          )
        })}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used within ToastProvider')
  return ctx
}
