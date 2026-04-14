import { Star, AlertTriangle } from 'lucide-react'
import { AVAILABILITY_STATUS, CONTRACTOR_FLAG } from '../../data/models.js'
import clsx from 'clsx'

const AVAIL_STYLES = {
  [AVAILABILITY_STATUS.AVAILABLE]:   'bg-green-500/15 text-green-400 border-green-500/30',
  [AVAILABILITY_STATUS.BUSY]:        'bg-amber-500/15 text-amber-400 border-amber-500/30',
  [AVAILABILITY_STATUS.UNAVAILABLE]: 'bg-red-500/15 text-red-400 border-red-500/30',
}

const EXP_STYLES = {
  Junior: 'bg-orbital-muted text-orbital-subtle',
  Mid:    'bg-orbital-muted text-orbital-subtle',
  Senior: 'bg-blue-500/10 text-blue-400',
  Lead:   'bg-purple-500/10 text-purple-400',
}

export function ContractorCard({ contractor, onClick, showRates }) {
  const isDNR = contractor.flag === CONTRACTOR_FLAG.DO_NOT_REHIRE
  const isRec = contractor.flag === CONTRACTOR_FLAG.RECOMMENDED

  return (
    <button
      onClick={onClick}
      className={clsx(
        'card p-4 w-full text-left transition-colors hover:border-blue-500/30',
        isDNR && 'border-red-500/20 bg-red-500/5'
      )}
    >
      <div className="flex items-start gap-3">
        {/* Avatar */}
        <div className="w-10 h-10 rounded-full flex-shrink-0 overflow-hidden flex items-center justify-center bg-orbital-muted text-orbital-text font-bold text-sm">
          {contractor.photoUrl
            ? <img src={contractor.photoUrl} alt={contractor.name} className="w-full h-full object-cover" />
            : <span>{contractor.name.charAt(0).toUpperCase()}</span>
          }
        </div>

        {/* Body */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2 flex-wrap">
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="font-semibold text-sm text-orbital-text">{contractor.name}</span>
                {isRec && (
                  <Star size={11} className="text-amber-400 fill-amber-400 flex-shrink-0" title="Recommended" />
                )}
                {isDNR && (
                  <AlertTriangle size={11} className="text-red-400 flex-shrink-0" title="Do Not Rehire" />
                )}
                <span className={clsx(
                  'text-xs px-1.5 py-0.5 rounded',
                  EXP_STYLES[contractor.experienceLevel] || EXP_STYLES.Mid
                )}>
                  {contractor.experienceLevel}
                </span>
              </div>
              <p className="text-xs text-orbital-subtle mt-0.5">{contractor.primaryRole}</p>
              {contractor.location && (
                <p className="text-xs text-orbital-subtle mt-0.5">{contractor.location}</p>
              )}
            </div>

            <span className={clsx(
              'flex-shrink-0 text-xs px-2 py-0.5 rounded-md border',
              AVAIL_STYLES[contractor.availability]
            )}>
              {contractor.availability}
            </span>
          </div>

          {/* Skills */}
          {contractor.skills?.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-2.5">
              {contractor.skills.slice(0, 5).map(skill => (
                <span
                  key={skill}
                  className="text-xs px-1.5 py-0.5 rounded bg-orbital-muted text-orbital-subtle border border-orbital-border"
                >
                  {skill}
                </span>
              ))}
              {contractor.skills.length > 5 && (
                <span className="text-xs text-orbital-subtle self-center">
                  +{contractor.skills.length - 5}
                </span>
              )}
            </div>
          )}

          {/* Rate (admin-gated) */}
          {showRates && (contractor.dayRate || contractor.weeklyRate) && (
            <p className="text-xs text-orbital-subtle mt-2">
              {contractor.dayRate && <span>${contractor.dayRate}/day</span>}
              {contractor.dayRate && contractor.weeklyRate && <span className="mx-1 text-orbital-border">·</span>}
              {contractor.weeklyRate && <span>${contractor.weeklyRate}/week</span>}
            </p>
          )}
        </div>
      </div>
    </button>
  )
}
