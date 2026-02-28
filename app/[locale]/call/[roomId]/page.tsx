"use client"

import { useState, useEffect, useCallback } from "react"
import { useParams, useSearchParams } from "next/navigation"
import { useRouter } from "@/i18n/navigation"
import { useAuth } from "@/lib/auth/AuthProvider"
import { CallSetup } from "@/components/call/CallSetup"
import { IncomingCall } from "@/components/call/IncomingCall"
import { CallRoom } from "@/components/call/CallRoom"
import { CallEndedSignup } from "@/components/call/CallEndedSignup"
import { Loader2 } from "lucide-react"
import type { CallMode } from "@/lib/types/call"

const LIVEKIT_URL = process.env.NEXT_PUBLIC_LIVEKIT_URL || ""

export default function CallRoomPage() {
  const params = useParams()
  const searchParams = useSearchParams()
  const router = useRouter()
  const { user, loading: authLoading } = useAuth()

  const roomId = params?.roomId as string
  const callIdParam = searchParams?.get("callId") || null
  const tokenParam = searchParams?.get("token") || null
  const modeParam = (searchParams?.get("mode") as CallMode) || "video"
  const phoneParam = searchParams?.get("phone") || null
  const callTypeParam = (searchParams?.get("callType") as "web" | "pstn_outbound") || "web"
  const ringPhoneParam = searchParams?.get("ringPhone") || null
  const ringCallerNameParam = searchParams?.get("ringCallerName") || null
  const ringContactNameParam = searchParams?.get("ringContactName") || null

  const [phase, setPhase] = useState<"loading" | "setup" | "incoming" | "joining" | "active" | "ended" | "error">("loading")
  const [callId, setCallId] = useState<string | null>(callIdParam)
  const [token, setToken] = useState<string | null>(tokenParam)
  const [callType, setCallType] = useState<"web" | "pstn_outbound">(callTypeParam)
  const [contactName, setContactName] = useState<string | undefined>()
  const [callerName, setCallerName] = useState<string>("Someone")
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (authLoading) return

    // Authenticated user with token = go straight to active
    if (tokenParam && callIdParam) {
      setPhase("active")
      return
    }

    if (user) {
      // Logged-in user joining as second participant (no token)
      setPhase("setup")
      return
    }

    // Guest: fetch caller info, then show incoming call banner
    async function fetchCallerInfo() {
      if (callIdParam) {
        try {
          const res = await fetch(`/api/calls/${callIdParam}/info`)
          if (res.ok) {
            const data = await res.json()
            setCallerName(data.callerName || "Someone")
          }
        } catch {
          // silently ignore -- fall back to "Someone"
        }
      }
      setPhase("incoming")
    }

    fetchCallerInfo()
  }, [authLoading, callIdParam, tokenParam, user])

  const handleJoin = useCallback(async (displayName: string) => {
    setPhase("joining")
    try {
      if (token) {
        setPhase("active")
        return
      }

      const endpoint = callId ? `/api/calls/${callId}/token` : null
      if (!endpoint) {
        throw new Error("No call ID available. Cannot join.")
      }

      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ participantName: displayName }),
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || "Failed to get access token")
      }

      const data = await res.json()
      setToken(data.token)

      // Log callee/guest consent at join time so caller can see status in-room.
      if (!tokenParam && callId) {
        fetch(`/api/calls/${callId}/consent`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            granted: true,
            participantName: displayName || "Guest",
            participantIdentity: user?.id || `guest-${Date.now()}`,
          }),
        }).catch(() => {})
      }

      setPhase("active")
    } catch (err: any) {
      setError(err.message || "Failed to join call")
      setPhase("error")
    }
  }, [callId, token, tokenParam, user?.id])

  const handleLeave = useCallback(async () => {
    if (user) {
      // If this authenticated user is the callee (no tokenParam = they didn't create the call),
      // auto-claim the call to fork a session for them.
      if (!tokenParam && callId) {
        try {
          await fetch(`/api/calls/${callId}/claim`, { method: "POST" })
        } catch {
          // Non-fatal — they can still navigate to their sessions
        }
      }
      router.push("/sessions")
    } else {
      // Guest: show sign-up screen to convert them into a trial user
      setPhase("ended")
    }
  }, [user, tokenParam, callId, router])

  if (phase === "loading" || authLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Loading call...</p>
        </div>
      </div>
    )
  }

  if (phase === "error") {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="flex flex-col items-center gap-4 text-center p-6">
          <p className="text-lg font-medium text-foreground">Unable to join call</p>
          <p className="text-sm text-muted-foreground max-w-sm">{error}</p>
          <button
            onClick={() => router.push("/")}
            className="text-sm text-primary hover:underline"
          >
            Go back
          </button>
        </div>
      </div>
    )
  }

  // Guest: show incoming call UI (no name entry)
  if (phase === "incoming" || (phase === "joining" && !user)) {
    return (
      <IncomingCall
        callerName={callerName}
        mode={modeParam}
        onJoin={handleJoin}
        onDecline={() => router.push("/")}
        joining={phase === "joining"}
      />
    )
  }

  // Authenticated user without token: show setup (device check)
  if (phase === "setup" || (phase === "joining" && user)) {
    return (
      <CallSetup
        mode={modeParam}
        isAuthenticated={!!user}
        userName={user?.user_metadata?.full_name || user?.email?.split("@")[0]}
        onJoin={handleJoin}
        onCancel={() => router.push("/calls")}
        joining={phase === "joining"}
      />
    )
  }

  // Guest post-call: offer account creation to claim their session
  if (phase === "ended") {
    return (
      <CallEndedSignup
        callerName={callerName}
        callId={callId || ""}
      />
    )
  }

  if (!token || !LIVEKIT_URL) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <p className="text-sm text-destructive">
          {!LIVEKIT_URL ? "NEXT_PUBLIC_LIVEKIT_URL is not configured" : "No access token"}
        </p>
      </div>
    )
  }

  return (
    <CallRoom
      roomName={roomId}
      callId={callId || ""}
      token={token}
      serverUrl={LIVEKIT_URL}
      mode={modeParam}
      callType={callType}
      contactName={contactName}
      contactPhone={phoneParam || undefined}
      displayName={user?.user_metadata?.full_name || user?.email?.split("@")[0]}
      isInitiator={!!tokenParam}
      onLeave={handleLeave}
      ringSmsParams={ringPhoneParam ? {
        phoneNumber: ringPhoneParam,
        callerName: ringCallerNameParam || "Someone",
        contactName: ringContactNameParam || undefined,
      } : undefined}
    />
  )
}
