import { useState } from 'react'
import { Star } from 'lucide-react'
import { useApp } from '../../context/AppContext.jsx'
import { createFeedback } from '../../data/models.js'

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
      <div>
        <label className="label">What were the expectations going in?</label>
        <textarea
          className="input min-h-[80px] resize-y"
          value={form.expectations}
          onChange={e => set('expectations', e.target.value)}
          placeholder="What was the plan, what did you tell the team to expect..."
        />
      </div>

      <div>
        <label className="label">What actually happened?</label>
        <textarea
          className="input min-h-[80px] resize-y"
          value={form.whatHappened}
          onChange={e => set('whatHappened', e.target.value)}
          placeholder="How did the production actually go..."
        />
      </div>

      <div>
        <label className="label">Issues encountered</label>
        <textarea
          className="input min-h-[60px] resize-y"
          value={form.issues}
          onChange={e => set('issues', e.target.value)}
          placeholder="Problems, delays, client issues, technical failures..."
        />
      </div>

      <div>
        <label className="label">Extra charges incurred</label>
        <textarea
          className="input min-h-[60px] resize-y"
          value={form.extraCharges}
          onChange={e => set('extraCharges', e.target.value)}
          placeholder="Overtime, additional equipment, damage costs..."
        />
      </div>

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
