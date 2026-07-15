import { useState } from 'react'
import { Navigate } from 'react-router-dom'
import { ChevronDown, ChevronUp } from 'lucide-react'
import { useApp } from '../../context/AppContext.jsx'
import { ROLES } from '../../data/models.js'
import { KeyPlayers } from './KeyPlayers.jsx'
import { DocumentsReceived } from './DocumentsReceived.jsx'
import { KeyConcerns } from './KeyConcerns.jsx'
import { FrictionAndFlow } from './FrictionAndFlow.jsx'
import { HandoffSummary } from './HandoffSummary.jsx'
import clsx from 'clsx'

// Sections config — drives the collapsible section layout
const SECTIONS = [
  { key: 'keyPlayers',     label: 'Key Players',        defaultOpen: true  },
  { key: 'documents',      label: 'Documents Received', defaultOpen: true  },
  { key: 'concerns',       label: 'Key Concerns',       defaultOpen: true  },
  { key: 'frictionAndFlow',label: 'Friction & Flow',    defaultOpen: false },
  { key: 'handoff',        label: 'Handoff Summary',    defaultOpen: false },
]

export function ProductionBible({ production }) {
  const { currentUser, updateBible } = useApp()

  // Hard gate — Crew role should never see this, but belt-and-suspenders here
  // in case something routes them in. The tab is also hidden in the parent.
  if (currentUser?.role === ROLES.CREW) {
    return <Navigate to={`/productions/${production.id}`} replace />
  }

  // Ensure bible exists with all expected keys even on old production records
  const bible = {
    keyPlayers: [],
    documents: [],
    concerns: [],
    frictionAndFlow: [],
    ...(production.bible || {}),
  }

  // Called by each section with its updated array — merges and saves
  const handleSectionChange = (sectionKey, data) => {
    updateBible(production.id, { ...bible, [sectionKey]: data })
  }

  // Called by DocumentsReceived after an AI scan of a stored screenshot/PDF —
  // folds extracted contacts into Key Players and concerns into Key Concerns
  // in a single bible write. Returns counts for the caller's feedback toast.
  const handleAiExtract = (extraction, sourceName) => {
    const players = [...bible.keyPlayers]
    let addedPlayers = 0
    for (const c of extraction.contacts || []) {
      if (!c?.name && !c?.email) continue
      const email = (c.email || '').toLowerCase()
      const exists = players.some(p =>
        (email && p.email && p.email.toLowerCase() === email) ||
        (c.name && p.name && p.name.toLowerCase() === c.name.toLowerCase())
      )
      if (exists) continue
      players.push({
        id: crypto.randomUUID(),
        name: c.name || email.split('@')[0],
        role: c.role || '',
        company: c.company || '',
        phone: c.phone || '',
        email,
        notes: `Extracted by AI from "${sourceName}"`,
        tag: 'Client Side',
      })
      addedPlayers++
    }

    const concerns = [...bible.concerns]
    let addedConcerns = 0
    const HIGH_CATEGORIES = new Set(['tight-timeline', 'conflict', 'missing-resource'])
    for (const c of extraction.concerns || []) {
      if (!c?.title) continue
      const exists = concerns.some(x =>
        x.title.toLowerCase().includes(c.title.toLowerCase().slice(0, 40))
      )
      if (exists) continue
      concerns.push({
        id: crypto.randomUUID(),
        title: c.title.slice(0, 90),
        description: `Extracted by AI from "${sourceName}"`,
        severity: HIGH_CATEGORIES.has(c.category) ? 'High' : 'Medium',
        status: 'Open',
        resolutionNote: '',
        createdAt: new Date().toISOString(),
      })
      addedConcerns++
    }

    if (addedPlayers > 0 || addedConcerns > 0) {
      updateBible(production.id, { ...bible, keyPlayers: players, concerns })
    }
    return { addedPlayers, addedConcerns }
  }

  // Track which sections are collapsed on mobile
  const [open, setOpen] = useState(() =>
    Object.fromEntries(SECTIONS.map(s => [s.key, s.defaultOpen]))
  )
  const toggleSection = (key) => setOpen(o => ({ ...o, [key]: !o[key] }))

  return (
    <div className="space-y-6">
      {SECTIONS.map(({ key, label }) => (
        <BibleSection
          key={key}
          label={label}
          isOpen={open[key]}
          onToggle={() => toggleSection(key)}
        >
          {key === 'keyPlayers' && (
            <KeyPlayers
              players={bible.keyPlayers}
              onChange={(data) => handleSectionChange('keyPlayers', data)}
            />
          )}
          {key === 'documents' && (
            <DocumentsReceived
              documents={bible.documents}
              onChange={(data) => handleSectionChange('documents', data)}
              onAiExtract={handleAiExtract}
            />
          )}
          {key === 'concerns' && (
            <KeyConcerns
              concerns={bible.concerns}
              onChange={(data) => handleSectionChange('concerns', data)}
            />
          )}
          {key === 'frictionAndFlow' && (
            <FrictionAndFlow
              entries={bible.frictionAndFlow}
              onChange={(data) => handleSectionChange('frictionAndFlow', data)}
            />
          )}
          {key === 'handoff' && (
            <HandoffSummary
              production={production}
              bible={bible}
              currentUserRole={currentUser?.role}
            />
          )}
        </BibleSection>
      ))}
    </div>
  )
}

// Collapsible section wrapper — collapses on mobile to reduce scroll fatigue
function BibleSection({ label, isOpen, onToggle, children }) {
  return (
    <div className="card overflow-hidden">
      {/* Section header — always visible, tap to collapse */}
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between px-5 py-4 hover:bg-orbital-muted/50 transition-colors"
      >
        <span className="font-semibold text-orbital-text text-sm">{label}</span>
        {isOpen
          ? <ChevronUp size={16} className="text-orbital-subtle" />
          : <ChevronDown size={16} className="text-orbital-subtle" />
        }
      </button>

      {/* Section body */}
      {isOpen && (
        <div className={clsx('px-5 pb-5 border-t border-orbital-border pt-5')}>
          {children}
        </div>
      )}
    </div>
  )
}
