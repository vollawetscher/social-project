"use client"

import { AppLayoutClient } from "@/components/app-layout-client"
import { GlobalIncomingCallListener } from "@/components/call/GlobalIncomingCallListener"
import { ActiveCallBanner } from "@/components/call/ActiveCallBanner"
import { Toaster } from "@/components/ui/toaster"

export default function AppLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <>
      <ActiveCallBanner />
      <AppLayoutClient>{children}</AppLayoutClient>
      <GlobalIncomingCallListener />
      <Toaster />
    </>
  )
}
