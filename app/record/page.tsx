'use client'
export const dynamic = 'force-dynamic'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Mic, Upload, Trash2, Play, Pause, Clock, HardDrive, LogIn, ArrowLeft, Download } from 'lucide-react'
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
  const [currentAudio, setCurrentAudio] = useState<HTMLAudioElement | null>(null)
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
      toast.error('Failed to load recordings')
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
      toast.success('Recording saved')
      setShowRecorder(false)
      await loadRecordings()
    } catch (error) {
      console.error('Failed to save recording:', error)
      toast.error('Failed to save recording')
    }
  }

  const handleDelete = async (id: string) => {
    try {
      await localStorageService.deleteRecording(id)
      toast.success('Recording deleted')
      await loadRecordings()
    } catch (error) {
      console.error('Failed to delete recording:', error)
      toast.error('Failed to delete recording')
    }
  }

  const handleUpload = () => {
    if (!user) {
      toast.error('Please sign in to upload recordings')
      router.push(`/login?redirect=/record`)
      return
    }
    
    // Navigate to upload page with recordings
    router.push('/record/upload')
  }

  const handleDownload = async (rec: LocalRecording) => {
    try {
      // Use .weba for audio-only WebM so it shows as audio, not video
      const isAudio = rec.mimeType?.startsWith('audio/')
      const ext = isAudio && rec.mimeType?.includes('webm')
        ? 'weba'
        : rec.mimeType?.split('/')[1]?.replace(/;.*/, '') || 'webm'
      const date = new Date(rec.timestamp).toLocaleString('en-US', {
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      }).replace(/[/,]/g, '-')
      const filename = `Recording ${date}.${ext}`
      const file = new File([rec.blob], filename, { type: rec.mimeType })

      if (navigator.share && /iPhone|iPad|Android/i.test(navigator.userAgent)) {
        await navigator.share({
          files: [file],
          title: filename,
        })
        toast.success("Choose 'Save to Files' to pick a folder, or share to another app", { duration: 5000 })
      } else {
        const url = URL.createObjectURL(rec.blob)
        const a = document.createElement('a')
        a.href = url
        a.download = filename
        a.click()
        URL.revokeObjectURL(url)
        toast.success('Saved to your Downloads folder')
      }
    } catch (err) {
      if ((err as Error)?.name === 'AbortError') return
      toast.error('Failed to save file')
    }
  }

  const handlePlay = async (id: string) => {
    try {
      // If already playing, stop it
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
      toast.error('Playback failed')
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
      return 'Today ' + date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
    } else if (date.toDateString() === yesterday.toDateString()) {
      return 'Yesterday ' + date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
    } else {
      return date.toLocaleDateString('en-US', { month: '2-digit', day: '2-digit' }) + ' ' +
             date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
    }
  }

  return (
    <>
      <InstallPrompt />
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-blue-100 p-4">
      <div className="max-w-2xl mx-auto space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => router.back()}
              className="shrink-0"
              title="Back"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold text-primary">Quick Record</h1>
              <p className="text-sm text-muted-foreground">
                Record without login • Upload later
              </p>
            </div>
          </div>
          {!loading && !user && (
            <Button variant="outline" size="sm" onClick={() => router.push('/login')}>
              <LogIn className="h-4 w-4 mr-2" />
              Sign In
            </Button>
          )}
        </div>

        {/* Storage Info */}
        {recordings.length > 0 && (
          <Card className="p-4 bg-primary/10 border-primary/30">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm text-primary">
                <HardDrive className="h-4 w-4" />
                <span>{recordings.length} Recording{recordings.length !== 1 ? 's' : ''} • {formatSize(totalSize)}</span>
              </div>
              {user && recordings.length > 0 && (
                <Button size="sm" onClick={handleUpload}>
                  <Upload className="h-4 w-4 mr-2" />
                  Upload & Transcribe
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
              Cancel
            </Button>
          </Card>
        ) : (
          <Button
            size="lg"
            className="w-full h-24 text-lg shadow-lg"
            onClick={() => setShowRecorder(true)}
          >
            <Mic className="h-8 w-8 mr-3" />
            New Recording
          </Button>
        )}

        {/* Recordings List */}
        {recordings.length > 0 ? (
          <div className="space-y-2">
            <h2 className="text-sm font-semibold text-foreground px-1">
              Saved Recordings
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
                      title="Play"
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
                      onClick={() => handleDownload(rec)}
                      className="h-8 w-8"
                      title="Save to device"
                    >
                      <Download className="h-4 w-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => handleDelete(rec.id)}
                      className="h-8 w-8 hover:bg-destructive/10 hover:text-destructive"
                      title="Delete"
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
            <p className="text-foreground font-medium">No recordings yet</p>
            <p className="text-sm text-muted-foreground mt-1">
              Start your first recording – no sign-in required
            </p>
          </Card>
        )}

        {/* Info Footer */}
        <Card className="p-4 border-primary/20 bg-white/50">
          <h3 className="font-semibold text-sm text-foreground mb-2">ℹ️ How it works</h3>
          <ul className="text-xs text-muted-foreground space-y-1">
            <li>✅ Record without sign-in</li>
            <li>✅ Recordings stay on your device</li>
            <li>✅ Sign in later to upload</li>
            <li>✅ Transcription starts after upload</li>
          </ul>
        </Card>
      </div>
    </div>
    </>
  )
}
