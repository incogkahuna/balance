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
  LITTLE_DIPPER:      'Little Dipper',
}

// Ordered list for UI dropdowns. "Custom" is handled as a free-form entry
// option in the form — not stored here.
export const PRODUCTION_TYPE_PRESETS = Object.values(PRODUCTION_TYPE)

export const LOCATION_TYPE = {
  IN_HOUSE: 'In-House (Orbital Studios)',
  MOBILE: 'Mobile',
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
  { id: 'wilder', name: 'Wilder', email: 'wilder@orbitalvs.com',     role: ROLES.CREW,       avatar: 'W',  color: '#f59e0b' },
  { id: 'mike',   name: 'Mike',   email: 'mike@orbitalvs.com',       role: ROLES.CREW,       avatar: 'MS', color: '#06b6d4' },
  { id: 'geo',    name: 'Geo',    email: 'geo@orbitalvs.com',        role: ROLES.CREW,       avatar: 'G',  color: '#ec4899' },
  { id: 'nitz',   name: 'Brian Nitzkin', email: 'brian@orbitalvs.com', role: ROLES.CREW,    avatar: 'BN', color: '#14b8a6' },
]

// ─── Factory functions ────────────────────────────────────────────────────────
export function createProduction(overrides = {}) {
  return {
    id: crypto.randomUUID(),
    name: '',
    client: '',
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
    assignedMembers: [],       // [{ userId, roleOnProduction }] — Orbital staff
    assignedContractors: [],   // [{ contractorId, role, assignedAt, assignedBy }]
    tasks: [],                 // task IDs
    addons: [],            // addon records
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

export function createTask(overrides = {}) {
  return {
    id: crypto.randomUUID(),
    productionId: '',
    title: '',
    description: '',
    assigneeId: '',
    assignedBy: '',
    dueDate: '',
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

export function createAddon(overrides = {}) {
  return {
    id: crypto.randomUUID(),
    productionId: '',
    equipment: '',
    quantity: 1,
    duration: '',
    cost: '',
    damaged: false,
    damagePhotos: [],
    notes: '',
    loggedBy: '',
    loggedAt: new Date().toISOString(),
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
