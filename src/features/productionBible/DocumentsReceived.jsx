import { useState, useRef } from 'react'
import { FileText, Image, Upload, Trash2, Eye, Plus, Calendar } from 'lucide-react'
import { format, parseISO } from 'date-fns'
import { Modal } from '../../components/ui/Modal.jsx'
import { ConfirmDialog } from '../../components/ui/ConfirmDialog.jsx'
import { EmptyState } from '../../components/ui/EmptyState.jsx'

// File url is base64 in v1. To swap in Supabase storage:
//   1. Replace the FileReader block in handleFileSelect with a Supabase upload call
//   2. Store the returned public URL as `url` instead of the base64 string
//   3. No other changes needed — the rest of the component uses `url` generically

export function DocumentsReceived({ documents = [], onChange }) {
  const [showModal, setShowModal] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [previewDoc, setPreviewDoc] = useState(null)
  const [form, setForm] = useState({ name: '', dateReceived: '', notes: '' })
  const [pendingFile, setPendingFile] = useState(null) // { url, fileType, fileName }
  const fileRef = useRef(null)

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const handleFileSelect = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      setPendingFile({
        url: ev.target.result,
        fileType: file.type,
        fileName: file.name,
      })
      // Pre-fill the name field if blank
      if (!form.name) set('name', file.name.replace(/\.[^.]+$/, ''))
    }
    reader.readAsDataURL(file)
    e.target.value = ''
  }

  const handleSave = () => {
    if (!form.name.trim() && !pendingFile) return
    const doc = {
      id: crypto.randomUUID(),
      name: form.name || pendingFile?.fileName || 'Untitled',
      dateReceived: form.dateReceived,
      notes: form.notes,
      url: pendingFile?.url || null,
      fileType: pendingFile?.fileType || null,
      fileName: pendingFile?.fileName || null,
    }
    onChange([...documents, doc])
    setForm({ name: '', dateReceived: '', notes: '' })
    setPendingFile(null)
    setShowModal(false)
  }

  const handleDelete = (id) => {
    onChange(documents.filter(d => d.id !== id))
    setDeleteTarget(null)
  }

  const isImage = (type) => type?.startsWith('image/')
  const isPDF = (type) => type === 'application/pdf'

  return (
    <section>
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-orbital-text">Documents Received</h3>
        <button onClick={() => setShowModal(true)} className="btn-primary py-1.5 text-xs">
          <Plus size={14} /> Add Document
        </button>
      </div>

      {documents.length === 0 ? (
        <EmptyState
          icon={FileText}
          title="No documents logged"
          description="Track everything the client has sent — contracts, call sheets, stage layouts, specs."
          action={
            <button onClick={() => setShowModal(true)} className="btn-primary">
              <Upload size={14} /> Add first document
            </button>
          }
        />
      ) : (
        <div className="space-y-2">
          {documents.map(doc => (
            <DocRow
              key={doc.id}
              doc={doc}
              onPreview={() => setPreviewDoc(doc)}
              onDelete={() => setDeleteTarget(doc)}
              isImage={isImage}
              isPDF={isPDF}
            />
          ))}
        </div>
      )}

      {/* Add document modal */}
      <Modal open={showModal} onClose={() => { setShowModal(false); setPendingFile(null) }} title="Add Document" size="md">
        <div className="space-y-4">
          {/* File upload zone */}
          <div>
            <input
              ref={fileRef}
              type="file"
              accept="image/*,.pdf"
              className="hidden"
              onChange={handleFileSelect}
            />
            {pendingFile ? (
              <div className="p-3 rounded-lg bg-orbital-muted border border-orbital-border flex items-center gap-3">
                {isImage(pendingFile.fileType)
                  ? <Image size={16} className="text-blue-400 flex-shrink-0" />
                  : <FileText size={16} className="text-orbital-subtle flex-shrink-0" />
                }
                <span className="text-sm text-orbital-text truncate flex-1">{pendingFile.fileName}</span>
                <button
                  onClick={() => setPendingFile(null)}
                  className="text-xs text-orbital-subtle hover:text-red-400 flex-shrink-0"
                >
                  Remove
                </button>
              </div>
            ) : (
              <button
                onClick={() => fileRef.current?.click()}
                className="w-full p-4 rounded-lg border border-dashed border-orbital-border hover:border-blue-500/50 text-orbital-subtle hover:text-orbital-text transition-colors text-sm flex flex-col items-center gap-2"
              >
                <Upload size={20} />
                <span>Upload PDF or image</span>
                <span className="text-xs opacity-60">Optional — you can log a document without a file</span>
              </button>
            )}
          </div>

          <div>
            <label className="label">Document Name *</label>
            <input className="input" value={form.name} onChange={e => set('name', e.target.value)} placeholder="e.g. Call Sheet Day 1, Stage Layout, Contract v2" />
          </div>
          <div>
            <label className="label">Date Received</label>
            <input type="date" className="input" value={form.dateReceived} onChange={e => set('dateReceived', e.target.value)} />
          </div>
          <div>
            <label className="label">Notes</label>
            <textarea className="input min-h-[70px] resize-y" value={form.notes} onChange={e => set('notes', e.target.value)} placeholder="What this document contains, why it matters, any follow-up needed..." />
          </div>

          <div className="flex gap-3 pt-1">
            <button onClick={() => { setShowModal(false); setPendingFile(null) }} className="btn-secondary flex-1">Cancel</button>
            <button onClick={handleSave} className="btn-primary flex-1" disabled={!form.name.trim() && !pendingFile}>
              Add Document
            </button>
          </div>
        </div>
      </Modal>

      {/* Inline preview modal */}
      <Modal open={!!previewDoc} onClose={() => setPreviewDoc(null)} title={previewDoc?.name || ''} size="xl">
        {previewDoc?.url && isImage(previewDoc.fileType) && (
          <img src={previewDoc.url} alt={previewDoc.name} className="w-full rounded-lg" />
        )}
        {previewDoc?.url && isPDF(previewDoc.fileType) && (
          <iframe src={previewDoc.url} title={previewDoc.name} className="w-full rounded-lg border border-orbital-border" style={{ height: '70vh' }} />
        )}
        {previewDoc?.notes && (
          <p className="text-sm text-orbital-subtle mt-4">{previewDoc.notes}</p>
        )}
      </Modal>

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => handleDelete(deleteTarget?.id)}
        title="Remove Document"
        message={`Remove "${deleteTarget?.name}"?`}
        confirmLabel="Remove"
        danger
      />
    </section>
  )
}

function DocRow({ doc, onPreview, onDelete, isImage, isPDF }) {
  const canPreview = doc.url && (isImage(doc.fileType) || isPDF(doc.fileType))

  return (
    <div className="card p-3 flex items-center gap-3">
      <div className="w-9 h-9 rounded-lg bg-orbital-muted flex items-center justify-center flex-shrink-0">
        {isImage(doc.fileType)
          ? <Image size={16} className="text-blue-400" />
          : <FileText size={16} className="text-orbital-subtle" />
        }
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-orbital-text truncate">{doc.name}</p>
        <div className="flex items-center gap-2 mt-0.5">
          {doc.dateReceived && (
            <span className="text-xs text-orbital-subtle flex items-center gap-1">
              <Calendar size={10} />
              {format(parseISO(doc.dateReceived), 'MMM d, yyyy')}
            </span>
          )}
          {doc.notes && (
            <span className="text-xs text-orbital-subtle truncate">{doc.notes}</span>
          )}
        </div>
      </div>
      <div className="flex gap-1 flex-shrink-0">
        {canPreview && (
          <button onClick={onPreview} className="p-1.5 rounded hover:bg-orbital-muted text-orbital-subtle hover:text-blue-400 transition-colors">
            <Eye size={14} />
          </button>
        )}
        <button onClick={onDelete} className="p-1.5 rounded hover:bg-red-500/10 text-orbital-subtle hover:text-red-400 transition-colors">
          <Trash2 size={14} />
        </button>
      </div>
    </div>
  )
}
