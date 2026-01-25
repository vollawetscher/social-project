'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { Breadcrumbs } from '@/components/layout/Breadcrumbs'
import { AudioRecorder } from '@/components/audio/AudioRecorder'
import { AudioUploader } from '@/components/audio/AudioUploader'
import { BugReporter } from '@/components/error/BugReporter'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { EditableTitle } from '@/components/ui/editable-title'
import { toast } from 'sonner'
import { Session, FilePurpose, File as FileType, TranscriptSegment } from '@/lib/types/database'
import { Loader2, ArrowLeft, FileText, Download, FileAudio, PlayCircle, Eye, Trash2 } from 'lucide-react'
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

export default function SessionDetailPage() {
  const params = useParams()
  const router = useRouter()
  const sessionId = params.id as string

  const [session, setSession] = useState<Session | null>(null)
  const [files, setFiles] = useState<FileType[]>([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null)
  const [recordedDuration, setRecordedDuration] = useState(0)
  const [recordedPurpose, setRecordedPurpose] = useState<FilePurpose>('meeting')
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [selectedFilePurpose, setSelectedFilePurpose] = useState<FilePurpose>('meeting')
  const [viewingTranscript, setViewingTranscript] = useState<{
    file: FileType
    segments: TranscriptSegment[]
    loading: boolean
  } | null>(null)
  const [deletingFile, setDeletingFile] = useState<FileType | null>(null)
  const [deleting, setDeleting] = useState(false)

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
        toast.error('Fehler beim Laden der Sitzung')
        router.push('/dashboard')
      }
    } catch (error) {
      toast.error('Fehler beim Laden der Sitzung')
    } finally {
      setLoading(false)
    }
  }

  const handleRecordingComplete = (blob: Blob, duration: number, purpose: FilePurpose) => {
    setRecordedBlob(blob)
    setRecordedDuration(duration)
    setRecordedPurpose(purpose)
  }

  const handleFileSelected = (file: File, purpose: FilePurpose) => {
    setSelectedFile(file)
    setSelectedFilePurpose(purpose)
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

  const handleUploadRecording = async () => {
    if (recordedBlob) {
      await uploadAudio(recordedBlob, recordedDuration, recordedPurpose)
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
        toast.success('Sitzungsname aktualisiert')
      } else {
        toast.error('Fehler beim Aktualisieren des Namens')
      }
    } catch (error) {
      toast.error('Fehler beim Aktualisieren des Namens')
    }
  }

  const handleUploadFile = async () => {
    if (selectedFile) {
      const audio = document.createElement('audio')
      audio.src = URL.createObjectURL(selectedFile)

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

        await uploadAudio(selectedFile, duration, selectedFilePurpose)
      })

      audio.addEventListener('error', async () => {
        durationDetected = true
        clearTimeout(audioLoadTimeout)
        URL.revokeObjectURL(audio.src)

        if (selectedFile.size < 1024) {
          toast.error('Die Datei scheint leer oder beschädigt zu sein.')
        } else {
          toast.warning('Audiodauer konnte nicht ermittelt werden. Upload wird versucht...')
          await uploadAudio(selectedFile, 0, selectedFilePurpose)
        }
      })

      audioLoadTimeout = setTimeout(async () => {
        if (!durationDetected) {
          URL.revokeObjectURL(audio.src)
          toast.warning('Audiodauer konnte nicht ermittelt werden. Upload wird versucht...')
          await uploadAudio(selectedFile, 0, selectedFilePurpose)
        }
      }, 5000)
    }
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
        { label: session.internal_case_id || `Sitzung ${session.id.slice(0, 8)}` },
      ]
    : [
        { label: 'Sitzungen', href: '/dashboard' },
        { label: session.internal_case_id || `Sitzung ${session.id.slice(0, 8)}` },
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
              fallback={`Sitzung ${session.id.slice(0, 8)}`}
              onSave={handleUpdateSessionName}
              placeholder="Sitzungsname eingeben"
            />
            {session.context_note && (
              <p className="text-slate-600 mt-1">{session.context_note}</p>
            )}
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

        {files.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Aufnahmen ({files.length})</CardTitle>
              <CardDescription>
                Hochgeladene Audiodateien für diese Sitzung
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {files.map((file, index) => (
                  <div
                    key={file.id}
                    className="flex items-center gap-3 p-3 border rounded-lg hover:bg-slate-50 transition-colors"
                  >
                    <FileAudio className="w-5 h-5 text-blue-600 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-sm font-medium text-slate-900">
                          {getPurposeLabel(file.file_purpose)}
                        </span>
                        <Badge variant="outline" className="text-xs">
                          #{index + 1}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-slate-600">
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
                        onClick={() => setDeletingFile(file)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {session.status === 'created' && (
          <Tabs defaultValue="record" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="record">Aufnehmen</TabsTrigger>
              <TabsTrigger value="upload">Hochladen</TabsTrigger>
            </TabsList>

            <TabsContent value="record" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Audio aufnehmen</CardTitle>
                  <CardDescription>
                    Nehmen Sie das Gespräch direkt im Browser auf
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <AudioRecorder onRecordingComplete={handleRecordingComplete} />

                  {recordedBlob && (
                    <Button
                      onClick={handleUploadRecording}
                      disabled={uploading}
                      className="w-full"
                      size="lg"
                    >
                      {uploading ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Wird hochgeladen...
                        </>
                      ) : (
                        <>
                          <FileText className="mr-2 h-4 w-4" />
                          Aufnahme speichern und transkribieren
                        </>
                      )}
                    </Button>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="upload" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Audiodatei hochladen</CardTitle>
                  <CardDescription>
                    Laden Sie eine bestehende Audiodatei hoch (MP3, WAV, M4A, MP4, OGG, AAC, FLAC)
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <AudioUploader onFileSelected={handleFileSelected} />

                  {selectedFile && (
                    <Button
                      onClick={handleUploadFile}
                      disabled={uploading}
                      className="w-full"
                      size="lg"
                    >
                      {uploading ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Wird hochgeladen...
                        </>
                      ) : (
                        <>
                          <FileText className="mr-2 h-4 w-4" />
                          Datei hochladen und transkribieren
                        </>
                      )}
                    </Button>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        )}

        {session.status === 'transcribing' && (
          <Card>
            <CardContent className="flex flex-col items-center py-12">
              <Loader2 className="h-12 w-12 animate-spin text-blue-600 mb-4" />
              <h3 className="text-lg font-semibold text-slate-900 mb-2">
                Transkription läuft
              </h3>
              <p className="text-slate-600 text-center">
                Die Audiodatei wird gerade transkribiert. Dies kann einige Minuten dauern.
              </p>
            </CardContent>
          </Card>
        )}

        {session.status === 'summarizing' && (
          <Card>
            <CardContent className="flex flex-col items-center py-12">
              <Loader2 className="h-12 w-12 animate-spin text-blue-600 mb-4" />
              <h3 className="text-lg font-semibold text-slate-900 mb-2">
                Bericht wird erstellt
              </h3>
              <p className="text-slate-600 text-center">
                Der Rohbericht wird mit KI generiert. Bitte warten Sie einen Moment.
              </p>
            </CardContent>
          </Card>
        )}

        {session.status === 'done' && files.some(f => f.file_purpose === 'meeting') && (
          <Card>
            <CardContent className="flex flex-col items-center py-12">
              <FileText className="h-12 w-12 text-green-600 mb-4" />
              <h3 className="text-lg font-semibold text-slate-900 mb-2">
                Verarbeitung abgeschlossen
              </h3>
              <p className="text-slate-600 text-center mb-6">
                Transkript und Bericht sind fertig und können angezeigt werden.
              </p>
              <div className="flex flex-wrap gap-2 justify-center">
                <Button onClick={() => router.push(`/sessions/${sessionId}/transcript`)}>
                  Transkript ansehen
                </Button>
                <Button onClick={() => router.push(`/sessions/${sessionId}/report`)}>
                  Bericht ansehen
                </Button>
                <Button 
                  variant="outline" 
                  onClick={triggerSummarization}
                >
                  Bericht neu generieren
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {session.status === 'done' && files.length > 0 && !files.some(f => f.file_purpose === 'meeting') && (
          <Card className="border-amber-200 bg-amber-50">
            <CardContent className="flex flex-col items-center py-12">
              <FileText className="h-12 w-12 text-amber-600 mb-4" />
              <h3 className="text-lg font-semibold text-slate-900 mb-2">
                Nur Kontext-/Zusatzaufnahmen
              </h3>
              <p className="text-slate-600 text-center mb-6">
                Diese Sitzung enthält keine Besprechungsaufnahme. Fügen Sie eine hinzu oder
                generieren Sie manuell einen Bericht aus den vorhandenen Aufnahmen.
              </p>
              <div className="flex gap-2">
                <Button variant="outline" onClick={triggerSummarization}>
                  Bericht trotzdem generieren
                </Button>
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
