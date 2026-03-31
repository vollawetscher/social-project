"use client"

import { useEffect, useState, useCallback, useRef } from "react"
import { usePathname } from "next/navigation"
import { useRouter } from "@/i18n/navigation"
import { useAuth } from "@/lib/auth/AuthProvider"
import { Phone, PhoneOff, ArrowRight } from "lucide-react"
import { Button } from "@/components/ui/button"

interface ActiveCall {
  id: string
  roomName: string
  callType: string
  callMode: string | null
  status: string
  contactName: string | null
  phoneNumber: string | null
  startedAt: string | null
  createdAt: string
}

const POLL_INTERVAL = 15_000

export function ActiveCallBanner() {
  const { profile } = useAuth()
  const pathname = usePathname()
  const router = useRouter()
  const [activeCall, setActiveCall] = useState<ActiveCall | null>(null)
  const [ending, setEnding] = useState(false)
  const pollRef = useRef<ReturnType<typeof setInterval>>()

  const isOnCallPage = pathname?.includes("/call/")

  const checkActiveCall = useCallback(async () => {
    if (!profile?.id) return
    try {
      const res = await fetch("/api/calls/active")
      if (!res.ok) return
      const data = await res.json()
      setActiveCall(data.active ? data.call : null)
    } catch {
      // ignore
    }
  }, [profile?.id])

  useEffect(() => {
    checkActiveCall()
    pollRef.current = setInterval(checkActiveCall, POLL_INTERVAL)
    return () => clearInterval(pollRef.current)
  }, [checkActiveCall])

  const handleRejoin = () => {
    if (!activeCall) return
    router.push(`/call/${activeCall.roomName}`)
  }

  const handleEnd = async () => {
    if (!activeCall) return
    setEnding(true)
    try {
      await fetch(`/api/calls/${activeCall.id}/end`, { method: "POST" })
      setActiveCall(null)
    } catch {
      // ignore
    } finally {
      setEnding(false)
    }
  }

  if (!activeCall || isOnCallPage) return null

  const label = activeCall.contactName
    || activeCall.phoneNumber
    || (activeCall.callMode === "video" ? "Video call" : "Call")

  const elapsed = activeCall.startedAt
    ? Math.floor((Date.now() - new Date(activeCall.startedAt).getTime()) / 1000)
    : 0
  const minutes = Math.floor(elapsed / 60)
  const seconds = elapsed % 60
  const duration = elapsed > 0
    ? `${minutes}:${seconds.toString().padStart(2, "0")}`
    : null

  return (
    <div className="fixed top-0 left-0 right-0 z-50 bg-emerald-600 text-white shadow-lg">
      <div className="mx-auto max-w-screen-xl flex items-center justify-between px-4 py-2">
        <div className="flex items-center gap-3 min-w-0">
          <div className="shrink-0 rounded-full bg-white/20 p-1.5 animate-pulse">
            <Phone className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium truncate">{label}</p>
            {duration && (
              <p className="text-xs text-white/70">{duration}</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Button
            size="sm"
            variant="ghost"
            className="h-8 text-xs gap-1.5 text-white hover:bg-white/20 hover:text-white"
            onClick={handleRejoin}
          >
            Rejoin
            <ArrowRight className="h-3.5 w-3.5" />
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="h-8 text-xs gap-1.5 text-white hover:bg-red-500/80 hover:text-white"
            onClick={handleEnd}
            disabled={ending}
          >
            <PhoneOff className="h-3.5 w-3.5" />
            End
          </Button>
        </div>
      </div>
    </div>
  )
}
