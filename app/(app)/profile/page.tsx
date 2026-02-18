"use client"

export const dynamic = 'force-dynamic'

import { useState, useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import { User, Mail, Phone, Calendar, Settings, Shield, Loader2, AlertTriangle, Bug, Smartphone, Share, Plus } from "lucide-react"
import { BugReporter } from "@/components/error/BugReporter"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { useAuth } from "@/lib/auth/AuthProvider"
import { UserProfile } from "@/lib/types/profile"

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

function InstallAppCard() {
  const [isMobile, setIsMobile] = useState(false)
  const [isStandalone, setIsStandalone] = useState(false)
  const [isIOS, setIsIOS] = useState(false)
  const deferredPromptRef = useRef<BeforeInstallPromptEvent | null>(null)
  const [canInstall, setCanInstall] = useState(false)
  const [installed, setInstalled] = useState(false)

  useEffect(() => {
    const ua = navigator.userAgent
    setIsMobile(/iPhone|iPad|iPod|Android|webOS|Mobile/i.test(ua))
    setIsIOS(/iPad|iPhone|iPod/.test(ua))
    setIsStandalone(
      window.matchMedia('(display-mode: standalone)').matches ||
      (navigator as any).standalone === true
    )

    const handler = (e: Event) => {
      e.preventDefault()
      deferredPromptRef.current = e as BeforeInstallPromptEvent
      setCanInstall(true)
    }
    window.addEventListener('beforeinstallprompt', handler)
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  if (!isMobile || isStandalone || installed) return null

  const handleInstall = async () => {
    if (!deferredPromptRef.current) return
    deferredPromptRef.current.prompt()
    const { outcome } = await deferredPromptRef.current.userChoice
    if (outcome === 'accepted') setInstalled(true)
    deferredPromptRef.current = null
    setCanInstall(false)
  }

  return (
    <Card className="border-border">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Smartphone className="h-5 w-5" />
          Install App
        </CardTitle>
        <CardDescription>
          Add Notissima to your home screen for quick access
        </CardDescription>
      </CardHeader>
      <CardContent>
        {canInstall ? (
          <Button onClick={handleInstall}>
            <Plus className="h-4 w-4 mr-2" />
            Add to Home Screen
          </Button>
        ) : isIOS ? (
          <div className="flex items-start gap-3 text-sm text-muted-foreground">
            <Share className="h-5 w-5 shrink-0 mt-0.5" />
            <p>
              Tap the <span className="font-medium text-foreground">Share</span> button in Safari, then choose{' '}
              <span className="font-medium text-foreground">Add to Home Screen</span>.
            </p>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            Open this page in Chrome and tap the menu, then &quot;Add to Home Screen&quot;.
          </p>
        )}
      </CardContent>
    </Card>
  )
}

export default function ProfilePage() {
  const { user, loading: authLoading } = useAuth()
  const router = useRouter()
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [templates, setTemplates] = useState<{ id: string; name: string }[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchProfile() {
      if (!user) {
        setLoading(false)
        return
      }

      try {
        const [profileRes, templatesRes] = await Promise.all([
          fetch('/api/profile'),
          fetch('/api/templates'),
        ])
        if (!profileRes.ok) throw new Error('Failed to fetch profile')
        const data: UserProfile = await profileRes.json()
        setProfile(data)
        if (templatesRes.ok) {
          const t = await templatesRes.json()
          setTemplates(t.map((x: { id: string; name: string }) => ({ id: x.id, name: x.name })))
        }
      } catch (error) {
        console.error('Error fetching profile:', error)
      } finally {
        setLoading(false)
      }
    }

    if (!authLoading) {
      fetchProfile()
    }
  }, [user, authLoading])

  if (authLoading || loading) {
    return (
      <div className="max-w-4xl mx-auto py-12 text-center">
        <Loader2 className="h-8 w-8 animate-spin mx-auto text-muted-foreground" />
        <p className="text-sm text-muted-foreground mt-4">Loading profile...</p>
      </div>
    )
  }

  if (!user || !profile) {
    return (
      <div className="max-w-4xl mx-auto py-12 text-center">
        <AlertTriangle className="h-12 w-12 mx-auto text-warning mb-4" />
        <h2 className="text-lg font-semibold">Authentication Required</h2>
        <p className="text-sm text-muted-foreground mt-2">Please log in to view your profile</p>
        <Button onClick={() => router.push('/login')} className="mt-4">
          Go to Login
        </Button>
      </div>
    )
  }

  // Get initials for avatar
  const getInitials = () => {
    if (profile.display_name) {
      return profile.display_name.substring(0, 2).toUpperCase()
    }
    if (profile.email) {
      return profile.email.substring(0, 2).toUpperCase()
    }
    if (profile.phone_number) {
      return profile.phone_number.substring(0, 2)
    }
    return 'U'
  }

  const getLanguageName = (code: string) => {
    const languages: Record<string, string> = {
      de: 'German (Deutsch)',
      en: 'English',
      es: 'Spanish (Español)',
      fr: 'French (Français)',
      it: 'Italian (Italiano)',
      pt: 'Portuguese (Português)',
      nl: 'Dutch (Nederlands)',
      pl: 'Polish (Polski)',
    }
    return languages[code] || code.toUpperCase()
  }

  const getAfterTranscriptLabel = () => {
    const templateId = (profile as any)?.after_transcript_template_id
    if (templateId) {
      const t = templates.find((x) => x.id === templateId)
      return t?.name || 'Custom template'
    }
    const action = profile?.after_transcript_action
    const actions: Record<string, string> = {
      nothing: 'Do nothing',
      short_summary: 'Short Summary',
      long_summary: 'Long Summary',
      full_report: 'Full Report',
    }
    return actions[action || 'nothing'] || 'Do nothing'
  }

  return (
    <div className="max-w-4xl space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Profile</h1>
          <p className="text-sm text-muted-foreground mt-1">
            View your account information and preferences
          </p>
        </div>
        <div className="flex items-center gap-2">
          {profile.role === 'admin' && (
            <BugReporter variant="outline" size="default" />
          )}
          <Button onClick={() => router.push('/settings')} variant="outline">
            <Settings className="h-4 w-4 mr-2" />
            Edit Settings
          </Button>
        </div>
      </div>

      {/* Profile Card */}
      <Card className="border-border">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            Account Information
          </CardTitle>
          <CardDescription>
            Your personal details and authentication method
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Avatar and Basic Info */}
          <div className="flex items-center gap-4">
            <Avatar className="h-20 w-20">
              <AvatarFallback className="text-2xl">
                {getInitials()}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1">
              {profile.display_name && (
                <h2 className="text-xl font-semibold text-foreground">
                  {profile.display_name}
                </h2>
              )}
              <div className="flex items-center gap-2 mt-1">
                <Badge variant="outline" className="text-xs">
                  {profile.role === 'admin' ? 'Administrator' : 'User'}
                </Badge>
                {profile.auth_method && (
                  <Badge variant="secondary" className="text-xs">
                    {profile.auth_method === 'email' ? 'Email Auth' : 'Phone Auth'}
                  </Badge>
                )}
              </div>
            </div>
          </div>

          {/* Contact Information */}
          <div className="space-y-3 pt-4 border-t border-border">
            {profile.email && (
              <div className="flex items-center gap-3">
                <Mail className="h-4 w-4 text-muted-foreground" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-foreground">Email</p>
                  <p className="text-sm text-muted-foreground">{profile.email}</p>
                </div>
                {profile.email_verified && (
                  <Badge className="bg-success/20 text-success border-success/30 text-xs">
                    Verified
                  </Badge>
                )}
              </div>
            )}

            {profile.phone_number && (
              <div className="flex items-center gap-3">
                <Phone className="h-4 w-4 text-muted-foreground" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-foreground">Phone</p>
                  <p className="text-sm text-muted-foreground">{profile.phone_number}</p>
                </div>
              </div>
            )}

            <div className="flex items-center gap-3">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <div className="flex-1">
                <p className="text-sm font-medium text-foreground">Member Since</p>
                <p className="text-sm text-muted-foreground">
                  {new Date(profile.created_at).toLocaleDateString('en-US', {
                    month: 'long',
                    day: 'numeric',
                    year: 'numeric'
                  })}
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Language Preferences */}
      <Card className="border-border">
        <CardHeader>
          <CardTitle>Language & Regional Settings</CardTitle>
          <CardDescription>
            Your default language and timezone preferences
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-1">
              <p className="text-sm font-medium text-muted-foreground">Recording Language</p>
              <p className="text-sm text-foreground">
                {getLanguageName(profile.default_recording_language)}
              </p>
            </div>
            <div className="space-y-1">
              <p className="text-sm font-medium text-muted-foreground">Report Language</p>
              <p className="text-sm text-foreground">
                {getLanguageName(profile.preferred_report_language)}
              </p>
            </div>
          </div>
          <div className="space-y-1 pt-2 border-t border-border">
            <p className="text-sm font-medium text-muted-foreground">Timezone</p>
            <p className="text-sm text-foreground">{profile.timezone}</p>
          </div>
        </CardContent>
      </Card>

      {/* Workflow Settings */}
      <Card className="border-border">
        <CardHeader>
          <CardTitle>Workflow Automation</CardTitle>
          <CardDescription>
            Automatic actions after transcription
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1">
            <p className="text-sm font-medium text-muted-foreground">After Transcript Completes</p>
            <p className="text-sm text-foreground">
              {getAfterTranscriptLabel()}
            </p>
          </div>
          {profile.auto_generate_reports && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-secondary/50 border border-border">
              <Shield className="h-4 w-4 text-success" />
              <span className="text-sm text-foreground">
                Automatic report generation is enabled
              </span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Install App - mobile only, not already installed */}
      <InstallAppCard />

      {/* Support & Feedback - Admin only */}
      {profile.role === 'admin' && (
        <Card className="border-border">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bug className="h-5 w-5" />
              Help & Feedback
            </CardTitle>
            <CardDescription>
              Report issues or request new features
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Found a bug or have a feature request? Let us know! Your feedback helps improve Notissima for everyone.
            </p>
            <div className="flex gap-2">
              <BugReporter variant="default" size="default" />
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
