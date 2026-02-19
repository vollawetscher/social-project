"use client"

import { useState, useEffect, useRef, useCallback, Suspense } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import {
  Mic,
  MicOff,
  Video,
  VideoOff,
  MonitorUp,
  MessageSquareText,
  LogOut,
  Users,
  LayoutGrid,
  Maximize2,
  X,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { cn } from "@/lib/utils"
import { mockVideoParticipants, mockLiveTranscript, formatCallDuration } from "@/lib/mock/mobile-data"
import type { LayoutMode, VideoParticipant } from "@/lib/mobile-types"

function VideoRoomContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const roomName = searchParams.get("room") || "Notissima Room"

  const [layout, setLayout] = useState<LayoutMode>("gallery")
  const [participants, setParticipants] = useState<VideoParticipant[]>(mockVideoParticipants)
  const [isMuted, setIsMuted] = useState(false)
  const [isCameraOn, setIsCameraOn] = useState(true)
  const [isScreenSharing, setIsScreenSharing] = useState(false)
  const [showTranscript, setShowTranscript] = useState(false)
  const [duration, setDuration] = useState(0)
  const [focusedParticipant, setFocusedParticipant] = useState<string | null>(null)

  const timerRef = useRef<NodeJS.Timeout | null>(null)
  const transcriptRef = useRef<HTMLDivElement>(null)

  // Duration timer
  useEffect(() => {
    timerRef.current = setInterval(() => setDuration((d) => d + 1), 1000)
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [])

  // Auto-switch to screenshare layout
  useEffect(() => {
    const sharingParticipant = participants.find((p) => p.isScreenSharing)
    if (sharingParticipant) {
      setLayout("screenshare")
      setFocusedParticipant(sharingParticipant.id)
    } else if (layout === "screenshare") {
      setLayout("gallery")
    }
  }, [participants, layout])

  // Scroll transcript
  useEffect(() => {
    if (transcriptRef.current) {
      transcriptRef.current.scrollTop = transcriptRef.current.scrollHeight
    }
  }, [showTranscript])

  const leaveRoom = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current)
    router.push("/mobile")
  }, [router])

  const toggleScreenShare = () => {
    setIsScreenSharing(!isScreenSharing)
    setParticipants((prev) =>
      prev.map((p) =>
        p.isLocal ? { ...p, isScreenSharing: !isScreenSharing } : p
      )
    )
  }

  const handleFocusParticipant = (id: string) => {
    if (layout === "gallery") {
      setLayout("focus")
      setFocusedParticipant(id)
    } else if (focusedParticipant === id) {
      setLayout("gallery")
      setFocusedParticipant(null)
    } else {
      setFocusedParticipant(id)
    }
  }

  const activeParticipant = focusedParticipant
    ? participants.find((p) => p.id === focusedParticipant) || participants[1]
    : participants.find((p) => p.isSpeaking) || participants[1]

  const otherParticipants = participants.filter((p) => p.id !== activeParticipant?.id)

  return (
    <div className="flex flex-col h-screen bg-[#111]">
      {/* Top Bar */}
      <div className="flex items-center justify-between px-4 py-2.5 z-10 shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-sm font-medium text-white truncate">{roomName}</span>
          <div className="flex items-center gap-1 shrink-0">
            <Users className="h-3 w-3 text-white/50" />
            <span className="text-xs text-white/50">{participants.length}</span>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Badge variant="secondary" className="text-[10px] gap-1 bg-destructive/20 text-destructive border-0">
            <span className="h-1.5 w-1.5 rounded-full bg-destructive animate-pulse" />
            {formatCallDuration(duration)}
          </Badge>
          {/* Layout toggle */}
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
        {/* Gallery Layout */}
        {layout === "gallery" && (
          <div className="h-full p-2">
            <div className={cn(
              "grid h-full gap-2",
              participants.length <= 2 ? "grid-cols-1" : "grid-cols-2",
              participants.length > 4 && "grid-rows-3",
              participants.length <= 4 && participants.length > 2 && "grid-rows-2"
            )}>
              {participants.map((p) => (
                <ParticipantTile
                  key={p.id}
                  participant={p}
                  onClick={() => handleFocusParticipant(p.id)}
                />
              ))}
            </div>
          </div>
        )}

        {/* Focus Layout */}
        {layout === "focus" && activeParticipant && (
          <div className="flex flex-col h-full">
            {/* Large focused tile */}
            <div className="flex-1 p-2">
              <ParticipantTile
                participant={activeParticipant}
                large
                onClick={() => {
                  setLayout("gallery")
                  setFocusedParticipant(null)
                }}
              />
            </div>
            {/* Thumbnail strip */}
            {otherParticipants.length > 0 && (
              <div className="flex gap-2 px-2 pb-2 overflow-x-auto shrink-0">
                {otherParticipants.map((p) => (
                  <div key={p.id} className="shrink-0 w-20 h-20">
                    <ParticipantTile
                      participant={p}
                      small
                      onClick={() => handleFocusParticipant(p.id)}
                    />
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Screenshare Layout */}
        {layout === "screenshare" && activeParticipant && (
          <div className="flex flex-col h-full">
            {/* Screen share area */}
            <div className="flex-1 p-2">
              <div className="h-full rounded-xl bg-[#1a1a1a] border border-white/10 flex flex-col items-center justify-center relative overflow-hidden">
                <Badge className="absolute top-3 left-3 bg-info text-info-foreground text-[10px] gap-1 z-10">
                  <MonitorUp className="h-3 w-3" />
                  {activeParticipant.name}{"'"}s Screen
                </Badge>
                <MonitorUp className="h-16 w-16 text-white/20 mb-3" />
                <p className="text-sm text-white/40">Screen share content</p>
              </div>
            </div>
            {/* Participants strip */}
            <div className="flex gap-2 px-2 pb-2 overflow-x-auto shrink-0">
              {participants.map((p) => (
                <div key={p.id} className="shrink-0 w-20 h-20">
                  <ParticipantTile
                    participant={p}
                    small
                    onClick={() => handleFocusParticipant(p.id)}
                  />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Transcript Overlay */}
        {showTranscript && (
          <div className="absolute inset-x-0 bottom-0 top-1/3 bg-gradient-to-t from-black/90 via-black/70 to-transparent z-20 flex flex-col">
            <div className="flex items-center justify-between px-4 pt-8 pb-2">
              <span className="text-xs font-medium text-white/60">Live Transcript</span>
              <button onClick={() => setShowTranscript(false)}>
                <X className="h-4 w-4 text-white/40" />
              </button>
            </div>
            <div ref={transcriptRef} className="flex-1 overflow-y-auto px-4 pb-2 space-y-2.5">
              {mockLiveTranscript.map((segment) => (
                <div key={segment.id} className={cn("flex flex-col max-w-[85%]", segment.speaker === "user" ? "ml-auto items-end" : "items-start")}>
                  <span className="text-[10px] text-white/30 mb-0.5 px-1">{segment.speakerName}</span>
                  <div className={cn(
                    "rounded-2xl px-3 py-1.5 text-sm",
                    segment.speaker === "user"
                      ? "bg-primary text-primary-foreground rounded-br-md"
                      : "bg-white/15 text-white rounded-bl-md",
                    !segment.isFinal && "opacity-50"
                  )}>
                    {segment.text}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Bottom Controls */}
      <div className="flex items-center justify-center gap-4 px-4 py-4 shrink-0">
        <RoomControl
          icon={isMuted ? MicOff : Mic}
          label={isMuted ? "Unmute" : "Mute"}
          active={isMuted}
          onClick={() => setIsMuted(!isMuted)}
        />
        <RoomControl
          icon={isCameraOn ? Video : VideoOff}
          label={isCameraOn ? "Cam On" : "Cam Off"}
          active={!isCameraOn}
          onClick={() => setIsCameraOn(!isCameraOn)}
        />
        <RoomControl
          icon={MonitorUp}
          label="Share"
          active={isScreenSharing}
          accent
          onClick={toggleScreenShare}
        />
        <RoomControl
          icon={MessageSquareText}
          label="Transcript"
          active={showTranscript}
          onClick={() => setShowTranscript(!showTranscript)}
        />
        <button onClick={leaveRoom} className="flex flex-col items-center gap-1">
          <div className="h-12 w-12 rounded-full flex items-center justify-center bg-destructive hover:bg-destructive/90 transition-colors">
            <LogOut className="h-5 w-5 text-destructive-foreground" />
          </div>
          <span className="text-[10px] text-white/50">Leave</span>
        </button>
      </div>
    </div>
  )
}

function ParticipantTile({ participant, large, small, onClick }: {
  participant: VideoParticipant
  large?: boolean
  small?: boolean
  onClick?: () => void
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "relative rounded-xl overflow-hidden w-full h-full flex items-center justify-center transition-all",
        participant.hasVideo ? "bg-[#222]" : "bg-[#1a1a1a]",
        participant.isSpeaking && "ring-2 ring-primary",
        !small && "hover:ring-2 hover:ring-white/20"
      )}
    >
      {/* Avatar / Video placeholder */}
      {participant.hasVideo ? (
        <div className="absolute inset-0 flex items-center justify-center bg-[#222]">
          <span className={cn("text-white/20", large ? "text-lg" : small ? "text-[10px]" : "text-sm")}>
            {participant.isLocal ? "Camera" : "Video"}
          </span>
        </div>
      ) : (
        <Avatar className={cn(large ? "h-20 w-20" : small ? "h-8 w-8" : "h-14 w-14")}>
          <AvatarFallback className={cn(
            "bg-white/10 text-white",
            large ? "text-2xl" : small ? "text-[10px]" : "text-lg"
          )}>
            {participant.initials}
          </AvatarFallback>
        </Avatar>
      )}

      {/* Name + indicators */}
      <div className="absolute bottom-0 left-0 right-0 p-1.5 bg-gradient-to-t from-black/60 to-transparent">
        <div className="flex items-center justify-between">
          <span className={cn("text-white font-medium truncate", small ? "text-[8px]" : "text-xs")}>
            {participant.isLocal ? "You" : participant.name.split(" ")[0]}
          </span>
          <div className="flex items-center gap-0.5">
            {!participant.hasAudio && (
              <MicOff className={cn("text-destructive", small ? "h-2 w-2" : "h-3 w-3")} />
            )}
            {participant.isScreenSharing && (
              <MonitorUp className={cn("text-info", small ? "h-2 w-2" : "h-3 w-3")} />
            )}
          </div>
        </div>
      </div>

      {/* Speaking indicator ring glow */}
      {participant.isSpeaking && (
        <div className="absolute inset-0 rounded-xl ring-2 ring-primary ring-inset pointer-events-none" />
      )}
    </button>
  )
}

function RoomControl({ icon: Icon, label, active, accent, onClick }: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  active: boolean
  accent?: boolean
  onClick: () => void
}) {
  return (
    <button onClick={onClick} className="flex flex-col items-center gap-1">
      <div className={cn(
        "h-12 w-12 rounded-full flex items-center justify-center transition-colors",
        active
          ? accent ? "bg-info text-info-foreground" : "bg-white/25 text-white"
          : "bg-white/10 text-white/60 hover:bg-white/15"
      )}>
        <Icon className="h-5 w-5" />
      </div>
      <span className="text-[10px] text-white/50">{label}</span>
    </button>
  )
}

export default function VideoRoomPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center h-screen bg-[#111]"><p className="text-white/50">Joining room...</p></div>}>
      <VideoRoomContent />
    </Suspense>
  )
}
