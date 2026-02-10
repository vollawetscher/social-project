'use client'

import { useState, useRef, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Mic, Square, Play, Pause, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { detectSupportedAudioFormat, isMobileSafari } from '@/lib/utils/audio-format-detector'
import { microphoneManager } from '@/lib/services/microphone-manager'

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
  const totalPausedTimeRef = useRef<number>(0)
  const recordedMimeTypeRef = useRef<string>('')
  const healthCheckRef = useRef<NodeJS.Timeout | null>(null)
  const lastChunkCountRef = useRef<number>(0)
  const lastHealthCheckRef = useRef<number>(0)
  const isPageVisibleRef = useRef<boolean>(true)
  const isPausedRef = useRef<boolean>(false)
  const wakeLockRef = useRef<any>(null)

  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current)
      }
      if (healthCheckRef.current) {
        clearInterval(healthCheckRef.current)
      }
      if (audioURL) {
        URL.revokeObjectURL(audioURL)
      }
      // Release microphone on unmount
      microphoneManager.releaseMicrophone('audio-recorder')
      // Release wake lock
      releaseWakeLock()
    }
  }, [audioURL])

  // Request Wake Lock to keep recording active when screen is off
  const requestWakeLock = async () => {
    try {
      if ('wakeLock' in navigator) {
        wakeLockRef.current = await (navigator as any).wakeLock.request('screen')
        console.log('[AudioRecorder] Wake Lock acquired - recording will continue with screen off')
        
        // Re-acquire wake lock if it's released (e.g., user turns screen off then on)
        wakeLockRef.current.addEventListener('release', () => {
          console.log('[AudioRecorder] Wake Lock released')
          if (isRecording) {
            console.log('[AudioRecorder] Re-acquiring Wake Lock...')
            requestWakeLock()
          }
        })
      } else {
        console.warn('[AudioRecorder] Wake Lock API not supported - recording may stop when screen turns off')
        toast.info('⚠️ For best results, keep screen on during recording', { duration: 5000 })
      }
    } catch (error) {
      console.error('[AudioRecorder] Failed to acquire Wake Lock:', error)
    }
  }

  const releaseWakeLock = () => {
    if (wakeLockRef.current) {
      try {
        wakeLockRef.current.release()
        wakeLockRef.current = null
        console.log('[AudioRecorder] Wake Lock released manually')
      } catch (error) {
        console.error('[AudioRecorder] Failed to release Wake Lock:', error)
      }
    }
  }

  // Power-saving: Pause UI timer when screen is off, but keep health monitoring active
  useEffect(() => {
    const handleVisibilityChange = async () => {
      const isVisible = document.visibilityState === 'visible'
      isPageVisibleRef.current = isVisible
      
      if (isRecording) {
        if (!isVisible) {
          // Screen off - pause UI timer to save battery
          if (timerRef.current) {
            clearInterval(timerRef.current)
            timerRef.current = null
          }
          console.log('[AudioRecorder] Screen off - paused UI timer (health monitoring still active)')
          // Wake Lock should keep recording active
        } else {
          // Screen on - resume UI timer and re-acquire wake lock if needed
          if (!timerRef.current) {
            timerRef.current = setInterval(() => {
              const elapsed = Math.floor((Date.now() - startTimeRef.current - totalPausedTimeRef.current) / 1000)
              setRecordingTime(elapsed)
            }, 100)
            // Update immediately
            const elapsed = Math.floor((Date.now() - startTimeRef.current - totalPausedTimeRef.current) / 1000)
            setRecordingTime(elapsed)
          }
          // Re-acquire wake lock if needed
          if (!wakeLockRef.current) {
            await requestWakeLock()
          }
          console.log('[AudioRecorder] Screen on - resumed UI timer')
        }
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [isRecording])

  // Play alert sound for critical recording errors
  const playErrorAlert = () => {
    try {
      // Create a simple beep sound using Web Audio API
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)()
      const oscillator = audioContext.createOscillator()
      const gainNode = audioContext.createGain()
      
      oscillator.connect(gainNode)
      gainNode.connect(audioContext.destination)
      
      // Triple beep pattern for error
      oscillator.frequency.value = 800
      oscillator.type = 'sine'
      
      gainNode.gain.setValueAtTime(0.3, audioContext.currentTime)
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.15)
      
      oscillator.start(audioContext.currentTime)
      oscillator.stop(audioContext.currentTime + 0.15)
      
      // Second beep
      setTimeout(() => {
        const osc2 = audioContext.createOscillator()
        const gain2 = audioContext.createGain()
        osc2.connect(gain2)
        gain2.connect(audioContext.destination)
        osc2.frequency.value = 800
        osc2.type = 'sine'
        gain2.gain.setValueAtTime(0.3, audioContext.currentTime)
        gain2.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.15)
        osc2.start()
        osc2.stop(audioContext.currentTime + 0.15)
      }, 200)
      
      // Third beep
      setTimeout(() => {
        const osc3 = audioContext.createOscillator()
        const gain3 = audioContext.createGain()
        osc3.connect(gain3)
        gain3.connect(audioContext.destination)
        osc3.frequency.value = 800
        osc3.type = 'sine'
        gain3.gain.setValueAtTime(0.3, audioContext.currentTime)
        gain3.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.15)
        osc3.start()
        osc3.stop(audioContext.currentTime + 0.15)
      }, 400)
    } catch (error) {
      console.error('[AudioRecorder] Failed to play alert sound:', error)
    }
  }

  // Monitor recording health - check if data is being captured
  // CRITICAL: This runs even when screen is off to detect failures
  const startHealthMonitoring = () => {
    lastChunkCountRef.current = 0
    lastHealthCheckRef.current = Date.now()
    
    // Check every 5 seconds if we're still receiving data
    // This continues running even when page is hidden (screen off) to alert on failures
    healthCheckRef.current = setInterval(() => {
      const currentChunkCount = chunksRef.current.length
      const timeSinceLastCheck = Date.now() - lastHealthCheckRef.current
      
      // If we're recording and haven't received any chunks in 5+ seconds, alert
      // Use ref instead of state to avoid timing issues with React state updates
      if (currentChunkCount === lastChunkCountRef.current && timeSinceLastCheck > 5000 && !isPausedRef.current) {
        console.error('[AudioRecorder] HEALTH CHECK FAILED - No data received in 5 seconds!')
        playErrorAlert() // Audio alert works even with screen off
        toast.error('⚠️ WARNING: Recording not receiving data! Please stop and restart recording.', {
          duration: 10000,
        })
      }
      
      lastChunkCountRef.current = currentChunkCount
      lastHealthCheckRef.current = Date.now()
    }, 5000)
  }

  const stopHealthMonitoring = () => {
    if (healthCheckRef.current) {
      clearInterval(healthCheckRef.current)
      healthCheckRef.current = null
    }
  }

  const startRecording = async () => {
    // Check if microphone is available
    if (!microphoneManager.isAvailable()) {
      const owner = microphoneManager.getCurrentOwner()
      const ownerName = microphoneManager.getOwnerDisplayName(owner)
      toast.error(`Microphone already in use by: ${ownerName}`)
      return
    }

    try {
      // Request microphone via manager
      const stream = await microphoneManager.requestMicrophone('audio-recorder')
      if (!stream) {
        toast.error('Microphone already in use')
        return
      }
      
      // Monitor for stream ending unexpectedly
      stream.getAudioTracks().forEach(track => {
        track.onended = () => {
          console.error('[AudioRecorder] Audio track ended unexpectedly!')
          if (isRecording) {
            playErrorAlert()
            toast.error('⚠️ CRITICAL: Microphone access ended! Recording may be incomplete.', {
              duration: 15000,
            })
            stopHealthMonitoring()
          }
        }
      })

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

      // Add error handler
      mediaRecorder.onerror = (event: any) => {
        console.error('[AudioRecorder] MediaRecorder error:', event.error)
        playErrorAlert()
        toast.error('⚠️ CRITICAL ERROR during recording! Please stop immediately and restart.', {
          duration: 15000,
        })
        stopHealthMonitoring()
      }

      mediaRecorder.onstop = async () => {
        stopHealthMonitoring()
        releaseWakeLock() // Release wake lock when recording stops
        
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
          playErrorAlert()
          toast.error(`⚠️ Warning: Recording may be incomplete (${finalDuration}s recorded, but only ${Math.round(blob.size / 1024)}KB data)`, {
            duration: 10000,
          })
        }
        
        const url = URL.createObjectURL(blob)
        setAudioURL(url)

        // Release microphone via manager
        microphoneManager.releaseMicrophone('audio-recorder')

        setDuration(finalDuration)
        onRecordingComplete(blob, finalDuration)
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

      // Only start UI timer if page is visible (power saving)
      if (document.visibilityState === 'visible') {
        timerRef.current = setInterval(() => {
          const elapsed = Math.floor((Date.now() - startTimeRef.current - totalPausedTimeRef.current) / 1000)
          setRecordingTime(elapsed)
        }, 100)
      } else {
        console.log('[AudioRecorder] Screen off - UI timer not started (will start when screen on)')
      }

      // Start health monitoring to detect recording failures
      // CRITICAL: This runs even with screen off
      startHealthMonitoring()

      // Request wake lock to keep recording active with screen off
      await requestWakeLock()

      toast.success('Recording started')
    } catch (error: any) {
      console.error('[AudioRecorder] Start error:', error)
      
      // Better error messages
      let errorMsg = 'Failed to access microphone'
      if (error.message?.includes('Permission denied') || error.name === 'NotAllowedError') {
        errorMsg = 'Microphone permission denied. Please allow access in browser settings.'
      } else if (error.name === 'NotFoundError') {
        errorMsg = 'No microphone found. Please connect a microphone.'
      }
      
      toast.error(errorMsg)
      microphoneManager.releaseMicrophone('audio-recorder')
    }
  }

  const pauseRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      if (isPaused) {
        // Resuming
        isPausedRef.current = false // Update ref first
        setIsPaused(false)
        mediaRecorderRef.current.resume()
        const pauseDuration = Date.now() - pausedTimeRef.current
        totalPausedTimeRef.current += pauseDuration
        
        // Restart UI timer if page is visible
        if (document.visibilityState === 'visible' && !timerRef.current) {
          timerRef.current = setInterval(() => {
            const elapsed = Math.floor((Date.now() - startTimeRef.current - totalPausedTimeRef.current) / 1000)
            setRecordingTime(elapsed)
          }, 100)
        }
        
        toast.info('Recording resumed')
      } else {
        // Pausing - update ref FIRST to prevent false health check warning
        isPausedRef.current = true
        setIsPaused(true)
        
        // Request data before pausing to ensure nothing is lost
        if (mediaRecorderRef.current.state === 'recording') {
          try {
            mediaRecorderRef.current.requestData()
          } catch (error) {
            console.warn('[AudioRecorder] requestData() on pause failed:', error)
          }
        }
        mediaRecorderRef.current.pause()
        pausedTimeRef.current = Date.now()
        toast.info('Recording paused')
      }
    }
  }

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      if (timerRef.current) {
        clearInterval(timerRef.current)
      }
      
      stopHealthMonitoring()
      releaseWakeLock() // Release wake lock when stopping
      
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
      
      isPausedRef.current = false // Reset ref
      setIsRecording(false)
      setIsPaused(false)
      toast.success('Recording stopped')
    }
  }

  const discardRecording = () => {
    stopHealthMonitoring()
    releaseWakeLock() // Release wake lock when discarding
    if (audioURL) {
      URL.revokeObjectURL(audioURL)
    }
    setAudioURL(null)
    setDuration(0)
    setRecordingTime(0)
    chunksRef.current = []
    isPausedRef.current = false // Reset ref
    // Ensure microphone is released
    microphoneManager.releaseMicrophone('audio-recorder')
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
                    Start Recording
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
                          Resume
                        </>
                      ) : (
                        <>
                          <Pause className="mr-2 h-4 w-4" />
                          Pause
                        </>
                      )}
                    </Button>
                    <Button
                      onClick={stopRecording}
                      variant="destructive"
                      size="lg"
                    >
                      <Square className="mr-2 h-4 w-4" />
                      Stop
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
                    Recording complete
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
                    Discard
                  </Button>
                  <Button
                    onClick={startRecording}
                    variant="outline"
                    className="flex-1"
                  >
                    <Mic className="mr-2 h-4 w-4" />
                    Record New
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
