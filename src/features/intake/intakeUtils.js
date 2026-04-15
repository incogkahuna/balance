import {
  createProduction, createTask, createMilestone,
  PRODUCTION_TYPE, PRODUCTION_STATUS, LOCATION_TYPE,
  TASK_PRIORITY, TASK_STATUS,
  MILESTONE_TYPE, MILESTONE_STATUS,
} from '../../data/models.js'
import { addDays, subDays, format, isValid } from 'date-fns'

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
    candidates.productionType = { value: PRODUCTION_TYPE.LED_VOLUME,   confidence: 'medium', source: sourceId }
    candidates.locationType   = { value: LOCATION_TYPE.IN_HOUSE,       confidence: 'medium', source: sourceId }
  } else if (isMobile) {
    candidates.productionType = { value: PRODUCTION_TYPE.MOBILE_BUILD, confidence: 'medium', source: sourceId }
    candidates.locationType   = { value: LOCATION_TYPE.MOBILE,         confidence: 'medium', source: sourceId }
  }

  // ── Dates ──
  // Try context-aware NL patterns first (start/end), fall back to bare date scan
  const startMatches = [...(text.matchAll(NL_STARTDATE_RE))].map(m => m[1])
  const endMatches   = [...(text.matchAll(NL_ENDDATE_RE))].map(m => m[1])

  if (startMatches.length > 0) {
    const s = tryParseDate(startMatches[0])
    if (s) candidates.startDate = { value: s, confidence: 'high', source: sourceId }
  }
  if (endMatches.length > 0) {
    const e = tryParseDate(endMatches[0])
    if (e) candidates.endDate = { value: e, confidence: 'high', source: sourceId }
  }

  // Fall back to bare date scan if NL patterns didn't find anything
  if (!candidates.startDate || !candidates.endDate) {
    const allDates = extractAllDates(text)
    if (!candidates.startDate && allDates.length >= 1) {
      const s = tryParseDate(allDates[0])
      if (s) candidates.startDate = { value: s, confidence: 'medium', source: sourceId }
    }
    if (!candidates.endDate && allDates.length >= 2) {
      const e = tryParseDate(allDates[1])
      if (e) candidates.endDate = { value: e, confidence: 'medium', source: sourceId }
    }
  }

  // ── Contacts: scan for emails with associated names ──
  for (const line of text.split('\n')) {
    const lineEmails = [...(line.matchAll(EMAIL_RE))].map(m => m[0])
    if (!lineEmails.length) continue
    const email = lineEmails[0]
    // Try "First Last <email>" or "First Last (email)" or line starting with a name
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

  // Also catch "contact is [Name]" / "contact: [Name]" natural language
  const contactNLRe = /(?:contact(?:\s+is)?|reach out to|speak to|talk to)\s+([A-Z][a-z]+ [A-Z][a-z]+)/gi
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
  text.split('\n')
    .filter(line => CONCERN_KEYWORDS.some(k => line.toLowerCase().includes(k)) && line.trim().length > 12)
    .slice(0, 3)
    .forEach(line => concerns.push({
      id:          crypto.randomUUID(),
      title:       line.trim().slice(0, 90),
      description: '',
      confidence:  'low',
      include:     false,
      source:      sourceId,
    }))

  return { candidates, contacts, concerns }
}

// ─── Full input set parser ────────────────────────────────────────────────────
const CONF_RANK = { high: 3, medium: 2, low: 1 }

export function mockParseInputs(inputs) {
  const extracted      = {}
  const allContacts    = []
  const allConcerns    = []
  const parsingSummary = []

  inputs.forEach((input, i) => {
    const label = input.fileName || `Input ${i + 1}`

    if (input.type === 'text' && input.content?.trim()) {
      const { candidates, contacts, concerns } = parseTextContent(input.content, input.id)

      // Merge candidates — higher confidence wins
      Object.entries(candidates).forEach(([field, candidate]) => {
        const existing = extracted[field]
        if (!existing || CONF_RANK[candidate.confidence] > CONF_RANK[existing.confidence]) {
          extracted[field] = { ...candidate, sourceName: label }
        }
      })

      allContacts.push(...contacts.map(c => ({ ...c, sourceName: label })))
      allConcerns.push(...concerns.map(c => ({ ...c, sourceName: label })))

      const found = Object.keys(candidates)
      if (found.length)    parsingSummary.push(`Extracted ${found.join(', ')} from ${label}`)
      if (contacts.length) parsingSummary.push(`Found ${contacts.length} contact${contacts.length > 1 ? 's' : ''} in ${label}`)
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

  return { extracted, contacts, concerns: allConcerns.slice(0, 5), parsingSummary }
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
      { label: 'LED Volume',    value: PRODUCTION_TYPE.LED_VOLUME   },
      { label: 'Mobile Build',  value: PRODUCTION_TYPE.MOBILE_BUILD },
      { label: 'Other',         value: PRODUCTION_TYPE.OTHER        },
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
const TASK_DEFS = {
  [PRODUCTION_TYPE.LED_VOLUME]: [
    { title: 'Confirm client brief and shot list',              priority: TASK_PRIORITY.HIGH   },
    { title: 'Schedule technical recce',                        priority: TASK_PRIORITY.HIGH   },
    { title: 'Confirm LED wall configuration and pixel mapping',priority: TASK_PRIORITY.MEDIUM },
    { title: 'Brief camera team on volume workflow',            priority: TASK_PRIORITY.MEDIUM },
    { title: 'Test lighting rig and background content',        priority: TASK_PRIORITY.MEDIUM },
    { title: 'Confirm post-production pipeline with client',    priority: TASK_PRIORITY.LOW    },
  ],
  [PRODUCTION_TYPE.MOBILE_BUILD]: [
    { title: 'Confirm venue access times and loading plan',     priority: TASK_PRIORITY.HIGH   },
    { title: 'Arrange transport and logistics for equipment',   priority: TASK_PRIORITY.HIGH   },
    { title: 'Coordinate power requirements with venue',        priority: TASK_PRIORITY.MEDIUM },
    { title: 'Confirm local crew availability',                 priority: TASK_PRIORITY.MEDIUM },
    { title: 'Pre-shoot pack and inventory check',              priority: TASK_PRIORITY.MEDIUM },
    { title: 'Arrange derig transport and return schedule',     priority: TASK_PRIORITY.LOW    },
  ],
  [PRODUCTION_TYPE.OTHER]: [
    { title: 'Confirm production brief with client',            priority: TASK_PRIORITY.HIGH   },
    { title: 'Finalise crew and equipment list',                priority: TASK_PRIORITY.HIGH   },
    { title: 'Confirm location and access arrangements',        priority: TASK_PRIORITY.MEDIUM },
    { title: 'Schedule pre-production walkthrough',             priority: TASK_PRIORITY.MEDIUM },
    { title: 'Set up communication channels with client',       priority: TASK_PRIORITY.LOW    },
  ],
}

export function generateStarterTasks(productionType, productionId, createdBy) {
  const defs = TASK_DEFS[productionType] || TASK_DEFS[PRODUCTION_TYPE.OTHER]
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

const MILESTONE_DEFS = {
  [PRODUCTION_TYPE.LED_VOLUME]: (start, end) => [
    { title: 'Client Brief Confirmed',   type: MILESTONE_TYPE.CLIENT,         date: fmt(subDays(start, 14)) },
    { title: 'Tech Recce Complete',      type: MILESTONE_TYPE.TECHNICAL,      date: fmt(subDays(start,  7)) },
    { title: 'Pre-Production Lock',      type: MILESTONE_TYPE.PRE_PRODUCTION, date: fmt(subDays(start,  3)) },
    { title: 'Shoot Day',                type: MILESTONE_TYPE.SHOOT_DAY,      date: fmt(start)              },
    { title: 'Wrap & Handoff',           type: MILESTONE_TYPE.WRAP,           date: fmt(addDays(end,    1)) },
  ],
  [PRODUCTION_TYPE.MOBILE_BUILD]: (start, end) => [
    { title: 'Venue Confirmed',          type: MILESTONE_TYPE.LOGISTICS,      date: fmt(subDays(start, 14)) },
    { title: 'Equipment Dispatch',       type: MILESTONE_TYPE.LOGISTICS,      date: fmt(subDays(start,  2)) },
    { title: 'Shoot Day',                type: MILESTONE_TYPE.SHOOT_DAY,      date: fmt(start)              },
    { title: 'Derig & Wrap',             type: MILESTONE_TYPE.WRAP,           date: fmt(addDays(end,    1)) },
  ],
  [PRODUCTION_TYPE.OTHER]: (start, end) => [
    { title: 'Pre-Production Complete',  type: MILESTONE_TYPE.PRE_PRODUCTION, date: fmt(subDays(start,  7)) },
    { title: 'Shoot Day',                type: MILESTONE_TYPE.SHOOT_DAY,      date: fmt(start)              },
    { title: 'Wrap',                     type: MILESTONE_TYPE.WRAP,           date: fmt(addDays(end,    1)) },
  ],
}

export function generateRoadmapMilestones(productionType, startDate, endDate, createdBy) {
  if (!startDate) return []
  const start = new Date(startDate)
  const end   = endDate ? new Date(endDate) : addDays(start, 1)
  const defs  = (MILESTONE_DEFS[productionType] || MILESTONE_DEFS[PRODUCTION_TYPE.OTHER])(start, end)
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

  const productionType = resolve('productionType').value || PRODUCTION_TYPE.OTHER
  const locationType   = resolve('locationType').value   || LOCATION_TYPE.IN_HOUSE
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

  // Bible — documents from uploaded images
  const documents = (inputs || [])
    .filter(i => i.type === 'image')
    .map(i => ({
      id:           crypto.randomUUID(),
      name:         i.fileName || 'Uploaded document',
      dateReceived: new Date().toISOString().split('T')[0],
      fileType:     'image',
      url:          '',
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

  const production = createProduction({
    id:              productionId,
    name:            resolve('title').value   || 'Untitled Production',
    client:          resolve('client').value  || '',
    productionType,
    locationType,
    locationAddress: locationName,
    startDate,
    endDate,
    status:          PRODUCTION_STATUS.INCOMING,
    createdBy,
    bible: {
      keyPlayers,
      documents,
      concerns:        bibleConcerns,
      frictionAndFlow: [],
    },
  })

  const tasks      = generateStarterTasks(productionType, productionId, createdBy)
  const milestones = generateRoadmapMilestones(productionType, startDate, endDate, createdBy)

  return { production, tasks, milestones }
}
