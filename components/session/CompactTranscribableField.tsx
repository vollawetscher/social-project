'use client'

import { useState, useRef, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Mic, Square, Loader2, Save, Sparkles, ChevronDown, Lock, Unlock, Wifi, WifiOff, Undo2 } from 'lucide-react'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { toast } from 'sonner'
import { SpeechmaticsRealtimeService, getSpeechmaticsRealtimeToken } from '@/lib/services/speechmatics-realtime'
import { microphoneManager } from '@/lib/services/microphone-manager'
import { MIN_TAP_TARGET_SIZE } from '@/lib/constants/ui'

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
  const [previousText, setPreviousText] = useState('') // Store text before AI improvement
  const [liveTranscript, setLiveTranscript] = useState('')
  const [recording, setRecording] = useState(false)
  const [isConnected, setIsConnected] = useState(false)
  const [saving, setSaving] = useState(false)
  const [hasChanges, setHasChanges] = useState(false)
  const [isOpen, setIsOpen] = useState(!locked && !!value) // Auto-open only if unlocked and has content
  const [isLocked, setIsLocked] = useState(locked) // Lock feature
  const [isDirty, setIsDirty] = useState(false) // Track if user is actively editing
  
  const speechmaticsServiceRef = useRef<SpeechmaticsRealtimeService | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const cursorPositionRef = useRef<number>(0)
  const lastSavedValueRef = useRef<string>(value)

  // Sync with parent value changes ONLY if not dirty (prevents race condition)
  useEffect(() => {
    if (!isDirty && !recording) {
      setText(value)
      lastSavedValueRef.current = value
    }
  }, [value, isDirty, recording])

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
      microphoneManager.releaseMicrophone('live-dictation')
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

    // Check if microphone is available
    if (!microphoneManager.isAvailable()) {
      const owner = microphoneManager.getCurrentOwner()
      const ownerName = microphoneManager.getOwnerDisplayName(owner)
      toast.error(`Mikrofon wird bereits verwendet von: ${ownerName}`)
      return
    }

    // Save cursor position before recording
    if (textareaRef.current) {
      cursorPositionRef.current = textareaRef.current.selectionStart || text.length
    }

    try {
      // Request microphone via manager
      const stream = await microphoneManager.requestMicrophone('live-dictation')
      if (!stream) {
        toast.error('Mikrofon wird bereits verwendet')
        return
      }
      
      setLiveTranscript('')
      setIsDirty(true) // Mark as dirty to prevent parent sync
      
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
            setText(currentText => {
              const start = cursorPositionRef.current
              const before = currentText.substring(0, start)
              const after = currentText.substring(start)
              // Add space only if needed
              const needsSpace = before.length > 0 && !before.endsWith(' ') && !before.endsWith('\n')
              const newText = before + (needsSpace ? ' ' : '') + transcript + ' ' + after
              return newText
            })
            setHasChanges(true)
            cursorPositionRef.current += transcript.length + 1
            setLiveTranscript('') // Clear partial
          } else {
            // Partial transcript - show as preview
            setLiveTranscript(transcript)
          }
        },
        onError: (error, diagnostic) => {
          console.error('[Speechmatics RT] Error:', error, diagnostic)
          const errorMsg = diagnostic || error.message || 'Unbekannter Fehler'
          toast.error('Transkriptionsfehler: ' + errorMsg, {
            duration: 5000,
          })
        },
        onConnectionChange: (connected) => {
          setIsConnected(connected)
          if (!connected && recording) {
            toast.warning('Verbindung unterbrochen - versuche neu zu verbinden...', {
              duration: 3000,
            })
          } else if (connected && recording) {
            toast.success('Verbindung wiederhergestellt', {
              duration: 2000,
            })
          }
        },
      })

      speechmaticsServiceRef.current = speechmaticsService
      
      // Start real-time transcription
      await speechmaticsService.start(stream)
      
      setRecording(true)
      toast.success('🎤 Live-Diktat aktiv (DSGVO-konform)', {
        duration: 2000,
      })
    } catch (error: any) {
      console.error('Recording error:', error)
      const errorMsg = error.message || 'Unbekannter Fehler'
      
      // Better error messages
      let displayMsg = errorMsg
      if (errorMsg.includes('Permission denied') || errorMsg.includes('NotAllowedError')) {
        displayMsg = 'Mikrofon-Berechtigung verweigert. Bitte erlaube Zugriff in den Browser-Einstellungen.'
      } else if (errorMsg.includes('NotFoundError')) {
        displayMsg = 'Kein Mikrofon gefunden. Bitte schließe ein Mikrofon an.'
      } else if (errorMsg.includes('Failed to get Speechmatics token')) {
        displayMsg = 'Authentifizierung fehlgeschlagen. Bitte neu anmelden.'
      }
      
      toast.error(displayMsg, {
        duration: 6000,
      })
      
      // Cleanup on error
      microphoneManager.releaseMicrophone('live-dictation')
      setIsDirty(false)
    }
  }

  const stopRecording = async () => {
    if (recording && speechmaticsServiceRef.current) {
      setRecording(false)
      setIsConnected(false)
      
      // Save any remaining partial transcript before stopping
      if (liveTranscript) {
        setText(currentText => {
          const start = cursorPositionRef.current
          const before = currentText.substring(0, start)
          const after = currentText.substring(start)
          const needsSpace = before.length > 0 && !before.endsWith(' ') && !before.endsWith('\n')
          const newText = before + (needsSpace ? ' ' : '') + liveTranscript + after
          return newText
        })
        setHasChanges(true)
      }
      
      // Stop Speechmatics service
      await speechmaticsServiceRef.current.stop()
      speechmaticsServiceRef.current = null
      
      // Release microphone via manager
      microphoneManager.releaseMicrophone('live-dictation')
      
      setLiveTranscript('')
      // DON'T set isDirty(false) here! Keep it true so the text isn't reset.
      // isDirty will be set to false when user saves (handleSave)
      toast.success('Diktat beendet - Bitte speichern', {
        action: {
          label: 'Speichern',
          onClick: handleSave
        }
      })
    }
  }


  const handleTextChange = (newText: string) => {
    if (isLocked) return
    setText(newText)
    setHasChanges(newText !== lastSavedValueRef.current)
    setIsDirty(true)
  }

  const handleCursorChange = (e: React.SyntheticEvent<HTMLTextAreaElement>) => {
    cursorPositionRef.current = e.currentTarget.selectionStart || 0
  }
  
  // Also track cursor on change (fixes Bug 5)
  const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    handleTextChange(e.target.value)
    handleCursorChange(e)
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      await onSave(text)
      lastSavedValueRef.current = text
      setHasChanges(false)
      setIsDirty(false) // Allow parent sync again
      toast.success('Gespeichert!')
    } catch (error: any) {
      console.error('[Save] Error:', error)
      toast.error('❌ Fehler beim Speichern')
    } finally {
      setSaving(false)
    }
  }

  const handleUndo = () => {
    if (isLocked) {
      toast.error('Feld ist gesperrt')
      return
    }
    if (!previousText) {
      toast.error('Keine vorherige Version verfügbar')
      return
    }
    setText(previousText)
    setPreviousText('')
    setHasChanges(true)
    toast.success('Vorherige Version wiederhergestellt')
  }

  // Helper to strip markdown formatting
  const stripMarkdown = (text: string): string => {
    return text
      // Remove markdown headers (# ## ###)
      .replace(/^#{1,6}\s+/gm, '')
      // Remove bold/italic (**text** or *text*)
      .replace(/\*\*([^*]+)\*\*/g, '$1')
      .replace(/\*([^*]+)\*/g, '$1')
      // Remove links [text](url)
      .replace(/\[([^\]]+)\]\([^\)]+\)/g, '$1')
      // Remove inline code `code`
      .replace(/`([^`]+)`/g, '$1')
      .trim()
  }

  const toggleLock = async () => {
    if (!isLocked && hasChanges) {
      toast.error('Speichere zuerst!')
      return
    }
    
    const newLockState = !isLocked
    try {
      await onLockToggle(newLockState)
      // Only update state AFTER successful server update (fixes Bug 4)
      setIsLocked(newLockState)
      toast.success(newLockState ? '🔒 Gesperrt' : '🔓 Entsperrt')
    } catch (error) {
      console.error('[Lock] Error:', error)
      toast.error('Fehler beim Ändern des Sperrstatus')
      // Don't update local state on error
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
                    <Badge variant="outline" className={`text-xs px-1.5 py-0 ${colors.badge}`}>
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
              {/* Connection Status Indicator */}
              {recording && (
                <div className={`flex items-center gap-1 px-2 py-1 rounded text-xs ${isConnected ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                  {isConnected ? <Wifi className="h-3 w-3" /> : <WifiOff className="h-3 w-3" />}
                </div>
              )}
              
              {/* Dictate Button - Larger tap target for mobile */}
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
                  variant={recording ? 'destructive' : 'ghost'}
                  size="sm"
                  className={`h-9 ${recording ? '' : colors.text}`}
                  style={{ minHeight: `${MIN_TAP_TARGET_SIZE}px` }}
                  title={recording ? 'Diktat stoppen' : 'Diktieren'}
                >
                  {recording ? (
                    <>
                      <Square className="h-4 w-4 mr-1" />
                      <span className="text-xs">Stop</span>
                    </>
                  ) : (
                    <Mic className="h-4 w-4" />
                  )}
                </Button>
              )}
              
              {/* Lock/Unlock Toggle */}
              {hasContent && (
                <Button 
                  onClick={(e) => {
                    e.stopPropagation()
                    toggleLock()
                  }}
                  variant="ghost" 
                  size="icon"
                  className={`h-8 w-8 ${isLocked ? 'text-red-600 hover:text-red-700' : hasChanges ? 'text-muted-foreground/50' : 'text-muted-foreground hover:text-green-600'}`}
                  disabled={hasChanges}
                  title={isLocked ? 'Gesperrt' : hasChanges ? 'Speichere zuerst' : 'Entsperrt'}
                >
                  {isLocked ? <Lock className="h-4 w-4" /> : <Unlock className="h-4 w-4" />}
                </Button>
              )}
              
              <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${isOpen ? 'rotate-180' : ''}`} />
            </div>
          </div>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <div className="px-3 pb-3 space-y-1.5">
            {description && (
              <p className="text-xs text-muted-foreground mb-2">{description}</p>
            )}
            
            {/* Action buttons - shown first for quick access */}
            {!isLocked && (
              <div className="flex items-center gap-1">
                {previousText && (
                  <Button 
                    onClick={handleUndo} 
                    variant="ghost" 
                    size="icon"
                    className="h-7 w-7 hover:bg-amber-50 hover:text-amber-700" 
                    title="Vorherige Version wiederherstellen"
                  >
                    <Undo2 className="h-3.5 w-3.5" />
                  </Button>
                )}

                {showAnalyzeButton && onAnalyze && text && (
                  <Button
                    onClick={() => {
                      // Save current text so user can undo
                      setPreviousText(text)
                      
                      onAnalyze(text, (improvedText) => {
                        // Strip markdown formatting before setting
                        const plainText = stripMarkdown(improvedText)
                        setText(plainText)
                        setHasChanges(true)
                      })
                    }}
                    disabled={analyzing}
                    size="icon"
                    variant="ghost"
                    className={`h-7 w-7 ml-auto ${analyzing ? 'text-muted-foreground/50' : ''}`}
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

            {/* Recording Status & Live Transcript */}
            {recording && (
              <div className={`border-l-2 pl-2 py-1.5 rounded text-xs ${isConnected ? 'border-green-500 bg-green-50' : 'border-amber-500 bg-amber-50'}`}>
                <p className={`font-semibold mb-0.5 flex items-center gap-1 ${isConnected ? 'text-green-700' : 'text-amber-700'}`}>
                  <Mic className="h-3 w-3 animate-pulse" />
                  {isConnected ? 'Höre zu...' : 'Verbinde...'}
                </p>
                {liveTranscript ? (
                  <p className="text-foreground">{liveTranscript}</p>
                ) : (
                  <p className="text-muted-foreground italic text-xs">Spreche jetzt...</p>
                )}
              </div>
            )}

            <Textarea
              ref={textareaRef}
              value={text}
              onChange={handleTextareaChange}
              onSelect={handleCursorChange}
              onClick={handleCursorChange}
              onKeyUp={handleCursorChange}
              placeholder={placeholder}
              className={`min-h-[100px] text-sm ${isLocked ? 'bg-muted cursor-not-allowed' : ''}`}
              disabled={recording || isLocked}
            />

            {hasChanges && (
              <Button 
                onClick={handleSave} 
                disabled={saving} 
                size="sm"
                className={saving ? 'opacity-50' : ''}
              >
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
