"use client"

import { useState, useEffect, useRef } from "react"
import { useTranslations } from "next-intl"
import { Mic, MicOff, Video, VideoOff } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { cn } from "@/lib/utils"

interface CallSetupProps {
  mode: "audio" | "video"
  isAuthenticated: boolean
  userName?: string
  onJoin: (displayName: string) => void
  onCancel: () => void
  joining?: boolean
}

const AUDIO_INPUT_KEY = "notissima.call.audioInputDeviceId"
const VIDEO_INPUT_KEY = "notissima.call.videoInputDeviceId"

export function CallSetup({
  mode,
  isAuthenticated,
  userName,
  onJoin,
  onCancel,
  joining = false,
}: CallSetupProps) {
  const t = useTranslations('callSetup')
  const [guestName, setGuestName] = useState("")
  const [isMicReady, setIsMicReady] = useState(false)
  const [isCameraReady, setIsCameraReady] = useState(false)
  const [micError, setMicError] = useState<string | null>(null)
  const [audioInputs, setAudioInputs] = useState<MediaDeviceInfo[]>([])
  const [videoInputs, setVideoInputs] = useState<MediaDeviceInfo[]>([])
  const [selectedAudioInput, setSelectedAudioInput] = useState<string>("")
  const [selectedVideoInput, setSelectedVideoInput] = useState<string>("")
  const [micLevel, setMicLevel] = useState(0)
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const audioContextRef = useRef<AudioContext | null>(null)
  const levelRafRef = useRef<number | null>(null)

  const displayName = isAuthenticated ? (userName || "User") : guestName

  useEffect(() => {
    checkPermissions()
    return () => {
      if (levelRafRef.current) cancelAnimationFrame(levelRafRef.current)
      if (audioContextRef.current) audioContextRef.current.close().catch(() => {})
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop())
      }
    }
  }, [mode])

  async function checkPermissions(audioDeviceId?: string, videoDeviceId?: string) {
    try {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop())
      }
      const constraints: MediaStreamConstraints = {
        audio: audioDeviceId ? { deviceId: { exact: audioDeviceId } } : true,
        video: mode === "video"
          ? (videoDeviceId ? { deviceId: { exact: videoDeviceId } } : true)
          : false,
      }
      const stream = await navigator.mediaDevices.getUserMedia(constraints)
      streamRef.current = stream

      setIsMicReady(true)
      if (mode === "video") {
        setIsCameraReady(true)
        if (videoRef.current) {
          videoRef.current.srcObject = stream
        }
      }

      const devices = await navigator.mediaDevices.enumerateDevices()
      const mics = devices.filter((d) => d.kind === "audioinput")
      const cams = devices.filter((d) => d.kind === "videoinput")
      setAudioInputs(mics)
      setVideoInputs(cams)

      const savedAudio = window.localStorage.getItem(AUDIO_INPUT_KEY) || ""
      const savedVideo = window.localStorage.getItem(VIDEO_INPUT_KEY) || ""
      const activeAudio = (stream.getAudioTracks()[0]?.getSettings()?.deviceId as string | undefined) || ""
      const activeVideo = (stream.getVideoTracks()[0]?.getSettings()?.deviceId as string | undefined) || ""
      setSelectedAudioInput((savedAudio && mics.some((m) => m.deviceId === savedAudio)) ? savedAudio : activeAudio)
      setSelectedVideoInput((savedVideo && cams.some((c) => c.deviceId === savedVideo)) ? savedVideo : activeVideo)

      if (levelRafRef.current) cancelAnimationFrame(levelRafRef.current)
      if (audioContextRef.current) await audioContextRef.current.close().catch(() => {})
      const audioTrack = stream.getAudioTracks()[0]
      if (audioTrack) {
        const audioStream = new MediaStream([audioTrack])
        const ctx = new AudioContext()
        const source = ctx.createMediaStreamSource(audioStream)
        const analyser = ctx.createAnalyser()
        analyser.fftSize = 256
        source.connect(analyser)
        const data = new Uint8Array(analyser.frequencyBinCount)
        audioContextRef.current = ctx
        const tick = () => {
          analyser.getByteFrequencyData(data)
          const avg = data.reduce((sum, v) => sum + v, 0) / data.length
          setMicLevel(Math.min(100, Math.round((avg / 255) * 100)))
          levelRafRef.current = requestAnimationFrame(tick)
        }
        tick()
      }
    } catch (err: any) {
      console.error("[CallSetup] Permission error:", err)
      setMicError(err.message || t('couldNotAccessMic'))
    }
  }

  useEffect(() => {
    if (!selectedAudioInput) return
    window.localStorage.setItem(AUDIO_INPUT_KEY, selectedAudioInput)
  }, [selectedAudioInput])

  useEffect(() => {
    if (!selectedVideoInput) return
    window.localStorage.setItem(VIDEO_INPUT_KEY, selectedVideoInput)
  }, [selectedVideoInput])

  const canJoin = displayName.trim().length > 0 && isMicReady && !joining

  const initials = displayName
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2) || "?"

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-background p-6">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center">
          <h1 className="text-xl font-semibold text-foreground">
            {mode === "video" ? t('joinVideoCall') : t('joinAudioCall')}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {t('checkDevices')}
          </p>
        </div>

        {/* Camera preview or avatar */}
        <div className="flex justify-center">
          {mode === "video" && isCameraReady ? (
            <div className="w-48 h-36 rounded-xl bg-[#1a1a1a] overflow-hidden relative">
              <video
                ref={videoRef}
                autoPlay
                muted
                playsInline
                className="w-full h-full object-cover mirror"
              />
            </div>
          ) : (
            <Avatar className="h-24 w-24">
              <AvatarFallback className="bg-secondary text-foreground text-3xl">
                {initials}
              </AvatarFallback>
            </Avatar>
          )}
        </div>

        {/* Device status indicators */}
        <div className="flex justify-center gap-4">
          <div className={cn(
            "flex items-center gap-2 px-3 py-1.5 rounded-full text-sm",
            isMicReady ? "bg-primary/10 text-primary" : "bg-destructive/10 text-destructive"
          )}>
            {isMicReady ? <Mic className="h-4 w-4" /> : <MicOff className="h-4 w-4" />}
            <span className="text-xs">{isMicReady ? t('micReady') : t('noMic')}</span>
          </div>
          {mode === "video" && (
            <div className={cn(
              "flex items-center gap-2 px-3 py-1.5 rounded-full text-sm",
              isCameraReady ? "bg-info/10 text-info" : "bg-destructive/10 text-destructive"
            )}>
              {isCameraReady ? <Video className="h-4 w-4" /> : <VideoOff className="h-4 w-4" />}
              <span className="text-xs">{isCameraReady ? t('cameraReady') : t('noCamera')}</span>
            </div>
          )}
        </div>

        <div className="space-y-3">
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">{t('microphone')}</label>
            <select
              value={selectedAudioInput}
              onChange={(e) => {
                const next = e.target.value
                setSelectedAudioInput(next)
                checkPermissions(next, selectedVideoInput)
              }}
              className="w-full rounded-md border border-border bg-background px-2 py-2 text-sm"
            >
              {audioInputs.map((mic, idx) => (
                <option key={mic.deviceId || `mic-${idx}`} value={mic.deviceId}>
                  {mic.label || `${t('microphone')} ${idx + 1}`}
                </option>
              ))}
            </select>
            <div className="h-2 rounded bg-secondary overflow-hidden">
              <div className="h-full bg-primary transition-all" style={{ width: `${micLevel}%` }} />
            </div>
          </div>

          {mode === "video" && (
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">{t('camera')}</label>
              <select
                value={selectedVideoInput}
                onChange={(e) => {
                  const next = e.target.value
                  setSelectedVideoInput(next)
                  checkPermissions(selectedAudioInput, next)
                }}
                className="w-full rounded-md border border-border bg-background px-2 py-2 text-sm"
              >
                {videoInputs.map((cam, idx) => (
                  <option key={cam.deviceId || `cam-${idx}`} value={cam.deviceId}>
                    {cam.label || `${t('camera')} ${idx + 1}`}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        {micError && (
          <p className="text-sm text-destructive text-center">{micError}</p>
        )}

        {/* Guest name input */}
        {!isAuthenticated && (
          <div>
            <label className="text-sm font-medium text-foreground mb-1.5 block">
              {t('yourName')}
            </label>
            <Input
              value={guestName}
              onChange={(e) => setGuestName(e.target.value)}
              placeholder={t('enterName')}
              className="text-center"
              autoFocus
            />
          </div>
        )}

        {/* Join / Cancel */}
        <div className="flex gap-3">
          <Button variant="outline" onClick={onCancel} className="flex-1">
            {t('cancel')}
          </Button>
          <Button
            onClick={() => onJoin(displayName)}
            disabled={!canJoin}
            className="flex-1"
          >
            {joining ? t('joining') : t('joinCall')}
          </Button>
        </div>
      </div>
    </div>
  )
}
