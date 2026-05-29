"use client"

import { useCallback, useEffect, useRef } from "react"

import { CALL_WAITING_MUSIC } from "@/lib/constants/call-waiting-music"

const WAITING_MUSIC_URL = CALL_WAITING_MUSIC.filePath
const TARGET_VOLUME = 0.28
const FADE_MS = 600

/**
 * Soft looping hold music while waiting for the other person on WebRTC calls.
 * Plays for both the host and the guest — whoever arrived first.
 * PSTN outbound keeps the traditional ring tone (see useRingtone in CallRoom).
 */
export function useCallWaitingMusic(playing: boolean) {
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const fadeTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const startedRef = useRef(0)

  const clearFade = useCallback(() => {
    if (fadeTimerRef.current) {
      clearInterval(fadeTimerRef.current)
      fadeTimerRef.current = null
    }
  }, [])

  const stop = useCallback(() => {
    clearFade()
    const audio = audioRef.current
    if (audio) {
      audio.pause()
      audio.currentTime = 0
      audio.volume = 0
    }
    startedRef.current = 0
  }, [clearFade])

  const fadeTo = useCallback((audio: HTMLAudioElement, target: number, onDone?: () => void) => {
    clearFade()
    const steps = 12
    const stepMs = FADE_MS / steps
    const start = audio.volume
    const delta = (target - start) / steps
    let step = 0
    fadeTimerRef.current = setInterval(() => {
      step += 1
      audio.volume = Math.max(0, Math.min(1, start + delta * step))
      if (step >= steps) {
        clearFade()
        audio.volume = target
        onDone?.()
      }
    }, stepMs)
  }, [clearFade])

  const start = useCallback(async () => {
    if (!audioRef.current) {
      const audio = new Audio(WAITING_MUSIC_URL)
      audio.loop = true
      audio.preload = "auto"
      audio.volume = 0
      audioRef.current = audio
    }
    const audio = audioRef.current
    try {
      if (audio.paused) {
        audio.currentTime = 0
        startedRef.current = Date.now()
        await audio.play()
      }
      fadeTo(audio, TARGET_VOLUME)
    } catch {
      // Autoplay blocked or asset missing — silent fallback.
    }
  }, [fadeTo])

  const fadeOutAndStop = useCallback(() => {
    const audio = audioRef.current
    if (!audio) {
      stop()
      return
    }
    fadeTo(audio, 0, () => {
      audio.pause()
      audio.currentTime = 0
      startedRef.current = 0
    })
  }, [fadeTo, stop])

  useEffect(() => {
    if (playing) {
      void start()
    } else {
      fadeOutAndStop()
    }
  }, [playing, start, fadeOutAndStop])

  useEffect(() => () => {
    clearFade()
    const audio = audioRef.current
    if (audio) {
      audio.pause()
      audio.src = ""
      audioRef.current = null
    }
  }, [clearFade])
}
