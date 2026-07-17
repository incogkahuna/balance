import { useState } from 'react'
import { Star } from 'lucide-react'
import { useApp } from '../../context/AppContext.jsx'
import { createFeedback } from '../../data/models.js'
import { DictationMic } from '../voice/DictationMic.tsx'

// Debrief field — label + dictation mic + textarea, same shape four times.
function Field({ label, value, onChange, placeholder, minH = 'min-h-[80px]' }) {
  return (
    <div>
      <div className="flex items-center justify-between">
        <label className="label">{label}</label>
        <DictationMic onText={t => onChange(value ? `${value}\n${t}` : t)} />
      </div>
      <textarea
        className={`input ${minH} resize-y`}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
      />
    </div>
  )
}

export function FeedbackForm({ productionId, initial, onSubmit, onCancel }) {
  const { currentUser } = useApp()

  const [form, setForm] = useState({
    expectations: initial?.expectations || '',
    whatHappened: initial?.whatHappened || '',
    issues: initial?.issues || '',
    extraCharges: initial?.extraCharges || '',
    rating: initial?.rating || null,
  })

  const set = (key, val) => setForm(f => ({ ...f, [key]: val }))

  const handleSubmit = (e) => {
    e.preventDefault()
    const fb = createFeedback({
      ...(initial || {}),
      productionId,
      expectations: form.expectations,
      whatHappened: form.whatHappened,
      issues: form.issues,
      extraCharges: form.extraCharges,
      rating: form.rating,
      submittedBy: initial?.submittedBy || currentUser?.id,
    })
    onSubmit(fb)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <Field
        label="What were the expectations going in?"
        value={form.expectations}
        onChange={v => set('expectations', v)}
        placeholder="What was the plan, what did you tell the team to expect..."
      />

      <Field
        label="What actually happened?"
        value={form.whatHappened}
        onChange={v => set('whatHappened', v)}
        placeholder="How did the production actually go..."
      />

      <Field
        label="Issues encountered"
        value={form.issues}
        onChange={v => set('issues', v)}
        placeholder="Problems, delays, client issues, technical failures..."
        minH="min-h-[60px]"
      />

      <Field
        label="Extra charges incurred"
        value={form.extraCharges}
        onChange={v => set('extraCharges', v)}
        placeholder="Overtime, additional equipment, damage costs..."
        minH="min-h-[60px]"
      />

      <div>
        <label className="label">Overall rating</label>
        <div className="flex items-center gap-2">
          {[1, 2, 3, 4, 5].map(n => (
            <button
              key={n}
              type="button"
              onClick={() => set('rating', n)}
              className="p-1 transition-transform hover:scale-110"
            >
              <Star
                size={28}
                className={n <= (form.rating || 0) ? 'text-amber-400 fill-amber-400' : 'text-orbital-border'}
              />
            </button>
          ))}
          {form.rating && (
            <span className="text-sm text-orbital-subtle ml-2">
              {['', 'Rough', 'Below average', 'Average', 'Good', 'Excellent'][form.rating]}
            </span>
          )}
        </div>
      </div>

      <div className="flex gap-3 pt-1">
        <button type="button" onClick={onCancel} className="btn-secondary flex-1">Cancel</button>
        <button type="submit" className="btn-primary flex-1">
          {initial?.id ? 'Update Debrief' : 'Submit Debrief'}
        </button>
      </div>
    </form>
  )
}
