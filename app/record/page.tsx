'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Mic, Upload, Trash2, Play, Pause, Clock, HardDrive, LogIn } from 'lucide-react'
import { toast } from 'sonner'
import { AudioRecorder } from '@/components/audio/AudioRecorder'
import { localStorageService, LocalRecording } from '@/lib/services/local-storage'
import { useAuth } from '@/lib/auth/AuthProvider'
import { InstallPrompt } from '@/components/pwa/InstallPrompt'

export default function QuickRecordPage() {
  const [recordings, setRecordings] = useState<LocalRecording[]>([])
  const [totalSize, setTotalSize] = useState(0)
  const [showRecorder, setShowRecorder] = useState(false)
  const [playingId, setPlayingId] = useState<string | null>(null)
  const router = useRouter()
  const { user, loading } = useAuth()

  useEffect(() => {
    loadRecordings()
  }, [])

  const loadRecordings = async () => {
    try {
      const recs = await localStorageService.getAllRecordings()
      const size = await localStorageService.getTotalSize()
      
      // Sort by timestamp (newest first)
      recs.sort((a, b) => b.timestamp - a.timestamp)
      
      setRecordings(recs)
      setTotalSize(size)
    } catch (error) {
      console.error('Failed to load recordings:', error)
      toast.error('Fehler beim Laden der Aufnahmen')
    }
  }

  const handleRecordingComplete = async (blob: Blob, duration: number) => {
    try {
      const recording: LocalRecording = {
        id: `rec_${Date.now()}_${Math.random().toString(36).substring(7)}`,
        blob,
        duration,
        timestamp: Date.now(),
        mimeType: blob.type,
        size: blob.size,
      }

      await localStorageService.saveRecording(recording)
      toast.success('Aufnahme gespeichert')
      setShowRecorder(false)
      await loadRecordings()
    } catch (error) {
      console.error('Failed to save recording:', error)
      toast.error('Fehler beim Speichern')
    }
  }

  const handleDelete = async (id: string) => {
    try {
      await localStorageService.deleteRecording(id)
      toast.success('Aufnahme gelöscht')
      await loadRecordings()
    } catch (error) {
      console.error('Failed to delete recording:', error)
      toast.error('Fehler beim Löschen')
    }
  }

  const handleUpload = () => {
    if (!user) {
      toast.error('Bitte melde dich an, um Aufnahmen hochzuladen')
      router.push(`/login?redirect=/record`)
      return
    }
    
    // Navigate to upload page with recordings
    router.push('/record/upload')
  }

  const handlePlay = async (id: string) => {
    try {
      const recording = await localStorageService.getRecording(id)
      if (!recording) return

      if (playingId === id) {
        setPlayingId(null)
        return
      }

      const audio = new Audio(URL.createObjectURL(recording.blob))
      audio.play()
      setPlayingId(id)

      audio.onended = () => setPlayingId(null)
    } catch (error) {
      console.error('Failed to play recording:', error)
      toast.error('Wiedergabe fehlgeschlagen')
    }
  }

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  const formatSize = (bytes: number) => {
    return (bytes / 1024 / 1024).toFixed(1) + ' MB'
  }

  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp)
    const today = new Date()
    const yesterday = new Date(today)
    yesterday.setDate(yesterday.getDate() - 1)

    if (date.toDateString() === today.toDateString()) {
      return 'Heute ' + date.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })
    } else if (date.toDateString() === yesterday.toDateString()) {
      return 'Gestern ' + date.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })
    } else {
      return date.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' }) + ' ' +
             date.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })
    }
  }

  return (
    <>
      <InstallPrompt />
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-blue-100 p-4">
      <div className="max-w-2xl mx-auto space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-primary">Schnellaufnahme</h1>
            <p className="text-sm text-muted-foreground">
              Aufnehmen ohne Anmeldung • Später hochladen
            </p>
          </div>
          {!loading && !user && (
            <Button variant="outline" size="sm" onClick={() => router.push('/login')}>
              <LogIn className="h-4 w-4 mr-2" />
              Anmelden
            </Button>
          )}
        </div>

        {/* Storage Info */}
        {recordings.length > 0 && (
          <Card className="p-4 bg-primary/10 border-primary/30">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm text-primary">
                <HardDrive className="h-4 w-4" />
                <span>{recordings.length} Aufnahmen • {formatSize(totalSize)}</span>
              </div>
              {user && recordings.length > 0 && (
                <Button size="sm" onClick={handleUpload}>
                  <Upload className="h-4 w-4 mr-2" />
                  Hochladen
                </Button>
              )}
            </div>
          </Card>
        )}

        {/* Recorder */}
        {showRecorder ? (
          <Card className="p-6 border-primary/20 bg-gradient-to-br from-white to-primary/5">
            <AudioRecorder
              onRecordingComplete={handleRecordingComplete}
            />
            <Button
              variant="ghost"
              className="w-full mt-4"
              onClick={() => setShowRecorder(false)}
            >
              Abbrechen
            </Button>
          </Card>
        ) : (
          <Button
            size="lg"
            className="w-full h-24 text-lg shadow-lg"
            onClick={() => setShowRecorder(true)}
          >
            <Mic className="h-8 w-8 mr-3" />
            Neue Aufnahme
          </Button>
        )}

        {/* Recordings List */}
        {recordings.length > 0 ? (
          <div className="space-y-2">
            <h2 className="text-sm font-semibold text-foreground px-1">
              Gespeicherte Aufnahmen
            </h2>
            {recordings.map((rec) => (
              <Card key={rec.id} className="p-3 border-primary/20 bg-gradient-to-br from-white to-primary/5">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <Clock className="h-3.5 w-3.5 text-primary" />
                      <span className="text-sm font-medium text-foreground">
                        {formatDuration(rec.duration)}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {formatSize(rec.size)}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground">{formatDate(rec.timestamp)}</p>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => handlePlay(rec.id)}
                      className="h-8 w-8"
                    >
                      {playingId === rec.id ? (
                        <Pause className="h-4 w-4" />
                      ) : (
                        <Play className="h-4 w-4" />
                      )}
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => handleDelete(rec.id)}
                      className="h-8 w-8 hover:bg-destructive/10 hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        ) : !showRecorder && (
          <Card className="p-8 text-center border-primary/20 bg-gradient-to-br from-white to-primary/5">
            <Mic className="h-12 w-12 text-primary mx-auto mb-3" />
            <p className="text-foreground font-medium">Noch keine Aufnahmen</p>
            <p className="text-sm text-muted-foreground mt-1">
              Starte deine erste Aufnahme – keine Anmeldung nötig
            </p>
          </Card>
        )}

        {/* Info Footer */}
        <Card className="p-4 border-primary/20 bg-white/50">
          <h3 className="font-semibold text-sm text-foreground mb-2">ℹ️ Wie funktioniert's?</h3>
          <ul className="text-xs text-muted-foreground space-y-1">
            <li>✅ Aufnehmen ohne Anmeldung</li>
            <li>✅ Aufnahmen bleiben auf deinem Gerät</li>
            <li>✅ Später anmelden und hochladen</li>
            <li>✅ Erst beim Upload wird transkribiert</li>
          </ul>
        </Card>
      </div>
    </div>
    </>
  )
}
