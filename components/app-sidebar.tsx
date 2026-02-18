"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  Mic,
  FileText,
  LayoutTemplate,
  Settings,
  ChevronLeft,
  ChevronRight,
  Bug,
  Phone,
} from "lucide-react"
import { Logo } from "@/components/ui/logo"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { useAuth } from "@/lib/auth/AuthProvider"

interface AppSidebarProps {
  isCollapsed: boolean
  onToggle: () => void
}

const navItems = [
  {
    name: "Sessions",
    href: "/sessions",
    icon: Mic,
  },
  {
    name: "Outputs",
    href: "/outputs",
    icon: FileText,
  },
  {
    name: "Calls",
    href: "/calls",
    icon: Phone,
  },
  {
    name: "Templates",
    href: "/templates",
    icon: LayoutTemplate,
  },
  {
    name: "Settings",
    href: "/settings",
    icon: Settings,
  },
]

const adminNavItems = [
  {
    name: "Bug Reports",
    href: "/admin/bugs",
    icon: Bug,
  },
]

export function AppSidebar({ isCollapsed, onToggle }: AppSidebarProps) {
  const pathname = usePathname()
  const { profile } = useAuth()
  const isAdmin = (profile as any)?.role === 'admin'

  const renderNavItem = (item: { name: string; href: string; icon: any }) => {
    const isActive =
      pathname === item.href || pathname.startsWith(item.href + "/")
    const Icon = item.icon

    if (isCollapsed) {
      return (
        <Tooltip key={item.href}>
          <TooltipTrigger asChild>
            <Link
              href={item.href}
              className={cn(
                "flex h-10 w-10 items-center justify-center rounded-md transition-colors mx-auto",
                isActive
                  ? "bg-sidebar-accent text-sidebar-accent-foreground"
                  : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
              )}
            >
              <Icon className="h-5 w-5" />
              <span className="sr-only">{item.name}</span>
            </Link>
          </TooltipTrigger>
          <TooltipContent side="right" className="font-medium">
            {item.name}
          </TooltipContent>
        </Tooltip>
      )
    }

    return (
      <Link
        key={item.href}
        href={item.href}
        className={cn(
          "flex h-10 items-center gap-3 rounded-md px-3 transition-colors",
          isActive
            ? "bg-sidebar-accent text-sidebar-accent-foreground"
            : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
        )}
      >
        <Icon className="h-5 w-5 shrink-0" />
        <span className="text-sm font-medium whitespace-nowrap">{item.name}</span>
      </Link>
    )
  }

  return (
    <TooltipProvider delayDuration={0}>
      <aside
        className={cn(
          "fixed left-0 top-0 z-40 flex h-screen flex-col border-r border-sidebar-border bg-sidebar transition-all duration-300 overflow-hidden",
          isCollapsed ? "w-16" : "w-60"
        )}
      >
        {/* Logo */}
        <div className="flex h-14 items-center border-b border-sidebar-border px-4">
          <Link href="/sessions">
            {isCollapsed ? (
              <Logo variant="icon" className="w-8 h-8" />
            ) : (
              <Logo variant="full" />
            )}
          </Link>
        </div>

        {/* Navigation */}
        <nav className="flex-1 space-y-1 p-2">
          {navItems.map(renderNavItem)}

          {/* Admin section */}
          {isAdmin && (
            <>
              <div className={cn(
                "pt-3 mt-3 border-t border-sidebar-border",
                isCollapsed ? "mx-2" : "mx-1"
              )}>
                {!isCollapsed && (
                  <p className="text-[10px] uppercase tracking-wider text-sidebar-foreground/40 px-3 mb-1">
                    Admin
                  </p>
                )}
              </div>
              {adminNavItems.map(renderNavItem)}
            </>
          )}
        </nav>

        {/* Collapse Toggle */}
        <div className="border-t border-sidebar-border p-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={onToggle}
            className={cn(
              "w-full justify-center text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
              !isCollapsed && "justify-start px-3"
            )}
          >
            {isCollapsed ? (
              <ChevronRight className="h-4 w-4" />
            ) : (
              <>
                <ChevronLeft className="h-4 w-4 mr-2" />
                <span className="text-sm">Collapse</span>
              </>
            )}
          </Button>
        </div>
      </aside>
    </TooltipProvider>
  )
}
