"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { usePathname } from "next/navigation"
import { useTranslations } from "next-intl"
import { useRouter } from "@/i18n/navigation"
import { useAuth } from "@/lib/auth/AuthProvider"
import { createClient as createSupabaseClient } from "@/lib/supabase/client"
import type { Call } from "@/lib/types/call"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"

function useIncomingRingtone(playing: boolean) {
  const ctxRef = useRef<AudioContext | null>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const vibrateTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const stop = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
    if (vibrateTimerRef.current) {
      clearInterval(vibrateTimerRef.current)
      vibrateTimerRef.current = null
    }
    if (typeof navigator !== "undefined" && "vibrate" in navigator) {
      navigator.vibrate(0)
    }
    if (ctxRef.current) {
      ctxRef.current.close().catch(() => {})
      ctxRef.current = null
    }
  }, [])

  const scheduleRing = useCallback((ctx: AudioContext) => {
    const now = ctx.currentTime
    for (const freq of [520, 650]) {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.type = "sine"
      osc.frequency.value = freq
      gain.gain.setValueAtTime(0, now)
      gain.gain.linearRampToValueAtTime(0.05, now + 0.05)
      gain.gain.setValueAtTime(0.05, now + 0.3)
      gain.gain.linearRampToValueAtTime(0, now + 0.38)
      osc.start(now)
      osc.stop(now + 0.38)
    }
    timerRef.current = setTimeout(() => {
      if (ctxRef.current) scheduleRing(ctxRef.current)
    }, 1800)
  }, [])

  useEffect(() => {
    if (!playing) {
      stop()
      return
    }

    const startOrResume = async () => {
      try {
        if (!ctxRef.current) ctxRef.current = new AudioContext()
        const ctx = ctxRef.current
        if (ctx.state === "suspended") {
          await ctx.resume().catch(() => {})
        }
        if (ctx.state === "running" && !timerRef.current) {
          scheduleRing(ctx)
        }
      } catch {
        // Best-effort ringtone only.
      }
    }

    startOrResume()

    // Mobile autoplay policies often require user interaction before audio playback.
    const resumeOnGesture = () => { void startOrResume() }
    window.addEventListener("touchstart", resumeOnGesture, { passive: true })
    window.addEventListener("pointerdown", resumeOnGesture)
    window.addEventListener("keydown", resumeOnGesture)
    document.addEventListener("visibilitychange", resumeOnGesture)

    // Fallback haptic ring where available (e.g. Android).
    if (typeof navigator !== "undefined" && "vibrate" in navigator) {
      navigator.vibrate([250, 120, 250])
      vibrateTimerRef.current = setInterval(() => {
        navigator.vibrate([250, 120, 250])
      }, 1800)
    }

    return () => {
      window.removeEventListener("touchstart", resumeOnGesture)
      window.removeEventListener("pointerdown", resumeOnGesture)
      window.removeEventListener("keydown", resumeOnGesture)
      document.removeEventListener("visibilitychange", resumeOnGesture)
      stop()
    }
  }, [playing, scheduleRing, stop])
}

export function GlobalIncomingCallListener() {
  const { user } = useAuth()
  const router = useRouter()
  const pathname = usePathname()
  const t = useTranslations("calls")
  const [incomingInvite, setIncomingInvite] = useState<Call | null>(null)
  const [joining, setJoining] = useState(false)
  const missedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const onCallsPage = pathname?.endsWith("/calls")
  useIncomingRingtone(Boolean(incomingInvite) && !joining)

  useEffect(() => {
    if (!user?.id) return
    const supabase = createSupabaseClient()
    if (!supabase) return

    const channel = supabase
      .channel(`global-incoming-calls-${user.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "calls" }, (payload: any) => {
        const row = (payload.new || payload.old) as Call | undefined
        if (!row || row.callee_user_id !== user.id) return

        if (payload.eventType === "DELETE") {
          if (incomingInvite?.id === row.id) setIncomingInvite(null)
          return
        }

        const isFreshInvite =
          row.status === "invited" &&
          !row.accepted_at &&
          !row.declined_at &&
          !row.missed_at

        if (isFreshInvite) setIncomingInvite(row)
        else if (incomingInvite?.id === row.id) setIncomingInvite(null)
      })
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [user?.id, incomingInvite?.id])

  useEffect(() => {
    if (!incomingInvite) return
    if (missedTimerRef.current) clearTimeout(missedTimerRef.current)
    missedTimerRef.current = setTimeout(async () => {
      try {
        await fetch(`/api/calls/${incomingInvite.id}/miss`, { method: "POST" })
      } catch {
        // best-effort timeout path
      } finally {
        setIncomingInvite((curr) => (curr?.id === incomingInvite.id ? null : curr))
      }
    }, 45_000)

    return () => {
      if (missedTimerRef.current) {
        clearTimeout(missedTimerRef.current)
        missedTimerRef.current = null
      }
    }
  }, [incomingInvite])

  const acceptInvite = useCallback(async () => {
    if (!incomingInvite || joining) return
    setJoining(true)
    try {
      const res = await fetch(`/api/calls/${incomingInvite.id}/accept`, { method: "POST" })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        throw new Error(data.error || "Failed to accept call")
      }
      setIncomingInvite(null)
      router.push(`/call/${data.roomName}?callId=${data.callId}&token=${encodeURIComponent(data.token)}&mode=${data.mode || "video"}`)
    } finally {
      setJoining(false)
    }
  }, [incomingInvite, joining, router])

  const declineInvite = useCallback(async () => {
    if (!incomingInvite || joining) return
    setJoining(true)
    try {
      await fetch(`/api/calls/${incomingInvite.id}/decline`, { method: "POST" })
      setIncomingInvite(null)
    } finally {
      setJoining(false)
    }
  }, [incomingInvite, joining])

  if (onCallsPage) return null

  return (
    <Dialog open={!!incomingInvite} onOpenChange={(open) => { if (!open) setIncomingInvite(null) }}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{t("incomingCallTitle")}</DialogTitle>
          <DialogDescription>
            {(incomingInvite?.contact_name || t("incomingUnknownCaller"))} {t("incomingCallDescription")}
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-row gap-3 justify-end pt-2">
          <Button variant="outline" onClick={declineInvite} disabled={joining}>
            {t("decline")}
          </Button>
          <Button onClick={acceptInvite} disabled={joining}>
            {t("accept")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
