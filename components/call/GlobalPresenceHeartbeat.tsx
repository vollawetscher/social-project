"use client"

import { useEffect, useRef } from "react"
import { useAuth } from "@/lib/auth/AuthProvider"
import { usePathname } from "@/i18n/navigation"

const HEARTBEAT_INTERVAL_MS = 20_000

export function GlobalPresenceHeartbeat() {
  const { user } = useAuth()
  const pathname = usePathname()
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    if (!user?.id) return

    const sendHeartbeat = async (appState: "foreground" | "background") => {
      try {
        await fetch("/api/calls/presence/heartbeat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ appState, route: pathname }),
          keepalive: true,
        })
      } catch {
        // Best-effort only.
      }
    }

    const startInterval = () => {
      if (intervalRef.current) return
      intervalRef.current = setInterval(() => sendHeartbeat("foreground"), HEARTBEAT_INTERVAL_MS)
    }

    const stopInterval = () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
    }

    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        sendHeartbeat("foreground")
        startInterval()
      } else {
        stopInterval()
        sendHeartbeat("background")
      }
    }

    if (document.visibilityState === "visible") {
      sendHeartbeat("foreground")
      startInterval()
    } else {
      sendHeartbeat("background")
    }

    document.addEventListener("visibilitychange", onVisibilityChange)

    return () => {
      stopInterval()
      document.removeEventListener("visibilitychange", onVisibilityChange)
    }
  }, [user?.id, pathname])

  return null
}
