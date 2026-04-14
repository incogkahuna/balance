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
