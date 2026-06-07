// ─── Self-contained sample data for the Resource Allocation pitch prototypes ──
// Hardcoded — does not touch AppContext. Six-week window, four overlapping
// productions, deliberately seeded with overcommitments to make the visuals tell
// a story.

export const WINDOW_START = new Date(2026, 4, 4)   // Mon May 4 2026
export const WINDOW_END   = new Date(2026, 5, 14)  // Sun Jun 14 2026
export const WINDOW_DAYS  = 42

const d = (y, m, day) => new Date(y, m - 1, day)

export const PRODUCTIONS = [
  {
    id: 'apex',
    name: 'Apex Auto',
    code: 'APX-04',
    color: '#22d3ee',  // cyan
    glow: 'rgba(34,211,238,0.45)',
    start: d(2026, 5, 4),
    end:   d(2026, 5, 17),
    summary: 'Hero spot · LED volume',
  },
  {
    id: 'lunar',
    name: 'Lunar Bloom',
    code: 'LNB-11',
    color: '#e879f9',  // magenta
    glow: 'rgba(232,121,249,0.45)',
    start: d(2026, 5, 11),
    end:   d(2026, 5, 24),
    summary: 'Beauty campaign · 2-day shoot',
  },
  {
    id: 'neon',
    name: 'Neon Drift',
    code: 'NDR-18',
    color: '#fbbf24',  // amber
    glow: 'rgba(251,191,36,0.45)',
    start: d(2026, 5, 18),
    end:   d(2026, 6, 7),
    summary: 'Music video · mobile build',
  },
  {
    id: 'halcyon',
    name: 'Halcyon',
    code: 'HCN-01',
    color: '#34d399',  // emerald
    glow: 'rgba(52,211,153,0.45)',
    start: d(2026, 6, 1),
    end:   d(2026, 6, 14),
    summary: 'Episodic pilot · multi-cam',
  },
]

export const RESOURCES = [
  // ── People ───────────────────────────────────────────────────────────
  { id: 'p1', kind: 'people', name: 'Danny',  role: 'Producer',         contractor: false, color: '#60a5fa', initial: 'D' },
  { id: 'p2', kind: 'people', name: 'Mark',   role: 'Stage Manager',    contractor: false, color: '#f472b6', initial: 'M' },
  { id: 'p3', kind: 'people', name: 'Brian',  role: 'DP',               contractor: false, color: '#facc15', initial: 'B' },
  { id: 'p4', kind: 'people', name: 'Wilder', role: 'LED Tech',         contractor: false, color: '#a78bfa', initial: 'W' },
  { id: 'p5', kind: 'people', name: 'Sarah',  role: 'Stage Manager',    contractor: true,  color: '#34d399', initial: 'S' },
  { id: 'p6', kind: 'people', name: 'Carlos', role: 'LED Operator',     contractor: true,  color: '#fb923c', initial: 'C' },
  { id: 'p7', kind: 'people', name: 'Jen',    role: 'DIT',              contractor: true,  color: '#22d3ee', initial: 'J' },

  // ── Gear ─────────────────────────────────────────────────────────────
  { id: 'g1', kind: 'gear', name: 'LED Wall A',         role: '24×14 ROE BP2 V2',  initial: 'LA', color: '#22d3ee' },
  { id: 'g2', kind: 'gear', name: 'LED Wall B',         role: '16×9 ROE BP2 V2',   initial: 'LB', color: '#67e8f9' },
  { id: 'g3', kind: 'gear', name: 'Robo Camera',        role: 'Mo-Sys L40',         initial: 'RC', color: '#f59e0b' },
  { id: 'g4', kind: 'gear', name: 'Disguise Server 1',  role: 'vx 4+',              initial: 'D1', color: '#8b5cf6' },
  { id: 'g5', kind: 'gear', name: 'Disguise Server 2',  role: 'vx 4+',              initial: 'D2', color: '#a78bfa' },
  { id: 'g6', kind: 'gear', name: 'Scissor Lift',       role: 'Genie GS-2632',      initial: 'SL', color: '#eab308' },
  { id: 'g7', kind: 'gear', name: 'Truss Package',      role: '12-box · 20ft',      initial: 'TR', color: '#94a3b8' },

  // ── Locations ────────────────────────────────────────────────────────
  { id: 'l1', kind: 'locations', name: 'Orbital Studio',     role: 'In-House'  },
  { id: 'l2', kind: 'locations', name: 'Paramount Stage 6',  role: 'Mobile'    },
  { id: 'l3', kind: 'locations', name: 'Netflix Stage 14',   role: 'Mobile'    },
  { id: 'l4', kind: 'locations', name: 'Warner Stage 22',    role: 'Mobile'    },
]

// resourceId → list of { productionId, start, end } (commitments)
// Date ranges may overlap with another commitment to show overcommitment.
export const COMMITMENTS = [
  // ── Apex Auto: May 4-17 ──────────────────────────────────────────────
  { resourceId: 'p1', productionId: 'apex',    start: d(2026, 5, 4),  end: d(2026, 5, 17) },
  { resourceId: 'p2', productionId: 'apex',    start: d(2026, 5, 4),  end: d(2026, 5, 17) },
  { resourceId: 'p3', productionId: 'apex',    start: d(2026, 5, 4),  end: d(2026, 5, 10) },
  { resourceId: 'p4', productionId: 'apex',    start: d(2026, 5, 4),  end: d(2026, 5, 17) },
  { resourceId: 'g1', productionId: 'apex',    start: d(2026, 5, 4),  end: d(2026, 5, 17) },
  { resourceId: 'g3', productionId: 'apex',    start: d(2026, 5, 4),  end: d(2026, 5, 17) },
  { resourceId: 'g4', productionId: 'apex',    start: d(2026, 5, 4),  end: d(2026, 5, 17) },
  { resourceId: 'l1', productionId: 'apex',    start: d(2026, 5, 4),  end: d(2026, 5, 17) },

  // ── Lunar Bloom: May 11-24 ───────────────────────────────────────────
  { resourceId: 'p2', productionId: 'lunar',   start: d(2026, 5, 11), end: d(2026, 5, 24) }, // ⚠ Mark overlaps Apex May 11-17
  { resourceId: 'p3', productionId: 'lunar',   start: d(2026, 5, 11), end: d(2026, 5, 24) },
  { resourceId: 'p5', productionId: 'lunar',   start: d(2026, 5, 11), end: d(2026, 5, 24) },
  { resourceId: 'p6', productionId: 'lunar',   start: d(2026, 5, 11), end: d(2026, 5, 24) },
  { resourceId: 'g1', productionId: 'lunar',   start: d(2026, 5, 11), end: d(2026, 5, 24) }, // ⚠ LED Wall A overlap
  { resourceId: 'g2', productionId: 'lunar',   start: d(2026, 5, 11), end: d(2026, 5, 24) },
  { resourceId: 'g5', productionId: 'lunar',   start: d(2026, 5, 11), end: d(2026, 5, 24) },
  { resourceId: 'l2', productionId: 'lunar',   start: d(2026, 5, 11), end: d(2026, 5, 24) },

  // ── Neon Drift: May 18 - June 7 ──────────────────────────────────────
  { resourceId: 'p4', productionId: 'neon',    start: d(2026, 5, 18), end: d(2026, 6, 7)  },
  { resourceId: 'p3', productionId: 'neon',    start: d(2026, 5, 25), end: d(2026, 6, 7)  },
  { resourceId: 'p6', productionId: 'neon',    start: d(2026, 5, 25), end: d(2026, 6, 7)  },
  { resourceId: 'p7', productionId: 'neon',    start: d(2026, 5, 18), end: d(2026, 6, 7)  },
  { resourceId: 'g4', productionId: 'neon',    start: d(2026, 5, 18), end: d(2026, 6, 7)  }, // ⚠ Disguise 1 overlap with itself idle... no, Apex ended May 17 — fine
  { resourceId: 'g2', productionId: 'neon',    start: d(2026, 5, 18), end: d(2026, 6, 7)  }, // ⚠ LED Wall B overlap with Lunar May 18-24
  { resourceId: 'g7', productionId: 'neon',    start: d(2026, 5, 18), end: d(2026, 6, 7)  },
  { resourceId: 'l3', productionId: 'neon',    start: d(2026, 5, 18), end: d(2026, 6, 7)  },

  // ── Halcyon: June 1-14 ───────────────────────────────────────────────
  { resourceId: 'p4', productionId: 'halcyon', start: d(2026, 6, 1),  end: d(2026, 6, 14) }, // ⚠ Wilder overlaps Neon June 1-7
  { resourceId: 'p2', productionId: 'halcyon', start: d(2026, 6, 1),  end: d(2026, 6, 14) },
  { resourceId: 'p7', productionId: 'halcyon', start: d(2026, 6, 8),  end: d(2026, 6, 14) },
  { resourceId: 'g1', productionId: 'halcyon', start: d(2026, 6, 1),  end: d(2026, 6, 14) },
  { resourceId: 'g3', productionId: 'halcyon', start: d(2026, 6, 1),  end: d(2026, 6, 14) },
  { resourceId: 'g6', productionId: 'halcyon', start: d(2026, 6, 1),  end: d(2026, 6, 14) },
  { resourceId: 'l4', productionId: 'halcyon', start: d(2026, 6, 1),  end: d(2026, 6, 14) },
]

// ── Helpers ──────────────────────────────────────────────────────────────
export function dayIndex(date) {
  const ms = date.getTime() - WINDOW_START.getTime()
  return Math.round(ms / 86400000)
}

export function dateAtDayIndex(idx) {
  const t = new Date(WINDOW_START)
  t.setDate(t.getDate() + idx)
  return t
}

export function commitmentsForResource(resourceId) {
  return COMMITMENTS.filter(c => c.resourceId === resourceId)
}

export function productionsForResource(resourceId) {
  const ids = new Set(COMMITMENTS.filter(c => c.resourceId === resourceId).map(c => c.productionId))
  return PRODUCTIONS.filter(p => ids.has(p.id))
}

export function resourcesForProduction(productionId) {
  const ids = new Set(COMMITMENTS.filter(c => c.productionId === productionId).map(c => c.resourceId))
  return RESOURCES.filter(r => ids.has(r.id))
}

// True if a resource has two or more commitments whose date ranges intersect.
export function hasConflict(resourceId) {
  const cs = commitmentsForResource(resourceId)
  for (let i = 0; i < cs.length; i++) {
    for (let j = i + 1; j < cs.length; j++) {
      if (cs[i].start <= cs[j].end && cs[j].start <= cs[i].end) return true
    }
  }
  return false
}

// Status at a specific day index: 'available' | 'committed' | 'overcommitted'
export function statusAtDay(resourceId, dayIdx) {
  const at = dateAtDayIndex(dayIdx)
  const active = commitmentsForResource(resourceId).filter(c => c.start <= at && at <= c.end)
  if (active.length === 0) return 'available'
  if (active.length === 1) return 'committed'
  return 'overcommitted'
}

// Total committed days across the window for a resource — drives line thickness
// in the Grav Map view.
export function commitmentLoad(resourceId, productionId) {
  const c = COMMITMENTS.find(x => x.resourceId === resourceId && x.productionId === productionId)
  if (!c) return 0
  const days = Math.round((c.end - c.start) / 86400000) + 1
  return days
}

export const KIND_META = {
  people:    { label: 'People',    plural: 'people'    },
  gear:      { label: 'Gear',      plural: 'gear'      },
  locations: { label: 'Locations', plural: 'locations' },
}
