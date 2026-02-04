"use client"

import { useState, useEffect, useRef, Suspense } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import {
  Phone,
  PhoneOff,
  Mic,
  MicOff,
  Volume2,
  VolumeX,
  Pause,
  Play,
  FileText,
  MessageSquare,
  X,
  Send,
  ChevronDown,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { cn } from "@/lib/utils"
import { mockContacts, mockLiveTranscript, formatCallDuration } from "@/lib/mock/mobile-data"
import type { Contact, LiveTranscriptSegment } from "@/lib/mobile-types"

type CallStatus = "connecting" | "ringing" | "connected" | "ended"
type ViewMode = "simple" | "transcript"

function CallScreenContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const phone = searchParams.get("phone") || ""
  const contactId = searchParams.get("contactId")

  const [status, setStatus] = useState<CallStatus>("connecting")
  const [duration, setDuration] = useState(0)
  const [isMuted, setIsMuted] = useState(false)
  const [isSpeaker, setIsSpeaker] = useState(false)
  const [isOnHold, setIsOnHold] = useState(false)
  const [viewMode, setViewMode] = useState<ViewMode>("simple")
  const [showNotes, setShowNotes] = useState(false)
  const [notes, setNotes] = useState("")
  const [transcript, setTranscript] = useState<LiveTranscriptSegment[]>([])
  
  const timerRef = useRef<NodeJS.Timeout | null>(null)
  const transcriptRef = useRef<HTMLDivElement>(null)

  // Find contact info
  const contact: Contact | undefined = contactId
    ? mockContacts.find((c) => c.id === contactId)
    : undefined

  const displayName = contact?.name || phone
  const displayInitials = contact?.initials || phone.slice(0, 2)

  // Simulate call progression
  useEffect(() => {
    const connectTimer = setTimeout(() => {
      setStatus("ringing")
    }, 1500)

    const answerTimer = setTimeout(() => {
      setStatus("connected")
    }, 4000)

    return () => {
      clearTimeout(connectTimer)
      clearTimeout(answerTimer)
    }
  }, [])

  // Call duration timer
  useEffect(() => {
    if (status === "connected" && !isOnHold) {
      timerRef.current = setInterval(() => {
        setDuration((prev) => prev + 1)
      }, 1000)
    } else {
      if (timerRef.current) {
        clearInterval(timerRef.current)
        timerRef.current = null
      }
    }

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current)
      }
    }
  }, [status, isOnHold])

  // Simulate live transcript
  useEffect(() => {
    if (status === "connected" && viewMode === "transcript") {
      // Gradually add transcript segments
      mockLiveTranscript.forEach((segment, index) => {
        setTimeout(() => {
          setTranscript((prev) => {
            if (prev.find((s) => s.id === segment.id)) return prev
            return [...prev, segment]
          })
        }, (segment.timestamp - 5) * 1000 + index * 500)
      })
    }
  }, [status, viewMode])

  // Auto-scroll transcript
  useEffect(() => {
    if (transcriptRef.current) {
      transcriptRef.current.scrollTop = transcriptRef.current.scrollHeight
    }
  }, [transcript])

  const handleEndCall = () => {
    setStatus("ended")
    if (timerRef.current) {
      clearInterval(timerRef.current)
    }
    // Navigate back after brief delay
    setTimeout(() => {
      router.push("/mobile")
    }, 1500)
  }

  const statusText = {
    connecting: "Connecting...",
    ringing: "Ringing...",
    connected: formatCallDuration(duration),
    ended: "Call ended",
  }

  return (
    <div className="flex flex-col h-screen bg-background">
      {/* View Mode Toggle (when connected) */}
      {status === "connected" && (
        <div className="flex items-center justify-center gap-2 py-3 px-4 border-b border-border bg-card">
          <button
            onClick={() => setViewMode("simple")}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors",
              viewMode === "simple"
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Phone className="h-3.5 w-3.5" />
            Call
          </button>
          <button
            onClick={() => setViewMode("transcript")}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors",
              viewMode === "transcript"
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <FileText className="h-3.5 w-3.5" />
            Live Transcript
          </button>
        </div>
      )}

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Simple View */}
        {(viewMode === "simple" || status !== "connected") && (
          <div className="flex-1 flex flex-col items-center justify-center px-6">
            {/* Contact Avatar */}
            <Avatar className="h-28 w-28 mb-6">
              <AvatarFallback className="bg-secondary text-foreground text-3xl font-medium">
                {displayInitials}
              </AvatarFallback>
            </Avatar>

            {/* Contact Name */}
            <h1 className="text-2xl font-semibold text-foreground text-center mb-1">
              {displayName}
            </h1>
            {contact && (
              <p className="text-sm text-muted-foreground mb-2">{contact.phone}</p>
            )}

            {/* Status / Duration */}
            <p
              className={cn(
                "text-lg font-mono",
                status === "connected"
                  ? "text-primary font-semibold"
                  : status === "ended"
                  ? "text-destructive"
                  : "text-muted-foreground"
              )}
            >
              {statusText[status]}
            </p>

            {/* Hold Indicator */}
            {isOnHold && status === "connected" && (
              <p className="text-sm text-warning mt-2 font-medium">On Hold</p>
            )}

            {/* Recording Indicator */}
            {status === "connected" && (
              <div className="flex items-center gap-2 mt-4 px-3 py-1.5 rounded-full bg-primary/10">
                <span className="h-2 w-2 rounded-full bg-primary animate-pulse" />
                <span className="text-xs text-primary font-medium">
                  Recording & Transcribing
                </span>
              </div>
            )}
          </div>
        )}

        {/* Transcript View */}
        {viewMode === "transcript" && status === "connected" && (
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Transcript Content */}
            <div
              ref={transcriptRef}
              className="flex-1 overflow-y-auto px-4 py-4 space-y-3"
            >
              {transcript.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-center">
                  <FileText className="h-12 w-12 text-muted-foreground/50 mb-4" />
                  <p className="text-muted-foreground">Listening...</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Transcript will appear as you speak
                  </p>
                </div>
              ) : (
                transcript.map((segment) => (
                  <div
                    key={segment.id}
                    className={cn(
                      "flex",
                      segment.speaker === "user" ? "justify-end" : "justify-start"
                    )}
                  >
                    <div
                      className={cn(
                        "max-w-[80%] px-3 py-2 rounded-2xl",
                        segment.speaker === "user"
                          ? "bg-primary text-primary-foreground rounded-br-md"
                          : "bg-secondary text-foreground rounded-bl-md",
                        !segment.isFinal && "opacity-70"
                      )}
                    >
                      <p className="text-sm">{segment.text}</p>
                      <p
                        className={cn(
                          "text-[10px] mt-1",
                          segment.speaker === "user"
                            ? "text-primary-foreground/70"
                            : "text-muted-foreground"
                        )}
                      >
                        {formatCallDuration(segment.timestamp)}
                        {!segment.isFinal && " · typing..."}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Compact Call Info Bar */}
            <div className="flex items-center justify-between px-4 py-2 border-t border-border bg-card">
              <div className="flex items-center gap-2">
                <Avatar className="h-8 w-8">
                  <AvatarFallback className="bg-secondary text-foreground text-xs">
                    {displayInitials}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <p className="text-sm font-medium text-foreground leading-tight">
                    {displayName}
                  </p>
                  <p className="text-xs text-primary font-mono">
                    {formatCallDuration(duration)}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <span className="h-2 w-2 rounded-full bg-primary animate-pulse" />
                <span className="text-[10px] text-primary font-medium">REC</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Notes Panel */}
      {showNotes && (
        <div className="border-t border-border bg-card p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-foreground">Call Notes</span>
            <button
              onClick={() => setShowNotes(false)}
              className="h-6 w-6 rounded-full hover:bg-secondary flex items-center justify-center"
            >
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            </button>
          </div>
          <div className="relative">
            <Textarea
              placeholder="Add notes during the call..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="min-h-[80px] pr-10 resize-none bg-secondary border-border"
            />
            <button className="absolute bottom-2 right-2 h-7 w-7 rounded-full bg-primary flex items-center justify-center">
              <Send className="h-3.5 w-3.5 text-primary-foreground" />
            </button>
          </div>
        </div>
      )}

      {/* Call Controls */}
      {status !== "ended" && (
        <div className="border-t border-border bg-card px-4 py-6">
          {/* Secondary Controls */}
          <div className="flex items-center justify-center gap-6 mb-6">
            <button
              onClick={() => setIsMuted(!isMuted)}
              className={cn(
                "flex flex-col items-center gap-1.5 transition-colors",
                isMuted ? "text-destructive" : "text-muted-foreground"
              )}
            >
              <div
                className={cn(
                  "h-12 w-12 rounded-full flex items-center justify-center transition-colors",
                  isMuted ? "bg-destructive/10" : "bg-secondary"
                )}
              >
                {isMuted ? (
                  <MicOff className="h-5 w-5" />
                ) : (
                  <Mic className="h-5 w-5" />
                )}
              </div>
              <span className="text-[10px] font-medium">
                {isMuted ? "Unmute" : "Mute"}
              </span>
            </button>

            <button
              onClick={() => setIsSpeaker(!isSpeaker)}
              className={cn(
                "flex flex-col items-center gap-1.5 transition-colors",
                isSpeaker ? "text-primary" : "text-muted-foreground"
              )}
            >
              <div
                className={cn(
                  "h-12 w-12 rounded-full flex items-center justify-center transition-colors",
                  isSpeaker ? "bg-primary/10" : "bg-secondary"
                )}
              >
                {isSpeaker ? (
                  <Volume2 className="h-5 w-5" />
                ) : (
                  <VolumeX className="h-5 w-5" />
                )}
              </div>
              <span className="text-[10px] font-medium">Speaker</span>
            </button>

            <button
              onClick={() => setIsOnHold(!isOnHold)}
              disabled={status !== "connected"}
              className={cn(
                "flex flex-col items-center gap-1.5 transition-colors",
                isOnHold ? "text-warning" : "text-muted-foreground",
                status !== "connected" && "opacity-50"
              )}
            >
              <div
                className={cn(
                  "h-12 w-12 rounded-full flex items-center justify-center transition-colors",
                  isOnHold ? "bg-warning/10" : "bg-secondary"
                )}
              >
                {isOnHold ? (
                  <Play className="h-5 w-5" />
                ) : (
                  <Pause className="h-5 w-5" />
                )}
              </div>
              <span className="text-[10px] font-medium">
                {isOnHold ? "Resume" : "Hold"}
              </span>
            </button>

            <button
              onClick={() => setShowNotes(!showNotes)}
              className={cn(
                "flex flex-col items-center gap-1.5 transition-colors",
                showNotes ? "text-primary" : "text-muted-foreground"
              )}
            >
              <div
                className={cn(
                  "h-12 w-12 rounded-full flex items-center justify-center transition-colors",
                  showNotes ? "bg-primary/10" : "bg-secondary"
                )}
              >
                <MessageSquare className="h-5 w-5" />
              </div>
              <span className="text-[10px] font-medium">Notes</span>
            </button>
          </div>

          {/* End Call Button */}
          <div className="flex justify-center">
            <button
              onClick={handleEndCall}
              className="h-16 w-16 rounded-full bg-destructive hover:bg-destructive/90 flex items-center justify-center transition-colors"
            >
              <PhoneOff className="h-7 w-7 text-destructive-foreground" />
            </button>
          </div>
        </div>
      )}

      {/* Call Ended State */}
      {status === "ended" && (
        <div className="border-t border-border bg-card px-4 py-6">
          <div className="text-center">
            <p className="text-sm text-muted-foreground mb-2">
              Call duration: {formatCallDuration(duration)}
            </p>
            <p className="text-xs text-primary">
              Transcript will be available in Sessions
            </p>
          </div>
        </div>
      )}
    </div>
  )
}

export default function CallPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center h-screen bg-background">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </div>
    }>
      <CallScreenContent />
    </Suspense>
  )
}
