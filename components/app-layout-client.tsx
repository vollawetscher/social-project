"use client"

import React from "react"

import { useState } from "react"
import { AppSidebar } from "@/components/app-sidebar"
import { AppTopbar } from "@/components/app-topbar"
import { MobileNav } from "@/components/mobile-nav"
import { BugReporter } from "@/components/error/BugReporter"
import { VoiceSampleOnboardingModal } from "@/components/notifications/VoiceSampleOnboardingModal"
import { useNotifications } from "@/lib/hooks/useNotifications"
import { cn } from "@/lib/utils"

export function AppLayoutClient({ children }: { children: React.ReactNode }) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const { items, unreadCount, showOnboardingModal, snooze, markRead, markAllRead, dismissModal } = useNotifications()

  return (
    <div className="min-h-screen bg-background">
      {/* Desktop Sidebar - hidden on mobile */}
      <div className="hidden md:block">
        <AppSidebar
          isCollapsed={sidebarCollapsed}
          onToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
        />
      </div>
      
      {/* Topbar */}
      <AppTopbar
        sidebarCollapsed={sidebarCollapsed}
        notificationItems={items}
        notificationCount={unreadCount}
        onSnoozeNotification={(id) => snooze(id)}
        onMarkReadNotifications={(ids) => markRead(ids)}
        onMarkAllReadNotifications={markAllRead}
      />
      
      {/* Main Content */}
      <main
        className={cn(
          "h-[100dvh] flex flex-col pt-14 pb-16 md:pb-0 transition-all duration-300",
          "pl-0 md:pl-60",
          sidebarCollapsed && "md:pl-16"
        )}
      >
        <div className="p-4 md:p-6 flex-1 min-h-0 flex flex-col gap-4">
          {children}
        </div>
      </main>
      
      {/* Mobile Bottom Navigation - visible only on mobile */}
      <MobileNav />

      {/* Global bug reporter - always accessible */}
      <div className="fixed bottom-20 right-4 md:bottom-4 z-50">
        <BugReporter variant="outline" size="icon" iconOnly className="rounded-full shadow-lg bg-background" />
      </div>

      {/* Voice sample onboarding modal */}
      <VoiceSampleOnboardingModal
        open={showOnboardingModal}
        onSetupNow={dismissModal}
        onSnooze={() => snooze("voice_samples", 7)}
      />
    </div>
  )
}
