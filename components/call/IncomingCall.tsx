"use client"

import { useState, useEffect, useRef } from "react"
import { Phone, Video, Mic, MicOff, VideoOff, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { cn } from "@/lib/utils"

interface IncomingCallProps {
  callerName: string
  mode: "audio" | "video"
  onJoin: (displayName: string) => void
  onDecline: () => void
  joining?: boolean
}

export function IncomingCall({
  callerName,
  mode,
  onJoin,
  onDecline,
  joining = false,
}: IncomingCallProps) {
  const [isMicReady, setIsMicReady] = useState(false)
  const [isCameraReady, setIsCameraReady] = useState(false)
  const [permissionError, setPermissionError] = useState<string | null>(null)
  const [checkingPermissions, setCheckingPermissions] = useState(true)
  const streamRef = useRef<MediaStream | null>(null)

  const initials = callerName
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2) || "?"

  useEffect(() => {
    async function checkPermissions() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: true,
          video: mode === "video",
        })
        streamRef.current = stream
        setIsMicReady(true)
        if (mode === "video") setIsCameraReady(true)
      } catch (err: any) {
        setPermissionError(err.message || "Could not access microphone")
      } finally {
        setCheckingPermissions(false)
      }
    }
    checkPermissions()
    return () => {
      streamRef.current?.getTracks().forEach((t) => t.stop())
    }
  }, [mode])

  const canJoin = isMicReady && !joining && !checkingPermissions

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-background">
      {/* Pulsing ring */}
      <div className="relative flex items-center justify-center mb-8">
        <span className="absolute inline-flex h-32 w-32 rounded-full bg-primary/10 animate-ping" />
        <span className="absolute inline-flex h-24 w-24 rounded-full bg-primary/15 animate-ping [animation-delay:0.3s]" />
        <Avatar className="relative h-20 w-20 z-10 ring-4 ring-background shadow-lg">
          <AvatarFallback className="bg-primary text-primary-foreground text-2xl font-semibold">
            {initials}
          </AvatarFallback>
        </Avatar>
      </div>

      {/* Caller info */}
      <div className="text-center mb-8 space-y-1">
        <p className="text-sm text-muted-foreground">
          {mode === "video" ? "Video call" : "Audio call"}
        </p>
        <h1 className="text-2xl font-semibold text-foreground">
          {callerName}
        </h1>
        <p className="text-sm text-muted-foreground">is calling you</p>
      </div>

      {/* Device status */}
      {!checkingPermissions && (
        <div className="flex items-center gap-3 mb-8">
          <div className={cn(
            "flex items-center gap-1.5 px-3 py-1 rounded-full text-xs",
            isMicReady
              ? "bg-success/10 text-success"
              : "bg-destructive/10 text-destructive"
          )}>
            {isMicReady ? <Mic className="h-3 w-3" /> : <MicOff className="h-3 w-3" />}
            {isMicReady ? "Mic ready" : "No mic"}
          </div>
          {mode === "video" && (
            <div className={cn(
              "flex items-center gap-1.5 px-3 py-1 rounded-full text-xs",
              isCameraReady
                ? "bg-success/10 text-success"
                : "bg-destructive/10 text-destructive"
            )}>
              {isCameraReady ? <Video className="h-3 w-3" /> : <VideoOff className="h-3 w-3" />}
              {isCameraReady ? "Camera ready" : "No camera"}
            </div>
          )}
        </div>
      )}

      {permissionError && (
        <p className="text-xs text-destructive mb-6 text-center max-w-xs">{permissionError}</p>
      )}

      {/* Actions */}
      <div className="flex items-center gap-6">
        <div className="flex flex-col items-center gap-2">
          <button
            onClick={onDecline}
            disabled={joining}
            className="h-16 w-16 rounded-full bg-destructive hover:bg-destructive/90 flex items-center justify-center shadow-lg transition-colors disabled:opacity-50"
          >
            <Phone className="h-7 w-7 text-white rotate-[135deg]" />
          </button>
          <span className="text-xs text-muted-foreground">Decline</span>
        </div>

        <div className="flex flex-col items-center gap-2">
          <button
            onClick={() => canJoin && onJoin("Guest")}
            disabled={!canJoin}
            className={cn(
              "h-16 w-16 rounded-full flex items-center justify-center shadow-lg transition-colors",
              canJoin
                ? "bg-success hover:bg-success/90"
                : "bg-muted cursor-not-allowed"
            )}
          >
            {joining || checkingPermissions ? (
              <Loader2 className="h-7 w-7 text-white animate-spin" />
            ) : mode === "video" ? (
              <Video className="h-7 w-7 text-white" />
            ) : (
              <Phone className="h-7 w-7 text-white" />
            )}
          </button>
          <span className="text-xs text-muted-foreground">
            {joining ? "Joining..." : "Answer"}
          </span>
        </div>
      </div>
    </div>
  )
}
