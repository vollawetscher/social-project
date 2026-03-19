"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { useRouter } from "@/i18n/navigation"
import { useTranslations } from "next-intl"
import {
  LiveKitRoom,
  RoomAudioRenderer,
  useConnectionState,
  useLocalParticipant,
  useRemoteParticipants,
  useRoomContext,
  useTracks,
  VideoTrack,
} from "@livekit/components-react"
import { ConnectionState, Track } from "livekit-client"
import { isTrackReference } from "@livekit/components-core"
import {
  BackgroundProcessor,
  supportsBackgroundProcessors,
  type BackgroundProcessorWrapper,
} from "@livekit/track-processors"
import {
  Phone,
  Video,
  Users,
  LayoutGrid,
  Maximize2,
  X,
  MessageSquareText,
  ArrowLeft,
  Link2,
  Check,
  Loader2,
  Shield,
  Lock,
  Unlock,
  UserX,
  MicOff,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { cn } from "@/lib/utils"
import { toast } from "sonner"
import { CallControls } from "@/components/call/CallControls"
import type { CallMode, LayoutMode } from "@/lib/types/call"
import { createClient as createSupabaseClient } from "@/lib/supabase/client"
import { formatDuration } from "@/lib/utils/date-formatters"

const RECONNECT_GRACE_MS = 30_000

interface RingSmsParams {
  phoneNumber: string
  callerName: string
  contactName?: string
}

interface CallRoomProps {
  roomName: string
  callId: string
  token: string
  serverUrl: string
  mode: CallMode
  callType: "web" | "pstn_outbound"
  contactName?: string
  contactPhone?: string
  displayName?: string
  isInitiator?: boolean
  onLeave?: () => void
  ringSmsParams?: RingSmsParams
}

interface ModerationParticipant {
  identity: string
  name: string
  role?: string
  roleLabel?: string
  shortIdentity?: string
}

type VideoBackgroundChoice = "none" | "blur" | "home" | "conference" | "office"

const VIDEO_BACKGROUND_CHOICES: Array<{ value: VideoBackgroundChoice; labelKey: string }> = [
  { value: "none",       labelKey: "backgroundNone" },
  { value: "blur",       labelKey: "backgroundBlur" },
  { value: "home",       labelKey: "backgroundHome" },
  { value: "conference", labelKey: "backgroundConference" },
  { value: "office",     labelKey: "backgroundOffice" },
]
const VIDEO_BACKGROUND_STORAGE_KEY = "notissima.video_background"
const AUDIO_INPUT_KEY = "notissima.call.audioInputDeviceId"
const VIDEO_INPUT_KEY = "notissima.call.videoInputDeviceId"

function getBackgroundImagePath(choice: VideoBackgroundChoice): string | null {
  if (choice === "home")       return "/backgrounds/home.jpg"
  if (choice === "conference") return "/backgrounds/conference.jpg"
  if (choice === "office")     return "/backgrounds/office.jpg"
  return null
}

/**
 * Plays a soft two-tone outbound ringtone (440 Hz + 480 Hz, European-style)
 * using the Web Audio API while `playing` is true. No audio files needed.
 */
function useRingtone(playing: boolean) {
  const ctxRef = useRef<AudioContext | null>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const stop = useCallback(() => {
    if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null }
    if (ctxRef.current) { ctxRef.current.close().catch(() => {}); ctxRef.current = null }
  }, [])

  const scheduleRing = useCallback((ctx: AudioContext) => {
    const now = ctx.currentTime
    // Two simultaneous sine tones blended softly — classic double-ring
    for (const freq of [440, 480]) {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.type = "sine"
      osc.frequency.value = freq
      gain.gain.setValueAtTime(0, now)
      gain.gain.linearRampToValueAtTime(0.055, now + 0.06)   // soft fade-in
      gain.gain.setValueAtTime(0.055, now + 0.38)
      gain.gain.linearRampToValueAtTime(0, now + 0.44)        // soft fade-out
      osc.start(now)
      osc.stop(now + 0.44)
    }
    // Repeat every 2.4 s (ring 0.44 s, pause 1.96 s)
    timerRef.current = setTimeout(() => {
      if (ctxRef.current) scheduleRing(ctxRef.current)
    }, 2400)
  }, [])

  useEffect(() => {
    if (!playing) { stop(); return }
    try {
      const ctx = new AudioContext()
      ctxRef.current = ctx
      scheduleRing(ctx)
    } catch {
      // AudioContext unavailable (e.g. SSR)
    }
    return stop
  }, [playing, scheduleRing, stop])
}

export function CallRoom(props: CallRoomProps) {
  const videoCaptureOptions = props.mode === "video"
    ? ({ resolution: { width: 1280, height: 720, frameRate: 30 } } as any)
    : false

  return (
    <LiveKitRoom
      token={props.token}
      serverUrl={props.serverUrl}
      connect={true}
      audio={true}
      video={videoCaptureOptions}
    >
      <RoomAudioRenderer />
      <CallRoomInner {...props} displayName={props.displayName} />
    </LiveKitRoom>
  )
}

function CallRoomInner({
  roomName,
  callId,
  mode,
  callType,
  contactName,
  contactPhone,
  displayName,
  isInitiator,
  onLeave,
  ringSmsParams,
}: Omit<CallRoomProps, "token" | "serverUrl">) {
  const router = useRouter()
  const t = useTranslations("callRoom")
  const tc = useTranslations("common")
  const room = useRoomContext()
  const connectionState = useConnectionState()
  const { localParticipant } = useLocalParticipant()
  const remoteParticipants = useRemoteParticipants()

  const cameraTracks = useTracks(
    [{ source: Track.Source.Camera, withPlaceholder: true }],
    { onlySubscribed: false }
  )

  const screenShareTracks = useTracks(
    [{ source: Track.Source.ScreenShare, withPlaceholder: false }],
    { onlySubscribed: true }
  )
  const activeScreenShare = screenShareTracks.find(isTrackReference)

  const [duration, setDuration] = useState(0)
  const [layout, setLayout] = useState<LayoutMode>("gallery")
  const [showTranscript, setShowTranscript] = useState(false)
  const [showNotes, setShowNotes] = useState(false)
  const [notes, setNotes] = useState("")
  const [viewMode, setViewMode] = useState<"simple" | "transcript">("simple")
  // Post-call notes state
  const [calleeLeft, setCalleeLeft] = useState(false)
  const [savingNotes, setSavingNotes] = useState(false)
  const remoteEverConnected = useRef(false)

  // Ring+SMS invitation status
  const [ringSmsStatus, setRingSmsStatus] = useState<
    "pending" | "sending" | "sms_sent" | "done" | "failed" | null
  >(ringSmsParams ? "pending" : null)
  const ringSmsTriggered = useRef(false)

  const consentLoggedRef = useRef(false)
  const [remoteConsents, setRemoteConsents] = useState<{ identity: string; name: string; granted: boolean }[]>([])
  const [pstnConsentState, setPstnConsentState] = useState<"not_required" | "pending" | "granted" | "declined" | "timeout">(
    callType === "pstn_outbound" ? "pending" : "not_required"
  )
  const [remoteCallEnded, setRemoteCallEnded] = useState(false)
  const [remoteEndReason, setRemoteEndReason] = useState<"declined" | "missed" | "ended" | "error" | null>(null)
  const [isSpeaker, setIsSpeaker] = useState(true)
  const [isOnHold, setIsOnHold] = useState(false)
  const [cameraDeviceIds, setCameraDeviceIds] = useState<string[]>([])
  const [currentCameraDeviceId, setCurrentCameraDeviceId] = useState<string | null>(null)
  const [reconnectDeadline, setReconnectDeadline] = useState<number | null>(null)
  const [reconnectSecondsLeft, setReconnectSecondsLeft] = useState(Math.floor(RECONNECT_GRACE_MS / 1000))
  const [videoBackground, setVideoBackground] = useState<VideoBackgroundChoice>("none")
  const [showModerationPanel, setShowModerationPanel] = useState(false)
  const [roomLocked, setRoomLocked] = useState(false)
  const [moderationParticipants, setModerationParticipants] = useState<ModerationParticipant[]>([])
  const [moderationLoading, setModerationLoading] = useState(false)

  const timerRef = useRef<NodeJS.Timeout | null>(null)
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const reconnectTickRef = useRef<NodeJS.Timeout | null>(null)
  const endingCallRef = useRef(false)
  const wakeLockRef = useRef<any>(null)
  const micBeforeHoldRef = useRef<boolean>(true)
  const backgroundProcessorRef = useRef<BackgroundProcessorWrapper | null>(null)
  const backgroundSupportWarnedRef = useRef(false)
  const profilePreferencesRef = useRef<Record<string, any>>({})
  const notesSyncSkipRef = useRef(false)
  const notesRef = useRef("")

  const isConnected = connectionState === ConnectionState.Connected
  const isConnecting = connectionState === ConnectionState.Connecting
  const isDisconnected = connectionState === ConnectionState.Disconnected
  const hasRemote = remoteParticipants.length > 0
  const hasRemoteAudio = remoteParticipants.some(p => p.isMicrophoneEnabled)
  const remoteReady = callType === "pstn_outbound" ? hasRemoteAudio : hasRemote

  const callStatus = isDisconnected
    ? "ended"
    : isConnected && remoteReady
      ? "connected"
      : isConnected
        ? "ringing"
        : "connecting"
  const isMuted = !localParticipant.isMicrophoneEnabled
  const isCameraOn = localParticipant.isCameraEnabled
  const isScreenSharing = localParticipant.isScreenShareEnabled
  const canScreenShare = typeof navigator !== "undefined" && !!navigator.mediaDevices?.getDisplayMedia

  const refreshModeration = useCallback(async () => {
    if (!isInitiator || !callId) return
    try {
      const res = await fetch(`/api/calls/${callId}/moderation`)
      if (!res.ok) return
      const data = await res.json()
      setRoomLocked(Boolean(data?.roomLocked))
      setModerationParticipants(Array.isArray(data?.participants) ? data.participants : [])
    } catch {
      // best effort
    }
  }, [isInitiator, callId])

  const toggleRoomLock = useCallback(async () => {
    if (!callId) return
    setModerationLoading(true)
    try {
      const res = await fetch(`/api/calls/${callId}/moderation`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roomLocked: !roomLocked }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data?.error || "Failed to update room lock")
      setRoomLocked(Boolean(data?.roomLocked))
      toast.success(data?.roomLocked ? "Room locked" : "Room unlocked")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update room lock")
    } finally {
      setModerationLoading(false)
    }
  }, [callId, roomLocked])

  const removeRemoteParticipant = useCallback(async (participant: ModerationParticipant) => {
    const identity = participant.identity
    if (!callId || !identity) return
    setModerationLoading(true)
    try {
      const res = await fetch(`/api/calls/${callId}/moderation`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identity }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data?.error || "Failed to remove participant")
      toast.success(`${participant.name || "Participant"} removed`)
      await refreshModeration()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to remove participant")
    } finally {
      setModerationLoading(false)
    }
  }, [callId, refreshModeration])

  useEffect(() => {
    if (!isInitiator || !callId) return
    refreshModeration()
    const id = setInterval(() => {
      refreshModeration()
    }, 5000)
    return () => clearInterval(id)
  }, [isInitiator, callId, refreshModeration])

  const clearReconnectTimers = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current)
      reconnectTimeoutRef.current = null
    }
    if (reconnectTickRef.current) {
      clearInterval(reconnectTickRef.current)
      reconnectTickRef.current = null
    }
  }, [])

  const releaseWakeLock = useCallback(async () => {
    try {
      if (wakeLockRef.current) {
        await wakeLockRef.current.release()
        wakeLockRef.current = null
      }
    } catch {
      // Ignore wake lock release failures.
    }
  }, [])

  const requestWakeLock = useCallback(async () => {
    try {
      if (typeof navigator !== "undefined" && "wakeLock" in navigator && isConnected && !wakeLockRef.current) {
        wakeLockRef.current = await (navigator as any).wakeLock.request("screen")
      }
    } catch {
      // Wake lock is best-effort and not available on all mobile browsers.
    }
  }, [isConnected])

  // Auto-log initiator consent on connect
  useEffect(() => {
    if (isInitiator && isConnected && callId && !consentLoggedRef.current) {
      consentLoggedRef.current = true
      fetch(`/api/calls/${callId}/consent`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          granted: true,
          participantName: displayName || "Guest",
          participantIdentity: localParticipant.identity,
        }),
      }).catch(() => {})
    }
  }, [isInitiator, isConnected, callId, displayName, localParticipant.identity])

  // Realtime consent + call lifecycle updates.
  useEffect(() => {
    if (!callId) return
    const supabase = createSupabaseClient()
    if (!supabase) return

    const syncConsents = async () => {
      if (!isInitiator) return
      try {
        const r = await fetch(`/api/calls/${callId}/consent`)
        if (r.ok) {
          const data = await r.json()
          const others = (data.consents || [])
            .filter((c: any) => c.participant_identity !== localParticipant.identity)
            .map((c: any) => ({ identity: c.participant_identity, name: c.participant_name, granted: c.granted }))
          setRemoteConsents(others)
          if (callType === "pstn_outbound" && others.length > 0) {
            const anyDeclined = others.some((c: any) => !c.granted)
            const allGranted = others.every((c: any) => c.granted)
            if (anyDeclined) setPstnConsentState("declined")
            else if (allGranted) setPstnConsentState("granted")
          }
        }
      } catch { /* ignore */ }
    }
    syncConsents()

    const channel = supabase
      .channel(`call-room-${callId}`)
      .on("postgres_changes", {
        event: "*",
        schema: "public",
        table: "calls",
        filter: `id=eq.${callId}`,
      }, (payload: any) => {
        const consentState = payload.new?.pstn_consent_state as "not_required" | "pending" | "granted" | "declined" | "timeout" | undefined
        if (consentState) {
          setPstnConsentState(consentState)
        }
        const sharedNotes = payload.new?.shared_notes
        if (typeof sharedNotes === "string" && sharedNotes !== notesRef.current) {
          notesSyncSkipRef.current = true
          setNotes(sharedNotes)
        }
        const status = payload.new?.status as "ended" | "missed" | "declined" | "error" | undefined
        if (status && ["ended", "missed", "declined", "error"].includes(status)) {
          setRemoteEndReason(status)
          setRemoteCallEnded(true)
        }
      })
      .on("postgres_changes", {
        event: "INSERT",
        schema: "public",
        table: "consent_logs",
        filter: `call_id=eq.${callId}`,
      }, (payload: any) => {
        if (!isInitiator) return
        const row = payload.new
        if (!row || row.participant_identity === localParticipant.identity) return
        setRemoteConsents((prev) => {
          const idx = prev.findIndex((item) => item.identity === row.participant_identity)
          const next = {
            identity: row.participant_identity,
            name: row.participant_name || "Participant",
            granted: Boolean(row.granted),
          }
          if (callType === "pstn_outbound") {
            setPstnConsentState(next.granted ? "granted" : "declined")
          }
          if (idx === -1) return [...prev, next]
          const clone = [...prev]
          clone[idx] = next
          return clone
        })
      })
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [callId, isInitiator, localParticipant.identity, callType])

  // Re-sync consent logs when the first remote participant joins, in case the
  // realtime INSERT arrived before our subscription was active (edge case).
  const prevHasRemoteRef = useRef(false)
  useEffect(() => {
    if (!isInitiator || !callId) return
    const justJoined = hasRemote && !prevHasRemoteRef.current
    prevHasRemoteRef.current = hasRemote
    if (!justJoined) return
    fetch(`/api/calls/${callId}/consent`)
      .then((r) => r.ok ? r.json() : null)
      .then((data) => {
        if (!data) return
        const others = (data.consents || [])
          .filter((c: any) => c.participant_identity !== localParticipant.identity)
          .map((c: any) => ({ identity: c.participant_identity, name: c.participant_name, granted: c.granted }))
        if (others.length > 0) setRemoteConsents(others)
      })
      .catch(() => {})
  }, [hasRemote, isInitiator, callId, localParticipant.identity])

  useEffect(() => {
    notesRef.current = notes
  }, [notes])

  useEffect(() => {
    if (!callId) return
    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch(`/api/calls/${callId}/shared-notes`)
        if (!res.ok) return
        const data = await res.json()
        if (cancelled) return
        const serverNotes = typeof data?.notes === "string" ? data.notes : ""
        notesSyncSkipRef.current = true
        setNotes(serverNotes)
      } catch {
        // best effort
      }
    })()
    return () => {
      cancelled = true
    }
  }, [callId])

  useEffect(() => {
    if (!callId) return
    if (notesSyncSkipRef.current) {
      notesSyncSkipRef.current = false
      return
    }
    const timer = setTimeout(() => {
      fetch(`/api/calls/${callId}/shared-notes`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notes }),
      }).catch(() => {})
    }, 350)
    return () => clearTimeout(timer)
  }, [callId, notes])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const localValue = window.localStorage.getItem(VIDEO_BACKGROUND_STORAGE_KEY)
        if (!cancelled && localValue && VIDEO_BACKGROUND_CHOICES.some((c) => c.value === localValue)) {
          setVideoBackground(localValue as VideoBackgroundChoice)
        }
      } catch {
        // Ignore localStorage access issues.
      }

      try {
        const res = await fetch("/api/profile")
        if (!res.ok) return
        const profile = await res.json()
        if (cancelled) return
        const prefs = (profile?.preferences && typeof profile.preferences === "object") ? profile.preferences : {}
        profilePreferencesRef.current = prefs
        const saved = prefs.video_background
        if (saved && VIDEO_BACKGROUND_CHOICES.some((c) => c.value === saved)) {
          setVideoBackground(saved as VideoBackgroundChoice)
        }
      } catch {
        // Best-effort profile preference load.
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const saveBackgroundPreference = useCallback(async (next: VideoBackgroundChoice) => {
    try {
      window.localStorage.setItem(VIDEO_BACKGROUND_STORAGE_KEY, next)
    } catch {
      // Ignore localStorage access issues.
    }

    const nextPreferences = {
      ...profilePreferencesRef.current,
      video_background: next,
    }
    profilePreferencesRef.current = nextPreferences
    try {
      await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ preferences: nextPreferences }),
      })
    } catch {
      // Best-effort preference persistence.
    }
  }, [])

  useEffect(() => {
    if (mode !== "video") return
    if (!isCameraOn) return

    const publication = localParticipant.getTrackPublication(Track.Source.Camera)
    const videoTrack = publication?.track as any
    if (!videoTrack) return

    let cancelled = false
    ;(async () => {
      if (videoBackground === "none") {
        if (backgroundProcessorRef.current) {
          try {
            // Disable processing without tearing down the underlying camera track.
            await backgroundProcessorRef.current.switchTo({ mode: "disabled" })
          } catch {
            try {
              await videoTrack.stopProcessor?.()
            } catch {
              // ignore stop errors
            } finally {
              backgroundProcessorRef.current = null
            }
          }
        }
        return
      }

      if (!supportsBackgroundProcessors()) {
        if (!backgroundSupportWarnedRef.current) {
          backgroundSupportWarnedRef.current = true
          toast.info(t("backgroundNotSupported"))
        }
        return
      }

      const imagePath = getBackgroundImagePath(videoBackground)
      const targetMode = videoBackground === "blur"
        ? ({ mode: "background-blur" as const, blurRadius: 16 })
        : ({ mode: "virtual-background" as const, imagePath: `${window.location.origin}${imagePath}` })

      try {
        if (!backgroundProcessorRef.current) {
          const processor = BackgroundProcessor(targetMode)
          if (cancelled) return
          await videoTrack.setProcessor(processor)
          backgroundProcessorRef.current = processor
        } else {
          await backgroundProcessorRef.current.switchTo(targetMode)
        }
      } catch {
        if (!backgroundSupportWarnedRef.current) {
          backgroundSupportWarnedRef.current = true
          toast.error(t("backgroundApplyFailed"))
        }
      }
    })()

    return () => {
      cancelled = true
    }
  }, [videoBackground, mode, isCameraOn, currentCameraDeviceId, localParticipant, t])

  useEffect(() => {
    if (!isConnected) return
    ;(async () => {
      try {
        const preferredAudio = window.localStorage.getItem(AUDIO_INPUT_KEY)
        if (preferredAudio) {
          await room.switchActiveDevice("audioinput", preferredAudio)
        }
      } catch {
        // best effort
      }
      if (mode !== "video") return
      try {
        const preferredVideo = window.localStorage.getItem(VIDEO_INPUT_KEY)
        if (preferredVideo) {
          await room.switchActiveDevice("videoinput", preferredVideo)
          setCurrentCameraDeviceId(preferredVideo)
        }
      } catch {
        // best effort
      }
    })()
  }, [isConnected, mode, room])

  // Play soft ringtone only for outbound PSTN calls while waiting for callee to pick up.
  // calleeLeft=true also produces callStatus="ringing" (connected, no remote),
  // so we must exclude that post-call phase explicitly.
  useRingtone(callType === "pstn_outbound" && callStatus === "ringing" && !calleeLeft)

  // Trigger Ring+SMS once room is connected
  useEffect(() => {
    if (!ringSmsParams || ringSmsTriggered.current || !isConnected || !callId) return
    ringSmsTriggered.current = true
    setRingSmsStatus("sending")
    fetch(`/api/calls/${callId}/ring-sms`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        phoneNumber: ringSmsParams.phoneNumber,
        callerName: ringSmsParams.callerName,
        ...(ringSmsParams.contactName ? { contactName: ringSmsParams.contactName } : {}),
      }),
    })
      .then(async (r) => {
        if (r.ok) {
          setRingSmsStatus("sms_sent")
          setTimeout(() => setRingSmsStatus("done"), 3000)
        } else {
          setRingSmsStatus("failed")
        }
      })
      .catch(() => setRingSmsStatus("failed"))
  }, [ringSmsParams, isConnected, callId])

  // Track whether the remote participant was ever connected, then detect when they leave
  useEffect(() => {
    if (hasRemote) {
      remoteEverConnected.current = true
    } else if (remoteEverConnected.current && isConnected && !calleeLeft) {
      // Remote left while we're still connected → callee hung up
      setCalleeLeft(true)
    }
  }, [hasRemote, isConnected, calleeLeft])

  const refreshCameraDevices = useCallback(async () => {
    try {
      if (!navigator.mediaDevices?.enumerateDevices) return
      const devices = await navigator.mediaDevices.enumerateDevices()
      const cameras = devices.filter((d) => d.kind === "videoinput")
      setCameraDeviceIds(cameras.map((d) => d.deviceId).filter(Boolean))

      const publication = localParticipant.getTrackPublication(Track.Source.Camera)
      const activeDeviceId = publication?.track?.mediaStreamTrack?.getSettings()?.deviceId || null
      if (activeDeviceId) {
        setCurrentCameraDeviceId(activeDeviceId)
      } else if (cameras[0]?.deviceId) {
        setCurrentCameraDeviceId(cameras[0].deviceId)
      }
    } catch {
      // Camera device listing is best-effort.
    }
  }, [localParticipant])

  useEffect(() => {
    if (mode !== "video") return
    refreshCameraDevices()
  }, [mode, isCameraOn, refreshCameraDevices])

  useEffect(() => {
    if (callStatus === "connected") {
      timerRef.current = setInterval(() => setDuration((d) => d + 1), 1000)
    } else if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [callStatus])

  useEffect(() => {
    if (!callId || !isConnected) return
    const interval = setInterval(() => {
      fetch(`/api/calls/${callId}/heartbeat`, {
        method: "POST",
        keepalive: true,
      }).catch(() => {})
    }, 15_000)
    return () => clearInterval(interval)
  }, [callId, isConnected])

  useEffect(() => {
    if (isConnected) {
      clearReconnectTimers()
      setReconnectDeadline(null)
      setReconnectSecondsLeft(Math.floor(RECONNECT_GRACE_MS / 1000))
      return
    }

    if (!isDisconnected || endingCallRef.current) return

    const deadline = Date.now() + RECONNECT_GRACE_MS
    setReconnectDeadline(deadline)
    setReconnectSecondsLeft(Math.floor(RECONNECT_GRACE_MS / 1000))

    reconnectTickRef.current = setInterval(() => {
      const leftMs = Math.max(0, deadline - Date.now())
      setReconnectSecondsLeft(Math.ceil(leftMs / 1000))
    }, 500)

    reconnectTimeoutRef.current = setTimeout(() => {
      if (onLeave) onLeave()
      else router.push("/calls")
    }, RECONNECT_GRACE_MS)

    return () => clearReconnectTimers()
  }, [isConnected, isDisconnected, onLeave, router, clearReconnectTimers])

  useEffect(() => {
    if (!remoteCallEnded || endingCallRef.current) return
    if (isInitiator) {
      if (remoteEndReason === "declined") toast.info(t("calleeDeclined"))
      else if (remoteEndReason === "missed") toast.info(t("calleeMissed"))
      else if (remoteEndReason === "error") toast.error(t("callEndedUnexpectedly"))
    }
    endingCallRef.current = true
    room.disconnect()
    setTimeout(() => {
      if (onLeave) onLeave()
      else router.push("/calls")
    }, 300)
  }, [remoteCallEnded, remoteEndReason, isInitiator, room, onLeave, router, t])

  useEffect(() => {
    if (isConnected) requestWakeLock()
    else releaseWakeLock()
  }, [isConnected, requestWakeLock, releaseWakeLock])

  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === "visible" && isConnected) {
        requestWakeLock()
      }
    }
    document.addEventListener("visibilitychange", handleVisibility)
    return () => document.removeEventListener("visibilitychange", handleVisibility)
  }, [isConnected, requestWakeLock])

  const endCall = useCallback(async () => {
    endingCallRef.current = true
    clearReconnectTimers()
    setReconnectDeadline(null)
    releaseWakeLock()

    // Delete the LiveKit room via API — this terminates SIP/Twilio legs too
    if (callId) {
      try {
        await fetch(`/api/calls/${callId}/end`, { method: "POST" })
      } catch {
        // Best-effort; proceed to disconnect regardless
      }
    }
    room.disconnect()
    setTimeout(() => {
      if (onLeave) onLeave()
      else router.push("/calls")
    }, 500)
  }, [callId, room, router, onLeave, clearReconnectTimers, releaseWakeLock])

  useEffect(() => {
    return () => {
      clearReconnectTimers()
      releaseWakeLock()
    }
  }, [clearReconnectTimers, releaseWakeLock])

  const retryConnection = useCallback(() => {
    window.location.reload()
  }, [])

  const saveNotesAndEnd = useCallback(async () => {
    setSavingNotes(true)
    if (callId && notes.trim()) {
      try {
        await fetch(`/api/calls/${callId}/notes`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ notes }),
        })
      } catch {
        // Best-effort
      }
    }
    setSavingNotes(false)
    endCall()
  }, [callId, notes, endCall])

  const toggleMute = useCallback(() => {
    localParticipant.setMicrophoneEnabled(isMuted)
  }, [localParticipant, isMuted])

  const toggleCamera = useCallback(() => {
    localParticipant.setCameraEnabled(!isCameraOn)
  }, [localParticipant, isCameraOn])

  const switchCamera = useCallback(async () => {
    if (mode !== "video") return
    try {
      if (!isCameraOn) {
        await localParticipant.setCameraEnabled(true)
      }

      const devices = await navigator.mediaDevices.enumerateDevices()
      const cameras = devices.filter((d) => d.kind === "videoinput" && d.deviceId)
      const ids = cameras.map((d) => d.deviceId)
      setCameraDeviceIds(ids)

      if (ids.length < 2) {
        toast.info(t("noAlternativeCamera"))
        return
      }

      const activeId = room.getActiveDevice("videoinput") || currentCameraDeviceId || ids[0]
      const currentIndex = activeId
        ? ids.findIndex((id) => id === activeId)
        : 0
      const nextIndex = currentIndex >= 0 ? (currentIndex + 1) % ids.length : 1
      const nextDeviceId = ids[nextIndex]
      const switched = await room.switchActiveDevice("videoinput", nextDeviceId)
      if (!switched) {
        toast.error(t("failedSwitchCamera"))
        return
      }
      setCurrentCameraDeviceId(nextDeviceId)
    } catch {
      toast.error(t("failedSwitchCamera"))
    }
  }, [mode, isCameraOn, localParticipant, currentCameraDeviceId, room])

  const toggleScreenShare = useCallback(() => {
    localParticipant.setScreenShareEnabled(!isScreenSharing)
  }, [localParticipant, isScreenSharing])

  const setRemoteVolume = useCallback((volume: number) => {
    try {
      remoteParticipants.forEach((p) => {
        p.setVolume(volume)
      })
    } catch {
      // Best-effort remote volume update.
    }
  }, [remoteParticipants])

  const toggleSpeaker = useCallback(() => {
    setIsSpeaker((prev) => {
      const next = !prev
      setRemoteVolume(next ? 1 : 0)
      return next
    })
  }, [setRemoteVolume])

  const toggleHold = useCallback(async () => {
    if (!isOnHold) {
      micBeforeHoldRef.current = localParticipant.isMicrophoneEnabled
      await localParticipant.setMicrophoneEnabled(false)
      setRemoteVolume(0)
      setIsOnHold(true)
      toast.info(t("callOnHold"))
      return
    }
    await localParticipant.setMicrophoneEnabled(micBeforeHoldRef.current)
    setRemoteVolume(isSpeaker ? 1 : 0)
    setIsOnHold(false)
    toast.info(t("callResumed"))
  }, [isOnHold, localParticipant, setRemoteVolume, isSpeaker])

  useEffect(() => {
    setRemoteVolume(isSpeaker && !isOnHold ? 1 : 0)
  }, [remoteParticipants.length, isSpeaker, isOnHold, setRemoteVolume])

  const [linkCopied, setLinkCopied] = useState(false)

  const copyInviteLink = useCallback(async () => {
    const url = new URL(window.location.href)
    url.searchParams.delete("token")
    // Ensure callId is in invite link so guests can fetch caller info
    if (callId && !url.searchParams.get("callId")) {
      url.searchParams.set("callId", callId)
    }
    const inviteUrl = url.toString()

    const caller = displayName || "Someone"
    const callLabel = mode === "video" ? "video call" : "audio call"
    // Plain-text version — works in SMS, WhatsApp, iMessage, Telegram, etc.
    const plainText = `Join ${caller} in a ${callLabel} now: ${inviteUrl}`
    // HTML version — renders as a clean hyperlink when pasted into email / rich editor
    const htmlText = `<p>Join <strong>${caller}</strong> in a ${callLabel}:<br><a href="${inviteUrl}">${inviteUrl}</a></p>`

    // Prefer Web Share API on mobile only (desktop share dialogs are clunky)
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent)
    if (isMobile && navigator.share) {
      try {
        await navigator.share({ text: `Join ${caller} in a ${callLabel}:`, url: inviteUrl })
        return
      } catch (err: any) {
        if (err?.name === "AbortError") return
      }
    }

    // Try rich clipboard (text/html + text/plain) — works in email clients & rich editors
    if (typeof ClipboardItem !== "undefined") {
      try {
        await navigator.clipboard.write([
          new ClipboardItem({
            "text/plain": new Blob([plainText], { type: "text/plain" }),
            "text/html": new Blob([htmlText], { type: "text/html" }),
          }),
        ])
        setLinkCopied(true)
        setTimeout(() => setLinkCopied(false), 2000)
        return
      } catch {
        // Fall through
      }
    }

    // Plain-text clipboard fallback
    try {
      await navigator.clipboard.writeText(plainText)
      setLinkCopied(true)
      setTimeout(() => setLinkCopied(false), 2000)
    } catch {
      // Last resort: execCommand fallback for older browsers / focus issues
      try {
        const ta = document.createElement("textarea")
        ta.value = plainText
        ta.style.position = "fixed"
        ta.style.opacity = "0"
        document.body.appendChild(ta)
        ta.focus()
        ta.select()
        document.execCommand("copy")
        document.body.removeChild(ta)
        setLinkCopied(true)
        setTimeout(() => setLinkCopied(false), 2000)
      } catch {
        toast.error(t("couldNotCopyLink"))
      }
    }
  }, [callId, displayName, mode])

  const ringSmsLabel = ringSmsStatus === "sending"
    ? t("sendingSms")
    : ringSmsStatus === "sms_sent"
      ? t("smsSentRinging")
      : ringSmsStatus === "done"
        ? t("invitationSentWaiting")
        : ringSmsStatus === "failed"
          ? t("invitationFailed")
          : null

  const pstnConsentLabel = callType === "pstn_outbound" && !hasRemote
    ? (pstnConsentState === "pending"
      ? t("awaitingPhoneConsent")
      : pstnConsentState === "declined"
        ? t("callerOnly")
        : pstnConsentState === "timeout"
          ? t("callerOnly")
          : null)
    : null

  const statusLabel = {
    connecting: t("connecting"),
    ringing: pstnConsentLabel || ringSmsLabel || t("waitingForOther"),
    connected: formatDuration(duration),
    ended: t("callEnded"),
  }

  const isVideo = mode === "video"
  const canSwitchCamera = isVideo && cameraDeviceIds.length > 1
  const hasConsentEntry = remoteConsents.length > 0
  const allRemoteGranted = hasConsentEntry && remoteConsents.every((c) => c.granted)
  const remoteDeclined = hasConsentEntry && remoteConsents.some((c) => !c.granted)
  const pstnConsentBadgeText = pstnConsentState === "pending"
    ? t("awaitingPhoneConsent")
    : pstnConsentState === "granted"
      ? t("consentGranted")
      : pstnConsentState === "declined" || pstnConsentState === "timeout"
        ? t("callerOnly")
        : t("awaitingParticipant")
  const pstnConsentBadgeTone = pstnConsentState === "granted"
    ? "bg-success/20 text-success"
    : pstnConsentState === "declined" || pstnConsentState === "timeout"
      ? "bg-warning/20 text-warning"
      : "bg-info/20 text-info"
  const consentBadgeText = callType === "pstn_outbound" && !hasRemote
    ? pstnConsentBadgeText
    : !hasRemote
      ? t("awaitingParticipant")
      : allRemoteGranted
        ? t("consentGranted")
        : remoteDeclined
          ? t("callerOnly")
          : t("consentPending")
  const consentBadgeTone = callType === "pstn_outbound" && !hasRemote
    ? pstnConsentBadgeTone
    : allRemoteGranted
      ? "bg-success/20 text-success"
      : remoteDeclined
        ? "bg-warning/20 text-warning"
        : "bg-info/20 text-info"

  const contactInitials = contactName
    ? contactName.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2)
    : contactPhone?.slice(-2) || "?"

  const remoteDisplayName = remoteParticipants[0]?.name || contactName || contactPhone || t("participant")
  const remoteInitials = remoteDisplayName.split(" ").map((n: string) => n[0]).join("").toUpperCase().slice(0, 2)

  // --- Audio-only or pre-connection view ---
  if (!isVideo || callStatus !== "connected") {
    return (
      <div className="flex flex-col h-[100dvh] bg-background items-center">
        <div className="flex flex-col w-full max-w-3xl h-full">
        {/* Top Bar */}
        <div className="flex items-center justify-between px-4 py-3 z-10 shrink-0">
          <button onClick={endCall} className="flex items-center gap-1 text-sm opacity-80 hover:opacity-100 transition-opacity text-foreground">
            <ArrowLeft className="h-4 w-4" />
            <span>{tc('back')}</span>
          </button>
          <div className="flex items-center gap-2">
            {isInitiator && callId && (
              <button
                onClick={copyInviteLink}
                className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-[10px] bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
                title={t('copyInviteLink')}
              >
                {linkCopied ? <Check className="h-3 w-3" /> : <Link2 className="h-3 w-3" />}
                {linkCopied ? tc('copied') : t('invite')}
              </button>
            )}
            {callStatus === "connected" && (
              <Badge variant="secondary" className="text-[10px] gap-1 bg-destructive/20 text-destructive border-0">
                <span className="h-1.5 w-1.5 rounded-full bg-destructive animate-pulse" />
                REC
              </Badge>
            )}
            {isInitiator && (
              <Badge variant="secondary" className={cn(
                "text-[10px] gap-1 border-0",
                consentBadgeTone
              )}>
                <Check className="h-3 w-3" />
                {consentBadgeText}
              </Badge>
            )}
            <Badge variant="secondary" className={cn(
              "text-[10px] gap-1 border-0",
              callType === "pstn_outbound" ? "bg-primary/20 text-primary" : "bg-info/20 text-info"
            )}>
              {callType === "pstn_outbound" ? <Phone className="h-3 w-3" /> : <Video className="h-3 w-3" />}
              {callType === "pstn_outbound" ? "Twilio" : "LiveKit"}
            </Badge>
          </div>
        </div>

        {/* View Toggle */}
        {callStatus === "connected" && (
          <div className="flex justify-center px-4 pb-2 z-10 shrink-0">
            <div className="flex p-0.5 rounded-lg bg-secondary">
              <button
                onClick={() => setViewMode("simple")}
                className={cn(
                  "px-3 py-1 rounded-md text-xs font-medium transition-colors",
                  viewMode === "simple" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"
                )}
              >
                {t('call')}
              </button>
              <button
                onClick={() => setViewMode("transcript")}
                className={cn(
                  "flex items-center gap-1 px-3 py-1 rounded-md text-xs font-medium transition-colors",
                  viewMode === "transcript" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"
                )}
              >
                <MessageSquareText className="h-3 w-3" />
                {t('transcript')}
              </button>
            </div>
          </div>
        )}

        {/* Main Area */}
        <div className="flex-1 flex flex-col overflow-hidden relative">
          {isDisconnected && reconnectDeadline && !endingCallRef.current && (
            <div className="absolute top-2 left-1/2 -translate-x-1/2 z-20 rounded-md border border-warning/40 bg-warning/15 px-3 py-1.5 text-xs text-warning-foreground">
              {t("reconnecting", { seconds: reconnectSecondsLeft })}
              <button
                onClick={retryConnection}
                className="ml-2 underline underline-offset-2 hover:no-underline"
              >
                {t("retryNow")}
              </button>
            </div>
          )}
          {viewMode === "simple" && (
            <div className="flex-1 flex flex-col items-center justify-center w-full">
              <div className={cn("rounded-full p-1", callStatus === "connected" && "ring-4 ring-primary/20")}>
                <Avatar className="h-28 w-28">
                  <AvatarFallback className="bg-secondary text-foreground text-4xl">
                    {hasRemote ? remoteInitials : contactInitials}
                  </AvatarFallback>
                </Avatar>
              </div>
              <div className="text-center mt-4">
                <h2 className="text-xl font-semibold text-foreground">{remoteDisplayName}</h2>
                {contactPhone && <p className="text-sm text-muted-foreground mt-1">{contactPhone}</p>}
                {callStatus === "connected" && remoteParticipants[0] && !remoteParticipants[0].isMicrophoneEnabled && (
                  <div className="inline-flex items-center gap-1 mt-2 px-2 py-0.5 rounded-full bg-destructive/10 text-destructive text-xs font-medium">
                    <MicOff className="h-3 w-3" />
                    {t("remoteMuted")}
                  </div>
                )}
              </div>
              <p className={cn(
                "text-lg mt-3",
                callStatus === "connected" ? "text-foreground" : "text-muted-foreground"
              )}>
                {statusLabel[callStatus]}
              </p>
              {callStatus === "ringing" && ringSmsStatus && ringSmsStatus !== "failed" && ringSmsStatus !== "done" && (
                <div className="flex items-center gap-2 mt-2">
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
                </div>
              )}
              {callStatus === "ringing" && ringSmsStatus === "done" && (
                <div className="flex items-center gap-2 mt-2">
                  <Check className="h-3.5 w-3.5 text-primary" />
                </div>
              )}
              {callStatus === "ringing" && (
                <button
                  onClick={copyInviteLink}
                  className="flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 hover:bg-primary/15 transition-colors mt-4"
                >
                  {linkCopied ? <Check className="h-4 w-4 text-primary" /> : <Link2 className="h-4 w-4 text-primary" />}
                  <span className="text-sm text-primary font-medium">
                    {linkCopied ? t("linkCopied") : t("copyInviteLink")}
                  </span>
                </button>
              )}
              {callStatus === "connected" && (
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 mt-4">
                  <span className="h-2 w-2 rounded-full bg-primary animate-pulse" />
                  <span className="text-xs text-primary font-medium">{t("recordingTranscribing")}</span>
                </div>
              )}
            </div>
          )}

          {viewMode === "transcript" && callStatus === "connected" && (
            <div className="flex-1 overflow-y-auto px-4 py-3">
              <div className="flex items-center gap-2 pb-3 mb-2 border-b border-border">
                <Avatar className="h-8 w-8">
                  <AvatarFallback className="bg-secondary text-foreground text-xs">{remoteInitials}</AvatarFallback>
                </Avatar>
                <div>
                  <p className="text-sm font-medium text-foreground">{remoteDisplayName}</p>
                  <p className="text-[11px] text-muted-foreground">{statusLabel[callStatus]}</p>
                </div>
                <div className="ml-auto flex items-center gap-1">
                  <span className="h-1.5 w-1.5 rounded-full bg-destructive animate-pulse" />
                  <span className="text-[10px] text-destructive font-medium">REC</span>
                </div>
              </div>
              <div className="flex items-center justify-center py-12">
                <p className="text-sm text-muted-foreground">{t("transcriptAfterCall")}</p>
              </div>
            </div>
          )}
        </div>

        {/* Post-call spoken notes (callee hung up, mic + recording still active) */}
        {calleeLeft ? (
          <div className="flex flex-col items-center justify-center flex-1 px-6 py-8 bg-background gap-6">
            {/* Pulsing mic indicator */}
            <div className="relative flex items-center justify-center">
              <span className="absolute h-24 w-24 rounded-full bg-destructive/20 animate-ping" />
              <span className="absolute h-16 w-16 rounded-full bg-destructive/30 animate-pulse" />
              <div className="relative h-14 w-14 rounded-full bg-destructive flex items-center justify-center">
                <svg viewBox="0 0 24 24" className="h-7 w-7 text-white fill-current">
                  <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm5.91-3c-.49 0-.9.36-.98.85C16.52 14.2 14.47 16 12 16s-4.52-1.8-4.93-4.15c-.08-.49-.49-.85-.98-.85-.61 0-1.09.54-1 1.14.49 3 2.89 5.35 5.91 5.78V20c0 .55.45 1 1 1s1-.45 1-1v-2.08c3.02-.43 5.42-2.78 5.91-5.78.1-.6-.39-1.14-1-1.14z"/>
                </svg>
              </div>
            </div>

            {/* Instruction text */}
            <div className="text-center space-y-1.5">
              <p className="text-base font-semibold text-foreground">{t("stillRecordingNotes")}</p>
              <p className="text-sm text-muted-foreground">
                {t.rich("sayCommand", {
                  keyword: (chunks) => <span className="font-medium text-foreground">{chunks}</span>,
                })}
              </p>
            </div>

            {/* Example commands */}
            <div className="w-full max-w-xs space-y-2">
              {[
                "Notissima: Summarise focussing on cost savings",
                "Notissima: Extract all action items",
                "Notissima: Save this as a report",
              ].map((ex) => (
                <div key={ex} className="px-3 py-2 rounded-lg bg-secondary text-xs text-muted-foreground font-mono">
                  "{ex}"
                </div>
              ))}
            </div>

            {/* Done button */}
            <button
              onClick={saveNotesAndEnd}
              disabled={savingNotes}
              className="w-full max-w-xs py-3.5 rounded-2xl bg-destructive text-white text-sm font-semibold hover:bg-destructive/90 transition-colors flex items-center justify-center gap-2 mt-2"
            >
              {savingNotes
                ? <><Loader2 className="h-4 w-4 animate-spin" /> {t("ending")}</>
                : <>{t("stopRecordingEnd")}</>
              }
            </button>
          </div>
        ) : (
          <>
            {/* Notes Panel (in-call) */}
            {showNotes && (
              <div className="border-t px-4 py-3 shrink-0 border-border bg-card">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-medium text-muted-foreground">{t("notes")}</span>
                  <button onClick={() => setShowNotes(false)}>
                    <X className="h-4 w-4 text-muted-foreground" />
                  </button>
                </div>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder={t("addCallNotes")}
                  className="w-full h-20 text-sm rounded-lg p-2 resize-none focus:outline-none focus:ring-1 bg-secondary text-foreground placeholder:text-muted-foreground focus:ring-primary"
                />
              </div>
            )}

            {/* Controls */}
            {callStatus !== "ended" ? (
              <CallControls
                mode={mode}
                isMuted={isMuted}
                isCameraOn={isCameraOn}
                isSpeaker={isSpeaker}
                isOnHold={isOnHold}
                isScreenSharing={isScreenSharing}
                canScreenShare={canScreenShare}
                showNotes={showNotes}
                showTranscript={showTranscript}
                onToggleMute={toggleMute}
                onToggleCamera={toggleCamera}
                onToggleSpeaker={toggleSpeaker}
                onToggleHold={toggleHold}
                onToggleScreenShare={toggleScreenShare}
                onToggleNotes={() => setShowNotes(!showNotes)}
                onToggleTranscript={() => setShowTranscript(!showTranscript)}
                onSwitchCamera={switchCamera}
                canSwitchCamera={canSwitchCamera}
                onEndCall={endCall}
              />
            ) : (
              <div className="px-4 pb-6 pt-3 border-t border-border bg-card text-center py-4">
                <p className="text-sm text-muted-foreground">
                  {t("callEnded")} {duration > 0 && `· ${formatDuration(duration)}`}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {t("transcriptInSessions")}
                </p>
              </div>
            )}
          </>
        )}
        </div>
      </div>
    )
  }

  // --- Video room view ---
  const participantCount = 1 + remoteParticipants.length
  const isFocusLayout = layout === "focus"

  return (
    <div className="flex flex-col h-[100dvh] bg-[#111] items-center">
      <div className="flex flex-col w-full max-w-3xl h-full">
      {/* Top Bar */}
      <div className="flex items-center justify-between px-4 py-2.5 z-10 shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-sm font-medium text-white truncate">{roomName}</span>
          <div className="flex items-center gap-1 shrink-0">
            <Users className="h-3 w-3 text-white/50" />
            <span className="text-xs text-white/50">{participantCount}</span>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0 relative">
          <label className="text-[10px] text-white/60 hidden sm:block">{t("background")}</label>
          <select
            value={videoBackground}
            onChange={(e) => {
              const next = e.target.value as VideoBackgroundChoice
              setVideoBackground(next)
              void saveBackgroundPreference(next)
            }}
            className="h-7 rounded-md bg-white/10 text-[10px] text-white/90 px-2 outline-none border border-white/10"
            aria-label={t("background")}
          >
            {VIDEO_BACKGROUND_CHOICES.map((choice) => (
              <option key={choice.value} value={choice.value} className="text-black">
                {t(choice.labelKey)}
              </option>
            ))}
          </select>
          {isInitiator && callId && (
            <button
              onClick={copyInviteLink}
              className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-[10px] bg-white/10 text-white/80 hover:bg-white/15 transition-colors"
              title={t('copyInviteLink')}
            >
              {linkCopied ? <Check className="h-3 w-3" /> : <Link2 className="h-3 w-3" />}
              {linkCopied ? tc('copied') : t('invite')}
            </button>
          )}
          <Badge variant="secondary" className="text-[10px] gap-1 bg-destructive/20 text-destructive border-0">
            <span className="h-1.5 w-1.5 rounded-full bg-destructive animate-pulse" />
            {formatDuration(duration)}
          </Badge>
          {isInitiator && (
            <Badge variant="secondary" className={cn(
              "text-[10px] gap-1 border-0",
              consentBadgeTone
            )}>
              <Check className="h-3 w-3" />
              {consentBadgeText}
            </Badge>
          )}
          <button
            onClick={() => setLayout(layout === "gallery" ? "focus" : "gallery")}
            title={layout === "gallery" ? "Switch to focus layout" : "Switch to gallery layout"}
            className="h-7 w-7 rounded-md bg-white/10 flex items-center justify-center hover:bg-white/15 transition-colors"
          >
            {layout === "gallery" ? (
              <Maximize2 className="h-3.5 w-3.5 text-white/70" />
            ) : (
              <LayoutGrid className="h-3.5 w-3.5 text-white/70" />
            )}
          </button>
          {isInitiator && (
            <button
              onClick={() => setShowModerationPanel((s) => !s)}
              title="Host controls"
              className={cn(
                "h-7 w-7 rounded-md flex items-center justify-center transition-colors",
                showModerationPanel ? "bg-white/20" : "bg-white/10 hover:bg-white/15"
              )}
            >
              <Shield className="h-3.5 w-3.5 text-white/80" />
            </button>
          )}
          {isInitiator && showModerationPanel && (
            <div className="absolute right-0 top-9 z-30 w-72 rounded-lg border border-white/15 bg-[#1a1a1a] shadow-2xl p-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium text-white/80">Host controls</span>
                <button
                  onClick={toggleRoomLock}
                  disabled={moderationLoading}
                  className="inline-flex items-center gap-1 rounded-md border border-white/15 px-2 py-1 text-[11px] text-white/80 hover:bg-white/10 disabled:opacity-60"
                >
                  {roomLocked ? <Lock className="h-3 w-3" /> : <Unlock className="h-3 w-3" />}
                  {roomLocked ? "Locked" : "Unlocked"}
                </button>
              </div>
              <div className="space-y-1 max-h-48 overflow-y-auto">
                {moderationParticipants
                  .filter((p) => p.identity !== localParticipant.identity)
                  .map((p) => (
                    <div key={p.identity} className="flex items-center justify-between rounded-md border border-white/10 px-2 py-1.5">
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <p className="text-[11px] text-white/85 truncate">{p.name}</p>
                          <span className="shrink-0 rounded-full border border-white/20 px-1.5 py-0.5 text-[9px] text-white/70">
                            {p.roleLabel || "Participant"}
                          </span>
                        </div>
                        <p className="text-[10px] text-white/45 truncate">
                          {p.shortIdentity || p.identity}
                        </p>
                      </div>
                      <button
                        onClick={() => removeRemoteParticipant(p)}
                        disabled={moderationLoading}
                        className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[10px] text-destructive bg-destructive/10 hover:bg-destructive/15 disabled:opacity-60"
                      >
                        <UserX className="h-3 w-3" />
                        Remove
                      </button>
                    </div>
                  ))}
                {moderationParticipants.filter((p) => p.identity !== localParticipant.identity).length === 0 && (
                  <p className="text-[11px] text-white/45 py-2">No removable participants</p>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Video Area */}
      <div className="flex-1 overflow-hidden relative">
        {isDisconnected && reconnectDeadline && !endingCallRef.current && (
          <div className="absolute top-2 left-1/2 -translate-x-1/2 z-20 rounded-md border border-warning/40 bg-warning/15 px-3 py-1.5 text-xs text-warning-foreground">
            {t("reconnecting", { seconds: reconnectSecondsLeft })}
            <button
              onClick={retryConnection}
              className="ml-2 underline underline-offset-2 hover:no-underline"
            >
              {t("retryNow")}
            </button>
          </div>
        )}
        {activeScreenShare ? (
          /* Screen share layout: shared screen takes main area, camera tiles in corner */
          <div className="h-full p-2 flex flex-col">
            <div className="flex-1 min-h-0 flex items-center justify-center">
              <div className="w-full h-full rounded-xl overflow-hidden bg-[#1a1a1a] relative">
                <VideoTrack
                  trackRef={activeScreenShare}
                  className="absolute inset-0 w-full h-full object-contain"
                />
                <div className="absolute bottom-0 left-0 right-0 p-1.5 bg-gradient-to-t from-black/60 to-transparent">
                  <span className="text-xs text-white font-medium">
                    {activeScreenShare.participant.sid === localParticipant.sid
                      ? t("youAreSharing")
                      : t("participantSharing", { name: activeScreenShare.participant.name || activeScreenShare.participant.identity })}
                  </span>
                </div>
              </div>
            </div>
            {/* Small camera tiles below screen share */}
            <div className="flex gap-2 mt-2 h-24 shrink-0">
              {remoteParticipants.map((rp) => {
                const remoteCamera = cameraTracks.find(t => t.participant.sid === rp.sid)
                return (
                  <div key={rp.sid} className="w-32 h-full">
                    <LiveParticipantTile
                      name={rp.name || rp.identity}
                      isMuted={!rp.isMicrophoneEnabled}
                      hasVideo={rp.isCameraEnabled}
                      videoTrack={remoteCamera}
                    />
                  </div>
                )
              })}
              <div className="w-32 h-full">
                <LiveParticipantTile
                  name={t("you")}
                  isMuted={isMuted}
                  hasVideo={isCameraOn}
                  videoTrack={cameraTracks.find(tr => tr.participant.sid === localParticipant.sid)}
                  isLocal
                />
              </div>
            </div>
          </div>
        ) : isFocusLayout ? (
          /* Focus layout: remote full-screen, local in floating PiP */
          <div className="h-full p-2 relative">
            <div className="h-full rounded-xl overflow-hidden">
              {remoteParticipants.length > 0 ? (
                <div className={cn(
                  "h-full gap-2",
                  remoteParticipants.length > 1 ? "grid grid-cols-2" : ""
                )}>
                  {remoteParticipants.map((rp) => {
                    const remoteCamera = cameraTracks.find(t => t.participant.sid === rp.sid)
                    return (
                      <LiveParticipantTile
                        key={rp.sid}
                        name={rp.name || rp.identity}
                        isMuted={!rp.isMicrophoneEnabled}
                        hasVideo={rp.isCameraEnabled}
                        videoTrack={remoteCamera}
                      />
                    )
                  })}
                </div>
              ) : (
                <div className="h-full rounded-xl bg-[#1a1a1a] flex flex-col items-center justify-center">
                  <Avatar className="h-14 w-14 mb-3">
                    <AvatarFallback className="bg-white/10 text-white text-lg">
                      {contactInitials}
                    </AvatarFallback>
                  </Avatar>
                  <p className="text-sm text-white/50 mb-4">{t("waitingForOther")}</p>
                  <button
                    onClick={copyInviteLink}
                    className="flex items-center gap-2 px-4 py-2 rounded-full bg-primary hover:bg-primary/90 transition-colors"
                  >
                    {linkCopied ? <Check className="h-4 w-4 text-primary-foreground" /> : <Link2 className="h-4 w-4 text-primary-foreground" />}
                    <span className="text-sm font-medium text-primary-foreground">{linkCopied ? tc("copied") : t("copyInviteLink")}</span>
                  </button>
                </div>
              )}
            </div>
            <div className="absolute bottom-4 right-4 w-32 h-44 sm:w-40 sm:h-56 rounded-xl overflow-hidden border border-white/20 shadow-2xl z-10">
              <LiveParticipantTile
                name={t("you")}
                isMuted={isMuted}
                hasVideo={isCameraOn}
                videoTrack={cameraTracks.find(tr => tr.participant.sid === localParticipant.sid)}
                isLocal
              />
            </div>
          </div>
        ) : (
          /* Gallery layout: side by side */
          <div className="h-full p-2 flex flex-col gap-2 md:flex-row md:items-center md:justify-center md:overflow-hidden">
            <div className="flex-1 min-h-0 flex items-center justify-center md:flex-1 md:h-full md:max-w-[50%] md:overflow-hidden">
              <div className="w-full h-full md:h-full md:max-w-full md:aspect-[3/4] md:mx-auto">
                {remoteParticipants.length > 0 ? (
                  <div className={cn(
                    "h-full gap-2",
                    remoteParticipants.length > 1 ? "grid grid-cols-2" : ""
                  )}>
                    {remoteParticipants.map((rp) => {
                      const remoteCamera = cameraTracks.find(t => t.participant.sid === rp.sid)
                      return (
                        <LiveParticipantTile
                          key={rp.sid}
                          name={rp.name || rp.identity}
                          isMuted={!rp.isMicrophoneEnabled}
                          hasVideo={rp.isCameraEnabled}
                          videoTrack={remoteCamera}
                        />
                      )
                    })}
                  </div>
                ) : (
                  <div className="h-full rounded-xl bg-[#1a1a1a] flex flex-col items-center justify-center">
                    <Avatar className="h-14 w-14 mb-3">
                      <AvatarFallback className="bg-white/10 text-white text-lg">
                        {contactInitials}
                      </AvatarFallback>
                    </Avatar>
                    <p className="text-sm text-white/50 mb-4">{t("waitingForOther")}</p>
                    <button
                      onClick={copyInviteLink}
                      className="flex items-center gap-2 px-4 py-2 rounded-full bg-primary hover:bg-primary/90 transition-colors"
                    >
                      {linkCopied ? <Check className="h-4 w-4 text-primary-foreground" /> : <Link2 className="h-4 w-4 text-primary-foreground" />}
                      <span className="text-sm font-medium text-primary-foreground">{linkCopied ? tc("copied") : t("copyInviteLink")}</span>
                    </button>
                  </div>
                )}
              </div>
            </div>
            <div className="flex-1 min-h-0 flex items-center justify-center md:flex-1 md:h-full md:max-w-[50%] md:overflow-hidden">
              <div className="w-full h-full md:h-full md:max-w-full md:aspect-[3/4] md:mx-auto">
                <LiveParticipantTile
                  name={t("you")}
                  isMuted={isMuted}
                  hasVideo={isCameraOn}
                  videoTrack={cameraTracks.find(tr => tr.participant.sid === localParticipant.sid)}
                  isLocal
                />
              </div>
            </div>
          </div>
        )}

        {/* Transcript Overlay */}
        {showTranscript && (
          <div className="absolute inset-x-0 bottom-0 top-1/3 bg-gradient-to-t from-black/90 via-black/70 to-transparent z-20 flex flex-col">
            <div className="flex items-center justify-between px-4 pt-8 pb-2">
              <span className="text-xs font-medium text-white/60">{t("transcript")}</span>
              <button onClick={() => setShowTranscript(false)}>
                <X className="h-4 w-4 text-white/40" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-4 pb-2">
              <p className="text-sm text-white/80 text-center py-8">
                {t("transcriptAfterCall")}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Controls */}
      <CallControls
        mode="video"
        variant="room"
        isMuted={isMuted}
        isCameraOn={isCameraOn}
        isSpeaker={isSpeaker}
        isOnHold={isOnHold}
        isScreenSharing={isScreenSharing}
        canScreenShare={canScreenShare}
        showNotes={showNotes}
        showTranscript={showTranscript}
        onToggleMute={toggleMute}
        onToggleCamera={toggleCamera}
        onToggleSpeaker={toggleSpeaker}
        onToggleHold={toggleHold}
        onToggleScreenShare={toggleScreenShare}
        onToggleNotes={() => setShowNotes(!showNotes)}
        onToggleTranscript={() => setShowTranscript(!showTranscript)}
        onSwitchCamera={switchCamera}
        canSwitchCamera={canSwitchCamera}
        onEndCall={endCall}
        dark
      />
      </div>
    </div>
  )
}

/**
 * Renders a participant's video tile with real LiveKit track or avatar fallback.
 */
function LiveParticipantTile({ name, isMuted, hasVideo, videoTrack, isLocal }: {
  name: string
  isMuted: boolean
  hasVideo: boolean
  videoTrack?: ReturnType<typeof useTracks>[number]
  isLocal?: boolean
}) {
  const initials = name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2)
  const displayName = isLocal ? name : name.split(" ")[0]

  return (
    <div className="relative rounded-xl overflow-hidden w-full h-full flex items-center justify-center bg-[#1a1a1a]">
      {hasVideo && videoTrack?.publication?.track ? (
        <VideoTrack
          trackRef={videoTrack}
          className="absolute inset-0 w-full h-full object-cover"
        />
      ) : (
        <Avatar className="h-14 w-14">
          <AvatarFallback className="bg-white/10 text-white text-lg">
            {initials}
          </AvatarFallback>
        </Avatar>
      )}
      <div className="absolute bottom-0 left-0 right-0 p-1.5 bg-gradient-to-t from-black/60 to-transparent">
        <div className="flex items-center justify-between">
          <span className="text-xs text-white font-medium truncate">{displayName}</span>
          {isMuted && (
            <span className="text-[8px] text-destructive bg-destructive/20 px-1 rounded">MUTED</span>
          )}
        </div>
      </div>
    </div>
  )
}
