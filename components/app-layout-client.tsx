"use client"

import React from "react"

import { useState } from "react"
import { AppSidebar } from "@/components/app-sidebar"
import { AppTopbar } from "@/components/app-topbar"
import { MobileNav } from "@/components/mobile-nav"
import { TrialBanner } from "@/components/trial/TrialBanner"
import { cn } from "@/lib/utils"

export function AppLayoutClient({ children }: { children: React.ReactNode }) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)

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
      <AppTopbar sidebarCollapsed={sidebarCollapsed} />
      
      {/* Main Content */}
      <main
        className={cn(
          "h-[100dvh] flex flex-col pt-14 pb-16 md:pb-0 transition-all duration-300",
          "pl-0 md:pl-60",
          sidebarCollapsed && "md:pl-16"
        )}
      >
        <div className="p-4 md:p-6 flex-1 min-h-0 flex flex-col gap-4">
          <TrialBanner />
          {children}
        </div>
      </main>
      
      {/* Mobile Bottom Navigation - visible only on mobile */}
      <MobileNav />
    </div>
  )
}
