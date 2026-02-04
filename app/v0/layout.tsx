"use client"

import { AppLayoutClient } from "@/components/app-layout-client"

export default function V0Layout({
  children,
}: {
  children: React.ReactNode
}) {
  return <AppLayoutClient>{children}</AppLayoutClient>
}
