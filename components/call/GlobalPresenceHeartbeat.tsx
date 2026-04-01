"use client"

import { useEffect } from "react"
import { useAuth } from "@/lib/auth/AuthProvider"
import { usePathname } from "@/i18n/navigation"

export function GlobalPresenceHeartbeat() {
  const { user } = useAuth()
  const pathname = usePathname()

  useEffect(() => {
    if (!user?.id) return

    const sendHeartbeat = async () => {
      try {
        await fetch("/api/calls/presence/heartbeat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            appState: document.visibilityState === "visible" ? "foreground" : "background",
            route: pathname,
          }),
          keepalive: true,
        })
      } catch {
        // Best-effort only.
      }
    }

    sendHeartbeat()
    const interval = setInterval(sendHeartbeat, 20_000)
    const onVisibilityChange = () => { void sendHeartbeat() }
    document.addEventListener("visibilitychange", onVisibilityChange)

    return () => {
      clearInterval(interval)
      document.removeEventListener("visibilitychange", onVisibilityChange)
    }
  }, [user?.id, pathname])

  return null
}
