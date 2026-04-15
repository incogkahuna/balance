import { useState, useRef, useCallback, useEffect } from 'react'
import { Upload, FileText, Mic, MicOff, X, Image, Plus, ArrowRight, Loader } from 'lucide-react'
import clsx from 'clsx'

// ─── Voice input hook ─────────────────────────────────────────────────────────
function useVoiceInput(onTranscript) {
  const [listening, setListening]   = useState(false)
  const recognitionRef              = useRef(null)
  const supported = typeof window !== 'undefined' &&
    !!(window.SpeechRecognition || window.webkitSpeechRecognition)

  const start = useCallback(() => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition
    const r  = new SR()
    r.lang              = 'en-US'
    r.interimResults    = false
    r.maxAlternatives   = 1
    r.onresult  = e => { onTranscript(e.results[0][0].transcript); setListening(false) }
    r.onerror   = ()  => setListening(false)
    r.onend     = ()  => setListening(false)
    recognitionRef.current = r
    r.start()
    setListening(true)
  }, [onTranscript])

  const stop = useCallback(() => {
    recognitionRef.current?.stop()
    setListening(false)
  }, [])

  return { supported, listening, start, stop }
}

// ─── InputStage ───────────────────────────────────────────────────────────────
export function InputStage({ onNext }) {
  const [inputs,     setInputs]     = useState([])
  const [textValue,  setTextValue]  = useState('')
  const [dragging,   setDragging]   = useState(false)
  const [voiceText,  setVoiceText]  = useState('')
  const fileInputRef                = useRef(null)
  const textareaRef                 = useRef(null)

  const { supported: voiceSupported, listening, start: startVoice, stop: stopVoice } =
    useVoiceInput(transcript => setVoiceText(prev => prev ? prev + ' ' + transcript : transcript))

  // Add a text input from textarea or voice
  const addTextInput = useCallback((text) => {
    if (!text.trim()) return
    setInputs(prev => [...prev, {
      id:       crypto.randomUUID(),
      type:     'text',
      content:  text.trim(),
      fileName: `Text note ${prev.filter(i => i.type === 'text').length + 1}`,
      preview:  null,
      addedAt:  new Date().toISOString(),
    }])
  }, [])

  const addPastedText = () => {
    if (!textValue.trim()) return
    addTextInput(textValue)
    setTextValue('')
  }

  const addVoiceText = () => {
    if (!voiceText.trim()) return
    addTextInput(voiceText)
    setVoiceText('')
  }

  // Add image files
  const addFiles = useCallback((files) => {
    Array.from(files).forEach(file => {
      if (!file.type.startsWith('image/')) return
      const reader = new FileReader()
      reader.onload = e => {
        setInputs(prev => [...prev, {
          id:       crypto.randomUUID(),
          type:     'image',
          content:  null,
          fileName: file.name,
          fileType: file.type,
          preview:  e.target.result,
          addedAt:  new Date().toISOString(),
        }])
      }
      reader.readAsDataURL(file)
    })
  }, [])

  const removeInput = id => setInputs(prev => prev.filter(i => i.id !== id))

  // Drag and drop
  const onDragOver  = e => { e.preventDefault(); setDragging(true) }
  const onDragLeave = ()  => setDragging(false)
  const onDrop      = e  => {
    e.preventDefault()
    setDragging(false)
    addFiles(e.dataTransfer.files)
  }

  // Paste anywhere on the page — catch image pastes
  useEffect(() => {
    const handler = e => {
      const items = e.clipboardData?.items
      if (!items) return
      const imageItems = [...items].filter(i => i.type.startsWith('image/'))
      if (imageItems.length > 0) {
        imageItems.forEach(item => {
          const file = item.getAsFile()
          if (file) addFiles([file])
        })
      }
    }
    document.addEventListener('paste', handler)
    return () => document.removeEventListener('paste', handler)
  }, [addFiles])

  // Any pending unsaved content counts toward "can proceed"
  const hasPending  = textValue.trim().length > 0 || voiceText.trim().length > 0
  const canProceed  = inputs.length > 0 || hasPending

  // Auto-flush pending text/voice into inputs then call onNext
  const handleAnalyse = () => {
    const extra = []
    if (voiceText.trim()) {
      extra.push({
        id:       crypto.randomUUID(),
        type:     'text',
        content:  voiceText.trim(),
        fileName: `Voice note ${inputs.filter(i => i.type === 'text').length + extra.length + 1}`,
        preview:  null,
        addedAt:  new Date().toISOString(),
      })
    }
    if (textValue.trim()) {
      extra.push({
        id:       crypto.randomUUID(),
        type:     'text',
        content:  textValue.trim(),
        fileName: `Text note ${inputs.filter(i => i.type === 'text').length + extra.length + 1}`,
        preview:  null,
        addedAt:  new Date().toISOString(),
      })
    }
    onNext([...inputs, ...extra])
  }

  return (
    <div className="flex flex-col gap-6">

      {/* Drop zone */}
      <div
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        onClick={() => fileInputRef.current?.click()}
        className={clsx(
          'border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all',
          dragging
            ? 'border-blue-400 bg-blue-500/10'
            : 'border-orbital-border/50 hover:border-orbital-border hover:bg-white/[0.02]'
        )}
      >
        <div className="flex flex-col items-center gap-3">
          <div className={clsx(
            'w-12 h-12 rounded-full flex items-center justify-center transition-colors',
            dragging ? 'bg-blue-500/20' : 'bg-white/5'
          )}>
            <Upload size={22} className={dragging ? 'text-blue-400' : 'text-orbital-subtle'} />
          </div>
          <div>
            <p className="text-sm font-medium text-orbital-text">
              {dragging ? 'Drop to add' : 'Drop screenshots here'}
            </p>
            <p className="text-xs text-orbital-subtle mt-1">
              Emails, texts, schedules, briefs — anything you have
            </p>
          </div>
          <span className="text-xs text-blue-400 font-medium">or click to browse</span>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={e => { addFiles(e.target.files); e.target.value = '' }}
        />
      </div>

      {/* Paste text */}
      <div className="rounded-xl border border-orbital-border/50 bg-white/[0.02] overflow-hidden">
        <div className="px-4 py-2.5 border-b border-orbital-border/40 flex items-center gap-2">
          <FileText size={14} className="text-orbital-subtle" />
          <span className="text-xs font-medium text-orbital-subtle uppercase tracking-wider">Paste text</span>
          <span className="text-xs text-orbital-subtle/60 ml-auto">emails, notes, messages</span>
        </div>
        <textarea
          ref={textareaRef}
          value={textValue}
          onChange={e => setTextValue(e.target.value)}
          placeholder="Paste an email thread, WhatsApp message, brief, or any notes about this production…"
          rows={5}
          className="w-full bg-transparent px-4 py-3 text-sm text-orbital-text placeholder:text-orbital-subtle/50 resize-none focus:outline-none"
        />
        <div className="px-4 py-2.5 border-t border-orbital-border/40 flex items-center justify-between">
          <span className="text-xs text-orbital-subtle">
            {textValue.length > 0 ? `${textValue.length} chars` : 'Any format works'}
          </span>
          <button
            onClick={addPastedText}
            disabled={!textValue.trim()}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-500/15 text-blue-400 text-xs font-medium hover:bg-blue-500/25 transition-colors disabled:opacity-30 disabled:pointer-events-none"
          >
            <Plus size={12} />
            Add
          </button>
        </div>
      </div>

      {/* Voice input */}
      {voiceSupported && (
        <div className="rounded-xl border border-orbital-border/50 bg-white/[0.02] overflow-hidden">
          <div className="px-4 py-2.5 border-b border-orbital-border/40 flex items-center gap-2">
            <Mic size={14} className="text-orbital-subtle" />
            <span className="text-xs font-medium text-orbital-subtle uppercase tracking-wider">Voice summary</span>
            <span className="text-xs text-orbital-subtle/60 ml-auto">speak a quick briefing</span>
          </div>
          <div className="px-4 py-4 flex flex-col gap-3">
            {voiceText ? (
              <p className="text-sm text-orbital-text bg-white/5 rounded-lg px-3 py-2.5 leading-relaxed">
                "{voiceText}"
              </p>
            ) : (
              <p className="text-xs text-orbital-subtle italic">
                {listening ? 'Listening… speak now' : 'Tap the mic and describe this production'}
              </p>
            )}
            <div className="flex items-center gap-2">
              <button
                onClick={listening ? stopVoice : startVoice}
                className={clsx(
                  'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all',
                  listening
                    ? 'bg-red-500/20 text-red-400 border border-red-500/30 animate-pulse'
                    : 'bg-white/5 text-orbital-text border border-orbital-border/50 hover:bg-white/10'
                )}
              >
                {listening ? <MicOff size={14} /> : <Mic size={14} />}
                {listening ? 'Stop' : 'Record'}
              </button>
              {voiceText && (
                <>
                  <button
                    onClick={addVoiceText}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-blue-500/15 text-blue-400 text-xs font-medium hover:bg-blue-500/25 transition-colors"
                  >
                    <Plus size={12} />
                    Add
                  </button>
                  <button
                    onClick={() => setVoiceText('')}
                    className="text-xs text-orbital-subtle hover:text-orbital-text"
                  >
                    Clear
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Added inputs list */}
      {inputs.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-medium text-orbital-subtle uppercase tracking-wider px-1">
            Added ({inputs.length})
          </p>
          {inputs.map(input => (
            <div
              key={input.id}
              className="flex items-center gap-3 px-3 py-2.5 rounded-lg bg-white/[0.03] border border-orbital-border/40 group"
            >
              {input.type === 'image' ? (
                <>
                  {input.preview
                    ? <img src={input.preview} alt="" className="w-8 h-8 rounded object-cover flex-shrink-0" />
                    : <div className="w-8 h-8 rounded bg-white/10 flex items-center justify-center flex-shrink-0">
                        <Image size={14} className="text-orbital-subtle" />
                      </div>
                  }
                  <span className="text-sm text-orbital-text truncate flex-1">{input.fileName}</span>
                  <span className="text-xs text-orbital-subtle/60 flex-shrink-0">Screenshot</span>
                </>
              ) : (
                <>
                  <div className="w-8 h-8 rounded bg-white/10 flex items-center justify-center flex-shrink-0">
                    <FileText size={14} className="text-orbital-subtle" />
                  </div>
                  <span className="text-sm text-orbital-text truncate flex-1">{input.fileName}</span>
                  <span className="text-xs text-orbital-subtle/60 flex-shrink-0">
                    {input.content?.length || 0} chars
                  </span>
                </>
              )}
              <button
                onClick={() => removeInput(input.id)}
                className="p-1 rounded opacity-0 group-hover:opacity-100 hover:bg-white/10 text-orbital-subtle hover:text-orbital-text transition-all"
              >
                <X size={13} />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Actions */}
      <div className="flex flex-col gap-3 pt-2">
        <button
          onClick={handleAnalyse}
          disabled={!canProceed}
          className={clsx(
            'w-full flex items-center justify-center gap-2 py-3.5 rounded-xl font-semibold text-sm transition-all',
            canProceed
              ? 'bg-blue-500 hover:bg-blue-400 text-white shadow-lg shadow-blue-500/20'
              : 'bg-white/5 text-orbital-subtle cursor-not-allowed'
          )}
        >
          Analyse Inputs
          <ArrowRight size={16} />
        </button>
        {!canProceed && (
          <p className="text-xs text-center text-orbital-subtle">
            Add at least one screenshot or text note to continue
          </p>
        )}
      </div>
    </div>
  )
}
