"use client"

import { useState, useEffect, useCallback, useMemo } from "react"
import { useAuth } from "@/lib/auth/AuthProvider"
import { createClient } from "@/lib/supabase/client"

export interface NotificationItem {
  id: string
  icon: "mic" | "info" | "alert" | "check" | "file"
  title: string
  description: string
  actionLabel: string
  actionHref: string
  snoozable: boolean
  /** If set, this maps to a DB notifications.id — allows mark-as-read */
  dbId?: string
  /** i18n key or literal string for description; if dbKey is false the value is used as-is */
  dbKey?: boolean
  /** DB notification type (analysis_complete, output_generated, etc.) for badge display */
  notificationType?: string
}

export interface ActiveJob {
  id: string
  jobType: string
  status: 'queued' | 'running' | 'retryable'
  sessionId: string | null
  attemptCount: number
  maxAttempts: number
  createdAt: string
  updatedAt: string
}

interface SnoozeMap {
  [notificationId: string]: string // ISO date string
}

interface NotificationPreferences {
  notification_snoozed?: SnoozeMap
  notification_dismissed?: Record<string, boolean>
}

interface DbNotification {
  id: string
  type: string
  title: string
  message: string | null
  action_href: string | null
  data: Record<string, unknown>
  read_at: string | null
  created_at: string
}

function isSnoozed(snoozedUntil: string | undefined): boolean {
  if (!snoozedUntil) return false
  return new Date(snoozedUntil) > new Date()
}

function dbNotificationToItem(n: DbNotification): NotificationItem {
  const iconMap: Record<string, NotificationItem["icon"]> = {
    analysis_complete: "check",
    output_generated: "file",
    voice_sample_needed: "mic",
    system: "info",
  }
  return {
    id: `db:${n.id}`,
    dbId: n.id,
    dbKey: false,
    icon: iconMap[n.type] ?? "info",
    title: n.title,
    description: n.message ?? "",
    actionLabel: "notificationActionView",
    actionHref: n.action_href ?? "/sessions",
    snoozable: false,
    notificationType: n.type,
  }
}

export function useNotifications() {
  const { profile, refreshProfile } = useAuth()
  const [voiceSampleCount, setVoiceSampleCount] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [modalDismissedThisSession, setModalDismissedThisSession] = useState(false)
  const [dbNotifications, setDbNotifications] = useState<DbNotification[]>([])
  const [activeJobs, setActiveJobs] = useState<ActiveJob[]>([])

  // Fetch voice sample count once on mount
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

  // Poll for active async jobs
  useEffect(() => {
    if (!profile?.id) return
    let cancelled = false

    const fetchJobs = () => {
      fetch("/api/jobs")
        .then((r) => r.ok ? r.json() : null)
        .then((d) => {
          if (!cancelled && d?.jobs) setActiveJobs(d.jobs)
        })
        .catch(() => {})
    }

    fetchJobs()
    const interval = setInterval(fetchJobs, 5000)
    return () => { cancelled = true; clearInterval(interval) }
  }, [profile?.id])

  // Fetch unread DB notifications on mount (once profile loads)
  useEffect(() => {
    if (!profile?.id) return
    const supabase = createClient()
    supabase
      .from("notifications")
      .select("id, type, title, message, action_href, data, read_at, created_at")
      .eq("user_id", profile.id)
      .is("read_at", null)
      .order("created_at", { ascending: false })
      .limit(20)
      .then(({ data }: { data: DbNotification[] | null }) => {
        if (data) setDbNotifications(data)
      })
  }, [profile?.id])

  // Realtime subscription — receives new notifications instantly
  useEffect(() => {
    if (!profile?.id) return
    const supabase = createClient()
    const channel = supabase
      .channel(`notifications:${profile.id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${profile.id}`,
        },
        (payload: { new: Record<string, unknown> }) => {
          const newNotification = payload.new as unknown as DbNotification
          setDbNotifications((prev) => [newNotification, ...prev])
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [profile?.id])

  const prefs = (profile?.preferences ?? {}) as NotificationPreferences
  const snoozedMap = prefs.notification_snoozed ?? {}
  const dismissedMap = prefs.notification_dismissed ?? {}

  const items = useMemo<NotificationItem[]>(() => {
    const result: NotificationItem[] = []

    // Condition-based: voice sample missing
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

    // DB-backed realtime notifications (unread)
    for (const n of dbNotifications) {
      if (!n.read_at) {
        result.push(dbNotificationToItem(n))
      }
    }

    return result
  }, [voiceSampleCount, snoozedMap, dismissedMap, dbNotifications])

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

  const markRead = useCallback(async (ids: string[]) => {
    if (!ids.length) return
    // Optimistically remove from local state
    setDbNotifications((prev) => prev.filter((n) => !ids.includes(n.id)))
    try {
      await fetch("/api/notifications/read", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids }),
      })
    } catch (e) {
      console.error("[Notifications] Failed to mark as read:", e)
    }
  }, [])

  const markAllRead = useCallback(async () => {
    const ids = dbNotifications.filter((n) => !n.read_at).map((n) => n.id)
    if (ids.length) await markRead(ids)
  }, [dbNotifications, markRead])

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
    activeJobs,
    loading,
    showOnboardingModal,
    snooze,
    markRead,
    markAllRead,
    dismissModal,
    refreshSamples,
  }
}
