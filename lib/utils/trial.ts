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
  const diffMs = expiresAt.getTime() - now.getTime()
  return Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)))
}
