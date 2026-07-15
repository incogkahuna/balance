import { supabase } from './supabase'

// Client for the `parse-intake` Supabase Edge Function — the Tier 2 (Claude)
// brief parser with vision. Mirrors the transcribe client's contract: throws
// a typed error on any failure so callers can fall back to the Tier 1
// heuristics. This is an enhancement layer, never a gate.
//
// Deploy requirements (see supabase/functions/parse-intake/index.ts):
//   supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
//   supabase functions deploy parse-intake

export interface Tier2Contact {
  name: string
  email: string
  phone: string
  company: string
  role: string
}

export interface Tier2Concern {
  title: string
  category:
    | 'tight-timeline' | 'back-to-back' | 'missing-resource'
    | 'conflict' | 'weather' | 'unresolved' | 'general'
}

export interface Tier2Extraction {
  title: string
  client: string
  productionType: string
  locationType: 'In-House (Orbital Studios)' | 'Mobile' | ''
  locationAddress: string
  startDate: string
  endDate: string
  contacts: Tier2Contact[]
  crewNames: string[]
  concerns: Tier2Concern[]
  summary: string[]
}

export class ParseIntakeError extends Error {
  constructor(public status: number, message: string) {
    super(message)
    this.name = 'ParseIntakeError'
  }
}

// Shape of the intake wizard's input objects (src/features/intake/InputStage.jsx)
interface IntakeInput {
  id: string
  type: 'text' | 'image'
  content?: string | null
  fileName?: string
  preview?: string // data URL for images
}

const TIMEOUT_MS = 60_000

/**
 * Run the Tier 2 Claude parse over the intake wizard's inputs. Text inputs
 * (pasted briefs, voice transcripts) and image inputs (screenshots) are all
 * sent; screenshots get actually read via vision.
 *
 * Throws ParseIntakeError when the function isn't deployed, the caller isn't
 * authenticated, or parsing fails — callers should catch and continue with
 * the heuristic results.
 */
export async function parseIntakeInputs(inputs: IntakeInput[]): Promise<Tier2Extraction> {
  const payload = {
    today: new Date().toISOString().slice(0, 10),
    inputs: inputs
      .map((input) => {
        if (input.type === 'image' && input.preview?.startsWith('data:')) {
          return { kind: 'image' as const, dataUrl: input.preview, label: input.fileName || '' }
        }
        if (input.type === 'text' && input.content?.trim()) {
          return { kind: 'text' as const, content: input.content, label: input.fileName || '' }
        }
        return null
      })
      .filter((x): x is NonNullable<typeof x> => x !== null),
  }

  if (payload.inputs.length === 0) {
    throw new ParseIntakeError(400, 'No parseable inputs')
  }

  // supabase-js has no per-invoke timeout; guard with our own so the intake
  // wizard never hangs on a wedged function.
  const invoke = supabase.functions.invoke<{ extraction?: Tier2Extraction }>('parse-intake', {
    body: payload,
  })
  const timeout = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new ParseIntakeError(408, 'AI parse timed out')), TIMEOUT_MS),
  )

  const { data, error } = await Promise.race([invoke, timeout])

  if (error) {
    const status = (error as { context?: { status?: number } }).context?.status ?? 0
    throw new ParseIntakeError(status, error.message || 'AI parse failed')
  }
  if (!data?.extraction || typeof data.extraction !== 'object') {
    throw new ParseIntakeError(502, 'Malformed response from parse-intake function')
  }

  const e = data.extraction
  // Defensive normalization — the schema guarantees these server-side, but a
  // stale function version shouldn't crash the wizard.
  return {
    title:           e.title || '',
    client:          e.client || '',
    productionType:  e.productionType || '',
    locationType:    e.locationType || '',
    locationAddress: e.locationAddress || '',
    startDate:       e.startDate || '',
    endDate:         e.endDate || '',
    contacts:        Array.isArray(e.contacts) ? e.contacts : [],
    crewNames:       Array.isArray(e.crewNames) ? e.crewNames : [],
    concerns:        Array.isArray(e.concerns) ? e.concerns : [],
    summary:         Array.isArray(e.summary) ? e.summary : [],
  }
}
