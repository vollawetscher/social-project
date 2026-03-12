'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Play, Pause, Trash2, Clock, HardDrive, Upload } from 'lucide-react'
import { toast } from 'sonner'
import { localStorageService, LocalRecording } from '@/lib/services/local-storage'
import { formatDuration } from '@/lib/utils/date-formatters'

interface LocalRecordingsListProps {
  onFileSelected: (file: File) => void
}

export function LocalRecordingsList({ onFileSelected }: LocalRecordingsListProps) {
  const [recordings, setRecordings] = useState<LocalRecording[]>([])
  const [playingId, setPlayingId] = useState<string | null>(null)
  const [uploadingId, setUploadingId] = useState<string | null>(null)
  const [currentAudio, setCurrentAudio] = useState<HTMLAudioElement | null>(null)

  useEffect(() => {
    loadRecordings()
  }, [])

  const loadRecordings = async () => {
    try {
      const recs = await localStorageService.getAllRecordings()
      recs.sort((a, b) => b.timestamp - a.timestamp)
      setRecordings(recs)
    } catch (error) {
      console.error('Failed to load local recordings:', error)
    }
  }

  const handlePlay = async (id: string) => {
    try {
      // Toggle: If already playing this recording, stop it
      if (playingId === id && currentAudio) {
        currentAudio.pause()
        currentAudio.currentTime = 0
        setPlayingId(null)
        setCurrentAudio(null)
        return
      }

      // Stop any currently playing audio
      if (currentAudio) {
        currentAudio.pause()
        currentAudio.currentTime = 0
      }

      // Start playing new recording
      const recording = await localStorageService.getRecording(id)
      if (!recording) return

      const audio = new Audio(URL.createObjectURL(recording.blob))
      audio.play()
      setPlayingId(id)
      setCurrentAudio(audio)

      audio.onended = () => {
        setPlayingId(null)
        setCurrentAudio(null)
      }
    } catch (error) {
      console.error('Failed to play recording:', error)
      toast.error('Wiedergabe fehlgeschlagen')
    }
  }

  const handleUpload = async (id: string) => {
    try {
      setUploadingId(id)
      const recording = await localStorageService.getRecording(id)
      if (!recording) {
        toast.error('Aufnahme nicht gefunden')
        return
      }

      // Determine file extension from mimeType
      const extension = recording.mimeType.split('/')[1]?.split(';')[0] || 'webm'
      const timestamp = new Date(recording.timestamp).toISOString().replace(/[:.]/g, '-')
      
      // Convert Blob to File with proper name
      const file = new File(
        [recording.blob], 
        `local-recording-${timestamp}.${extension}`,
        { type: recording.mimeType }
      )

      // Upload via parent component's handler (AI will classify after transcription)
      onFileSelected(file)

      // Delete from local storage after triggering upload
      await localStorageService.deleteRecording(id)
      toast.success('Lokale Aufnahme wird hochgeladen')
      
      // Reload list
      await loadRecordings()
    } catch (error: any) {
      console.error('Failed to upload recording:', error)
      toast.error('Fehler beim Hochladen: ' + error.message)
    } finally {
      setUploadingId(null)
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

  const formatSize = (bytes: number) => {
    return (bytes / 1024 / 1024).toFixed(1) + ' MB'
  }

  if (recordings.length === 0) return null

  return (
    <Card className="p-4 bg-blue-50 border-blue-200">
      <div className="flex items-center gap-2 mb-3">
        <HardDrive className="h-5 w-5 text-blue-600" />
        <h3 className="font-semibold text-blue-900">
          Lokale Aufnahmen
        </h3>
        <Badge variant="outline" className="bg-blue-100 text-blue-700">
          {recordings.length}
        </Badge>
      </div>
      
      <p className="text-xs text-blue-700 mb-3">
        Diese Aufnahmen wurden lokal gespeichert ({recordings.reduce((total, rec) => total + rec.size, 0) > 1024 * 1024 ? 
          formatSize(recordings.reduce((total, rec) => total + rec.size, 0)) : 
          Math.round(recordings.reduce((total, rec) => total + rec.size, 0) / 1024) + ' KB'}). 
        Wähle den Typ und lade sie hoch.
      </p>

      <div className="space-y-2">
        {recordings.map((rec) => (
          <Card key={rec.id} className="p-3 bg-white">
            <div className="space-y-2">
              <div className="flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <Clock className="h-3 w-3 text-slate-400" />
                    <span className="text-sm font-medium text-slate-900">
                      {formatDuration(rec.duration)}
                    </span>
                    <span className="text-xs text-slate-500">
                      {formatSize(rec.size)}
                    </span>
                    <Badge variant="outline" className="text-xs">
                      {rec.mimeType.split('/')[1]?.split(';')[0].toUpperCase()}
                    </Badge>
                  </div>
                  <p className="text-xs text-slate-500">{formatDate(rec.timestamp)}</p>
                </div>
                
                <div className="flex items-center gap-1">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handlePlay(rec.id)}
                    disabled={uploadingId === rec.id}
                    title="Abspielen"
                  >
                    {playingId === rec.id ? (
                      <Pause className="h-4 w-4" />
                    ) : (
                      <Play className="h-4 w-4" />
                    )}
                  </Button>
                  
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleDelete(rec.id)}
                    disabled={uploadingId === rec.id}
                    className="text-red-600 hover:text-red-700 hover:bg-red-50"
                    title="Löschen"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              <div className="flex items-center gap-2 justify-end">
                <Button
                  size="sm"
                  onClick={() => handleUpload(rec.id)}
                  disabled={uploadingId === rec.id}
                  className="bg-blue-600 hover:bg-blue-700 text-white"
                >
                  <Upload className="h-4 w-4 mr-1" />
                  Hochladen
                </Button>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </Card>
  )
}
