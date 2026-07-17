import { createContext, useContext, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { USERS, LED_WALLS_SEED, createWallAssignment, ROLES, computeDateDrivenStatus, PRODUCTION_STATUS_RANK } from '../data/models.js'
import { FEEDBACK_STATUS } from '../data/models.js'
import { useAuth } from './AuthContext.tsx'
import { useToast } from './ToastContext.jsx'
import {
  listProductions as listProductionsApi,
  createProduction as createProductionApi,
  updateProduction as updateProductionApi,
  deleteProduction as deleteProductionApi,
  subscribeToProductions,
} from '../lib/data/productions.ts'
import {
  listTasks as listTasksApi,
  createTask as createTaskApi,
  updateTask as updateTaskApi,
  deleteTask as deleteTaskApi,
  createComment as createCommentApi,
  subscribeToTasks,
  subscribeToComments,
} from '../lib/data/tasks.ts'
import {
  listContractors as listContractorsApi,
  createContractor as createContractorApi,
  updateContractor as updateContractorApi,
  deleteContractor as deleteContractorApi,
  subscribeToContractors,
} from '../lib/data/contractors.ts'
import { listProfiles as listProfilesApi } from '../lib/data/profiles.ts'
import { recordActivity } from '../lib/data/activity.ts'

const AppContext = createContext(null)

const DEV_VIEW_AS_KEY = 'balance_dev_view_as'

export function AppProvider({ children }) {
  const { profile, signOut } = useAuth()
  const toast = useToast()

  // All entities now live in Postgres. State hydrates on session start and
  // stays in sync via realtime subscriptions.
  const [productions, setProductionsState]   = useState([])
  const [productionsLoading, setProductionsLoading] = useState(true)
  const [productionsError, setProductionsError]     = useState(null)

  const [tasks, setTasksState]               = useState([])
  const [tasksLoading, setTasksLoading]      = useState(true)
  const [tasksError, setTasksError]          = useState(null)

  const [contractors, setContractorsState]           = useState([])
  const [contractorsLoading, setContractorsLoading]  = useState(true)
  const [contractorsError, setContractorsError]      = useState(null)

  // Auth-UUID roster (profiles table). Read-only; used to resolve changed_by /
  // author_id UUIDs to display names. Loaded once per session — the roster is
  // tiny and changes rarely.
  const [profilesList, setProfilesList] = useState([])

  // ─── LED Walls ─────────────────────────────────────────────────────────────
  // v1 is localStorage-backed (no Supabase table yet). Seeded with three
  // demo walls on first load so the /gear page isn't empty out of the box.
  // When Danny is happy with the data model, port to a Postgres table with
  // RLS + realtime in the same shape as productions/tasks.
  const LED_WALLS_KEY = 'balance_led_walls_v1'
  const [ledWalls, setLedWallsState] = useState(() => {
    if (typeof window === 'undefined') return LED_WALLS_SEED
    try {
      const raw = window.localStorage.getItem(LED_WALLS_KEY)
      if (!raw) return LED_WALLS_SEED
      const parsed = JSON.parse(raw)
      return Array.isArray(parsed) ? parsed : LED_WALLS_SEED
    } catch { return LED_WALLS_SEED }
  })
  // Persist on every change. Cheap (small data) and survives refresh.
  useEffect(() => {
    try {
      window.localStorage.setItem(LED_WALLS_KEY, JSON.stringify(ledWalls))
    } catch { /* quota / private mode — ignore */ }
  }, [ledWalls])

  // ─── To-Dos (merged into tasks in M2) ───────────────────────────────────────
  // To-dos are now tasks with productionId null. The only thing left here is
  // the one-time import of any pre-merge localStorage records — see the
  // effect after the tasks hydration block.
  const TODOS_KEY = 'balance_todos_v1'

  // ─── Feedback items (Bugs & Ideas) ──────────────────────────────────────────
  // Same localStorage-backed pattern as LED walls; port to Supabase when
  // the data model proves stable.
  const FEEDBACK_KEY = 'balance_feedback_v1'
  const [feedbackItems, setFeedbackItemsState] = useState(() => {
    if (typeof window === 'undefined') return []
    try {
      const raw = window.localStorage.getItem(FEEDBACK_KEY)
      if (!raw) return []
      const parsed = JSON.parse(raw)
      return Array.isArray(parsed) ? parsed : []
    } catch { return [] }
  })
  useEffect(() => {
    try {
      window.localStorage.setItem(FEEDBACK_KEY, JSON.stringify(feedbackItems))
    } catch { /* noop */ }
  }, [feedbackItems])

  // ─── Dev profile switcher ──────────────────────────────────────────────────
  // In dev only, allows overriding `currentUser` to any of the five known
  // legacy users to test role-gated UI. Stored in localStorage so it survives
  // refreshes. Reads as null in production builds.
  const [devViewAs, setDevViewAsState] = useState(() => {
    if (!import.meta.env.DEV) return null
    return localStorage.getItem(DEV_VIEW_AS_KEY) || null
  })

  const setDevViewAs = useCallback((userId) => {
    if (!import.meta.env.DEV) return
    if (userId) localStorage.setItem(DEV_VIEW_AS_KEY, userId)
    else localStorage.removeItem(DEV_VIEW_AS_KEY)
    setDevViewAsState(userId || null)
  }, [])

  // ─── Hydrate productions from Supabase + subscribe to realtime ─────────────
  // On session presence, pull all productions visible to this user (RLS filters
  // server-side) and subscribe to realtime change events so multi-browser
  // updates appear within ~500ms.
  useEffect(() => {
    if (!profile) {
      setProductionsState([])
      setProductionsLoading(false)
      return
    }

    let cancelled = false
    setProductionsLoading(true)
    setProductionsError(null)

    listProductionsApi()
      .then((rows) => {
        if (cancelled) return
        setProductionsState(rows)
        setProductionsLoading(false)
      })
      .catch((err) => {
        if (cancelled) return
        console.error('[AppContext] listProductions failed:', err)
        setProductionsError(err instanceof Error ? err.message : String(err))
        setProductionsLoading(false)
      })

    const unsubscribe = subscribeToProductions((event) => {
      setProductionsState((prev) => {
        if (event.type === 'INSERT') {
          if (prev.some((p) => p.id === event.row.id)) return prev
          return [event.row, ...prev]
        }
        if (event.type === 'UPDATE') {
          return prev.map((p) => (p.id === event.row.id ? event.row : p))
        }
        if (event.type === 'DELETE') {
          return prev.filter((p) => p.id !== event.id)
        }
        return prev
      })
    })

    return () => {
      cancelled = true
      unsubscribe()
    }
  }, [profile])

  // ─── Hydrate tasks from Supabase + subscribe to realtime ───────────────────
  useEffect(() => {
    if (!profile) {
      setTasksState([])
      setTasksLoading(false)
      return
    }

    let cancelled = false
    setTasksLoading(true)
    setTasksError(null)

    listTasksApi()
      .then((rows) => {
        if (cancelled) return
        setTasksState(rows)
        setTasksLoading(false)
      })
      .catch((err) => {
        if (cancelled) return
        console.error('[AppContext] listTasks failed:', err)
        setTasksError(err instanceof Error ? err.message : String(err))
        setTasksLoading(false)
      })

    const unsubTasks = subscribeToTasks((event) => {
      setTasksState((prev) => {
        if (event.type === 'INSERT') {
          if (prev.some((t) => t.id === event.row.id)) return prev
          // Preserve existing comments if we already had this task locally;
          // realtime INSERT only carries the row, not its comments.
          return [event.row, ...prev]
        }
        if (event.type === 'UPDATE') {
          return prev.map((t) =>
            t.id === event.row.id
              // Keep existing comments + status history — the realtime row
              // carries neither (they live in sibling tables).
              ? { ...event.row, comments: t.comments, statusHistory: t.statusHistory }
              : t,
          )
        }
        if (event.type === 'DELETE') {
          return prev.filter((t) => t.id !== event.id)
        }
        return prev
      })
    })

    const unsubComments = subscribeToComments((event) => {
      setTasksState((prev) =>
        prev.map((t) => {
          if (event.type === 'INSERT') {
            if (t.id !== event.row.taskId) return t
            // Dedupe — optimistic insert may have already added it
            if ((t.comments || []).some(c => c.id === event.row.id)) return t
            return { ...t, comments: [...(t.comments || []), event.row] }
          }
          if (event.type === 'DELETE') {
            if (t.id !== event.taskId) return t
            return { ...t, comments: (t.comments || []).filter(c => c.id !== event.id) }
          }
          return t
        }),
      )
    })

    return () => {
      cancelled = true
      unsubTasks()
      unsubComments()
    }
  }, [profile])

  // ─── One-time To-Dos import (M2) ────────────────────────────────────────────
  // Pre-merge to-dos lived in localStorage per browser. Once per session,
  // after tasks hydrate, push them into the tasks table as freestanding
  // tasks. Halts (and retries next session) if the M2 migration hasn't run
  // yet; the original list is kept as a _backup key after success.
  const todosImportRanRef = useRef(false)
  useEffect(() => {
    if (!profile || tasksLoading || todosImportRanRef.current) return
    todosImportRanRef.current = true
    let raw = null
    try { raw = window.localStorage.getItem(TODOS_KEY) } catch { return }
    if (!raw) return
    let old = []
    try { old = JSON.parse(raw) } catch { return }
    if (!Array.isArray(old) || old.length === 0) {
      try { window.localStorage.removeItem(TODOS_KEY) } catch { /* noop */ }
      return
    }
    ;(async () => {
      let imported = 0
      for (const t of old) {
        if (!t?.title || t.status === 'cancelled') continue
        try {
          const created = await createTaskApi({
            id: t.id,
            productionId: null,
            title: t.title,
            description: t.description || '',
            assigneeId: t.assigneeId || null,
            dueDate: t.dueDate || null,
            visibility: t.visibility === 'direct' ? 'personal' : 'team',
            status: t.status === 'done' ? 'Complete' : 'Not Started',
            createdBy: profile.id,
          })
          imported++
          setTasksState(prev => prev.some(x => x.id === created.id)
            ? prev
            : [{ ...created, comments: [], statusHistory: [] }, ...prev])
        } catch (err) {
          // 23505 = row already imported by a prior partial run — that's fine
          if (err?.code === '23505') { imported++; continue }
          console.warn('[AppContext] to-do import halted (will retry next session):', err?.message || err)
          return
        }
      }
      try {
        window.localStorage.setItem(`${TODOS_KEY}_backup`, raw)
        window.localStorage.removeItem(TODOS_KEY)
      } catch { /* noop */ }
      if (imported > 0) {
        toast.success(`Moved ${imported} to-do${imported === 1 ? '' : 's'} into the shared task system`)
      }
    })()
  }, [profile, tasksLoading, toast])

  // ─── Hydrate contractors from Supabase + subscribe to realtime ─────────────
  useEffect(() => {
    if (!profile) {
      setContractorsState([])
      setContractorsLoading(false)
      return
    }

    let cancelled = false
    setContractorsLoading(true)
    setContractorsError(null)

    listContractorsApi()
      .then((rows) => {
        if (cancelled) return
        setContractorsState(rows)
        setContractorsLoading(false)
      })
      .catch((err) => {
        if (cancelled) return
        // RLS rejects crew users on contractors — that's expected, not an error.
        if (err?.code !== 'PGRST301') {
          console.error('[AppContext] listContractors failed:', err)
          setContractorsError(err instanceof Error ? err.message : String(err))
        }
        setContractorsLoading(false)
      })

    const unsub = subscribeToContractors((event) => {
      setContractorsState((prev) => {
        if (event.type === 'INSERT') {
          if (prev.some((c) => c.id === event.row.id)) return prev
          return [event.row, ...prev].sort((a, b) => a.name.localeCompare(b.name))
        }
        if (event.type === 'UPDATE') {
          return prev.map((c) => (c.id === event.row.id ? event.row : c))
        }
        if (event.type === 'DELETE') {
          return prev.filter((c) => c.id !== event.id)
        }
        return prev
      })
    })

    return () => {
      cancelled = true
      unsub()
    }
  }, [profile])

  // ─── Hydrate profiles (auth-UUID roster) ───────────────────────────────────
  useEffect(() => {
    if (!profile) {
      setProfilesList([])
      return
    }
    let cancelled = false
    listProfilesApi()
      .then((rows) => { if (!cancelled) setProfilesList(rows) })
      .catch((err) => {
        // Non-fatal — name resolution just falls back to legacy USERS.
        console.warn('[AppContext] listProfiles failed:', err?.message || err)
      })
    return () => { cancelled = true }
  }, [profile])

  // Resolve any user identifier (auth UUID or legacy string id) to a display
  // name. Falls back through profiles → USERS → contractors → null.
  const resolveUserName = useCallback((id) => {
    if (!id) return null
    const p = profilesList.find(pr => pr.id === id)
    if (p) return p.name
    const u = USERS.find(us => us.id === id)
    if (u) return u.name
    const c = contractors.find(co => co.id === id)
    if (c) return c.name
    return null
  }, [profilesList, contractors])

  // ─── Activity logging (M1 / #12) ────────────────────────────────────────────
  // Append-only who-did-what trail feeding Analytics. Fire-and-forget: a
  // failed insert (RLS, missing table pre-migration, offline) must never
  // break the user action it rides on — it just doesn't get counted.
  // Refs mirror state so change-detection in the CRUD callbacks can read
  // previous values without adding state to their dependency arrays.
  const tasksRef = useRef(tasks)
  useEffect(() => { tasksRef.current = tasks }, [tasks])
  const productionsRef = useRef(productions)
  useEffect(() => { productionsRef.current = productions }, [productions])

  const profileRef = useRef(profile)
  useEffect(() => { profileRef.current = profile }, [profile])
  const currentUserNameRef = useRef('')

  const logActivity = useCallback((verb, entityType, { id, label, productionId, meta } = {}) => {
    const actor = profileRef.current
    if (!actor?.id) return // dev bypass / signed out — nothing to attribute
    recordActivity({
      actorId: actor.id,
      actorName: currentUserNameRef.current || actor.name || '',
      verb,
      entityType,
      entityId: id ? String(id) : '',
      entityLabel: label || '',
      productionId: productionId || null,
      meta: meta || {},
    }).catch((err) => {
      console.debug('[AppContext] activity log skipped:', err?.message || err)
    })
  }, [])

  // ─── mutateProduction — optimistic local + remote ──────────────────────────
  // All sub-entity mutations (addons, milestones, bible, etc) flow through
  // this helper. Computes the patch from the current production, applies it
  // optimistically to local state, then persists to Supabase. Realtime sub
  // will reconcile any drift.
  const mutateProduction = useCallback((productionId, patchFn) => {
    let patchToSend = null
    let prevProduction = null
    setProductionsState((prev) =>
      prev.map((p) => {
        if (p.id !== productionId) return p
        const patch = patchFn(p)
        patchToSend = patch
        prevProduction = p
        return { ...p, ...patch, updatedAt: new Date().toISOString() }
      }),
    )
    if (patchToSend) {
      updateProductionApi(productionId, patchToSend).catch((err) => {
        console.error('[AppContext] updateProduction failed:', err)
        toast.error(`Couldn't save production changes — ${err?.message || 'unknown error'}`)
        // Roll the optimistic edit back so the UI doesn't show a phantom save.
        if (prevProduction) {
          setProductionsState(prev => prev.map(p => p.id === productionId ? prevProduction : p))
        }
      })
    }
  }, [toast])

  // ─── currentUser ───────────────────────────────────────────────────────────
  // Derived from the Supabase profile. For the 5 known team members (Mark, AJ,
  // Danny, Brian, Wilder) we map back to their legacy 'mark'/'aj'/etc IDs so
  // the rest of the app — which still references those IDs in localStorage
  // sample data — keeps working unchanged. Phase 2 migrates that data to UUIDs.
  //
  // In dev, an override (set via the topbar "View as..." dropdown) takes
  // precedence over the real profile. This lets us inspect role-gated UI
  // without having to sign in as different users.
  const currentUser = useMemo(() => {
    if (devViewAs) {
      const overrideUser = USERS.find(u => u.id === devViewAs)
      if (overrideUser) {
        return {
          ...overrideUser,
          email: profile?.email || `${overrideUser.id}@dev.local`,
          profileId: profile?.id,
          isDevImpersonation: true,
        }
      }
    }
    if (!profile) return null
    // Match the signed-in profile to a legacy USERS entry so demo data
    // (tasks / milestones / etc. assigned to 'mark', 'danny', etc.)
    // surfaces correctly for the real user. Email is the stable anchor —
    // profile.name varies because Google might return "Daniel Horgan"
    // while the legacy id is "danny". Email is set at sign-up time and
    // doesn't drift.
    const profileEmail = profile.email?.toLowerCase()
    const profileName  = profile.name?.toLowerCase() || ''
    const legacy =
      USERS.find(u => u.email && u.email.toLowerCase() === profileEmail) ||
      USERS.find(u => u.name.toLowerCase() === profileName)
    if (legacy) {
      return {
        ...legacy,
        role: profile.role,
        email: profile.email,
        profileId: profile.id,
      }
    }
    return {
      id: profile.id,
      name: profile.name,
      role: profile.role,
      avatar: profile.name.charAt(0).toUpperCase(),
      color: profile.color,
      email: profile.email,
      profileId: profile.id,
    }
  }, [profile, devViewAs])

  // Keep the activity-log name ref in sync with the resolved display name.
  useEffect(() => { currentUserNameRef.current = currentUser?.name || '' }, [currentUser])

  // ─── Auth ──────────────────────────────────────────────────────────────────
  // Sign-in is handled directly via AuthContext.signInWithGoogle on LoginPage.
  // We keep `logout` exposed here for backwards compatibility with existing
  // Sidebar / TopBar consumers — it just delegates to the Supabase sign-out.
  const logout = useCallback(async () => {
    try { await signOut() } catch (e) { console.error('[AppContext] signOut failed', e) }
  }, [signOut])

  // ─── Productions CRUD ──────────────────────────────────────────────────────
  // All persistence flows through the typed data layer. Local state updates
  // optimistically, then realtime reconciles. RLS may reject the call
  // server-side (e.g. crew trying to insert) — we surface those as console
  // errors for now; UI-level error handling lands in a follow-up.
  const addProduction = useCallback((production) => {
    setProductionsState(prev => [production, ...prev])
    createProductionApi(production)
      .then(() => {
        logActivity('created', 'production', {
          id: production.id, label: production.name, productionId: production.id,
        })
      })
      .catch((err) => {
        console.error('[AppContext] createProduction failed:', err)
        toast.error(`Couldn't create production — ${err?.message || 'unknown error'}`)
        // Rollback optimistic insert
        setProductionsState(prev => prev.filter(p => p.id !== production.id))
      })
  }, [toast, logActivity])

  const updateProduction = useCallback((id, updates, opts = {}) => {
    let prevProduction = productionsRef.current.find(p => p.id === id) || null
    setProductionsState(prev => prev.map(p => {
      if (p.id !== id) return p
      prevProduction = p
      return { ...p, ...updates, updatedAt: new Date().toISOString() }
    }))
    updateProductionApi(id, updates)
      .then(() => {
        if (updates.status && prevProduction && updates.status !== prevProduction.status) {
          logActivity('status_changed', 'production', {
            id, label: prevProduction.name, productionId: id,
            meta: { from: prevProduction.status, to: updates.status, ...(opts.auto ? { auto: true } : {}) },
          })
        }
      })
      .catch((err) => {
        console.error('[AppContext] updateProduction failed:', err)
        toast.error(`Couldn't save production changes — ${err?.message || 'unknown error'}`)
        if (prevProduction) {
          setProductionsState(prev => prev.map(p => p.id === id ? prevProduction : p))
        }
      })
  }, [toast, logActivity])

  const deleteProduction = useCallback((id) => {
    const prev = productionsRef.current.find(p => p.id === id)
    setProductionsState(prev => prev.filter(p => p.id !== id))
    // Tasks cascade-delete server-side via the FK on production_id, but mirror
    // it locally for snappy UI.
    setTasksState(prev => prev.filter(t => t.productionId !== id))
    deleteProductionApi(id)
      .then(() => {
        logActivity('deleted', 'production', { id, label: prev?.name || '' })
      })
      .catch((err) => {
        console.error('[AppContext] deleteProduction failed:', err)
        toast.error(`Couldn't delete production — ${err?.message || 'unknown error'}. Refresh to restore the list.`)
      })
  }, [toast, logActivity])

  const getProduction = useCallback((id) => {
    return productions.find(p => p.id === id)
  }, [productions])

  // ─── Auto status by dates ──────────────────────────────────────────────────
  // Once per session after productions hydrate: promote any production whose
  // dates have moved past its stored status (Incoming → Active on start day,
  // → Wrap past the end date, → Completed 30 days after). Forward-only, so a
  // manually advanced status is never demoted. Admin/sup only — production
  // UPDATE is RLS-gated, so other roles would just generate failed writes.
  const autoStatusRanRef = useRef(false)
  useEffect(() => {
    if (productionsLoading || autoStatusRanRef.current) return
    const role = currentUser?.role
    if (role !== ROLES.ADMIN && role !== ROLES.SUPERVISOR) return
    if (productions.length === 0) return
    autoStatusRanRef.current = true
    for (const p of productions) {
      const target = computeDateDrivenStatus(p)
      if (!target || target === p.status) continue
      const forward =
        (PRODUCTION_STATUS_RANK[target] ?? -1) > (PRODUCTION_STATUS_RANK[p.status] ?? 99)
      if (forward) updateProduction(p.id, { status: target }, { auto: true })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productionsLoading, productions, currentUser])

  // ─── Tasks CRUD ────────────────────────────────────────────────────────────
  // Tasks live in Postgres. The productions.task_ids array is auto-maintained
  // by a database trigger (sync_production_task_ids), so we don't have to
  // mirror task membership on the production side anymore.
  const addTask = useCallback((task) => {
    // Ensure comments array exists for component compatibility
    const taskWithComments = { ...task, comments: task.comments || [], statusHistory: task.statusHistory || [] }
    setTasksState(prev => [taskWithComments, ...prev])
    createTaskApi(task)
      .then(() => {
        logActivity('created', 'task', {
          id: task.id, label: task.title || '', productionId: task.productionId || null,
        })
      })
      .catch((err) => {
        console.error('[AppContext] createTask failed:', err)
        // The eager-create placeholder is blank on purpose — only worth a toast
        // once the user typed something (updateTask covers the rest).
        if (task.title) toast.error(`Couldn't create task — ${err?.message || 'unknown error'}`)
        setTasksState(prev => prev.filter(t => t.id !== task.id))
      })
  }, [toast, logActivity])

  const updateTask = useCallback((id, updates) => {
    let prevTask = tasksRef.current.find(t => t.id === id) || null
    setTasksState(prev => prev.map(t => {
      if (t.id !== id) return t
      prevTask = t
      return { ...t, ...updates, updatedAt: new Date().toISOString() }
    }))
    updateTaskApi(id, updates)
      .then(() => {
        if (!prevTask) return
        const base = {
          id, label: updates.title ?? prevTask.title ?? '',
          productionId: prevTask.productionId || null,
        }
        if (updates.status && updates.status !== prevTask.status) {
          const done = updates.status === 'Complete' || updates.status === 'Verified'
          logActivity(done ? 'completed' : 'status_changed', 'task', {
            ...base, meta: { from: prevTask.status, to: updates.status },
          })
        }
        if ('assigneeId' in updates && updates.assigneeId && updates.assigneeId !== prevTask.assigneeId) {
          logActivity('assigned', 'task', {
            ...base,
            meta: { assigneeId: updates.assigneeId, assigneeName: resolveUserName(updates.assigneeId) || '' },
          })
        }
      })
      .catch((err) => {
        console.error('[AppContext] updateTask failed:', err)
        toast.error(`Couldn't save task changes — ${err?.message || 'unknown error'}`)
        if (prevTask) {
          setTasksState(prev => prev.map(t => t.id === id ? prevTask : t))
        }
      })
  }, [toast, logActivity, resolveUserName])

  const deleteTask = useCallback((id) => {
    const prev = tasksRef.current.find(t => t.id === id)
    setTasksState(prev => prev.filter(t => t.id !== id))
    deleteTaskApi(id)
      .then(() => {
        logActivity('deleted', 'task', {
          id, label: prev?.title || '', productionId: prev?.productionId || null,
        })
      })
      .catch((err) => {
        console.error('[AppContext] deleteTask failed:', err)
        toast.error(`Couldn't delete task — ${err?.message || 'unknown error'}. Refresh to restore the list.`)
      })
  }, [toast, logActivity])

  const getTasksForProduction = useCallback((productionId) => {
    return tasks.filter(t => t.productionId === productionId)
  }, [tasks])

  const getTasksForUser = useCallback((userId) => {
    return tasks.filter(t => t.assigneeId === userId)
  }, [tasks])

  const addComment = useCallback((taskId, comment) => {
    // Optimistic insert — carries the same fields we persist, so the comment
    // renders identically before and after the realtime echo.
    const optimistic = {
      id: comment.id || crypto.randomUUID(),
      taskId,
      authorId: comment.authorId || profile?.id || null,
      authorName: comment.authorName || profile?.name || '',
      text: comment.text || comment.body || '',
      photoStoragePath: comment.photoStoragePath || null,
      photoName: comment.photoName || null,
      createdAt: comment.createdAt || new Date().toISOString(),
    }
    setTasksState(prev => prev.map(t =>
      t.id === taskId
        ? { ...t, comments: [...(t.comments || []), optimistic], updatedAt: new Date().toISOString() }
        : t
    ))
    // Persist — author MUST be the real authenticated user (profile.id) per RLS,
    // not the dev impersonation id.
    if (profile?.id) {
      createCommentApi(taskId, profile.id, {
        text: optimistic.text,
        authorName: optimistic.authorName,
        photoStoragePath: optimistic.photoStoragePath,
        photoName: optimistic.photoName,
      }).then(() => {
        const task = tasksRef.current.find(t => t.id === taskId)
        logActivity('commented', 'task', {
          id: taskId, label: task?.title || '', productionId: task?.productionId || null,
        })
      }).catch((err) => {
        console.error('[AppContext] createComment failed:', err)
        toast.error(`Comment didn't send — ${err?.message || 'unknown error'}`)
        // Rollback
        setTasksState(prev => prev.map(t =>
          t.id === taskId
            ? { ...t, comments: (t.comments || []).filter(c => c.id !== optimistic.id) }
            : t
        ))
      })
    }
  }, [profile, toast, logActivity])

  // ─── Add-ons ───────────────────────────────────────────────────────────────
  const addAddon = useCallback((productionId, addon) => {
    mutateProduction(productionId, (p) => ({
      addons: [...(p.addons || []), addon],
    }))
  }, [mutateProduction])

  const updateAddon = useCallback((productionId, addonId, updates) => {
    mutateProduction(productionId, (p) => ({
      addons: (p.addons || []).map(a => a.id === addonId ? { ...a, ...updates } : a),
    }))
  }, [mutateProduction])

  const deleteAddon = useCallback((productionId, addonId) => {
    mutateProduction(productionId, (p) => ({
      addons: (p.addons || []).filter(a => a.id !== addonId),
    }))
  }, [mutateProduction])

  // ─── Feedback ──────────────────────────────────────────────────────────────
  const submitFeedback = useCallback((productionId, feedback) => {
    mutateProduction(productionId, () => ({ feedback }))
  }, [mutateProduction])

  // ─── Debrief quick notes (M4 / #6) — captured during production ────────────
  const addDebriefNote = useCallback((productionId, note) => {
    mutateProduction(productionId, (p) => ({
      debriefNotes: [...(p.debriefNotes || []), note],
    }))
  }, [mutateProduction])

  const deleteDebriefNote = useCallback((productionId, noteId) => {
    mutateProduction(productionId, (p) => ({
      debriefNotes: (p.debriefNotes || []).filter(n => n.id !== noteId),
    }))
  }, [mutateProduction])

  // ─── Contractors CRUD ─────────────────────────────────────────────────────
  const addContractor = useCallback((contractor) => {
    setContractorsState(prev => [contractor, ...prev])
    createContractorApi(contractor)
      .then(() => {
        logActivity('created', 'contractor', { id: contractor.id, label: contractor.name || '' })
      })
      .catch((err) => {
        console.error('[AppContext] createContractor failed:', err)
        if (contractor.name) toast.error(`Couldn't add contractor — ${err?.message || 'unknown error'}`)
        setContractorsState(prev => prev.filter(c => c.id !== contractor.id))
      })
  }, [toast, logActivity])

  const updateContractor = useCallback((id, updates) => {
    let prevContractor = null
    setContractorsState(prev => prev.map(c => {
      if (c.id !== id) return c
      prevContractor = c
      return { ...c, ...updates, updatedAt: new Date().toISOString() }
    }))
    updateContractorApi(id, updates).catch((err) => {
      console.error('[AppContext] updateContractor failed:', err)
      toast.error(`Couldn't save contractor changes — ${err?.message || 'unknown error'}`)
      if (prevContractor) {
        setContractorsState(prev => prev.map(c => c.id === id ? prevContractor : c))
      }
    })
  }, [toast])

  const deleteContractor = useCallback((id) => {
    setContractorsState(prev => prev.filter(c => c.id !== id))
    deleteContractorApi(id).catch((err) => {
      console.error('[AppContext] deleteContractor failed:', err)
      toast.error(`Couldn't delete contractor — ${err?.message || 'unknown error'}. Refresh to restore the list.`)
    })
  }, [toast])

  const getContractor = useCallback((id) => {
    return contractors.find(c => c.id === id) || null
  }, [contractors])

  // ─── Contractor assignment to productions ─────────────────────────────────
  const setStageManager = useCallback((productionId, contractorId) => {
    mutateProduction(productionId, () => ({ stageManagerId: contractorId }))
  }, [mutateProduction])

  const assignContractor = useCallback((productionId, assignment) => {
    mutateProduction(productionId, (p) => {
      const already = (p.assignedContractors || []).some(a => a.contractorId === assignment.contractorId)
      if (already) return {} // no-op patch
      return {
        assignedContractors: [...(p.assignedContractors || []), assignment],
      }
    })
  }, [mutateProduction])

  const removeContractor = useCallback((productionId, contractorId) => {
    mutateProduction(productionId, (p) => ({
      assignedContractors: (p.assignedContractors || []).filter(a => a.contractorId !== contractorId),
      stageManagerId: p.stageManagerId === contractorId ? null : p.stageManagerId,
    }))
  }, [mutateProduction])

  // Returns work history for a contractor by scanning all productions.
  // Checks assignedContractors, stageManagerId, and legacy assignedMembers.
  // Derived at read-time — no duplication of data.
  const getContractorHistory = useCallback((contractorId) => {
    return productions
      .filter(p =>
        p.stageManagerId === contractorId ||
        p.assignedContractors?.some(a => a.contractorId === contractorId) ||
        p.assignedMembers?.some(m => m.userId === contractorId)
      )
      .map(p => {
        const isStageManager = p.stageManagerId === contractorId
        const contractorAssignment = p.assignedContractors?.find(a => a.contractorId === contractorId)
        const member = p.assignedMembers?.find(m => m.userId === contractorId)
        return {
          productionId: p.id,
          productionName: p.name,
          client: p.client,
          roleOnProduction: isStageManager
            ? 'Stage Manager'
            : (contractorAssignment?.role || member?.roleOnProduction || ''),
          startDate: p.startDate,
          endDate: p.endDate,
          status: p.status,
          isStageManager,
        }
      })
      .sort((a, b) => new Date(b.startDate || 0) - new Date(a.startDate || 0))
  }, [productions])

  // Resolves any assignee ID to a display-ready object.
  // Checks USERS first, then contractors — backward compatible with existing data.
  const resolveAssignee = useCallback((userId) => {
    const user = USERS.find(u => u.id === userId)
    if (user) return { ...user, type: 'user' }
    const contractor = contractors.find(c => c.id === userId)
    if (contractor) return {
      id: contractor.id,
      name: contractor.name,
      avatar: contractor.name.charAt(0).toUpperCase(),
      color: '#64748b',
      role: contractor.primaryRole,
      availability: contractor.availability,
      photoUrl: contractor.photoUrl,
      type: 'contractor',
    }
    return null
  }, [contractors])

  // ─── Roadmap CRUD ─────────────────────────────────────────────────────────
  // All writes go through the production record's roadmap sub-object via the
  // mutateProduction helper, which persists to Supabase.

  const _updateRoadmap = useCallback((productionId, updater) => {
    mutateProduction(productionId, (p) => {
      const roadmap = p.roadmap || { milestones: [], logisticalConcerns: [] }
      return { roadmap: updater(roadmap) }
    })
  }, [mutateProduction])

  const addMilestone = useCallback((productionId, milestone) => {
    _updateRoadmap(productionId, r => ({
      ...r, milestones: [...(r.milestones || []), milestone],
    }))
    logActivity('created', 'milestone', {
      id: milestone.id,
      label: milestone.title || milestone.name || milestone.type || '',
      productionId,
      meta: milestone.type ? { type: milestone.type } : {},
    })
  }, [_updateRoadmap, logActivity])

  const updateMilestone = useCallback((productionId, milestoneId, updates) => {
    _updateRoadmap(productionId, r => ({
      ...r,
      milestones: (r.milestones || []).map(m =>
        m.id === milestoneId ? { ...m, ...updates, updatedAt: new Date().toISOString() } : m
      ),
    }))
  }, [_updateRoadmap])

  const deleteMilestone = useCallback((productionId, milestoneId) => {
    _updateRoadmap(productionId, r => ({
      ...r, milestones: (r.milestones || []).filter(m => m.id !== milestoneId),
    }))
  }, [_updateRoadmap])

  const addConcern = useCallback((productionId, concern) => {
    _updateRoadmap(productionId, r => ({
      ...r, logisticalConcerns: [...(r.logisticalConcerns || []), concern],
    }))
  }, [_updateRoadmap])

  const updateConcern = useCallback((productionId, concernId, updates) => {
    _updateRoadmap(productionId, r => ({
      ...r,
      logisticalConcerns: (r.logisticalConcerns || []).map(c =>
        c.id === concernId ? { ...c, ...updates, updatedAt: new Date().toISOString() } : c
      ),
    }))
  }, [_updateRoadmap])

  const deleteConcern = useCallback((productionId, concernId) => {
    _updateRoadmap(productionId, r => ({
      ...r, logisticalConcerns: (r.logisticalConcerns || []).filter(c => c.id !== concernId),
    }))
  }, [_updateRoadmap])

  // ─── Production Bible ──────────────────────────────────────────────────────
  const updateBible = useCallback((productionId, bible) => {
    mutateProduction(productionId, () => ({ bible }))
  }, [mutateProduction])

  // ─── Instruction Packages ──────────────────────────────────────────────────
  const updateInstructionPackage = useCallback((productionId, pkg) => {
    mutateProduction(productionId, () => ({ instructionPackage: pkg }))
  }, [mutateProduction])

  const updateTaskInstructionPackage = useCallback((taskId, pkg) => {
    setTasksState(prev => prev.map(t =>
      t.id === taskId ? { ...t, instructionPackage: pkg, updatedAt: new Date().toISOString() } : t
    ))
    updateTaskApi(taskId, { instructionPackage: pkg }).catch((err) => {
      console.error('[AppContext] updateTaskInstructionPackage failed:', err)
      toast.error(`Couldn't save instruction package — ${err?.message || 'unknown error'}`)
    })
  }, [toast])

  // ─── LED Walls — CRUD + assignment ─────────────────────────────────────────
  const addLedWall = useCallback((wall) => {
    setLedWallsState(prev => [...prev, wall])
  }, [])

  const updateLedWall = useCallback((id, patch) => {
    setLedWallsState(prev => prev.map(w =>
      w.id === id ? { ...w, ...patch, updatedAt: new Date().toISOString() } : w
    ))
  }, [])

  const deleteLedWall = useCallback((id) => {
    setLedWallsState(prev => prev.filter(w => w.id !== id))
  }, [])

  // Add an assignment to a wall (wall is committed to a production for a date range)
  const assignWall = useCallback((wallId, assignment) => {
    const a = createWallAssignment({
      ...assignment,
      createdBy: currentUser?.id || '',
    })
    setLedWallsState(prev => prev.map(w =>
      w.id === wallId
        ? { ...w, assignments: [...(w.assignments || []), a], updatedAt: new Date().toISOString() }
        : w
    ))
  }, [currentUser])

  const updateWallAssignment = useCallback((wallId, assignmentId, patch) => {
    setLedWallsState(prev => prev.map(w => {
      if (w.id !== wallId) return w
      return {
        ...w,
        assignments: (w.assignments || []).map(a =>
          a.id === assignmentId ? { ...a, ...patch } : a
        ),
        updatedAt: new Date().toISOString(),
      }
    }))
  }, [])

  const unassignWall = useCallback((wallId, assignmentId) => {
    setLedWallsState(prev => prev.map(w => {
      if (w.id !== wallId) return w
      return {
        ...w,
        assignments: (w.assignments || []).filter(a => a.id !== assignmentId),
        updatedAt: new Date().toISOString(),
      }
    }))
  }, [])

  // Production form auto-sync: when a user picks a wall (or changes the
  // picked wall / clears it / edits dates) on a production, sync the wall
  // assignments so the gear database stays in lockstep — no more two-step
  // 'create production then go to /gear to book the wall' dance.
  //
  // Behaviour:
  //  - Removes any prior assignment on OTHER walls that pointed to this
  //    production (handles the wall-switch case)
  //  - On the target wall, ensures exactly one assignment for this
  //    production with the current dates (creates or updates in place)
  //  - If wallId is null/empty, just cleans up prior assignments
  const syncProductionWallAssignment = useCallback((productionId, wallId, startDate, endDate) => {
    if (!productionId) return
    setLedWallsState(prev => prev.map(w => {
      const existing  = w.assignments || []
      const otherAss  = existing.filter(a => a.productionId !== productionId)
      const myExisting = existing.find(a => a.productionId === productionId)

      // Wall is NOT the target — strip any auto-linked assignment we'd
      // previously planted here.
      if (w.id !== wallId) {
        if (otherAss.length === existing.length) return w
        return { ...w, assignments: otherAss, updatedAt: new Date().toISOString() }
      }

      // Wall IS the target. Ensure one assignment with current dates.
      // No dates yet → can't meaningfully assign; leave any existing
      // entry alone so we don't churn while the user is still typing
      // the production dates.
      if (!startDate) return w

      const newAssignment = myExisting
        ? { ...myExisting, startDate, endDate: endDate || '' }
        : createWallAssignment({
            productionId,
            startDate,
            endDate: endDate || '',
            notes:   'Auto-linked from production',
            createdBy: currentUser?.id || '',
          })
      return {
        ...w,
        assignments: [...otherAss, newAssignment],
        updatedAt: new Date().toISOString(),
      }
    }))
  }, [currentUser])

  // ─── Feedback CRUD ──────────────────────────────────────────────────────────
  const addFeedbackItem = useCallback((item) => {
    setFeedbackItemsState(prev => [
      {
        ...item,
        submittedBy: item.submittedBy || currentUser?.id || '',
        submittedByName: item.submittedByName || currentUser?.name || 'Anonymous',
        submittedAt: item.submittedAt || new Date().toISOString(),
      },
      ...prev,
    ])
  }, [currentUser])

  const updateFeedbackItem = useCallback((id, patch) => {
    setFeedbackItemsState(prev => prev.map(f =>
      f.id === id ? { ...f, ...patch, updatedAt: new Date().toISOString() } : f
    ))
  }, [])

  const deleteFeedbackItem = useCallback((id) => {
    setFeedbackItemsState(prev => prev.filter(f => f.id !== id))
  }, [])

  const value = {
    // Auth
    currentUser,
    logout,
    users: USERS,

    // Dev-only profile impersonation
    devViewAs,
    setDevViewAs,

    // Productions
    productions,
    productionsLoading,
    productionsError,
    addProduction,
    updateProduction,
    deleteProduction,
    getProduction,

    // Tasks
    tasks,
    tasksLoading,
    tasksError,
    addTask,
    updateTask,
    deleteTask,
    getTasksForProduction,
    getTasksForUser,
    addComment,

    // Add-ons
    addAddon,
    updateAddon,
    deleteAddon,

    // Feedback
    submitFeedback,

    // Debrief quick notes
    addDebriefNote,
    deleteDebriefNote,

    // Production Bible
    updateBible,

    // Instruction packages
    updateInstructionPackage,
    updateTaskInstructionPackage,

    // Contractors
    contractors,
    contractorsLoading,
    contractorsError,
    addContractor,
    updateContractor,
    deleteContractor,
    getContractor,
    getContractorHistory,
    resolveAssignee,
    resolveUserName,
    profiles: profilesList,

    // Contractor assignment
    setStageManager,
    assignContractor,
    removeContractor,

    // Roadmap
    addMilestone,
    updateMilestone,
    deleteMilestone,
    addConcern,
    updateConcern,
    deleteConcern,

    // LED Walls (gear DB v1 — localStorage-backed)
    ledWalls,
    addLedWall,
    updateLedWall,
    deleteLedWall,
    assignWall,
    updateWallAssignment,
    unassignWall,
    syncProductionWallAssignment,

    // Bugs & Ideas
    feedbackItems,
    addFeedbackItem,
    updateFeedbackItem,
    deleteFeedbackItem,
  }

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>
}

export function useApp() {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error('useApp must be used within AppProvider')
  return ctx
}
