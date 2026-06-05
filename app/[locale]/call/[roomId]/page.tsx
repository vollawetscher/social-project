"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { useTranslations } from "next-intl"
import { useParams, useSearchParams } from "next/navigation"
import { useRouter } from "@/i18n/navigation"
import { useAuth } from "@/lib/auth/AuthProvider"
import { CallSetup } from "@/components/call/CallSetup"
import { IncomingCall } from "@/components/call/IncomingCall"
import { CallRoom } from "@/components/call/CallRoom"
import { CallEndedSignup } from "@/components/call/CallEndedSignup"
import { Loader2 } from "lucide-react"
import type { CallMode } from "@/lib/types/call"
import type { PstnTranscriptionMode } from "@/lib/types/call"
import {
  clearCallSession,
  loadCallSession,
  saveCallSession,
  type StoredCallPhase,
} from "@/lib/utils/call-session-storage"

const LIVEKIT_URL = process.env.NEXT_PUBLIC_LIVEKIT_URL || ""

function readStoredSession(roomId: string) {
  if (typeof window === "undefined" || !roomId) return null
  const stored = loadCallSession(roomId)
  if (!stored || stored.roomName !== roomId) return null
  return stored
}

export default function CallRoomPage() {
  const tCallRoom = useTranslations('callRoom')
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
  const transcriptionModeParam = (searchParams?.get("transcriptionMode") as PstnTranscriptionMode) || "batch"
  const ringPhoneParam = searchParams?.get("ringPhone") || null
  const ringCallerNameParam = searchParams?.get("ringCallerName") || null
  const ringContactNameParam = searchParams?.get("ringContactName") || null
  // `init=1` is set by navigators that already know the user is the initiator
  // (call creation, scheduled-call rejoin from the banner). For navigators that
  // don't yet know — link recipients hitting the setup page — `isInitiator`
  // gets refined later from the token endpoint response.
  const initParam = searchParams?.get("init") === "1"

  const storedSessionRef = useRef<ReturnType<typeof readStoredSession> | null>(null)
  if (storedSessionRef.current === null) {
    storedSessionRef.current = readStoredSession(roomId)
  }
  const storedSession = storedSessionRef.current

  const [phase, setPhase] = useState<"loading" | "setup" | "incoming" | "joining" | "consent" | "active" | "ended" | "error">(() => {
    if (tokenParam && callIdParam) return "active"
    if (storedSession) return storedSession.phase === "consent" ? "consent" : "active"
    return "loading"
  })
  const [callId, setCallId] = useState<string | null>(() => callIdParam ?? storedSession?.callId ?? null)
  const [token, setToken] = useState<string | null>(() => tokenParam ?? storedSession?.token ?? null)
  const [callType, setCallType] = useState<"web" | "pstn_outbound">(callTypeParam)
  const [pstnTranscriptionMode, setPstnTranscriptionMode] = useState<PstnTranscriptionMode>(transcriptionModeParam)
  const [contactName, setContactName] = useState<string | undefined>()
  const [callerName, setCallerName] = useState<string>("Someone")
  const [joinDisplayName, setJoinDisplayName] = useState<string>("Guest")
  const [participantIdentity, setParticipantIdentity] = useState<string | null>(
    () => storedSession?.participantIdentity ?? null,
  )
  const [error, setError] = useState<string | null>(null)
  const [isInitiator, setIsInitiator] = useState<boolean>(() => initParam || storedSession?.isInitiator === true)
  const phaseRef = useRef(phase)
  phaseRef.current = phase

  useEffect(() => {
    if (!participantIdentity && !authLoading) {
      setParticipantIdentity(user?.id || `guest-${Date.now()}`)
    }
  }, [authLoading, participantIdentity, user?.id])

  useEffect(() => {
    if (authLoading) return

    // Auth refresh re-runs this effect — never demote an active in-call session.
    if (phaseRef.current === "active" || phaseRef.current === "consent" || phaseRef.current === "joining") {
      return
    }

    if (tokenParam && callIdParam) {
      setPhase("active")
      return
    }

    // Resolve callId from room name when not in the URL (e.g., rejoin from banner)
    async function resolveAndContinue() {
      let resolvedCallId = callIdParam ?? storedSession?.callId ?? null

      if (!resolvedCallId && user?.id) {
        try {
          const res = await fetch(`/api/calls/active`)
          if (res.ok) {
            const data = await res.json()
            if (data.active && data.call?.roomName === roomId) {
              resolvedCallId = data.call.id
              setCallId(resolvedCallId)
            }
          }
        } catch {
          // fallback: no callId
        }
      }

      if (user?.id) {
        if (!resolvedCallId) {
          setError("This call has ended or is no longer available.")
          setPhase("error")
          return
        }
        setPhase("setup")
        return
      }

      // Guest: fetch caller info, then show incoming call banner
      if (resolvedCallId) {
        try {
          const res = await fetch(`/api/calls/${resolvedCallId}/info`)
          if (res.ok) {
            const data = await res.json()
            setCallerName(data.callerName || "Someone")
            if (data.callType) setCallType(data.callType)
            if (data.pstnTranscriptionMode === "live" || data.pstnTranscriptionMode === "batch") {
              setPstnTranscriptionMode(data.pstnTranscriptionMode)
            }
          }
        } catch {
          // silently ignore — fall back to "Someone"
        }
      }
      setPhase("incoming")
    }

    resolveAndContinue()
  }, [authLoading, callIdParam, tokenParam, user?.id, roomId])

  useEffect(() => {
    if ((phase !== "active" && phase !== "consent") || !token || !callId || !roomId) return
    saveCallSession(roomId, {
      token,
      callId,
      roomName: roomId,
      phase: phase as StoredCallPhase,
      isInitiator,
      participantIdentity,
    })
  }, [phase, token, callId, roomId, isInitiator, participantIdentity])

  const handleJoin = useCallback(async (displayName: string) => {
    setPhase("joining")
    setJoinDisplayName(displayName || "Guest")
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
      if (typeof data.participantIdentity === 'string') {
        setParticipantIdentity(data.participantIdentity)
      }
      // The token endpoint is the authoritative source for initiator status
      // when the user arrives without a pre-issued token in the URL.
      if (typeof data.isInitiator === "boolean") {
        setIsInitiator(data.isInitiator)
      }

      // Non-initiators must explicitly confirm consent before joining.
      // This applies to both audio and video joins in the browser.
      const needsJoinConsent = !tokenParam
      setPhase(needsJoinConsent ? "consent" : "active")
    } catch (err: any) {
      setError(err.message || "Failed to join call")
      setPhase("error")
    }
  }, [callId, token, tokenParam, user?.id, modeParam])

  const handleLeave = useCallback(async () => {
    clearCallSession(roomId)
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
  }, [user, tokenParam, callId, router, roomId])

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
            onClick={() => router.push(user ? "/sessions" : "/")}
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

  if (phase === "consent") {
    const handleConsent = async (granted: boolean) => {
      // Await the consent POST so the DB row exists before we join LiveKit.
      // This prevents a race where the initiator sees hasRemote=true but
      // remoteConsents is still empty, causing a "Consent Pending" flash.
      if (callId) {
        await fetch(`/api/calls/${callId}/consent`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            granted,
            participantName: joinDisplayName,
            participantIdentity: participantIdentity || user?.id || `guest-${Date.now()}`,
          }),
        }).catch(() => {})
      }
      if (granted) {
        setPhase("active")
      } else {
        // Declined — switch to caller-only recording after connecting
        setPhase("active")
        setTimeout(() => {
          if (callId) {
            fetch(`/api/calls/${callId}/switch-egress`, { method: "POST" }).catch(() => {})
          }
        }, 3000)
      }
    }

    return (
      <AudioConsentGate
        prompt={tCallRoom('consentPrompt')}
        agreeLabel={tCallRoom('consentAgree')}
        declineLabel={tCallRoom('consentDecline')}
        onAgree={() => handleConsent(true)}
        onDecline={() => handleConsent(false)}
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
      pstnTranscriptionMode={pstnTranscriptionMode}
      contactName={contactName}
      contactPhone={phoneParam || undefined}
      displayName={user?.user_metadata?.full_name || user?.email?.split("@")[0]}
      isInitiator={isInitiator}
      onLeave={handleLeave}
      ringSmsParams={ringPhoneParam ? {
        phoneNumber: ringPhoneParam,
        callerName: ringCallerNameParam || "Someone",
        contactName: ringContactNameParam || undefined,
      } : undefined}
    />
  )
}

function AudioConsentGate({
  prompt,
  agreeLabel,
  declineLabel,
  onAgree,
  onDecline,
}: {
  prompt: string
  agreeLabel: string
  declineLabel: string
  onAgree: () => void
  onDecline: () => void
}) {
  return (
    <div className="flex items-center justify-center h-[100dvh] bg-background p-6">
      <div className="w-full max-w-sm text-center space-y-5">
        <p className="text-base text-foreground">{prompt}</p>
        <div className="flex gap-3">
          <button
            onClick={onAgree}
            className="flex-1 py-2.5 rounded-lg bg-primary text-primary-foreground font-medium text-sm hover:bg-primary/90 transition-colors"
          >
            {agreeLabel}
          </button>
          <button
            onClick={onDecline}
            className="flex-1 py-2.5 rounded-lg border border-border text-foreground font-medium text-sm hover:bg-secondary transition-colors"
          >
            {declineLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
