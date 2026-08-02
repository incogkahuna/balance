import { supabase } from './supabase'

// Client for the `synthesize-debriefs` Supabase Edge Function — merges a set
// of submitted debriefs into one categorised review document. Throws a typed
// error on any failure so callers can keep showing the raw debriefs; this is
// an enhancement layer, never a gate.
//
// Deploy requirements (see supabase/functions/synthesize-debriefs/index.ts):
//   supabase secrets set ANTHROPIC_API_KEY=sk-ant-...   (already set)
//   supabase functions deploy synthesize-debriefs

export interface SynthesisItem {
  title: string
  detail: string
  productions: string[]
  reportedBy: string[]
  recurrence: number
}

export interface DebriefSynthesis {
  summary: string
  wins: SynthesisItem[]
  issues: SynthesisItem[]
  learnings: SynthesisItem[]
  money: SynthesisItem[]
}

export interface DebriefInput {
  production: string
  client: string
  submittedByName: string
  submittedAt: string
  text: string
}

export class SynthesizeError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.name = 'SynthesizeError'
    this.status = status
  }
}

// Cross-referencing dozens of debriefs at high effort is a slow call by
// design — a spinner is showing, so allow well past the default.
const TIMEOUT_MS = 180_000

const items = (v: unknown): SynthesisItem[] =>
  Array.isArray(v)
    ? v.map((raw) => {
        const i = (raw ?? {}) as Partial<SynthesisItem>
        return {
          title: i.title || '',
          detail: i.detail || '',
          productions: Array.isArray(i.productions) ? i.productions : [],
          reportedBy: Array.isArray(i.reportedBy) ? i.reportedBy : [],
          recurrence: Number(i.recurrence) || 1,
        }
      }).filter((i) => i.title)
    : []

export async function synthesizeDebriefs(debriefs: DebriefInput[]): Promise<DebriefSynthesis> {
  if (debriefs.length === 0) throw new SynthesizeError(400, 'No debriefs selected')

  const invoke = supabase.functions.invoke<{ synthesis?: unknown }>('synthesize-debriefs', {
    body: { debriefs },
  })
  const timeout = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new SynthesizeError(408, 'Synthesis timed out')), TIMEOUT_MS),
  )

  const { data, error } = await Promise.race([invoke, timeout])

  if (error) {
    const status = (error as { context?: { status?: number } }).context?.status ?? 0
    throw new SynthesizeError(status, error.message || 'Synthesis failed')
  }
  const s = data?.synthesis as Partial<DebriefSynthesis> | undefined
  if (!s || typeof s !== 'object') {
    throw new SynthesizeError(502, 'Malformed response from synthesize-debriefs')
  }

  // Defensive normalization — the schema guarantees these server-side, but a
  // stale deployed function shouldn't crash the page.
  return {
    summary: s.summary || '',
    wins: items(s.wins),
    issues: items(s.issues),
    learnings: items(s.learnings),
    money: items(s.money),
  }
}
