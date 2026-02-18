"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { useRouter } from "next/navigation"
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
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { cn } from "@/lib/utils"
import { CallControls } from "@/components/call/CallControls"
import type { CallMode, LayoutMode } from "@/lib/types/call"

interface CallRoomProps {
  roomName: string
  callId: string
  token: string
  serverUrl: string
  mode: CallMode
  callType: "web" | "pstn_outbound"
  contactName?: string
  contactPhone?: string
  onLeave?: () => void
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

export function CallRoom(props: CallRoomProps) {
  return (
    <LiveKitRoom
      token={props.token}
      serverUrl={props.serverUrl}
      connect={true}
      audio={true}
      video={props.mode === "video"}
      onDisconnected={() => {
        if (props.onLeave) props.onLeave()
      }}
    >
      <RoomAudioRenderer />
      <CallRoomInner {...props} />
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
  onLeave,
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

  const [duration, setDuration] = useState(0)
  const [layout, setLayout] = useState<LayoutMode>("gallery")
  const [showTranscript, setShowTranscript] = useState(false)
  const [showNotes, setShowNotes] = useState(false)
  const [notes, setNotes] = useState("")
  const [viewMode, setViewMode] = useState<"simple" | "transcript">("simple")

  const timerRef = useRef<NodeJS.Timeout | null>(null)

  const isConnected = connectionState === ConnectionState.Connected
  const isConnecting = connectionState === ConnectionState.Connecting
  const isDisconnected = connectionState === ConnectionState.Disconnected
  const hasRemote = remoteParticipants.length > 0

  const callStatus = isDisconnected
    ? "ended"
    : isConnected && hasRemote
      ? "connected"
      : isConnected
        ? "ringing"
        : "connecting"

  const isMuted = !localParticipant.isMicrophoneEnabled
  const isCameraOn = localParticipant.isCameraEnabled
  const isScreenSharing = localParticipant.isScreenShareEnabled

  useEffect(() => {
    if (callStatus === "connected") {
      timerRef.current = setInterval(() => setDuration((d) => d + 1), 1000)
    } else if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [callStatus])

  const endCall = useCallback(() => {
    room.disconnect()
    setTimeout(() => {
      if (onLeave) onLeave()
      else router.push("/calls")
    }, 500)
  }, [room, router, onLeave])

  const toggleMute = useCallback(() => {
    localParticipant.setMicrophoneEnabled(isMuted)
  }, [localParticipant, isMuted])

  const toggleCamera = useCallback(() => {
    localParticipant.setCameraEnabled(!isCameraOn)
  }, [localParticipant, isCameraOn])

  const toggleScreenShare = useCallback(() => {
    localParticipant.setScreenShareEnabled(!isScreenSharing)
  }, [localParticipant, isScreenSharing])

  const [linkCopied, setLinkCopied] = useState(false)

  const copyInviteLink = useCallback(() => {
    const url = new URL(window.location.href)
    url.searchParams.delete("token")
    navigator.clipboard.writeText(url.toString())
    setLinkCopied(true)
    setTimeout(() => setLinkCopied(false), 2000)
  }, [])

  const statusLabel = {
    connecting: "Connecting...",
    ringing: "Waiting for others...",
    connected: formatDuration(duration),
    ended: "Call Ended",
  }

  const isVideo = mode === "video"

  const contactInitials = contactName
    ? contactName.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2)
    : contactPhone?.slice(-2) || "?"

  const remoteDisplayName = remoteParticipants[0]?.name || contactName || contactPhone || "Participant"
  const remoteInitials = remoteDisplayName.split(" ").map((n: string) => n[0]).join("").toUpperCase().slice(0, 2)

  // --- Audio-only or pre-connection view ---
  if (!isVideo || callStatus !== "connected") {
    return (
      <div className="flex flex-col h-screen bg-background">
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

        {/* Notes Panel */}
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
            showNotes={showNotes}
            showTranscript={showTranscript}
            onToggleMute={toggleMute}
            onToggleCamera={toggleCamera}
            onToggleSpeaker={() => {}}
            onToggleHold={() => {}}
            onToggleScreenShare={toggleScreenShare}
            onToggleNotes={() => setShowNotes(!showNotes)}
            onToggleTranscript={() => setShowTranscript(!showTranscript)}
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
      </div>
    )
  }

  // --- Video room view ---
  const participantCount = 1 + remoteParticipants.length

  return (
    <div className="flex flex-col h-screen bg-[#111]">
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
        <div className="h-full p-2">
          <div className={cn(
            "grid h-full gap-2",
            participantCount <= 2 ? "grid-cols-1" : "grid-cols-2",
          )}>
            {/* Local participant tile */}
            <LiveParticipantTile
              name="You"
              isMuted={isMuted}
              hasVideo={isCameraOn}
              videoTrack={cameraTracks.find(t => t.participant.sid === localParticipant.sid)}
              isLocal
            />

            {/* Remote participant tiles */}
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

            {/* Placeholder while waiting for remote */}
            {remoteParticipants.length === 0 && (
              <div className="rounded-xl bg-[#1a1a1a] flex flex-col items-center justify-center">
                <Avatar className="h-14 w-14 mb-3">
                  <AvatarFallback className="bg-white/10 text-white text-lg">
                    {contactInitials}
                  </AvatarFallback>
                </Avatar>
                <p className="text-sm text-white/40 mb-3">Waiting for others...</p>
                <button
                  onClick={copyInviteLink}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/10 hover:bg-white/15 transition-colors"
                >
                  {linkCopied ? <Check className="h-3.5 w-3.5 text-white/70" /> : <Link2 className="h-3.5 w-3.5 text-white/70" />}
                  <span className="text-xs text-white/70">{linkCopied ? "Copied!" : "Copy invite link"}</span>
                </button>
              </div>
            )}
          </div>
        </div>

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
              <p className="text-sm text-white/40 text-center py-8">
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
        showNotes={showNotes}
        showTranscript={showTranscript}
        onToggleMute={toggleMute}
        onToggleCamera={toggleCamera}
        onToggleSpeaker={() => {}}
        onToggleHold={() => {}}
        onToggleScreenShare={toggleScreenShare}
        onToggleNotes={() => setShowNotes(!showNotes)}
        onToggleTranscript={() => setShowTranscript(!showTranscript)}
        onEndCall={endCall}
        dark
      />
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
