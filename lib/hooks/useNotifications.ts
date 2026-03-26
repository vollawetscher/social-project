"use client"

import { useState, useEffect, useCallback, useMemo } from "react"
import { useAuth } from "@/lib/auth/AuthProvider"

export interface NotificationItem {
  id: string
  icon: "mic" | "info" | "alert"
  title: string
  description: string
  actionLabel: string
  actionHref: string
  snoozable: boolean
}

interface SnoozeMap {
  [notificationId: string]: string // ISO date string
}

interface NotificationPreferences {
  notification_snoozed?: SnoozeMap
  notification_dismissed?: Record<string, boolean>
}

function isSnoozed(snoozedUntil: string | undefined): boolean {
  if (!snoozedUntil) return false
  return new Date(snoozedUntil) > new Date()
}

export function useNotifications() {
  const { profile, refreshProfile } = useAuth()
  const [voiceSampleCount, setVoiceSampleCount] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [modalDismissedThisSession, setModalDismissedThisSession] = useState(false)

  useEffect(() => {
    let cancelled = false
    fetch("/api/profile/voice-sample")
      .then((r) => r.json())
      .then((d) => {
        if (!cancelled) setVoiceSampleCount(d.samples?.length ?? 0)
      })
      .catch(() => {
        if (!cancelled) setVoiceSampleCount(0)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => { cancelled = true }
  }, [])

  const prefs = (profile?.preferences ?? {}) as NotificationPreferences
  const snoozedMap = prefs.notification_snoozed ?? {}
  const dismissedMap = prefs.notification_dismissed ?? {}

  const items = useMemo<NotificationItem[]>(() => {
    const result: NotificationItem[] = []

    if (
      voiceSampleCount !== null &&
      voiceSampleCount === 0 &&
      !dismissedMap.voice_samples &&
      !isSnoozed(snoozedMap.voice_samples)
    ) {
      result.push({
        id: "voice_samples",
        icon: "mic",
        title: "notificationVoiceSampleTitle",
        description: "notificationVoiceSampleDesc",
        actionLabel: "notificationVoiceSampleAction",
        actionHref: "/profile",
        snoozable: true,
      })
    }

    return result
  }, [voiceSampleCount, snoozedMap, dismissedMap])

  const unreadCount = items.length

  const showOnboardingModal =
    !loading &&
    voiceSampleCount === 0 &&
    !modalDismissedThisSession &&
    !dismissedMap.voice_samples &&
    !isSnoozed(snoozedMap.voice_samples)

  const snooze = useCallback(
    async (notificationId: string, days: number = 7) => {
      const snoozeUntil = new Date()
      snoozeUntil.setDate(snoozeUntil.getDate() + days)

      const nextSnoozed = { ...snoozedMap, [notificationId]: snoozeUntil.toISOString() }
      const existingPrefs = (typeof profile?.preferences === "object" && profile?.preferences !== null && !Array.isArray(profile?.preferences))
        ? (profile.preferences as Record<string, unknown>)
        : {}
      const nextPrefs = { ...existingPrefs, notification_snoozed: nextSnoozed }

      setModalDismissedThisSession(true)

      try {
        await fetch("/api/profile", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ preferences: nextPrefs }),
        })
        await refreshProfile()
      } catch (e) {
        console.error("[Notifications] Failed to save snooze:", e)
      }
    },
    [snoozedMap, profile?.preferences, refreshProfile]
  )

  const dismissModal = useCallback(() => {
    setModalDismissedThisSession(true)
  }, [])

  const refreshSamples = useCallback(() => {
    fetch("/api/profile/voice-sample")
      .then((r) => r.json())
      .then((d) => setVoiceSampleCount(d.samples?.length ?? 0))
      .catch(() => {})
  }, [])

  return {
    items,
    unreadCount,
    loading,
    showOnboardingModal,
    snooze,
    dismissModal,
    refreshSamples,
  }
}
