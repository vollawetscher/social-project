"use client"

import { useState, useEffect, useRef, useCallback, Suspense } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import {
  Phone,
  PhoneOff,
  Mic,
  MicOff,
  Volume2,
  Pause,
  Play,
  StickyNote,
  Video,
  VideoOff,
  MonitorUp,
  MessageSquareText,
  ArrowLeft,
  X,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { mockContacts, mockLiveTranscript, formatCallDuration } from "@/lib/mock/mobile-data"
import type { CallMode } from "@/lib/mobile-types"

function ActiveCallContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const phone = searchParams.get("phone") || ""
  const contactId = searchParams.get("contactId")
  const mode = (searchParams.get("mode") as CallMode) || "audio"

  const contact = contactId
    ? mockContacts.find((c) => c.id === contactId) || { id: "unknown", name: phone, phone, initials: "?" }
    : { id: "unknown", name: phone, phone, initials: phone.slice(-2) }

  const [callStatus, setCallStatus] = useState<"connecting" | "ringing" | "connected" | "ended">("connecting")
  const [duration, setDuration] = useState(0)
  const [isMuted, setIsMuted] = useState(false)
  const [isSpeaker, setIsSpeaker] = useState(false)
  const [isOnHold, setIsOnHold] = useState(false)
  const [isCameraOn, setIsCameraOn] = useState(mode === "video")
  const [isScreenSharing, setIsScreenSharing] = useState(false)
  const [viewMode, setViewMode] = useState<"simple" | "transcript">("simple")
  const [showNotes, setShowNotes] = useState(false)
  const [notes, setNotes] = useState("")

  const timerRef = useRef<NodeJS.Timeout | null>(null)
  const transcriptRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const t1 = setTimeout(() => setCallStatus("ringing"), 1500)
    const t2 = setTimeout(() => setCallStatus("connected"), 3500)
    return () => { clearTimeout(t1); clearTimeout(t2) }
  }, [])

  useEffect(() => {
    if (callStatus === "connected" && !isOnHold) {
      timerRef.current = setInterval(() => setDuration((d) => d + 1), 1000)
    } else if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [callStatus, isOnHold])

  useEffect(() => {
    if (transcriptRef.current) {
      transcriptRef.current.scrollTop = transcriptRef.current.scrollHeight
    }
  }, [viewMode])

  const endCall = useCallback(() => {
    setCallStatus("ended")
    if (timerRef.current) clearInterval(timerRef.current)
    setTimeout(() => router.push("/mobile"), 1500)
  }, [router])

  const statusLabel = {
    connecting: "Connecting...",
    ringing: "Ringing...",
    connected: formatCallDuration(duration),
    ended: "Call Ended",
  }

  const isVideo = mode === "video"
  const isDarkOverlay = isVideo && callStatus === "connected" && viewMode === "simple"

  return (
    <div className={cn("flex flex-col h-screen", isDarkOverlay ? "bg-[#111]" : "bg-background")}>
      {/* Top Bar */}
      <div className={cn(
        "flex items-center justify-between px-4 py-3 z-10 shrink-0",
        isDarkOverlay ? "text-white" : "text-foreground"
      )}>
        <button onClick={endCall} className="flex items-center gap-1 text-sm opacity-80 hover:opacity-100 transition-opacity">
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
            isVideo ? "bg-info/20 text-info" : "bg-primary/20 text-primary"
          )}>
            {isVideo ? <Video className="h-3 w-3" /> : <Phone className="h-3 w-3" />}
            {isVideo ? "LiveKit" : "Twilio"}
          </Badge>
        </div>
      </div>

      {/* View Toggle */}
      {callStatus === "connected" && (
        <div className="flex justify-center px-4 pb-2 z-10 shrink-0">
          <div className={cn("flex p-0.5 rounded-lg", isDarkOverlay ? "bg-white/10" : "bg-secondary")}>
            <button
              onClick={() => setViewMode("simple")}
              className={cn(
                "px-3 py-1 rounded-md text-xs font-medium transition-colors",
                viewMode === "simple"
                  ? isDarkOverlay ? "bg-white/20 text-white" : "bg-card text-foreground shadow-sm"
                  : isDarkOverlay ? "text-white/50" : "text-muted-foreground"
              )}
            >
              {isVideo ? "Video" : "Call"}
            </button>
            <button
              onClick={() => setViewMode("transcript")}
              className={cn(
                "flex items-center gap-1 px-3 py-1 rounded-md text-xs font-medium transition-colors",
                viewMode === "transcript"
                  ? isDarkOverlay ? "bg-white/20 text-white" : "bg-card text-foreground shadow-sm"
                  : isDarkOverlay ? "text-white/50" : "text-muted-foreground"
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
        {/* Simple / Video View */}
        {viewMode === "simple" && (
          <div className="flex-1 flex flex-col items-center justify-center w-full relative">
            {isVideo && callStatus === "connected" ? (
              <>
                {/* Remote video placeholder */}
                <div className="absolute inset-0 flex items-center justify-center bg-[#1a1a1a]">
                  <div className="flex flex-col items-center gap-3">
                    <Avatar className="h-24 w-24">
                      <AvatarFallback className="bg-white/10 text-white text-3xl">
                        {contact.initials}
                      </AvatarFallback>
                    </Avatar>
                    <p className="text-lg font-medium text-white">{contact.name}</p>
                    <p className="text-sm text-white/50">{statusLabel[callStatus]}</p>
                  </div>
                </div>

                {/* Self-view PiP */}
                {isCameraOn && (
                  <div className="absolute top-4 right-4 w-24 h-32 rounded-xl bg-[#222] border border-white/10 overflow-hidden shadow-lg z-20 flex items-center justify-center">
                    <span className="text-[10px] text-white/40">Camera</span>
                  </div>
                )}

                {/* Screen share indicator */}
                {isScreenSharing && (
                  <div className="absolute top-4 left-4 z-20">
                    <Badge className="bg-info text-info-foreground text-[10px] gap-1">
                      <MonitorUp className="h-3 w-3" />
                      Sharing Screen
                    </Badge>
                  </div>
                )}
              </>
            ) : (
              /* Audio mode */
              <div className="flex flex-col items-center gap-4">
                <div className={cn("rounded-full p-1", callStatus === "connected" && "ring-4 ring-primary/20")}>
                  <Avatar className="h-28 w-28">
                    <AvatarFallback className="bg-secondary text-foreground text-4xl">
                      {contact.initials}
                    </AvatarFallback>
                  </Avatar>
                </div>
                <div className="text-center">
                  <h2 className="text-xl font-semibold text-foreground">{contact.name}</h2>
                  <p className="text-sm text-muted-foreground mt-1">{contact.phone}</p>
                </div>
                <p className={cn(
                  "text-lg font-mono",
                  callStatus === "connected" ? "text-foreground" : "text-muted-foreground"
                )}>
                  {statusLabel[callStatus]}
                </p>
                {isOnHold && (
                  <Badge variant="secondary" className="text-xs bg-warning/15 text-warning border-0">On Hold</Badge>
                )}
                {callStatus === "connected" && (
                  <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10">
                    <span className="h-2 w-2 rounded-full bg-primary animate-pulse" />
                    <span className="text-xs text-primary font-medium">Recording & Transcribing</span>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Transcript View */}
        {viewMode === "transcript" && (
          <div ref={transcriptRef} className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
            {/* Mini contact bar */}
            <div className="flex items-center gap-2 pb-3 mb-2 border-b border-border">
              <Avatar className="h-8 w-8">
                <AvatarFallback className="bg-secondary text-foreground text-xs">{contact.initials}</AvatarFallback>
              </Avatar>
              <div>
                <p className="text-sm font-medium text-foreground">{contact.name}</p>
                <p className="text-[11px] text-muted-foreground">{statusLabel[callStatus]}</p>
              </div>
              {callStatus === "connected" && (
                <div className="ml-auto flex items-center gap-1">
                  <span className="h-1.5 w-1.5 rounded-full bg-destructive animate-pulse" />
                  <span className="text-[10px] text-destructive font-medium">REC</span>
                </div>
              )}
            </div>

            {callStatus === "connected" ? (
              mockLiveTranscript.map((segment) => (
                <div key={segment.id} className={cn("flex flex-col max-w-[85%]", segment.speaker === "user" ? "ml-auto items-end" : "items-start")}>
                  <span className="text-[10px] text-muted-foreground mb-0.5 px-1">
                    {segment.speakerName} - {formatCallDuration(segment.timestamp)}
                  </span>
                  <div className={cn(
                    "rounded-2xl px-3 py-2 text-sm",
                    segment.speaker === "user"
                      ? "bg-primary text-primary-foreground rounded-br-md"
                      : "bg-secondary text-foreground rounded-bl-md",
                    !segment.isFinal && "opacity-60"
                  )}>
                    {segment.text}
                  </div>
                </div>
              ))
            ) : (
              <div className="flex items-center justify-center py-12">
                <p className="text-sm text-muted-foreground">Transcript will appear when call connects...</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Notes Panel */}
      {showNotes && (
        <div className={cn("border-t px-4 py-3 shrink-0", isDarkOverlay ? "border-white/10 bg-[#1a1a1a]" : "border-border bg-card")}>
          <div className="flex items-center justify-between mb-2">
            <span className={cn("text-xs font-medium", isDarkOverlay ? "text-white/60" : "text-muted-foreground")}>Notes</span>
            <button onClick={() => setShowNotes(false)}>
              <X className={cn("h-4 w-4", isDarkOverlay ? "text-white/40" : "text-muted-foreground")} />
            </button>
          </div>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Add call notes..."
            className={cn(
              "w-full h-20 text-sm rounded-lg p-2 resize-none focus:outline-none focus:ring-1",
              isDarkOverlay
                ? "bg-white/10 text-white placeholder:text-white/30 focus:ring-white/20"
                : "bg-secondary text-foreground placeholder:text-muted-foreground focus:ring-primary"
            )}
          />
        </div>
      )}

      {/* Controls */}
      <div className={cn(
        "px-4 pb-6 pt-3 border-t shrink-0",
        isDarkOverlay ? "border-white/10 bg-[#111]" : "border-border bg-card"
      )}>
        {callStatus !== "ended" ? (
          <>
            <div className="flex items-center justify-center gap-4 mb-4 flex-wrap">
              <ControlBtn icon={isMuted ? MicOff : Mic} label={isMuted ? "Unmute" : "Mute"} active={isMuted} onClick={() => setIsMuted(!isMuted)} dark={isDarkOverlay} />
              {isVideo && (
                <ControlBtn icon={isCameraOn ? Video : VideoOff} label={isCameraOn ? "Cam On" : "Cam Off"} active={!isCameraOn} onClick={() => setIsCameraOn(!isCameraOn)} dark={isDarkOverlay} />
              )}
              <ControlBtn icon={Volume2} label="Speaker" active={isSpeaker} onClick={() => setIsSpeaker(!isSpeaker)} dark={isDarkOverlay} />
              {isVideo && (
                <ControlBtn icon={MonitorUp} label="Share" active={isScreenSharing} onClick={() => setIsScreenSharing(!isScreenSharing)} dark={isDarkOverlay} accent />
              )}
              <ControlBtn icon={isOnHold ? Play : Pause} label={isOnHold ? "Resume" : "Hold"} active={isOnHold} onClick={() => setIsOnHold(!isOnHold)} dark={isDarkOverlay} />
              <ControlBtn icon={StickyNote} label="Notes" active={showNotes} onClick={() => setShowNotes(!showNotes)} dark={isDarkOverlay} />
            </div>
            <Button onClick={endCall} className="w-full h-12 rounded-full bg-destructive hover:bg-destructive/90 text-destructive-foreground">
              <PhoneOff className="h-5 w-5 mr-2" />
              End Call
            </Button>
          </>
        ) : (
          <div className="text-center py-2">
            <p className={cn("text-sm", isDarkOverlay ? "text-white/50" : "text-muted-foreground")}>
              Call ended {duration > 0 && `\u00B7 ${formatCallDuration(duration)}`}
            </p>
            <p className={cn("text-xs mt-1", isDarkOverlay ? "text-white/30" : "text-muted-foreground")}>
              Transcript will be available in Sessions
            </p>
          </div>
        )}
      </div>
    </div>
  )
}

function ControlBtn({ icon: Icon, label, active, onClick, dark, accent }: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  active: boolean
  onClick: () => void
  dark?: boolean
  accent?: boolean
}) {
  return (
    <button onClick={onClick} className="flex flex-col items-center gap-1">
      <div className={cn(
        "h-12 w-12 rounded-full flex items-center justify-center transition-colors",
        active
          ? accent ? "bg-info text-info-foreground" : dark ? "bg-white/25 text-white" : "bg-foreground/10 text-foreground"
          : dark ? "bg-white/10 text-white/60 hover:bg-white/15" : "bg-secondary text-muted-foreground hover:bg-secondary/80"
      )}>
        <Icon className="h-5 w-5" />
      </div>
      <span className={cn("text-[10px]", dark ? "text-white/50" : "text-muted-foreground")}>{label}</span>
    </button>
  )
}

export default function ActiveCallPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center h-screen bg-background"><p className="text-muted-foreground">Loading...</p></div>}>
      <ActiveCallContent />
    </Suspense>
  )
}
