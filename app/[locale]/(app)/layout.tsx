"use client"

import { useEffect } from "react"
import { useRouter } from "@/i18n/navigation"
import { AppLayoutClient } from "@/components/app-layout-client"
import { GlobalIncomingCallListener } from "@/components/call/GlobalIncomingCallListener"
import { GlobalPresenceHeartbeat } from "@/components/call/GlobalPresenceHeartbeat"
import { ActiveCallBanner } from "@/components/call/ActiveCallBanner"
import { UpdateBanner } from "@/components/layout/UpdateBanner"
import { Toaster } from "@/components/ui/toaster"
import { useAuth } from "@/lib/auth/AuthProvider"

export default function AppLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const { user, loading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (!loading && !user) {
      router.replace('/login')
    }
  }, [loading, user, router])

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        </div>
      </div>
    )
  }

  if (!user) {
    return null
  }

  return (
    <>
      <ActiveCallBanner />
      <AppLayoutClient>{children}</AppLayoutClient>
      <GlobalIncomingCallListener />
      <GlobalPresenceHeartbeat />
      <UpdateBanner />
      <Toaster />
    </>
  )
}
