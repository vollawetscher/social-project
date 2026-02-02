'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { FileText, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/lib/auth/AuthProvider'
import { ChangelogDialog } from '@/components/changelog/ChangelogDialog'

interface DashboardLayoutProps {
  children: React.ReactNode
}

export function DashboardLayout({ children }: DashboardLayoutProps) {
  const router = useRouter()
  const { signOut } = useAuth()
  const [isLoggingOut, setIsLoggingOut] = useState(false)
  const [showChangelog, setShowChangelog] = useState(false)

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
      <header className="border-b border-blue-200/50 bg-white/80 backdrop-blur-md sticky top-0 z-50">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <FileText className="w-6 h-6 text-primary" />
            <h1 className="text-xl font-semibold text-primary">
              Gesprächsbericht
            </h1>
          </div>
          <div className="flex items-center gap-3">
            <Button 
              variant="ghost" 
              size="sm"
              onClick={() => setShowChangelog(true)}
              className="gap-2 hover:bg-primary/10"
            >
              <Sparkles className="h-4 w-4" />
              What's New
            </Button>
            <Button variant="ghost" onClick={() => router.push('/profile')} className="hover:bg-primary/10">
              Profile
            </Button>
            <Button variant="outline" onClick={handleLogout} disabled={isLoggingOut} className="border-primary/30 hover:bg-primary/10">
              {isLoggingOut ? 'Logging out…' : 'Logout'}
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        {children}
      </main>

      <ChangelogDialog open={showChangelog} onOpenChange={setShowChangelog} />
    </div>
  )
}
