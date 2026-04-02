"use client"

import { useState, useEffect, useCallback } from "react"
import { useParams } from "next/navigation"
import { useRouter } from "@/i18n/navigation"
import { useTranslations } from "next-intl"
import { useAuth } from "@/lib/auth/AuthProvider"
import { CallSetup } from "@/components/call/CallSetup"
import { CallRoom } from "@/components/call/CallRoom"
import { CallEndedSignup } from "@/components/call/CallEndedSignup"
import { Loader2, Video, User as UserIcon } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"

const LIVEKIT_URL = process.env.NEXT_PUBLIC_LIVEKIT_URL || ""

type Phase = "loading" | "lobby" | "setup" | "joining" | "consent" | "active" | "ended" | "error" | "not_found"

interface OwnerInfo {
  ownerId: string
  displayName: string
  slug: string
}

export default function MeetPage() {
  const params = useParams()
  const router = useRouter()
  const t = useTranslations("meet")
  const tCallRoom = useTranslations("callRoom")
  const { user } = useAuth()

  const slug = params?.slug as string

  const [phase, setPhase] = useState<Phase>("loading")
  const [ownerInfo, setOwnerInfo] = useState<OwnerInfo | null>(null)
  const [visitorName, setVisitorName] = useState("")
  const [visitorEmail, setVisitorEmail] = useState("")
  const [callId, setCallId] = useState<string | null>(null)
  const [roomName, setRoomName] = useState<string | null>(null)
  const [token, setToken] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function resolveSlug() {
      try {
        const res = await fetch(`/api/meet/${encodeURIComponent(slug)}`)
        if (res.status === 404) {
          setPhase("not_found")
          return
        }
        if (!res.ok) {
          setError("Failed to load meeting room")
          setPhase("error")
          return
        }
        const data: OwnerInfo = await res.json()
        setOwnerInfo(data)

        // If the visitor is the owner, skip lobby and go to setup
        if (user?.id === data.ownerId) {
          setVisitorName(data.displayName)
          setPhase("setup")
          return
        }

        setPhase("lobby")
      } catch {
        setError("Failed to load meeting room")
        setPhase("error")
      }
    }

    if (slug) resolveSlug()
  }, [slug, user?.id])

  const handleJoinLobby = () => {
    if (!visitorName.trim()) return
    setPhase("setup")
  }

  const handleJoinCall = useCallback(async () => {
    setPhase("joining")
    try {
      const isOwner = user?.id === ownerInfo?.ownerId
      const res = await fetch(`/api/meet/${encodeURIComponent(slug)}/join`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          visitorName: visitorName.trim() || "Guest",
          visitorEmail: visitorEmail.trim() || null,
          isOwner,
        }),
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || "Failed to join meeting")
      }

      const data = await res.json()
      setCallId(data.callId)
      setRoomName(data.roomName)
      setToken(data.token)

      // Guests go through consent first
      if (!user) {
        setPhase("consent")
      } else {
        setPhase("active")
      }
    } catch (err: any) {
      setError(err.message || "Failed to join meeting")
      setPhase("error")
    }
  }, [slug, visitorName, visitorEmail, user])

  const handleLeave = useCallback(async () => {
    if (user) {
      if (callId) {
        try {
          await fetch(`/api/calls/${callId}/claim`, { method: "POST" })
        } catch {
          // Non-fatal
        }
      }
      router.push("/sessions")
    } else {
      setPhase("ended")
    }
  }, [user, callId, router])

  if (phase === "loading") {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          <p className="text-sm text-muted-foreground">{t("loading")}</p>
        </div>
      </div>
    )
  }

  if (phase === "not_found") {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="flex flex-col items-center gap-4 text-center p-6">
          <Video className="h-12 w-12 text-muted-foreground" />
          <p className="text-lg font-medium text-foreground">{t("notFound")}</p>
          <p className="text-sm text-muted-foreground max-w-sm">{t("notFoundHint")}</p>
          <button
            onClick={() => router.push("/")}
            className="text-sm text-primary hover:underline"
          >
            {t("goHome")}
          </button>
        </div>
      </div>
    )
  }

  if (phase === "error") {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="flex flex-col items-center gap-4 text-center p-6">
          <p className="text-lg font-medium text-foreground">{t("error")}</p>
          <p className="text-sm text-muted-foreground max-w-sm">{error}</p>
          <button
            onClick={() => setPhase("lobby")}
            className="text-sm text-primary hover:underline"
          >
            {t("tryAgain")}
          </button>
        </div>
      </div>
    )
  }

  if (phase === "lobby") {
    const ownerInitials = (ownerInfo?.displayName || "H")
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2)

    return (
      <div className="flex items-center justify-center min-h-screen bg-background p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="flex justify-center mb-4">
              <Avatar className="h-20 w-20">
                <AvatarFallback className="text-2xl bg-primary text-primary-foreground">
                  {ownerInitials}
                </AvatarFallback>
              </Avatar>
            </div>
            <CardTitle className="text-xl">
              {t("joinTitle", { name: ownerInfo?.displayName || "Host" })}
            </CardTitle>
            <CardDescription>
              {t("joinSubtitle")}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">
                {t("yourName")} *
              </label>
              <div className="relative">
                <UserIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder={t("namePlaceholder")}
                  value={visitorName}
                  onChange={(e) => setVisitorName(e.target.value)}
                  className="pl-9"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleJoinLobby()
                  }}
                  autoFocus
                />
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">
                {t("yourEmail")}
              </label>
              <Input
                type="email"
                placeholder={t("emailPlaceholder")}
                value={visitorEmail}
                onChange={(e) => setVisitorEmail(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleJoinLobby()
                }}
              />
              <p className="text-xs text-muted-foreground">{t("emailHint")}</p>
            </div>
            <Button
              onClick={handleJoinLobby}
              className="w-full"
              size="lg"
              disabled={!visitorName.trim()}
            >
              <Video className="h-4 w-4 mr-2" />
              {t("continue")}
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (phase === "setup" || phase === "joining") {
    return (
      <CallSetup
        mode="video"
        isAuthenticated={true}
        userName={visitorName || user?.user_metadata?.full_name || user?.email?.split("@")[0]}
        onJoin={handleJoinCall}
        onCancel={() => {
          if (user?.id === ownerInfo?.ownerId) {
            router.push("/calls")
          } else {
            setPhase("lobby")
          }
        }}
        joining={phase === "joining"}
      />
    )
  }

  if (phase === "ended") {
    return (
      <CallEndedSignup
        callerName={ownerInfo?.displayName || "Host"}
        callId={callId || ""}
      />
    )
  }

  if (phase === "consent") {
    const handleConsent = async (granted: boolean) => {
      if (callId) {
        await fetch(`/api/calls/${callId}/consent`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            granted,
            participantName: visitorName,
            participantIdentity: `guest-${Date.now()}`,
          }),
        }).catch(() => {})
      }
      setPhase("active")
    }

    return (
      <div className="flex items-center justify-center h-[100dvh] bg-background p-6">
        <div className="w-full max-w-sm text-center space-y-5">
          <p className="text-base text-foreground">{tCallRoom("consentPrompt")}</p>
          <div className="flex gap-3">
            <button
              onClick={() => handleConsent(true)}
              className="flex-1 py-2.5 rounded-lg bg-primary text-primary-foreground font-medium text-sm hover:bg-primary/90 transition-colors"
            >
              {tCallRoom("consentAgree")}
            </button>
            <button
              onClick={() => handleConsent(false)}
              className="flex-1 py-2.5 rounded-lg border border-border text-foreground font-medium text-sm hover:bg-secondary transition-colors"
            >
              {tCallRoom("consentDecline")}
            </button>
          </div>
        </div>
      </div>
    )
  }

  if (!token || !LIVEKIT_URL || !roomName) {
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
      roomName={roomName}
      callId={callId || ""}
      token={token}
      serverUrl={LIVEKIT_URL}
      mode="video"
      callType="web"
      pstnTranscriptionMode="batch"
      displayName={visitorName || user?.user_metadata?.full_name || user?.email?.split("@")[0]}
      isInitiator={false}
      onLeave={handleLeave}
    />
  )
}
