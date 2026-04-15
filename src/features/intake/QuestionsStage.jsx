import { useState, useRef, useCallback, useEffect } from 'react'
import { Mic, MicOff, ArrowRight, Check, ChevronLeft, SkipForward } from 'lucide-react'
import clsx from 'clsx'

// ─── Voice hook ───────────────────────────────────────────────────────────────
function useVoiceInput(onTranscript) {
  const [listening, setListening]   = useState(false)
  const recognitionRef              = useRef(null)
  const supported = typeof window !== 'undefined' &&
    !!(window.SpeechRecognition || window.webkitSpeechRecognition)

  const start = useCallback(() => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition
    const r  = new SR()
    r.lang            = 'en-US'
    r.interimResults  = false
    r.maxAlternatives = 1
    r.onresult  = e => { onTranscript(e.results[0][0].transcript); setListening(false) }
    r.onerror   = () => setListening(false)
    r.onend     = () => setListening(false)
    recognitionRef.current = r
    r.start()
    setListening(true)
  }, [onTranscript])

  const stop = useCallback(() => { recognitionRef.current?.stop(); setListening(false) }, [])

  return { supported, listening, start, stop }
}

// ─── Confidence badge (used here for showing extracted values) ─────────────────
function ConfidenceBadge({ confidence }) {
  if (!confidence) return null
  const map = {
    high:   'bg-green-500/15 text-green-400 border-green-500/25',
    medium: 'bg-amber-500/15 text-amber-400 border-amber-500/25',
    low:    'bg-red-500/15   text-red-400   border-red-500/25',
  }
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium border ${map[confidence]}`}>
      {confidence}
    </span>
  )
}

// ─── Single question card ─────────────────────────────────────────────────────
function QuestionCard({ question, extractedValue, onAnswer, onSkip, current, total }) {
  const [value,      setValue]      = useState('')
  const [startDate,  setStartDate]  = useState('')
  const [endDate,    setEndDate]    = useState('')
  const [confirmed,  setConfirmed]  = useState(false)
  const inputRef                    = useRef(null)

  const { supported: voiceSupported, listening, start: startVoice, stop: stopVoice } =
    useVoiceInput(transcript => setValue(transcript))

  // Auto-focus text/date input
  useEffect(() => {
    const t = setTimeout(() => inputRef.current?.focus(), 150)
    return () => clearTimeout(t)
  }, [question.id])

  const submit = () => {
    if (question.type === 'date') {
      if (!value.trim()) { onSkip(); return }
      onAnswer(question.field, value)
    } else if (question.type === 'daterange') {
      onAnswer('startDate', startDate || null)
      if (endDate) onAnswer('endDate', endDate)
    } else {
      if (!value.trim()) { onSkip(); return }
      onAnswer(question.field, value.trim())
    }
    setConfirmed(true)
    setTimeout(() => setConfirmed(false), 400)
  }

  const handleKeyDown = e => {
    if (e.key === 'Enter' && question.type === 'text') submit()
  }

  const handleSelectOption = opt => {
    onAnswer(question.field, opt.value)
  }

  return (
    <div className="flex flex-col gap-6">

      {/* Progress */}
      <div className="flex items-center justify-between">
        <span className="text-xs text-orbital-subtle font-mono">
          Question {current} of {total}
        </span>
        <div className="flex gap-1">
          {Array.from({ length: total }).map((_, i) => (
            <div key={i} className={clsx(
              'h-1 rounded-full transition-all duration-300',
              i < current - 1 ? 'w-6 bg-blue-400'
              : i === current - 1 ? 'w-6 bg-blue-400 animate-pulse'
              : 'w-6 bg-white/10'
            )} />
          ))}
        </div>
      </div>

      {/* If there's already an extracted value, show it */}
      {extractedValue && (
        <div className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-lg bg-amber-500/8 border border-amber-500/20">
          <div className="flex-1">
            <span className="text-xs text-amber-400/80">Found in your inputs</span>
            <p className="text-sm text-orbital-text mt-0.5 font-medium">"{extractedValue.value}"</p>
          </div>
          <ConfidenceBadge confidence={extractedValue.confidence} />
          <button
            onClick={() => onAnswer(question.field, extractedValue.value)}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-green-500/15 text-green-400 text-xs font-medium hover:bg-green-500/25 transition-colors flex-shrink-0"
          >
            <Check size={11} />
            Use this
          </button>
        </div>
      )}

      {/* Question text */}
      <div>
        <h2 className="text-xl font-semibold text-orbital-text leading-snug">
          {question.text}
        </h2>
        {question.hint && (
          <p className="text-sm text-orbital-subtle mt-1.5">{question.hint}</p>
        )}
      </div>

      {/* Input by type */}
      {question.type === 'text' && (
        <div className="flex gap-2">
          <div className="flex-1 relative">
            <input
              ref={inputRef}
              type="text"
              value={value}
              onChange={e => setValue(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Type your answer…"
              className="w-full bg-white/5 border border-orbital-border rounded-xl px-4 py-3.5 text-orbital-text placeholder:text-orbital-subtle/50 focus:outline-none focus:border-blue-400/60 text-base"
            />
          </div>
          {voiceSupported && (
            <button
              onMouseDown={listening ? stopVoice : startVoice}
              className={clsx(
                'w-12 h-12 mt-0.5 rounded-xl flex items-center justify-center transition-all flex-shrink-0',
                listening
                  ? 'bg-red-500/20 text-red-400 border border-red-500/30 animate-pulse'
                  : 'bg-white/5 text-orbital-subtle border border-orbital-border hover:bg-white/10 hover:text-orbital-text'
              )}
            >
              {listening ? <MicOff size={16} /> : <Mic size={16} />}
            </button>
          )}
        </div>
      )}

      {question.type === 'date' && (
        <div className="flex gap-2">
          <input
            ref={inputRef}
            type="date"
            value={value}
            onChange={e => setValue(e.target.value)}
            className="flex-1 bg-white/5 border border-orbital-border rounded-xl px-4 py-3.5 text-orbital-text focus:outline-none focus:border-blue-400/60 text-base"
          />
        </div>
      )}

      {question.type === 'daterange' && (
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex-1">
            <label className="block text-xs text-orbital-subtle mb-1.5">Start date</label>
            <input
              ref={inputRef}
              type="date"
              value={startDate}
              onChange={e => setStartDate(e.target.value)}
              className="w-full bg-white/5 border border-orbital-border rounded-xl px-4 py-3 text-orbital-text focus:outline-none focus:border-blue-400/60"
            />
          </div>
          <div className="flex-1">
            <label className="block text-xs text-orbital-subtle mb-1.5">End date <span className="text-orbital-subtle/50">(optional)</span></label>
            <input
              type="date"
              value={endDate}
              onChange={e => setEndDate(e.target.value)}
              className="w-full bg-white/5 border border-orbital-border rounded-xl px-4 py-3 text-orbital-text focus:outline-none focus:border-blue-400/60"
            />
          </div>
        </div>
      )}

      {question.type === 'select' && (
        <div className="flex flex-col gap-2">
          {question.options.map(opt => (
            <button
              key={opt.value}
              onClick={() => handleSelectOption(opt)}
              className="flex items-center gap-3 px-4 py-3.5 rounded-xl border border-orbital-border/60 bg-white/[0.02] hover:border-blue-400/40 hover:bg-blue-500/5 text-left transition-all group"
            >
              <div className="w-4 h-4 rounded-full border-2 border-orbital-border/60 group-hover:border-blue-400 transition-colors flex-shrink-0" />
              <span className="text-sm font-medium text-orbital-text">{opt.label}</span>
            </button>
          ))}
        </div>
      )}

      {/* Action row */}
      {question.type !== 'select' && (
        <div className="flex items-center gap-3">
          <button
            onClick={submit}
            disabled={
              (question.type === 'text' && !value.trim()) ||
              (question.type === 'date' && !value) ||
              (question.type === 'daterange' && !startDate)
            }
            className={clsx(
              'flex items-center gap-2 px-5 py-3 rounded-xl font-semibold text-sm transition-all',
              confirmed ? 'bg-green-500 text-white' :
              'bg-blue-500 hover:bg-blue-400 text-white disabled:opacity-30 disabled:pointer-events-none'
            )}
          >
            {confirmed ? <Check size={16} /> : <ArrowRight size={16} />}
            {confirmed ? 'Got it' : 'Next'}
          </button>
          <button
            onClick={onSkip}
            className="flex items-center gap-1.5 text-sm text-orbital-subtle hover:text-orbital-text transition-colors"
          >
            <SkipForward size={14} />
            Skip
          </button>
        </div>
      )}
    </div>
  )
}

// ─── QuestionsStage ────────────────────────────────────────────────────────────
export function QuestionsStage({ questions, extracted, onAnswer, onComplete }) {
  const [index,   setIndex]   = useState(0)
  const [answers, setAnswers] = useState({})

  // Auto-advance when there are no questions
  useEffect(() => {
    if (questions.length === 0) {
      const t = setTimeout(() => onComplete({}), 300)
      return () => clearTimeout(t)
    }
  }, [questions.length, onComplete])

  if (questions.length === 0) {
    return (
      <div className="flex flex-col items-center gap-4 py-12 text-center">
        <div className="w-14 h-14 rounded-full bg-green-500/15 flex items-center justify-center">
          <Check size={28} className="text-green-400" />
        </div>
        <div>
          <h2 className="text-lg font-semibold text-orbital-text">All good — no questions needed</h2>
          <p className="text-sm text-orbital-subtle mt-1">Your inputs had everything. Taking you to review…</p>
        </div>
      </div>
    )
  }

  const question = questions[index]

  const handleAnswer = (field, value) => {
    const updated = { ...answers, [field]: value }
    setAnswers(updated)
    onAnswer(field, value)
    advance(updated)
  }

  const handleSkip = () => advance(answers)

  const advance = (currentAnswers) => {
    if (index + 1 >= questions.length) {
      onComplete(currentAnswers)
    } else {
      setIndex(i => i + 1)
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <QuestionCard
        key={question.id}
        question={question}
        extractedValue={extracted?.[question.field]}
        onAnswer={handleAnswer}
        onSkip={handleSkip}
        current={index + 1}
        total={questions.length}
      />

      {/* Answered summary below current */}
      {Object.keys(answers).length > 0 && (
        <div className="mt-4 pt-4 border-t border-orbital-border/40 space-y-1">
          <p className="text-xs text-orbital-subtle uppercase tracking-wider mb-2">Answered</p>
          {Object.entries(answers).map(([field, value]) => (
            <div key={field} className="flex items-center gap-2 text-xs">
              <Check size={11} className="text-green-400 flex-shrink-0" />
              <span className="text-orbital-subtle capitalize">{field.replace(/([A-Z])/g, ' $1').toLowerCase()}</span>
              <span className="text-orbital-text truncate">→ {String(value)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
