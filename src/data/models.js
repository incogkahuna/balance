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
  LED_VOLUME: 'LED Volume',
  MOBILE_BUILD: 'Mobile Build',
  OTHER: 'Other',
}

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
export const USERS = [
  { id: 'mark',   name: 'Mark',   role: ROLES.ADMIN,      avatar: 'M', color: '#6366f1' },
  { id: 'aj',     name: 'AJ',     role: ROLES.ADMIN,      avatar: 'A', color: '#8b5cf6' },
  { id: 'danny',  name: 'Danny',  role: ROLES.SUPERVISOR, avatar: 'D', color: '#3b82f6' },
  { id: 'brian',  name: 'Brian',  role: ROLES.CREW,       avatar: 'B', color: '#10b981' },
  { id: 'wilder', name: 'Wilder', role: ROLES.CREW,       avatar: 'W', color: '#f59e0b' },
]

// ─── Factory functions ────────────────────────────────────────────────────────
export function createProduction(overrides = {}) {
  return {
    id: crypto.randomUUID(),
    name: '',
    client: '',
    locationType: LOCATION_TYPE.IN_HOUSE,
    locationAddress: '',
    productionType: PRODUCTION_TYPE.LED_VOLUME,
    status: PRODUCTION_STATUS.INCOMING,
    startDate: '',
    endDate: '',
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
    ownerId: '',                        // userId or contractorId
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
