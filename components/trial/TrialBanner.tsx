"use client"

import { useAuth } from "@/lib/auth/AuthProvider"
import { isOnTrial, trialDaysLeft } from "@/lib/utils/trial"
import { Sparkles } from "lucide-react"

export function TrialBanner() {
  const { profile } = useAuth()

  if (!isOnTrial(profile)) return null

  const days = trialDaysLeft(profile)
  const label = days === 1 ? "1 day" : `${days} days`

  return (
    <div className="flex items-center gap-2 bg-primary/10 border border-primary/20 text-primary rounded-lg px-3 py-2 text-sm">
      <Sparkles className="h-4 w-4 shrink-0" />
      <span>
        <span className="font-semibold">{label} left</span> in your free trial
      </span>
    </div>
  )
}
