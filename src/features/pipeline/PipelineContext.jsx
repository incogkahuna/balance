import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { useAuth } from '../../context/AuthContext.tsx'
import { useToast } from '../../context/ToastContext.jsx'
import { useApp } from '../../context/AppContext.jsx'
import { createProduction as createProductionFactory } from '../../data/models.js'
import {
  setPipelineMode, getPipelineMode, setLocalPipelineRole, probeRemotePipeline,
  isPipelineAdmin,
  listDeals as listDealsApi, createDeal as createDealApi,
  updateDeal as updateDealApi, deleteDeal as deleteDealApi,
  listDealMoney as listDealMoneyApi, upsertDealMoney as upsertDealMoneyApi,
  listQuotes as listQuotesApi, createQuote as createQuoteApi,
  updateQuote as updateQuoteApi, deleteQuote as deleteQuoteApi,
  listHandoffs as listHandoffsApi, createHandoff as createHandoffApi,
  updateHandoff as updateHandoffApi,
  listRateCards as listRateCardsApi, createRateCardVersion as createRateCardVersionApi,
  fetchMoneyAggregates,
  subscribeToPipeline,
} from '../../lib/data/pipeline.ts'
import { RATE_CARD_V1 } from './rateCardSeed.js'
import {
  computeTotals, deriveCrew, deriveTechSpec, deriveSummary,
  buildCalendarBlocks, impliedEndDate, dependencyViolations,
} from './quoteMath.js'

// ─────────────────────────────────────────────────────────────────────────────
// PipelineContext — the job-pipeline hub (deals → quotes → handoffs).
// Mounted inside AppProvider so triggers can spawn real Balance productions.
//
// Trigger hygiene (design law): automations ride Brian's own status click,
// produce artifacts for the RECEIVER (a populated production, calendar
// blocks), and never notify the actor about their own action.
// ─────────────────────────────────────────────────────────────────────────────

const PipelineContext = createContext(null)

// Mirrors pipeline_role_assignments in the migration — used for dev
// impersonation and as a client-side hint before the profiles column exists.
// brian@ = NITZKIN (Business Manager); brodriguez@ is a different Brian (crew).
const EMAIL_ROLES = {
  'brian@orbitalvs.com': 'admin_finance',
  'aj@orbitalvs.com': 'admin_exec',
  'dhorgan@orbitalvs.com': 'admin_exec',
  'mark@orbitalvs.com': 'production',
  'wilder@orbitalvs.com': 'admin_exec', // dev team — full access, money included
}

export const STATUS_ORDER = ['new', 'quote_sent', 'agreement', 'green_light']
export const STATUS_LABELS = {
  new: 'New Project',
  quote_sent: 'Quote Sent',
  agreement: 'Agreement',
  green_light: 'Green Light',
  dead: 'Dead',
}
export const STATUS_COLORS = {
  new: '#3b82f6',
  quote_sent: '#8b5cf6',
  agreement: '#eab308',   // YELLOW-LIT
  green_light: '#22c55e', // GREEN-LIT
  dead: '#52525b',
}

export const ROLE_LABELS = {
  admin_finance: 'Brian — Business Manager',
  admin_exec: 'AJ / Danny — Exec',
  production: 'Mark — Production',
  pipeline: 'Wilder — Pipeline',
}

const nowIso = () => new Date().toISOString()
const uid = () => (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`)

export function PipelineProvider({ children }) {
  const { profile } = useAuth()
  const { currentUser, addProduction, updateProduction, logActivity } = useApp()
  const toast = useToast()

  const [ready, setReady] = useState(false)
  const [deals, setDeals] = useState([])
  const [money, setMoney] = useState({})       // dealId → DealMoney (admin roles only)
  const [quotes, setQuotes] = useState([])     // admin roles only
  const [handoffs, setHandoffs] = useState([])
  const [rateCards, setRateCards] = useState([])
  const [remoteAggregates, setRemoteAggregates] = useState(null)

  // ── Role resolution ────────────────────────────────────────────────────────
  // Explicit profiles.pipeline_role (post-migration) → email map → Balance
  // admin fallback → legacy dev-impersonation ids (nitz/mark/wilder…).
  const pipelineRole = useMemo(() => {
    if (profile?.pipeline_role) return profile.pipeline_role
    const email = (currentUser?.email || profile?.email || '').toLowerCase()
    if (EMAIL_ROLES[email]) return EMAIL_ROLES[email]
    if (currentUser?.isDevImpersonation) {
      const byId = {
        nitz: 'admin_finance', aj: 'admin_exec', danny: 'admin_exec',
        mark: 'production', wilder: 'admin_exec',
      }
      return byId[currentUser.id] ?? null
    }
    const appRole = profile?.role || currentUser?.role
    if (appRole === 'admin') return 'admin_exec'
    return null
  }, [profile, currentUser])

  const isAdmin = isPipelineAdmin(pipelineRole)
  const canSeeMoney = isAdmin

  // Keep the data layer's local-mode scoping in sync with the resolved role.
  useEffect(() => { setLocalPipelineRole(pipelineRole) }, [pipelineRole])

  // ── Mode + hydration ───────────────────────────────────────────────────────
  const hydrate = useCallback(async () => {
    const [dealRows, moneyMap, quoteRows, handoffRows, cardRows] = await Promise.all([
      listDealsApi().catch(() => []),
      listDealMoneyApi().catch(() => ({})),
      listQuotesApi().catch(() => []),
      listHandoffsApi().catch(() => []),
      listRateCardsApi().catch(() => []),
    ])
    setDeals(dealRows)
    setMoney(moneyMap)
    setQuotes(quoteRows)
    setHandoffs(handoffRows)
    setRateCards(cardRows)
    return cardRows
  }, [])

  useEffect(() => {
    if (!currentUser || !pipelineRole) { setReady(false); return }
    let cancelled = false
    let unsub = () => {}

    ;(async () => {
      // Real session → probe the tables; dev bypass / missing tables → local.
      const remoteOk = profile?.id ? await probeRemotePipeline() : false
      if (cancelled) return
      setPipelineMode(remoteOk ? 'remote' : 'local')

      let cards = await hydrate()
      if (cancelled) return

      // Seed rate card v1 if the store is empty (admin roles only — the rate
      // card is money). Non-admins simply have no card, and they have no UI
      // that needs one.
      if (cards.length === 0 && isPipelineAdmin(pipelineRole)) {
        try {
          await createRateCardVersionApi(RATE_CARD_V1, RATE_CARD_V1.label, profile?.id ?? null)
          cards = await listRateCardsApi()
          if (!cancelled) setRateCards(cards)
        } catch (err) {
          console.warn('[Pipeline] rate card seed failed:', err?.message || err)
        }
      }

      if (remoteOk) {
        setRemoteAggregates(await fetchMoneyAggregates().catch(() => null))
        unsub = subscribeToPipeline((event) => {
          const apply = (setter) => setter((prev) => {
            if (event.type === 'DELETE') return prev.filter((x) => x.id !== event.id)
            const exists = prev.some((x) => x.id === event.row.id)
            return exists
              ? prev.map((x) => (x.id === event.row.id ? event.row : x))
              : [event.row, ...prev]
          })
          if (event.table === 'deals') apply(setDeals)
          else if (event.table === 'quotes') apply(setQuotes)
          else if (event.table === 'handoffs') apply(setHandoffs)
          else if (event.table === 'money') {
            setMoney((prev) => {
              if (event.type === 'DELETE') {
                const next = { ...prev }; delete next[event.id]; return next
              }
              return { ...prev, [event.row.dealId]: event.row }
            })
          }
        })
      }
      if (!cancelled) setReady(true)
    })()

    return () => { cancelled = true; unsub() }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser?.id, pipelineRole, profile?.id])

  const currentRateCard = useMemo(
    () => (rateCards.length ? rateCards[rateCards.length - 1] : null),
    [rateCards],
  )
  const rateCardByVersion = useCallback(
    (version) => rateCards.find((c) => c.version === version)?.data
      || currentRateCard?.data
      || RATE_CARD_V1,
    [rateCards, currentRateCard],
  )

  // Refs for CRUD callbacks (mirror AppContext's pattern).
  const dealsRef = useRef(deals)
  useEffect(() => { dealsRef.current = deals }, [deals])
  const quotesRef = useRef(quotes)
  useEffect(() => { quotesRef.current = quotes }, [quotes])
  const handoffsRef = useRef(handoffs)
  useEffect(() => { handoffsRef.current = handoffs }, [handoffs])

  // ── Deal CRUD ──────────────────────────────────────────────────────────────
  const addDeal = useCallback(async (input) => {
    const deal = {
      id: uid(),
      status: 'new',
      statusHistory: [{ status: 'new', at: nowIso() }],
      notes: [],
      createdBy: profile?.id ?? null,
      createdAt: nowIso(),
      updatedAt: nowIso(),
      productionId: null,
      lostReason: '',
      ...input,
    }
    setDeals((prev) => [deal, ...prev])
    try {
      const created = await createDealApi(deal)
      logActivity('created', 'production', {
        id: created.id, label: `Deal: ${created.projectName}`, meta: { pipeline: true },
      })
      return created
    } catch (err) {
      console.error('[Pipeline] createDeal failed:', err)
      toast.error(`Couldn't create deal — ${err?.message || 'unknown error'}`)
      setDeals((prev) => prev.filter((d) => d.id !== deal.id))
      return null
    }
  }, [profile, toast, logActivity])

  const patchDeal = useCallback((id, patch) => {
    let prevDeal = dealsRef.current.find((d) => d.id === id) || null
    setDeals((prev) => prev.map((d) => {
      if (d.id !== id) return d
      prevDeal = d
      return { ...d, ...patch, updatedAt: nowIso() }
    }))
    updateDealApi(id, patch).catch((err) => {
      console.error('[Pipeline] updateDeal failed:', err)
      toast.error(`Couldn't save deal — ${err?.message || 'unknown error'}`)
      if (prevDeal) setDeals((prev) => prev.map((d) => (d.id === id ? prevDeal : d)))
    })
  }, [toast])

  const removeDeal = useCallback((id) => {
    const prev = dealsRef.current.find((d) => d.id === id)
    setDeals((p) => p.filter((d) => d.id !== id))
    setQuotes((p) => p.filter((q) => q.dealId !== id))
    setHandoffs((p) => p.filter((h) => h.dealId !== id))
    deleteDealApi(id)
      .then(() => logActivity('deleted', 'production', {
        id, label: `Deal: ${prev?.projectName || ''}`, meta: { pipeline: true },
      }))
      .catch((err) => {
        console.error('[Pipeline] deleteDeal failed:', err)
        toast.error(`Couldn't delete deal — ${err?.message || 'unknown error'}. Refresh to restore.`)
      })
  }, [toast, logActivity])

  const addDealNote = useCallback((dealId, text) => {
    const deal = dealsRef.current.find((d) => d.id === dealId)
    if (!deal || !text.trim()) return
    const note = { id: uid(), text: text.trim(), at: nowIso(), by: currentUser?.name || '' }
    patchDeal(dealId, { notes: [note, ...(deal.notes || [])] })
  }, [patchDeal, currentUser])

  // ── Money (admin only) ─────────────────────────────────────────────────────
  const setDealMoney = useCallback((dealId, patch) => {
    setMoney((prev) => ({
      ...prev,
      [dealId]: {
        dealId,
        quotedTotal: null, agreedTotal: null, actualTotal: null, paid: null,
        ...(prev[dealId] || {}),
        ...patch,
      },
    }))
    upsertDealMoneyApi(dealId, patch).catch((err) => {
      console.error('[Pipeline] upsertDealMoney failed:', err)
      toast.error(`Couldn't save numbers — ${err?.message || 'unknown error'}`)
    })
  }, [toast])

  // ── Quotes (admin only) ────────────────────────────────────────────────────
  const addQuote = useCallback(async (deal, title) => {
    const quote = {
      id: uid(),
      dealId: deal.id,
      title: title || 'Quote',
      rateCardVersion: currentRateCard?.version || 1,
      venue: deal.venue,
      days: { ...(deal.days || { travel: 0, build: 0, shoot: 0, strike: 0 }) },
      lines: {},
      discount: null,
      status: 'draft',
      issuedAt: nowIso().slice(0, 10),
      sentAt: null,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    }
    setQuotes((prev) => [...prev, quote])
    try {
      return await createQuoteApi(quote)
    } catch (err) {
      console.error('[Pipeline] createQuote failed:', err)
      toast.error(`Couldn't create quote — ${err?.message || 'unknown error'}`)
      setQuotes((prev) => prev.filter((q) => q.id !== quote.id))
      return null
    }
  }, [currentRateCard, toast])

  // `patch` may be an object OR a function (prevQuote) => partial. The
  // functional form composes correctly when several updates land in the same
  // tick (fast toggling in the quote builder) — each one computes against the
  // truly-latest state inside React's updater queue, then persists.
  const patchQuote = useCallback((id, patch) => {
    let prevQuote = null
    let applied = null
    setQuotes((prev) => prev.map((q) => {
      if (q.id !== id) return q
      prevQuote = q
      applied = typeof patch === 'function' ? patch(q) : patch
      return { ...q, ...applied, updatedAt: nowIso() }
    }))
    // React 18 runs the updater synchronously enough for our purposes in
    // event handlers; guard anyway for the exotic paths.
    queueMicrotask(() => {
      if (!applied) return
      updateQuoteApi(id, applied).catch((err) => {
        console.error('[Pipeline] updateQuote failed:', err)
        toast.error(`Couldn't save quote — ${err?.message || 'unknown error'}`)
        if (prevQuote) setQuotes((prev) => prev.map((q) => (q.id === id ? prevQuote : q)))
      })
    })
  }, [toast])

  const removeQuote = useCallback((id) => {
    setQuotes((prev) => prev.filter((q) => q.id !== id))
    deleteQuoteApi(id).catch((err) => {
      console.error('[Pipeline] deleteQuote failed:', err)
      toast.error(`Couldn't delete quote — ${err?.message || 'unknown error'}`)
    })
  }, [toast])

  // Mark a quote sent: dependency violations make this impossible (the rule —
  // Brian must never ship Shutter-Lock without Genlock). Also rolls the
  // quoted total onto the deal's money record and advances a `new` deal.
  const markQuoteSent = useCallback((quote) => {
    const card = rateCardByVersion(quote.rateCardVersion)
    const violations = dependencyViolations(card, quote)
    if (violations.length) {
      toast.error(`Can't send: ${violations[0].message}`)
      return false
    }
    patchQuote(quote.id, { status: 'sent', sentAt: nowIso(), issuedAt: nowIso().slice(0, 10) })
    const totals = computeTotals(card, quote)
    setDealMoney(quote.dealId, { quotedTotal: totals.total })
    const deal = dealsRef.current.find((d) => d.id === quote.dealId)
    if (deal && deal.status === 'new') setDealStatusRef.current(deal.id, 'quote_sent')
    return true
  }, [rateCardByVersion, patchQuote, setDealMoney, toast])

  const markQuoteAccepted = useCallback((quote) => {
    patchQuote(quote.id, { status: 'accepted' })
    // Comparison-bid: sibling sent quotes become superseded.
    for (const q of quotesRef.current) {
      if (q.dealId === quote.dealId && q.id !== quote.id && q.status === 'sent') {
        patchQuote(q.id, { status: 'superseded' })
      }
    }
  }, [patchQuote])

  // ── Handoffs ───────────────────────────────────────────────────────────────
  const patchHandoff = useCallback((id, patch) => {
    let prevH = handoffsRef.current.find((h) => h.id === id) || null
    setHandoffs((prev) => prev.map((h) => {
      if (h.id !== id) return h
      prevH = h
      return { ...h, ...patch, updatedAt: nowIso() }
    }))
    updateHandoffApi(id, patch).catch((err) => {
      console.error('[Pipeline] updateHandoff failed:', err)
      toast.error(`Couldn't save handoff — ${err?.message || 'unknown error'}`)
      if (prevH) setHandoffs((prev) => prev.map((h) => (h.id === id ? prevH : h)))
    })
  }, [toast])

  // ── AUTO-TRIGGERS — ride the status change, produce artifacts, no pings ────

  // The quote a handoff derives from: accepted > sent > newest draft > none.
  const bestQuoteForDeal = useCallback((dealId) => {
    const list = quotesRef.current.filter((q) => q.dealId === dealId)
    return list.find((q) => q.status === 'accepted')
      || list.find((q) => q.status === 'sent')
      || list[list.length - 1]
      || null
  }, [])

  // Yellow-lit: spawn the linked production record in `pending`, populated
  // entirely from the deal/quote — nothing re-typed.
  const spawnHandoff = useCallback(async (deal) => {
    if (handoffsRef.current.some((h) => h.dealId === deal.id)) return null
    const quote = bestQuoteForDeal(deal.id)
    const card = rateCardByVersion(quote?.rateCardVersion || currentRateCard?.version || 1)
    const crew = quote ? deriveCrew(card, quote) : []
    const techSpec = quote ? deriveTechSpec(card, quote, deal) : { assetClass: deal.assetClass || '', wallConfig: [], flags: [] }
    const summary = deriveSummary(deal, crew, techSpec)

    // The linked production is a REAL Balance production: draft (= pending)
    // until green light, so it shows for Mark's planning without noise.
    const endDate = deal.endDate || impliedEndDate(deal.startDate, deal.days)
    const production = createProductionFactory({
      name: deal.projectName,
      client: deal.clientCompany,
      kind: 'production',
      locationType: deal.venue === 'mobile' ? 'Mobile' : 'In-House (Orbital Studios)',
      locationAddress: deal.venue === 'mobile' ? (deal.mobileLocation || '') : '',
      productionType: techSpec.wallConfig?.[0] || (deal.venue === 'mobile' ? 'Orbital Hercules' : 'Big Dipper'),
      status: 'Incoming',
      startDate: deal.startDate || '',
      endDate: endDate || '',
      published: false,
      createdBy: profile?.id || '',
      instructionPackage: { files: [], voiceMemos: [], notes: summary },
    })
    // Await the production COMMIT before inserting the handoff. The handoff
    // (and the deal's production_id) have FKs to productions; in remote mode
    // the inserts are async, so firing them together races the handoff ahead
    // of its production row → "violates foreign key constraint". If the
    // production insert fails (e.g. a non-admin Balance role can't insert
    // productions under RLS), degrade gracefully: still create the handoff so
    // the deal progresses and Mark keeps the summary/crew/gates, just without
    // the production link.
    const createdProduction = await addProduction(production)
    const productionId = createdProduction ? production.id : null

    const handoff = {
      id: uid(),
      dealId: deal.id,
      productionId,
      state: 'pending',
      summary,
      crew,
      techSpec,
      schedule: [],
      gates: {
        deposit: false, coi: false, agreementSent: false,
        firstInvoiceSent: false, w9Sent: false, rentalDueBeforePrelight: false,
      },
      handoff: { creativeDeck: null, markIntro: false, kickoffCall: false, creativeReceived: false },
      createdAt: nowIso(),
      updatedAt: nowIso(),
    }
    setHandoffs((prev) => [...prev, handoff])
    try {
      await createHandoffApi(handoff)
    } catch (err) {
      console.error('[Pipeline] createHandoff failed:', err)
      toast.error(`Couldn't create the production handoff — ${err?.message || 'unknown error'}`)
      // Roll back the optimistic handoff so it doesn't linger as a phantom.
      setHandoffs((prev) => prev.filter((h) => h.id !== handoff.id))
      return null
    }
    // Link the deal to its production only once the row is known to exist —
    // pipeline_deals.production_id also FKs productions.
    if (productionId) patchDeal(deal.id, { productionId })
    return handoff
  }, [bestQuoteForDeal, rateCardByVersion, currentRateCard, addProduction, patchDeal, profile, toast])

  // Green-lit: production goes active + full-day calendar holds + gate
  // checklist live. (Deposit + COI hard-gate the tech scout.)
  const activateHandoff = useCallback((deal, handoff) => {
    const blocks = buildCalendarBlocks(deal)
    patchHandoff(handoff.id, { state: 'active', schedule: blocks })
    if (handoff.productionId) {
      const endDate = deal.endDate || impliedEndDate(deal.startDate, deal.days)
      updateProduction(handoff.productionId, {
        published: true,
        startDate: deal.startDate || '',
        endDate: endDate || '',
        dateRanges: deal.startDate && endDate ? [{ start: deal.startDate, end: endDate }] : [],
      })
    }
  }, [patchHandoff, updateProduction])

  const setDealStatus = useCallback(async (dealId, status, extra = {}) => {
    const deal = dealsRef.current.find((d) => d.id === dealId)
    if (!deal || deal.status === status) return
    const historyEntry = { status, at: nowIso() }
    patchDeal(dealId, {
      status,
      statusHistory: [...(deal.statusHistory || []), historyEntry],
      ...(status === 'dead' ? { lostReason: extra.lostReason || '' } : {}),
    })
    logActivity('status_changed', 'production', {
      id: dealId, label: `Deal: ${deal.projectName}`,
      meta: { pipeline: true, from: deal.status, to: status },
    })

    const updatedDeal = { ...deal, status }
    // Yellow-lit (and any jump past it) spawns the pending production.
    if (status === 'agreement' || status === 'green_light') {
      let handoff = handoffsRef.current.find((h) => h.dealId === dealId)
      if (!handoff) handoff = await spawnHandoff(updatedDeal)
      if (status === 'green_light' && handoff && handoff.state !== 'active') {
        activateHandoff(updatedDeal, handoff)
      }
    }
  }, [patchDeal, logActivity, spawnHandoff, activateHandoff])

  // markQuoteSent needs setDealStatus before it's defined — ref indirection.
  const setDealStatusRef = useRef(() => {})
  useEffect(() => { setDealStatusRef.current = setDealStatus }, [setDealStatus])

  // ── Rate card admin ────────────────────────────────────────────────────────
  const publishRateCardVersion = useCallback(async (data, label) => {
    try {
      const card = await createRateCardVersionApi(data, label, profile?.id ?? null)
      setRateCards((prev) => [...prev, card])
      toast.success(`Rate card v${card.version} published`)
      return card
    } catch (err) {
      console.error('[Pipeline] publishRateCard failed:', err)
      toast.error(`Couldn't publish rate card — ${err?.message || 'unknown error'}`)
      return null
    }
  }, [profile, toast])

  const value = {
    ready,
    mode: getPipelineMode(),
    pipelineRole,
    isAdmin,
    canSeeMoney,
    deals,
    money,
    quotes,
    handoffs,
    rateCards,
    currentRateCard,
    rateCardByVersion,
    remoteAggregates,
    addDeal,
    patchDeal,
    removeDeal,
    addDealNote,
    setDealStatus,
    setDealMoney,
    addQuote,
    patchQuote,
    removeQuote,
    markQuoteSent,
    markQuoteAccepted,
    patchHandoff,
    publishRateCardVersion,
    refresh: hydrate,
  }

  return <PipelineContext.Provider value={value}>{children}</PipelineContext.Provider>
}

export function usePipeline() {
  const ctx = useContext(PipelineContext)
  if (!ctx) throw new Error('usePipeline must be used within PipelineProvider')
  return ctx
}
