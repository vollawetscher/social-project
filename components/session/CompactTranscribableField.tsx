'use client'

import { useState, useRef, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Mic, Square, Loader2, Save, Sparkles, ChevronDown, Plus, X, Lock, Unlock } from 'lucide-react'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { toast } from 'sonner'
import { SpeechmaticsRealtimeService, getSpeechmaticsRealtimeToken } from '@/lib/services/speechmatics-realtime'

interface CompactTranscribableFieldProps {
  title: string
  description: string
  icon: React.ReactNode
  value: string
  locked: boolean
  placeholder: string
  sessionId: string
  fieldName: 'context_text' | 'private_comments' | 'instructions'
  color: 'blue' | 'amber' | 'green'
  onSave: (value: string) => Promise<void>
  onLockToggle: (locked: boolean) => Promise<void>
  onAnalyze?: (currentText: string, setImprovedText: (text: string) => void) => Promise<void>
  showAnalyzeButton?: boolean
  analyzing?: boolean
}

export function CompactTranscribableField({
  title,
  description,
  icon,
  value,
  locked,
  placeholder,
  sessionId,
  fieldName,
  color,
  onSave,
  onLockToggle,
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
  const [isOpen, setIsOpen] = useState(!locked && !!value) // Auto-open only if unlocked and has content
  const [isLocked, setIsLocked] = useState(locked) // Lock feature
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const speechmaticsServiceRef = useRef<SpeechmaticsRealtimeService | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const cursorPositionRef = useRef<number>(0)
  const audioStreamRef = useRef<MediaStream | null>(null)

  // Sync with parent value changes
  useEffect(() => {
    setText(value)
  }, [value])

  // Sync with parent lock status changes
  useEffect(() => {
    setIsLocked(locked)
  }, [locked])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (speechmaticsServiceRef.current) {
        speechmaticsServiceRef.current.stop()
      }
      if (audioStreamRef.current) {
        audioStreamRef.current.getTracks().forEach(track => track.stop())
      }
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
  
  // Generate preview text (first ~50 chars)
  const getPreview = () => {
    if (!text) return null
    const preview = text.substring(0, 50).trim()
    return preview.length < text.length ? `${preview}...` : preview
  }

  const startRecording = async () => {
    if (isLocked) {
      toast.error('Feld ist gesperrt - entsperre zuerst')
      return
    }

    // Save cursor position before recording
    if (textareaRef.current) {
      cursorPositionRef.current = textareaRef.current.selectionStart || text.length
    }

    try {
      // Get microphone access
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      audioStreamRef.current = stream
      
      setLiveTranscript('')
      
      // Get secure temporary token from server
      const token = await getSpeechmaticsRealtimeToken()

      // Initialize Speechmatics real-time service (GDPR-compliant)
      const speechmaticsService = new SpeechmaticsRealtimeService(token, {
        language: 'de',
        enablePartials: true,
        onTranscript: (result) => {
          const transcript = result.transcript
          
          if (result.isFinal) {
            // Final transcript - insert permanently
            const start = cursorPositionRef.current
            const before = text.substring(0, start)
            const after = text.substring(start)
            const newText = before + transcript + ' ' + after
            setText(newText)
            setHasChanges(true)
            cursorPositionRef.current = start + transcript.length + 1
            setLiveTranscript('') // Clear partial
          } else {
            // Partial transcript - show as preview
            setLiveTranscript(transcript)
          }
        },
        onError: (error) => {
          console.error('[Speechmatics RT] Error:', error)
          toast.error('Transkriptionsfehler: ' + error.message)
        },
        onConnectionChange: (connected) => {
          if (!connected && recording) {
            toast.error('Verbindung zur Transkription verloren')
          }
        },
      })

      speechmaticsServiceRef.current = speechmaticsService
      
      // Start real-time transcription
      await speechmaticsService.start(stream)
      
      setRecording(true)
      toast.success('🎙️ Aufnahme läuft - spreche jetzt (DSGVO-konform)')
    } catch (error: any) {
      console.error('Recording error:', error)
      toast.error('Fehler beim Starten der Aufnahme: ' + (error.message || 'Unbekannter Fehler'))
      
      // Cleanup on error
      if (audioStreamRef.current) {
        audioStreamRef.current.getTracks().forEach(track => track.stop())
        audioStreamRef.current = null
      }
    }
  }

  const stopRecording = async () => {
    if (recording && speechmaticsServiceRef.current) {
      setRecording(false)
      
      // Stop Speechmatics service
      await speechmaticsServiceRef.current.stop()
      speechmaticsServiceRef.current = null
      
      // Stop microphone
      if (audioStreamRef.current) {
        audioStreamRef.current.getTracks().forEach(track => track.stop())
        audioStreamRef.current = null
      }
      
      setLiveTranscript('')
      toast.success('✅ Diktat beendet')
    }
  }


  const handleTextChange = (newText: string) => {
    if (isLocked) return
    setText(newText)
    setHasChanges(newText !== value)
  }

  const handleCursorChange = (e: React.SyntheticEvent<HTMLTextAreaElement>) => {
    cursorPositionRef.current = e.currentTarget.selectionStart || 0
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
    if (isLocked) {
      toast.error('Feld ist gesperrt')
      return
    }
    setText('')
    setHasChanges(true)
    toast.success('Gelöscht')
  }

  const toggleLock = async () => {
    if (!isLocked && hasChanges) {
      toast.error('Speichere zuerst!')
      return
    }
    
    const newLockState = !isLocked
    try {
      await onLockToggle(newLockState)
      setIsLocked(newLockState)
      toast.success(newLockState ? '🔒 Gesperrt' : '🔓 Entsperrt')
    } catch (error) {
      console.error('[Lock] Error:', error)
      toast.error('Fehler beim Ändern des Sperrstatus')
    }
  }

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <div className={`border rounded-lg ${colors.border} ${isOpen ? colors.bg : 'bg-white'}`}>
        <CollapsibleTrigger className="w-full p-3">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <div className={colors.text}>{icon}</div>
              <div className="text-left flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-sm">{title}</span>
                  {hasContent && (
                    <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${colors.badge}`}>
                      {text.length}
                    </Badge>
                  )}
                </div>
                {!isOpen && hasContent && (
                  <p className="text-xs text-muted-foreground mt-0.5 truncate">{getPreview()}</p>
                )}
              </div>
            </div>
            <div className="flex items-center gap-1 flex-shrink-0">
              {/* Dictate Button - Icon Only */}
              {!isLocked && (
                <Button
                  onClick={(e) => {
                    e.stopPropagation()
                    if (recording) {
                      stopRecording()
                    } else {
                      startRecording()
                    }
                  }}
                  variant="ghost"
                  size="icon"
                  className={`h-7 w-7 ${recording ? 'text-red-600 hover:text-red-700' : colors.text}`}
                  disabled={transcribing}
                >
                  {recording ? <Square className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
                </Button>
              )}
              
              {/* Lock/Check Status */}
              {hasContent && (
                <Button 
                  onClick={(e) => {
                    e.stopPropagation()
                    toggleLock()
                  }}
                  variant="ghost" 
                  size="icon"
                  className={`h-7 w-7 ${isLocked ? 'text-green-600 hover:text-green-700' : 'text-muted-foreground hover:text-foreground'}`}
                  disabled={hasChanges}
                  title={isLocked ? 'Gesperrt' : 'Entsperrt'}
                >
                  {isLocked ? <Lock className="h-3.5 w-3.5" /> : <Unlock className="h-3.5 w-3.5" />}
                </Button>
              )}
              
              <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${isOpen ? 'rotate-180' : ''}`} />
            </div>
          </div>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <div className="px-3 pb-3 space-y-2">
            <p className="text-xs text-muted-foreground">{description}</p>

            {/* Action buttons */}
            {!isLocked && (
              <div className="flex items-center gap-1">
                {hasContent && (
                  <Button onClick={handleClear} variant="ghost" size="icon" className="h-7 w-7" title="Löschen">
                    <X className="h-3.5 w-3.5" />
                  </Button>
                )}

                {showAnalyzeButton && onAnalyze && text && (
                  <Button
                    onClick={() => {
                      onAnalyze(text, (improvedText) => {
                        setText(improvedText)
                        setHasChanges(true)
                      })
                    }}
                    disabled={analyzing}
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7 ml-auto"
                    title="AI Strukturieren"
                  >
                    {analyzing ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Sparkles className="h-3.5 w-3.5" />
                    )}
                  </Button>
                )}
              </div>
            )}

            {/* Live Transcript */}
            {recording && liveTranscript && (
              <div className="border-l-2 border-primary pl-2 py-1.5 bg-primary/5 rounded text-xs">
                <p className="font-semibold text-primary mb-0.5">🎙️ Live:</p>
                <p className="text-foreground">{liveTranscript}</p>
              </div>
            )}

            {transcribing && (
              <div className="flex items-center gap-2 text-xs text-primary">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Transkribiere...
              </div>
            )}

            <Textarea
              ref={textareaRef}
              value={text}
              onChange={(e) => handleTextChange(e.target.value)}
              onSelect={handleCursorChange}
              onClick={handleCursorChange}
              onKeyUp={handleCursorChange}
              placeholder={placeholder}
              className={`min-h-[80px] text-sm ${isLocked ? 'bg-muted cursor-not-allowed' : ''}`}
              disabled={recording || isLocked}
            />

            {hasChanges && (
              <Button onClick={handleSave} disabled={saving} size="sm">
                {saving ? (
                  <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Save className="mr-2 h-3.5 w-3.5" />
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
