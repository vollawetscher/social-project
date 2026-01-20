'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { AudioRecorder } from '@/components/audio/AudioRecorder'
import { AudioUploader } from '@/components/audio/AudioUploader'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { EditableTitle } from '@/components/ui/editable-title'
import { toast } from 'sonner'
import { Session } from '@/lib/types/database'
import { Loader2, ArrowLeft, FileText, Download } from 'lucide-react'

export default function SessionDetailPage() {
  const params = useParams()
  const router = useRouter()
  const sessionId = params.id as string

  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null)
  const [recordedDuration, setRecordedDuration] = useState(0)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)

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
        setSession(data)
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

  const handleRecordingComplete = (blob: Blob, duration: number) => {
    setRecordedBlob(blob)
    setRecordedDuration(duration)
  }

  const handleFileSelected = (file: File) => {
    setSelectedFile(file)
  }

  const uploadAudio = async (file: File | Blob, duration: number) => {
    setUploading(true)

    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('duration', duration.toString())

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
      await uploadAudio(recordedBlob, recordedDuration)
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

        await uploadAudio(selectedFile, duration)
      })

      audio.addEventListener('error', async () => {
        durationDetected = true
        clearTimeout(audioLoadTimeout)
        URL.revokeObjectURL(audio.src)

        if (selectedFile.size < 1024) {
          toast.error('Die Datei scheint leer oder beschädigt zu sein.')
        } else {
          toast.warning('Audiodauer konnte nicht ermittelt werden. Upload wird versucht...')
          await uploadAudio(selectedFile, 0)
        }
      })

      audioLoadTimeout = setTimeout(async () => {
        if (!durationDetected) {
          URL.revokeObjectURL(audio.src)
          toast.warning('Audiodauer konnte nicht ermittelt werden. Upload wird versucht...')
          await uploadAudio(selectedFile, 0)
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
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => router.push('/dashboard')}
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
          {getStatusBadge(session.status)}
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

        {session.status === 'created' && session.duration_sec === 0 && (
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

        {session.status === 'done' && (
          <Card>
            <CardContent className="flex flex-col items-center py-12">
              <FileText className="h-12 w-12 text-green-600 mb-4" />
              <h3 className="text-lg font-semibold text-slate-900 mb-2">
                Verarbeitung abgeschlossen
              </h3>
              <p className="text-slate-600 text-center mb-6">
                Transkript und Bericht sind fertig und können angezeigt werden.
              </p>
              <div className="flex gap-2">
                <Button onClick={() => router.push(`/sessions/${sessionId}/transcript`)}>
                  Transkript ansehen
                </Button>
                <Button onClick={() => router.push(`/sessions/${sessionId}/report`)}>
                  Bericht ansehen
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  )
}
