'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Mic, Square, Play, Pause, Trash2, Settings2 } from 'lucide-react'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import { detectSupportedAudioFormat, isMobileSafari } from '@/lib/utils/audio-format-detector'
import { microphoneManager } from '@/lib/services/microphone-manager'

interface AudioRecorderProps {
  onRecordingComplete: (blob: Blob, duration: number) => void
}

// Measure the real duration of a recorded audio blob.
//
// Why this exists: the `MediaRecorder` wall-clock timer (Date.now() diff)
// is not a reliable measure of how much audio was actually captured. If
// the tab is suspended (backgrounded on iOS/Android, screen lock, OS
// energy saver) or the input stream drops (bluetooth mic disconnect),
// the wall-clock keeps ticking while no new chunks are recorded. We saw
// sessions with a 22 s audio blob being recorded as 654 s long.
//
// This helper loads the blob into a hidden <audio> element and reads the
// `duration` property once metadata is decoded. For some container
// formats (most notably WebM/Matroska produced by MediaRecorder), the
// duration is reported as Infinity until we seek past the end — the
// `currentTime = Number.MAX_SAFE_INTEGER` trick forces the browser to
// compute the real duration from the actual packets.
async function measureBlobDuration(blob: Blob): Promise<number | null> {
  return new Promise<number | null>((resolve) => {
    if (!blob || blob.size === 0) {
      resolve(null)
      return
    }

    const url = URL.createObjectURL(blob)
    const audio = document.createElement('audio')
    let settled = false

    const finalize = (value: number | null) => {
      if (settled) return
      settled = true
      audio.src = ''
      URL.revokeObjectURL(url)
      resolve(value)
    }

    const timeout = setTimeout(() => finalize(null), 5000)

    const accept = (raw: number) => {
      clearTimeout(timeout)
      if (!Number.isFinite(raw) || raw <= 0) {
        finalize(null)
      } else {
        finalize(Math.max(1, Math.round(raw)))
      }
    }

    audio.preload = 'metadata'
    audio.onerror = () => {
      clearTimeout(timeout)
      finalize(null)
    }
    audio.onloadedmetadata = () => {
      if (audio.duration === Infinity) {
        // WebM/Matroska workaround: seek past the end to force the
        // browser to scan the full stream and recompute the duration.
        const onTimeUpdate = () => {
          audio.ontimeupdate = null
          audio.currentTime = 0
          accept(audio.duration)
        }
        audio.ontimeupdate = onTimeUpdate
        try {
          audio.currentTime = Number.MAX_SAFE_INTEGER
        } catch {
          accept(audio.duration)
        }
      } else {
        accept(audio.duration)
      }
    }
    audio.src = url
  })
}

export function AudioRecorder({ onRecordingComplete }: AudioRecorderProps) {
  const t = useTranslations('recorder')
  const [isRecording, setIsRecording] = useState(false)
  const [isPaused, setIsPaused] = useState(false)
  const [audioURL, setAudioURL] = useState<string | null>(null)
  const [duration, setDuration] = useState(0)
  const [recordingTime, setRecordingTime] = useState(0)
  const [audioProcessing, setAudioProcessing] = useState(true)
  const [channelCount, setChannelCount] = useState(1)
  const [audioLevels, setAudioLevels] = useState<number[]>([0])
  const [showSettings, setShowSettings] = useState(false)
  const [availableInputDevices, setAvailableInputDevices] = useState<MediaDeviceInfo[]>([])
  const [selectedInputDeviceId, setSelectedInputDeviceId] = useState<string>('default')
  const [detectedInputChannels, setDetectedInputChannels] = useState<number | null>(null)
  const [probingChannels, setProbingChannels] = useState(false)
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
  const analyserContextRef = useRef<AudioContext | null>(null)
  const analysersRef = useRef<AnalyserNode[]>([])
  const animationFrameRef = useRef<number | null>(null)
  const levelUpdateRef = useRef<number>(0)
  const activeStreamRef = useRef<MediaStream | null>(null)
  const recordingContextRef = useRef<AudioContext | null>(null)

  const cleanupRecordingContext = useCallback(() => {
    if (recordingContextRef.current) {
      recordingContextRef.current.close().catch(() => {})
      recordingContextRef.current = null
    }
  }, [])

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
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current)
        animationFrameRef.current = null
      }
      if (analyserContextRef.current) {
        analyserContextRef.current.close().catch(() => {})
        analyserContextRef.current = null
      }
      analysersRef.current = []
      cleanupRecordingContext()
      microphoneManager.releaseMicrophone('audio-recorder')
      releaseWakeLock()
    }
  }, [audioURL, cleanupRecordingContext])

  const loadInputDevices = useCallback(async () => {
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.enumerateDevices) return
    try {
      const devices = await navigator.mediaDevices.enumerateDevices()
      const audioInputs = devices.filter((d) => d.kind === 'audioinput')
      setAvailableInputDevices(audioInputs)

      if (audioInputs.length > 0 && selectedInputDeviceId === 'default') {
        const preferred = audioInputs.find((d) => d.deviceId === 'default') || audioInputs[0]
        setSelectedInputDeviceId(preferred?.deviceId || 'default')
      }
    } catch (error) {
      console.warn('[AudioRecorder] Failed to enumerate input devices:', error)
    }
  }, [selectedInputDeviceId])

  const probeInputChannels = useCallback(async (deviceId: string) => {
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) return
    if (isRecording) return
    setProbingChannels(true)
    try {
      const constraints: MediaTrackConstraints = {
        echoCancellation: false,
        noiseSuppression: false,
        autoGainControl: false,
        channelCount: { ideal: 2 },
      }
      if (deviceId && deviceId !== 'default') {
        constraints.deviceId = { exact: deviceId }
      }

      const tempStream = await navigator.mediaDevices.getUserMedia({ audio: constraints })
      const track = tempStream.getAudioTracks()[0]
      const settings = track?.getSettings()
      const capabilities = typeof (track as any)?.getCapabilities === 'function'
        ? (track as any).getCapabilities()
        : null
      const capabilityMax =
        typeof capabilities?.channelCount === 'number'
          ? capabilities.channelCount
          : typeof capabilities?.channelCount?.max === 'number'
            ? capabilities.channelCount.max
            : Array.isArray(capabilities?.channelCount)
              ? Math.max(...capabilities.channelCount)
              : 1
      setDetectedInputChannels(Math.max(settings?.channelCount || 1, capabilityMax || 1))
      tempStream.getTracks().forEach((t) => t.stop())
    } catch (error) {
      console.warn('[AudioRecorder] Channel probe failed:', error)
      setDetectedInputChannels(null)
    } finally {
      setProbingChannels(false)
    }
  }, [isRecording])

  useEffect(() => {
    loadInputDevices()
  }, [loadInputDevices])

  useEffect(() => {
    if (!showSettings || isRecording) return
    if (!selectedInputDeviceId) return
    probeInputChannels(selectedInputDeviceId)
  }, [showSettings, isRecording, selectedInputDeviceId, probeInputChannels])

  const buildRecordingStream = useCallback((inputStream: MediaStream, preferStereo: boolean): MediaStream => {
    if (!preferStereo) return inputStream

    const inputTrack = inputStream.getAudioTracks()[0]
    const inputSettings = inputTrack?.getSettings()
    const inputChannels = inputSettings?.channelCount || 1

    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)()
      const source = ctx.createMediaStreamSource(inputStream)
      const destination = ctx.createMediaStreamDestination()
      const merger = ctx.createChannelMerger(2)

      if (inputChannels >= 2) {
        const splitter = ctx.createChannelSplitter(2)
        source.connect(splitter)
        splitter.connect(merger, 0, 0)
        splitter.connect(merger, 1, 1)
      } else {
        // Hardware is mono: duplicate signal so output file is 2-channel dual-mono.
        source.connect(merger, 0, 0)
        source.connect(merger, 0, 1)
      }

      merger.connect(destination)
      recordingContextRef.current = ctx
      return destination.stream
    } catch (error) {
      console.warn('[AudioRecorder] Failed to build stereo recording stream, using input stream:', error)
      return inputStream
    }
  }, [])

  // --- Audio Level Monitoring ---
  const startLevelMonitoring = useCallback((stream: MediaStream) => {
    try {
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)()
      analyserContextRef.current = audioContext
      const source = audioContext.createMediaStreamSource(stream)

      const track = stream.getAudioTracks()[0]
      const settings = track?.getSettings()
      const channels = settings?.channelCount || 1
      setChannelCount(channels)

      if (channels >= 2) {
        const splitter = audioContext.createChannelSplitter(channels)
        source.connect(splitter)
        const analysers: AnalyserNode[] = []
        for (let i = 0; i < Math.min(channels, 2); i++) {
          const analyser = audioContext.createAnalyser()
          analyser.fftSize = 256
          analyser.smoothingTimeConstant = 0.8
          splitter.connect(analyser, i)
          analysers.push(analyser)
        }
        analysersRef.current = analysers
      } else {
        const analyser = audioContext.createAnalyser()
        analyser.fftSize = 256
        analyser.smoothingTimeConstant = 0.8
        source.connect(analyser)
        analysersRef.current = [analyser]
      }

      console.log(`[AudioRecorder] Level monitoring started: ${channels} channel(s)`)

      const updateLevels = () => {
        const now = Date.now()
        // Throttle to ~20fps to save battery
        if (now - levelUpdateRef.current > 50) {
          const levels = analysersRef.current.map(analyser => {
            const data = new Uint8Array(analyser.frequencyBinCount)
            analyser.getByteTimeDomainData(data)
            let peak = 0
            for (let i = 0; i < data.length; i++) {
              const amplitude = Math.abs(data[i] - 128) / 128
              if (amplitude > peak) peak = amplitude
            }
            return peak
          })
          setAudioLevels(levels)
          levelUpdateRef.current = now
        }
        animationFrameRef.current = requestAnimationFrame(updateLevels)
      }

      updateLevels()
    } catch (error) {
      console.error('[AudioRecorder] Failed to start level monitoring:', error)
    }
  }, [])

  const stopLevelMonitoring = useCallback(() => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current)
      animationFrameRef.current = null
    }
    if (analyserContextRef.current) {
      analyserContextRef.current.close().catch(() => {})
      analyserContextRef.current = null
    }
    analysersRef.current = []
    setAudioLevels([0])
    setChannelCount(1)
  }, [])

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
          // Screen off - pause UI timer and level monitoring to save battery
          if (timerRef.current) {
            clearInterval(timerRef.current)
            timerRef.current = null
          }
          if (animationFrameRef.current) {
            cancelAnimationFrame(animationFrameRef.current)
            animationFrameRef.current = null
          }
          console.log('[AudioRecorder] Screen off - paused UI timer & levels (health monitoring still active)')
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
      // Request microphone with user-selected options
      const stream = await microphoneManager.requestMicrophone('audio-recorder', {
        echoCancellation: audioProcessing,
        noiseSuppression: audioProcessing,
        autoGainControl: audioProcessing,
        channelCount: 2, // Always request stereo; browser gives what's available
        channelCountExact: (detectedInputChannels || 1) >= 2,
        deviceId: selectedInputDeviceId !== 'default' ? selectedInputDeviceId : undefined,
      })
      if (!stream) {
        toast.error('Microphone already in use')
        return
      }
      activeStreamRef.current = stream

      // Start level monitoring for visual feedback
      startLevelMonitoring(stream)
      cleanupRecordingContext()
      
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

      if (!audioFormat.isSupported) {
        microphoneManager.releaseMicrophone('audio-recorder')
        stopLevelMonitoring()
        cleanupRecordingContext()
        toast.error(
          'Your browser cannot record in a supported audio format. Please use Safari (iPhone/Mac) or upload a pre-recorded file instead.',
          { duration: 10000 }
        )
        return
      }

      if (isMobileSafari()) {
        console.log('[AudioRecorder] Mobile Safari detected')
      }

      const options: MediaRecorderOptions = {}
      if (audioFormat.mimeType) {
        options.mimeType = audioFormat.mimeType
      }
      const recordingStream = buildRecordingStream(stream, (detectedInputChannels || 1) >= 2)
      const mediaRecorder = new MediaRecorder(recordingStream, options)

      const actualMimeType = mediaRecorder.mimeType || audioFormat.mimeType
      if (!actualMimeType) {
        microphoneManager.releaseMicrophone('audio-recorder')
        stopLevelMonitoring()
        cleanupRecordingContext()
        toast.error(
          'Could not determine recording format. Please use Safari or upload a file instead.',
          { duration: 10000 }
        )
        return
      }
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
        stopLevelMonitoring()
        cleanupRecordingContext()
        releaseWakeLock()
        
        // Wait for any pending dataavailable events to fire
        await new Promise(resolve => setTimeout(resolve, 200))
        
        const blob = new Blob(chunksRef.current, { type: recordedMimeTypeRef.current })
        const timerDuration = Math.floor((Date.now() - startTimeRef.current - totalPausedTimeRef.current) / 1000)

        // Prefer the actual duration decoded from the blob over the
        // wall-clock timer. The timer keeps running during tab suspends,
        // screen locks and bluetooth disconnects even when no audio is
        // being captured, which produces wildly inflated durations (see
        // measureBlobDuration docstring).
        const blobDuration = await measureBlobDuration(blob)
        const finalDuration = blobDuration ?? timerDuration

        console.log('[AudioRecorder] Recording stopped:', {
          blobSize: blob.size,
          blobType: blob.type,
          chunks: chunksRef.current.length,
          timerDuration,
          blobDuration,
          finalDuration,
        })

        // Mismatch check: if the timer says we recorded much longer than
        // the audio file actually contains, the tab was almost certainly
        // suspended mid-recording. Warn the user so they know the file
        // may be truncated.
        if (
          blobDuration !== null &&
          timerDuration > 0 &&
          timerDuration - blobDuration >= 30 &&
          blobDuration < timerDuration * 0.5
        ) {
          console.warn('[AudioRecorder] Audio shorter than timer — likely tab suspension or capture drop', {
            timerDuration,
            blobDuration,
          })
          playErrorAlert()
          toast.error(
            `⚠️ Recording looks incomplete. Captured audio is ${blobDuration}s, but the timer ran for ${timerDuration}s. The tab may have been suspended.`,
            { duration: 10000 }
          )
        } else {
          // Fallback size check (kept for the rare case we couldn't decode
          // duration from the blob at all).
          const minExpectedSize = timerDuration * 8000
          if (blobDuration === null && blob.size < minExpectedSize && timerDuration > 0) {
            console.error('[AudioRecorder] Recording appears incomplete (size check):', {
              timerDuration,
              blobSize: blob.size,
              minExpectedSize,
              chunks: chunksRef.current.length,
            })
            playErrorAlert()
            toast.error(
              `⚠️ Warning: Recording may be incomplete (${timerDuration}s recorded, but only ${Math.round(blob.size / 1024)}KB data)`,
              { duration: 10000 }
            )
          }
        }

        const url = URL.createObjectURL(blob)
        setAudioURL(url)

        // Release microphone via manager
        microphoneManager.releaseMicrophone('audio-recorder')
        activeStreamRef.current = null

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

      toast.success(t('recordingStarted'))
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
      cleanupRecordingContext()
      activeStreamRef.current = null
    }
  }

  const pauseRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      if (isPaused) {
        // Resuming
        isPausedRef.current = false
        setIsPaused(false)
        mediaRecorderRef.current.resume()
        if (activeStreamRef.current) {
          startLevelMonitoring(activeStreamRef.current)
        }
        const pauseDuration = Date.now() - pausedTimeRef.current
        totalPausedTimeRef.current += pauseDuration
        
        // Restart UI timer if page is visible
        if (document.visibilityState === 'visible' && !timerRef.current) {
          timerRef.current = setInterval(() => {
            const elapsed = Math.floor((Date.now() - startTimeRef.current - totalPausedTimeRef.current) / 1000)
            setRecordingTime(elapsed)
          }, 100)
        }
        
        // Restart health monitoring with fresh baseline after resume
        stopHealthMonitoring()
        lastChunkCountRef.current = chunksRef.current.length
        lastHealthCheckRef.current = Date.now()
        startHealthMonitoring()
        
        toast.info(t('recordingResumed'))
      } else {
        // Pausing
        isPausedRef.current = true
        setIsPaused(true)
        stopLevelMonitoring()
        
        // Stop health monitoring entirely while paused
        stopHealthMonitoring()
        
        // Stop UI timer so it doesn't keep ticking
        if (timerRef.current) {
          clearInterval(timerRef.current)
          timerRef.current = null
        }
        
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
        toast.info(t('recordingPaused'))
      }
    }
  }

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      if (timerRef.current) {
        clearInterval(timerRef.current)
      }
      
      stopHealthMonitoring()
      stopLevelMonitoring()
      releaseWakeLock()
      
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
      toast.success(t('recordingStopped'))
    }
  }

  const discardRecording = () => {
    stopHealthMonitoring()
    stopLevelMonitoring()
    cleanupRecordingContext()
    releaseWakeLock()
    if (audioURL) {
      URL.revokeObjectURL(audioURL)
    }
    setAudioURL(null)
    setDuration(0)
    setRecordingTime(0)
    chunksRef.current = []
    activeStreamRef.current = null
    isPausedRef.current = false // Reset ref
    // Ensure microphone is released
    microphoneManager.releaseMicrophone('audio-recorder')
  }

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  const getLevelColor = (level: number) => {
    if (level > 0.85) return 'bg-red-500'
    if (level > 0.6) return 'bg-yellow-500'
    return 'bg-green-500'
  }

  const getLevelWidth = (level: number) => {
    // Scale: 0-1 input, with amplification for typical speech levels
    const scaled = Math.min(level * 2.5, 1)
    return `${scaled * 100}%`
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
                <>
                  {/* Timer and channel indicator */}
                  <div className="flex items-center gap-2">
                    <div className="text-2xl font-mono font-bold text-slate-900">
                      {formatTime(recordingTime)}
                    </div>
                    <Badge variant={channelCount >= 2 ? 'default' : 'secondary'} className="text-xs">
                      {channelCount >= 2 ? 'Stereo' : 'Mono'}
                    </Badge>
                  </div>

                  {/* Audio level indicators */}
                  <div className="w-full max-w-xs space-y-1.5">
                    {audioLevels.map((level, i) => (
                      <div key={i} className="flex items-center gap-2">
                        {channelCount >= 2 && (
                          <span className="text-[10px] font-medium text-slate-400 w-3 text-right">
                            {i === 0 ? 'L' : 'R'}
                          </span>
                        )}
                        <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-[width] duration-75 ${getLevelColor(level)}`}
                            style={{ width: getLevelWidth(level) }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>

                  {!audioProcessing && (
                    <p className="text-[11px] text-amber-600">
                      Audio processing off — best for external mics
                    </p>
                  )}
                </>
              )}

              {/* Settings toggle (only when not recording) */}
              {!isRecording && (
                <div className="w-full max-w-xs">
                  <button
                    onClick={() => setShowSettings(prev => !prev)}
                    className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-700 transition-colors mb-2"
                  >
                    <Settings2 className="h-3.5 w-3.5" />
                    {showSettings ? 'Hide settings' : 'Audio settings'}
                  </button>

                  {showSettings && (
                    <div className="border rounded-lg p-3 space-y-3 bg-slate-50">
                      <div className="space-y-1.5">
                        <Label htmlFor="input-device" className="text-sm font-medium">
                          Input Device
                        </Label>
                        <select
                          id="input-device"
                          value={selectedInputDeviceId}
                          onChange={(e) => setSelectedInputDeviceId(e.target.value)}
                          className="w-full rounded-md border border-slate-300 bg-white p-2 text-sm"
                        >
                          {availableInputDevices.length === 0 && (
                            <option value="default">Default microphone</option>
                          )}
                          {availableInputDevices.map((device, index) => (
                            <option key={device.deviceId || index} value={device.deviceId}>
                              {device.label || `Microphone ${index + 1}`}
                            </option>
                          ))}
                        </select>
                        <p className="text-[11px] text-slate-500 leading-tight">
                          {probingChannels
                            ? 'Checking channel support...'
                            : detectedInputChannels == null
                              ? 'Channel support unknown until device permission is granted.'
                              : detectedInputChannels >= 2
                                ? 'Detected stereo-capable input (2 channels).'
                                : 'Detected mono input. Try selecting your external/lapel mic for stereo.'}
                        </p>
                      </div>
                      <div className="flex items-center justify-between">
                        <div className="space-y-0.5">
                          <Label htmlFor="audio-processing" className="text-sm font-medium">
                            Audio Processing
                          </Label>
                          <p className="text-[11px] text-slate-500 leading-tight">
                            Echo cancellation, noise suppression & auto-gain.
                            Turn off for external microphones.
                          </p>
                        </div>
                        <Switch
                          id="audio-processing"
                          checked={audioProcessing}
                          onCheckedChange={setAudioProcessing}
                        />
                      </div>
                    </div>
                  )}
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
