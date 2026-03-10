"use client"

export const dynamic = 'force-dynamic'

import { useState, useEffect, useMemo } from "react"
import { useTranslations } from "next-intl"
import { useRouter } from "@/i18n/navigation"
import {
  Shield,
  Lock,
  Clock,
  Database,
  Wifi,
  ExternalLink,
  Info,
  Check,
  AlertTriangle,
  Globe,
  Zap,
  Loader2,
  Save,
  Eye,
  EyeOff,
  Phone,
  Video,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@/components/ui/alert"
import { toast } from "sonner"
import { useAuth } from "@/lib/auth/AuthProvider"
import { Link } from "@/i18n/navigation"
import { createClient } from "@/lib/supabase/client"
import { UserProfile, SUPPORTED_LANGUAGES, TIMEZONES } from "@/lib/types/profile"

export default function SettingsPage() {
  const t = useTranslations('settings')
  const tl = useTranslations('languages')
  const { user, loading: authLoading } = useAuth()
  const router = useRouter()
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  
  // Form state
  const [defaultRecordingLanguage, setDefaultRecordingLanguage] = useState("auto")
  const [preferredReportLanguage, setPreferredReportLanguage] = useState("de")
  const [timezone, setTimezone] = useState("Europe/Berlin")
  const [afterTranscriptTemplateId, setAfterTranscriptTemplateId] = useState<string>("")
  const [templates, setTemplates] = useState<{ id: string; name: string }[]>([])
  const [sessionTimeout, setSessionTimeout] = useState(true)
  const [retentionPolicy, setRetentionPolicy] = useState("90")
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [changingPassword, setChangingPassword] = useState(false)
  const [showNewPassword, setShowNewPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [deleteConfirmText, setDeleteConfirmText] = useState("")
  const [deletingAccount, setDeletingAccount] = useState(false)

  const localizedSupportedLanguages = useMemo(
    () => SUPPORTED_LANGUAGES.map((lang) => ({ value: lang.value, label: tl(lang.value) })),
    [tl]
  )

  const reportLanguageOptions = useMemo(
    () => [
      { value: 'session', label: t('reportLanguageSessionOriginal') },
      ...localizedSupportedLanguages.filter((lang) => lang.value !== 'auto'),
    ],
    [localizedSupportedLanguages, t]
  )

  // Fetch user profile and templates on mount
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
        if (templatesRes.ok) {
          const templatesData = await templatesRes.json()
          setTemplates(templatesData.map((t: { id: string; name: string }) => ({ id: t.id, name: t.name })))
        }
        
        const data: UserProfile = await profileRes.json()
        setProfile(data)
        
        // Populate form with profile data
        setDefaultRecordingLanguage(data.default_recording_language || 'auto')
        setPreferredReportLanguage(data.preferred_report_language || 'de')
        setTimezone(data.timezone || 'Europe/Berlin')
        setAfterTranscriptTemplateId(data.after_transcript_template_id || '')
      } catch (error) {
        console.error('Error fetching profile:', error)
        toast.error(t('loadFailed'))
      } finally {
        setLoading(false)
      }
    }

    if (!authLoading) {
      fetchProfile()
    }
  }, [user, authLoading])

  // Save profile changes
  const handleSave = async () => {
    if (!user) return

    setSaving(true)
    try {
      const response = await fetch('/api/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          default_recording_language: defaultRecordingLanguage,
          preferred_report_language: preferredReportLanguage,
          timezone: timezone,
          after_transcript_template_id: afterTranscriptTemplateId || null,
        })
      })

      if (!response.ok) {
        const errorData = await response.json()
        console.error('Error response from API:', errorData)
        throw new Error(errorData.error || 'Failed to save settings')
      }
      
      const updatedProfile = await response.json()
      setProfile(updatedProfile)
      toast.success(t('saveSuccess'))
    } catch (error) {
      console.error('Error saving settings:', error)
      const errorMessage = error instanceof Error ? error.message : t('saveFailed')
      toast.error(errorMessage)
    } finally {
      setSaving(false)
    }
  }

  const handleChangePassword = async () => {
    if (!user?.email) return
    if (newPassword.length < 6) {
      toast.error(t('passwordTooShort'))
      return
    }
    if (newPassword !== confirmPassword) {
      toast.error(t('passwordMismatch'))
      return
    }
    setChangingPassword(true)
    try {
      const supabase = createClient()
      const { error } = await supabase.auth.updateUser({ password: newPassword })
      if (error) throw error
      toast.success(t('passwordChanged'))
      setNewPassword("")
      setConfirmPassword("")
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : t('passwordChangeFailed')
      toast.error(msg)
    } finally {
      setChangingPassword(false)
    }
  }

  const handleDeleteAccount = async () => {
    if (!user) return
    if (deleteConfirmText.trim().toUpperCase() !== 'DELETE') {
      toast.error(t('deleteAccountTypeToConfirm'))
      return
    }

    setDeletingAccount(true)
    try {
      const response = await fetch('/api/account/delete', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirmText: deleteConfirmText.trim() }),
      })

      if (!response.ok) {
        const data = await response.json().catch(() => null)
        throw new Error(data?.error || t('deleteAccountFailed'))
      }

      const supabase = createClient()
      await supabase.auth.signOut()
      toast.success(t('deleteAccountSuccess'))
      router.replace('/')
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : t('deleteAccountFailed')
      toast.error(errorMessage)
    } finally {
      setDeletingAccount(false)
    }
  }

  if (authLoading || loading) {
    return (
      <div className="max-w-4xl mx-auto py-12 text-center">
        <Loader2 className="h-8 w-8 animate-spin mx-auto text-muted-foreground" />
        <p className="text-sm text-muted-foreground mt-4">{t('loadingSettings')}</p>
      </div>
    )
  }

  if (!user) {
    return (
      <div className="max-w-4xl mx-auto py-12 text-center">
        <AlertTriangle className="h-12 w-12 mx-auto text-warning mb-4" />
        <h2 className="text-lg font-semibold">{t('authRequired')}</h2>
        <p className="text-sm text-muted-foreground mt-2">{t('authRequiredHint')}</p>
      </div>
    )
  }

  return (
    <TooltipProvider>
      <div className="flex-1 min-h-0 overflow-y-auto pb-[max(1rem,env(safe-area-inset-bottom))]">
      <div className="max-w-4xl space-y-6 pb-8">
        {/* Header with Save Button */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-foreground">{t('title')}</h1>
            <p className="text-sm text-muted-foreground mt-1">
              {t('subtitle')}
            </p>
          </div>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                {t('saving')}
              </>
            ) : (
              <>
                <Save className="h-4 w-4 mr-2" />
                {t('saveChanges')}
              </>
            )}
          </Button>
        </div>

        {/* Language Preferences */}
        <Card className="border-border">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Globe className="h-5 w-5" />
              {t('languagePreferences')}
            </CardTitle>
            <CardDescription>
              {t('languagePreferencesDescription')}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Default Recording Language */}
            <div className="space-y-2">
              <Label htmlFor="recording-language" className="font-medium">
                {t('defaultRecordingLanguage')}
              </Label>
              <p className="text-sm text-muted-foreground">
                {t('defaultRecordingLanguageHint')}
              </p>
              <Select value={defaultRecordingLanguage} onValueChange={setDefaultRecordingLanguage}>
                <SelectTrigger className="w-full bg-secondary border-border">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {localizedSupportedLanguages.map((lang) => (
                    <SelectItem key={lang.value} value={lang.value}>
                      {lang.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Preferred Report Language */}
            <div className="space-y-2">
              <Label htmlFor="report-language" className="font-medium">
                {t('preferredReportLanguage')}
              </Label>
              <p className="text-sm text-muted-foreground">
                {t('preferredReportLanguageHint')}
              </p>
              <Select value={preferredReportLanguage} onValueChange={setPreferredReportLanguage}>
                <SelectTrigger className="w-full bg-secondary border-border">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {reportLanguageOptions.map((lang) => (
                    <SelectItem key={lang.value} value={lang.value}>
                      {lang.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Timezone */}
            <div className="space-y-2">
              <Label htmlFor="timezone" className="font-medium flex items-center gap-2">
                <Globe className="h-4 w-4" />
                {t('timezone')}
              </Label>
              <p className="text-sm text-muted-foreground">
                {t('timezoneHint')}
              </p>
              <Select value={timezone} onValueChange={setTimezone}>
                <SelectTrigger className="w-full bg-secondary border-border">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TIMEZONES.map((tz) => (
                    <SelectItem key={tz.value} value={tz.value}>
                      {tz.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Workflow Automation */}
        <Card className="border-border">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Zap className="h-5 w-5" />
              {t('workflowAutomation')}
            </CardTitle>
            <CardDescription>
              {t('workflowAutomationDescription')}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* After Transcript - Template Selector */}
            <div className="space-y-3">
              <Label htmlFor="after-transcript" className="font-medium">
                {t('afterTranscriptCompletes')}
              </Label>
              <p className="text-sm text-muted-foreground mb-3">
                {t('afterTranscriptCompletesHint')}
              </p>
              <Select
                value={afterTranscriptTemplateId || 'nothing'}
                onValueChange={(v) => setAfterTranscriptTemplateId(v === 'nothing' ? '' : v)}
              >
                <SelectTrigger id="after-transcript" className="w-full">
                  <SelectValue placeholder={t('doNothingManual')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="nothing">{t('doNothingManual')}</SelectItem>
                  {templates.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                {t('createTemplatePrefix')}
                <Link
                  href="/templates/new/from-samples"
                  className="text-primary hover:underline inline-flex items-center gap-1"
                >
                  {t('createTemplateFromSamples')}
                </Link>
                {t('orUse')}
                <Link
                  href="/templates"
                  className="text-primary hover:underline inline-flex items-center gap-1"
                >
                  {t('templatesPageLink')}
                </Link>
              </p>
            </div>

            <Alert className="border-info/30 bg-info/10">
              <Info className="h-4 w-4 text-info" />
              <AlertDescription className="text-foreground/80">
                {t('workflowAutomationInfo')}
              </AlertDescription>
            </Alert>
          </CardContent>
        </Card>

        {/* Security Section */}
        <Card className="border-border">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              {t('security')}
            </CardTitle>
            <CardDescription>
              {t('securityDescription')}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* RLS/JWT Info Banner */}
            <Alert className="border-info/30 bg-info/10">
              <Lock className="h-4 w-4 text-info" />
              <AlertTitle className="text-info">{t('rowLevelSecurityEnabled')}</AlertTitle>
              <AlertDescription className="text-foreground/80">
                {t('rowLevelSecurityEnabledHint')}
              </AlertDescription>
            </Alert>

            {/* Session Timeout */}
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <Label htmlFor="session-timeout" className="font-medium">
                    {t('sessionTimeout')}
                  </Label>
                </div>
                <p className="text-sm text-muted-foreground">
                  {t('sessionTimeoutHint')}
                </p>
              </div>
              <Switch
                id="session-timeout"
                checked={sessionTimeout}
                onCheckedChange={setSessionTimeout}
              />
            </div>

            <div className="flex items-center gap-2 p-3 rounded-lg bg-secondary/50 border border-border">
              <Check className="h-4 w-4 text-success" />
              <span className="text-sm text-foreground">
                {t('twoFactorEnabled')}
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Privacy & Data Retention */}
        <Card className="border-border">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Database className="h-5 w-5" />
              {t('privacyAndRetention')}
            </CardTitle>
            <CardDescription>
              {t('privacyAndRetentionDescription')}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Retention Policy */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Label htmlFor="retention" className="font-medium">
                  {t('dataRetentionPolicy')}
                </Label>
                <Badge variant="outline" className="text-[10px]">
                  GDPR
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground mb-2">
                {t('dataRetentionPolicyHint')}
              </p>
              <Select value={retentionPolicy} onValueChange={setRetentionPolicy}>
                <SelectTrigger className="w-[200px] bg-secondary border-border">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="30">{t('retention30')}</SelectItem>
                  <SelectItem value="90">{t('retention90')}</SelectItem>
                  <SelectItem value="180">{t('retention180')}</SelectItem>
                  <SelectItem value="365">{t('retention365')}</SelectItem>
                  <SelectItem value="never">{t('retentionNever')}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Alert className="border-warning/30 bg-warning/10">
              <AlertTriangle className="h-4 w-4 text-warning" />
              <AlertTitle className="text-warning">{t('dataSubjectRequests')}</AlertTitle>
              <AlertDescription className="text-foreground/80">
                {t('dataSubjectRequestsHint')}
              </AlertDescription>
            </Alert>
          </CardContent>
        </Card>


        {/* Integrations & Security Section */}
        <Card className="border-border">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              {t('infrastructure')}
            </CardTitle>
            <CardDescription>
              {t('infrastructureDescription')}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Security Overview */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { icon: <Globe className="h-4 w-4" />, label: t('euHosting'), detail: t('euHostingDetail') },
                { icon: <Lock className="h-4 w-4" />, label: t('encryption'), detail: t('encryptionDetail') },
                { icon: <Shield className="h-4 w-4" />, label: t('rowLevelSecurity'), detail: t('rowLevelSecurityDetail') },
                { icon: <Eye className="h-4 w-4" />, label: t('consentLogging'), detail: t('consentLoggingDetail') },
              ].map((item) => (
                <div key={item.label} className="flex flex-col items-center gap-1.5 p-3 rounded-lg border border-success/30 bg-success/5 text-center">
                  <div className="text-success">{item.icon}</div>
                  <p className="text-xs font-medium text-foreground">{item.label}</p>
                  <p className="text-[10px] text-muted-foreground">{item.detail}</p>
                </div>
              ))}
            </div>

            {/* Service Cards */}
            <div className="grid gap-4 md:grid-cols-3">
              {/* Transcription Service */}
              <div className="p-4 rounded-lg border border-border bg-secondary/30">
                <div className="flex items-center justify-between mb-3">
                  <div className="h-8 w-8 rounded bg-primary/10 flex items-center justify-center">
                    <span className="text-xs font-bold text-primary">TR</span>
                  </div>
                  <Badge className="bg-success/20 text-success border-success/30">
                    {t('connected')}
                  </Badge>
                </div>
                <h4 className="font-medium text-foreground">{t('serviceSpeechmatics')}</h4>
                <p className="text-xs text-muted-foreground mt-1">
                  {t('serviceSpeechmaticsDesc')}
                </p>
                <div className="flex flex-wrap gap-1 mt-2">
                  <Badge variant="outline" className="text-[9px] h-4 px-1.5">{t('serviceEuHosted')}</Badge>
                  <Badge variant="outline" className="text-[9px] h-4 px-1.5">SOC 2</Badge>
                  <Badge variant="outline" className="text-[9px] h-4 px-1.5">{t('serviceNoDataRetention')}</Badge>
                </div>
              </div>

              {/* LLM */}
              <div className="p-4 rounded-lg border border-border bg-secondary/30">
                <div className="flex items-center justify-between mb-3">
                  <div className="h-8 w-8 rounded bg-primary/10 flex items-center justify-center">
                    <span className="text-xs font-bold text-primary">AI</span>
                  </div>
                  <Badge className="bg-success/20 text-success border-success/30">
                    {t('connected')}
                  </Badge>
                </div>
                <h4 className="font-medium text-foreground">{t('serviceClaude')}</h4>
                <p className="text-xs text-muted-foreground mt-1">
                  {t('serviceClaudeDesc')}
                </p>
                <div className="flex flex-wrap gap-1 mt-2">
                  <Badge variant="outline" className="text-[9px] h-4 px-1.5">{t('serviceNoTraining')}</Badge>
                  <Badge variant="outline" className="text-[9px] h-4 px-1.5">SOC 2</Badge>
                </div>
              </div>

              {/* Database */}
              <div className="p-4 rounded-lg border border-border bg-secondary/30">
                <div className="flex items-center justify-between mb-3">
                  <div className="h-8 w-8 rounded bg-primary/10 flex items-center justify-center">
                    <Database className="h-4 w-4 text-primary" />
                  </div>
                  <Badge className="bg-success/20 text-success border-success/30">
                    {t('connected')}
                  </Badge>
                </div>
                <h4 className="font-medium text-foreground">{t('serviceSupabase')}</h4>
                <p className="text-xs text-muted-foreground mt-1">
                  {t('serviceSupabaseDesc')}
                </p>
                <div className="flex flex-wrap gap-1 mt-2">
                  <Badge variant="outline" className="text-[9px] h-4 px-1.5">{t('serviceEuRegion')}</Badge>
                  <Badge variant="outline" className="text-[9px] h-4 px-1.5">{t('serviceRlsEnabled')}</Badge>
                  <Badge variant="outline" className="text-[9px] h-4 px-1.5">AES-256</Badge>
                </div>
              </div>

              {/* Hosting */}
              <div className="p-4 rounded-lg border border-border bg-secondary/30">
                <div className="flex items-center justify-between mb-3">
                  <div className="h-8 w-8 rounded bg-primary/10 flex items-center justify-center">
                    <Wifi className="h-4 w-4 text-primary" />
                  </div>
                  <Badge className="bg-success/20 text-success border-success/30">
                    {t('connected')}
                  </Badge>
                </div>
                <h4 className="font-medium text-foreground">{t('serviceRailway')}</h4>
                <p className="text-xs text-muted-foreground mt-1">
                  {t('serviceRailwayDesc')}
                </p>
                <div className="flex flex-wrap gap-1 mt-2">
                  <Badge variant="outline" className="text-[9px] h-4 px-1.5">{t('serviceEuRegion')}</Badge>
                  <Badge variant="outline" className="text-[9px] h-4 px-1.5">TLS 1.3</Badge>
                  <Badge variant="outline" className="text-[9px] h-4 px-1.5">SOC 2</Badge>
                </div>
              </div>

              {/* Phone Service */}
              <div className="p-4 rounded-lg border border-border bg-secondary/30">
                <div className="flex items-center justify-between mb-3">
                  <div className="h-8 w-8 rounded bg-primary/10 flex items-center justify-center">
                    <Phone className="h-4 w-4 text-primary" />
                  </div>
                  <Badge className="bg-success/20 text-success border-success/30">
                    {t('connected')}
                  </Badge>
                </div>
                <h4 className="font-medium text-foreground">{t('serviceTwilio')}</h4>
                <p className="text-xs text-muted-foreground mt-1">
                  {t('serviceTwilioDesc')}
                </p>
                <div className="flex flex-wrap gap-1 mt-2">
                  <Badge variant="outline" className="text-[9px] h-4 px-1.5">{t('serviceEncryptedSignaling')}</Badge>
                  <Badge variant="outline" className="text-[9px] h-4 px-1.5">GDPR DPA</Badge>
                </div>
              </div>

              {/* Video Conference Server */}
              <div className="p-4 rounded-lg border border-border bg-secondary/30">
                <div className="flex items-center justify-between mb-3">
                  <div className="h-8 w-8 rounded bg-info/10 flex items-center justify-center">
                    <Video className="h-4 w-4 text-info" />
                  </div>
                  <Badge className="bg-success/20 text-success border-success/30">
                    {t('connected')}
                  </Badge>
                </div>
                <h4 className="font-medium text-foreground">{t('serviceLiveKit')}</h4>
                <p className="text-xs text-muted-foreground mt-1">
                  {t('serviceLiveKitDesc')}
                </p>
                <div className="flex flex-wrap gap-1 mt-2">
                  <Badge variant="outline" className="text-[9px] h-4 px-1.5">{t('serviceEuHosted')}</Badge>
                  <Badge variant="outline" className="text-[9px] h-4 px-1.5">E2E encrypted</Badge>
                  <Badge variant="outline" className="text-[9px] h-4 px-1.5">DTLS/SRTP</Badge>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Danger Zone */}
        <Card className="border-destructive/40 bg-destructive/5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              {t('dangerZone')}
            </CardTitle>
            <CardDescription className="text-foreground/80">
              {t('dangerZoneDescription')}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Alert className="border-destructive/40 bg-destructive/10">
              <AlertTriangle className="h-4 w-4 text-destructive" />
              <AlertTitle className="text-destructive">{t('deleteAccount')}</AlertTitle>
              <AlertDescription className="text-foreground/80">
                {t('deleteAccountWarning')}
              </AlertDescription>
            </Alert>

            <div className="space-y-2">
              <Label htmlFor="delete-confirm" className="font-medium">
                {t('deleteAccountConfirmLabel')}
              </Label>
              <Input
                id="delete-confirm"
                value={deleteConfirmText}
                onChange={(e) => setDeleteConfirmText(e.target.value)}
                placeholder={t('deleteAccountConfirmPlaceholder')}
                autoComplete="off"
              />
              <p className="text-xs text-muted-foreground">{t('deleteAccountTypeToConfirm')}</p>
            </div>

            <Button
              type="button"
              variant="destructive"
              onClick={handleDeleteAccount}
              disabled={deletingAccount || deleteConfirmText.trim().toUpperCase() !== 'DELETE'}
            >
              {deletingAccount ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  {t('deleteAccountDeleting')}
                </>
              ) : (
                t('deleteAccount')
              )}
            </Button>
          </CardContent>
        </Card>
      </div>
      </div>
    </TooltipProvider>
  )
}
