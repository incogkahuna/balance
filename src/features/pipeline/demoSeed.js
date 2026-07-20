// ─────────────────────────────────────────────────────────────────────────────
// Demo seed — 7 realistic deals across venues, intake modes, and statuses so
// every pipeline view demos meaningfully on first open. Includes one
// budget-first deal with no quote, one comparison-bid with two variants, one
// dead deal, and one expired quote. Invoked from the empty-state button
// (admin roles); writes through the normal data layer so it works in both
// local and remote modes. Deliberately does NOT spawn Balance productions —
// the real yellow-lit trigger path stays exercised by live deals only.
// ─────────────────────────────────────────────────────────────────────────────

import {
  createDeal, createQuote, createHandoff, upsertDealMoney,
} from '../../lib/data/pipeline.ts'
import { RATE_CARD_V1 } from './rateCardSeed.js'
import { computeTotals, proposedQty, deriveCrew, deriveTechSpec, deriveSummary } from './quoteMath.js'

const daysAgo = (n) => new Date(Date.now() - n * 86400000).toISOString()
const dateAgo = (n) => daysAgo(n).slice(0, 10)
const dateAhead = (n) => new Date(Date.now() + n * 86400000).toISOString().slice(0, 10)

function linesFor(venue, days, ids, overrides = {}) {
  const lines = {}
  for (const id of ids) {
    const line = RATE_CARD_V1.lines[id]
    lines[id] = { x: 1, qty: proposedQty(line, days) ?? 1, ...(overrides[id] || {}) }
  }
  return lines
}

export async function seedDemoData() {
  const mk = async (deal, { quotes = [], money = null, handoff = null } = {}) => {
    const created = await createDeal(deal)
    for (const q of quotes) await createQuote({ ...q, dealId: created.id })
    if (money) await upsertDealMoney(created.id, money)
    if (handoff) await createHandoff({ ...handoff, dealId: created.id })
    return created
  }

  const card = RATE_CARD_V1

  // 1 — TVC, standard, quote sent (3D + tracking on the Big Dipper)
  {
    const days = { travel: 0, build: 1, shoot: 3, strike: 1 }
    const lines = linesFor('tvc', days, [
      'core_crew', 'led_tech_tvc',
      'bd_wall', 'bd_prep_strike', 'bd_tracking', 'bd_server', 'bd_datacenter', 'bd_facility', 'bd_techviz',
      'genlock', 'lens_encoding',
    ], { genlock: { x: 1, qty: 1, spec: { value: '24' } } })
    const quote = {
      title: 'Quote', rateCardVersion: 1, venue: 'tvc', days, lines,
      discount: null, status: 'sent', issuedAt: dateAgo(6), sentAt: daysAgo(6),
    }
    const totals = computeTotals(card, quote)
    await mk({
      clientCompany: 'Lumen Pictures', clientContact: 'Sofia Reyes',
      clientEmail: 'sofia@lumenpictures.com', clientPhone: '(310) 555-0142',
      projectName: 'Neon Nights', venue: 'tvc', mobileLocation: '',
      intakeMode: 'standard', assetClass: '3D+tracking', status: 'quote_sent',
      startDate: dateAhead(21), endDate: dateAhead(25), days,
      notes: [{ id: 'n1', text: 'Wants the volume for a night-city sequence. Tracking confirmed. Asked about crane availability.', at: daysAgo(6), by: 'Brian' }],
      statusHistory: [
        { status: 'new', at: daysAgo(9) },
        { status: 'quote_sent', at: daysAgo(6) },
      ],
    }, {
      quotes: [quote],
      money: { quotedTotal: totals.total },
    })
  }

  // 2 — Mobile, standard, GREEN-LIT with an active handoff + gates in flight
  {
    const days = { travel: 2, build: 2, shoot: 4, strike: 1 }
    const lines = linesFor('mobile', days, [
      'hercules', 'vps_loadin', 'vps_shoot', 'vps_wrap',
      'vpe_loadin', 'vpe_shoot', 'vpe_wrap',
      'ledtech_loadin', 'ledtech_shoot', 'ledtech_wrap',
      'build_strike', 'truss_curved', 'transport_interstate',
      'genlock',
    ], {
      genlock: { x: 1, qty: 1, spec: { value: '23.98' } },
      transport_interstate: { x: 1, qty: 2 },
    })
    const quote = {
      title: 'Quote', rateCardVersion: 1, venue: 'mobile', days, lines,
      discount: { mode: 'percent', value: 5, label: 'Repeat-Client', reason: 'Third job this year', display: 'subtract' },
      status: 'accepted', issuedAt: dateAgo(30), sentAt: daysAgo(30),
    }
    const totals = computeTotals(card, quote)
    const dealShape = {
      clientCompany: 'Halcyon Ads', clientContact: 'Marcus Webb',
      clientEmail: 'mwebb@halcyonads.com', clientPhone: '(312) 555-0177',
      projectName: 'Sierra Trucks', venue: 'mobile', mobileLocation: 'Cinespace Chicago',
      intakeMode: 'standard', assetClass: '2.5D', status: 'green_light',
      startDate: dateAhead(10), endDate: dateAhead(18), days,
      notes: [{ id: 'n1', text: 'Deposit wired. COI pending from their broker — chase Thursday.', at: daysAgo(3), by: 'Brian' }],
      statusHistory: [
        { status: 'new', at: daysAgo(40) },
        { status: 'quote_sent', at: daysAgo(30) },
        { status: 'agreement', at: daysAgo(14) },
        { status: 'green_light', at: daysAgo(7) },
      ],
    }
    const crew = deriveCrew(card, quote)
    const techSpec = deriveTechSpec(card, quote, { assetClass: '2.5D' })
    const summary = deriveSummary(
      { ...dealShape, clientCompany: 'Halcyon Ads' }, crew, techSpec,
    )
    await mk(dealShape, {
      quotes: [quote],
      money: { quotedTotal: totals.total, agreedTotal: totals.total, paid: null },
      handoff: {
        state: 'active', summary, crew, techSpec,
        schedule: Array.from({ length: 9 }, (_, i) => ({
          date: dateAhead(10 + i),
          dayType: i < 2 ? 'travel' : i < 4 ? 'build' : i < 8 ? 'shoot' : 'strike',
          label: `9:00–9:00 — Sierra Trucks (TBA — times to be adjusted)`,
        })),
        gates: { deposit: true, coi: false, agreementSent: true, firstInvoiceSent: true, w9Sent: true, rentalDueBeforePrelight: false },
        handoff: { creativeDeck: null, markIntro: true, kickoffCall: false, creativeReceived: false },
      },
    })
  }

  // 3 — BUDGET-FIRST, agreement, ZERO quotes (first-class path)
  {
    const days = { travel: 0, build: 1, shoot: 2, strike: 1 }
    await mk({
      clientCompany: 'Redline Studios', clientContact: 'Dana Kim',
      clientEmail: 'dana@redlinestudios.tv', clientPhone: '(213) 555-0189',
      projectName: 'Album Visuals', venue: 'tvc', mobileLocation: '',
      intakeMode: 'budget_first', assetClass: '2D', status: 'agreement',
      startDate: dateAhead(30), endDate: dateAhead(33), days,
      notes: [{ id: 'n1', text: 'Came in with $45k locked. Playback-only fits — said yes on the call. No quote doc; straight to rental agreement.', at: daysAgo(4), by: 'Brian' }],
      statusHistory: [
        { status: 'new', at: daysAgo(5) },
        { status: 'agreement', at: daysAgo(4) },
      ],
    }, {
      money: { agreedTotal: 45000 },
    })
  }

  // 4 — COMPARISON-BID: two variants (2D playback 3-day vs 3D core 5-day)
  {
    const days2d = { travel: 0, build: 1, shoot: 3, strike: 1 }
    const days3d = { travel: 0, build: 1, shoot: 5, strike: 1 }
    const q2d = {
      title: '2D Playback — 3 shoot days', rateCardVersion: 1, venue: 'tvc', days: days2d,
      lines: linesFor('tvc', days2d, ['playback_crew', 'bd_wall', 'bd_prep_strike', 'bd_server', 'bd_datacenter', 'bd_facility', 'bd_techviz', 'genlock'],
        { genlock: { x: 1, qty: 1, spec: { value: '30' } } }),
      discount: null, status: 'sent', issuedAt: dateAgo(2), sentAt: daysAgo(2),
    }
    const q3d = {
      title: '3D Core — 5 shoot days', rateCardVersion: 1, venue: 'tvc', days: days3d,
      lines: linesFor('tvc', days3d, ['core_crew', 'bd_wall', 'bd_prep_strike', 'bd_tracking', 'bd_server', 'bd_datacenter', 'bd_facility', 'bd_techviz', 'genlock'],
        { genlock: { x: 1, qty: 1, spec: { value: '30' } } }),
      discount: null, status: 'draft', issuedAt: dateAgo(2), sentAt: null,
    }
    const totals2d = computeTotals(card, q2d)
    await mk({
      clientCompany: 'Vista Post', clientContact: 'Elliot Marsh',
      clientEmail: 'elliot@vistapost.la', clientPhone: '(818) 555-0103',
      projectName: 'Docu Reshoots', venue: 'tvc', mobileLocation: '',
      intakeMode: 'comparison_bid', assetClass: '2D', status: 'quote_sent',
      startDate: dateAhead(45), endDate: null, days: days2d,
      notes: [{ id: 'n1', text: 'Deciding between playback-only vs full 3D. Sent the 2D number first; 3D variant ready if they upgrade.', at: daysAgo(2), by: 'Brian' }],
      statusHistory: [
        { status: 'new', at: daysAgo(8) },
        { status: 'quote_sent', at: daysAgo(2) },
      ],
    }, {
      quotes: [q2d, q3d],
      money: { quotedTotal: totals2d.total },
    })
  }

  // 5 — DEAD, with lost reason + an EXPIRED quote (issued 4 months ago)
  {
    const days = { travel: 1, build: 1, shoot: 2, strike: 1 }
    const quote = {
      title: 'Quote', rateCardVersion: 1, venue: 'mobile', days,
      lines: linesFor('mobile', days, ['hercules', 'vps_loadin', 'vps_shoot', 'vps_wrap', 'transport_intrastate']),
      discount: { mode: 'percent', value: 10, label: 'First-Time Client', reason: 'Try to win the account', display: 'subtract' },
      status: 'sent', issuedAt: dateAgo(120), sentAt: daysAgo(120),
    }
    const totals = computeTotals(card, quote)
    await mk({
      clientCompany: 'Northstar Beverage', clientContact: 'Priya Natarajan',
      clientEmail: 'priya.n@northstarbev.com', clientPhone: '(415) 555-0122',
      projectName: 'Winter Campaign', venue: 'mobile', mobileLocation: 'Vasquez Rocks',
      intakeMode: 'standard', assetClass: '2D', status: 'dead',
      lostReason: 'Went with a greenscreen house on price',
      startDate: null, endDate: null, days,
      notes: [{ id: 'n1', text: 'Agency ghosted after the follow-up. Keep on the radar for spring.', at: daysAgo(95), by: 'Brian' }],
      statusHistory: [
        { status: 'new', at: daysAgo(125) },
        { status: 'quote_sent', at: daysAgo(120) },
        { status: 'dead', at: daysAgo(90) },
      ],
    }, {
      quotes: [quote],
      money: { quotedTotal: totals.total },
    })
  }

  // 6 — Repeat client (history payback demo): completed + PAID earlier job
  {
    const days = { travel: 0, build: 1, shoot: 2, strike: 1 }
    const quote = {
      title: 'Quote', rateCardVersion: 1, venue: 'tvc', days,
      lines: linesFor('tvc', days, ['playback_crew', 'bd_wall', 'bd_prep_strike', 'bd_server', 'bd_facility', 'genlock'],
        { genlock: { x: 1, qty: 1, spec: { value: '24' } } }),
      discount: { mode: 'percent', value: 8, label: 'Non-Precedential', reason: 'Budget squeeze on their side, one-time', display: 'subtract' },
      status: 'accepted', issuedAt: dateAgo(200), sentAt: daysAgo(200),
    }
    const totals = computeTotals(card, quote)
    await mk({
      clientCompany: 'Lumen Pictures', clientContact: 'Sofia Reyes',
      clientEmail: 'sofia@lumenpictures.com', clientPhone: '(310) 555-0142',
      projectName: 'Product Launch Film', venue: 'tvc', mobileLocation: '',
      intakeMode: 'standard', assetClass: '2D', status: 'green_light',
      startDate: dateAgo(170), endDate: dateAgo(166), days,
      notes: [{ id: 'n1', text: 'Wrapped clean. Paid net-30 on the dot. Good client.', at: daysAgo(140), by: 'Brian' }],
      statusHistory: [
        { status: 'new', at: daysAgo(210) },
        { status: 'quote_sent', at: daysAgo(200) },
        { status: 'agreement', at: daysAgo(190) },
        { status: 'green_light', at: daysAgo(180) },
      ],
    }, {
      quotes: [quote],
      money: { quotedTotal: totals.total, agreedTotal: totals.total - 3000, actualTotal: totals.total - 1200, paid: true },
    })
  }

  // 7 — Fresh intake from this morning (new, nothing else yet)
  {
    await mk({
      clientCompany: 'Meridian Films', clientContact: 'Jordan Cole',
      clientEmail: 'jordan@meridianfilms.co', clientPhone: '(323) 555-0166',
      projectName: 'Pilot Ep 101', venue: 'tvc', mobileLocation: '',
      intakeMode: 'standard', assetClass: '3D', status: 'new',
      startDate: dateAhead(60), endDate: null,
      days: { travel: 0, build: 2, shoot: 5, strike: 1 },
      notes: [{ id: 'n1', text: 'Inbound from the website. Called back within the hour — pilot for a streamer, wants a scout next week.', at: daysAgo(0), by: 'Brian' }],
      statusHistory: [{ status: 'new', at: daysAgo(0) }],
    })
  }
}
