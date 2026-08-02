import { useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { NotebookPen, X, Check } from 'lucide-react'
import { useApp } from '../../context/AppContext.jsx'
import { useToast } from '../../context/ToastContext.jsx'
import { createDebriefNote, PRODUCTION_STATUS } from '../../data/models.js'
import { DictationMic } from '../../components/voice/DictationMic.tsx'
import { useKeyboardInset } from '../../hooks/useKeyboardInset.js'

// ─────────────────────────────────────────────────────────────────────────────
// QuickCapture — jot a note on set without navigating.
//
// Danny: "right now I have to open the app, click on jobs, then click the
// production, then click bible to jot down one note."
//
// This is a global sheet: tap the pencil (or open /note) → pick the
// production → type → done. It writes to the SAME debriefNotes the production's
// Quick Notes list shows and the debrief compiles from, so nothing is a
// separate silo.
//
// /note is a real route so it can be saved to the phone's home screen as its
// own icon — that's the closest a web app gets to a widget. A true iOS
// home-screen widget needs a native app; this is the honest substitute.
//
// The production choice is remembered per browser, so the second note of the
// day is: tap, type, send.
// ─────────────────────────────────────────────────────────────────────────────

const LAST_PRODUCTION_KEY = 'balance_quicknote_production'

export function QuickCapture() {
  const { productions, addDebriefNote, currentUser } = useApp()
  const toast = useToast()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const kb = useKeyboardInset()

  // ?note=1 (or the /note route, which redirects here) opens the sheet — that's
  // the home-screen-icon entry point.
  const openedByUrl = searchParams.get('note') === '1'
  const [open, setOpen] = useState(openedByUrl)
  useEffect(() => { if (openedByUrl) setOpen(true) }, [openedByUrl])

  const [text, setText] = useState('')
  const [productionId, setProductionId] = useState(() => {
    try { return localStorage.getItem(LAST_PRODUCTION_KEY) || '' } catch { return '' }
  })
  const inputRef = useRef(null)

  // Active work first — that's what you're standing on when writing a note.
  const options = useMemo(() => {
    const live = (productions || []).filter(p => p.status !== PRODUCTION_STATUS.COMPLETED)
    const rank = { [PRODUCTION_STATUS.ACTIVE]: 0, [PRODUCTION_STATUS.WRAP]: 1, [PRODUCTION_STATUS.INCOMING]: 2 }
    return live.slice().sort((a, b) =>
      (rank[a.status] ?? 9) - (rank[b.status] ?? 9)
      || (a.startDate || '').localeCompare(b.startDate || ''))
  }, [productions])

  // Default to the remembered production if it's still live, else the first.
  useEffect(() => {
    if (!open) return
    const stillLive = options.some(p => p.id === productionId)
    if (!stillLive) setProductionId(options[0]?.id || '')
    const t = setTimeout(() => inputRef.current?.focus(), 80)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, options])

  const close = () => {
    setOpen(false)
    setText('')
    if (openedByUrl) {
      const next = new URLSearchParams(searchParams)
      next.delete('note')
      setSearchParams(next, { replace: true })
    }
  }

  const send = () => {
    const body = text.trim()
    if (!body || !productionId) return
    addDebriefNote(productionId, createDebriefNote({
      text: body,
      authorId: currentUser?.id || '',
      authorName: currentUser?.name || '',
    }))
    try { localStorage.setItem(LAST_PRODUCTION_KEY, productionId) } catch { /* private mode */ }
    const name = options.find(p => p.id === productionId)?.name || 'the production'
    toast.success(`Note added to ${name}`)
    setText('')
    // Stay open — on set you usually have more than one thing to write down.
    inputRef.current?.focus()
  }

  return (
    <>
      {/* Trigger — above the mobile bar, clear of the feedback button */}
      {!open && (
        <button
          onClick={() => setOpen(true)}
          className="fixed z-40 right-4 w-12 h-12 rounded-full flex items-center justify-center shadow-lg transition-transform active:scale-95"
          style={{
            bottom: 'calc(env(safe-area-inset-bottom) + 148px)',
            background: 'var(--orbital-surface)',
            border: '1px solid var(--orbital-border)',
            color: 'var(--accent-bright)',
          }}
          title="Quick note (on set)"
          aria-label="Add a quick note"
        >
          <NotebookPen size={18} />
        </button>
      )}

      {open && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
          <button
            className="absolute inset-0"
            style={{ background: 'rgba(0,0,0,0.6)' }}
            onClick={close}
            aria-label="Close"
          />
          <div
            className="relative w-full sm:max-w-md card-elevated rounded-t-2xl sm:rounded-2xl p-4 space-y-3"
            // Sit above the keyboard rather than behind it.
            style={kb.keyboardOpen ? { marginBottom: 0, maxHeight: kb.height - 12, overflowY: 'auto' } : undefined}
          >
            <div className="flex items-center justify-between">
              <p className="hud-label">QUICK NOTE</p>
              <button onClick={close} className="p-1 text-orbital-subtle hover:text-orbital-text" aria-label="Close">
                <X size={16} />
              </button>
            </div>

            {options.length === 0 ? (
              <div className="py-4 text-center">
                <p className="text-sm text-orbital-subtle mb-3">No live productions to note against.</p>
                <button onClick={() => { close(); navigate('/productions') }} className="btn-secondary text-xs">
                  Go to Productions
                </button>
              </div>
            ) : (
              <>
                <select
                  className="w-full text-sm rounded-sm px-2 py-2 cursor-pointer outline-none border"
                  style={{
                    background: 'var(--orbital-surface)',
                    color: 'var(--orbital-text)',
                    borderColor: 'var(--orbital-border)',
                  }}
                  value={productionId}
                  onChange={(e) => setProductionId(e.target.value)}
                >
                  {options.map(p => (
                    <option
                      key={p.id}
                      value={p.id}
                      style={{ background: 'var(--orbital-surface)', color: 'var(--orbital-text)' }}
                    >
                      {p.name}{p.client ? ` — ${p.client}` : ''}
                    </option>
                  ))}
                </select>

                <div className="flex gap-2 items-start">
                  <textarea
                    ref={inputRef}
                    className="input flex-1 min-h-[72px] resize-y text-sm"
                    placeholder="What just happened? e.g. Scissor lift arrived damaged — photo on my phone"
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    onKeyDown={(e) => {
                      // Enter sends; Shift+Enter for a second line.
                      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() }
                    }}
                  />
                  <DictationMic onText={(t) => setText(n => (n ? `${n} ${t}` : t))} />
                </div>

                <div className="flex items-center gap-2">
                  <p className="text-[11px] text-orbital-dim flex-1">
                    Lands in that production&apos;s Quick Notes and compiles into its debrief.
                  </p>
                  <button onClick={send} disabled={!text.trim()} className="btn-primary text-sm disabled:opacity-40">
                    <Check size={14} /> Add note
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  )
}
