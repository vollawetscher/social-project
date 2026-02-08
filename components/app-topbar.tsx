"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Search, WifiOff, RefreshCw, Bell, User, LogOut, Settings, Mic } from "lucide-react"
import { Logo } from "@/components/ui/logo"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"
import { useAuth } from "@/lib/auth/AuthProvider"

interface AppTopbarProps {
  sidebarCollapsed: boolean
}

export function AppTopbar({ sidebarCollapsed }: AppTopbarProps) {
  const [isOffline, setIsOffline] = useState(false)
  const [isSyncing, setIsSyncing] = useState(false)
  const { user, profile, signOut } = useAuth()
  const router = useRouter()

  // Simulated sync function
  const handleSync = () => {
    setIsSyncing(true)
    setTimeout(() => setIsSyncing(false), 2000)
  }

  const handleLogout = async () => {
    await signOut()
    router.push('/login')
  }

  // Get user display info
  const displayName = profile?.display_name || user?.email?.split('@')[0] || 'User'
  const email = user?.email || ''
  const initials = displayName
    .split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2) || 'U'

  return (
    <TooltipProvider>
      <header
        className={cn(
          "fixed top-0 right-0 z-30 flex h-14 items-center justify-between border-b border-border bg-background px-4 transition-all duration-300",
          // Full width on mobile, offset by sidebar on desktop
          "left-0 md:left-60",
          sidebarCollapsed && "md:left-16"
        )}
      >
        {/* Left: Logo (mobile) + Workspace + Search */}
        <div className="flex items-center gap-3">
          {/* Mobile Logo */}
          <div className="flex md:hidden">
            <Logo variant="full" />
          </div>
          
          {/* Desktop Workspace */}
          <div className="hidden lg:flex items-center gap-2">
            <span className="text-sm font-medium text-foreground">
              Workspace
            </span>
            <Badge variant="secondary" className="text-xs">
              Pro
            </Badge>
          </div>

          {/* Search - hidden on mobile, visible on tablet+ */}
          <div className="relative hidden sm:block w-48 md:w-64 lg:w-80">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Search sessions, outputs..."
              className="pl-9 bg-secondary border-border"
            />
          </div>
        </div>

        {/* Right: Status Indicators + User Menu */}
        <div className="flex items-center gap-2">
          {/* Offline Indicator */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsOffline(!isOffline)}
                className={cn(
                  "h-8 gap-1.5",
                  isOffline && "text-warning"
                )}
              >
                <WifiOff className={cn("h-4 w-4", !isOffline && "opacity-30")} />
                {isOffline && (
                  <span className="text-xs hidden sm:inline">Offline</span>
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              {isOffline
                ? "Working offline - changes will sync when connected"
                : "Connected"}
            </TooltipContent>
          </Tooltip>

          {/* Sync Status */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleSync}
                disabled={isSyncing}
                className="h-8"
              >
                <RefreshCw
                  className={cn("h-4 w-4", isSyncing && "animate-spin")}
                />
                <span className="sr-only">Sync</span>
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              {isSyncing ? "Syncing..." : "Sync now"}
            </TooltipContent>
          </Tooltip>

          {/* Notifications */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="sm" className="h-8 relative">
                <Bell className="h-4 w-4" />
                <span className="absolute top-1 right-1 h-2 w-2 rounded-full bg-info" />
                <span className="sr-only">Notifications</span>
              </Button>
            </TooltipTrigger>
            <TooltipContent>Notifications</TooltipContent>
          </Tooltip>

          {/* User Menu */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 gap-2 px-2"
              >
                <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-medium">
                  {initials}
                </div>
                <span className="hidden sm:inline text-sm">{displayName}</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>
                <div className="flex flex-col">
                  <span className="font-medium">{displayName}</span>
                  <span className="text-xs text-muted-foreground">
                    {email}
                  </span>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => router.push('/profile')}>
                <User className="mr-2 h-4 w-4" />
                Profile
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => router.push('/settings')}>
                <Settings className="mr-2 h-4 w-4" />
                Settings
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem className="text-destructive" onClick={handleLogout}>
                <LogOut className="mr-2 h-4 w-4" />
                Log out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>
    </TooltipProvider>
  )
}
