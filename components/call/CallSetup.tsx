"use client"

import { useState, useEffect, useRef } from "react"
import { Mic, MicOff, Video, VideoOff } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { cn } from "@/lib/utils"

interface CallSetupProps {
  mode: "audio" | "video"
  isAuthenticated: boolean
  userName?: string
  onJoin: (displayName: string) => void
  onCancel: () => void
  joining?: boolean
}

export function CallSetup({
  mode,
  isAuthenticated,
  userName,
  onJoin,
  onCancel,
  joining = false,
}: CallSetupProps) {
  const [guestName, setGuestName] = useState("")
  const [isMicReady, setIsMicReady] = useState(false)
  const [isCameraReady, setIsCameraReady] = useState(false)
  const [micError, setMicError] = useState<string | null>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)

  const displayName = isAuthenticated ? (userName || "User") : guestName

  useEffect(() => {
    checkPermissions()
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop())
      }
    }
  }, [mode])

  async function checkPermissions() {
    try {
      const constraints: MediaStreamConstraints = {
        audio: true,
        video: mode === "video",
      }
      const stream = await navigator.mediaDevices.getUserMedia(constraints)
      streamRef.current = stream

      setIsMicReady(true)
      if (mode === "video") {
        setIsCameraReady(true)
        if (videoRef.current) {
          videoRef.current.srcObject = stream
        }
      }
    } catch (err: any) {
      console.error("[CallSetup] Permission error:", err)
      setMicError(err.message || "Could not access microphone")
    }
  }

  const canJoin = displayName.trim().length > 0 && isMicReady && !joining

  const initials = displayName
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2) || "?"

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-background p-6">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center">
          <h1 className="text-xl font-semibold text-foreground">
            {mode === "video" ? "Join Video Call" : "Join Audio Call"}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Check your devices before joining
          </p>
        </div>

        {/* Camera preview or avatar */}
        <div className="flex justify-center">
          {mode === "video" && isCameraReady ? (
            <div className="w-48 h-36 rounded-xl bg-[#1a1a1a] overflow-hidden relative">
              <video
                ref={videoRef}
                autoPlay
                muted
                playsInline
                className="w-full h-full object-cover mirror"
              />
            </div>
          ) : (
            <Avatar className="h-24 w-24">
              <AvatarFallback className="bg-secondary text-foreground text-3xl">
                {initials}
              </AvatarFallback>
            </Avatar>
          )}
        </div>

        {/* Device status indicators */}
        <div className="flex justify-center gap-4">
          <div className={cn(
            "flex items-center gap-2 px-3 py-1.5 rounded-full text-sm",
            isMicReady ? "bg-primary/10 text-primary" : "bg-destructive/10 text-destructive"
          )}>
            {isMicReady ? <Mic className="h-4 w-4" /> : <MicOff className="h-4 w-4" />}
            <span className="text-xs">{isMicReady ? "Mic ready" : "No mic"}</span>
          </div>
          {mode === "video" && (
            <div className={cn(
              "flex items-center gap-2 px-3 py-1.5 rounded-full text-sm",
              isCameraReady ? "bg-info/10 text-info" : "bg-destructive/10 text-destructive"
            )}>
              {isCameraReady ? <Video className="h-4 w-4" /> : <VideoOff className="h-4 w-4" />}
              <span className="text-xs">{isCameraReady ? "Camera ready" : "No camera"}</span>
            </div>
          )}
        </div>

        {micError && (
          <p className="text-sm text-destructive text-center">{micError}</p>
        )}

        {/* Guest name input */}
        {!isAuthenticated && (
          <div>
            <label className="text-sm font-medium text-foreground mb-1.5 block">
              Your name
            </label>
            <Input
              value={guestName}
              onChange={(e) => setGuestName(e.target.value)}
              placeholder="Enter your name to join"
              className="text-center"
              autoFocus
            />
          </div>
        )}

        {/* Join / Cancel */}
        <div className="flex gap-3">
          <Button variant="outline" onClick={onCancel} className="flex-1">
            Cancel
          </Button>
          <Button
            onClick={() => onJoin(displayName)}
            disabled={!canJoin}
            className="flex-1"
          >
            {joining ? "Joining..." : "Join Call"}
          </Button>
        </div>
      </div>
    </div>
  )
}
