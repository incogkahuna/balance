import { useState, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { X, ChevronLeft } from 'lucide-react'
import clsx from 'clsx'
import { useApp } from '../context/AppContext.jsx'
import { mockParseInputs, generateQuestions, buildProductionFromDraft } from '../features/intake/intakeUtils.js'
import { InputStage }     from '../features/intake/InputStage.jsx'
import { ParsingStage }   from '../features/intake/ParsingStage.jsx'
import { QuestionsStage } from '../features/intake/QuestionsStage.jsx'
import { ReviewStage }    from '../features/intake/ReviewStage.jsx'
import { FinalizingStage } from '../features/intake/FinalizingStage.jsx'

// ─── Step config ──────────────────────────────────────────────────────────────
const STEPS = [
  { id: 'input',      label: 'Inputs'    },
  { id: 'parsing',    label: 'Analysing' },
  { id: 'questions',  label: 'Questions' },
  { id: 'review',     label: 'Review'    },
  { id: 'finalizing', label: 'Creating'  },
]

const STEP_INDEX = Object.fromEntries(STEPS.map((s, i) => [s.id, i]))

// ─── IntakePage ────────────────────────────────────────────────────────────────
export function IntakePage() {
  const navigate = useNavigate()
  const { currentUser, addProduction, addTask, updateBible, addMilestone } = useApp()

  const [stage, setStage] = useState('input')

  // Central draft state
  const [draft, setDraft] = useState({
    inputs:       [],
    extracted:    {},
    contacts:     [],
    concerns:     [],
    parsingSummary: [],
    answers:      {},
    edits:        {},
    contactEdits: {},   // { [contactId]: { name, role, included } }
    concernEdits: {},   // { [concernId]: { included } }
  })

  // Computed questions (recalculated after parsing)
  const [questions, setQuestions] = useState([])

  // Created production id (for redirect)
  const createdIdRef = useRef(null)

  // ── Stage: Input → Parsing ─────────────────────────────────────────────────
  // Parse eagerly here — before the animation — so parsingSummary and extracted
  // fields are fully populated when ParsingStage renders and displays them.
  const handleInputsReady = useCallback((inputs) => {
    const { extracted, contacts, concerns, parsingSummary } = mockParseInputs(inputs)
    const qs = generateQuestions(extracted, {})
    // Reset answers/edits when re-submitting inputs so questions regenerate cleanly
    setDraft(d => ({ ...d, inputs, extracted, contacts, concerns, parsingSummary, answers: {}, edits: {} }))
    setQuestions(qs)
    setStage('parsing')
  }, [])

  // ── Stage: Parsing complete ────────────────────────────────────────────────
  // Parsing already happened in handleInputsReady — just advance the stage.
  const handleParsingComplete = useCallback(() => {
    setStage(questions.length > 0 ? 'questions' : 'review')
  }, [questions.length])

  // ── Stage: Q&A ────────────────────────────────────────────────────────────
  const handleAnswer = useCallback((field, value) => {
    setDraft(d => ({ ...d, answers: { ...d.answers, [field]: value } }))
  }, [])

  const handleQuestionsComplete = useCallback(() => {
    setStage('review')
  }, [])

  // ── Stage: Review edits ────────────────────────────────────────────────────
  const handleEdit = useCallback((field, value) => {
    setDraft(d => ({ ...d, edits: { ...d.edits, [field]: value } }))
  }, [])

  const handleEditContact = useCallback((contactId, updates) => {
    setDraft(d => ({
      ...d,
      contactEdits: {
        ...d.contactEdits,
        [contactId]: { ...(d.contactEdits[contactId] || {}), ...updates },
      },
    }))
  }, [])

  const handleToggleConcern = useCallback((concernId, included) => {
    setDraft(d => ({
      ...d,
      concernEdits: {
        ...d.concernEdits,
        [concernId]: { ...(d.concernEdits[concernId] || {}), included },
      },
    }))
  }, [])

  // ── Stage: Finalize → create production ───────────────────────────────────
  // Read draft directly (not via updater) so context writes don't run twice
  // in React Strict Mode. All setProductions calls are batched by React 18.
  const handleFinalize = useCallback(() => {
    const { production, tasks, milestones } = buildProductionFromDraft(draft, currentUser)
    createdIdRef.current = production.id

    addProduction(production)
    tasks.forEach(task => addTask(task))
    milestones.forEach(m => addMilestone(production.id, m))

    setStage('finalizing')
  }, [draft, currentUser, addProduction, addTask, addMilestone])

  const handleRedirect = useCallback(() => {
    if (createdIdRef.current) {
      navigate(`/productions/${createdIdRef.current}`)
    } else {
      navigate('/productions')
    }
  }, [navigate])

  // ── Back navigation ────────────────────────────────────────────────────────
  const canGoBack = stage === 'questions' || stage === 'review'
  const goBack = () => {
    if (stage === 'questions') setStage('input')
    if (stage === 'review')    setStage(questions.length > 0 ? 'questions' : 'input')
  }

  const currentStepIndex = STEP_INDEX[stage] ?? 0
  const isLocked = stage === 'parsing' || stage === 'finalizing'

  // Title per stage
  const TITLES = {
    input:      { heading: 'New Production',              sub: 'Drop in what you have — I\'ll organise it.' },
    parsing:    { heading: 'Analysing your inputs',       sub: 'Extracting everything I can find…' },
    questions:  { heading: 'A few quick questions',       sub: 'Only what I couldn\'t find automatically.' },
    review:     { heading: 'Review your production',      sub: 'Check everything before we create it.' },
    finalizing: { heading: 'Building your production',    sub: 'Almost done…' },
  }
  const title = TITLES[stage]

  const resolvedTitle = draft.edits?.title || draft.answers?.title || draft.extracted?.title?.value || null

  return (
    <div className="min-h-screen flex flex-col">
      {/* ── Header ───────────────────────────────────────────────────────────── */}
      <div className="sticky top-0 z-20 bg-orbital-bg border-b border-orbital-border/60 backdrop-blur-sm">
        <div className="max-w-2xl mx-auto px-4 h-14 flex items-center gap-4">

          {/* Back / close */}
          <div className="flex items-center gap-2 flex-shrink-0">
            {canGoBack && !isLocked ? (
              <button
                onClick={goBack}
                className="flex items-center gap-1.5 text-sm text-orbital-subtle hover:text-orbital-text transition-colors"
              >
                <ChevronLeft size={16} />
                Back
              </button>
            ) : (
              <button
                onClick={() => navigate('/productions')}
                disabled={isLocked}
                className="p-1.5 rounded-lg hover:bg-white/10 text-orbital-subtle hover:text-orbital-text transition-colors disabled:opacity-30 disabled:pointer-events-none"
              >
                <X size={16} />
              </button>
            )}
          </div>

          {/* Step pills */}
          <div className="flex items-center gap-1.5 flex-1 justify-center">
            {STEPS.filter(s => s.id !== 'finalizing').map((s, i) => {
              const idx       = STEP_INDEX[s.id]
              const isDone    = idx < currentStepIndex
              const isCurrent = idx === currentStepIndex
              return (
                <div key={s.id} className="flex items-center gap-1.5">
                  <div className={clsx(
                    'flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-all',
                    isDone    ? 'bg-green-500/15 text-green-400'
                    : isCurrent ? 'bg-blue-500/20 text-blue-400'
                    : 'bg-white/5 text-orbital-subtle/50'
                  )}>
                    <span className={clsx(
                      'w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-bold',
                      isDone    ? 'bg-green-500/30 text-green-300'
                      : isCurrent ? 'bg-blue-500/30 text-blue-300'
                      : 'bg-white/10'
                    )}>
                      {isDone ? '✓' : i + 1}
                    </span>
                    <span className="hidden sm:inline">{s.label}</span>
                  </div>
                  {i < STEPS.filter(s => s.id !== 'finalizing').length - 1 && (
                    <div className={clsx('w-3 h-px', isDone ? 'bg-green-500/40' : 'bg-orbital-border/40')} />
                  )}
                </div>
              )
            })}
          </div>

          {/* Spacer to balance close button */}
          <div className="w-10 flex-shrink-0" />
        </div>
      </div>

      {/* ── Content ───────────────────────────────────────────────────────────── */}
      <div className="flex-1 max-w-2xl w-full mx-auto px-4 py-6">

        {/* Stage heading */}
        {stage !== 'finalizing' && stage !== 'parsing' && (
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-orbital-text">{title.heading}</h1>
            <p className="text-sm text-orbital-subtle mt-1">{title.sub}</p>
            {resolvedTitle && stage === 'review' && (
              <div className="mt-2 inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/20">
                <div className="w-1.5 h-1.5 rounded-full bg-blue-400" />
                <span className="text-xs text-blue-400 font-medium">{resolvedTitle}</span>
              </div>
            )}
          </div>
        )}

        {/* Stage components */}
        {stage === 'input' && (
          <InputStage onNext={handleInputsReady} />
        )}

        {stage === 'parsing' && (
          <ParsingStage
            parsingSummary={draft.parsingSummary}
            onComplete={handleParsingComplete}
          />
        )}

        {stage === 'questions' && (
          <QuestionsStage
            questions={questions}
            extracted={draft.extracted}
            onAnswer={handleAnswer}
            onComplete={handleQuestionsComplete}
          />
        )}

        {stage === 'review' && (
          <ReviewStage
            draft={draft}
            onEdit={handleEdit}
            onEditContact={handleEditContact}
            onToggleConcern={handleToggleConcern}
            onFinalize={handleFinalize}
          />
        )}

        {stage === 'finalizing' && (
          <FinalizingStage
            productionName={resolvedTitle}
            onRedirect={handleRedirect}
          />
        )}
      </div>
    </div>
  )
}
