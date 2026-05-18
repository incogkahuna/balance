// Prototype data adapter.
//
// The Constellation / Resource River / Gantt views were originally built
// against a hand-crafted set of constants in sampleData.js. This module
// wraps that source so the visualizations can transparently render either:
//
//   • Live data — derived from real productions + milestone assignments
//     in AppContext. Used when there's at least one production with date
//     bounds in the database.
//   • Seed data — the original sampleData constants, used as a fallback
//     when the app is empty so first-time visitors still see the
//     visualizations populated.
//
// The seed-vs-live choice happens automatically inside usePrototypeData()
// based on whether useApp() has any productions with start/end dates.
//
// All the helpers from sampleData (dayIndex, commitmentLoad, etc.) are
// re-implemented here as data-aware functions on the returned object so
// they bind to whichever dataset is active.

import { useMemo } from 'react'
import { useApp } from '../../context/AppContext.jsx'
import { USERS } from '../../data/models.js'
import {
  PRODUCTIONS as SEED_PRODUCTIONS,
  RESOURCES   as SEED_RESOURCES,
  COMMITMENTS as SEED_COMMITMENTS,
  WINDOW_START as SEED_WINDOW_START,
  WINDOW_END   as SEED_WINDOW_END,
  KIND_META,
} from './sampleData.js'

// Production color cycle — used to assign accent colors to real productions
// since the Production schema doesn't carry color metadata.
const PROD_COLORS = [
  { color: '#22d3ee', glow: 'rgba(34,211,238,0.45)' },   // cyan
  { color: '#e879f9', glow: 'rgba(232,121,249,0.45)' },  // magenta
  { color: '#fbbf24', glow: 'rgba(251,191,36,0.45)' },   // amber
  { color: '#34d399', glow: 'rgba(52,211,153,0.45)' },   // emerald
  { color: '#a78bfa', glow: 'rgba(167,139,250,0.45)' },  // violet
  { color: '#f87171', glow: 'rgba(248,113,113,0.45)' },  // red
  { color: '#60a5fa', glow: 'rgba(96,165,250,0.45)' },   // blue
]

function shortCode(name, idx) {
  // Generate a 3-letter code from the production name + numeric suffix.
  const letters = (name || 'PRD').toUpperCase().replace(/[^A-Z]/g, '').slice(0, 3) || 'PRD'
  return `${letters}-${String(idx + 1).padStart(2, '0')}`
}

// Convert a Production from AppContext into the prototype's Production shape.
function toPrototypeProduction(prod, idx) {
  const palette = PROD_COLORS[idx % PROD_COLORS.length]
  return {
    id:      prod.id,
    name:    prod.name || 'Untitled',
    code:    shortCode(prod.name, idx),
    color:   palette.color,
    glow:    palette.glow,
    start:   prod.startDate ? new Date(prod.startDate) : new Date(),
    end:     prod.endDate   ? new Date(prod.endDate)   : new Date(),
    summary: [prod.client, prod.productionType].filter(Boolean).join(' · '),
  }
}

// Convert a USERS entry into a prototype Resource.
function toPrototypeResource(user) {
  return {
    id:      user.id,
    kind:    'people',
    name:    user.name,
    role:    user.role,
    contractor: false,
    color:   user.color,
    initial: user.avatar,
  }
}

// Build the COMMITMENTS list from real production / milestone assignments.
// Each assignment becomes a commitment for that person's id on that
// production's id, with start/end derived from either the milestone date
// window or the full production window.
function deriveCommitments(productions) {
  const commitments = []

  for (const prod of productions) {
    const prodStart = prod.startDate ? new Date(prod.startDate) : null
    const prodEnd   = prod.endDate   ? new Date(prod.endDate)   : prodStart
    if (!prodStart) continue

    // 1. Anyone on the production's assignedMembers is committed for the
    //    entire production window. This is the baseline assignment.
    const memberSeen = new Set()
    for (const member of (prod.assignedMembers || [])) {
      if (!member.userId || memberSeen.has(member.userId)) continue
      memberSeen.add(member.userId)
      commitments.push({
        resourceId:   member.userId,
        productionId: prod.id,
        start: prodStart,
        end:   prodEnd,
      })
    }

    // 2. Milestone owners + participants get a commitment for a small
    //    window centred on the milestone date (or the production window
    //    if the milestone has no date). If they were already committed
    //    to this production at the member level we don't add a duplicate.
    const milestones = prod.roadmap?.milestones || []
    for (const m of milestones) {
      const assignees = [m.ownerId, ...(m.participantIds || [])].filter(Boolean)
      const mDate = m.date ? new Date(m.date) : prodStart
      // Default milestone window: ±1 day around the milestone date.
      const mStart = new Date(mDate); mStart.setDate(mStart.getDate() - 1)
      const mEnd   = new Date(mDate); mEnd.setDate(mEnd.getDate() + 1)
      for (const personId of assignees) {
        if (memberSeen.has(personId)) continue   // already covered above
        commitments.push({
          resourceId:   personId,
          productionId: prod.id,
          start: mStart,
          end:   mEnd,
        })
      }
    }
  }

  return commitments
}

// Compute the visualisation window from the earliest production start to
// the latest production end, padded by a few days for visual breathing room.
function deriveWindow(productions) {
  const dates = productions.flatMap(p => {
    const out = []
    if (p.startDate) out.push(new Date(p.startDate))
    if (p.endDate)   out.push(new Date(p.endDate))
    return out
  })
  if (dates.length === 0) {
    return { start: SEED_WINDOW_START, end: SEED_WINDOW_END }
  }
  const earliest = new Date(Math.min(...dates.map(d => d.getTime())))
  const latest   = new Date(Math.max(...dates.map(d => d.getTime())))
  const start = new Date(earliest); start.setDate(start.getDate() - 3)
  const end   = new Date(latest);   end.setDate(end.getDate() + 3)
  return { start, end }
}

// ── Public hook ──────────────────────────────────────────────────────────────
export function usePrototypeData() {
  const { productions = [] } = useApp() || {}

  return useMemo(() => {
    // Prefer live data when at least one production has real date bounds
    const liveCandidates = productions.filter(p => p.startDate && p.endDate)
    const useLive = liveCandidates.length > 0

    if (!useLive) {
      // Fall back to the curated seed dataset so empty-state demos still work.
      return buildBundle({
        productions: SEED_PRODUCTIONS,
        resources:   SEED_RESOURCES,
        commitments: SEED_COMMITMENTS,
        windowStart: SEED_WINDOW_START,
        windowEnd:   SEED_WINDOW_END,
        source:      'seed',
      })
    }

    const protoProductions = liveCandidates.map(toPrototypeProduction)
    // Real resources: just the salary roster for now. Gear/locations aren't
    // first-class entities in the real schema yet, so we omit them rather
    // than mix in seed gear.
    const protoResources   = USERS.map(toPrototypeResource)
    const commitments      = deriveCommitments(liveCandidates)
    const { start, end }   = deriveWindow(liveCandidates)

    return buildBundle({
      productions: protoProductions,
      resources:   protoResources,
      commitments,
      windowStart: start,
      windowEnd:   end,
      source:      'live',
    })
  }, [productions])
}

// Wrap a raw dataset with the same helper functions sampleData used to
// provide, but bound to this dataset (so the prototypes can call them
// without caring whether they're looking at live or seed data).
function buildBundle({ productions, resources, commitments, windowStart, windowEnd, source }) {
  const windowDays = Math.max(1, Math.round((windowEnd - windowStart) / 86400000))

  const dayIndex = (date) =>
    Math.round((date.getTime() - windowStart.getTime()) / 86400000)
  const dateAtDayIndex = (idx) => {
    const t = new Date(windowStart)
    t.setDate(t.getDate() + idx)
    return t
  }
  const commitmentsForResource = (resourceId) =>
    commitments.filter(c => c.resourceId === resourceId)
  const productionsForResource = (resourceId) => {
    const ids = new Set(commitmentsForResource(resourceId).map(c => c.productionId))
    return productions.filter(p => ids.has(p.id))
  }
  const resourcesForProduction = (productionId) => {
    const ids = new Set(commitments.filter(c => c.productionId === productionId).map(c => c.resourceId))
    return resources.filter(r => ids.has(r.id))
  }
  const hasConflict = (resourceId) => {
    const cs = commitmentsForResource(resourceId)
    for (let i = 0; i < cs.length; i++) {
      for (let j = i + 1; j < cs.length; j++) {
        if (cs[i].start <= cs[j].end && cs[j].start <= cs[i].end) return true
      }
    }
    return false
  }
  const statusAtDay = (resourceId, dayIdx) => {
    const at = dateAtDayIndex(dayIdx)
    const active = commitmentsForResource(resourceId).filter(c => c.start <= at && at <= c.end)
    if (active.length === 0) return 'available'
    if (active.length === 1) return 'committed'
    return 'overcommitted'
  }
  const commitmentLoad = (resourceId, productionId) => {
    const c = commitments.find(x => x.resourceId === resourceId && x.productionId === productionId)
    if (!c) return 0
    return Math.round((c.end - c.start) / 86400000) + 1
  }

  return {
    source,                   // 'live' | 'seed' — render a badge in the toolbar
    productions,
    resources,
    commitments,
    windowStart,
    windowEnd,
    windowDays,
    KIND_META,
    dayIndex,
    dateAtDayIndex,
    commitmentsForResource,
    productionsForResource,
    resourcesForProduction,
    hasConflict,
    statusAtDay,
    commitmentLoad,
  }
}
