"use client"

import { useState, useEffect, useRef } from "react"
import { Phone, Video, Mic, MicOff, VideoOff, Loader2 } from "lucide-react"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Logo } from "@/components/ui/logo"
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
    <div className="min-h-screen bg-gradient-to-b from-background to-secondary/30 flex flex-col items-center justify-center p-6">

      {/* Logo */}
      <div className="mb-10">
        <Logo variant="full" className="h-7 w-auto opacity-80" />
      </div>

      {/* Card */}
      <div className="w-full max-w-sm bg-card border border-border rounded-2xl shadow-xl overflow-hidden">

        {/* Header band */}
        <div className="bg-primary/5 border-b border-border px-6 py-4 text-center">
          <p className="text-xs font-medium text-muted-foreground tracking-wide uppercase">
            {mode === "video" ? "Video call invitation" : "Audio call invitation"}
          </p>
        </div>

        {/* Avatar + caller name */}
        <div className="flex flex-col items-center px-6 pt-8 pb-6">
          {/* Pulsing avatar */}
          <div className="relative flex items-center justify-center mb-5">
            <span className="absolute inline-flex h-24 w-24 rounded-full bg-primary/8 animate-ping" />
            <span className="absolute inline-flex h-18 w-18 rounded-full bg-primary/12 animate-ping [animation-delay:0.4s]" />
            <Avatar className="relative h-18 w-18 z-10 shadow-md ring-4 ring-card"
              style={{ width: "4.5rem", height: "4.5rem" }}>
              <AvatarFallback className="bg-primary text-primary-foreground text-xl font-bold">
                {initials}
              </AvatarFallback>
            </Avatar>
          </div>

          <h2 className="text-xl font-semibold text-foreground">{callerName}</h2>
          <p className="text-sm text-muted-foreground mt-1">invites you to a call</p>

          {/* Device status pills */}
          {!checkingPermissions && (
            <div className="flex items-center gap-2 mt-4">
              <span className={cn(
                "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium",
                isMicReady
                  ? "bg-success/10 text-success"
                  : "bg-destructive/10 text-destructive"
              )}>
                {isMicReady ? <Mic className="h-3 w-3" /> : <MicOff className="h-3 w-3" />}
                {isMicReady ? "Mic ready" : "No mic"}
              </span>
              {mode === "video" && (
                <span className={cn(
                  "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium",
                  isCameraReady
                    ? "bg-success/10 text-success"
                    : "bg-destructive/10 text-destructive"
                )}>
                  {isCameraReady ? <Video className="h-3 w-3" /> : <VideoOff className="h-3 w-3" />}
                  {isCameraReady ? "Camera ready" : "No camera"}
                </span>
              )}
            </div>
          )}

          {permissionError && (
            <p className="text-xs text-destructive text-center mt-3 max-w-xs">{permissionError}</p>
          )}
        </div>

        {/* Action buttons */}
        <div className="grid grid-cols-2 divide-x divide-border border-t border-border">
          <button
            onClick={onDecline}
            disabled={joining}
            className="flex flex-col items-center gap-1.5 py-4 hover:bg-destructive/5 transition-colors disabled:opacity-50"
          >
            <div className="h-11 w-11 rounded-full bg-destructive/10 flex items-center justify-center">
              <Phone className="h-5 w-5 text-destructive rotate-[135deg]" />
            </div>
            <span className="text-xs font-medium text-destructive">Decline</span>
          </button>

          <button
            onClick={() => canJoin && onJoin("Guest")}
            disabled={!canJoin}
            className={cn(
              "flex flex-col items-center gap-1.5 py-4 transition-colors",
              canJoin
                ? "hover:bg-success/5"
                : "opacity-50 cursor-not-allowed"
            )}
          >
            <div className={cn(
              "h-11 w-11 rounded-full flex items-center justify-center",
              canJoin ? "bg-success/10" : "bg-muted"
            )}>
              {joining || checkingPermissions ? (
                <Loader2 className="h-5 w-5 text-success animate-spin" />
              ) : mode === "video" ? (
                <Video className="h-5 w-5 text-success" />
              ) : (
                <Phone className="h-5 w-5 text-success" />
              )}
            </div>
            <span className="text-xs font-medium text-success">
              {joining ? "Joining..." : "Join"}
            </span>
          </button>
        </div>
      </div>

      {/* Powered by */}
      <p className="mt-8 text-xs text-muted-foreground/50">
        Secured by Notissima
      </p>
    </div>
  )
}
