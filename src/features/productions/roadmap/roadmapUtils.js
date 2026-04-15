// ─── Roadmap Utilities ────────────────────────────────────────────────────────
// Pure functions and config objects shared across all roadmap components.
// No React, no hooks — importable anywhere including non-component files.

import { MILESTONE_TYPE, MILESTONE_STATUS, CONCERN_IMPACT, CONCERN_STATUS } from '../../../data/models.js'

// ─── Milestone type visual config ─────────────────────────────────────────────
export const MILESTONE_TYPE_CONFIG = {
  [MILESTONE_TYPE.PRE_PRODUCTION]: {
    color: '#8b5cf6',
    bg: 'bg-purple-500/15', text: 'text-purple-400', border: 'border-purple-500/30',
    dot: 'bg-purple-500',
  },
  [MILESTONE_TYPE.LOGISTICS]: {
    color: '#3b82f6',
    bg: 'bg-blue-500/15', text: 'text-blue-400', border: 'border-blue-500/30',
    dot: 'bg-blue-500',
  },
  [MILESTONE_TYPE.SHOOT_DAY]: {
    color: '#22c55e',
    bg: 'bg-green-500/15', text: 'text-green-400', border: 'border-green-500/30',
    dot: 'bg-green-500',
  },
  [MILESTONE_TYPE.TECHNICAL]: {
    color: '#06b6d4',
    bg: 'bg-cyan-500/15', text: 'text-cyan-400', border: 'border-cyan-500/30',
    dot: 'bg-cyan-500',
  },
  [MILESTONE_TYPE.CLIENT]: {
    color: '#f59e0b',
    bg: 'bg-amber-500/15', text: 'text-amber-400', border: 'border-amber-500/30',
    dot: 'bg-amber-500',
  },
  [MILESTONE_TYPE.FINANCIAL]: {
    color: '#10b981',
    bg: 'bg-emerald-500/15', text: 'text-emerald-400', border: 'border-emerald-500/30',
    dot: 'bg-emerald-500',
  },
  [MILESTONE_TYPE.WRAP]: {
    color: '#94a3b8',
    bg: 'bg-slate-500/15', text: 'text-slate-400', border: 'border-slate-500/30',
    dot: 'bg-slate-500',
  },
}

// ─── Milestone status visual config ───────────────────────────────────────────
export const MILESTONE_STATUS_CONFIG = {
  [MILESTONE_STATUS.UPCOMING]:    { bg: 'bg-orbital-muted', text: 'text-orbital-subtle', border: 'border-orbital-border' },
  [MILESTONE_STATUS.IN_PROGRESS]: { bg: 'bg-blue-500/15', text: 'text-blue-400', border: 'border-blue-500/30' },
  [MILESTONE_STATUS.COMPLETE]:    { bg: 'bg-green-500/15', text: 'text-green-400', border: 'border-green-500/30' },
  [MILESTONE_STATUS.AT_RISK]:     { bg: 'bg-amber-500/15', text: 'text-amber-400', border: 'border-amber-500/30' },
}

// ─── Concern impact visual config ─────────────────────────────────────────────
export const CONCERN_IMPACT_CONFIG = {
  [CONCERN_IMPACT.LOW]:      { bg: 'bg-zinc-600/30', text: 'text-zinc-400', border: 'border-zinc-600/40' },
  [CONCERN_IMPACT.MEDIUM]:   { bg: 'bg-blue-500/15', text: 'text-blue-400', border: 'border-blue-500/30' },
  [CONCERN_IMPACT.HIGH]:     { bg: 'bg-amber-500/15', text: 'text-amber-400', border: 'border-amber-500/30' },
  [CONCERN_IMPACT.CRITICAL]: { bg: 'bg-red-500/15', text: 'text-red-400', border: 'border-red-500/30' },
}

// ─── Concern status visual config ─────────────────────────────────────────────
export const CONCERN_STATUS_CONFIG = {
  [CONCERN_STATUS.OPEN]:        { bg: 'bg-red-500/15', text: 'text-red-400', border: 'border-red-500/30' },
  [CONCERN_STATUS.IN_PROGRESS]: { bg: 'bg-blue-500/15', text: 'text-blue-400', border: 'border-blue-500/30' },
  [CONCERN_STATUS.RESOLVED]:    { bg: 'bg-green-500/15', text: 'text-green-400', border: 'border-green-500/30' },
  [CONCERN_STATUS.ACCEPTED]:    { bg: 'bg-zinc-600/30', text: 'text-zinc-400', border: 'border-zinc-600/40' },
}

// ─── Roadmap health ───────────────────────────────────────────────────────────
export const ROADMAP_HEALTH = {
  ON_TRACK:        'On Track',
  NEEDS_ATTENTION: 'Needs Attention',
  AT_RISK:         'At Risk',
}

export const HEALTH_CONFIG = {
  [ROADMAP_HEALTH.ON_TRACK]:        { pill: 'bg-green-500/15 text-green-400 border-green-500/30', dot: '●', color: '#22c55e' },
  [ROADMAP_HEALTH.NEEDS_ATTENTION]: { pill: 'bg-amber-500/15 text-amber-400 border-amber-500/30', dot: '●', color: '#f59e0b' },
  [ROADMAP_HEALTH.AT_RISK]:         { pill: 'bg-red-500/15 text-red-400 border-red-500/30', dot: '●', color: '#ef4444' },
}

/**
 * Computes the health status of a production roadmap.
 * Pure function — no side effects.
 *
 * AT_RISK   : overdue milestones OR unresolved Critical concerns
 * NEEDS_ATTENTION : At Risk milestones OR unresolved High concerns
 * ON_TRACK  : everything else
 */
export function computeRoadmapHealth(roadmap) {
  if (!roadmap) return ROADMAP_HEALTH.ON_TRACK
  const milestones = roadmap.milestones || []
  const concerns   = roadmap.logisticalConcerns || []
  if (milestones.length === 0 && concerns.length === 0) return ROADMAP_HEALTH.ON_TRACK

  const now = new Date()

  const isOpenConcern = (c) =>
    c.status !== CONCERN_STATUS.RESOLVED && c.status !== CONCERN_STATUS.ACCEPTED

  const overdueMilestones = milestones.filter(m =>
    m.date && new Date(m.date) < now && m.status !== MILESTONE_STATUS.COMPLETE
  ).length

  const criticalConcerns = concerns.filter(c =>
    c.impactLevel === CONCERN_IMPACT.CRITICAL && isOpenConcern(c)
  ).length

  const atRiskMilestones = milestones.filter(m =>
    m.status === MILESTONE_STATUS.AT_RISK
  ).length

  const highConcerns = concerns.filter(c =>
    c.impactLevel === CONCERN_IMPACT.HIGH && isOpenConcern(c)
  ).length

  if (overdueMilestones > 0 || criticalConcerns > 0) return ROADMAP_HEALTH.AT_RISK
  if (atRiskMilestones > 0 || highConcerns > 0)       return ROADMAP_HEALTH.NEEDS_ATTENTION
  return ROADMAP_HEALTH.ON_TRACK
}

/**
 * Returns upcoming milestones sorted by date, optionally limited.
 */
export function getUpcomingMilestones(roadmap, limit = null) {
  const now = new Date()
  const milestones = (roadmap?.milestones || [])
    .filter(m => m.date && new Date(m.date) >= now && m.status !== MILESTONE_STATUS.COMPLETE)
    .sort((a, b) => a.date.localeCompare(b.date))
  return limit ? milestones.slice(0, limit) : milestones
}
