'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { AudioRecorder } from '@/components/audio/AudioRecorder'
import { AudioUploader } from '@/components/audio/AudioUploader'
import { LocalRecordingsList } from '@/components/audio/LocalRecordingsList'
import { BugReporter } from '@/components/error/BugReporter'
import { CompactTranscribableField } from '@/components/session/CompactTranscribableField'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { EditableTitle } from '@/components/ui/editable-title'
import { toast } from 'sonner'
import { Session, FilePurpose, File as FileType, TranscriptSegment } from '@/lib/types/database'
import { Loader2, ArrowLeft, FileText, Download, FileAudio, PlayCircle, Eye, Trash2, Notebook, Globe, Sparkles, MessageSquare, Lock, ListTodo, ChevronDown, Mic, Plus, Clock, Calendar, MapPin, User } from 'lucide-react'
import { PROCESSING_STATUSES, POLLING_INTERVALS, SESSION_STATUS_CONFIG, FILE_PURPOSE_CONFIG } from '@/lib/constants/ui'
import { formatDetailDate, formatDuration, formatTimecode, formatFileSize } from '@/lib/utils/date-formatters'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'

export default function SessionDetailPage() {
  const params = useParams()
  const router = useRouter()
  const sessionId = params.id as string

  const [session, setSession] = useState<Session | null>(null)
  const [files, setFiles] = useState<FileType[]>([])
  const [detectedLanguage, setDetectedLanguage] = useState<string | null>(null)
  const [detectedDomain, setDetectedDomain] = useState<string | null>(null)
  const [reportSummary, setReportSummary] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [viewingTranscript, setViewingTranscript] = useState<{
    file: FileType
    segments: TranscriptSegment[]
    loading: boolean
  } | null>(null)
  const [deletingFile, setDeletingFile] = useState<FileType | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [analyzingContext, setAnalyzingContext] = useState(false)
  const [analyzingPrivateNotes, setAnalyzingPrivateNotes] = useState(false)
  const [analyzingInstructions, setAnalyzingInstructions] = useState(false)
  const [showAudioUpload, setShowAudioUpload] = useState(false)

  // Memoize loadSession to prevent infinite re-renders (fixes Bug 1)
  const loadSession = useCallback(async () => {
    try {
      const response = await fetch(`/api/sessions/${sessionId}`)
      if (response.ok) {
        const data = await response.json()
        const { files: sessionFiles, ...sessionData } = data
        setSession(sessionData)
        setFiles(sessionFiles || [])
        
        // Fetch language from first file's transcript if available
        if (sessionFiles && sessionFiles.length > 0) {
          const firstFile = sessionFiles[0]
          try {
            const transcriptResponse = await fetch(`/api/files/${firstFile.id}/transcript`)
            if (transcriptResponse.ok) {
              const transcriptData = await transcriptResponse.json()
              setDetectedLanguage(transcriptData.transcript.language)
            }
          } catch (error) {
            // Silently fail if transcript not available yet
            console.log('Transcript not yet available')
          }
        }
        
        // Fetch domain and summary from report if available
        if (sessionData.status === 'done') {
          try {
            const reportResponse = await fetch(`/api/sessions/${sessionId}/report`)
            if (reportResponse.ok) {
              const reportData = await reportResponse.json()
              if (reportData.claude_json) {
                setDetectedDomain(reportData.claude_json.detected_domain || null)
                setReportSummary(reportData.claude_json.summary_short || null)
              }
            }
          } catch (error) {
            // Silently fail if report not available yet
            console.log('Report not yet available')
          }
        }
      } else {
        toast.error('Fehler beim Laden des Gesprächs')
        router.push('/dashboard')
      }
    } catch (error) {
      toast.error('Fehler beim Laden des Gesprächs')
    } finally {
      setLoading(false)
    }
  }, [sessionId, router])

  // Load session on mount
  useEffect(() => {
    loadSession()
  }, [loadSession])

  // Smart polling: only poll when session is processing (fixes Bug 1)
  useEffect(() => {
    if (!session) return

    // @ts-ignore - PROCESSING_STATUSES is readonly array
    const isProcessing = PROCESSING_STATUSES.includes(session.status)
    
    if (isProcessing) {
      console.log(`[SessionDetail] Starting polling for status: ${session.status}`)
      const interval = setInterval(() => {
        loadSession()
      }, POLLING_INTERVALS.SESSION_STATUS)
      
      return () => {
        console.log('[SessionDetail] Stopping polling')
        clearInterval(interval)
      }
    } else {
      console.log(`[SessionDetail] No polling needed for status: ${session.status}`)
    }
  }, [session?.status, loadSession])

  const handleFileSelected = async (file: File) => {
    // Detect audio duration before upload
    const audio = document.createElement('audio')
    audio.src = URL.createObjectURL(file)

    let durationDetected = false
    let audioLoadTimeout: NodeJS.Timeout

    audio.addEventListener('loadedmetadata', async () => {
      durationDetected = true
      clearTimeout(audioLoadTimeout)

      const duration = Math.floor(audio.duration)
      URL.revokeObjectURL(audio.src)

      if (isNaN(duration) || duration < 1) {
        toast.error('Die Audiodatei ist zu kurz oder ungültig. Mindestens 1 Sekunde erforderlich.')
        return
      }

      if (duration > 7200) {
        toast.error('Die Audiodatei ist zu lang. Maximum 2 Stunden.')
        return
      }

      // Default to 'meeting' - AI will classify after transcription
      await uploadAudio(file, duration, 'meeting')
    })

    audio.addEventListener('error', async () => {
      durationDetected = true
      clearTimeout(audioLoadTimeout)
      URL.revokeObjectURL(audio.src)

      if (file.size < 1024) {
        toast.error('Die Datei scheint leer oder beschädigt zu sein.')
      } else {
        toast.warning('Audiodauer konnte nicht ermittelt werden. Upload wird versucht...')
        // Default to 'meeting' - AI will classify after transcription
        await uploadAudio(file, 0, 'meeting')
      }
    })

    audioLoadTimeout = setTimeout(async () => {
      if (!durationDetected) {
        URL.revokeObjectURL(audio.src)
        toast.warning('Audiodauer konnte nicht ermittelt werden. Upload wird versucht...')
        // Default to 'meeting' - AI will classify after transcription
        await uploadAudio(file, 0, 'meeting')
      }
    }, 5000)
  }

  const uploadAudio = async (file: File | Blob, duration: number, purpose: FilePurpose) => {
    setUploading(true)

    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('duration', duration.toString())
      formData.append('purpose', purpose)

      const response = await fetch(`/api/sessions/${sessionId}/upload`, {
        method: 'POST',
        body: formData,
      })

      if (response.ok) {
        toast.success('Datei erfolgreich hochgeladen')
        await loadSession()
        await triggerTranscription()
      } else {
        const error = await response.json()
        toast.error('Upload fehlgeschlagen: ' + (error.error || 'Unbekannter Fehler'))
      }
    } catch (error) {
      toast.error('Upload fehlgeschlagen')
    } finally {
      setUploading(false)
    }
  }

  const handleUpdateSessionName = async (newName: string) => {
    try {
      const response = await fetch(`/api/sessions/${sessionId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ internal_case_id: newName }),
      })

      if (response.ok) {
        const updatedSession = await response.json()
        setSession(updatedSession)
        toast.success('Gesprächsname aktualisiert')
      } else {
        toast.error('Fehler beim Aktualisieren des Namens')
      }
    } catch (error) {
      toast.error('Fehler beim Aktualisieren des Namens')
    }
  }

  const handleImproveField = async (
    fieldName: 'context_text' | 'private_comments' | 'instructions',
    currentText: string,
    onSuccess: (improvedText: string) => void
  ) => {
    // Set analyzing state based on field
    const setAnalyzing = 
      fieldName === 'context_text' ? setAnalyzingContext :
      fieldName === 'private_comments' ? setAnalyzingPrivateNotes :
      setAnalyzingInstructions

    setAnalyzing(true)
    try {
      const response = await fetch(`/api/sessions/${sessionId}/improve-field`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fieldName, text: currentText }),
      })

      if (response.ok) {
        const data = await response.json()
        onSuccess(data.improved_text)
        toast.success('✨ Text verbessert!')
      } else {
        const error = await response.json()
        toast.error(error.error || 'Fehler bei der Verbesserung')
      }
    } catch (error) {
      console.error('Improve field error:', error)
      toast.error('Fehler beim Verbessern des Texts')
    } finally {
      setAnalyzing(false)
    }
  }

  const handleSaveField = async (fieldName: string, value: string) => {
    console.log('[SaveField]', fieldName, 'Length:', value.length)
    
    const response = await fetch(`/api/sessions/${sessionId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ [fieldName]: value }),
    })

    if (!response.ok) {
      const error = await response.json()
      console.error('[SaveField] Error:', error)
      throw new Error('Failed to save')
    }

    const updatedSession = await response.json()
    console.log('[SaveField] Success:', updatedSession)
    setSession(updatedSession)
    
    // Force reload to ensure consistency
    await loadSession()
  }

  const handleLockToggle = async (fieldName: string, locked: boolean) => {
    const lockFieldName = `${fieldName}_locked`
    const response = await fetch(`/api/sessions/${sessionId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ [lockFieldName]: locked }),
    })

    if (!response.ok) {
      const error = await response.json()
      console.error('[LockToggle] Error:', error)
      throw new Error('Failed to update lock status')
    }

    const updatedSession = await response.json()
    setSession(updatedSession)
  }

  const triggerTranscription = async () => {
    try {
      const response = await fetch(`/api/sessions/${sessionId}/transcribe`, {
        method: 'POST',
      })

      if (!response.ok) {
        toast.error('Fehler beim Starten der Transkription')
      }
    } catch (error) {
      toast.error('Fehler beim Starten der Transkription')
    }
  }

  const triggerSummarization = async () => {
    try {
      const response = await fetch(`/api/sessions/${sessionId}/summarize`, {
        method: 'POST',
      })

      if (!response.ok) {
        toast.error('Fehler beim Erstellen des Berichts')
      }
    } catch (error) {
      toast.error('Fehler beim Erstellen des Berichts')
    }
  }

  const handleViewTranscript = async (file: FileType) => {
    setViewingTranscript({ file, segments: [], loading: true })
    
    try {
      const response = await fetch(`/api/files/${file.id}/transcript`)
      if (response.ok) {
        const data = await response.json()
        setViewingTranscript({
          file,
          segments: data.transcript.segments,
          loading: false,
        })
      } else {
        const errorData = await response.json()
        console.error('Transcript error:', errorData)
        toast.error(errorData.error || 'Fehler beim Laden des Transkripts')
        setViewingTranscript(null)
      }
    } catch (error) {
      console.error('Transcript fetch error:', error)
      toast.error('Fehler beim Laden des Transkripts')
      setViewingTranscript(null)
    }
  }

  const handleDeleteFile = async () => {
    if (!deletingFile) return

    setDeleting(true)
    try {
      const response = await fetch(`/api/files/${deletingFile.id}`, {
        method: 'DELETE',
      })

      if (response.ok) {
        toast.success('Aufnahme gelöscht')
        setFiles(files.filter((f) => f.id !== deletingFile.id))
        await loadSession() // Reload to update session status if needed
      } else {
        const error = await response.json()
        toast.error('Fehler beim Löschen: ' + (error.error || 'Unbekannter Fehler'))
      }
    } catch (error) {
      toast.error('Fehler beim Löschen')
    } finally {
      setDeleting(false)
      setDeletingFile(null)
    }
  }

  // Use shared utilities for consistency across the app
  const getStatusBadge = (status: string) => {
    const config = SESSION_STATUS_CONFIG[status as keyof typeof SESSION_STATUS_CONFIG] || SESSION_STATUS_CONFIG.created
    const Icon = config.icon
    const animated = 'animated' in config && config.animated
    return (
      <Badge variant={config.variant} className="gap-1">
        <Icon className={`h-3 w-3 ${animated ? 'animate-spin' : ''}`} />
        {config.label}
      </Badge>
    )
  }

  const getPurposeLabel = (purpose: FilePurpose) => {
    const config = FILE_PURPOSE_CONFIG[purpose] || FILE_PURPOSE_CONFIG.meeting
    const Icon = config.icon
    return (
      <span className="flex items-center gap-1">
        <Icon className="h-3 w-3" />
        {config.label}
      </span>
    )
  }

  // Use shared formatters
  const formatDate = formatDetailDate

  if (loading || !session) {
    return (
      <DashboardLayout>
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-slate-600" />
        </div>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout>
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => session.case_id ? router.push(`/cases/${session.case_id}`) : router.push('/dashboard')}
            className="h-8 w-8"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="flex-1">
            <EditableTitle
              value={session.internal_case_id}
              fallback={`Gespräch ${session.id.slice(0, 8)}`}
              onSave={handleUpdateSessionName}
              placeholder="Gesprächsname eingeben"
              className="text-lg"
            />
          </div>
          <div className="flex items-center gap-2">
            <BugReporter
              caseId={session.case_id}
              sessionId={session.id}
              variant="ghost"
              size="icon"
              iconOnly
            />
          </div>
        </div>

        {session.last_error && (
          <Card className="border-red-200 bg-red-50">
            <CardContent className="pt-6">
              <p className="text-sm text-red-800">
                <strong>Fehler:</strong> {session.last_error}
              </p>
            </CardContent>
          </Card>
        )}

        {/* Info: Transcription complete, ready to generate report */}
        <Collapsible defaultOpen={false}>
          <div className="border rounded-lg border-slate-200 bg-white">
            <CollapsibleTrigger className="w-full p-3">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 flex-1">
                  <Notebook className="h-5 w-5 text-slate-600" />
                  <div className="text-left flex-1">
                    <span className="font-semibold text-sm">Metadaten</span>
                  </div>
                </div>
                <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform" />
              </div>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="px-3 pb-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {/* Created Date */}
                  <div className="flex items-center gap-1.5 text-xs">
                    <Calendar className="h-3.5 w-3.5 text-slate-600 flex-shrink-0" />
                    <span className="text-muted-foreground">Erstellt: {formatDate(session.created_at)}</span>
                  </div>
                  
                  {/* Duration */}
                  {session.duration_sec > 0 && (
                    <div className="flex items-center gap-1.5 text-xs">
                      <Clock className="h-3.5 w-3.5 text-slate-600 flex-shrink-0" />
                      <span className="text-muted-foreground">Dauer: {formatDuration(session.duration_sec)}</span>
                    </div>
                  )}
                  
                  {/* Detected Language (from transcript) */}
                  {detectedLanguage && (
                    <div className="flex items-center gap-1.5 text-xs">
                      <Globe className="h-3.5 w-3.5 text-slate-600 flex-shrink-0" />
                      <span className="text-muted-foreground">
                        {detectedLanguage === 'de' ? 'Deutsch' : 
                         detectedLanguage === 'en' ? 'English' : 
                         detectedLanguage.toUpperCase()}
                      </span>
                    </div>
                  )}
                  
                  {/* Transcription Status */}
                  {session.status === 'done' && files.length > 0 && (
                    <div className="flex items-center gap-1.5 text-xs">
                      <FileText className="h-3.5 w-3.5 text-slate-600 flex-shrink-0" />
                      <span className="text-muted-foreground font-medium">Transkript</span>
                    </div>
                  )}
                  
                  {/* Structured Context: Date */}
                  {session.structured_context?.date && (
                    <div className="flex items-center gap-1.5 text-xs col-span-full">
                      <Calendar className="h-3.5 w-3.5 text-slate-600 flex-shrink-0" />
                      <span className="text-muted-foreground">Termin: {session.structured_context.date}</span>
                    </div>
                  )}
                  
                  {/* Meeting Type */}
                  {session.structured_context?.meeting_type && (
                    <div className="flex items-center gap-1.5 text-xs col-span-full">
                      <FileText className="h-3.5 w-3.5 text-slate-600 flex-shrink-0" />
                      <span className="text-muted-foreground">{session.structured_context.meeting_type}</span>
                    </div>
                  )}
                  
                  {/* Location */}
                  {session.structured_context?.location && (
                    <div className="flex items-center gap-1.5 text-xs col-span-full">
                      <MapPin className="h-3.5 w-3.5 text-slate-600 flex-shrink-0" />
                      <span className="text-muted-foreground">{session.structured_context.location}</span>
                    </div>
                  )}
                  
                  {/* Participants */}
                  {session.structured_context?.participants && session.structured_context.participants.length > 0 && (
                    <div className="flex items-center gap-1.5 text-xs col-span-full">
                      <User className="h-3.5 w-3.5 text-slate-600 flex-shrink-0" />
                      <span className="text-muted-foreground">
                        {session.structured_context.participants.map(p => p.role || p.name).join(', ')}
                      </span>
                    </div>
                  )}
                  
                  {/* Domain (from report) */}
                  {detectedDomain && (
                    <div className="flex items-center gap-1.5 text-xs col-span-full">
                      <Sparkles className="h-3.5 w-3.5 text-slate-600 flex-shrink-0" />
                      <span className="text-muted-foreground font-medium capitalize">
                        {detectedDomain.replace(/_/g, ' ')}
                      </span>
                    </div>
                  )}
                  
                  {/* Summary (from report) */}
                  {reportSummary && (
                    <div className="col-span-full pt-2 border-t border-slate-100">
                      <p className="text-xs text-muted-foreground italic leading-relaxed">
                        {reportSummary}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </CollapsibleContent>
          </div>
        </Collapsible>

        {/* Kontext Section - Before Recordings */}
        <CompactTranscribableField
          title="Kontext"
          description="Informationen, um das Transkript besser zu verstehen"
          icon={<MessageSquare className="h-5 w-5" />}
          value={(session as any).context_text || ''}
          locked={(session as any).context_text_locked || false}
          placeholder=""
          sessionId={sessionId}
          fieldName="context_text"
          color="blue"
          onSave={(value) => handleSaveField('context_text', value)}
          onLockToggle={(locked) => handleLockToggle('context_text', locked)}
          onAnalyze={(currentText, setImprovedText) => 
            handleImproveField('context_text', currentText, setImprovedText)
          }
          showAnalyzeButton={true}
          analyzing={analyzingContext}
        />

        {/* Aufnahmen Section - Integrated with Upload */}
        <Collapsible defaultOpen={files.length > 0 || showAudioUpload}>
          <div className="border rounded-lg border-slate-200 bg-white">
            <CollapsibleTrigger className="w-full p-3">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 flex-1">
                  <FileAudio className="h-5 w-5 text-slate-600" />
                  <div className="text-left flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-sm">Aufnahmen</span>
                      {files.length > 0 && (
                        <Badge variant="outline" className="text-xs px-1.5 py-0 bg-slate-100 text-slate-700">
                          {files.length}
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  {session.status === 'created' && (
                    <Button
                      onClick={(e) => {
                        e.stopPropagation()
                        setShowAudioUpload(!showAudioUpload)
                      }}
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-green-600 hover:text-green-700"
                      title="Audio hinzufügen"
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                  )}
                  <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform" />
                </div>
              </div>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="px-3 pb-3 space-y-2">
                {/* Audio Upload/Record Interface - Only show when '+' clicked */}
                {showAudioUpload && session.status === 'created' && (
                  <div className="space-y-3 pb-3 border-b border-slate-200">
                    {/* Local recordings if any */}
                    <LocalRecordingsList
                      onFileSelected={handleFileSelected}
                    />
                    
                    <Tabs defaultValue="record" className="w-full">
                      <TabsList className="grid w-full grid-cols-2 h-8">
                        <TabsTrigger value="record" className="text-xs">Aufnehmen</TabsTrigger>
                        <TabsTrigger value="upload" className="text-xs">Hochladen</TabsTrigger>
                      </TabsList>
                      <TabsContent value="record" className="mt-2">
                        <AudioRecorder
                          onRecordingComplete={(blob, duration) => {
                            uploadAudio(blob, duration, 'meeting')
                            setShowAudioUpload(false)
                          }}
                        />
                      </TabsContent>
                      <TabsContent value="upload" className="mt-2">
                        <AudioUploader
                          onFileSelected={(file) => {
                            handleFileSelected(file)
                            setShowAudioUpload(false)
                          }}
                        />
                      </TabsContent>
                    </Tabs>
                  </div>
                )}
                
                {/* File List */}
                {files.length === 0 && !showAudioUpload ? (
                  <p className="text-xs text-muted-foreground py-2">Noch keine Aufnahmen</p>
                ) : (
                  files.map((file, index) => (
                    <div
                      key={file.id}
                      className="flex items-center gap-2 p-2 border rounded-lg hover:bg-slate-50 transition-colors"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className="text-xs font-medium text-foreground">
                            {getPurposeLabel(file.file_purpose)}
                          </span>
                          <Badge variant="outline" className="text-xs px-1 py-0">
                            #{index + 1}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                          <span>{formatFileSize(file.size_bytes)}</span>
                          <span>•</span>
                          <span>{formatDate(file.created_at)}</span>
                        </div>
                      </div>
                      <div className="flex gap-1">
                        <Button
                          variant="outline"
                          size="icon"
                          onClick={() => handleViewTranscript(file)}
                          className="h-7 w-7"
                          title="Transkript"
                        >
                          <Eye className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="outline"
                          size="icon"
                          onClick={() => router.push(`/sessions/${sessionId}/report`)}
                          className="h-7 w-7"
                          title="Bericht"
                        >
                          <FileText className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setDeletingFile(file)}
                          className="h-7 w-7 hover:bg-destructive/10 hover:text-destructive"
                          title="Löschen"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CollapsibleContent>
          </div>
        </Collapsible>


        <CompactTranscribableField
          title="Anweisungen"
          description="Auf was soll bei der Berichterstellung geachtet werden?"
          icon={<ListTodo className="h-5 w-5" />}
          value={(session as any).instructions || ''}
          locked={(session as any).instructions_locked || false}
          placeholder=""
          sessionId={sessionId}
          fieldName="instructions"
          color="green"
          onSave={(value) => handleSaveField('instructions', value)}
          onLockToggle={(locked) => handleLockToggle('instructions', locked)}
          onAnalyze={(currentText, setImprovedText) => 
            handleImproveField('instructions', currentText, setImprovedText)
          }
          showAnalyzeButton={true}
          analyzing={analyzingInstructions}
        />

        {/* Regenerate Report Button - only show if status is done or summarizing */}
        {(session.status === 'done' || session.status === 'summarizing') && files.length > 0 && (
          <Card className="border-green-200 bg-green-50">
            <CardContent className="flex items-center justify-between py-4">
              <div className="flex items-center gap-3">
                <Sparkles className="h-5 w-5 text-green-600" />
                <div>
                  <p className="font-semibold text-sm text-green-900">Bericht generieren</p>
                  <p className="text-xs text-green-700">
                    {session.status === 'summarizing' ? 'Wird gerade erstellt...' : 'Erstelle einen Bericht mit aktualisierten Einstellungen'}
                  </p>
                </div>
              </div>
              <Button
                onClick={triggerSummarization}
                disabled={session.status === 'summarizing'}
                variant="outline"
                size="sm"
                className="bg-white hover:bg-green-100"
              >
                {session.status === 'summarizing' ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Läuft...
                  </>
                ) : (
                  <>
                    <Sparkles className="mr-2 h-4 w-4" />
                    Generieren
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        )}

        <CompactTranscribableField
          title="Private Notizen"
          description="Ihre persönlichen Anmerkungen. Diese werden nicht verarbeitet."
          icon={<Lock className="h-5 w-5" />}
          value={(session as any).private_comments || ''}
          locked={(session as any).private_comments_locked || false}
          placeholder=""
          sessionId={sessionId}
          fieldName="private_comments"
          color="amber"
          onSave={(value) => handleSaveField('private_comments', value)}
          onLockToggle={(locked) => handleLockToggle('private_comments', locked)}
          onAnalyze={(currentText, setImprovedText) => 
            handleImproveField('private_comments', currentText, setImprovedText)
          }
          showAnalyzeButton={true}
          analyzing={analyzingPrivateNotes}
        />

        {session.status === 'transcribing' && (
          <Card className="border-blue-200 bg-blue-50">
            <CardContent className="flex items-center gap-3 py-4">
              <Loader2 className="h-5 w-5 animate-spin text-blue-600" />
              <div>
                <p className="font-semibold text-sm text-blue-900">Transkription läuft</p>
                <p className="text-xs text-blue-700">Audio wird verarbeitet...</p>
              </div>
            </CardContent>
          </Card>
        )}

        {session.status === 'summarizing' && (
          <Card className="border-blue-200 bg-blue-50">
            <CardContent className="flex items-center gap-3 py-4">
              <Loader2 className="h-5 w-5 animate-spin text-blue-600" />
              <div>
                <p className="font-semibold text-sm text-blue-900">Bericht wird erstellt</p>
                <p className="text-xs text-blue-700">KI generiert den Report...</p>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* View Transcript Dialog */}
      <Dialog open={!!viewingTranscript} onOpenChange={() => setViewingTranscript(null)}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {viewingTranscript && getPurposeLabel(viewingTranscript.file.file_purpose)}
            </DialogTitle>
            <DialogDescription>
              {viewingTranscript && formatDate(viewingTranscript.file.created_at)}
            </DialogDescription>
          </DialogHeader>
          {viewingTranscript?.loading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-slate-600" />
            </div>
          ) : (
            <div className="space-y-4">
              {viewingTranscript?.segments.map((segment, index) => (
                <div key={index} className="flex gap-3">
                  <div className="text-xs text-slate-500 font-mono whitespace-nowrap">
                    {formatTimecode(segment.start_ms)}
                  </div>
                  <div className="flex-1">
                    <span className="text-xs font-semibold text-slate-700">
                      {segment.speaker}:
                    </span>{' '}
                    <span className="text-sm text-slate-900">{segment.text}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete File Confirmation Dialog */}
      <AlertDialog open={!!deletingFile} onOpenChange={() => setDeletingFile(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Aufnahme löschen?</AlertDialogTitle>
            <AlertDialogDescription>
              Diese Aktion kann nicht rückgängig gemacht werden. Die Aufnahme, das
              zugehörige Transkript und alle PII-Daten werden dauerhaft gelöscht.
              {deletingFile?.file_purpose === 'meeting' && (
                <span className="flex items-start gap-1 mt-2 text-amber-600 font-medium">
                  <FileText className="h-4 w-4 mt-0.5 flex-shrink-0" />
                  <span>Warnung: Dies ist eine Besprechungsaufnahme. Der Bericht könnte
                  dadurch unvollständig werden.</span>
                </span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Abbrechen</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteFile}
              disabled={deleting}
              className="bg-red-600 hover:bg-red-700"
            >
              {deleting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Wird gelöscht...
                </>
              ) : (
                'Löschen'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardLayout>
  )
}
