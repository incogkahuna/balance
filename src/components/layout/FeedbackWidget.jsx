import { useState, useRef, useEffect } from 'react'
import { MessageSquarePlus, Send, X } from 'lucide-react'
import { useApp } from '../../context/AppContext.jsx'
import { useToast } from '../../context/ToastContext.jsx'
import { FEEDBACK_KIND, FEEDBACK_KIND_LABEL, createFeedbackItem } from '../../data/models.js'
import { DictationMic } from '../voice/DictationMic.tsx'
import clsx from 'clsx'

// ─── Global feedback widget (M5 / #3) ────────────────────────────────────────
// A floating control on every page: pick note / feature / bug, two fields,
// send — no navigation, no context lost. Reports land in the shared
// feedback_items table and surface on the Bugs & Ideas page.

export function FeedbackWidget() {
  const { currentUser, addFeedbackItem } = useApp()
  const toast = useToast()
  const [open, setOpen] = useState(false)
  const [kind, setKind] = useState(FEEDBACK_KIND.NOTE)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const panelRef = useRef(null)

  useEffect(() => {
    if (!open) return
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false) }
    const onClick = (e) => {
      if (panelRef.current && !panelRef.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('keydown', onKey)
    document.addEventListener('mousedown', onClick)
    return () => {
      document.removeEventListener('keydown', onKey)
      document.removeEventListener('mousedown', onClick)
    }
  }, [open])

  if (!currentUser) return null

  const send = () => {
    if (!title.trim()) return
    addFeedbackItem(createFeedbackItem({
      kind,
      title: title.trim(),
      description: description.trim(),
    }))
    toast.success('Feedback sent — thank you.')
    setTitle('')
    setDescription('')
    setOpen(false)
  }

  return (
    <div className="fixed bottom-5 right-5 z-40" ref={panelRef}>
      {/* Panel */}
      {open && (
        <div
          className="absolute bottom-12 right-0 w-80 card-elevated animate-hud-in p-4 space-y-3"
          style={{ boxShadow: '0 16px 48px rgba(0,0,0,0.45)' }}
        >
          <div className="flex items-center justify-between">
            <p className="hud-label text-[10px]">Send Feedback</p>
            <button
              onClick={() => setOpen(false)}
              className="text-orbital-subtle hover:text-orbital-text transition-colors"
              aria-label="Close"
            >
              <X size={14} />
            </button>
          </div>

          {/* Kind — note / feature / bug */}
          <div className="grid grid-cols-3 gap-1.5">
            {Object.values(FEEDBACK_KIND).map(k => (
              <button
                key={k}
                onClick={() => setKind(k)}
                className={clsx(
                  'px-2 py-1.5 text-xs font-medium border transition-colors',
                  kind === k
                    ? 'text-orbital-text'
                    : 'border-orbital-border text-orbital-subtle hover:text-orbital-text'
                )}
                style={kind === k ? { borderColor: 'var(--accent-ring)', background: 'var(--accent-soft)' } : {}}
              >
                {FEEDBACK_KIND_LABEL[k]}
              </button>
            ))}
          </div>

          <input
            className="input"
            placeholder={
              kind === FEEDBACK_KIND.BUG  ? 'What broke?' :
              kind === FEEDBACK_KIND.IDEA ? 'What should it do?' :
              'What’s on your mind?'
            }
            value={title}
            onChange={e => setTitle(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && title.trim()) send() }}
            autoFocus
          />

          <div className="relative">
            <textarea
              className="input min-h-[64px] resize-y text-sm pr-9"
              placeholder="Details (optional)"
              value={description}
              onChange={e => setDescription(e.target.value)}
            />
            <DictationMic
              className="absolute right-1.5 bottom-2"
              onText={t => setDescription(d => d ? `${d}\n${t}` : t)}
            />
          </div>

          <button onClick={send} disabled={!title.trim()} className="btn-primary w-full disabled:opacity-40">
            <Send size={13} /> Send
          </button>
        </div>
      )}

      {/* Trigger */}
      <button
        onClick={() => setOpen(o => !o)}
        className={clsx(
          'w-10 h-10 flex items-center justify-center rounded-full transition-all',
          open ? 'scale-95' : 'hover:scale-105'
        )}
        style={{
          background: 'var(--brand-grad)',
          boxShadow: '0 6px 20px rgba(42,123,187,0.45)',
          color: '#fff',
        }}
        title="Send feedback (note / feature / bug)"
        aria-label="Send feedback"
      >
        <MessageSquarePlus size={17} />
      </button>
    </div>
  )
}
