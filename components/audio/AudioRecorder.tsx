'use client'

import { useState, useRef, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Mic, Square, Play, Pause, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { detectSupportedAudioFormat, isMobileSafari } from '@/lib/utils/audio-format-detector'
import { FilePurpose } from '@/lib/types/database'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

interface AudioRecorderProps {
  onRecordingComplete: (blob: Blob, duration: number, purpose: FilePurpose) => void
}

export function AudioRecorder({ onRecordingComplete }: AudioRecorderProps) {
  const [isRecording, setIsRecording] = useState(false)
  const [isPaused, setIsPaused] = useState(false)
  const [audioURL, setAudioURL] = useState<string | null>(null)
  const [duration, setDuration] = useState(0)
  const [recordingTime, setRecordingTime] = useState(0)
  const [recordingPurpose, setRecordingPurpose] = useState<FilePurpose>('meeting')
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const timerRef = useRef<NodeJS.Timeout | null>(null)
  const startTimeRef = useRef<number>(0)
  const pausedTimeRef = useRef<number>(0)
  const totalPausedTimeRef = useRef<number>(0)
  const recordedMimeTypeRef = useRef<string>('')

  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current)
      }
      if (audioURL) {
        URL.revokeObjectURL(audioURL)
      }
    }
  }, [audioURL])

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })

      const audioFormat = detectSupportedAudioFormat()
      console.log('[AudioRecorder] Using audio format:', audioFormat)

      if (isMobileSafari()) {
        console.log('[AudioRecorder] Mobile Safari detected')
      }

      const options: MediaRecorderOptions = {}
      if (audioFormat.mimeType) {
        options.mimeType = audioFormat.mimeType
      }

      const mediaRecorder = new MediaRecorder(stream, options)

      const actualMimeType = mediaRecorder.mimeType || audioFormat.mimeType || 'audio/webm'
      recordedMimeTypeRef.current = actualMimeType
      console.log('[AudioRecorder] MediaRecorder created with mimeType:', actualMimeType)

      chunksRef.current = []

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data)
          console.log('[AudioRecorder] Data chunk received:', e.data.size, 'bytes, total chunks:', chunksRef.current.length)
        }
      }

      mediaRecorder.onstop = async () => {
        // Wait for any pending dataavailable events to fire
        await new Promise(resolve => setTimeout(resolve, 200))
        
        const blob = new Blob(chunksRef.current, { type: recordedMimeTypeRef.current })
        const finalDuration = Math.floor((Date.now() - startTimeRef.current - totalPausedTimeRef.current) / 1000)
        
        console.log('[AudioRecorder] Recording stopped:', {
          blobSize: blob.size,
          blobType: blob.type,
          chunks: chunksRef.current.length,
          timerDuration: finalDuration
        })
        
        // Validate recording completeness
        const minExpectedSize = finalDuration * 8000 // ~8KB per second minimum
        if (blob.size < minExpectedSize && finalDuration > 0) {
          console.error('[AudioRecorder] Recording appears incomplete!', {
            timerDuration: finalDuration,
            blobSize: blob.size,
            minExpectedSize,
            chunks: chunksRef.current.length
          })
          toast.error(`Warnung: Aufnahme könnte unvollständig sein (${finalDuration}s aufgezeichnet)`)
        }
        
        const url = URL.createObjectURL(blob)
        setAudioURL(url)

        stream.getTracks().forEach((track) => track.stop())

        setDuration(finalDuration)
        onRecordingComplete(blob, finalDuration, recordingPurpose)
      }

      // Start recording with timeslice to capture data every 1 second
      // This prevents data loss on mobile devices by flushing buffer frequently
      mediaRecorder.start(1000)
      console.log('[AudioRecorder] Recording started with 1-second timeslice')
      mediaRecorderRef.current = mediaRecorder
      setIsRecording(true)
      startTimeRef.current = Date.now()
      pausedTimeRef.current = 0
      totalPausedTimeRef.current = 0

      timerRef.current = setInterval(() => {
        const elapsed = Math.floor((Date.now() - startTimeRef.current - totalPausedTimeRef.current) / 1000)
        setRecordingTime(elapsed)
      }, 100)

      toast.success('Aufnahme gestartet')
    } catch (error) {
      toast.error('Fehler beim Zugriff auf das Mikrofon')
    }
  }

  const pauseRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      if (isPaused) {
        // Resuming
        mediaRecorderRef.current.resume()
        const pauseDuration = Date.now() - pausedTimeRef.current
        totalPausedTimeRef.current += pauseDuration
        setIsPaused(false)
        toast.info('Aufnahme fortgesetzt')
      } else {
        // Pausing - request data before pausing to ensure nothing is lost
        if (mediaRecorderRef.current.state === 'recording') {
          try {
            mediaRecorderRef.current.requestData()
          } catch (error) {
            console.warn('[AudioRecorder] requestData() on pause failed:', error)
          }
        }
        mediaRecorderRef.current.pause()
        pausedTimeRef.current = Date.now()
        setIsPaused(true)
        toast.info('Aufnahme pausiert')
      }
    }
  }

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      if (timerRef.current) {
        clearInterval(timerRef.current)
      }
      
      // Force final buffer flush before stopping
      // This ensures the last chunk of data is captured
      console.log('[AudioRecorder] Requesting final data flush before stop')
      if (mediaRecorderRef.current.state === 'recording') {
        try {
          mediaRecorderRef.current.requestData()
        } catch (error) {
          console.warn('[AudioRecorder] requestData() not supported or failed:', error)
        }
      }
      
      // Wait briefly to allow requestData to complete, then stop
      setTimeout(() => {
        if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
          console.log('[AudioRecorder] Stopping MediaRecorder')
          mediaRecorderRef.current.stop()
        }
      }, 100)
      
      setIsRecording(false)
      setIsPaused(false)
      toast.success('Aufnahme beendet')
    }
  }

  const discardRecording = () => {
    if (audioURL) {
      URL.revokeObjectURL(audioURL)
    }
    setAudioURL(null)
    setDuration(0)
    setRecordingTime(0)
    chunksRef.current = []
  }

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  const recordingTypeLabels = {
    context: '🎯 Kontext',
    meeting: '💬 Besprechung',
    dictation: '📝 Diktat',
    instruction: '📋 Anweisungen',
    addition: '➕ Ergänzung',
  }

  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex flex-col items-center space-y-4">
          {!audioURL ? (
            <>
              {!isRecording && (
                <div className="w-full max-w-xs">
                  <label className="text-sm font-medium text-slate-700 mb-2 block">
                    Was nehmen Sie auf?
                  </label>
                  <Select value={recordingPurpose} onValueChange={(value) => setRecordingPurpose(value as FilePurpose)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="context">{recordingTypeLabels.context}</SelectItem>
                      <SelectItem value="meeting">{recordingTypeLabels.meeting}</SelectItem>
                      <SelectItem value="dictation">{recordingTypeLabels.dictation}</SelectItem>
                      <SelectItem value="instruction">{recordingTypeLabels.instruction}</SelectItem>
                      <SelectItem value="addition">{recordingTypeLabels.addition}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div className="flex items-center justify-center">
                <div
                  className={`w-24 h-24 rounded-full flex items-center justify-center ${
                    isRecording
                      ? 'bg-red-100 animate-pulse'
                      : 'bg-slate-100'
                  }`}
                >
                  <Mic
                    className={`w-12 h-12 ${
                      isRecording ? 'text-red-600' : 'text-slate-600'
                    }`}
                  />
                </div>
              </div>

              {isRecording && (
                <>
                  <div className="text-sm font-medium text-slate-600">
                    {recordingTypeLabels[recordingPurpose]}
                  </div>
                  <div className="text-2xl font-mono font-bold text-slate-900">
                    {formatTime(recordingTime)}
                  </div>
                </>
              )}

              <div className="flex gap-2">
                {!isRecording ? (
                  <Button onClick={startRecording} size="lg">
                    <Mic className="mr-2 h-4 w-4" />
                    Aufnahme starten
                  </Button>
                ) : (
                  <>
                    <Button
                      onClick={pauseRecording}
                      variant="outline"
                      size="lg"
                    >
                      {isPaused ? (
                        <>
                          <Play className="mr-2 h-4 w-4" />
                          Fortsetzen
                        </>
                      ) : (
                        <>
                          <Pause className="mr-2 h-4 w-4" />
                          Pausieren
                        </>
                      )}
                    </Button>
                    <Button
                      onClick={stopRecording}
                      variant="destructive"
                      size="lg"
                    >
                      <Square className="mr-2 h-4 w-4" />
                      Beenden
                    </Button>
                  </>
                )}
              </div>
            </>
          ) : (
            <>
              <div className="w-full space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-slate-700">
                    Aufnahme fertig
                  </span>
                  <span className="text-sm text-slate-600">
                    {formatTime(duration)}
                  </span>
                </div>

                <audio src={audioURL} controls className="w-full" />

                <div className="flex gap-2">
                  <Button
                    onClick={discardRecording}
                    variant="outline"
                    className="flex-1"
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    Verwerfen
                  </Button>
                  <Button
                    onClick={startRecording}
                    variant="outline"
                    className="flex-1"
                  >
                    <Mic className="mr-2 h-4 w-4" />
                    Neu aufnehmen
                  </Button>
                </div>
              </div>
            </>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
