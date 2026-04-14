import { createContext, useContext, useState, useCallback } from 'react'
import { useLocalStorage } from '../hooks/useLocalStorage.js'
import { USERS, ROLES } from '../data/models.js'
import {
  SAMPLE_PRODUCTIONS as SP,
  SAMPLE_TASKS as ST,
  SAMPLE_CONTRACTORS as SC,
} from '../data/sampleData.js'

const AppContext = createContext(null)

export function AppProvider({ children }) {
  const [currentUser, setCurrentUser] = useLocalStorage('balance_current_user', null)
  const [productions, setProductions] = useLocalStorage('balance_productions', SP)
  const [tasks, setTasks] = useLocalStorage('balance_tasks', ST)
  const [contractors, setContractors] = useLocalStorage('balance_contractors', SC)

  // ─── Auth ──────────────────────────────────────────────────────────────────
  const login = useCallback((userId) => {
    const user = USERS.find(u => u.id === userId)
    if (user) setCurrentUser(user)
  }, [setCurrentUser])

  const logout = useCallback(() => {
    setCurrentUser(null)
  }, [setCurrentUser])

  // ─── Productions CRUD ──────────────────────────────────────────────────────
  const addProduction = useCallback((production) => {
    setProductions(prev => [production, ...prev])
  }, [setProductions])

  const updateProduction = useCallback((id, updates) => {
    setProductions(prev => prev.map(p =>
      p.id === id ? { ...p, ...updates, updatedAt: new Date().toISOString() } : p
    ))
  }, [setProductions])

  const deleteProduction = useCallback((id) => {
    setProductions(prev => prev.filter(p => p.id !== id))
    setTasks(prev => prev.filter(t => t.productionId !== id))
  }, [setProductions, setTasks])

  const getProduction = useCallback((id) => {
    return productions.find(p => p.id === id)
  }, [productions])

  // ─── Tasks CRUD ────────────────────────────────────────────────────────────
  const addTask = useCallback((task) => {
    setTasks(prev => [task, ...prev])
    setProductions(prev => prev.map(p =>
      p.id === task.productionId
        ? { ...p, tasks: [...(p.tasks || []), task.id], updatedAt: new Date().toISOString() }
        : p
    ))
  }, [setTasks, setProductions])

  const updateTask = useCallback((id, updates) => {
    setTasks(prev => prev.map(t =>
      t.id === id ? { ...t, ...updates, updatedAt: new Date().toISOString() } : t
    ))
  }, [setTasks])

  const deleteTask = useCallback((id) => {
    const task = tasks.find(t => t.id === id)
    setTasks(prev => prev.filter(t => t.id !== id))
    if (task) {
      setProductions(prev => prev.map(p =>
        p.id === task.productionId
          ? { ...p, tasks: p.tasks.filter(tid => tid !== id) }
          : p
      ))
    }
  }, [tasks, setTasks, setProductions])

  const getTasksForProduction = useCallback((productionId) => {
    return tasks.filter(t => t.productionId === productionId)
  }, [tasks])

  const getTasksForUser = useCallback((userId) => {
    return tasks.filter(t => t.assigneeId === userId)
  }, [tasks])

  // ─── Add-ons ───────────────────────────────────────────────────────────────
  const addAddon = useCallback((productionId, addon) => {
    setProductions(prev => prev.map(p =>
      p.id === productionId
        ? { ...p, addons: [...(p.addons || []), addon], updatedAt: new Date().toISOString() }
        : p
    ))
  }, [setProductions])

  const updateAddon = useCallback((productionId, addonId, updates) => {
    setProductions(prev => prev.map(p =>
      p.id === productionId
        ? {
            ...p,
            addons: p.addons.map(a => a.id === addonId ? { ...a, ...updates } : a),
            updatedAt: new Date().toISOString()
          }
        : p
    ))
  }, [setProductions])

  const deleteAddon = useCallback((productionId, addonId) => {
    setProductions(prev => prev.map(p =>
      p.id === productionId
        ? { ...p, addons: p.addons.filter(a => a.id !== addonId), updatedAt: new Date().toISOString() }
        : p
    ))
  }, [setProductions])

  // ─── Feedback ──────────────────────────────────────────────────────────────
  const submitFeedback = useCallback((productionId, feedback) => {
    setProductions(prev => prev.map(p =>
      p.id === productionId ? { ...p, feedback, updatedAt: new Date().toISOString() } : p
    ))
  }, [setProductions])

  // ─── Contractors CRUD ─────────────────────────────────────────────────────
  const addContractor = useCallback((contractor) => {
    setContractors(prev => [contractor, ...prev])
  }, [setContractors])

  const updateContractor = useCallback((id, updates) => {
    setContractors(prev => prev.map(c =>
      c.id === id ? { ...c, ...updates, updatedAt: new Date().toISOString() } : c
    ))
  }, [setContractors])

  const deleteContractor = useCallback((id) => {
    setContractors(prev => prev.filter(c => c.id !== id))
  }, [setContractors])

  const getContractor = useCallback((id) => {
    return contractors.find(c => c.id === id) || null
  }, [contractors])

  // Returns work history for a contractor by scanning all productions.
  // Derived at read-time — no duplication of data.
  const getContractorHistory = useCallback((contractorId) => {
    return productions
      .filter(p => p.assignedMembers?.some(m => m.userId === contractorId))
      .map(p => {
        const member = p.assignedMembers.find(m => m.userId === contractorId)
        return {
          productionId: p.id,
          productionName: p.name,
          client: p.client,
          roleOnProduction: member?.roleOnProduction || '',
          startDate: p.startDate,
          endDate: p.endDate,
          status: p.status,
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

  // ─── Production Bible ──────────────────────────────────────────────────────
  // Single update method — replaces the whole bible object on a production.
  // Each section passes its full updated array; the parent merges sections.
  const updateBible = useCallback((productionId, bible) => {
    setProductions(prev => prev.map(p =>
      p.id === productionId
        ? { ...p, bible, updatedAt: new Date().toISOString() }
        : p
    ))
  }, [setProductions])

  // ─── Instruction Packages ──────────────────────────────────────────────────
  const updateInstructionPackage = useCallback((productionId, pkg) => {
    setProductions(prev => prev.map(p =>
      p.id === productionId
        ? { ...p, instructionPackage: pkg, updatedAt: new Date().toISOString() }
        : p
    ))
  }, [setProductions])

  const updateTaskInstructionPackage = useCallback((taskId, pkg) => {
    setTasks(prev => prev.map(t =>
      t.id === taskId ? { ...t, instructionPackage: pkg, updatedAt: new Date().toISOString() } : t
    ))
  }, [setTasks])

  const value = {
    // Auth
    currentUser,
    login,
    logout,
    users: USERS,

    // Productions
    productions,
    addProduction,
    updateProduction,
    deleteProduction,
    getProduction,

    // Tasks
    tasks,
    addTask,
    updateTask,
    deleteTask,
    getTasksForProduction,
    getTasksForUser,

    // Add-ons
    addAddon,
    updateAddon,
    deleteAddon,

    // Feedback
    submitFeedback,

    // Production Bible
    updateBible,

    // Instruction packages
    updateInstructionPackage,
    updateTaskInstructionPackage,

    // Contractors
    contractors,
    addContractor,
    updateContractor,
    deleteContractor,
    getContractor,
    getContractorHistory,
    resolveAssignee,
  }

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>
}

export function useApp() {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error('useApp must be used within AppProvider')
  return ctx
}
