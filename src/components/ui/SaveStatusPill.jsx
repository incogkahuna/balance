import { format } from '../../lib/safeFormat.js'
import { Check, Loader2, AlertCircle } from 'lucide-react'

/**
 * Telemetric save-state chip used by every auto-save-enabled form.
 *
 * Props:
 *   status      — 'idle' | 'saving' | 'saved' | 'error' (from useAutoSave)
 *   lastSavedAt — Date | null
 *   error       — string | null
 *   compact     — true: small pill suitable for sitting next to a modal title
 *                 false (default): full pill with timestamp and AUTO-SAVE label
 */
export function SaveStatusPill({ status, lastSavedAt, error, compact = false }) {
  let icon, label, color, bg, border
  if (status === 'saving') {
    icon = <Loader2 size={compact ? 10 : 11} className="animate-spin" />
    label = 'SAVING'
    color = '#fbbf24'
    bg = 'rgba(251,191,36,0.1)'
    border = 'rgba(251,191,36,0.3)'
  } else if (status === 'error') {
    icon = <AlertCircle size={compact ? 10 : 11} />
    label = compact
      ? 'SAVE FAILED'
      : `SAVE FAILED · ${error || 'unknown error'}`.toUpperCase().slice(0, 80)
    color = '#ef4444'
    bg = 'rgba(239,68,68,0.1)'
    border = 'rgba(239,68,68,0.3)'
  } else if (status === 'saved' && lastSavedAt) {
    icon = <Check size={compact ? 10 : 11} />
    label = compact
      ? `SAVED ${format(lastSavedAt, 'HH:mm:ss')}`
      : `SAVED · ${format(lastSavedAt, 'HH:mm:ss')}`
    color = '#34d399'
    bg = 'rgba(52,211,153,0.1)'
    border = 'rgba(52,211,153,0.3)'
  } else {
    icon = <Check size={compact ? 10 : 11} className="opacity-40" />
    label = compact ? 'AUTO-SAVE' : 'AUTO-SAVE ENABLED'
    color = 'var(--orbital-subtle)'
    bg = 'transparent'
    border = 'var(--orbital-border)'
  }
  return (
    <span
      className={
        compact
          ? 'inline-flex items-center gap-1.5 px-2 py-0.5 font-telemetry text-[9px] tracking-wider'
          : 'inline-flex items-center gap-2 px-2.5 py-1 font-telemetry text-[10px] tracking-wider'
      }
      style={{ color, background: bg, border: `1px solid ${border}` }}
      title={error || ''}
    >
      {icon}
      <span>{label}</span>
    </span>
  )
}
