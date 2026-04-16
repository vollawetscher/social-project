"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { useParams } from "next/navigation"
import { useRouter } from "@/i18n/navigation"
import { useTranslations } from "next-intl"
import { useAuth } from "@/lib/auth/AuthProvider"
import { CallSetup } from "@/components/call/CallSetup"
import { CallRoom } from "@/components/call/CallRoom"
import { CallEndedSignup } from "@/components/call/CallEndedSignup"
import { Loader2, Video, User as UserIcon, Mic, Square, Send, CheckCircle2, RotateCcw, PhoneOff, Play, Pause } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { detectSupportedAudioFormat } from "@/lib/utils/audio-format-detector"

const LIVEKIT_URL = process.env.NEXT_PUBLIC_LIVEKIT_URL || ""
const MAX_RECORDING_SECONDS = 120

function VoicemailPreview({ blob, durationSeconds }: { blob: Blob; durationSeconds: number }) {
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const [playing, setPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const urlRef = useRef<string | null>(null)

  useEffect(() => {
    urlRef.current = URL.createObjectURL(blob)
    return () => { if (urlRef.current) URL.revokeObjectURL(urlRef.current) }
  }, [blob])

  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return
    const onTime = () => setCurrentTime(audio.currentTime)
    const onEnded = () => { setPlaying(false); setCurrentTime(0) }
    audio.addEventListener('timeupdate', onTime)
    audio.addEventListener('ended', onEnded)
    return () => { audio.removeEventListener('timeupdate', onTime); audio.removeEventListener('ended', onEnded) }
  }, [])

  const toggle = () => {
    const audio = audioRef.current
    if (!audio) return
    if (playing) { audio.pause(); setPlaying(false) }
    else { audio.play(); setPlaying(true) }
  }

  const fmt = (s: number) => {
    const m = Math.floor(s / 60)
    const sec = Math.floor(s % 60)
    return `${m}:${sec.toString().padStart(2, '0')}`
  }

  const progress = durationSeconds > 0 ? (currentTime / durationSeconds) * 100 : 0

  return (
    <div className="flex items-center gap-3 w-full max-w-xs bg-secondary rounded-full px-4 py-2">
      <audio ref={audioRef} src={urlRef.current || undefined} preload="auto" />
      <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0 rounded-full" onClick={toggle}>
        {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
      </Button>
      <div className="flex-1 min-w-0">
        <div className="h-1.5 bg-muted rounded-full overflow-hidden">
          <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${progress}%` }} />
        </div>
      </div>
      <span className="text-xs text-muted-foreground tabular-nums shrink-0">
        {fmt(playing || currentTime > 0 ? currentTime : durationSeconds)}
      </span>
    </div>
  )
}

type Phase = "loading" | "lobby" | "setup" | "joining" | "consent" | "active" | "ended" | "error" | "not_found" | "voicemail" | "voicemail_sent"

type ReachabilityState = "reachable_now" | "probably_offline" | "unknown"

interface OwnerInfo {
  ownerId: string
  displayName: string
  slug: string
  reachability?: ReachabilityState
}

export default function MeetPage() {
  const params = useParams()
  const router = useRouter()
  const t = useTranslations("meet")
  const tCallRoom = useTranslations("callRoom")
  const { user } = useAuth()

  const slug = params?.slug as string

  const [phase, setPhase] = useState<Phase>("loading")
  const [ownerInfo, setOwnerInfo] = useState<OwnerInfo | null>(null)
  const [visitorName, setVisitorName] = useState("")
  const [visitorEmail, setVisitorEmail] = useState("")
  const [callId, setCallId] = useState<string | null>(null)
  const [roomName, setRoomName] = useState<string | null>(null)
  const [token, setToken] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Voicemail recording state
  const [vmRecording, setVmRecording] = useState(false)
  const [vmBlob, setVmBlob] = useState<Blob | null>(null)
  const [vmSeconds, setVmSeconds] = useState(0)
  const [vmSending, setVmSending] = useState(false)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const streamRef = useRef<MediaStream | null>(null)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    async function resolveSlug() {
      try {
        const res = await fetch(`/api/meet/${encodeURIComponent(slug)}`)
        if (res.status === 404) {
          setPhase("not_found")
          return
        }
        if (!res.ok) {
          setError("Failed to load meeting room")
          setPhase("error")
          return
        }
        const data: OwnerInfo = await res.json()
        setOwnerInfo(data)

        if (user?.id === data.ownerId) {
          setVisitorName(data.displayName)
          setPhase("setup")
          return
        }

        setPhase("lobby")
      } catch {
        setError("Failed to load meeting room")
        setPhase("error")
      }
    }

    if (slug) resolveSlug()
  }, [slug, user?.id])

  // Cleanup media resources on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
      streamRef.current?.getTracks().forEach((t) => t.stop())
    }
  }, [])

  const handleJoinLobby = () => {
    if (!visitorName.trim()) return
    setPhase("setup")
  }

  const handleJoinCall = useCallback(async () => {
    setPhase("joining")
    try {
      const isOwner = user?.id === ownerInfo?.ownerId
      const res = await fetch(`/api/meet/${encodeURIComponent(slug)}/join`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          visitorName: visitorName.trim() || "Guest",
          visitorEmail: visitorEmail.trim() || null,
          isOwner,
        }),
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || "Failed to join meeting")
      }

      const data = await res.json()
      setCallId(data.callId)
      setRoomName(data.roomName)
      setToken(data.token)

      if (!user) {
        setPhase("consent")
      } else {
        setPhase("active")
      }
    } catch (err: any) {
      setError(err.message || "Failed to join meeting")
      setPhase("error")
    }
  }, [slug, visitorName, visitorEmail, user, ownerInfo?.ownerId])

  const handleLeave = useCallback(async () => {
    if (user) {
      if (callId) {
        try {
          await fetch(`/api/calls/${callId}/claim`, { method: "POST" })
        } catch {
          // Non-fatal
        }
      }
      router.push("/sessions")
    } else {
      setPhase("ended")
    }
  }, [user, callId, router])

  const startVoicemailRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream

      const format = detectSupportedAudioFormat()
      const options: MediaRecorderOptions = {}
      if (format.mimeType) options.mimeType = format.mimeType

      const recorder = new MediaRecorder(stream, options)
      mediaRecorderRef.current = recorder
      chunksRef.current = []

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data)
      }

      recorder.onstop = () => {
        const mimeType = recorder.mimeType || format.mimeType || 'audio/ogg'
        const blob = new Blob(chunksRef.current, { type: mimeType })
        setVmBlob(blob)
        setVmRecording(false)
        if (timerRef.current) {
          clearInterval(timerRef.current)
          timerRef.current = null
        }
        stream.getTracks().forEach((t) => t.stop())
      }

      recorder.start(1000)
      setVmRecording(true)
      setVmBlob(null)
      setVmSeconds(0)

      timerRef.current = setInterval(() => {
        setVmSeconds((prev) => {
          if (prev >= MAX_RECORDING_SECONDS - 1) {
            mediaRecorderRef.current?.stop()
            return prev + 1
          }
          return prev + 1
        })
      }, 1000)
    } catch {
      setError(t("micPermissionDenied"))
      setPhase("error")
    }
  }, [t])

  const stopVoicemailRecording = useCallback(() => {
    mediaRecorderRef.current?.stop()
  }, [])

  const resetVoicemail = useCallback(() => {
    setVmBlob(null)
    setVmSeconds(0)
  }, [])

  const sendVoicemail = useCallback(async () => {
    if (!vmBlob || !slug) return
    setVmSending(true)
    try {
      const blobMime = (vmBlob.type || 'audio/ogg').split(';')[0].trim()
      const extMap: Record<string, string> = {
        'audio/ogg': 'ogg', 'audio/mp4': 'mp4', 'audio/mpeg': 'mp3',
        'audio/wav': 'wav', 'audio/webm': 'webm', 'audio/aac': 'aac',
      }
      const ext = extMap[blobMime] || 'ogg'
      const formData = new FormData()
      formData.append('file', vmBlob, `voicemail.${ext}`)
      formData.append('visitorName', visitorName.trim() || 'Guest')
      if (visitorEmail.trim()) formData.append('visitorEmail', visitorEmail.trim())

      const res = await fetch(`/api/meet/${encodeURIComponent(slug)}/voicemail`, {
        method: 'POST',
        body: formData,
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || 'Failed to send message')
      }

      setPhase("voicemail_sent")
    } catch (err: any) {
      setError(err.message || 'Failed to send voice message')
      setPhase("error")
    } finally {
      setVmSending(false)
    }
  }, [vmBlob, slug, visitorName, visitorEmail])

  const ownerInitials = (ownerInfo?.displayName || "H")
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2)

  const ownerName = ownerInfo?.displayName || "Host"

  if (phase === "loading") {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          <p className="text-sm text-muted-foreground">{t("loading")}</p>
        </div>
      </div>
    )
  }

  if (phase === "not_found") {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="flex flex-col items-center gap-4 text-center p-6">
          <Video className="h-12 w-12 text-muted-foreground" />
          <p className="text-lg font-medium text-foreground">{t("notFound")}</p>
          <p className="text-sm text-muted-foreground max-w-sm">{t("notFoundHint")}</p>
          <button
            onClick={() => router.push("/")}
            className="text-sm text-primary hover:underline"
          >
            {t("goHome")}
          </button>
        </div>
      </div>
    )
  }

  if (phase === "error") {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="flex flex-col items-center gap-4 text-center p-6">
          <p className="text-lg font-medium text-foreground">{t("error")}</p>
          <p className="text-sm text-muted-foreground max-w-sm">{error}</p>
          <button
            onClick={() => setPhase("lobby")}
            className="text-sm text-primary hover:underline"
          >
            {t("tryAgain")}
          </button>
        </div>
      </div>
    )
  }

  if (phase === "voicemail_sent") {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background p-4">
        <Card className="w-full max-w-md">
          <CardContent className="pt-8 pb-8 text-center space-y-4">
            <CheckCircle2 className="h-16 w-16 text-success mx-auto" />
            <h2 className="text-xl font-semibold text-foreground">{t("messageSent")}</h2>
            <p className="text-sm text-muted-foreground">
              {t("messageConfirmation", { name: ownerName })}
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (phase === "voicemail") {
    const formatTime = (s: number) => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`

    return (
      <div className="flex items-center justify-center min-h-screen bg-background p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="flex justify-center mb-4">
              <Avatar className="h-16 w-16">
                <AvatarFallback className="text-xl bg-primary text-primary-foreground">
                  {ownerInitials}
                </AvatarFallback>
              </Avatar>
            </div>
            <CardTitle className="text-lg">{t("recordingFor", { name: ownerName })}</CardTitle>
            <CardDescription>{t("recordingHint")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex flex-col items-center gap-4">
              {/* Timer */}
              <div className="text-3xl font-mono text-foreground tabular-nums">
                {formatTime(vmSeconds)}
                {vmRecording && (
                  <span className="text-sm text-muted-foreground ml-2">/ {formatTime(MAX_RECORDING_SECONDS)}</span>
                )}
              </div>

              {/* Recording controls */}
              {!vmBlob ? (
                <Button
                  size="lg"
                  className={vmRecording ? "bg-destructive hover:bg-destructive/90 h-16 w-16 rounded-full p-0" : "h-16 w-16 rounded-full p-0"}
                  onClick={vmRecording ? stopVoicemailRecording : startVoicemailRecording}
                >
                  {vmRecording ? (
                    <Square className="h-6 w-6" />
                  ) : (
                    <Mic className="h-6 w-6" />
                  )}
                </Button>
              ) : (
                <div className="flex flex-col items-center gap-3 w-full">
                  {/* Audio preview — custom controls to avoid Infinity:NaN:NaN from missing duration headers */}
                  <VoicemailPreview blob={vmBlob} durationSeconds={vmSeconds} />
                  <div className="flex gap-3">
                    <Button variant="outline" onClick={resetVoicemail} disabled={vmSending}>
                      <RotateCcw className="h-4 w-4 mr-2" />
                      {t("reRecord")}
                    </Button>
                    <Button onClick={sendVoicemail} disabled={vmSending}>
                      {vmSending ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <Send className="h-4 w-4 mr-2" />
                      )}
                      {t("sendMessage")}
                    </Button>
                  </div>
                </div>
              )}

              {!vmBlob && !vmRecording && (
                <p className="text-xs text-muted-foreground">{t("tapToRecord")}</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (phase === "lobby") {
    const isOffline = ownerInfo?.reachability === "probably_offline"

    return (
      <div className="flex items-center justify-center min-h-screen bg-background p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="flex justify-center mb-4">
              <Avatar className="h-20 w-20">
                <AvatarFallback className="text-2xl bg-primary text-primary-foreground">
                  {ownerInitials}
                </AvatarFallback>
              </Avatar>
            </div>
            <CardTitle className="text-xl">
              {isOffline
                ? t("unavailableTitle", { name: ownerName })
                : t("joinTitle", { name: ownerName })}
            </CardTitle>
            <CardDescription>
              {isOffline ? t("unavailableSubtitle") : t("joinSubtitle")}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">
                {t("yourName")} *
              </label>
              <div className="relative">
                <UserIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder={t("namePlaceholder")}
                  value={visitorName}
                  onChange={(e) => setVisitorName(e.target.value)}
                  className="pl-9"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      if (isOffline) {
                        if (visitorName.trim()) setPhase("voicemail")
                      } else {
                        handleJoinLobby()
                      }
                    }
                  }}
                  autoFocus
                />
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">
                {t("yourEmail")}
              </label>
              <Input
                type="email"
                placeholder={t("emailPlaceholder")}
                value={visitorEmail}
                onChange={(e) => setVisitorEmail(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    if (isOffline) {
                      if (visitorName.trim()) setPhase("voicemail")
                    } else {
                      handleJoinLobby()
                    }
                  }
                }}
              />
              <p className="text-xs text-muted-foreground">{t("emailHint")}</p>
            </div>

            {isOffline ? (
              <div className="space-y-3">
                <Button
                  onClick={() => setPhase("voicemail")}
                  className="w-full"
                  size="lg"
                  disabled={!visitorName.trim()}
                >
                  <Mic className="h-4 w-4 mr-2" />
                  {t("leaveVoiceMessage")}
                </Button>
                <Button
                  onClick={handleJoinLobby}
                  variant="outline"
                  className="w-full"
                  size="lg"
                  disabled={!visitorName.trim()}
                >
                  <Video className="h-4 w-4 mr-2" />
                  {t("joinAnyway")}
                </Button>
              </div>
            ) : (
              <Button
                onClick={handleJoinLobby}
                className="w-full"
                size="lg"
                disabled={!visitorName.trim()}
              >
                <Video className="h-4 w-4 mr-2" />
                {t("continue")}
              </Button>
            )}
          </CardContent>
        </Card>
      </div>
    )
  }

  if (phase === "setup" || phase === "joining") {
    return (
      <CallSetup
        mode="video"
        isAuthenticated={true}
        userName={visitorName || user?.user_metadata?.full_name || user?.email?.split("@")[0]}
        onJoin={handleJoinCall}
        onCancel={() => {
          if (user?.id === ownerInfo?.ownerId) {
            router.push("/calls")
          } else {
            setPhase("lobby")
          }
        }}
        joining={phase === "joining"}
      />
    )
  }

  if (phase === "ended") {
    return (
      <CallEndedSignup
        callerName={ownerName}
        callId={callId || ""}
      />
    )
  }

  if (phase === "consent") {
    const handleConsent = async (granted: boolean) => {
      if (callId) {
        await fetch(`/api/calls/${callId}/consent`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            granted,
            participantName: visitorName,
            participantIdentity: `guest-${Date.now()}`,
          }),
        }).catch(() => {})
      }
      setPhase("active")
    }

    return (
      <div className="flex items-center justify-center h-[100dvh] bg-background p-6">
        <div className="w-full max-w-sm text-center space-y-5">
          <p className="text-base text-foreground">{tCallRoom("consentPrompt")}</p>
          <div className="flex gap-3">
            <button
              onClick={() => handleConsent(true)}
              className="flex-1 py-2.5 rounded-lg bg-primary text-primary-foreground font-medium text-sm hover:bg-primary/90 transition-colors"
            >
              {tCallRoom("consentAgree")}
            </button>
            <button
              onClick={() => handleConsent(false)}
              className="flex-1 py-2.5 rounded-lg border border-border text-foreground font-medium text-sm hover:bg-secondary transition-colors"
            >
              {tCallRoom("consentDecline")}
            </button>
          </div>
        </div>
      </div>
    )
  }

  if (!token || !LIVEKIT_URL || !roomName) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <p className="text-sm text-destructive">
          {!LIVEKIT_URL ? "NEXT_PUBLIC_LIVEKIT_URL is not configured" : "No access token"}
        </p>
      </div>
    )
  }

  return (
    <CallRoom
      roomName={roomName}
      callId={callId || ""}
      token={token}
      serverUrl={LIVEKIT_URL}
      mode="video"
      callType="web"
      pstnTranscriptionMode="batch"
      displayName={visitorName || user?.user_metadata?.full_name || user?.email?.split("@")[0]}
      isInitiator={false}
      onLeave={handleLeave}
    />
  )
}
