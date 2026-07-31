'use client'

import { useState } from 'react'
import { useRouter } from '@/i18n/navigation'
import { useTranslations } from 'next-intl'
import { FileText, Sparkles, User, LogOut, MessageSquarePlus, ChevronDown } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/lib/auth/AuthProvider'
import { ChangelogDialog } from '@/components/changelog/ChangelogDialog'
import { FeatureRequestDialog } from '@/components/feature-request/FeatureRequestDialog'
import { UpdateBanner } from '@/components/layout/UpdateBanner'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

interface DashboardLayoutProps {
  children: React.ReactNode
}

export function DashboardLayout({ children }: DashboardLayoutProps) {
  const router = useRouter()
  const { signOut, user, profile } = useAuth()
  const [isLoggingOut, setIsLoggingOut] = useState(false)
  const [showChangelog, setShowChangelog] = useState(false)
  const [showFeatureRequest, setShowFeatureRequest] = useState(false)
  const tNav = useTranslations('nav')
  const tSettings = useTranslations('settings')
  const tProfile = useTranslations('profile')

  // Get display name: prioritize display_name, then email, then phone, then fallback
  const displayName = profile?.display_name || user?.email || profile?.phone_number || 'User'

  const handleLogout = async () => {
    try {
      setIsLoggingOut(true)
      // Clear client state/session
      await signOut()
      // Clear HttpOnly SSR cookies on the server
      await fetch('/api/auth/logout', { method: 'POST' })
      // Navigate to login
      router.replace('/login')
    } finally {
      setIsLoggingOut(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-blue-100">
      <UpdateBanner />
      <header className="border-b border-blue-200/50 bg-white/80 backdrop-blur-md sticky top-0 z-50">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <FileText className="w-6 h-6 text-primary" />
            <h1 className="text-xl font-semibold text-primary">
              Gesprächsbericht
            </h1>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button 
                variant="ghost" 
                className="gap-2 hover:bg-primary/10 max-w-[200px] sm:max-w-none"
              >
                <User className="h-4 w-4 flex-shrink-0" />
                <span className="truncate">{displayName}</span>
                <ChevronDown className="h-4 w-4 flex-shrink-0" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>{tProfile('title')}</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => router.push('/profile')}>
                <User className="mr-2 h-4 w-4" />
                <span>{tNav('profile')}</span>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setShowChangelog(true)}>
                <Sparkles className="mr-2 h-4 w-4" />
                <span>{tNav('whatsNew')}</span>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setShowFeatureRequest(true)}>
                <MessageSquarePlus className="mr-2 h-4 w-4" />
                <span>{tNav('featureRequest')}</span>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem 
                onClick={handleLogout} 
                disabled={isLoggingOut}
                className="text-red-600 focus:text-red-600"
              >
                <LogOut className="mr-2 h-4 w-4" />
                <span>{isLoggingOut ? tSettings('signingOut') : tSettings('signOut')}</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        {children}
      </main>

      <ChangelogDialog open={showChangelog} onOpenChange={setShowChangelog} />
      <FeatureRequestDialog open={showFeatureRequest} onOpenChange={setShowFeatureRequest} />
    </div>
  )
}
