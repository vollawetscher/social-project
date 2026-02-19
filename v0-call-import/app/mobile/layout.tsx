import React from "react"
import type { Metadata, Viewport } from "next"

export const metadata: Metadata = {
  title: "Notissima Caller",
  description: "AI-powered call transcription",
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#ffffff",
}

export default function MobileLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen bg-background">
      {children}
    </div>
  )
}
