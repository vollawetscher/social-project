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
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { cn } from "@/lib/utils"
import { toast } from "sonner"
import { CallControls } from "@/components/call/CallControls"
import type { CallMode, LayoutMode } from "@/lib/types/call"

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

function formatDuration(seconds: number): string {
  const hrs = Math.floor(seconds / 3600)
  const mins = Math.floor((seconds % 3600) / 60)
  const secs = seconds % 60
  if (hrs > 0) {
    return `${hrs}:${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`
  }
  return `${mins}:${secs.toString().padStart(2, "0")}`
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
  return (
    <LiveKitRoom
      token={props.token}
      serverUrl={props.serverUrl}
      connect={true}
      audio={true}
      video={props.mode === "video"}
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
  const [remoteConsents, setRemoteConsents] = useState<{ name: string; granted: boolean }[]>([])
  const [cameraDeviceIds, setCameraDeviceIds] = useState<string[]>([])
  const [currentCameraDeviceId, setCurrentCameraDeviceId] = useState<string | null>(null)
  const [reconnectDeadline, setReconnectDeadline] = useState<number | null>(null)
  const [reconnectSecondsLeft, setReconnectSecondsLeft] = useState(Math.floor(RECONNECT_GRACE_MS / 1000))

  const timerRef = useRef<NodeJS.Timeout | null>(null)
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const reconnectTickRef = useRef<NodeJS.Timeout | null>(null)
  const endingCallRef = useRef(false)
  const wakeLockRef = useRef<any>(null)

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

  // Poll consent status for remote participants (initiator only)
  useEffect(() => {
    if (!isInitiator || !callId || !hasRemote) return
    let cancelled = false
    const poll = async () => {
      try {
        const r = await fetch(`/api/calls/${callId}/consent`)
        if (r.ok && !cancelled) {
          const data = await r.json()
          const others = (data.consents || [])
            .filter((c: any) => c.participant_identity !== localParticipant.identity)
            .map((c: any) => ({ name: c.participant_name, granted: c.granted }))
          setRemoteConsents(others)
        }
      } catch { /* ignore */ }
    }
    poll()
    const interval = setInterval(poll, 5000)
    return () => { cancelled = true; clearInterval(interval) }
  }, [isInitiator, callId, hasRemote, localParticipant.identity])

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

  const isMuted = !localParticipant.isMicrophoneEnabled
  const isCameraOn = localParticipant.isCameraEnabled
  const isScreenSharing = localParticipant.isScreenShareEnabled
  const canScreenShare = typeof navigator !== "undefined" && !!navigator.mediaDevices?.getDisplayMedia

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
        toast.info("No alternative camera found")
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
        toast.error("Failed to switch camera")
        return
      }
      setCurrentCameraDeviceId(nextDeviceId)
    } catch {
      toast.error("Failed to switch camera")
    }
  }, [mode, isCameraOn, localParticipant, currentCameraDeviceId, room])

  const toggleScreenShare = useCallback(() => {
    localParticipant.setScreenShareEnabled(!isScreenSharing)
  }, [localParticipant, isScreenSharing])

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
        toast.error("Could not copy link — long-press the URL bar to copy manually")
      }
    }
  }, [callId, displayName, mode])

  const ringSmsLabel = ringSmsStatus === "sending"
    ? "Sending SMS & calling phone..."
    : ringSmsStatus === "sms_sent"
      ? "SMS sent! Phone ringing..."
      : ringSmsStatus === "done"
        ? "Invitation sent! Waiting to join..."
        : ringSmsStatus === "failed"
          ? "Invitation failed — share link manually"
          : null

  const statusLabel = {
    connecting: "Connecting...",
    ringing: ringSmsLabel || "Waiting for others...",
    connected: formatDuration(duration),
    ended: "Call Ended",
  }

  const isVideo = mode === "video"
  const canSwitchCamera = isVideo && cameraDeviceIds.length > 1
  const hasConsentEntry = remoteConsents.length > 0
  const allRemoteGranted = hasConsentEntry && remoteConsents.every((c) => c.granted)
  const remoteDeclined = hasConsentEntry && remoteConsents.some((c) => !c.granted)
  const consentBadgeText = !hasRemote
    ? "Awaiting participant"
    : allRemoteGranted
      ? "Consent granted"
      : remoteDeclined
        ? "Caller only"
        : "Consent pending"
  const consentBadgeTone = allRemoteGranted
    ? "bg-success/20 text-success"
    : remoteDeclined
      ? "bg-warning/20 text-warning"
      : "bg-info/20 text-info"

  const contactInitials = contactName
    ? contactName.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2)
    : contactPhone?.slice(-2) || "?"

  const remoteDisplayName = remoteParticipants[0]?.name || contactName || contactPhone || "Participant"
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
            <span>Back</span>
          </button>
          <div className="flex items-center gap-2">
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
                Call
              </button>
              <button
                onClick={() => setViewMode("transcript")}
                className={cn(
                  "flex items-center gap-1 px-3 py-1 rounded-md text-xs font-medium transition-colors",
                  viewMode === "transcript" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"
                )}
              >
                <MessageSquareText className="h-3 w-3" />
                Transcript
              </button>
            </div>
          </div>
        )}

        {/* Main Area */}
        <div className="flex-1 flex flex-col overflow-hidden relative">
          {isDisconnected && reconnectDeadline && !endingCallRef.current && (
            <div className="absolute top-2 left-1/2 -translate-x-1/2 z-20 rounded-md border border-warning/40 bg-warning/15 px-3 py-1.5 text-xs text-warning-foreground">
              Reconnecting... {reconnectSecondsLeft}s
              <button
                onClick={retryConnection}
                className="ml-2 underline underline-offset-2 hover:no-underline"
              >
                Retry now
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
              </div>
              <p className={cn(
                "text-lg font-mono mt-3",
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
                    {linkCopied ? "Link copied!" : "Copy invite link"}
                  </span>
                </button>
              )}
              {callStatus === "connected" && (
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 mt-4">
                  <span className="h-2 w-2 rounded-full bg-primary animate-pulse" />
                  <span className="text-xs text-primary font-medium">Recording & Transcribing</span>
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
                <p className="text-sm text-muted-foreground">Transcript will be available after the call ends...</p>
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
              <p className="text-base font-semibold text-foreground">Still recording — speak your notes</p>
              <p className="text-sm text-muted-foreground">
                Say <span className="font-medium text-foreground">"Notissima:"</span> followed by a command
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
                ? <><Loader2 className="h-4 w-4 animate-spin" /> Ending…</>
                : <>Stop Recording & End</>
              }
            </button>
          </div>
        ) : (
          <>
            {/* Notes Panel (in-call) */}
            {showNotes && (
              <div className="border-t px-4 py-3 shrink-0 border-border bg-card">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-medium text-muted-foreground">Notes</span>
                  <button onClick={() => setShowNotes(false)}>
                    <X className="h-4 w-4 text-muted-foreground" />
                  </button>
                </div>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Add call notes..."
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
                isSpeaker={false}
                isOnHold={false}
                isScreenSharing={isScreenSharing}
                canScreenShare={canScreenShare}
                showNotes={showNotes}
                showTranscript={showTranscript}
                onToggleMute={toggleMute}
                onToggleCamera={toggleCamera}
                onToggleSpeaker={() => {}}
                onToggleHold={() => {}}
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
                  Call ended {duration > 0 && `· ${formatDuration(duration)}`}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Transcript will be available in Sessions
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
        <div className="flex items-center gap-2 shrink-0">
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
            className="h-7 w-7 rounded-md bg-white/10 flex items-center justify-center hover:bg-white/15 transition-colors"
          >
            {layout === "gallery" ? (
              <Maximize2 className="h-3.5 w-3.5 text-white/70" />
            ) : (
              <LayoutGrid className="h-3.5 w-3.5 text-white/70" />
            )}
          </button>
        </div>
      </div>

      {/* Video Area */}
      <div className="flex-1 overflow-hidden relative">
        {isDisconnected && reconnectDeadline && !endingCallRef.current && (
          <div className="absolute top-2 left-1/2 -translate-x-1/2 z-20 rounded-md border border-warning/40 bg-warning/15 px-3 py-1.5 text-xs text-warning-foreground">
            Reconnecting... {reconnectSecondsLeft}s
            <button
              onClick={retryConnection}
              className="ml-2 underline underline-offset-2 hover:no-underline"
            >
              Retry now
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
                      ? "You are sharing your screen"
                      : `${activeScreenShare.participant.name || activeScreenShare.participant.identity} is sharing`}
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
                  name="You"
                  isMuted={isMuted}
                  hasVideo={isCameraOn}
                  videoTrack={cameraTracks.find(t => t.participant.sid === localParticipant.sid)}
                  isLocal
                />
              </div>
            </div>
          </div>
        ) : (
          /* Normal layout: side by side / stacked */
          <div className="h-full p-2 flex flex-col gap-2 md:flex-row md:items-center md:justify-center md:overflow-hidden">
            {/* Remote participant (or waiting placeholder) */}
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
                  <p className="text-sm text-white/50 mb-4">Waiting for others...</p>
                  <button
                    onClick={copyInviteLink}
                    className="flex items-center gap-2 px-4 py-2 rounded-full bg-primary hover:bg-primary/90 transition-colors"
                  >
                    {linkCopied ? <Check className="h-4 w-4 text-primary-foreground" /> : <Link2 className="h-4 w-4 text-primary-foreground" />}
                    <span className="text-sm font-medium text-primary-foreground">{linkCopied ? "Copied!" : "Copy invite link"}</span>
                  </button>
                </div>
              )}
              </div>
            </div>

            {/* Local participant */}
            <div className="flex-1 min-h-0 flex items-center justify-center md:flex-1 md:h-full md:max-w-[50%] md:overflow-hidden">
              <div className="w-full h-full md:h-full md:max-w-full md:aspect-[3/4] md:mx-auto">
              <LiveParticipantTile
                name="You"
                isMuted={isMuted}
                hasVideo={isCameraOn}
                videoTrack={cameraTracks.find(t => t.participant.sid === localParticipant.sid)}
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
              <span className="text-xs font-medium text-white/60">Transcript</span>
              <button onClick={() => setShowTranscript(false)}>
                <X className="h-4 w-4 text-white/40" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-4 pb-2">
              <p className="text-sm text-white/80 text-center py-8">
                Transcript will be available after the call ends...
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
        isSpeaker={false}
        isOnHold={false}
        isScreenSharing={isScreenSharing}
        canScreenShare={canScreenShare}
        showNotes={showNotes}
        showTranscript={showTranscript}
        onToggleMute={toggleMute}
        onToggleCamera={toggleCamera}
        onToggleSpeaker={() => {}}
        onToggleHold={() => {}}
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
  const displayName = isLocal ? "You" : name.split(" ")[0]

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
