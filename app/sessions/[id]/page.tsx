'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { Breadcrumbs } from '@/components/layout/Breadcrumbs'
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
import { Loader2, ArrowLeft, FileText, Download, FileAudio, PlayCircle, Eye, Trash2, Languages, Sparkles, MessageSquare, Lock, ListTodo, ChevronDown, Mic } from 'lucide-react'
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

  useEffect(() => {
    loadSession()
    const interval = setInterval(loadSession, 3000)
    return () => clearInterval(interval)
  }, [sessionId])

  const loadSession = async () => {
    try {
      const response = await fetch(`/api/sessions/${sessionId}`)
      if (response.ok) {
        const data = await response.json()
        const { files: sessionFiles, ...sessionData } = data
        setSession(sessionData)
        setFiles(sessionFiles || [])
      } else {
        toast.error('Fehler beim Laden des Gesprächs')
        router.push('/dashboard')
      }
    } catch (error) {
      toast.error('Fehler beim Laden des Gesprächs')
    } finally {
      setLoading(false)
    }
  }

  const handleFileSelected = async (file: File, purpose: FilePurpose) => {
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

      await uploadAudio(file, duration, purpose)
    })

    audio.addEventListener('error', async () => {
      durationDetected = true
      clearTimeout(audioLoadTimeout)
      URL.revokeObjectURL(audio.src)

      if (file.size < 1024) {
        toast.error('Die Datei scheint leer oder beschädigt zu sein.')
      } else {
        toast.warning('Audiodauer konnte nicht ermittelt werden. Upload wird versucht...')
        await uploadAudio(file, 0, purpose)
      }
    })

    audioLoadTimeout = setTimeout(async () => {
      if (!durationDetected) {
        URL.revokeObjectURL(audio.src)
        toast.warning('Audiodauer konnte nicht ermittelt werden. Upload wird versucht...')
        await uploadAudio(file, 0, purpose)
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

  const handleUpdateReportLanguage = async (language: string) => {
    try {
      const response = await fetch(`/api/sessions/${sessionId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ preferred_report_language: language === 'auto' ? null : language }),
      })

      if (response.ok) {
        const updatedSession = await response.json()
        setSession(updatedSession)
        toast.success('Report-Sprache aktualisiert')
      } else {
        toast.error('Fehler beim Aktualisieren der Sprache')
      }
    } catch (error) {
      toast.error('Fehler beim Aktualisieren der Sprache')
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

  const formatTimecode = (ms: number): string => {
    const totalSeconds = Math.floor(ms / 1000)
    const minutes = Math.floor(totalSeconds / 60)
    const seconds = totalSeconds % 60
    return `${minutes}:${seconds.toString().padStart(2, '0')}`
  }

  const getStatusBadge = (status: string) => {
    const variants: Record<string, { variant: 'default' | 'secondary' | 'destructive' | 'outline'; text: string }> = {
      created: { variant: 'secondary', text: 'Bereit' },
      uploading: { variant: 'default', text: 'Wird hochgeladen' },
      transcribing: { variant: 'default', text: 'Wird transkribiert' },
      summarizing: { variant: 'default', text: 'Wird zusammengefasst' },
      done: { variant: 'outline', text: 'Fertig' },
      error: { variant: 'destructive', text: 'Fehler' },
    }

    const config = variants[status] || variants.created
    return <Badge variant={config.variant}>{config.text}</Badge>
  }

  const getPurposeLabel = (purpose: FilePurpose) => {
    const labels = {
      context: '🎯 Kontext',
      meeting: '💬 Besprechung',
      dictation: '📝 Diktat',
      instruction: '📋 Anweisungen',
      addition: '➕ Ergänzung',
    }
    return labels[purpose] || purpose
  }

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return bytes + ' B'
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + ' KB'
    return (bytes / (1024 * 1024)).toFixed(2) + ' MB'
  }

  const formatDate = (dateString: string): string => {
    const date = new Date(dateString)
    return date.toLocaleString('de-DE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  if (loading || !session) {
    return (
      <DashboardLayout>
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-slate-600" />
        </div>
      </DashboardLayout>
    )
  }

  // Build breadcrumb items
  const breadcrumbItems = session.case_id
    ? [
        { label: 'Projekte', href: '/dashboard' },
        { label: 'Projekt', href: `/cases/${session.case_id}` },
        { label: session.internal_case_id || `Gespräch ${session.id.slice(0, 8)}` },
      ]
    : [
        { label: 'Gespräche', href: '/dashboard' },
        { label: session.internal_case_id || `Gespräch ${session.id.slice(0, 8)}` },
      ]

  return (
    <DashboardLayout>
      <div className="max-w-4xl mx-auto space-y-6">
        <Breadcrumbs items={breadcrumbItems} />
        
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => session.case_id ? router.push(`/cases/${session.case_id}`) : router.push('/dashboard')}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="flex-1">
            <EditableTitle
              value={session.internal_case_id}
              fallback={`Gespräch ${session.id.slice(0, 8)}`}
              onSave={handleUpdateSessionName}
              placeholder="Gesprächsname eingeben"
            />
          </div>
          <div className="flex items-center gap-2">
            {getStatusBadge(session.status)}
            <BugReporter
              caseId={session.case_id}
              sessionId={session.id}
              variant="ghost"
              size="sm"
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

        <Collapsible defaultOpen={false}>
          <div className="border rounded-lg border-purple-200 bg-white">
            <CollapsibleTrigger className="w-full p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Languages className="h-5 w-5 text-purple-600" />
                  <div className="text-left">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-sm">Report-Sprache</span>
                      <Badge variant="outline" className="bg-purple-100 text-purple-700">
                        {session.preferred_report_language === 'de' ? '🇩🇪 Deutsch' : 
                         session.preferred_report_language === 'en' ? '🇬🇧 English' : 
                         '🤖 Automatisch'}
                      </Badge>
                    </div>
                  </div>
                </div>
                <ChevronDown className="h-4 w-4 text-slate-400 transition-transform" />
              </div>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="p-4 pt-0 space-y-3">
                <p className="text-xs text-slate-600">
                  Wähle die Sprache für den generierten Bericht. "Automatisch" nutzt die erkannte Audiosprache.
                </p>
                <Select
                  value={session.preferred_report_language || 'auto'}
                  onValueChange={handleUpdateReportLanguage}
                >
                  <SelectTrigger className="w-full sm:w-[280px]">
                    <SelectValue placeholder="Sprache auswählen" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="auto">
                      <div className="flex items-center gap-2">
                        <span>🤖</span>
                        <span>Automatisch (empfohlen)</span>
                      </div>
                    </SelectItem>
                    <SelectItem value="de">
                      <div className="flex items-center gap-2">
                        <span>🇩🇪</span>
                        <span>Deutsch</span>
                      </div>
                    </SelectItem>
                    <SelectItem value="en">
                      <div className="flex items-center gap-2">
                        <span>🇬🇧</span>
                        <span>English</span>
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CollapsibleContent>
          </div>
        </Collapsible>

        {/* Kontext Section - Before Recordings */}
        <CompactTranscribableField
          title="Kontext"
          description="Teilnehmer, Agenda, Hintergründe - per Live-Diktat oder Text"
          icon={<MessageSquare className="h-5 w-5" />}
          value={(session as any).context_text || ''}
          locked={(session as any).context_text_locked || false}
          placeholder="Teilnehmer:\n- Max Mustermann (CEO)\n- Anna Schmidt (CFO)\n\nAgenda:\n1. Q4 Review\n2. Budget Planning"
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

        {/* Aufnahmen Section - Compact */}
        <Collapsible defaultOpen={files.length > 0}>
          <div className="border rounded-lg border-slate-200 bg-white">
            <CollapsibleTrigger className="w-full p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <FileAudio className="h-5 w-5 text-slate-600" />
                  <div className="text-left">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-sm">Aufnahmen</span>
                      {files.length > 0 && (
                        <Badge variant="outline" className="bg-slate-100 text-slate-700">
                          {files.length} Datei{files.length !== 1 ? 'en' : ''}
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>
                <ChevronDown className="h-4 w-4 text-slate-400 transition-transform" />
              </div>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="p-4 pt-0 space-y-2">
                {files.length === 0 ? (
                  <p className="text-sm text-slate-500">Noch keine Aufnahmen</p>
                ) : (
                  files.map((file, index) => (
                    <div
                      key={file.id}
                      className="flex items-center gap-3 p-3 border rounded-lg hover:bg-slate-50 transition-colors"
                    >
                      <FileAudio className="w-4 h-4 text-blue-600 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs font-medium text-slate-900">
                            {getPurposeLabel(file.file_purpose)}
                          </span>
                          <Badge variant="outline" className="text-xs">
                            #{index + 1}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-2 text-xs text-slate-500">
                          <span>{formatFileSize(file.size_bytes)}</span>
                          <span>•</span>
                          <span>{formatDate(file.created_at)}</span>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleViewTranscript(file)}
                        >
                          <Eye className="h-4 w-4 mr-1" />
                          Transkript
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => router.push(`/sessions/${sessionId}/report`)}
                        >
                          <FileText className="h-4 w-4 mr-1" />
                          Bericht
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setDeletingFile(file)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CollapsibleContent>
          </div>
        </Collapsible>

        {/* Audio Upload/Record - Compact */}
        {session.status === 'created' && (
          <Collapsible defaultOpen={files.length === 0}>
            <div className="border rounded-lg border-green-200 bg-white">
              <CollapsibleTrigger className="w-full p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Mic className="h-5 w-5 text-green-600" />
                    <div className="text-left">
                      <span className="font-semibold text-sm">Audio hinzufügen</span>
                    </div>
                  </div>
                  <ChevronDown className="h-4 w-4 text-slate-400 transition-transform" />
                </div>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div className="p-4 pt-0 space-y-4">
                  {/* Show local recordings if any exist */}
                  <LocalRecordingsList
                    onUploadRecording={async (blob, duration, purpose) => {
                      await uploadAudio(blob, duration, purpose)
                    }}
                  />

                  <Tabs defaultValue="record" className="w-full">
                    <TabsList className="grid w-full grid-cols-2 mb-3">
                      <TabsTrigger value="record">Aufnehmen</TabsTrigger>
                      <TabsTrigger value="upload">Hochladen</TabsTrigger>
                    </TabsList>
                    <TabsContent value="record" className="mt-0">
                      <AudioRecorder
                        onRecordingComplete={(blob, duration, purpose) => 
                          uploadAudio(blob, duration, purpose)
                        }
                      />
                    </TabsContent>
                    <TabsContent value="upload" className="mt-0">
                      <AudioUploader
                        onFileSelected={handleFileSelected}
                      />
                    </TabsContent>
                  </Tabs>
                </div>
              </CollapsibleContent>
            </div>
          </Collapsible>
        )}

        <CompactTranscribableField
          title="Private Notizen"
          description="Persönliche Beobachtungen die NICHT im Report erscheinen"
          icon={<Lock className="h-5 w-5" />}
          value={(session as any).private_comments || ''}
          locked={(session as any).private_comments_locked || false}
          placeholder="Private Gedanken:\n- Patient wirkte angespannt\n- Nächste Sitzung anders strukturieren"
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

        <CompactTranscribableField
          title="Anweisungen"
          description="Spezielle Anweisungen wie der Report strukturiert werden soll"
          icon={<ListTodo className="h-5 w-5" />}
          value={(session as any).instructions || ''}
          locked={(session as any).instructions_locked || false}
          placeholder="Anweisungen:\n- Fokus auf Budget-Diskussion\n- Erwähne Zeitplan-Bedenken\n- Ton: formal und sachlich"
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
                  <p className="font-semibold text-sm text-green-900">Bericht neu generieren</p>
                  <p className="text-xs text-green-700">
                    {session.status === 'summarizing' ? 'Wird gerade erstellt...' : 'Erstelle einen neuen Bericht mit aktualisierten Einstellungen'}
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
                    Neu generieren
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        )}

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
                <span className="block mt-2 text-amber-600 font-medium">
                  ⚠️ Warnung: Dies ist eine Besprechungsaufnahme. Der Bericht könnte
                  dadurch unvollständig werden.
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
