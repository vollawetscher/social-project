"use client"

import { Link, usePathname } from "@/i18n/navigation"
import { useTranslations } from "next-intl"
import {
  Mic,
  FileText,
  LayoutTemplate,
  Settings,
  ChevronLeft,
  ChevronRight,
  Bug,
  Phone,
  Shield,
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

const navItemDefs = [
  { nameKey: "sessions", href: "/sessions", icon: Mic },
  { nameKey: "outputs", href: "/outputs", icon: FileText },
  { nameKey: "calls", href: "/calls", icon: Phone },
  { nameKey: "templates", href: "/templates", icon: LayoutTemplate },
  { nameKey: "settings", href: "/settings", icon: Settings },
]

const adminNavItemDefs = [
  { nameKey: "adminSessions", href: "/admin/sessions", icon: Shield },
  { nameKey: "adminBugs", href: "/admin/bugs", icon: Bug },
]

export function AppSidebar({ isCollapsed, onToggle }: AppSidebarProps) {
  const pathname = usePathname()
  const { profile } = useAuth()
  const isAdmin = (profile as any)?.role === 'admin'
  const t = useTranslations('nav')

  const renderNavItem = (item: { nameKey: string; href: string; icon: any }) => {
    const isActive =
      pathname === item.href || pathname.startsWith(item.href + "/")
    const Icon = item.icon
    const name = t(item.nameKey)

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
              <span className="sr-only">{name}</span>
            </Link>
          </TooltipTrigger>
          <TooltipContent side="right" className="font-medium">
            {name}
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
        <span className="text-sm font-medium whitespace-nowrap">{name}</span>
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
        <div className="flex h-14 items-center border-b border-sidebar-border px-4">
          <Link href="/sessions">
            {isCollapsed ? (
              <Logo variant="icon" className="w-8 h-8" />
            ) : (
              <Logo variant="full" />
            )}
          </Link>
        </div>

        <nav className="flex-1 space-y-1 p-2">
          {navItemDefs.map(renderNavItem)}

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
              {adminNavItemDefs.map(renderNavItem)}
            </>
          )}
        </nav>

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
