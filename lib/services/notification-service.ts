import { createServiceRoleClient } from "@/lib/supabase/server"

export type NotificationType =
  | "analysis_complete"
  | "output_generated"
  | "voice_sample_needed"
  | "system"

export interface CreateNotificationParams {
  userId: string
  type: NotificationType
  title: string
  message?: string
  actionHref?: string
  data?: Record<string, unknown>
}

/**
 * Insert a notification for a user. Always uses the service role client so
 * this can be called from any server-side context (API routes, workers, etc.).
 * The client receives it instantly via Supabase Realtime.
 */
export async function createNotification(params: CreateNotificationParams): Promise<void> {
  const db = createServiceRoleClient()
  const { error } = await db.from("notifications").insert({
    user_id: params.userId,
    type: params.type,
    title: params.title,
    message: params.message ?? null,
    action_href: params.actionHref ?? null,
    data: params.data ?? {},
  })
  if (error) {
    console.error("[NotificationService] Failed to create notification:", error.message)
  }
}

/**
 * Mark a single notification as read.
 * Exported for use in server actions if needed; the client normally calls
 * PATCH /api/notifications/[id]/read directly.
 */
export async function markNotificationRead(notificationId: string): Promise<void> {
  const db = createServiceRoleClient()
  const { error } = await db
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("id", notificationId)
  if (error) {
    console.error("[NotificationService] Failed to mark notification read:", error.message)
  }
}
