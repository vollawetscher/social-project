'use client'

import { useState, useRef, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Mic, Square, Play, Pause, Trash2 } from 'lucide-react'
import { toast } from 'sonner'

interface AudioRecorderProps {
  onRecordingComplete: (blob: Blob, duration: number) => void
}

export function AudioRecorder({ onRecordingComplete }: AudioRecorderProps) {
  const [isRecording, setIsRecording] = useState(false)
  const [isPaused, setIsPaused] = useState(false)
  const [audioURL, setAudioURL] = useState<string | null>(null)
  const [duration, setDuration] = useState(0)
  const [recordingTime, setRecordingTime] = useState(0)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const timerRef = useRef<NodeJS.Timeout | null>(null)
  const startTimeRef = useRef<number>(0)
  const pausedTimeRef = useRef<number>(0)

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

      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm',
      })

      chunksRef.current = []

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data)
        }
      }

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' })
        const url = URL.createObjectURL(blob)
        setAudioURL(url)

        stream.getTracks().forEach((track) => track.stop())

        const finalDuration = Math.floor((Date.now() - startTimeRef.current - pausedTimeRef.current) / 1000)
        setDuration(finalDuration)
        onRecordingComplete(blob, finalDuration)
      }

      mediaRecorder.start()
      mediaRecorderRef.current = mediaRecorder
      setIsRecording(true)
      startTimeRef.current = Date.now()
      pausedTimeRef.current = 0

      timerRef.current = setInterval(() => {
        const elapsed = Math.floor((Date.now() - startTimeRef.current - pausedTimeRef.current) / 1000)
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
        mediaRecorderRef.current.resume()
        const pauseDuration = Date.now() - pausedTimeRef.current
        pausedTimeRef.current = pauseDuration
        setIsPaused(false)
        toast.info('Aufnahme fortgesetzt')
      } else {
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
      mediaRecorderRef.current.stop()
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

  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex flex-col items-center space-y-4">
          {!audioURL ? (
            <>
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
                <div className="text-2xl font-mono font-bold text-slate-900">
                  {formatTime(recordingTime)}
                </div>
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
