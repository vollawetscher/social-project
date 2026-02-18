"use client"

import { useState, useEffect, useCallback } from "react"
import { useParams, useSearchParams, useRouter } from "next/navigation"
import { useAuth } from "@/lib/auth/AuthProvider"
import { CallSetup } from "@/components/call/CallSetup"
import { CallRoom } from "@/components/call/CallRoom"
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

  const [phase, setPhase] = useState<"loading" | "setup" | "joining" | "active" | "error">("loading")
  const [callId, setCallId] = useState<string | null>(callIdParam)
  const [token, setToken] = useState<string | null>(tokenParam)
  const [callType, setCallType] = useState<"web" | "pstn_outbound">("web")
  const [contactName, setContactName] = useState<string | undefined>()
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (authLoading) return

    if (tokenParam && callIdParam) {
      setPhase("active")
      return
    }

    if (callIdParam) {
      fetchCallDetails(callIdParam)
    } else {
      setPhase("setup")
    }
  }, [authLoading, callIdParam, tokenParam])

  async function fetchCallDetails(id: string) {
    try {
      const res = await fetch(`/api/calls/${id}`)
      if (!res.ok) throw new Error("Call not found")
      const data = await res.json()
      setCallType(data.call_type)
      setContactName(data.participant_b_identity || data.phone_number || undefined)
      setPhase("setup")
    } catch (err: any) {
      setError(err.message || "Failed to load call")
      setPhase("error")
    }
  }

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
      setPhase("active")
    } catch (err: any) {
      setError(err.message || "Failed to join call")
      setPhase("error")
    }
  }, [callId, token])

  const handleLeave = useCallback(() => {
    if (user) {
      router.push("/calls")
    } else {
      setPhase("setup")
    }
  }, [user, router])

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
            onClick={() => user ? router.push("/calls") : router.push("/")}
            className="text-sm text-primary hover:underline"
          >
            Go back
          </button>
        </div>
      </div>
    )
  }

  if (phase === "setup" || phase === "joining") {
    return (
      <CallSetup
        mode={modeParam}
        isAuthenticated={!!user}
        userName={user?.user_metadata?.full_name || user?.email?.split("@")[0]}
        onJoin={handleJoin}
        onCancel={() => user ? router.push("/calls") : router.push("/")}
        joining={phase === "joining"}
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
      onLeave={handleLeave}
    />
  )
}
