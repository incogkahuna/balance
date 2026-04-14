import { useState } from 'react'
import { format, parseISO } from 'date-fns'
import {
  Star, AlertTriangle, Phone, Mail, MapPin,
  Briefcase, Calendar, Edit, Trash2, ExternalLink,
} from 'lucide-react'
import { useApp } from '../../context/AppContext.jsx'
import { ROLES, CONTRACTOR_FLAG, AVAILABILITY_STATUS, PRODUCTION_STATUS } from '../../data/models.js'
import { Modal } from '../../components/ui/Modal.jsx'
import { ConfirmDialog } from '../../components/ui/ConfirmDialog.jsx'
import { ContractorForm } from './ContractorForm.jsx'
import { StatusBadge } from '../../components/ui/StatusBadge.jsx'
import clsx from 'clsx'

const AVAIL_STYLES = {
  [AVAILABILITY_STATUS.AVAILABLE]:   'bg-green-500/15 text-green-400 border-green-500/30',
  [AVAILABILITY_STATUS.BUSY]:        'bg-amber-500/15 text-amber-400 border-amber-500/30',
  [AVAILABILITY_STATUS.UNAVAILABLE]: 'bg-red-500/15 text-red-400 border-red-500/30',
}

export function ContractorProfile({ contractor, onClose, onDeleted }) {
  const { currentUser, updateContractor, deleteContractor, getContractorHistory } = useApp()
  const isAdmin = currentUser?.role === ROLES.ADMIN
  const isAdminOrSup = isAdmin || currentUser?.role === ROLES.SUPERVISOR

  const [showEdit, setShowEdit] = useState(false)
  const [showDelete, setShowDelete] = useState(false)

  const isDNR = contractor.flag === CONTRACTOR_FLAG.DO_NOT_REHIRE
  const isRec = contractor.flag === CONTRACTOR_FLAG.RECOMMENDED

  const history = getContractorHistory(contractor.id)

  const handleSave = (updated) => {
    updateContractor(contractor.id, updated)
    setShowEdit(false)
  }

  const handleDelete = () => {
    deleteContractor(contractor.id)
    setShowDelete(false)
    onDeleted?.()
    onClose()
  }

  return (
    <>
      <div className="space-y-5">
        {/* Header */}
        <div className="flex items-start gap-4">
          <div className="w-16 h-16 rounded-full flex-shrink-0 overflow-hidden flex items-center justify-center bg-orbital-muted text-orbital-text font-bold text-xl border border-orbital-border">
            {contractor.photoUrl
              ? <img src={contractor.photoUrl} alt={contractor.name} className="w-full h-full object-cover" />
              : <span>{contractor.name.charAt(0).toUpperCase()}</span>
            }
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-lg font-bold text-orbital-text">{contractor.name}</h2>
              {isRec && <Star size={14} className="text-amber-400 fill-amber-400" title="Recommended" />}
              {isDNR && (
                <span className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-md bg-red-500/15 text-red-400 border border-red-500/30">
                  <AlertTriangle size={10} /> Do Not Rehire
                </span>
              )}
            </div>
            <p className="text-sm text-orbital-subtle mt-0.5">{contractor.primaryRole}</p>
            <div className="flex items-center gap-2 mt-1.5 flex-wrap">
              <span className={clsx(
                'text-xs px-2 py-0.5 rounded-md border',
                AVAIL_STYLES[contractor.availability]
              )}>
                {contractor.availability}
              </span>
              <span className="text-xs text-orbital-subtle">{contractor.experienceLevel}</span>
              {contractor.location && (
                <span className="flex items-center gap-1 text-xs text-orbital-subtle">
                  <MapPin size={11} /> {contractor.location}
                </span>
              )}
            </div>
          </div>

          {isAdmin && (
            <div className="flex gap-2 flex-shrink-0">
              <button
                onClick={() => setShowEdit(true)}
                className="btn-ghost text-xs"
              >
                <Edit size={13} /> Edit
              </button>
              <button
                onClick={() => setShowDelete(true)}
                className="btn-ghost text-xs text-red-400 hover:text-red-300 hover:bg-red-500/10"
              >
                <Trash2 size={13} />
              </button>
            </div>
          )}
        </div>

        {/* Contact (Admin + Supervisor) */}
        {isAdminOrSup && (contractor.phone || contractor.email) && (
          <div className="card p-4 space-y-2">
            <p className="section-title mb-3">Contact</p>
            {contractor.phone && (
              <a
                href={`tel:${contractor.phone}`}
                className="flex items-center gap-2.5 text-sm text-orbital-text hover:text-blue-400 transition-colors"
              >
                <Phone size={14} className="text-orbital-subtle flex-shrink-0" />
                {contractor.phone}
              </a>
            )}
            {contractor.email && (
              <a
                href={`mailto:${contractor.email}`}
                className="flex items-center gap-2.5 text-sm text-orbital-text hover:text-blue-400 transition-colors"
              >
                <Mail size={14} className="text-orbital-subtle flex-shrink-0" />
                {contractor.email}
              </a>
            )}
          </div>
        )}

        {/* Roles & Skills */}
        <div className="card p-4">
          <p className="section-title mb-3">Roles & Skills</p>
          <div className="space-y-3">
            <div>
              <p className="text-xs text-orbital-subtle mb-1">Primary</p>
              <p className="text-sm text-orbital-text font-medium">{contractor.primaryRole}</p>
            </div>
            {contractor.secondaryRoles?.length > 0 && (
              <div>
                <p className="text-xs text-orbital-subtle mb-1">Secondary</p>
                <p className="text-sm text-orbital-text">{contractor.secondaryRoles.join(', ')}</p>
              </div>
            )}
            {contractor.skills?.length > 0 && (
              <div>
                <p className="text-xs text-orbital-subtle mb-2">Skills</p>
                <div className="flex flex-wrap gap-1.5">
                  {contractor.skills.map(skill => (
                    <span
                      key={skill}
                      className="text-xs px-2 py-0.5 rounded-md bg-orbital-muted border border-orbital-border text-orbital-text"
                    >
                      {skill}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Notes (Admin + Supervisor) */}
        {isAdminOrSup && contractor.notes && (
          <div className="card p-4">
            <p className="section-title mb-2">Notes</p>
            <p className="text-sm text-orbital-subtle">{contractor.notes}</p>
          </div>
        )}

        {/* Rates (Admin only) */}
        {isAdmin && (contractor.dayRate || contractor.weeklyRate || contractor.rateNotes) && (
          <div className="card p-4">
            <p className="section-title mb-3">Rates</p>
            <div className="flex gap-6 mb-2">
              {contractor.dayRate && (
                <div>
                  <p className="text-xs text-orbital-subtle">Day Rate</p>
                  <p className="text-sm font-semibold text-orbital-text mt-0.5">${contractor.dayRate}</p>
                </div>
              )}
              {contractor.weeklyRate && (
                <div>
                  <p className="text-xs text-orbital-subtle">Weekly Rate</p>
                  <p className="text-sm font-semibold text-orbital-text mt-0.5">${contractor.weeklyRate}</p>
                </div>
              )}
            </div>
            {contractor.rateNotes && (
              <p className="text-xs text-orbital-subtle mt-1">{contractor.rateNotes}</p>
            )}
          </div>
        )}

        {/* Emergency Contact (Admin only) */}
        {isAdmin && contractor.emergencyContact?.name && (
          <div className="card p-4">
            <p className="section-title mb-3">Emergency Contact</p>
            <p className="text-sm font-medium text-orbital-text">{contractor.emergencyContact.name}</p>
            {contractor.emergencyContact.relationship && (
              <p className="text-xs text-orbital-subtle mt-0.5">{contractor.emergencyContact.relationship}</p>
            )}
            {contractor.emergencyContact.phone && (
              <a
                href={`tel:${contractor.emergencyContact.phone}`}
                className="flex items-center gap-2 text-sm text-orbital-text hover:text-blue-400 transition-colors mt-1"
              >
                <Phone size={13} className="text-orbital-subtle" />
                {contractor.emergencyContact.phone}
              </a>
            )}
          </div>
        )}

        {/* Work History */}
        <div className="card p-4">
          <p className="section-title mb-3">Work History ({history.length})</p>
          {history.length === 0 ? (
            <p className="text-sm text-orbital-subtle">No production history yet.</p>
          ) : (
            <div className="space-y-3">
              {history.map(entry => (
                <div key={entry.productionId} className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-orbital-text truncate">{entry.productionName}</p>
                    <p className="text-xs text-orbital-subtle mt-0.5">{entry.client}</p>
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      {entry.roleOnProduction && (
                        <span className="text-xs text-orbital-subtle">{entry.roleOnProduction}</span>
                      )}
                      {entry.startDate && (
                        <span className="text-xs text-orbital-subtle">
                          {format(parseISO(entry.startDate), 'MMM yyyy')}
                          {entry.endDate && ` – ${format(parseISO(entry.endDate), 'MMM yyyy')}`}
                        </span>
                      )}
                    </div>
                  </div>
                  <StatusBadge status={entry.status} size="sm" />
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer meta */}
        {contractor.createdAt && (
          <p className="text-xs text-orbital-subtle text-center">
            Added {format(parseISO(contractor.createdAt), 'MMMM d, yyyy')}
          </p>
        )}
      </div>

      {/* Edit modal */}
      <Modal open={showEdit} onClose={() => setShowEdit(false)} title="Edit Contractor" size="lg">
        <ContractorForm
          initial={contractor}
          onSubmit={handleSave}
          onCancel={() => setShowEdit(false)}
        />
      </Modal>

      {/* Delete confirm */}
      <ConfirmDialog
        open={showDelete}
        onClose={() => setShowDelete(false)}
        onConfirm={handleDelete}
        title="Remove Contractor"
        message={`Remove ${contractor.name} from the roster? This won't affect existing production records.`}
        confirmLabel="Remove Contractor"
        danger
      />
    </>
  )
}
