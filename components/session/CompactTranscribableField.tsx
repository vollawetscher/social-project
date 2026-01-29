'use client'

import { useState, useRef, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Mic, Square, Loader2, Save, Sparkles, ChevronDown, Plus, X } from 'lucide-react'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { toast } from 'sonner'

interface CompactTranscribableFieldProps {
  title: string
  description: string
  icon: React.ReactNode
  value: string
  placeholder: string
  sessionId: string
  fieldName: 'context_text' | 'private_comments' | 'instructions'
  color: 'blue' | 'amber' | 'green'
  onSave: (value: string) => Promise<void>
  onAnalyze?: () => Promise<void>
  showAnalyzeButton?: boolean
  analyzing?: boolean
}

export function CompactTranscribableField({
  title,
  description,
  icon,
  value,
  placeholder,
  sessionId,
  fieldName,
  color,
  onSave,
  onAnalyze,
  showAnalyzeButton = false,
  analyzing = false,
}: CompactTranscribableFieldProps) {
  const [text, setText] = useState(value)
  const [liveTranscript, setLiveTranscript] = useState('')
  const [recording, setRecording] = useState(false)
  const [transcribing, setTranscribing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [hasChanges, setHasChanges] = useState(false)
  const [isOpen, setIsOpen] = useState(!!value) // Auto-open if has content
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const recognitionRef = useRef<any>(null)

  // Sync with parent value changes
  useEffect(() => {
    setText(value)
  }, [value])

  // Initialize Web Speech API for real-time transcription
  useEffect(() => {
    if (typeof window !== 'undefined' && 'webkitSpeechRecognition' in window) {
      const SpeechRecognition = (window as any).webkitSpeechRecognition
      const recognition = new SpeechRecognition()
      recognition.continuous = true
      recognition.interimResults = true
      recognition.lang = 'de-DE'

      recognition.onresult = (event: any) => {
        let interim = ''
        let final = ''
        
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const transcript = event.results[i][0].transcript
          if (event.results[i].isFinal) {
            final += transcript + ' '
          } else {
            interim += transcript
          }
        }
        
        setLiveTranscript(final + interim)
      }

      recognition.onerror = (event: any) => {
        console.error('Speech recognition error:', event.error)
      }

      recognitionRef.current = recognition
    }
  }, [])

  const colorClasses = {
    blue: {
      border: 'border-blue-200',
      bg: 'bg-blue-50',
      text: 'text-blue-600',
      badge: 'bg-blue-100 text-blue-700'
    },
    amber: {
      border: 'border-amber-200',
      bg: 'bg-amber-50',
      text: 'text-amber-600',
      badge: 'bg-amber-100 text-amber-700'
    },
    green: {
      border: 'border-green-200',
      bg: 'bg-green-50',
      text: 'text-green-600',
      badge: 'bg-green-100 text-green-700'
    }
  }

  const colors = colorClasses[color]
  const hasContent = text.length > 0

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mediaRecorder = new MediaRecorder(stream)
      mediaRecorderRef.current = mediaRecorder
      chunksRef.current = []

      // Start Web Speech API for real-time
      if (recognitionRef.current) {
        setLiveTranscript('')
        recognitionRef.current.start()
      }

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data)
        }
      }

      mediaRecorder.onstop = async () => {
        // Stop Web Speech API
        if (recognitionRef.current) {
          recognitionRef.current.stop()
        }
        
        stream.getTracks().forEach((track) => track.stop())
        const audioBlob = new Blob(chunksRef.current, { type: 'audio/webm' })
        
        // Use live transcript immediately
        if (liveTranscript.trim()) {
          const newText = text ? `${text}\n\n${liveTranscript.trim()}` : liveTranscript.trim()
          setText(newText)
          setHasChanges(true)
          toast.success(`✅ Live-Transkription übernommen (${liveTranscript.length} Zeichen)`)
        }
        
        // Then refine with Speechmatics in background (optional)
        await transcribeAudioWithSpeechmatics(audioBlob)
      }

      mediaRecorder.start()
      setRecording(true)
      toast.success('🎙️ Aufnahme läuft - spreche jetzt')
    } catch (error) {
      console.error('Recording error:', error)
      toast.error('Fehler beim Starten der Aufnahme')
    }
  }

  const stopRecording = () => {
    if (mediaRecorderRef.current && recording) {
      mediaRecorderRef.current.stop()
      setRecording(false)
    }
  }

  const transcribeAudioWithSpeechmatics = async (audioBlob: Blob) => {
    // Optional: Refine with Speechmatics for better quality
    // For now, we rely on live transcript
    console.log('[Speechmatics] Skipped - using live transcript')
  }

  const handleTextChange = (newText: string) => {
    setText(newText)
    setHasChanges(newText !== value)
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      await onSave(text)
      setHasChanges(false)
      toast.success('✅ Gespeichert!')
    } catch (error: any) {
      console.error('[Save] Error:', error)
      toast.error('❌ Fehler beim Speichern')
    } finally {
      setSaving(false)
    }
  }

  const handleClear = () => {
    setText('')
    setHasChanges(true)
    toast.success('Gelöscht')
  }

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <div className={`border rounded-lg ${colors.border} ${isOpen ? colors.bg : 'bg-white'}`}>
        <CollapsibleTrigger className="w-full p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={colors.text}>{icon}</div>
              <div className="text-left">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-sm">{title}</span>
                  {hasContent && (
                    <Badge variant="outline" className={colors.badge}>
                      {text.length} Zeichen
                    </Badge>
                  )}
                </div>
                {!isOpen && !hasContent && (
                  <p className="text-xs text-slate-500 mt-0.5">{description}</p>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2">
              {!hasContent && !isOpen && (
                <Button size="sm" variant="ghost" className={`${colors.text} hover:${colors.bg}`}>
                  <Plus className="h-4 w-4 mr-1" />
                  Hinzufügen
                </Button>
              )}
              <ChevronDown className={`h-4 w-4 text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
            </div>
          </div>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <div className="p-4 pt-0 space-y-3">
            <p className="text-xs text-slate-600">{description}</p>

            <div className="flex items-center gap-2">
              {recording ? (
                <Button onClick={stopRecording} variant="destructive" size="sm">
                  <Square className="mr-2 h-4 w-4" />
                  Stop
                </Button>
              ) : (
                <Button onClick={startRecording} variant="outline" size="sm" disabled={transcribing}>
                  <Mic className="mr-2 h-4 w-4" />
                  Diktieren
                </Button>
              )}

              {hasContent && (
                <Button onClick={handleClear} variant="ghost" size="sm">
                  <X className="h-4 w-4" />
                </Button>
              )}

              {showAnalyzeButton && onAnalyze && text && (
                <Button
                  onClick={onAnalyze}
                  disabled={analyzing || hasChanges}
                  size="sm"
                  className="ml-auto"
                >
                  {analyzing ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Sparkles className="mr-2 h-4 w-4" />
                  )}
                  Strukturieren
                </Button>
              )}
            </div>

            {recording && liveTranscript && (
              <div className="border-l-4 border-blue-500 pl-3 py-2 bg-blue-50 rounded">
                <p className="text-xs text-blue-600 font-semibold mb-1">🎙️ Live-Transkription:</p>
                <p className="text-sm text-slate-700">{liveTranscript}</p>
              </div>
            )}

            {transcribing && (
              <div className="flex items-center gap-2 text-sm text-blue-600">
                <Loader2 className="h-4 w-4 animate-spin" />
                Transkribiere Audio...
              </div>
            )}

            <Textarea
              value={text}
              onChange={(e) => handleTextChange(e.target.value)}
              placeholder={placeholder}
              className="min-h-[100px] font-mono text-sm"
              disabled={recording}
            />

            {hasChanges && (
              <Button onClick={handleSave} disabled={saving} size="sm">
                {saving ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Save className="mr-2 h-4 w-4" />
                )}
                Speichern
              </Button>
            )}
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  )
}
