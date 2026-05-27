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
import { ConnectionState, Track, RoomEvent } from "livekit-client"
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
  PauseCircle,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { cn } from "@/lib/utils"
import { toast } from "sonner"
import { CallControls } from "@/components/call/CallControls"
import { CallNotesPanel } from "@/components/call/CallNotesPanel"
import type { TimedCallNote } from "@/lib/services/merge-call-notes"
import type { CallMode, LayoutMode } from "@/lib/types/call"
import type { PstnTranscriptionMode } from "@/lib/types/call"
import { createClient as createSupabaseClient } from "@/lib/supabase/client"
import { formatDuration } from "@/lib/utils/date-formatters"
import { SpeechmaticsRealtimeService, getSpeechmaticsRealtimeToken } from "@/lib/services/speechmatics-realtime"

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
  pstnTranscriptionMode?: PstnTranscriptionMode
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

interface LiveTranscriptLine {
  id: string
  speakerKey: string
  speakerLabel: string
  text: string
  timestampMs: number
}

function normalizeRealtimeLanguageCode(input: unknown): string | null {
  if (typeof input !== "string") return null
  const normalized = input.trim().toLowerCase()
  if (!normalized || normalized === "auto" || normalized === "session") return null
  const base = normalized.split("-")[0]
  return /^[a-z]{2}$/.test(base) ? base : null
}

type VideoBackgroundChoice = "none" | "blur" | "home" | "office" | "conference"

const VIDEO_BACKGROUND_CHOICES: Array<{ value: VideoBackgroundChoice; labelKey: string }> = [
  { value: "none",       labelKey: "backgroundNone" },
  { value: "blur",       labelKey: "backgroundBlur" },
  { value: "home",       labelKey: "backgroundHome" },
  { value: "office",     labelKey: "backgroundOffice" },
  { value: "conference", labelKey: "backgroundConference" },
]
const VIDEO_BACKGROUND_STORAGE_KEY = "notissima.video_background"
const AUDIO_INPUT_KEY = "notissima.call.audioInputDeviceId"
const VIDEO_INPUT_KEY = "notissima.call.videoInputDeviceId"

function getBackgroundImagePath(choice: VideoBackgroundChoice): string | null {
  if (choice === "home") return "/backgrounds/home.jpg"
  if (choice === "office") return "/backgrounds/office.jpg"
  if (choice === "conference") return "/backgrounds/conference.jpg"
  return null
}

/**
 * Plays the German Freizeichen (425 Hz, 1 s on / 4 s off) as outbound ringtone.
 * Uses the Web Audio API — no audio files needed.
 *
 * `minPlayMs` guarantees the tone is audible even if the callee joins instantly.
 * Once minPlayMs has elapsed the hook respects `playing` going false.
 */
function useRingtone(playing: boolean, minPlayMs = 2500) {
  const ctxRef = useRef<AudioContext | null>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const startedRef = useRef<number>(0)
  const wantsStopRef = useRef(false)

  const stop = useCallback(() => {
    if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null }
    if (ctxRef.current) { ctxRef.current.close().catch(() => {}); ctxRef.current = null }
    startedRef.current = 0
    wantsStopRef.current = false
  }, [])

  const scheduleRing = useCallback((ctx: AudioContext) => {
    const now = ctx.currentTime
    // German Freizeichen: single 425 Hz tone, 1 s on
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.type = "sine"
    osc.frequency.value = 425
    gain.gain.setValueAtTime(0, now)
    gain.gain.linearRampToValueAtTime(0.06, now + 0.04)
    gain.gain.setValueAtTime(0.06, now + 0.96)
    gain.gain.linearRampToValueAtTime(0, now + 1.0)
    osc.start(now)
    osc.stop(now + 1.0)

    // 4 s pause before next ring (total cycle 5 s)
    timerRef.current = setTimeout(() => {
      if (wantsStopRef.current && Date.now() - startedRef.current >= minPlayMs) {
        stop()
        return
      }
      if (ctxRef.current) scheduleRing(ctxRef.current)
    }, 5000)
  }, [minPlayMs, stop])

  useEffect(() => {
    if (playing) {
      wantsStopRef.current = false
      if (!ctxRef.current) {
        try {
          const ctx = new AudioContext()
          ctxRef.current = ctx
          startedRef.current = Date.now()
          scheduleRing(ctx)
        } catch {
          // AudioContext unavailable (e.g. SSR)
        }
      }
    } else {
      if (startedRef.current && Date.now() - startedRef.current < minPlayMs) {
        wantsStopRef.current = true
      } else {
        stop()
      }
    }
    return () => { stop() }
  }, [playing, scheduleRing, stop, minPlayMs])
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
  pstnTranscriptionMode = "batch",
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
  const microphoneTracks = useTracks(
    [{ source: Track.Source.Microphone, withPlaceholder: false }],
    { onlySubscribed: false }
  )
  const activeScreenShare = screenShareTracks.find(isTrackReference)

  const [duration, setDuration] = useState(0)
  const [layout, setLayout] = useState<LayoutMode>("gallery")
  const [showTranscript, setShowTranscript] = useState(false)
  const [showNotes, setShowNotes] = useState(false)
  const [draftNote, setDraftNote] = useState("")
  const [timedNotes, setTimedNotes] = useState<TimedCallNote[]>([])
  const [addingNote, setAddingNote] = useState(false)
  const [viewMode, setViewMode] = useState<"simple" | "transcript">("simple")
  const [liveTranscriptArmed, setLiveTranscriptArmed] = useState(false)
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
  const [remoteOnHold, setRemoteOnHold] = useState(false)
  const [cameraDeviceIds, setCameraDeviceIds] = useState<string[]>([])
  const [currentCameraDeviceId, setCurrentCameraDeviceId] = useState<string | null>(null)
  const [reconnectDeadline, setReconnectDeadline] = useState<number | null>(null)
  const [reconnectSecondsLeft, setReconnectSecondsLeft] = useState(Math.floor(RECONNECT_GRACE_MS / 1000))
  const [videoBackground, setVideoBackground] = useState<VideoBackgroundChoice>("none")
  const [showModerationPanel, setShowModerationPanel] = useState(false)
  const [liveTranscriptLines, setLiveTranscriptLines] = useState<LiveTranscriptLine[]>([])
  const [liveTranscriptPartials, setLiveTranscriptPartials] = useState<Record<string, string>>({})
  const [liveTranscriptConnections, setLiveTranscriptConnections] = useState<Record<string, boolean>>({})
  const [liveTranscriptError, setLiveTranscriptError] = useState<string | null>(null)
  const [realtimeLanguageCode, setRealtimeLanguageCode] = useState<string>("de")

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
  const speechmaticsServicesRef = useRef<Record<string, SpeechmaticsRealtimeService>>({})
  const speechmaticsTracksRef = useRef<Record<string, MediaStreamTrack | null>>({})
  const liveFinalBufferRef = useRef<Record<string, string>>({})
  const liveFlushTimerRef = useRef<Record<string, ReturnType<typeof setTimeout> | null>>({})
  const liveTranscriptCursorRef = useRef<number>(0)

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
  const isLocalMicEnabled = localParticipant.isMicrophoneEnabled
  const isCameraOn = localParticipant.isCameraEnabled
  const isScreenSharing = localParticipant.isScreenShareEnabled

  useEffect(() => {
    if (mode !== "video") return
    const camPub = localParticipant.getTrackPublication(Track.Source.Camera)
    console.log('[CallRoom] Video state:', {
      connectionState,
      isCameraOn,
      hasTrack: !!camPub?.track,
      trackMuted: camPub?.isMuted,
      remoteCount: remoteParticipants.length,
    })
  }, [mode, connectionState, isCameraOn, localParticipant, remoteParticipants.length])
  const canScreenShare = typeof navigator !== "undefined" && !!navigator.mediaDevices?.getDisplayMedia
  const liveTranscriptEnabled = callType === "pstn_outbound" && pstnTranscriptionMode === "live"
  const liveTranscriptUsesServerRelay =
    liveTranscriptEnabled && process.env.NEXT_PUBLIC_LIVE_TRANSCRIPT_SERVER_RELAY === "1"
  const liveTranscriptConnected = Object.values(liveTranscriptConnections).some(Boolean)
  const remoteParticipantsKey = remoteParticipants
    .map((participant) => `${participant.sid}:${participant.isMicrophoneEnabled ? "1" : "0"}`)
    .sort()
    .join("|")
  const microphoneTracksKey = microphoneTracks
    .filter(isTrackReference)
    .map((trackRef) => {
      const sid = trackRef.participant.sid
      const pubSid = trackRef.publication?.trackSid || "na"
      const hasTrack = trackRef.publication?.track ? "1" : "0"
      return `${sid}:${pubSid}:${hasTrack}`
    })
    .sort()
    .join("|")

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
        const timedNotesPayload = payload.new?.timed_call_notes
        if (Array.isArray(timedNotesPayload)) {
          setTimedNotes(timedNotesPayload as TimedCallNote[])
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
    if (!callId) return
    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch(`/api/calls/${callId}/call-notes`)
        if (!res.ok) return
        const data = await res.json()
        if (cancelled) return
        if (Array.isArray(data?.notes)) {
          setTimedNotes(data.notes as TimedCallNote[])
        }
      } catch {
        // best effort
      }
    })()
    return () => {
      cancelled = true
    }
  }, [callId])

  const handleAddNote = useCallback(async () => {
    if (!callId || !isInitiator || !draftNote.trim() || addingNote) return
    setAddingNote(true)
    try {
      const res = await fetch(`/api/calls/${callId}/call-notes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: draftNote.trim() }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        throw new Error(data?.error || "Failed to add note")
      }
      if (Array.isArray(data?.notes)) {
        setTimedNotes(data.notes as TimedCallNote[])
      } else if (data?.note) {
        setTimedNotes((prev) => [...prev, data.note as TimedCallNote])
      }
      setDraftNote("")
      toast.success(t("noteAdded"))
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("noteAddFailed"))
    } finally {
      setAddingNote(false)
    }
  }, [addingNote, callId, draftNote, isInitiator, t])

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
        const profileLanguage =
          normalizeRealtimeLanguageCode(profile?.default_recording_language)
        if (profileLanguage) {
          setRealtimeLanguageCode(profileLanguage)
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
        ? ({ mode: "background-blur" as const, blurRadius: 22 })
        : ({ mode: "virtual-background" as const, imagePath: `${window.location.origin}${imagePath}` })

      try {
        // Always tear down and recreate the processor to avoid dimension/rotation
        // bugs that occur when switchTo() doesn't re-read track dimensions.
        if (backgroundProcessorRef.current) {
          try { await videoTrack.stopProcessor?.() } catch { /* ignore */ }
          backgroundProcessorRef.current = null
        }
        const processor = BackgroundProcessor(targetMode)
        if (cancelled) return
        await videoTrack.setProcessor(processor)
        backgroundProcessorRef.current = processor
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

  // Ensure remote microphone publications are explicitly subscribed.
  // This avoids edge cases where remote audio exists in-room but the track
  // isn't ready on this client for realtime transcript capture.
  useEffect(() => {
    if (!isConnected) return
    for (const participant of remoteParticipants as any[]) {
      const micPublication = participant?.getTrackPublication?.(Track.Source.Microphone) as any
      if (micPublication?.setSubscribed && !micPublication?.isSubscribed) {
        try {
          micPublication.setSubscribed(true)
        } catch {
          // Best-effort subscription.
        }
      }
    }
  }, [isConnected, remoteParticipantsKey])

  // Outbound ringtone — only the call's initiator hears it. The callee/host
  // accepting an invite has nothing to ring for; they just joined a room.
  // We also bail out as soon as the call has been declined / missed /
  // ended remotely, even if LiveKit hasn't disconnected yet.
  // The minimum play duration (2.5 s) ensures the caller hears at least one
  // ring even when the callee joins almost instantly (< 4 s pickup).
  const shouldRing = Boolean(
    isInitiator &&
    (callType === "pstn_outbound" || callType === "web") &&
    !calleeLeft &&
    !remoteCallEnded &&
    !remoteEverConnected.current &&
    (callStatus === "ringing" || callStatus === "connecting")
  )
  useRingtone(shouldRing)

  // One-shot "you're connected" ping the moment both sides are first present
  // together. Replaces the abrupt silence on the initiator side when the
  // callee picks up, and gives the callee positive feedback that they joined
  // a room with someone in it. PSTN-outbound is excluded — the PSTN remote
  // doesn't have a "joined" event we can hook into the same way, and the
  // initiator already gets clear audio of the callee.
  const entryPingFiredRef = useRef(false)
  useEffect(() => {
    if (entryPingFiredRef.current) return
    if (callType === "pstn_outbound") return
    if (!isConnected || !hasRemote) return
    entryPingFiredRef.current = true
    try {
      const ctx = new AudioContext()
      const now = ctx.currentTime
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.type = "sine"
      osc.frequency.value = 880
      gain.gain.setValueAtTime(0, now)
      gain.gain.linearRampToValueAtTime(0.07, now + 0.02)
      gain.gain.setValueAtTime(0.07, now + 0.12)
      gain.gain.linearRampToValueAtTime(0, now + 0.14)
      osc.start(now)
      osc.stop(now + 0.14)
      // Close the context shortly after the tone finishes to release resources.
      setTimeout(() => { ctx.close().catch(() => {}) }, 250)
    } catch {
      // Best-effort UX cue; ignore audio context failures.
    }
  }, [isConnected, hasRemote, callType])

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
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ hasRemote }),
        keepalive: true,
      }).catch(() => {})
      fetch(`/api/calls/presence/heartbeat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          appState: document.visibilityState === "visible" ? "foreground" : "background",
          route: `/call/${roomName}`,
        }),
        keepalive: true,
      }).catch(() => {})
    }, 15_000)
    return () => clearInterval(interval)
  }, [callId, isConnected, roomName, hasRemote])

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
    let cancelled = false

    const getParticipantAudioTrack = (participant: any): MediaStreamTrack | null => {
      if (!participant) return null
      const direct = (participant.getTrackPublication?.(Track.Source.Microphone)?.track as any)?.mediaStreamTrack as MediaStreamTrack | undefined
      if (direct) return direct

      const collections: any[] = []
      if (participant.audioTrackPublications?.values) collections.push(Array.from(participant.audioTrackPublications.values()))
      if (participant.trackPublications?.values) collections.push(Array.from(participant.trackPublications.values()))
      for (const group of collections) {
        const match = group.find((pub: any) => {
          const source = pub?.source
          const kind = pub?.kind
          const track = pub?.track
          return (source === Track.Source.Microphone || kind === "audio" || kind === 1) && track
        })
        const media = (match?.track as any)?.mediaStreamTrack as MediaStreamTrack | undefined
        if (media) return media
      }
      return null
    }

    const stopSource = async (sourceKey: string) => {
      const pendingBuffer = (liveFinalBufferRef.current[sourceKey] || '').trim()
      if (pendingBuffer) {
        const label = sourceKey === 'local' ? t('you') : (remoteParticipants[0] as any)?.name || contactName || contactPhone || t('participant')
        setLiveTranscriptLines((prev) => [
          ...prev,
          {
            id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            speakerKey: sourceKey,
            speakerLabel: label,
            text: pendingBuffer,
            timestampMs: Date.now(),
          },
        ])
      }
      if (liveFlushTimerRef.current[sourceKey]) {
        clearTimeout(liveFlushTimerRef.current[sourceKey] as ReturnType<typeof setTimeout>)
      }
      delete liveFlushTimerRef.current[sourceKey]
      delete liveFinalBufferRef.current[sourceKey]

      const service = speechmaticsServicesRef.current[sourceKey]
      if (service) {
        try {
          await service.stop()
        } catch {
          // Best effort
        }
      }
      const clonedTrack = speechmaticsTracksRef.current[sourceKey]
      try {
        clonedTrack?.stop()
      } catch {
        // Best effort
      }
      delete speechmaticsServicesRef.current[sourceKey]
      delete speechmaticsTracksRef.current[sourceKey]
      if (!cancelled) {
        setLiveTranscriptConnections((prev) => {
          if (!(sourceKey in prev)) return prev
          const next = { ...prev }
          delete next[sourceKey]
          return next
        })
        setLiveTranscriptPartials((prev) => {
          if (!(sourceKey in prev)) return prev
          const next = { ...prev }
          delete next[sourceKey]
          return next
        })
      }
    }

    const startSource = async (sourceKey: string, speakerLabel: string, mediaTrack: MediaStreamTrack) => {
      if (speechmaticsServicesRef.current[sourceKey]) return
      const flushBufferedLine = () => {
        const buffered = (liveFinalBufferRef.current[sourceKey] || '').trim()
        if (!buffered) return
        liveFinalBufferRef.current[sourceKey] = ''
        setLiveTranscriptLines((prev) => [
          ...prev,
          {
            id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            speakerKey: sourceKey,
            speakerLabel,
            text: buffered,
            timestampMs: Date.now(),
          },
        ])
      }

      const queueFlush = () => {
        if (liveFlushTimerRef.current[sourceKey]) {
          clearTimeout(liveFlushTimerRef.current[sourceKey] as ReturnType<typeof setTimeout>)
        }
        liveFlushTimerRef.current[sourceKey] = setTimeout(() => {
          flushBufferedLine()
          liveFlushTimerRef.current[sourceKey] = null
        }, 1200)
      }

      try {
        setLiveTranscriptError(null)
        const token = await getSpeechmaticsRealtimeToken()
        if (cancelled) return
        const clonedTrack = mediaTrack.clone()
        const stream = new MediaStream([clonedTrack])
        console.log(`[LiveTranscript] Starting source=${sourceKey} language=${realtimeLanguageCode} speaker=${speakerLabel}`)
        const service = new SpeechmaticsRealtimeService(token, {
          language: realtimeLanguageCode,
          enablePartials: true,
          maxDelaySec: 5,
          enableEntities: false,
          onTranscript: (result) => {
            if (cancelled) return
            if (result.isFinal) {
              const text = result.transcript.trim()
              if (!text) return
              const existing = (liveFinalBufferRef.current[sourceKey] || '').trim()
              liveFinalBufferRef.current[sourceKey] = existing
                ? `${existing}${/^[,.;:!?]/.test(text) ? '' : ' '}${text}`
                : text
              const buffered = liveFinalBufferRef.current[sourceKey]
              setLiveTranscriptPartials((prev) => ({ ...prev, [sourceKey]: "" }))
              const endsSentence = /[.!?…]$/.test(buffered)
              const wordCount = buffered.split(/\s+/).filter(Boolean).length
              if (endsSentence || wordCount >= 14) {
                flushBufferedLine()
                if (liveFlushTimerRef.current[sourceKey]) {
                  clearTimeout(liveFlushTimerRef.current[sourceKey] as ReturnType<typeof setTimeout>)
                  liveFlushTimerRef.current[sourceKey] = null
                }
              } else {
                queueFlush()
              }
            } else {
              setLiveTranscriptPartials((prev) => ({ ...prev, [sourceKey]: result.transcript || "" }))
            }
          },
          onError: (error) => {
            if (cancelled) return
            setLiveTranscriptError(`${speakerLabel}: ${error.message || "Realtime transcription failed"}`)
          },
          onConnectionChange: (connected) => {
            if (cancelled) return
            setLiveTranscriptConnections((prev) => ({ ...prev, [sourceKey]: connected }))
          },
        })
        speechmaticsServicesRef.current[sourceKey] = service
        speechmaticsTracksRef.current[sourceKey] = clonedTrack
        await service.start(stream)
      } catch (error: any) {
        if (cancelled) return
        setLiveTranscriptError(`${speakerLabel}: ${error?.message || "Realtime transcription failed"}`)
        await stopSource(sourceKey)
      }
    }

    const reconcileSources = async () => {
      if (liveTranscriptUsesServerRelay || !liveTranscriptEnabled || !isConnected || !liveTranscriptArmed) {
        await Promise.all(Object.keys(speechmaticsServicesRef.current).map((key) => stopSource(key)))
        return
      }

      const localMicTrackRef = microphoneTracks.find(
        (trackRef) => isTrackReference(trackRef) && trackRef.participant.sid === localParticipant.sid
      )
      const localTrackFromHook =
        localMicTrackRef && isTrackReference(localMicTrackRef)
          ? ((localMicTrackRef.publication?.track as any)?.mediaStreamTrack as MediaStreamTrack | undefined)
          : undefined
      const localTrack = isLocalMicEnabled ? (localTrackFromHook || getParticipantAudioTrack(localParticipant)) : null
      const remoteParticipant = remoteParticipants[0] as any | undefined
      const remoteLabel = remoteParticipant?.name || contactName || contactPhone || t("participant")
      const remoteMicTrackRef = remoteParticipant
        ? microphoneTracks.find(
            (trackRef) => isTrackReference(trackRef) && trackRef.participant.sid === remoteParticipant.sid
          )
        : null
      const remoteTrackFromHook =
        remoteMicTrackRef && isTrackReference(remoteMicTrackRef)
          ? ((remoteMicTrackRef.publication?.track as any)?.mediaStreamTrack as MediaStreamTrack | undefined)
          : undefined
      const remoteTrack = remoteParticipant ? (remoteTrackFromHook || getParticipantAudioTrack(remoteParticipant)) : null

      const desired = [
        { key: "local", label: t("you"), track: localTrack },
        { key: remoteParticipant?.sid ? `remote-${remoteParticipant.sid}` : "remote", label: remoteLabel, track: remoteTrack },
      ].filter((entry) => Boolean(entry.track)) as Array<{ key: string; label: string; track: MediaStreamTrack }>

      const desiredKeys = new Set(desired.map((entry) => entry.key))
      const activeKeys = Object.keys(speechmaticsServicesRef.current)

      await Promise.all(activeKeys.filter((key) => !desiredKeys.has(key)).map((key) => stopSource(key)))
      for (const source of desired) {
        await startSource(source.key, source.label, source.track)
      }
    }

    void reconcileSources()

    return () => {
      cancelled = true
      void Promise.all(Object.keys(speechmaticsServicesRef.current).map((key) => stopSource(key)))
    }
  }, [liveTranscriptEnabled, liveTranscriptUsesServerRelay, isConnected, isLocalMicEnabled, localParticipant, remoteParticipantsKey, contactName, contactPhone, t, microphoneTracksKey, realtimeLanguageCode, liveTranscriptArmed])

  useEffect(() => {
    if (!liveTranscriptUsesServerRelay) return
    liveTranscriptCursorRef.current = 0
    setLiveTranscriptLines([])
    setLiveTranscriptPartials({})
    setLiveTranscriptConnections({})
    setLiveTranscriptError(null)
  }, [liveTranscriptUsesServerRelay, callId])

  useEffect(() => {
    if (!liveTranscriptUsesServerRelay || !liveTranscriptArmed || !isConnected || !callId) return
    let cancelled = false
    let timer: ReturnType<typeof setTimeout> | null = null

    const poll = async () => {
      try {
        const after = liveTranscriptCursorRef.current
        const res = await fetch(`/api/calls/${callId}/live-transcript?after=${after}`, { cache: "no-store" })
        if (!res.ok) throw new Error(`Live transcript poll failed (${res.status})`)
        const data = await res.json()
        if (cancelled) return
        const incoming = Array.isArray(data?.lines) ? data.lines : []
        if (incoming.length > 0) {
          setLiveTranscriptLines((prev) => {
            const seen = new Set(prev.map((line) => line.id))
            const merged = [...prev]
            for (const line of incoming) {
              if (!line?.id || seen.has(line.id)) continue
              merged.push({
                id: String(line.id),
                speakerKey: String(line.speakerKey || line.sourceKey || "remote"),
                speakerLabel: String(line.speakerLabel || t("participant")),
                text: String(line.text || ""),
                timestampMs: Number(line.timestampMs || Date.now()),
              })
            }
            return merged.slice(-240)
          })
        }
        if (typeof data?.latestTimestampMs === "number" && data.latestTimestampMs > liveTranscriptCursorRef.current) {
          liveTranscriptCursorRef.current = data.latestTimestampMs
        }
        setLiveTranscriptConnections({ server: true })
        setLiveTranscriptError(null)
      } catch (err: any) {
        if (cancelled) return
        setLiveTranscriptConnections({ server: false })
        setLiveTranscriptError(err?.message || "Live transcript relay unavailable")
      } finally {
        if (!cancelled) timer = setTimeout(poll, 1200)
      }
    }

    void poll()
    return () => {
      cancelled = true
      if (timer) clearTimeout(timer)
      setLiveTranscriptConnections({ server: false })
    }
  }, [liveTranscriptUsesServerRelay, liveTranscriptArmed, isConnected, callId, t])

  useEffect(() => {
    if (!liveTranscriptEnabled) {
      setLiveTranscriptArmed(false)
    }
  }, [liveTranscriptEnabled])

  useEffect(() => {
    if (!liveTranscriptEnabled) return
    const transcriptViewOpen = viewMode === "transcript" || showTranscript
    if (transcriptViewOpen && !liveTranscriptArmed) {
      setLiveTranscriptArmed(true)
    }
  }, [liveTranscriptEnabled, viewMode, showTranscript, liveTranscriptArmed])

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
    setSavingNotes(false)
    endCall()
  }, [endCall])

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
      localParticipant.setMetadata(JSON.stringify({ onHold: true })).catch(() => {})
      toast.info(t("callOnHold"))
      return
    }
    await localParticipant.setMicrophoneEnabled(micBeforeHoldRef.current)
    setRemoteVolume(isSpeaker ? 1 : 0)
    setIsOnHold(false)
    localParticipant.setMetadata(JSON.stringify({ onHold: false })).catch(() => {})
    toast.info(t("callResumed"))
  }, [isOnHold, localParticipant, setRemoteVolume, isSpeaker])

  useEffect(() => {
    setRemoteVolume(isSpeaker && !isOnHold ? 1 : 0)
  }, [remoteParticipants.length, isSpeaker, isOnHold, setRemoteVolume])

  // Sync remote hold state from LiveKit participant metadata.
  useEffect(() => {
    const parseHold = (metadata?: string | null) => {
      try { return !!JSON.parse(metadata || '{}')?.onHold } catch { return false }
    }
    // Seed from current metadata
    const rp = remoteParticipants[0]
    setRemoteOnHold(rp ? parseHold(rp.metadata) : false)

    const handler = () => {
      const rp = remoteParticipants[0]
      setRemoteOnHold(rp ? parseHold(rp.metadata) : false)
    }
    room.on(RoomEvent.ParticipantMetadataChanged, handler)
    return () => { room.off(RoomEvent.ParticipantMetadataChanged, handler) }
  }, [room, remoteParticipants])

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
                onClick={() => {
                  setViewMode("transcript")
                  if (liveTranscriptEnabled) setLiveTranscriptArmed(true)
                }}
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
              {callStatus === "connected" && remoteOnHold && (
                <div className="absolute inset-x-0 top-0 z-10 flex items-center justify-center gap-2 bg-amber-500/10 border-b border-amber-500/20 px-4 py-2">
                  <PauseCircle className="h-4 w-4 text-amber-600 shrink-0" />
                  <span className="text-sm text-amber-700 font-medium">{t("remoteOnHoldBanner")}</span>
                </div>
              )}
              <div className={cn("rounded-full p-1", callStatus === "connected" && !remoteOnHold && "ring-4 ring-primary/20", callStatus === "connected" && remoteOnHold && "ring-4 ring-amber-400/30")}>
                <Avatar className="h-28 w-28">
                  <AvatarFallback className={cn("text-foreground text-4xl", remoteOnHold ? "bg-amber-100/60" : "bg-secondary")}>
                    {hasRemote ? remoteInitials : contactInitials}
                  </AvatarFallback>
                </Avatar>
              </div>
              <div className="text-center mt-4">
                <h2 className="text-xl font-semibold text-foreground">{remoteDisplayName}</h2>
                {contactPhone && <p className="text-sm text-muted-foreground mt-1">{contactPhone}</p>}
                {callStatus === "connected" && remoteOnHold && (
                  <div className="inline-flex items-center gap-1 mt-2 px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-600 text-xs font-medium">
                    <PauseCircle className="h-3 w-3" />
                    {t("remoteOnHold")}
                  </div>
                )}
                {callStatus === "connected" && !remoteOnHold && remoteParticipants[0] && !remoteParticipants[0].isMicrophoneEnabled && (
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
              {liveTranscriptEnabled ? (
                <div className="space-y-2">
                  {!liveTranscriptArmed && (
                    <div className="rounded-lg border border-border bg-card p-3">
                      <p className="text-xs text-muted-foreground mb-2">{t("liveTranscriptNeedsStart")}</p>
                      <button
                        type="button"
                        onClick={() => setLiveTranscriptArmed(true)}
                        className="inline-flex items-center rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90"
                      >
                        {t("startLiveTranscript")}
                      </button>
                    </div>
                  )}
                  <div className="flex items-center gap-2">
                    <span className={cn(
                      "h-2 w-2 rounded-full",
                      liveTranscriptConnected ? "bg-primary animate-pulse" : "bg-muted-foreground"
                    )} />
                    <p className="text-xs text-muted-foreground">
                      {liveTranscriptConnected ? t("liveTranscriptConnected") : t("liveTranscriptConnecting")}
                    </p>
                  </div>
                  {liveTranscriptError && (
                    <p className="text-xs text-destructive">{liveTranscriptError}</p>
                  )}
                  {liveTranscriptArmed && liveTranscriptLines.length === 0 && Object.values(liveTranscriptPartials).every((text) => !text) ? (
                    <p className="text-sm text-muted-foreground py-8 text-center">{t("liveTranscriptEmpty")}</p>
                  ) : (
                    <div className="space-y-2">
                      {liveTranscriptLines.slice(-120).map((line) => (
                        <div key={line.id} className="rounded-lg bg-secondary px-3 py-2">
                          <p className="text-[11px] text-muted-foreground mb-0.5">
                            {line.speakerLabel} · {new Date(line.timestampMs).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                          </p>
                          <p className="text-sm text-foreground">{line.text}</p>
                        </div>
                      ))}
                      {liveTranscriptArmed && Object.entries(liveTranscriptPartials)
                        .filter(([, text]) => Boolean(text))
                        .map(([sourceKey, text]) => {
                          const label = sourceKey === "local" ? t("you") : remoteDisplayName
                          return (
                            <div key={`partial-${sourceKey}`} className="rounded-lg border border-dashed border-border px-3 py-2">
                              <p className="text-[11px] text-muted-foreground mb-0.5">{label}</p>
                              <p className="text-sm text-muted-foreground italic">{text}</p>
                            </div>
                          )
                        })}
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex items-center justify-center py-12">
                  <p className="text-sm text-muted-foreground">{t("transcriptAfterCall")}</p>
                </div>
              )}
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
            <CallNotesPanel
              open={showNotes}
              onClose={() => setShowNotes(false)}
              draftNote={draftNote}
              onDraftChange={setDraftNote}
              notes={timedNotes}
              onAddNote={handleAddNote}
              adding={addingNote}
              canAdd={isInitiator}
            />

            {/* Controls */}
            {callStatus !== "ended" ? (
              <CallControls
                mode={mode}
                isMuted={isMuted}
                isCameraOn={isCameraOn}
                isSpeaker={isSpeaker}
                isOnHold={isOnHold}
                isInitiator={isInitiator}
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
                onToggleTranscript={() => {
                  const next = !showTranscript
                  setShowTranscript(next)
                  if (next && liveTranscriptEnabled) setLiveTranscriptArmed(true)
                }}
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
    <div className="flex flex-col h-[100dvh] bg-[#111]">
      <div className="flex flex-col w-full h-full">
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
          /* Screen share layout: shared screen fills viewport, camera tiles as PiP on desktop */
          <div className="h-full p-2 relative">
            <div className="absolute inset-2 rounded-xl overflow-hidden bg-[#1a1a1a]">
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
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 md:left-auto md:translate-x-0 md:right-4 flex gap-2 h-24 md:h-auto md:flex-col z-10">
              {remoteParticipants.map((rp) => {
                const remoteCamera = cameraTracks.find(t => t.participant.sid === rp.sid)
                return (
                  <div key={rp.sid} className="w-32 md:w-40 h-full md:h-28 rounded-xl overflow-hidden border border-white/20 shadow-2xl">
                    <LiveParticipantTile
                      name={rp.name || rp.identity}
                      isMuted={!rp.isMicrophoneEnabled}
                      hasVideo={rp.isCameraEnabled}
                      videoTrack={remoteCamera}
                    />
                  </div>
                )
              })}
              <div className="w-32 md:w-40 h-full md:h-28 rounded-xl overflow-hidden border border-white/20 shadow-2xl">
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
          /* Gallery layout: stacked on mobile, side-by-side filling viewport on desktop */
          <div className="h-full p-2 flex flex-col gap-2 md:flex-row md:overflow-hidden">
            <div className="flex-1 min-h-0 md:min-w-0">
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
            <div className="flex-1 min-h-0 md:min-w-0">
              <LiveParticipantTile
                name={t("you")}
                isMuted={isMuted}
                hasVideo={isCameraOn}
                videoTrack={cameraTracks.find(tr => tr.participant.sid === localParticipant.sid)}
                isLocal
              />
            </div>
          </div>
        )}

      </div>

        {/* Notes panel */}
        <CallNotesPanel
          open={showNotes}
          onClose={() => setShowNotes(false)}
          draftNote={draftNote}
          onDraftChange={setDraftNote}
          notes={timedNotes}
          onAddNote={handleAddNote}
          adding={addingNote}
          canAdd={isInitiator}
          dark
        />

      {/* Controls */}
      <CallControls
        mode="video"
        variant="room"
        isMuted={isMuted}
        isCameraOn={isCameraOn}
        isSpeaker={isSpeaker}
        isOnHold={isOnHold}
        isInitiator={isInitiator}
        isScreenSharing={isScreenSharing}
        canScreenShare={canScreenShare}
        showNotes={showNotes}
        showTranscript={false}
        onToggleMute={toggleMute}
        onToggleCamera={toggleCamera}
        onToggleSpeaker={toggleSpeaker}
        onToggleHold={toggleHold}
        onToggleScreenShare={toggleScreenShare}
        onToggleNotes={() => setShowNotes(!showNotes)}
        onToggleTranscript={() => {}}
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
