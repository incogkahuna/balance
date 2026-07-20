// ─────────────────────────────────────────────────────────────────────────────
// quoteMath — pure quote-engine logic. No imports, no React, no Supabase, so
// it runs under plain node for unit checks and stays trivially testable.
//
// A quote stores only DELTAS against its pinned rate-card version:
//   quote.lines = { [lineId]: { x, qty, rateOverride?, spec?, note? } }
// Everything below joins those deltas with the version document.
// ─────────────────────────────────────────────────────────────────────────────

// ── Rate resolution ──────────────────────────────────────────────────────────
// Shared-module lines carry {tvc, mobile} rates; venue picks one. Manual lines
// have no card rate at all — the quote's rateOverride is the number.
export function resolveRate(line, venue, quoteLine) {
  if (quoteLine && quoteLine.rateOverride != null) return quoteLine.rateOverride
  const r = line.rate
  if (r == null) return 0
  if (typeof r === 'object') return r[venue] ?? 0
  return r
}

// ── Day-driven quantity proposal ─────────────────────────────────────────────
// The header day breakdown (travel/build/shoot/strike) flows into day-based
// lines automatically. Always overridable per line — the app proposes, Brian
// disposes. Returns null when the line has no day derivation (manual qty).
export function proposedQty(line, days) {
  const d = days || {}
  const t = Number(d.travel) || 0
  const b = Number(d.build) || 0
  const s = Number(d.shoot) || 0
  const k = Number(d.strike) || 0
  switch (line.autoQty) {
    case 'travel':      return t
    case 'build':       return b
    case 'shoot':       return s
    case 'strike':      return k
    case 'buildStrike': return b + k
    case 'allDays':     return t + b + s + k
    case 'weeksAll':    return Math.max(1, Math.ceil((t + b + s + k) / 7))
    default:            return null
  }
}

// ── Line math: QTY × X × Rate = SubTotal ─────────────────────────────────────
// X is effectively on/off (0 or 1, occasionally a count). Inactive lines stay
// on the menu at $0.00.
export function lineSubtotal(line, venue, quoteLine) {
  if (!quoteLine || !quoteLine.x) return 0
  const qty = quoteLine.qty ?? 1
  const rate = resolveRate(line, venue, quoteLine)
  return (Number(qty) || 0) * (Number(quoteLine.x) || 0) * (Number(rate) || 0)
}

// ── Section + grand totals ───────────────────────────────────────────────────
export function computeTotals(card, quote) {
  const template = card.templates[quote.venue]
  const sections = []
  let subtotal = 0
  for (const section of template.sections) {
    let sec = 0
    for (const lineId of section.lines) {
      const line = card.lines[lineId]
      if (!line) continue
      sec += lineSubtotal(line, quote.venue, quote.lines[lineId])
    }
    sections.push({ id: section.id, title: section.title, subtotal: sec })
    subtotal += sec
  }
  const discountAmount = computeDiscount(quote.discount, subtotal)
  return { sections, subtotal, discountAmount, total: subtotal - discountAmount }
}

// ── Discount block ───────────────────────────────────────────────────────────
// Amount (fixed or %) + REQUIRED label. The label prints on the client PDF so
// the next negotiation starts from the rate card.
export function computeDiscount(discount, subtotal) {
  if (!discount || !discount.value) return 0
  const v = Number(discount.value) || 0
  if (discount.mode === 'percent') return Math.round(subtotal * v) / 100
  return v
}

export function discountIsValid(discount) {
  if (!discount || !Number(discount.value)) return true // no discount = fine
  return Boolean(discount.label && String(discount.label).trim())
}

// ── Dependency rules — live logic, not description text ──────────────────────
// Activating a line with unmet `requires` auto-activates the prerequisites
// (with a visible note). Returns {adds: {lineId: quoteLine}, notes: [string]}.
export function resolveDependencies(card, quote, lineId) {
  const adds = {}
  const notes = []
  const visit = (id) => {
    const line = card.lines[id]
    if (!line || !line.requires) return
    for (const reqId of line.requires) {
      const existing = quote.lines[reqId]
      if (existing && existing.x) continue
      if (adds[reqId]) continue
      const reqLine = card.lines[reqId]
      adds[reqId] = { x: 1, qty: 1 }
      notes.push(`${line.name} requires ${reqLine?.name || reqId} — activated automatically.`)
      visit(reqId)
    }
  }
  visit(lineId)
  return { adds, notes }
}

// Lines whose requirements are NOT met (e.g. prerequisite manually removed
// after auto-activation). A quote with violations cannot be saved as sent.
export function dependencyViolations(card, quote) {
  const out = []
  for (const [id, ql] of Object.entries(quote.lines || {})) {
    if (!ql || !ql.x) continue
    const line = card.lines[id]
    if (!line) continue
    for (const reqId of line.requires || []) {
      const req = quote.lines[reqId]
      if (!req || !req.x) {
        out.push({ lineId: id, requires: reqId,
          message: `${line.name} requires ${card.lines[reqId]?.name || reqId}.` })
      }
    }
    // Required spec captures (Genlock frame rate) count as violations too —
    // Brian must never ship Genlock active with no frame rate picked.
    if (line.spec?.required && ql.x && !(ql.spec && ql.spec.value)) {
      out.push({ lineId: id, requires: 'spec',
        message: `${line.name}: ${line.spec.label} must be selected.` })
    }
  }
  return out
}

// Soft flags we can't auto-resolve — rendered as inline warnings.
export function activeFlags(card, quote) {
  const out = []
  for (const [id, ql] of Object.entries(quote.lines || {})) {
    if (!ql || !ql.x) continue
    const line = card.lines[id]
    for (const flag of line?.flags || []) {
      if (flag === 'prelight') {
        // Mobile: satisfied when a pre-light crew day is on the quote.
        const hasPrelight = ['vps_prelight', 'vpe_prelight', 'ledtech_prelight']
          .some((pid) => quote.lines[pid]?.x)
        if (!hasPrelight) out.push({ lineId: id, flag,
          message: `${line.name} requires a pre-light day — none is on this quote.` })
      } else if (flag === 'timecode') {
        out.push({ lineId: id, flag,
          message: `${line.name} requires timecode from production — confirm with the client.` })
      }
    }
  }
  return out
}

// ── Internal floor (build view only — never on the client PDF) ───────────────
export function internalFloor(card, quote) {
  const out = []
  for (const [id, ql] of Object.entries(quote.lines || {})) {
    if (!ql || !ql.x) continue
    const line = card.lines[id]
    if (line?.internal) out.push({ lineId: id, name: line.name, ...line.internal })
  }
  return out
}

// ── Quote expiry — "This bid is good for 30 business days" ───────────────────
export function quoteExpiryDate(issuedAt) {
  if (!issuedAt) return null
  const d = new Date(`${String(issuedAt).slice(0, 10)}T12:00:00`)
  if (Number.isNaN(d.getTime())) return null
  let remaining = 30
  while (remaining > 0) {
    d.setDate(d.getDate() + 1)
    const day = d.getDay()
    if (day !== 0 && day !== 6) remaining -= 1
  }
  return d.toISOString().slice(0, 10)
}

export function quoteIsExpired(issuedAt, today = new Date().toISOString().slice(0, 10)) {
  const exp = quoteExpiryDate(issuedAt)
  return exp ? today > exp : false
}

// ── Handoff derivation (yellow-lit auto-spawn) — nothing re-typed ────────────
// Crew requirements from active crew lines; bundles expand to component roles.
export function deriveCrew(card, quote) {
  if (!quote) return []
  const seen = new Set()
  const crew = []
  for (const [id, ql] of Object.entries(quote.lines || {})) {
    if (!ql || !ql.x) continue
    const line = card.lines[id]
    if (!line) continue
    if (line.bundle) {
      for (const role of line.bundle) {
        if (seen.has(role)) continue
        seen.add(role)
        crew.push({ role, source: line.name })
      }
    } else if (line.crewRole) {
      if (seen.has(line.crewRole)) continue
      seen.add(line.crewRole)
      crew.push({ role: line.crewRole, source: line.name })
    }
  }
  return crew
}

// Tech spec sheet from active config lines.
export function deriveTechSpec(card, quote, deal) {
  const spec = {
    assetClass: deal?.assetClass || '',
    frameRate: null,
    tracking: false,
    preLight: false,
    wallConfig: [],
    flags: [],
  }
  if (!quote) return spec
  const wallLines = ['bd_wall', 'hercules', 'rolling_20x12', 'rolling_10x12']
  for (const [id, ql] of Object.entries(quote.lines || {})) {
    if (!ql || !ql.x) continue
    const line = card.lines[id]
    if (!line) continue
    if (id === 'genlock' && ql.spec?.value) spec.frameRate = ql.spec.value
    if (id === 'bd_tracking' || id === 'optitrack_mobile' || id === 'add_tracking_system') spec.tracking = true
    if (id.endsWith('_prelight')) spec.preLight = true
    if (wallLines.includes(id)) spec.wallConfig.push(line.name)
  }
  for (const f of activeFlags(card, quote)) spec.flags.push(f.message)
  return spec
}

// Mark's summary — the "three sentences": what, when, where, crew, wall.
export function deriveSummary(deal, crew, techSpec) {
  const days = deal.days || {}
  const dayBits = [
    days.travel && `${days.travel} travel`,
    days.build && `${days.build} build`,
    days.shoot && `${days.shoot} shoot`,
    days.strike && `${days.strike} strike`,
  ].filter(Boolean).join(' + ')
  const where = deal.venue === 'mobile'
    ? `mobile build${deal.mobileLocation ? ` at ${deal.mobileLocation}` : ''}`
    : 'TVC (Big Dipper stage)'
  const when = deal.startDate
    ? `${deal.startDate}${deal.endDate ? ` → ${deal.endDate}` : ''}`
    : 'dates TBD'
  const crewStr = crew.length
    ? crew.map((c) => c.role).join(', ')
    : 'crew TBD'
  const wall = techSpec.wallConfig.length
    ? `${techSpec.wallConfig.join(' + ')}${techSpec.frameRate ? ` @ ${techSpec.frameRate}fps` : ''}${techSpec.tracking ? ', with tracking' : ''}`
    : 'wall config TBD'
  return [
    `${deal.clientCompany} — "${deal.projectName}" (${deal.assetClass || 'asset class TBD'}), ${where}.`,
    `${when}${dayBits ? ` (${dayBits})` : ''}.`,
    `Crew: ${crewStr}. On the wall: ${wall}.`,
  ].join(' ')
}

// Calendar blocks for green-light: full-day 9:00–9:00 holds so everyone sees
// the day is taken and no tours get booked. Times get adjusted later.
// (Google Calendar integration point: swap the persistence of these blocks.)
export function buildCalendarBlocks(deal) {
  const blocks = []
  if (!deal.startDate) return blocks
  const days = deal.days || {}
  const order = [
    ['travel', Number(days.travel) || 0],
    ['build', Number(days.build) || 0],
    ['shoot', Number(days.shoot) || 0],
    ['strike', Number(days.strike) || 0],
  ]
  const d = new Date(`${deal.startDate}T12:00:00`)
  if (Number.isNaN(d.getTime())) return blocks
  for (const [dayType, count] of order) {
    for (let i = 0; i < count; i++) {
      blocks.push({
        date: d.toISOString().slice(0, 10),
        dayType,
        label: `9:00–9:00 — ${deal.projectName} (${dayType}) (TBA — times to be adjusted)`,
      })
      d.setDate(d.getDate() + 1)
    }
  }
  return blocks
}

// End date implied by the day breakdown (start + total days − 1).
export function impliedEndDate(startDate, days) {
  if (!startDate) return null
  const total = ['travel', 'build', 'shoot', 'strike']
    .reduce((n, k) => n + (Number(days?.[k]) || 0), 0)
  if (total <= 0) return startDate
  const d = new Date(`${startDate}T12:00:00`)
  if (Number.isNaN(d.getTime())) return null
  d.setDate(d.getDate() + total - 1)
  return d.toISOString().slice(0, 10)
}

// ── Formatting ───────────────────────────────────────────────────────────────
export function fmtMoney(n) {
  if (n == null || Number.isNaN(Number(n))) return '—'
  return Number(n).toLocaleString('en-US', {
    style: 'currency', currency: 'USD',
    minimumFractionDigits: 2, maximumFractionDigits: 2,
  })
}

export function fmtMoneyShort(n) {
  if (n == null || Number.isNaN(Number(n))) return '—'
  return `$${Number(n).toLocaleString('en-US', { maximumFractionDigits: 0 })}`
}
