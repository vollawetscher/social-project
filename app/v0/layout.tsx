"use client"

import { AppLayoutClient } from "@/components/app-layout-client"
import { AuthProvider } from "@/lib/auth/AuthProvider"

export default function V0Layout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <AuthProvider>
      <AppLayoutClient>{children}</AppLayoutClient>
    </AuthProvider>
  )
}
