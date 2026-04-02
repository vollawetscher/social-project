"use client"

export const dynamic = 'force-dynamic'

import { useState, useEffect, useRef } from "react"
import { useRouter } from "@/i18n/navigation"
import { useTranslations, useLocale } from "next-intl"
import { User, Mail, Phone, Calendar, Settings, Shield, Loader2, AlertTriangle, Bug, Smartphone, Share, Plus, Link2, Check, Copy, Video, Download, QrCode } from "lucide-react"
import { QRCodeCanvas } from "qrcode.react"
import { BugReporter } from "@/components/error/BugReporter"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { useAuth } from "@/lib/auth/AuthProvider"
import { UserProfile } from "@/lib/types/profile"
import { VoiceSampleCard } from "@/components/profile/VoiceSampleCard"

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

function InstallAppCard() {
  const t = useTranslations('profile')
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
          {t('installApp')}
        </CardTitle>
        <CardDescription>
          {t('installAppDesc')}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {canInstall ? (
          <Button onClick={handleInstall}>
            <Plus className="h-4 w-4 mr-2" />
            {t('addToHomeScreen')}
          </Button>
        ) : isIOS ? (
          <div className="flex items-start gap-3 text-sm text-muted-foreground">
            <Share className="h-5 w-5 shrink-0 mt-0.5" />
            <p>
              {t.rich('iosInstallHint', {
                shareButton: (chunks) => <span className="font-medium text-foreground">{t('shareButton')}</span>,
                addToHome: (chunks) => <span className="font-medium text-foreground">{t('addToHomeScreen')}</span>,
              })}
            </p>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            {t('chromeInstallHint')}
          </p>
        )}
      </CardContent>
    </Card>
  )
}

export default function ProfilePage() {
  const t = useTranslations('profile')
  const tl = useTranslations('languages')
  const locale = useLocale()
  const { user, loading: authLoading } = useAuth()
  const router = useRouter()
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [templates, setTemplates] = useState<{ id: string; name: string }[]>([])
  const [loading, setLoading] = useState(true)
  const [phoneNumberInput, setPhoneNumberInput] = useState('')
  const [phoneSaving, setPhoneSaving] = useState(false)
  const [phoneError, setPhoneError] = useState<string | null>(null)
  const [phoneSuccess, setPhoneSuccess] = useState<string | null>(null)
  const [slugInput, setSlugInput] = useState('')
  const [slugSaving, setSlugSaving] = useState(false)
  const [slugError, setSlugError] = useState<string | null>(null)
  const [slugSuccess, setSlugSuccess] = useState<string | null>(null)
  const [linkCopied, setLinkCopied] = useState(false)
  const [showQr, setShowQr] = useState(false)

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
        setPhoneNumberInput(data.phone_number || '')
        setSlugInput((data as any).meeting_slug || '')
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
        <p className="text-sm text-muted-foreground mt-4">{t('loadingProfile')}</p>
      </div>
    )
  }

  if (!user || !profile) {
    return (
      <div className="max-w-4xl mx-auto py-12 text-center">
        <AlertTriangle className="h-12 w-12 mx-auto text-warning mb-4" />
        <h2 className="text-lg font-semibold">{t('authRequired')}</h2>
        <p className="text-sm text-muted-foreground mt-2">{t('authRequiredHint')}</p>
        <Button onClick={() => router.push('/login')} className="mt-4">
          {t('goToLogin')}
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
      auto: tl('auto'),
      session: 'Session language (original)',
      de: tl('de'),
      en: tl('en'),
      es: tl('es'),
      fr: tl('fr'),
      it: tl('it'),
      pt: tl('pt'),
      nl: tl('nl'),
      pl: tl('pl'),
    }
    return languages[code] || code.toUpperCase()
  }

  const getAfterTranscriptLabel = () => {
    const templateId = (profile as any)?.after_transcript_template_id
    if (templateId) {
      const tmpl = templates.find((x) => x.id === templateId)
      return tmpl?.name || t('customTemplate')
    }
    return t('doNothing')
  }

  const savePhoneNumber = async () => {
    setPhoneError(null)
    setPhoneSuccess(null)
    setPhoneSaving(true)
    try {
      const res = await fetch('/api/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone_number: phoneNumberInput }),
      })
      const payload = await res.json().catch(() => ({}))
      if (!res.ok) {
        throw new Error(payload?.error || 'Failed to save phone number')
      }
      setProfile(payload)
      setPhoneNumberInput(payload.phone_number || '')
      setPhoneSuccess(t('phoneSaved'))
    } catch (error: any) {
      setPhoneError(error?.message || t('phoneFailedSave'))
    } finally {
      setPhoneSaving(false)
    }
  }

  const meetingSlug = (profile as any)?.meeting_slug as string | undefined
  const appUrl = typeof window !== 'undefined' ? window.location.origin : ''
  const meetingLink = meetingSlug ? `${appUrl}/meet/${meetingSlug}` : null

  const saveSlug = async () => {
    setSlugError(null)
    setSlugSuccess(null)
    setSlugSaving(true)
    try {
      const res = await fetch('/api/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ meeting_slug: slugInput }),
      })
      const payload = await res.json().catch(() => ({}))
      if (!res.ok) {
        throw new Error(payload?.error || 'Failed to save meeting slug')
      }
      setProfile(payload)
      setSlugInput(payload.meeting_slug || '')
      setSlugSuccess(t('slugSaved'))
    } catch (error: any) {
      setSlugError(error?.message || t('slugFailedSave'))
    } finally {
      setSlugSaving(false)
    }
  }

  const copyMeetingLink = async () => {
    if (!meetingLink) return
    try {
      await navigator.clipboard.writeText(meetingLink)
    } catch {
      const textarea = document.createElement('textarea')
      textarea.value = meetingLink
      document.body.appendChild(textarea)
      textarea.select()
      document.execCommand('copy')
      document.body.removeChild(textarea)
    }
    setLinkCopied(true)
    setTimeout(() => setLinkCopied(false), 2000)
  }

  const downloadQr = () => {
    const canvas = document.getElementById('meeting-qr') as HTMLCanvasElement | null
    if (!canvas) return
    const url = canvas.toDataURL('image/png')
    const a = document.createElement('a')
    a.href = url
    a.download = `meeting-qr-${meetingSlug || 'link'}.png`
    a.click()
  }

  return (
    <div className="max-w-4xl space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">{t('title')}</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {t('subtitle')}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {profile.role === 'admin' && (
            <BugReporter variant="outline" size="default" />
          )}
          <Button onClick={() => router.push('/settings')} variant="outline">
            <Settings className="h-4 w-4 mr-2" />
            {t('editSettings')}
          </Button>
        </div>
      </div>

      {/* Profile Card */}
      <Card className="border-border">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            {t('accountInfo')}
          </CardTitle>
          <CardDescription>
            {t('accountInfoDesc')}
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
                  {profile.role === 'admin' ? t('administrator') : t('user')}
                </Badge>
                {profile.auth_method && (
                  <Badge variant="secondary" className="text-xs">
                    {profile.auth_method === 'email' ? t('emailAuth') : t('phoneAuth')}
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
                  <p className="text-sm font-medium text-foreground">{t('email')}</p>
                  <p className="text-sm text-muted-foreground">{profile.email}</p>
                </div>
                {profile.email_verified && (
                  <Badge className="bg-success/20 text-success border-success/30 text-xs">
                    {t('verified')}
                  </Badge>
                )}
              </div>
            )}

            <div className="flex items-start gap-3">
              <Phone className="h-4 w-4 text-muted-foreground mt-2" />
              <div className="flex-1">
                <p className="text-sm font-medium text-foreground">{t('phone')}</p>
                <div className="mt-1 flex flex-col sm:flex-row gap-2">
                  <Input
                    type="tel"
                    inputMode="tel"
                    placeholder="+49 170 1234567"
                    value={phoneNumberInput}
                    onChange={(e) => setPhoneNumberInput(e.target.value)}
                    className="max-w-sm"
                    disabled={phoneSaving}
                  />
                  <Button
                    variant="outline"
                    onClick={savePhoneNumber}
                    disabled={phoneSaving}
                    className="sm:w-auto w-full"
                  >
                    {phoneSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : t('savePhone')}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground mt-1">{t('phoneFormat')}</p>
                {phoneError && <p className="text-xs text-destructive mt-1">{phoneError}</p>}
                {phoneSuccess && <p className="text-xs text-success mt-1">{phoneSuccess}</p>}
              </div>
            </div>

            <div className="flex items-center gap-3">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <div className="flex-1">
                <p className="text-sm font-medium text-foreground">{t('memberSince')}</p>
                <p className="text-sm text-muted-foreground">
                  {new Date(profile.created_at).toLocaleDateString(locale, {
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

      {/* Personal Meeting Link */}
      <Card className="border-border">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Video className="h-5 w-5" />
            {t('meetingLinkTitle')}
          </CardTitle>
          <CardDescription>{t('meetingLinkDesc')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {meetingLink && (
            <>
              <div className="flex items-center gap-2 p-3 rounded-lg bg-secondary/50 border border-border">
                <Link2 className="h-4 w-4 text-muted-foreground shrink-0" />
                <code className="text-sm text-foreground flex-1 truncate">{meetingLink}</code>
                <Button variant="ghost" size="sm" onClick={() => setShowQr(v => !v)} className="shrink-0 h-8" title={t('showQrCode')}>
                  <QrCode className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="sm" onClick={copyMeetingLink} className="shrink-0 h-8">
                  {linkCopied ? (
                    <Check className="h-4 w-4 text-success" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </Button>
              </div>
              {showQr && (
                <div className="flex flex-col items-center gap-3 p-4 rounded-lg border border-border bg-white">
                  <QRCodeCanvas
                    id="meeting-qr"
                    value={meetingLink}
                    size={180}
                    level="M"
                    marginSize={2}
                  />
                  <Button variant="outline" size="sm" className="gap-1.5" onClick={downloadQr}>
                    <Download className="h-3.5 w-3.5" />
                    {t('downloadQr')}
                  </Button>
                </div>
              )}
            </>
          )}
          <div className="space-y-2">
            <label className="text-sm font-medium text-muted-foreground">{t('meetingSlugLabel')}</label>
            <div className="flex flex-col sm:flex-row gap-2">
              <div className="flex items-center gap-0 flex-1 max-w-sm">
                <span className="text-sm text-muted-foreground whitespace-nowrap pr-1">/meet/</span>
                <Input
                  value={slugInput}
                  onChange={(e) => setSlugInput(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                  placeholder="your-name"
                  className="flex-1"
                  disabled={slugSaving}
                />
              </div>
              <Button
                variant="outline"
                onClick={saveSlug}
                disabled={slugSaving || slugInput === meetingSlug}
                className="sm:w-auto w-full"
              >
                {slugSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : t('saveSlug')}
              </Button>
            </div>
            {slugError && <p className="text-xs text-destructive">{slugError}</p>}
            {slugSuccess && <p className="text-xs text-success">{slugSuccess}</p>}
          </div>
        </CardContent>
      </Card>

      {/* Language Preferences */}
      <Card className="border-border">
        <CardHeader>
          <CardTitle>{t('languageRegional')}</CardTitle>
          <CardDescription>
            {t('languageRegionalDesc')}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-1">
              <p className="text-sm font-medium text-muted-foreground">{t('recordingLanguage')}</p>
              <p className="text-sm text-foreground">
                {getLanguageName(profile.default_recording_language)}
              </p>
            </div>
            <div className="space-y-1">
              <p className="text-sm font-medium text-muted-foreground">{t('reportLanguage')}</p>
              <p className="text-sm text-foreground">
                {getLanguageName(profile.preferred_report_language)}
              </p>
            </div>
          </div>
          <div className="space-y-1 pt-2 border-t border-border">
            <p className="text-sm font-medium text-muted-foreground">{t('timezone')}</p>
            <p className="text-sm text-foreground">{profile.timezone}</p>
          </div>
        </CardContent>
      </Card>

      {/* Workflow Settings */}
      <Card className="border-border">
        <CardHeader>
          <CardTitle>{t('workflowAutomation')}</CardTitle>
          <CardDescription>
            {t('workflowAutomationDesc')}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1">
            <p className="text-sm font-medium text-muted-foreground">{t('afterTranscriptCompletes')}</p>
            <p className="text-sm text-foreground">
              {getAfterTranscriptLabel()}
            </p>
          </div>
          {profile.auto_generate_reports && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-secondary/50 border border-border">
              <Shield className="h-4 w-4 text-success" />
              <span className="text-sm text-foreground">
                {t('autoReportEnabled')}
              </span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Voice Sample for Speaker Diarization */}
      <VoiceSampleCard
        displayName={profile.display_name || profile.email?.split("@")[0] || ""}
      />

      {/* Install App - mobile only, not already installed */}
      <InstallAppCard />

      {/* Support & Feedback - Admin only */}
      {profile.role === 'admin' && (
        <Card className="border-border">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bug className="h-5 w-5" />
              {t('helpFeedback')}
            </CardTitle>
            <CardDescription>
              {t('helpFeedbackDesc')}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              {t('helpFeedbackBody')}
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
