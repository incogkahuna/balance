import { useState, useRef } from 'react'
import { Upload, Mic, MicOff, Play, Pause, FileText, Image, X, ChevronDown, ChevronUp } from 'lucide-react'

export function InstructionPackage({ pkg, onChange, readOnly = false }) {
  const fileRef = useRef()
  const mediaRef = useRef(null)
  const [recording, setRecording] = useState(false)
  const [transcript, setTranscript] = useState('')
  const [playingId, setPlayingId] = useState(null)
  const audioRefs = useRef({})
  const recognitionRef = useRef(null)

  const pkg2 = pkg || { files: [], voiceMemos: [], notes: '' }

  const updatePkg = (updates) => {
    onChange({ ...pkg2, ...updates })
  }

  // ─── File upload ───────────────────────────────────────────────────────────
  const handleFileUpload = (e) => {
    const files = Array.from(e.target.files)
    files.forEach(file => {
      const reader = new FileReader()
      reader.onload = (ev) => {
        const newFile = {
          id: crypto.randomUUID(),
          name: file.name,
          type: file.type,
          url: ev.target.result,
          size: file.size,
          uploadedAt: new Date().toISOString(),
        }
        updatePkg({ files: [...pkg2.files, newFile] })
      }
      reader.readAsDataURL(file)
    })
  }

  const removeFile = (id) => {
    updatePkg({ files: pkg2.files.filter(f => f.id !== id) })
  }

  // ─── Voice memo recording ─────────────────────────────────────────────────
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const chunks = []
      mediaRef.current = new MediaRecorder(stream)
      setTranscript('')

      mediaRef.current.ondataavailable = (e) => chunks.push(e.data)
      mediaRef.current.onstop = () => {
        const blob = new Blob(chunks, { type: 'audio/webm' })
        const url = URL.createObjectURL(blob)
        const memo = {
          id: crypto.randomUUID(),
          name: `Voice memo — ${new Date().toLocaleTimeString()}`,
          url,
          transcript: transcript || '',
          recordedAt: new Date().toISOString(),
        }
        updatePkg({ voiceMemos: [...pkg2.voiceMemos, memo] })
        stream.getTracks().forEach(t => t.stop())
      }

      mediaRef.current.start()
      setRecording(true)

      // Web Speech API transcription
      if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
        const SR = window.SpeechRecognition || window.webkitSpeechRecognition
        recognitionRef.current = new SR()
        recognitionRef.current.continuous = true
        recognitionRef.current.interimResults = true
        recognitionRef.current.onresult = (e) => {
          let t = ''
          for (let i = 0; i < e.results.length; i++) {
            t += e.results[i][0].transcript
          }
          setTranscript(t)
        }
        recognitionRef.current.start()
      }
    } catch (err) {
      console.warn('Microphone access denied:', err)
    }
  }

  const stopRecording = () => {
    mediaRef.current?.stop()
    recognitionRef.current?.stop()
    setRecording(false)
  }

  const removeMemo = (id) => {
    updatePkg({ voiceMemos: pkg2.voiceMemos.filter(m => m.id !== id) })
  }

  const togglePlay = (id, url) => {
    if (playingId === id) {
      audioRefs.current[id]?.pause()
      setPlayingId(null)
    } else {
      if (playingId && audioRefs.current[playingId]) {
        audioRefs.current[playingId].pause()
      }
      if (!audioRefs.current[id]) {
        audioRefs.current[id] = new Audio(url)
        audioRefs.current[id].onended = () => setPlayingId(null)
      }
      audioRefs.current[id].play()
      setPlayingId(id)
    }
  }

  return (
    <div className="space-y-5">
      {/* Notes */}
      <div>
        <label className="label">Package Notes</label>
        {readOnly ? (
          <p className="text-sm text-orbital-subtle">{pkg2.notes || 'No notes.'}</p>
        ) : (
          <textarea
            className="input min-h-[80px] resize-y"
            value={pkg2.notes}
            onChange={e => updatePkg({ notes: e.target.value })}
            placeholder="Stage config, references, key contacts, special instructions..."
          />
        )}
      </div>

      {/* Files */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <label className="label mb-0">Files & Documents</label>
          {!readOnly && (
            <>
              <input
                type="file"
                ref={fileRef}
                multiple
                accept="image/*,.pdf,.doc,.docx"
                className="hidden"
                onChange={handleFileUpload}
              />
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="btn-ghost text-xs py-1.5"
              >
                <Upload size={14} /> Upload
              </button>
            </>
          )}
        </div>

        {pkg2.files.length === 0 ? (
          <p className="text-xs text-orbital-subtle">No files attached.</p>
        ) : (
          <div className="space-y-2">
            {pkg2.files.map(file => (
              <FileItem
                key={file.id}
                file={file}
                onRemove={readOnly ? null : () => removeFile(file.id)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Voice memos */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <label className="label mb-0">Voice Memos</label>
          {!readOnly && (
            <button
              type="button"
              onClick={recording ? stopRecording : startRecording}
              className={`btn-ghost text-xs py-1.5 ${recording ? 'text-red-400 hover:text-red-300' : ''}`}
            >
              {recording ? <><MicOff size={14} /> Stop</> : <><Mic size={14} /> Record</>}
            </button>
          )}
        </div>

        {recording && (
          <div className="flex items-center gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/20 mb-3">
            <div className="w-2 h-2 rounded-full bg-red-400 animate-pulse" />
            <span className="text-xs text-red-400 font-medium">Recording...</span>
            {transcript && <span className="text-xs text-orbital-subtle truncate flex-1 italic">"{transcript}"</span>}
          </div>
        )}

        {pkg2.voiceMemos.length === 0 ? (
          <p className="text-xs text-orbital-subtle">No voice memos.</p>
        ) : (
          <div className="space-y-2">
            {pkg2.voiceMemos.map(memo => (
              <VoiceMemoItem
                key={memo.id}
                memo={memo}
                playing={playingId === memo.id}
                onTogglePlay={() => togglePlay(memo.id, memo.url)}
                onRemove={readOnly ? null : () => removeMemo(memo.id)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function FileItem({ file, onRemove }) {
  const [expanded, setExpanded] = useState(false)
  const isImage = file.type?.startsWith('image/')
  const isPDF = file.type === 'application/pdf'

  return (
    <div className="card overflow-hidden">
      <div className="flex items-center gap-3 p-3">
        <div className="w-8 h-8 rounded-lg bg-orbital-muted flex items-center justify-center flex-shrink-0">
          {isImage ? <Image size={16} className="text-blue-400" /> : <FileText size={16} className="text-orbital-subtle" />}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-orbital-text truncate">{file.name}</p>
          {file.size && (
            <p className="text-xs text-orbital-subtle">{(file.size / 1024).toFixed(0)} KB</p>
          )}
        </div>
        <div className="flex items-center gap-1">
          {(isImage || isPDF) && (
            <button
              type="button"
              onClick={() => setExpanded(e => !e)}
              className="p-1.5 rounded hover:bg-orbital-muted text-orbital-subtle hover:text-orbital-text transition-colors"
            >
              {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </button>
          )}
          {onRemove && (
            <button
              type="button"
              onClick={onRemove}
              className="p-1.5 rounded hover:bg-red-500/10 text-orbital-subtle hover:text-red-400 transition-colors"
            >
              <X size={14} />
            </button>
          )}
        </div>
      </div>

      {expanded && isImage && (
        <div className="px-3 pb-3">
          <img src={file.url} alt={file.name} className="w-full rounded-lg border border-orbital-border max-h-64 object-contain bg-black/20" />
        </div>
      )}
      {expanded && isPDF && (
        <div className="px-3 pb-3">
          <iframe src={file.url} className="w-full h-64 rounded-lg border border-orbital-border" title={file.name} />
        </div>
      )}
    </div>
  )
}

function VoiceMemoItem({ memo, playing, onTogglePlay, onRemove }) {
  const [showTranscript, setShowTranscript] = useState(false)

  return (
    <div className="card p-3">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onTogglePlay}
          className="w-8 h-8 rounded-full bg-blue-600/20 hover:bg-blue-600/30 flex items-center justify-center text-blue-400 flex-shrink-0 transition-colors"
        >
          {playing ? <Pause size={14} /> : <Play size={14} />}
        </button>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-orbital-text truncate">{memo.name}</p>
          {memo.transcript && (
            <button
              type="button"
              onClick={() => setShowTranscript(s => !s)}
              className="text-xs text-blue-400 hover:text-blue-300"
            >
              {showTranscript ? 'Hide' : 'Show'} transcript
            </button>
          )}
        </div>
        {onRemove && (
          <button
            type="button"
            onClick={onRemove}
            className="p-1.5 rounded hover:bg-red-500/10 text-orbital-subtle hover:text-red-400 transition-colors"
          >
            <X size={14} />
          </button>
        )}
      </div>
      {showTranscript && memo.transcript && (
        <p className="mt-2 text-xs text-orbital-subtle italic border-t border-orbital-border pt-2">
          "{memo.transcript}"
        </p>
      )}
    </div>
  )
}
