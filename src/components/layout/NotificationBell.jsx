import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { formatDistanceToNowStrict, parseISO } from 'date-fns'
import { Bell, Check } from 'lucide-react'
import { useApp } from '../../context/AppContext.jsx'
import {
  listNotificationsFor,
  markNotificationRead,
  markAllNotificationsReadFor,
  subscribeToNotificationsFor,
} from '../../lib/data/notifications.ts'

/**
 * Bell + dropdown panel for in-app notifications.
 *
 * The bell renders a pulsing red dot when there are unread notifications.
 * Clicking opens a panel listing the most recent 20 items; clicking a
 * notification marks it read and navigates to its production.
 *
 * Layout prop just toggles between "compact" (mobile topbar — icon button
 * only) and "labeled" (desktop sidebar — icon + "Notifications" label).
 */
export function NotificationBell({ layout = 'compact' }) {
  const { currentUser } = useApp()
  const navigate = useNavigate()
  const recipientId = currentUser?.id || ''

  const [items, setItems] = useState([])
  const [open, setOpen] = useState(false)
  const panelRef = useRef(null)
  const buttonRef = useRef(null)

  // Load + subscribe. Every call is wrapped so a transient backend issue
  // (table not migrated yet, network blip, etc.) can't crash the page —
  // the bell just goes silent until the next reload.
  useEffect(() => {
    if (!recipientId) return
    let cancelled = false
    let unsub = () => {}
    listNotificationsFor(recipientId, 50)
      .then(rows => { if (!cancelled) setItems(rows) })
      .catch(err => console.error('[NotificationBell] load failed', err))
    try {
      unsub = subscribeToNotificationsFor(recipientId, (event) => {
        setItems(prev => {
          if (event.type === 'INSERT') {
            if (prev.some(i => i.id === event.row.id)) return prev
            return [event.row, ...prev].slice(0, 50)
          }
          if (event.type === 'UPDATE') {
            return prev.map(i => i.id === event.row.id ? event.row : i)
          }
          if (event.type === 'DELETE') {
            return prev.filter(i => i.id !== event.row.id)
          }
          return prev
        })
      })
    } catch (err) {
      console.error('[NotificationBell] subscribe failed', err)
    }
    return () => {
      cancelled = true
      try { unsub() } catch { /* noop */ }
    }
  }, [recipientId])

  // Close on outside click
  useEffect(() => {
    if (!open) return
    const handler = (e) => {
      if (panelRef.current?.contains(e.target)) return
      if (buttonRef.current?.contains(e.target)) return
      setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  const unreadCount = items.filter(i => !i.readAt).length

  const handleClick = async (n) => {
    setOpen(false)
    if (!n.readAt) {
      // Optimistic update — server confirmation comes through realtime
      setItems(prev => prev.map(i => i.id === n.id ? { ...i, readAt: new Date().toISOString() } : i))
      markNotificationRead(n.id).catch(err => console.error('[NotificationBell] markRead', err))
    }
    if (n.productionId) navigate(`/productions/${n.productionId}`)
  }

  const handleMarkAllRead = async () => {
    const now = new Date().toISOString()
    setItems(prev => prev.map(i => i.readAt ? i : { ...i, readAt: now }))
    markAllNotificationsReadFor(recipientId).catch(err =>
      console.error('[NotificationBell] markAllRead', err)
    )
  }

  return (
    <div className="relative">
      <button
        ref={buttonRef}
        onClick={() => setOpen(o => !o)}
        className={
          layout === 'labeled'
            ? 'w-full flex items-center gap-2 px-1 py-1.5 text-xs text-orbital-subtle hover:text-orbital-text transition-colors'
            : 'w-11 h-11 flex items-center justify-center text-orbital-subtle hover:text-orbital-text transition-colors relative'
        }
        title="Notifications"
        aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ''}`}
      >
        <div className="relative">
          <Bell size={layout === 'labeled' ? 12 : 16} />
          {unreadCount > 0 && (
            <span
              className="absolute -top-1 -right-1 inline-flex items-center justify-center rounded-full bg-red-500 text-white font-telemetry"
              style={{
                minWidth: 14,
                height: 14,
                fontSize: 9,
                padding: '0 3px',
                boxShadow: '0 0 6px rgba(239,68,68,0.6)',
              }}
            >
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
        </div>
        {layout === 'labeled' && (
          <span>Notifications{unreadCount > 0 ? ` · ${unreadCount}` : ''}</span>
        )}
      </button>

      {open && (
        <div
          ref={panelRef}
          className={
            layout === 'labeled'
              ? 'absolute bottom-full left-0 mb-2 z-50 w-[340px] max-h-[480px] flex flex-col rounded-lg'
              : 'absolute top-full right-0 mt-1 z-50 w-[320px] max-h-[480px] flex flex-col rounded-lg'
          }
          style={{
            background: 'var(--orbital-surface)',
            border: '1px solid var(--orbital-border)',
            boxShadow: '0 8px 32px rgba(0,0,0,0.45)',
          }}
        >
          {/* Header */}
          <div
            className="flex items-center justify-between px-3 py-2 flex-shrink-0"
            style={{ borderBottom: '1px solid var(--orbital-border)' }}
          >
            <p className="font-telemetry text-[10px] tracking-wider text-orbital-subtle">
              NOTIFICATIONS · {items.length}
            </p>
            {unreadCount > 0 && (
              <button
                onClick={handleMarkAllRead}
                className="inline-flex items-center gap-1 px-1.5 py-0.5 font-telemetry text-[9px] tracking-wider text-orbital-subtle hover:text-orbital-text transition-colors"
                title="Mark all as read"
              >
                <Check size={9} />
                MARK ALL READ
              </button>
            )}
          </div>

          {/* List */}
          {items.length === 0 ? (
            <div className="px-4 py-8 text-center">
              <p className="text-sm text-orbital-dim">Nothing new.</p>
              <p className="text-[11px] text-orbital-dim mt-1">
                You'll see task assignments and updates here.
              </p>
            </div>
          ) : (
            <ul className="overflow-y-auto divide-y" style={{ borderColor: 'var(--orbital-border)' }}>
              {items.map(n => {
                const unread = !n.readAt
                return (
                  <li key={n.id}>
                    <button
                      onClick={() => handleClick(n)}
                      className="w-full text-left px-3 py-2.5 hover:bg-orbital-panel transition-colors flex items-start gap-2.5"
                      style={{ background: unread ? 'rgba(59,130,246,0.06)' : 'transparent' }}
                    >
                      <span
                        className="mt-1.5 w-1.5 h-1.5 rounded-full flex-shrink-0"
                        style={{
                          background: unread ? '#60a5fa' : 'transparent',
                          boxShadow: unread ? '0 0 4px rgba(96,165,250,0.6)' : 'none',
                        }}
                      />
                      <div className="min-w-0 flex-1">
                        <p
                          className={
                            unread
                              ? 'text-xs text-orbital-text font-medium truncate'
                              : 'text-xs text-orbital-subtle truncate'
                          }
                        >
                          {n.title}
                        </p>
                        {n.body && (
                          <p className="text-[11px] text-orbital-dim truncate mt-0.5">{n.body}</p>
                        )}
                        <p className="font-telemetry text-[9px] tracking-wider text-orbital-dim mt-1">
                          {formatDistanceToNowStrict(parseISO(n.createdAt), { addSuffix: true }).toUpperCase()}
                        </p>
                      </div>
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}
