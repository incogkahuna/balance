// ─── Data Models ────────────────────────────────────────────────────────────
// These define the shape of every entity in Balance.
// Swap localStorage for a real API by updating the persistence layer only.

export const ROLES = {
  ADMIN: 'admin',
  SUPERVISOR: 'supervisor',
  CREW: 'crew',
}

export const PRODUCTION_STATUS = {
  INCOMING: 'Incoming',
  ACTIVE: 'Active',
  WRAP: 'Wrap',
  COMPLETED: 'Completed',
}

export const PRODUCTION_TYPE = {
  TVC_AOTO:           'TVC AOTO',
  MOBILE_CAR_PROCESS: 'Mobile CAR process CLI',
}

// ─── Project kinds (M4 / #5) ─────────────────────────────────────────────────
// One record shape, three creation paths. Tours and internal projects skip
// production-only fields (type / location / LED wall). Prelights and wraps
// are milestone TYPES on a parent production, not kinds (decided in M0).
export const PROJECT_KIND = {
  PRODUCTION: 'production',
  TOUR:       'tour',
  INTERNAL:   'internal',
}

export const PROJECT_KIND_LABEL = {
  [PROJECT_KIND.PRODUCTION]: 'Production',
  [PROJECT_KIND.TOUR]:       'Tour',
  [PROJECT_KIND.INTERNAL]:   'Internal',
}

// Ordered list for UI dropdowns. "Custom" is handled as a free-form entry
// option in the form — not stored here.
export const PRODUCTION_TYPE_PRESETS = Object.values(PRODUCTION_TYPE)

export const LOCATION_TYPE = {
  IN_HOUSE: 'In-House (Orbital Studios)',
  MOBILE: 'Mobile',
}

// Preset production types imply a location — TVC AOTO is the permanent
// in-house volume, CAR process is by definition mobile. Used to auto-fill
// locationType and skip redundant questions. Free-form types map to nothing.
export const TYPE_LOCATION_MAP = {
  [PRODUCTION_TYPE.TVC_AOTO]:           LOCATION_TYPE.IN_HOUSE,
  [PRODUCTION_TYPE.MOBILE_CAR_PROCESS]: LOCATION_TYPE.MOBILE,
}

// ─── Date-driven status ───────────────────────────────────────────────────────
// Statuses ranked so auto-transitions only ever move FORWARD — a manually
// advanced status is never demoted by the calendar.
export const PRODUCTION_STATUS_RANK = {
  [PRODUCTION_STATUS.INCOMING]:  0,
  [PRODUCTION_STATUS.ACTIVE]:    1,
  [PRODUCTION_STATUS.WRAP]:      2,
  [PRODUCTION_STATUS.COMPLETED]: 3,
}

/**
 * What the calendar says this production's status should be:
 *   before start        → Incoming
 *   start … end (incl.) → Active
 *   past end            → Wrap
 *   >30 days past end   → Completed
 * Returns null when there's no usable start date. Date-only string
 * comparison (YYYY-MM-DD) keeps this timezone-proof.
 */
export function computeDateDrivenStatus(production, todayStr = new Date().toISOString().slice(0, 10)) {
  const start = (production.startDate || '').slice(0, 10)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(start)) return null
  const end = ((production.endDate || '').slice(0, 10).match(/^\d{4}-\d{2}-\d{2}$/))
    ? production.endDate.slice(0, 10)
    : start

  // 30-day grace window after the end date before auto-completing.
  const cutoff = new Date(end + 'T00:00:00Z')
  cutoff.setUTCDate(cutoff.getUTCDate() + 30)
  const cutoffStr = cutoff.toISOString().slice(0, 10)

  if (todayStr > cutoffStr) return PRODUCTION_STATUS.COMPLETED
  if (todayStr > end)       return PRODUCTION_STATUS.WRAP
  if (todayStr >= start)    return PRODUCTION_STATUS.ACTIVE
  return PRODUCTION_STATUS.INCOMING
}

export const TASK_PRIORITY = {
  LOW: 'Low',
  MEDIUM: 'Medium',
  HIGH: 'High',
  CRITICAL: 'Critical',
}

export const TASK_STATUS = {
  NOT_STARTED:  'Not Started',
  IN_PROGRESS:  'In Progress',
  NEEDS_REVIEW: 'Needs Review',
  COMPLETE:     'Complete',
  VERIFIED:     'Verified',
  BLOCKED:      'Blocked',
}

// ─── Roadmap ──────────────────────────────────────────────────────────────────
export const MILESTONE_TYPE = {
  PRE_PRODUCTION: 'Pre-Production',
  PRELIGHT:       'Prelight',
  LOGISTICS:      'Logistics',
  SHOOT_DAY:      'Shoot Day',
  TECHNICAL:      'Technical',
  CLIENT:         'Client',
  FINANCIAL:      'Financial',
  WRAP:           'Wrap',
}

export const MILESTONE_STATUS = {
  UPCOMING:    'Upcoming',
  IN_PROGRESS: 'In Progress',
  COMPLETE:    'Complete',
  AT_RISK:     'At Risk',
}

// Importance / priority on a milestone. Used to highlight top-priority items
// in lists. Defaults to Medium on createMilestone since most milestones are
// just "normal" work items.
export const MILESTONE_PRIORITY = {
  TOP:    'Top Priority',
  MEDIUM: 'Medium',
  LOW:    'Low',
}

export const CONCERN_CATEGORY = {
  TRANSPORT: 'Transport & Shipping',
  POWER:     'Power & Infrastructure',
  VENUE:     'Venue & Space',
  EQUIPMENT: 'Equipment',
  CREW:      'Crew & Scheduling',
  TECHNICAL: 'Technical',
  CLIENT:    'Client Requirements',
  PERMITS:   'Permits & Compliance',
  WEATHER:   'Weather & Environment',
  OTHER:     'Other',
}

export const CONCERN_IMPACT = {
  LOW:      'Low',
  MEDIUM:   'Medium',
  HIGH:     'High',
  CRITICAL: 'Critical',
}

export const CONCERN_STATUS = {
  OPEN:        'Open',
  IN_PROGRESS: 'In Progress',
  RESOLVED:    'Resolved',
  ACCEPTED:    'Accepted Risk',
}

export const AVAILABILITY_STATUS = {
  AVAILABLE:   'Available',
  BUSY:        'Busy',
  UNAVAILABLE: 'Unavailable',
}

export const EXPERIENCE_LEVEL = {
  JUNIOR: 'Junior',
  MID:    'Mid',
  SENIOR: 'Senior',
  LEAD:   'Lead',
}

export const CONTRACTOR_FLAG = {
  RECOMMENDED:    'Recommended',
  NEUTRAL:        'Neutral',
  DO_NOT_REHIRE:  'Do Not Rehire',
}

// ─── User Profiles ───────────────────────────────────────────────────────────
// Preset role options for assigned team members, per production phase.
// "Other" surfaces a custom-text input in the form; the saved value is
// whatever the user types. Unknown values (legacy or custom) are treated
// as Other on read and editable as free text.
export const PRODUCTION_ROLE_PRESETS = [
  'Project Lead',
  'Project Supervisor',
  'Technician Support',
]

// Normalize a legacy or new-shape assigned-member record into the canonical
// shape: { userId, roles: { prep, production, post } }. Falls back to the
// old `roleOnProduction` field as the production-phase role.
export function normalizeAssignedMember(m) {
  if (!m) return null
  const roles = m.roles || {
    prep:       '',
    production: m.roleOnProduction || '',
    post:       '',
  }
  return {
    userId: m.userId,
    roleOnProduction: roles.production,   // mirror for legacy display sites
    roles: {
      prep:       roles.prep || '',
      production: roles.production || '',
      post:       roles.post || '',
    },
  }
}

// `email` is the stable identity anchor — when a Google sign-in's
// profile.email matches, AppContext maps the live profile to this legacy
// id so demo tasks (which use 'mark'/'aj'/'danny'/etc. as assigneeId)
// surface correctly on the signed-in user's dashboard.
export const USERS = [
  { id: 'mark',   name: 'Mark',   email: 'mark@orbitalvs.com',       role: ROLES.ADMIN,      avatar: 'M',  color: '#6366f1' },
  { id: 'aj',     name: 'AJ',     email: 'aj@orbitalvs.com',         role: ROLES.ADMIN,      avatar: 'A',  color: '#8b5cf6' },
  { id: 'danny',  name: 'Danny',  email: 'dhorgan@orbitalvs.com',    role: ROLES.ADMIN,      avatar: 'D',  color: '#3b82f6' },
  { id: 'brian',  name: 'Brian',  email: 'brodriguez@orbitalvs.com', role: ROLES.CREW,       avatar: 'B',  color: '#10b981' },
  { id: 'wilder', name: 'Wilder', email: 'wilder@orbitalvs.com',     role: ROLES.ADMIN,      avatar: 'W',  color: '#f59e0b' },
  { id: 'mike',   name: 'Mike',   email: 'mike@orbitalvs.com',       role: ROLES.CREW,       avatar: 'MS', color: '#06b6d4' },
  { id: 'geo',    name: 'Geo',    email: 'geo@orbitalvs.com',        role: ROLES.CREW,       avatar: 'G',  color: '#ec4899' },
  { id: 'nitz',   name: 'Brian Nitzkin', email: 'brian@orbitalvs.com', role: ROLES.CREW,    avatar: 'BN', color: '#14b8a6' },
]

// ─── Roster merge (dedup real profiles vs the legacy hardcoded list) ─────────
// The app predates real auth and shipped with the hardcoded USERS roster above.
// Now that people sign in, both a legacy entry ("Danny") and a real profile
// ("Danny Horgan") can describe the same person — that's the duplicate Danny
// flagged. buildRoster merges them: real profiles win (their UUID is the
// assignable id), and a legacy USERS entry survives ONLY if no profile
// represents that person. A person is "already represented" when a profile
// matches by email, by exact full name, or by an unambiguous single-token
// first name (so legacy "Wilder" folds into "Wilder Herms", while the two
// different Brians — Rodriguez and Nitzkin — never collapse into each other).
export function buildRoster(profiles = []) {
  const norm = s => (s || '').trim().toLowerCase()
  const firstToken = s => norm(s).split(/\s+/)[0]

  // Legacy first-token frequencies — a first name shared by two legacy people
  // (Brian, Brian Nitzkin) is ambiguous and never eligible for first-name folds.
  const legacyFirstTokenCounts = {}
  for (const u of USERS) {
    const ft = firstToken(u.name)
    legacyFirstTokenCounts[ft] = (legacyFirstTokenCounts[ft] || 0) + 1
  }

  const roster = []
  const emails = new Set()
  const fullNames = new Set()
  const profileFirstTokenCounts = {}

  for (const p of profiles) {
    roster.push({
      id:      p.id,
      name:    p.name,
      email:   p.email || '',
      role:    p.role,
      avatar:  (p.name || '?').charAt(0).toUpperCase(),
      color:   p.color || '#6b7280',
      isProfile: true,
    })
    if (p.email) emails.add(norm(p.email))
    fullNames.add(norm(p.name))
    const ft = firstToken(p.name)
    profileFirstTokenCounts[ft] = (profileFirstTokenCounts[ft] || 0) + 1
  }

  for (const u of USERS) {
    const ft = firstToken(u.name)
    const singleToken = norm(u.name).split(/\s+/).length === 1
    const emailHit    = u.email && emails.has(norm(u.email))
    const fullNameHit = fullNames.has(norm(u.name))
    const firstNameHit = singleToken
      && profileFirstTokenCounts[ft] === 1
      && legacyFirstTokenCounts[ft] === 1
    if (emailHit || fullNameHit || firstNameHit) continue
    roster.push({ ...u, isProfile: false })
  }

  return roster
}

// ─── Factory functions ────────────────────────────────────────────────────────
export function createProduction(overrides = {}) {
  return {
    id: crypto.randomUUID(),
    name: '',
    client: '',
    kind: PROJECT_KIND.PRODUCTION,
    locationType: LOCATION_TYPE.IN_HOUSE,
    locationAddress: '',
    productionType: PRODUCTION_TYPE.TVC_AOTO,
    status: PRODUCTION_STATUS.INCOMING,
    startDate: '',
    endDate: '',
    // Optional working-window list: [{ start, end }] in YYYY-MM-DD. For
    // projects that span weeks but only run on certain days. Empty = single
    // window, use startDate/endDate directly.
    dateRanges: [],
    stageManagerId: null,      // contractorId of stage manager (first-class field)
    // Foreign key into ledWalls (localStorage entity). When set, the form
    // auto-syncs a wall assignment so picking a wall here actually reserves
    // it in the gear database. productionType still mirrors the wall's
    // name for backwards-compat display sites that read the type string.
    ledWallId: null,
    assignedMembers: [],       // [{ userId, roleOnProduction }] — Orbital staff
    assignedContractors: [],   // [{ contractorId, role, assignedAt, assignedBy }]
    tasks: [],                 // task IDs
    addons: [],            // addon records
    debriefNotes: [],      // quick notes captured during production (M4 / #6)
    feedback: null,        // feedback record
    instructionPackage: {
      files: [],           // [{ id, name, type, url, uploadedBy, uploadedAt }]
      voiceMemos: [],      // [{ id, name, url, transcript, recordedBy, recordedAt }]
      notes: '',
    },
    // Production Bible — Admin/Supervisor only structured reference document.
    // Nested under production so it moves with the record. Each sub-array
    // follows { id, ...fields } so individual items can be updated by ID.
    bible: {
      keyPlayers:     [],  // [{ id, name, role, company, phone, email, notes, tag }]
      documents:      [],  // [{ id, name, dateReceived, fileType, url, notes }]
      concerns:       [],  // [{ id, title, description, severity, status, resolutionNote, createdAt }]
      frictionAndFlow: [], // [{ id, personName, personRole, company, factorType, notes }]
    },
    // Roadmap — milestones + logistical concerns
    roadmap: {
      milestones:          [],
      logisticalConcerns:  [],
    },
    // false = draft (admin/sup only). New productions default to draft so
    // the creator can iron out details before crew sees them. They can flip
    // to true via the Publish action on the production detail page.
    // Existing DB rows default to true at the schema level for backfill.
    published: false,
    createdBy: '',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  }
}

export function createMilestone(overrides = {}) {
  return {
    id: crypto.randomUUID(),
    title: '',
    date: '',                           // datetime-local string e.g. "2024-06-12T09:00"
    type: MILESTONE_TYPE.PRE_PRODUCTION,
    priority: MILESTONE_PRIORITY.MEDIUM,
    description: '',
    ownerId: '',                        // userId or contractorId (primary owner)
    participantIds: [],                 // additional people involved (each also gets a task)
    status: MILESTONE_STATUS.UPCOMING,
    dependencies: [],                   // array of milestone IDs
    createdAt: new Date().toISOString(),
    createdBy: '',
    updatedAt: new Date().toISOString(),
    ...overrides,
  }
}

export function createLogisticalConcern(overrides = {}) {
  return {
    id: crypto.randomUUID(),
    title: '',
    category: CONCERN_CATEGORY.OTHER,
    description: '',
    impactLevel: CONCERN_IMPACT.MEDIUM,
    actionRequired: '',
    ownerId: '',
    dueDate: '',
    status: CONCERN_STATUS.OPEN,
    resolutionNotes: '',
    createdAt: new Date().toISOString(),
    createdBy: '',
    updatedAt: new Date().toISOString(),
    ...overrides,
  }
}

// Freestanding tasks (productionId null/'' — the merged To-Dos, M2) carry a
// visibility: team = whole roster sees it, personal = creator + assignee only.
export const TASK_VISIBILITY = {
  TEAM:     'team',
  PERSONAL: 'personal',
}

export function createTask(overrides = {}) {
  return {
    id: crypto.randomUUID(),
    productionId: '',
    title: '',
    description: '',
    assigneeId: '',
    assignedBy: '',
    dueDate: '',
    visibility: TASK_VISIBILITY.TEAM,
    completedAt: null,
    priority: TASK_PRIORITY.MEDIUM,
    // ── Status workflow ───────────────────────────────────────────────────────
    status: TASK_STATUS.NOT_STARTED,
    // statusHistory: [{ from, to, by, byName, at, note }]
    statusHistory: [],
    // blockedReason is required when status === BLOCKED (system or manual)
    blockedReason: '',
    // ── Content fields ────────────────────────────────────────────────────────
    expectationsNote: '',
    completionNote: '',
    // url is base64 in v1 — swap for Supabase storage URL in v2
    completionPhotos: [],
    // comments: [{ id, text, photoUrl, authorId, authorName, createdAt }]
    comments: [],
    instructionPackage: {
      files: [],
      voiceMemos: [],
      notes: '',
    },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  }
}

// Selectable add-on items (M4 / #6). Names only — day rates vary per client
// deal, so the form asks for the rate and computes cost = rate × days × qty.
export const ADDON_PRESETS = [
  'Camera Tracking',
  'Additional LED Panels',
  'Extra Brain Bar Operator',
  'Motion Capture',
  'DMX Lighting Integration',
  'Playback Server',
  'Green Screen Package',
  'Additional Crew Day',
]

export function createAddon(overrides = {}) {
  return {
    id: crypto.randomUUID(),
    productionId: '',
    equipment: '',
    quantity: 1,
    duration: '',
    dayRate: '',   // per-day rate; cost auto-computes from rate × days × qty
    days: '',      // days used
    cost: '',      // total — auto-computed, editable override
    damaged: false,
    damagePhotos: [],
    notes: '',
    loggedBy: '',
    loggedAt: new Date().toISOString(),
    ...overrides,
  }
}

// One quick debrief note captured during a production (M4 / #6).
export function createDebriefNote(overrides = {}) {
  return {
    id: crypto.randomUUID(),
    text: '',
    authorId: '',
    authorName: '',
    at: new Date().toISOString(),
    ...overrides,
  }
}

export function createFeedback(overrides = {}) {
  return {
    id: crypto.randomUUID(),
    productionId: '',
    expectations: '',
    whatHappened: '',
    issues: '',
    extraCharges: '',
    rating: null,       // 1-5
    voiceMemo: null,
    submittedBy: '',
    submittedAt: new Date().toISOString(),
    ...overrides,
  }
}

// ─── To-Dos (LEGACY — merged into tasks in M2) ──────────────────────────────
// Kept only so the one-time localStorage → Supabase import in AppContext can
// read old records. New to-dos are tasks with productionId null. Delete this
// section once every browser has imported.

export const TODO_STATUS = {
  OPEN:      'open',
  DONE:      'done',
  CANCELLED: 'cancelled',
}

export const TODO_VISIBILITY = {
  SHARED: 'shared',   // visible to the whole salary roster
  DIRECT: 'direct',   // visible only to creator + assignee
}

export function createToDo(overrides = {}) {
  return {
    id: crypto.randomUUID(),
    title: '',
    description: '',
    // dueDate is YYYY-MM-DD; defaults to today in the form, but the factory
    // leaves it blank so we don't accidentally stamp a date when callers
    // want an undated entry.
    dueDate: '',
    assigneeId: '',         // single assignee (legacy USERS id or UUID)
    createdBy: '',
    visibility: TODO_VISIBILITY.SHARED,
    status: TODO_STATUS.OPEN,
    completedAt: '',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  }
}

// ─── LED Walls ────────────────────────────────────────────────────────────────
// Top-level gear-database entity. Scope intentionally narrow for v1: just LED
// walls + their supporting hardware as a single line (no per-panel/per-
// processor tracking). Each wall has an `assignments` array tracking which
// productions it's been on or is going on, with date ranges so conflicts are
// detectable.
//
// localStorage-only for v1 — when this proves out, port to a Supabase table
// with RLS, realtime, and a proper assignments join table.

export const LED_WALL_STATUS = {
  IN_SERVICE:     'In Service',
  IN_MAINTENANCE: 'In Maintenance',
  RETIRED:        'Retired',
}

export function createLedWall(overrides = {}) {
  return {
    id: crypto.randomUUID(),
    name: '',
    description: '',                // freeform spec — pixel pitch, dimensions, panel make, processor
    photo: '',                      // compressed JPEG data URL — shown on the gear card
    status: LED_WALL_STATUS.IN_SERVICE,
    notes: '',
    // [{ id, productionId, startDate, endDate, notes, createdAt, createdBy }]
    // No "this wall has multiple panels and each is bookable separately" —
    // the wall as a whole is the bookable unit. Two assignments overlapping
    // in date is a conflict; surfaced in the UI.
    assignments: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  }
}

export function createWallAssignment(overrides = {}) {
  return {
    id: crypto.randomUUID(),
    productionId: '',
    startDate: '',                  // YYYY-MM-DD
    endDate:   '',                  // YYYY-MM-DD
    notes: '',
    createdAt: new Date().toISOString(),
    createdBy: '',
    ...overrides,
  }
}

// Seed inventory — three real-ish Orbital walls so the page is populated on
// first load. Replace with real spec once Danny audits.
// ─── Feedback (Bugs & Ideas) ──────────────────────────────────────────────────
// User-submitted reports — bugs to fix and feature requests. localStorage
// backed for v1 like LED walls; port to Supabase when the shape's proved.
// Separate from production-level "feedback" (the debrief that lives on each
// Production record); this is studio-app-level feedback about the tool.

export const FEEDBACK_KIND = {
  NOTE: 'note',
  IDEA: 'idea',
  BUG:  'bug',
}

export const FEEDBACK_KIND_LABEL = {
  [FEEDBACK_KIND.NOTE]: 'Note',
  [FEEDBACK_KIND.IDEA]: 'Feature',
  [FEEDBACK_KIND.BUG]:  'Bug',
}

export const FEEDBACK_STATUS = {
  NEW:         'New',
  ACKNOWLEDGED:'Acknowledged',
  IN_PROGRESS: 'In Progress',
  SHIPPED:     'Shipped',
  WONT_FIX:    "Won't Fix",
}

export function createFeedbackItem(overrides = {}) {
  return {
    id: crypto.randomUUID(),
    kind: FEEDBACK_KIND.IDEA,
    title: '',
    description: '',
    context: '',             // optional "where / expected" line (e.g. "Team tab, inside a production")
    screenshot: '',          // optional compressed JPEG data URL
    status: FEEDBACK_STATUS.NEW,
    submittedBy: '',         // currentUser.id
    submittedByName: '',     // snapshot at submit time (legacy users can't be looked up later)
    submittedAt: new Date().toISOString(),
    resolutionNote: '',      // admin-set when status moves to Shipped / Won't Fix
    ...overrides,
  }
}

export const LED_WALLS_SEED = [
  createLedWall({
    id: 'wall-main-volume',
    name: 'Main Volume Stage A',
    description: 'Curved ROE Black Pearl 2.8mm · 30m × 5m · Brompton Tessera SX40 processor',
    notes: 'Permanently installed on the main stage. Not mobile.',
  }),
  createLedWall({
    id: 'wall-mobile-1',
    name: 'Mobile Wall 1',
    description: 'Modular ROE BO2 panels · 16×9 config · 4m × 2.25m · Brompton 4K processor',
    notes: 'Standard mobile build kit — fits in one truck.',
  }),
  createLedWall({
    id: 'wall-popup-cyc',
    name: 'Pop-Up Cyc',
    description: 'INFiLED ER2.6 panels · 8m × 3m curved cyc · includes Disguise rx',
    notes: 'For smaller mobile builds and CAR process plates.',
  }),
]

export function createContractor(overrides = {}) {
  return {
    id: crypto.randomUUID(),
    name: '',
    photoUrl: null,           // base64 in v1 — swap for Supabase storage URL in v2
    phone: '',
    email: '',
    location: '',             // "City, State"
    availability: AVAILABILITY_STATUS.AVAILABLE,
    primaryRole: '',
    secondaryRoles: [],
    skills: [],               // freeform string tags
    experienceLevel: EXPERIENCE_LEVEL.MID,
    // Rate fields — only surfaced to ADMIN role in the UI layer
    dayRate: '',
    weeklyRate: '',
    rateNotes: '',
    notes: '',                // Admin + Supervisor visible
    flag: CONTRACTOR_FLAG.NEUTRAL,
    emergencyContact: {       // Admin only
      name: '',
      relationship: '',
      phone: '',
    },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  }
}
