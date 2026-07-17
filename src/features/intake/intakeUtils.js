import * as chrono from 'chrono-node'
import {
  createProduction, createTask, createMilestone,
  PRODUCTION_TYPE, PRODUCTION_STATUS, LOCATION_TYPE, TYPE_LOCATION_MAP,
  TASK_PRIORITY, TASK_STATUS,
  MILESTONE_TYPE, MILESTONE_STATUS,
  USERS,
} from '../../data/models.js'
import { addDays, subDays, format, isValid } from 'date-fns'

// ─── Crew name index ──────────────────────────────────────────────────────────
// Built once from the salary roster so we can fast-scan incoming text for
// references to known team members. Includes first name, last name, full
// name, and any nickname/avatar variants so "Brian", "Wilder", "Nitz",
// "Brian Nitzkin" all resolve. Order: longer phrases first so "Brian
// Nitzkin" wins over a bare "Brian" when both match. The lookup returns
// { userId, matchedAs } so we can show provenance in the UI.
const CREW_INDEX = (() => {
  const entries = []
  for (const u of USERS) {
    const variants = new Set()
    if (u.name) variants.add(u.name)
    if (u.name) {
      const parts = u.name.split(/\s+/)
      parts.forEach(p => variants.add(p))   // first / middle / last
      if (parts.length > 1) variants.add(`${parts[0]} ${parts.slice(-1)[0]}`)
    }
    // Add ID as a fallback if it looks like a name (e.g. 'wilder', 'nitz')
    if (/^[a-z]{2,}$/i.test(u.id)) variants.add(u.id)
    for (const v of variants) {
      entries.push({
        userId:   u.id,
        name:     u.name,
        matchedAs: v,
        // Word-boundary regex, case-insensitive. Escape regex specials in
        // the name so e.g. a future "J.J." or "(Nitz)" variant can't
        // produce an invalid pattern and crash this module at load.
        re:       new RegExp(`\\b${v.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i'),
      })
    }
  }
  // Longer-first so multi-word names hit before single tokens
  return entries.sort((a, b) => b.matchedAs.length - a.matchedAs.length)
})()

// ─── Text pattern matchers ────────────────────────────────────────────────────
const EMAIL_RE = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g
const PHONE_RE = /(?:\+?1[-.\s]?)?\(?([0-9]{3})\)?[-.\s]?([0-9]{3})[-.\s]?([0-9]{4})/g

// Dates: "March 15", "March 15th", "March 15th, 2025", "15/03/2025", "15-03-25"
const DATE_RE = /\b(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\s+\d{1,2}(?:st|nd|rd|th)?(?:,?\s+\d{4})?|\b\d{1,2}[\/\-]\d{1,2}(?:[\/\-]\d{2,4})?\b/gi

// ─── Structured keyword patterns (e.g. "Client: Nike") ───────────────────────
const TITLE_KEYS    = ['production:', 'project:', 'job:', 'shoot:', 'title:']
const CLIENT_KEYS   = ['client:', 'company:', 'brand:', 'for:']
const LOCATION_KEYS = ['location:', 'venue:', 'address:', 'studio:', 'site:']

// ─── Natural language patterns (voice-friendly) ───────────────────────────────
// Each entry: [regex, confidence]
const NL_TITLE_PATTERNS = [
  [/(?:production|project|shoot|job|campaign)\s+(?:is\s+)?(?:called|named|titled)\s+["']?([A-Z][^"'\n,.]{2,40})["']?/i, 'high'],
  [/(?:it'?s?\s+(?:a|the)\s+|working\s+on\s+(?:a|the)\s+|doing\s+(?:a|the)\s+)([A-Z][^"'\n,.]{2,40})(?:\s+(?:shoot|production|project|campaign|commercial|film|video))/i, 'medium'],
  [/^["']?([A-Z][A-Za-z0-9 &'\-]{3,40})["']?\s+(?:shoot|production|project|campaign|commercial|film)/im, 'medium'],
]

const NL_CLIENT_PATTERNS = [
  [/(?:client|brand|company)\s+(?:is\s+|=\s*)?["']?([A-Z][A-Za-z0-9 &'\-]{1,40})["']?(?:\.|,|\s|$)/i, 'high'],
  [/(?:for|with)\s+["']?([A-Z][A-Za-z0-9 &'\-]{1,40})["']?(?:\s+(?:commercial|campaign|production|shoot|project|brand|company|corp|inc|ltd|llc)|\s*[,.]|\s*$)/i, 'medium'],
  [/(?:it'?s?\s+for|working\s+for|shooting\s+for|job\s+(?:is\s+)?for)\s+["']?([A-Z][A-Za-z0-9 &'\-]{1,40})["']?/i, 'medium'],
]

const NL_LOCATION_PATTERNS = [
  [/(?:location|venue|studio|site|place)\s+(?:is\s+)?["']?([A-Za-z0-9 ,'\-]{3,60})["']?/i, 'high'],
  [/(?:at|in)\s+["']?([A-Z][A-Za-z0-9 '\-]{2,50})(?:\s+(?:studio|venue|space|centre|center|arena|hall|theatre|theater))["']?/i, 'medium'],
  [/(?:shooting|filming|building|based)\s+(?:at|in)\s+["']?([A-Za-z0-9 ',\-]{3,60})["']?/i, 'medium'],
]

// Start date: "starting March 15", "on March 15", "from March 15", "shoot is March 15"
const NL_STARTDATE_RE = /(?:start(?:s|ing)?|from|on|shoot(?:\s+is)?|date(?:\s+is)?|kick(?:s|ing)?\s*off)\s+(?:on\s+)?(\b(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\s+\d{1,2}(?:st|nd|rd|th)?(?:,?\s+\d{4})?|\d{1,2}[\/\-]\d{1,2}(?:[\/\-]\d{2,4})?)/gi

// End date: "through March 16", "until March 16", "ending March 16", "wrapping March 16"
const NL_ENDDATE_RE = /(?:through|until|to|end(?:s|ing)?|wrap(?:s|ping)?|finish(?:es|ing)?)\s+(?:on\s+)?(\b(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\s+\d{1,2}(?:st|nd|rd|th)?(?:,?\s+\d{4})?|\d{1,2}[\/\-]\d{1,2}(?:[\/\-]\d{2,4})?)/gi

const LED_KEYWORDS     = ['led', 'volume', 'xr ', ' xr', 'virtual production', 'led wall', 'led stage', 'extended reality', 'led volume', 'led shoot']
const MOBILE_KEYWORDS  = ['mobile build', 'mobile production', 'on location', 'on-location', 'remote shoot', 'location shoot', 'offsite', 'off-site', 'away shoot', 'on site', 'on-site']

// Concern detection — phrases that suggest something risky/uncertain.
// Tier 1 heuristic; Tier 2 (Claude) will catch the subtle stuff this misses.
// Each entry: { phrase, severityHint } — drives whether the surfaced concern
// gets flagged as a hard problem vs a soft maybe.
const CONCERN_PATTERNS = [
  // Hard problems
  { re: /\b(?:only|just)\s+\d+\s+(?:days?|hours?|weeks?)\b/i,                          hint: 'tight-timeline' },
  { re: /\bback[-\s]?to[-\s]?back\b/i,                                                  hint: 'back-to-back' },
  { re: /\b(?:no|without|missing)\s+(?:power|generator|crew|stage manager|sm|client)\b/i, hint: 'missing-resource' },
  { re: /\b(?:tight|crunch|crunched|impossible|aggressive)\s+(?:timeline|schedule|deadline)\b/i, hint: 'tight-timeline' },
  { re: /\b(?:double[-\s]?booked|overbooked|conflict|conflicts)\b/i,                    hint: 'conflict' },
  { re: /\b(?:rain|weather|storm|cold)\b.*\b(?:concern|risk|issue|problem)\b/i,         hint: 'weather' },
  // Soft uncertainty (lower confidence)
  { re: /\b(?:concern|issue|problem|risk|challenge|worried|worry)\b/i,                  hint: 'general' },
  { re: /\b(?:not sure|unclear|tbd|pending|to be (?:confirmed|determined))\b/i,         hint: 'unresolved' },
  { re: /\b(?:need(?:s)? to confirm|haven't confirmed|not (?:yet )?confirmed|still waiting)\b/i, hint: 'unresolved' },
]
const CONCERN_KEYWORDS = ['concern', 'issue', 'problem', 'risk', 'challenge', 'worried', 'not sure', 'unclear', 'tbd', 'pending', 'need to confirm', 'unresolved', "haven't confirmed", "not confirmed"]

// ─── Helpers ──────────────────────────────────────────────────────────────────
function extractByKeyword(text, keys) {
  for (const line of text.split('\n')) {
    const lower = line.toLowerCase().trim()
    for (const key of keys) {
      if (lower.startsWith(key) || lower.includes(` ${key}`)) {
        const value = line.split(/:\s*/).slice(1).join(':').trim()
        if (value.length > 1) return value
      }
    }
  }
  return null
}

function tryNLPatterns(text, patterns) {
  for (const [re, confidence] of patterns) {
    const m = text.match(re)
    if (m?.[1]?.trim().length > 1) {
      return { value: m[1].trim(), confidence }
    }
  }
  return null
}

function tryParseDate(str) {
  if (!str) return null
  const d = new Date(str)
  return isValid(d) ? format(d, 'yyyy-MM-dd') : null
}

function extractEmails(text) {
  return [...(text.matchAll(EMAIL_RE))].map(m => m[0])
}

function extractPhones(text) {
  return [...(text.matchAll(PHONE_RE))].map(m => m[0].trim())
}

function extractAllDates(text) {
  return [...(text.matchAll(DATE_RE))].map(m => m[0])
}

// ─── Chrono-powered date extraction ──────────────────────────────────────────
// Replaces the brittle regex date pipeline with chrono-node, which handles
// natural language ("next Tuesday", "in 3 weeks", "May 15-22", "the 15th
// through the 22nd", "tomorrow", "this Friday", etc).
//
// Returns { startDate, endDate } as YYYY-MM-DD strings, or null per field.
// When a range like "May 15-22" or "March 3rd through 5th" is detected,
// chrono gives us both ends. When a single date is detected, only startDate
// is filled.
function extractDatesWithChrono(text) {
  // chrono.parse returns ParsedResult[] each with .start (required) and
  // optional .end. Iterate to find the FIRST result with both ends (treat
  // as project window), or the first single-date result as startDate.
  const results = chrono.parse(text, new Date(), { forwardDate: true })
  if (results.length === 0) return { startDate: null, endDate: null }

  // Prefer a range result first
  const withRange = results.find(r => r.end)
  if (withRange) {
    const s = withRange.start.date()
    const e = withRange.end.date()
    return {
      startDate: isValid(s) ? format(s, 'yyyy-MM-dd') : null,
      endDate:   isValid(e) ? format(e, 'yyyy-MM-dd') : null,
    }
  }

  // No range — take the first single date as start. If a SECOND single
  // date exists later in the text, treat as end (covers "starts Mar 5.
  // wraps Mar 7." patterns where chrono parses as two separate results).
  const first  = results[0].start.date()
  const second = results[1]?.start.date() || null
  return {
    startDate: isValid(first)  ? format(first,  'yyyy-MM-dd') : null,
    endDate:   second && isValid(second) ? format(second, 'yyyy-MM-dd') : null,
  }
}

// ─── Crew name detection ─────────────────────────────────────────────────────
// Scan input text for references to known team members. Returns dedupe'd
// list of { userId, matchedAs, confidence }. Avoids false positives by
// preferring longer name matches and skipping single-letter or 1-char
// candidates implicitly (CREW_INDEX entries require length ≥2).
function detectCrewMentions(text) {
  const hits = new Map()  // userId → { matchedAs, confidence }
  for (const entry of CREW_INDEX) {
    if (hits.has(entry.userId)) continue   // already matched by a longer variant
    if (entry.re.test(text)) {
      // Multi-word matches are higher confidence than single-token (a bare
      // "Brian" could be anyone; "Brian Nitzkin" is unambiguous).
      const confidence = /\s/.test(entry.matchedAs) ? 'high' : 'medium'
      hits.set(entry.userId, { matchedAs: entry.matchedAs, confidence })
    }
  }
  return [...hits.entries()].map(([userId, info]) => ({ userId, ...info }))
}

// ─── Email-thread aware contact extraction ───────────────────────────────────
// In addition to the existing per-line scan, parse standard email headers
// (From:, To:, Cc:) which are extremely common in pasted email threads and
// the most reliable source of contact info. Captures the "Name <email>"
// pattern with high confidence.
function extractEmailHeaderContacts(text) {
  const out = []
  const HEADER_RE = /^(?:From|To|Cc|CC|Reply-To)\s*:\s*(.+?)$/gim
  for (const m of text.matchAll(HEADER_RE)) {
    const line = m[1]
    // Each line can have multiple comma-separated recipients
    for (const piece of line.split(/[,;]/)) {
      const p = piece.trim()
      if (!p) continue
      // "First Last <email@x.com>"  or  "<email@x.com>"  or  "email@x.com"
      const nameEmail = p.match(/^["']?([^"'<]+?)["']?\s*<\s*([^>]+)\s*>$/)
      if (nameEmail) {
        out.push({ name: nameEmail[1].trim(), email: nameEmail[2].trim().toLowerCase(), confidence: 'high' })
        continue
      }
      const bareEmail = p.match(EMAIL_RE)
      if (bareEmail) {
        out.push({ name: bareEmail[0].split('@')[0], email: bareEmail[0].toLowerCase(), confidence: 'medium' })
      }
    }
  }
  return out
}

// ─── Parse a single text input ────────────────────────────────────────────────
export function parseTextContent(text, sourceId) {
  const candidates = {}
  const contacts   = []
  const concerns   = []
  const lower      = text.toLowerCase()

  // ── Title ──
  // Try structured label first, then natural language
  const titleStructured = extractByKeyword(text, TITLE_KEYS)
  if (titleStructured) {
    candidates.title = { value: titleStructured, confidence: 'high', source: sourceId }
  } else {
    const titleNL = tryNLPatterns(text, NL_TITLE_PATTERNS)
    if (titleNL) candidates.title = { ...titleNL, source: sourceId }
  }

  // ── Client ──
  const clientStructured = extractByKeyword(text, CLIENT_KEYS)
  if (clientStructured) {
    candidates.client = { value: clientStructured, confidence: 'high', source: sourceId }
  } else {
    const clientNL = tryNLPatterns(text, NL_CLIENT_PATTERNS)
    if (clientNL) candidates.client = { ...clientNL, source: sourceId }
  }

  // ── Location ──
  const locationStructured = extractByKeyword(text, LOCATION_KEYS)
  if (locationStructured) {
    candidates.locationName = { value: locationStructured, confidence: 'high', source: sourceId }
  } else {
    const locationNL = tryNLPatterns(text, NL_LOCATION_PATTERNS)
    if (locationNL) candidates.locationName = { ...locationNL, source: sourceId }
  }

  // ── Production type / location type ──
  const isLED    = LED_KEYWORDS.some(k => lower.includes(k))
  const isMobile = MOBILE_KEYWORDS.some(k => lower.includes(k))
  if (isLED) {
    candidates.productionType = { value: PRODUCTION_TYPE.TVC_AOTO,           confidence: 'medium', source: sourceId }
    candidates.locationType   = { value: LOCATION_TYPE.IN_HOUSE,             confidence: 'medium', source: sourceId }
  } else if (isMobile) {
    candidates.productionType = { value: PRODUCTION_TYPE.MOBILE_CAR_PROCESS, confidence: 'medium', source: sourceId }
    candidates.locationType   = { value: LOCATION_TYPE.MOBILE,               confidence: 'medium', source: sourceId }
  }

  // ── Dates ──
  // chrono-node handles natural language ("next Tuesday", "in 3 weeks",
  // "May 15-22", "the 15th through the 22nd") far more robustly than the
  // old regex pipeline. Returns start + optional end if a range is parsed.
  const chronoResult = extractDatesWithChrono(text)
  if (chronoResult.startDate) {
    candidates.startDate = { value: chronoResult.startDate, confidence: 'high', source: sourceId }
  }
  if (chronoResult.endDate) {
    candidates.endDate = { value: chronoResult.endDate, confidence: 'high', source: sourceId }
  }

  // ── Contacts: email-thread headers first (highest confidence), then
  //    in-body scan for any addresses chrono/headers missed. ──
  const headerContacts = extractEmailHeaderContacts(text)
  for (const c of headerContacts) {
    contacts.push({
      id:         crypto.randomUUID(),
      name:       c.name,
      email:      c.email,
      phone:      '',
      company:    '',
      roleGuess:  '',
      confidence: c.confidence,
      source:     sourceId,
    })
  }

  // In-body sweep for bare emails the headers didn't catch
  for (const line of text.split('\n')) {
    const lineEmails = [...(line.matchAll(EMAIL_RE))].map(m => m[0])
    if (!lineEmails.length) continue
    const email = lineEmails[0].toLowerCase()
    if (contacts.some(c => c.email === email)) continue
    const nameMatch =
      line.match(/^([A-Z][a-z]+ (?:[A-Z][a-z]+ )?[A-Z][a-z]+)/) ||
      line.match(/([A-Z][a-z]+ [A-Z][a-z]+)\s*[<(]/)
    const name = nameMatch?.[1] || null
    contacts.push({
      id:         crypto.randomUUID(),
      name:       name || email.split('@')[0],
      email,
      phone:      '',
      company:    '',
      roleGuess:  '',
      confidence: name ? 'high' : 'medium',
      source:     sourceId,
    })
  }

  // Natural language contact mentions (without email)
  const contactNLRe = /(?:contact(?:\s+is)?|reach out to|speak to|talk to|liaison(?:\s+is)?|point of contact)\s+([A-Z][a-z]+ [A-Z][a-z]+)/gi
  for (const m of text.matchAll(contactNLRe)) {
    const name = m[1]
    if (!contacts.find(c => c.name === name)) {
      contacts.push({
        id:         crypto.randomUUID(),
        name,
        email:      '',
        phone:      '',
        company:    '',
        roleGuess:  '',
        confidence: 'medium',
        source:     sourceId,
      })
    }
  }

  // Attach loose phone numbers to first contactless slot
  extractPhones(text).forEach(phone => {
    const slot = contacts.find(c => !c.phone)
    if (slot) slot.phone = phone
  })

  // ── Concerns ──
  // Smarter detection using categorised regex library (replaces the bare
  // keyword pass). Tags each concern with the matched hint so the UI can
  // surface category-specific severity treatment.
  const seenConcerns = new Set()
  for (const line of text.split('\n')) {
    const trimmed = line.trim()
    if (trimmed.length < 12) continue
    for (const { re, hint } of CONCERN_PATTERNS) {
      if (re.test(trimmed) && !seenConcerns.has(trimmed)) {
        seenConcerns.add(trimmed)
        concerns.push({
          id:          crypto.randomUUID(),
          title:       trimmed.slice(0, 90),
          description: '',
          category:    hint,
          confidence:  hint === 'general' || hint === 'unresolved' ? 'low' : 'medium',
          include:     false,
          source:      sourceId,
        })
        break  // one hit per line
      }
    }
    if (concerns.length >= 5) break  // bumped from 3 → 5
  }

  // ── Crew mentions ──
  // Scan for known team members named in the text. Returned alongside
  // contacts/concerns since this is a collection (multiple people can be
  // mentioned in one input). Merged via union across all inputs.
  const detectedCrew = detectCrewMentions(text).map(c => ({ ...c, source: sourceId }))

  return { candidates, contacts, concerns, detectedCrew }
}

// ─── Full input set parser ────────────────────────────────────────────────────
const CONF_RANK = { high: 3, medium: 2, low: 1 }

export function mockParseInputs(inputs) {
  const extracted      = {}
  const allContacts    = []
  const allConcerns    = []
  const crewByUserId   = new Map()  // unioned across all inputs
  const parsingSummary = []

  inputs.forEach((input, i) => {
    const label = input.fileName || `Input ${i + 1}`

    if (input.type === 'text' && input.content?.trim()) {
      const { candidates, contacts, concerns, detectedCrew } = parseTextContent(input.content, input.id)

      // Merge candidates — higher confidence wins
      Object.entries(candidates).forEach(([field, candidate]) => {
        const existing = extracted[field]
        if (!existing || CONF_RANK[candidate.confidence] > CONF_RANK[existing.confidence]) {
          extracted[field] = { ...candidate, sourceName: label }
        }
      })

      allContacts.push(...contacts.map(c => ({ ...c, sourceName: label })))
      allConcerns.push(...concerns.map(c => ({ ...c, sourceName: label })))

      // Crew: union — same person mentioned in two inputs only shows once,
      // but keeps the highest-confidence mention's metadata.
      for (const c of (detectedCrew || [])) {
        const existing = crewByUserId.get(c.userId)
        if (!existing || CONF_RANK[c.confidence] > CONF_RANK[existing.confidence]) {
          crewByUserId.set(c.userId, { ...c, sourceName: label })
        }
      }

      const found = Object.keys(candidates)
      if (found.length)              parsingSummary.push(`Extracted ${found.join(', ')} from ${label}`)
      if (contacts.length)           parsingSummary.push(`Found ${contacts.length} contact${contacts.length > 1 ? 's' : ''} in ${label}`)
      if ((detectedCrew || []).length) parsingSummary.push(`Identified ${detectedCrew.length} team member${detectedCrew.length > 1 ? 's' : ''} in ${label}`)
    }

    if (input.type === 'image') {
      parsingSummary.push(`Screenshot "${label}" uploaded — ready for review`)
    }
  })

  // Deduplicate contacts by email
  const seenEmails = new Set()
  const contacts   = allContacts.filter(c => {
    if (!c.email) return true
    if (seenEmails.has(c.email)) return false
    seenEmails.add(c.email)
    return true
  })

  return {
    extracted,
    contacts,
    concerns:     allConcerns.slice(0, 5),
    detectedCrew: [...crewByUserId.values()],
    parsingSummary,
  }
}

// ─── Tier 2 merge ─────────────────────────────────────────────────────────────
// Fold the Claude (vision) extraction into the Tier 1 heuristic result.
// Claude saw everything the heuristics saw PLUS the screenshots, so a
// non-empty Claude field wins; empty Claude fields keep the heuristic value.
// Output shape is identical to mockParseInputs so callers can treat the two
// tiers interchangeably.
const AI_SOURCE = 'claude'
const AI_SOURCE_NAME = 'AI analysis'
const DATE_RE_ISO = /^\d{4}-\d{2}-\d{2}$/

export function mergeTier2Results(tier1, tier2) {
  const extracted = { ...tier1.extracted }

  const setField = (field, value) => {
    if (!value) return
    extracted[field] = { value, confidence: 'high', source: AI_SOURCE, sourceName: AI_SOURCE_NAME }
  }

  setField('title',  tier2.title)
  setField('client', tier2.client)
  setField('productionType', tier2.productionType)
  setField('locationType',   tier2.locationType)
  setField('locationName',   tier2.locationAddress)
  if (DATE_RE_ISO.test(tier2.startDate)) setField('startDate', tier2.startDate)
  if (DATE_RE_ISO.test(tier2.endDate))   setField('endDate',   tier2.endDate)

  // ── Contacts — merge by email (preferred) then by name ──
  const contacts = [...tier1.contacts]
  for (const c of tier2.contacts || []) {
    if (!c?.name && !c?.email) continue
    const email = (c.email || '').toLowerCase()
    const existing = contacts.find(x =>
      (email && x.email && x.email.toLowerCase() === email) ||
      (c.name && x.name && x.name.toLowerCase() === c.name.toLowerCase())
    )
    if (existing) {
      // Claude often fills gaps the regexes couldn't (role, company, phone)
      if (!existing.phone && c.phone)       existing.phone = c.phone
      if (!existing.company && c.company)   existing.company = c.company
      if (!existing.roleGuess && c.role)    existing.roleGuess = c.role
      if (!existing.email && email)         existing.email = email
      existing.confidence = 'high'
    } else {
      contacts.push({
        id:         crypto.randomUUID(),
        name:       c.name || (email ? email.split('@')[0] : ''),
        email,
        phone:      c.phone || '',
        company:    c.company || '',
        roleGuess:  c.role || '',
        confidence: 'high',
        source:     AI_SOURCE,
        sourceName: AI_SOURCE_NAME,
      })
    }
  }

  // ── Crew — map Claude's name strings back onto the known roster ──
  const crewById = new Map(tier1.detectedCrew.map(c => [c.userId, c]))
  const crewText = (tier2.crewNames || []).join('\n')
  if (crewText.trim()) {
    for (const hit of detectCrewMentions(crewText)) {
      const existing = crewById.get(hit.userId)
      if (!existing || CONF_RANK[hit.confidence] > CONF_RANK[existing.confidence]) {
        crewById.set(hit.userId, { ...hit, source: AI_SOURCE, sourceName: AI_SOURCE_NAME })
      }
    }
  }

  // ── Concerns — append non-duplicates, AI first (usually higher quality) ──
  const concerns = [...tier1.concerns]
  for (const c of tier2.concerns || []) {
    if (!c?.title) continue
    const isDupe = concerns.some(x =>
      x.title.toLowerCase().includes(c.title.toLowerCase().slice(0, 40)) ||
      c.title.toLowerCase().includes(x.title.toLowerCase().slice(0, 40))
    )
    if (isDupe) continue
    concerns.push({
      id:          crypto.randomUUID(),
      title:       c.title.slice(0, 90),
      description: '',
      category:    c.category || 'general',
      confidence:  'high',
      include:     false,
      source:      AI_SOURCE,
      sourceName:  AI_SOURCE_NAME,
    })
    if (concerns.length >= 8) break
  }

  const parsingSummary = [
    ...tier1.parsingSummary.filter(line => !line.includes('uploaded — ready for review')),
    ...(tier2.summary || []).map(line => `AI · ${line}`),
  ]

  return {
    extracted,
    contacts,
    concerns,
    detectedCrew: [...crewById.values()],
    parsingSummary,
  }
}

// ─── Question engine ──────────────────────────────────────────────────────────
const QUESTION_DEFS = [
  {
    id: 'title', field: 'title', priority: 1, required: true,
    text: "What should this production be called?",
    hint: 'e.g. Nike Brand Film, Q3 Commercial Shoot',
    type: 'text',
  },
  {
    id: 'client', field: 'client', priority: 2, required: true,
    text: "Who is the client or company?",
    hint: 'e.g. Nike, Sony Pictures, BBC',
    type: 'text',
  },
  {
    id: 'startDate', field: 'startDate', priority: 3, required: false,
    text: "When does the shoot start?",
    hint: 'Approximate is fine — you can adjust later',
    type: 'date',
  },
  {
    id: 'endDate', field: 'endDate', priority: 4, required: false,
    text: "When does it wrap?",
    hint: 'Optional — leave blank if same day',
    type: 'date',
  },
  {
    id: 'productionType', field: 'productionType', priority: 5, required: false,
    text: "What type of production is this?",
    hint: null,
    type: 'select',
    options: [
      { label: 'TVC AOTO',                value: PRODUCTION_TYPE.TVC_AOTO           },
      { label: 'Mobile CAR process CLI',  value: PRODUCTION_TYPE.MOBILE_CAR_PROCESS },
    ],
  },
  {
    id: 'locationType', field: 'locationType', priority: 6, required: false,
    text: "In-house at Orbital Studios, or a mobile build?",
    hint: null,
    type: 'select',
    options: [
      { label: 'In-House (Orbital Studios)', value: LOCATION_TYPE.IN_HOUSE },
      { label: 'Mobile / On Location',       value: LOCATION_TYPE.MOBILE  },
    ],
  },
]

export function generateQuestions(extracted, answers) {
  return QUESTION_DEFS.filter(q => {
    if (answers?.[q.field] !== undefined) return false
    // Preset production types imply the location (TVC AOTO is the permanent
    // in-house volume) — never ask a question the type already answers.
    if (q.field === 'locationType') {
      const type = answers?.productionType ?? extracted?.productionType?.value
      if (type && TYPE_LOCATION_MAP[type]) return false
    }
    const ex = extracted?.[q.field]
    if (!ex?.value) return true
    if (q.required && ex.confidence !== 'high') return true
    return false
  })
}

// ─── Field resolution ─────────────────────────────────────────────────────────
// Priority: edits → answers → extracted → null
export function resolveField(field, extracted, answers, edits) {
  if (edits?.[field] !== undefined)   return { value: edits[field],            source: 'edited',   confidence: 'high' }
  if (answers?.[field] !== undefined) return { value: answers[field],          source: 'answered', confidence: 'high' }
  if (extracted?.[field]?.value)      return extracted[field]
  return { value: null, source: null, confidence: null }
}

// ─── Starter tasks ────────────────────────────────────────────────────────────
// Fallback starter tasks for unknown / custom production types.
const FALLBACK_TASKS = [
  { title: 'Confirm production brief with client',            priority: TASK_PRIORITY.HIGH   },
  { title: 'Finalise crew and equipment list',                priority: TASK_PRIORITY.HIGH   },
  { title: 'Confirm location and access arrangements',        priority: TASK_PRIORITY.MEDIUM },
  { title: 'Schedule pre-production walkthrough',             priority: TASK_PRIORITY.MEDIUM },
  { title: 'Set up communication channels with client',       priority: TASK_PRIORITY.LOW    },
]

const TASK_DEFS = {
  [PRODUCTION_TYPE.TVC_AOTO]: [
    { title: 'Confirm client brief and shot list',              priority: TASK_PRIORITY.HIGH   },
    { title: 'Schedule technical recce',                        priority: TASK_PRIORITY.HIGH   },
    { title: 'Confirm LED wall configuration and pixel mapping',priority: TASK_PRIORITY.MEDIUM },
    { title: 'Brief camera team on volume workflow',            priority: TASK_PRIORITY.MEDIUM },
    { title: 'Test lighting rig and background content',        priority: TASK_PRIORITY.MEDIUM },
    { title: 'Confirm post-production pipeline with client',    priority: TASK_PRIORITY.LOW    },
  ],
  [PRODUCTION_TYPE.MOBILE_CAR_PROCESS]: [
    { title: 'Confirm venue access times and loading plan',     priority: TASK_PRIORITY.HIGH   },
    { title: 'Arrange transport and logistics for equipment',   priority: TASK_PRIORITY.HIGH   },
    { title: 'Coordinate power requirements with venue',        priority: TASK_PRIORITY.MEDIUM },
    { title: 'Confirm local crew availability',                 priority: TASK_PRIORITY.MEDIUM },
    { title: 'Pre-shoot pack and inventory check',              priority: TASK_PRIORITY.MEDIUM },
    { title: 'Arrange derig transport and return schedule',     priority: TASK_PRIORITY.LOW    },
  ],
}

export function generateStarterTasks(productionType, productionId, createdBy) {
  const defs = TASK_DEFS[productionType] || FALLBACK_TASKS
  return defs.map(def => createTask({
    productionId,
    title:      def.title,
    priority:   def.priority,
    assignedBy: createdBy,
    status:     TASK_STATUS.NOT_STARTED,
  }))
}

// ─── Roadmap milestones ───────────────────────────────────────────────────────
const fmt = d => format(d, "yyyy-MM-dd'T'09:00")

// Fallback milestone set for unknown / custom production types.
const FALLBACK_MILESTONES = (start, end) => [
  { title: 'Pre-Production Complete',  type: MILESTONE_TYPE.PRE_PRODUCTION, date: fmt(subDays(start,  7)) },
  { title: 'Shoot Day',                type: MILESTONE_TYPE.SHOOT_DAY,      date: fmt(start)              },
  { title: 'Wrap',                     type: MILESTONE_TYPE.WRAP,           date: fmt(addDays(end,    1)) },
]

const MILESTONE_DEFS = {
  [PRODUCTION_TYPE.TVC_AOTO]: (start, end) => [
    { title: 'Client Brief Confirmed',   type: MILESTONE_TYPE.CLIENT,         date: fmt(subDays(start, 14)) },
    { title: 'Tech Recce Complete',      type: MILESTONE_TYPE.TECHNICAL,      date: fmt(subDays(start,  7)) },
    { title: 'Pre-Production Lock',      type: MILESTONE_TYPE.PRE_PRODUCTION, date: fmt(subDays(start,  3)) },
    { title: 'Shoot Day',                type: MILESTONE_TYPE.SHOOT_DAY,      date: fmt(start)              },
    { title: 'Wrap & Handoff',           type: MILESTONE_TYPE.WRAP,           date: fmt(addDays(end,    1)) },
  ],
  [PRODUCTION_TYPE.MOBILE_CAR_PROCESS]: (start, end) => [
    { title: 'Venue Confirmed',          type: MILESTONE_TYPE.LOGISTICS,      date: fmt(subDays(start, 14)) },
    { title: 'Equipment Dispatch',       type: MILESTONE_TYPE.LOGISTICS,      date: fmt(subDays(start,  2)) },
    { title: 'Shoot Day',                type: MILESTONE_TYPE.SHOOT_DAY,      date: fmt(start)              },
    { title: 'Derig & Wrap',             type: MILESTONE_TYPE.WRAP,           date: fmt(addDays(end,    1)) },
  ],
}

export function generateRoadmapMilestones(productionType, startDate, endDate, createdBy) {
  if (!startDate) return []
  const start = new Date(startDate)
  const end   = endDate ? new Date(endDate) : addDays(start, 1)
  const defs  = (MILESTONE_DEFS[productionType] || FALLBACK_MILESTONES)(start, end)
  return defs.map(def => createMilestone({
    ...def,
    status:    MILESTONE_STATUS.UPCOMING,
    createdBy: createdBy || '',
  }))
}

// ─── Seeding engine ───────────────────────────────────────────────────────────
// Converts a completed draft into a production + tasks + milestones.
// Returns { production, tasks, milestones } — caller is responsible for persisting.
export function buildProductionFromDraft(draft, currentUser) {
  const { extracted, answers, edits, contacts, concerns, inputs } = draft
  const resolve = field => resolveField(field, extracted, answers, edits)

  // Free-form '' when no type resolved (PRODUCTION_TYPE.OTHER never existed —
  // the old fallback silently produced `undefined`).
  const productionType = resolve('productionType').value || ''
  // ledWallId is empty string for "None / Other" (no wall booked).
  // Normalise to null so the production record has a clean nullable FK.
  const ledWallId      = resolve('ledWallId').value || null
  // Preset types imply the location (TVC AOTO lives in-house, CAR process is
  // mobile) — an explicit answer/edit still wins.
  const locationType   = resolve('locationType').value
    || TYPE_LOCATION_MAP[productionType]
    || LOCATION_TYPE.IN_HOUSE
  const startDate      = resolve('startDate').value      || ''
  const endDate        = resolve('endDate').value        || ''
  const locationName   = resolve('locationName').value   || ''
  const productionId   = crypto.randomUUID()
  const createdBy      = currentUser?.id || ''

  // Bible — key players from accepted contacts
  const keyPlayers = (contacts || [])
    .filter(c => draft.contactEdits?.[c.id]?.included !== false)
    .map(c => ({
      id:      crypto.randomUUID(),
      name:    draft.contactEdits?.[c.id]?.name  || c.name     || '',
      role:    draft.contactEdits?.[c.id]?.role  || c.roleGuess || '',
      company: c.company || resolve('client').value || '',
      phone:   c.phone   || '',
      email:   c.email   || '',
      notes:   '',
      tag:     'client',
    }))

  // Bible — documents from uploaded images. Carry the actual image data and
  // real MIME type through so the bible's preview/open + AI-scan work (they
  // were stored with url:'' and a fake 'image' type before — unopenable).
  const documents = (inputs || [])
    .filter(i => i.type === 'image')
    .map(i => ({
      id:           crypto.randomUUID(),
      name:         i.fileName || 'Uploaded document',
      dateReceived: new Date().toISOString().split('T')[0],
      fileType:     i.fileType || 'image/png',
      fileName:     i.fileName || null,
      url:          i.preview || '',
      notes:        'Uploaded during intake',
    }))

  // Bible — concerns (only those opted-in, max 3)
  const bibleConcerns = (concerns || [])
    .filter(c => draft.concernEdits?.[c.id]?.included === true)
    .slice(0, 3)
    .map(c => ({
      id:             crypto.randomUUID(),
      title:          c.title,
      description:    c.description || '',
      severity:       'Medium',
      status:         'Open',
      resolutionNote: '',
      createdAt:      new Date().toISOString(),
    }))

  // Crew auto-assignment from detected mentions. Each user pre-included
  // unless the user explicitly toggled them off in the Review step.
  const assignedMembers = (draft.detectedCrew || [])
    .filter(c => draft.crewEdits?.[c.userId]?.included !== false)
    .map(c => ({
      userId:           c.userId,
      roleOnProduction: '',
      roles:            { prep: '', production: '', post: '' },
    }))

  const production = createProduction({
    id:              productionId,
    name:            resolve('title').value   || 'Untitled Production',
    client:          resolve('client').value  || '',
    productionType,
    ledWallId,
    locationType,
    locationAddress: locationName,
    startDate,
    endDate,
    status:          PRODUCTION_STATUS.INCOMING,
    assignedMembers,
    createdBy,
    bible: {
      keyPlayers,
      documents,
      concerns:        bibleConcerns,
      frictionAndFlow: [],
    },
  })

  // Starter tasks are opt-out on the Review step — respect the toggles.
  const tasks = generateStarterTasks(productionType, productionId, createdBy)
    .filter(t => draft.taskEdits?.[t.title]?.included !== false)
  const milestones = generateRoadmapMilestones(productionType, startDate, endDate, createdBy)

  return { production, tasks, milestones }
}
