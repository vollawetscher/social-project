import type { UserProfile } from '@/lib/types/profile'
import type { Profile } from '@/lib/types/database'

type AnyProfile = UserProfile | Profile | null | undefined

export function isOnTrial(profile: AnyProfile): boolean {
  if (!profile?.onboarding_expires_at) return false
  return new Date(profile.onboarding_expires_at) > new Date()
}

export function trialDaysLeft(profile: AnyProfile): number {
  if (!profile?.onboarding_expires_at) return 0
  const expiresAt = new Date(profile.onboarding_expires_at)
  const now = new Date()

  if (expiresAt <= now) return 0

  // Show a calendar-day countdown (e.g. "yesterday signup" => 4 days left
  // on the next day for a 5-day trial), instead of hour-based ceil rounding.
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const startOfExpiryDay = new Date(
    expiresAt.getFullYear(),
    expiresAt.getMonth(),
    expiresAt.getDate()
  )
  const diffDays = Math.round(
    (startOfExpiryDay.getTime() - startOfToday.getTime()) / (1000 * 60 * 60 * 24)
  )
  return Math.max(0, diffDays)
}
