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
  Radio,
} from "lucide-react"
import { Button } from "../../../components/ui/button"
import { Avatar, AvatarFallback } from "../../../components/ui/avatar"
import { Badge } from "../../../components/ui/badge"
import { ScrollArea } from "../../../components/ui/scroll-area"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "../../../components/ui/sheet"
import { cn } from "../../../lib/utils"
import { formatDuration } from "../../../lib/mock-data"
import type { CallStatus, TranscriptEntry } from "../../../lib/types"

function CallPageContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const name = searchParams.get("name") || "Unknown"
  const phone = searchParams.get("phone") || ""
  const initials = name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2) || "?"

  const [callStatus, setCallStatus] = useState<CallStatus>("connecting")
  const [callDuration, setCallDuration] = useState(0)
  const [isMuted, setIsMuted] = useState(false)
  const [isSpeaker, setIsSpeaker] = useState(false)
  const [isOnHold, setIsOnHold] = useState(false)
  const [showTranscript, setShowTranscript] = useState(false)
  const [showNotes, setShowNotes] = useState(false)
  const [notes, setNotes] = useState("")
  const [transcript, setTranscript] = useState<TranscriptEntry[]>([])
  
  const timerRef = useRef<NodeJS.Timeout | null>(null)
  const transcriptRef = useRef<HTMLDivElement>(null)

  // Simulate call connection
  useEffect(() => {
    const connectTimeout = setTimeout(() => {
      setCallStatus("ringing")
    }, 1500)

    const answerTimeout = setTimeout(() => {
      setCallStatus("connected")
    }, 4000)

    return () => {
      clearTimeout(connectTimeout)
      clearTimeout(answerTimeout)
    }
  }, [])

  // Call duration timer
  useEffect(() => {
    if (callStatus === "connected" && !isOnHold) {
      timerRef.current = setInterval(() => {
        setCallDuration((prev) => prev + 1)
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
  }, [callStatus, isOnHold])

  // Simulate live transcript
  useEffect(() => {
    if (callStatus !== "connected" || isOnHold) return

    const mockTranscriptEntries = [
      { speaker: "remote" as const, text: "Hello, this is speaking." },
      { speaker: "local" as const, text: "Hi, thanks for taking my call." },
      { speaker: "remote" as const, text: "Of course, how can I help you today?" },
      { speaker: "local" as const, text: "I wanted to discuss the project timeline we talked about last week." },
      { speaker: "remote" as const, text: "Sure, I have the notes right here. We were looking at a Q2 delivery." },
      { speaker: "local" as const, text: "That's right. I think we might need to adjust some of the milestones." },
    ]

    let entryIndex = 0
    const transcriptInterval = setInterval(() => {
      if (entryIndex < mockTranscriptEntries.length) {
        const entry = mockTranscriptEntries[entryIndex]
        setTranscript((prev) => [
          ...prev,
          {
            id: `t-${Date.now()}`,
            speaker: entry.speaker,
            text: entry.text,
            timestamp: callDuration,
          },
        ])
        entryIndex++
      }
    }, 5000)

    return () => clearInterval(transcriptInterval)
  }, [callStatus, isOnHold, callDuration])

  // Auto-scroll transcript
  useEffect(() => {
    if (transcriptRef.current) {
      transcriptRef.current.scrollTop = transcriptRef.current.scrollHeight
    }
  }, [transcript])

  const handleEndCall = () => {
    setCallStatus("ended")
    if (timerRef.current) {
      clearInterval(timerRef.current)
    }
    setTimeout(() => {
      router.push("/mobile")
    }, 2000)
  }

  const getStatusText = () => {
    switch (callStatus) {
      case "connecting":
        return "Connecting..."
      case "ringing":
        return "Ringing..."
      case "connected":
        return isOnHold ? "On Hold" : formatDuration(callDuration)
      case "ended":
        return "Call Ended"
    }
  }

  return (
    <div className="flex flex-col h-screen bg-background">
      {/* Call Info Header */}
      <div className="flex-1 flex flex-col items-center justify-center px-6">
        {/* Avatar */}
        <Avatar className={cn(
          "h-28 w-28 mb-4 transition-all",
          callStatus === "connected" && !isOnHold && "ring-4 ring-primary/30"
        )}>
          <AvatarFallback className="bg-primary/10 text-primary text-3xl">
            {initials}
          </AvatarFallback>
        </Avatar>

        {/* Name & Phone */}
        <h1 className="text-2xl font-semibold text-foreground mb-1">{name}</h1>
        <p className="text-muted-foreground mb-3">{phone}</p>

        {/* Status */}
        <p className={cn(
          "text-lg font-medium",
          callStatus === "connected" ? "text-primary" : "text-muted-foreground"
        )}>
          {getStatusText()}
        </p>

        {/* Recording Indicator */}
        {callStatus === "connected" && !isOnHold && (
          <div className="flex items-center gap-2 mt-4">
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-destructive/10">
              <Radio className="h-3 w-3 text-destructive animate-pulse" />
              <span className="text-xs font-medium text-destructive">Recording</span>
            </div>
            <Badge variant="secondary" className="text-xs">
              <FileText className="h-3 w-3 mr-1" />
              Transcribing
            </Badge>
          </div>
        )}

        {/* View Toggle */}
        {callStatus === "connected" && (
          <div className="flex gap-2 mt-6 p-1 bg-secondary rounded-lg">
            <button
              onClick={() => setShowTranscript(false)}
              className={cn(
                "px-4 py-2 rounded-md text-sm font-medium transition-colors",
                !showTranscript
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              Simple
            </button>
            <button
              onClick={() => setShowTranscript(true)}
              className={cn(
                "px-4 py-2 rounded-md text-sm font-medium transition-colors",
                showTranscript
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              Transcript
            </button>
          </div>
        )}
      </div>

      {/* Live Transcript Panel */}
      {callStatus === "connected" && showTranscript && (
        <div className="h-[200px] border-t border-border bg-card">
          <ScrollArea className="h-full">
            <div ref={transcriptRef} className="p-4 space-y-3">
              {transcript.length === 0 ? (
                <p className="text-center text-sm text-muted-foreground py-8">
                  Transcript will appear here...
                </p>
              ) : (
                transcript.map((entry) => (
                  <div
                    key={entry.id}
                    className={cn(
                      "flex",
                      entry.speaker === "local" ? "justify-end" : "justify-start"
                    )}
                  >
                    <div
                      className={cn(
                        "max-w-[80%] px-3 py-2 rounded-2xl",
                        entry.speaker === "local"
                          ? "bg-primary text-primary-foreground rounded-br-sm"
                          : "bg-secondary text-secondary-foreground rounded-bl-sm"
                      )}
                    >
                      <p className="text-sm">{entry.text}</p>
                      <p className={cn(
                        "text-[10px] mt-1",
                        entry.speaker === "local" ? "text-primary-foreground/70" : "text-muted-foreground"
                      )}>
                        {formatDuration(entry.timestamp)}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </ScrollArea>
        </div>
      )}

      {/* Call Controls */}
      <div className="px-6 py-8 bg-card border-t border-border">
        {callStatus === "connected" ? (
          <>
            {/* Control Buttons */}
            <div className="grid grid-cols-4 gap-4 mb-8">
              <button
                onClick={() => setIsMuted(!isMuted)}
                className="flex flex-col items-center gap-2"
              >
                <div className={cn(
                  "h-14 w-14 rounded-full flex items-center justify-center transition-colors",
                  isMuted ? "bg-destructive" : "bg-secondary"
                )}>
                  {isMuted ? (
                    <MicOff className="h-6 w-6 text-destructive-foreground" />
                  ) : (
                    <Mic className="h-6 w-6 text-foreground" />
                  )}
                </div>
                <span className="text-xs text-muted-foreground">
                  {isMuted ? "Unmute" : "Mute"}
                </span>
              </button>

              <button
                onClick={() => setIsSpeaker(!isSpeaker)}
                className="flex flex-col items-center gap-2"
              >
                <div className={cn(
                  "h-14 w-14 rounded-full flex items-center justify-center transition-colors",
                  isSpeaker ? "bg-primary" : "bg-secondary"
                )}>
                  {isSpeaker ? (
                    <Volume2 className="h-6 w-6 text-primary-foreground" />
                  ) : (
                    <VolumeX className="h-6 w-6 text-foreground" />
                  )}
                </div>
                <span className="text-xs text-muted-foreground">Speaker</span>
              </button>

              <button
                onClick={() => setIsOnHold(!isOnHold)}
                className="flex flex-col items-center gap-2"
              >
                <div className={cn(
                  "h-14 w-14 rounded-full flex items-center justify-center transition-colors",
                  isOnHold ? "bg-warning" : "bg-secondary"
                )}>
                  {isOnHold ? (
                    <Play className="h-6 w-6 text-warning-foreground" />
                  ) : (
                    <Pause className="h-6 w-6 text-foreground" />
                  )}
                </div>
                <span className="text-xs text-muted-foreground">
                  {isOnHold ? "Resume" : "Hold"}
                </span>
              </button>

              <button
                onClick={() => setShowNotes(true)}
                className="flex flex-col items-center gap-2"
              >
                <div className="h-14 w-14 rounded-full bg-secondary flex items-center justify-center">
                  <MessageSquare className="h-6 w-6 text-foreground" />
                </div>
                <span className="text-xs text-muted-foreground">Notes</span>
              </button>
            </div>

            {/* End Call Button */}
            <button
              onClick={handleEndCall}
              className="w-full h-14 rounded-full bg-destructive hover:bg-destructive/90 flex items-center justify-center gap-2 transition-colors"
            >
              <PhoneOff className="h-6 w-6 text-destructive-foreground" />
              <span className="font-medium text-destructive-foreground">End Call</span>
            </button>
          </>
        ) : callStatus === "ended" ? (
          <div className="text-center py-8">
            <p className="text-muted-foreground mb-2">Call duration: {formatDuration(callDuration)}</p>
            <Badge variant="secondary">
              <FileText className="h-3 w-3 mr-1" />
              Transcript will be available in Sessions
            </Badge>
          </div>
        ) : (
          <button
            onClick={handleEndCall}
            className="w-full h-14 rounded-full bg-destructive hover:bg-destructive/90 flex items-center justify-center gap-2 transition-colors"
          >
            <PhoneOff className="h-6 w-6 text-destructive-foreground" />
            <span className="font-medium text-destructive-foreground">Cancel</span>
          </button>
        )}
      </div>

      {/* Notes Sheet */}
      <Sheet open={showNotes} onOpenChange={setShowNotes}>
        <SheetContent side="bottom" className="h-[50vh] rounded-t-2xl">
          <SheetHeader className="mb-4">
            <SheetTitle>Call Notes</SheetTitle>
          </SheetHeader>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Add notes during the call..."
            className="w-full h-[calc(100%-80px)] p-3 rounded-lg bg-secondary border-0 resize-none text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </SheetContent>
      </Sheet>
    </div>
  )
}

export default function CallPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center h-screen">Loading...</div>}>
      <CallPageContent />
    </Suspense>
  )
}
