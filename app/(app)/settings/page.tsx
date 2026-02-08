"use client"

export const dynamic = 'force-dynamic'

import { useState, useEffect } from "react"
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
  Languages,
  Globe,
  Zap,
  Loader2,
  Save,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
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
import { UserProfile, SUPPORTED_LANGUAGES, TIMEZONES, AFTER_TRANSCRIPT_ACTIONS } from "@/lib/types/profile"

export default function SettingsPage() {
  const { user, loading: authLoading } = useAuth()
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  
  // Form state
  const [defaultRecordingLanguage, setDefaultRecordingLanguage] = useState("de")
  const [preferredReportLanguage, setPreferredReportLanguage] = useState("de")
  const [timezone, setTimezone] = useState("Europe/Berlin")
  const [afterTranscriptAction, setAfterTranscriptAction] = useState<string>("nothing")
  const [sessionTimeout, setSessionTimeout] = useState(true)
  const [retentionPolicy, setRetentionPolicy] = useState("90")

  // Fetch user profile on mount
  useEffect(() => {
    async function fetchProfile() {
      if (!user) {
        setLoading(false)
        return
      }

      try {
        const response = await fetch('/api/profile')
        if (!response.ok) throw new Error('Failed to fetch profile')
        
        const data: UserProfile = await response.json()
        setProfile(data)
        
        // Populate form with profile data
        setDefaultRecordingLanguage(data.default_recording_language || 'de')
        setPreferredReportLanguage(data.preferred_report_language || 'de')
        setTimezone(data.timezone || 'Europe/Berlin')
        setAfterTranscriptAction(data.after_transcript_action || 'nothing')
      } catch (error) {
        console.error('Error fetching profile:', error)
        toast.error('Failed to load settings')
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
          after_transcript_action: afterTranscriptAction,
        })
      })

      if (!response.ok) throw new Error('Failed to save settings')
      
      const updatedProfile = await response.json()
      setProfile(updatedProfile)
      toast.success('Settings saved successfully')
    } catch (error) {
      console.error('Error saving settings:', error)
      toast.error('Failed to save settings')
    } finally {
      setSaving(false)
    }
  }

  if (authLoading || loading) {
    return (
      <div className="max-w-4xl mx-auto py-12 text-center">
        <Loader2 className="h-8 w-8 animate-spin mx-auto text-muted-foreground" />
        <p className="text-sm text-muted-foreground mt-4">Loading settings...</p>
      </div>
    )
  }

  if (!user) {
    return (
      <div className="max-w-4xl mx-auto py-12 text-center">
        <AlertTriangle className="h-12 w-12 mx-auto text-warning mb-4" />
        <h2 className="text-lg font-semibold">Authentication Required</h2>
        <p className="text-sm text-muted-foreground mt-2">Please log in to access settings</p>
      </div>
    )
  }

  return (
    <TooltipProvider>
      <div className="max-w-4xl space-y-6">
        {/* Header with Save Button */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-foreground">Settings</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Manage your language, workflow, and integration preferences
            </p>
          </div>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="h-4 w-4 mr-2" />
                Save Changes
              </>
            )}
          </Button>
        </div>

        {/* Language Preferences */}
        <Card className="border-border">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Languages className="h-5 w-5" />
              Language Preferences
            </CardTitle>
            <CardDescription>
              Set your default languages for transcription and reports
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Default Recording Language */}
            <div className="space-y-2">
              <Label htmlFor="recording-language" className="font-medium">
                Default Recording Language
              </Label>
              <p className="text-sm text-muted-foreground">
                Language used for audio transcription (you can override per session)
              </p>
              <Select value={defaultRecordingLanguage} onValueChange={setDefaultRecordingLanguage}>
                <SelectTrigger className="w-full bg-secondary border-border">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SUPPORTED_LANGUAGES.map((lang) => (
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
                Preferred Report Language
              </Label>
              <p className="text-sm text-muted-foreground">
                Language used for AI-generated reports and summaries
              </p>
              <Select value={preferredReportLanguage} onValueChange={setPreferredReportLanguage}>
                <SelectTrigger className="w-full bg-secondary border-border">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SUPPORTED_LANGUAGES.map((lang) => (
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
                Timezone
              </Label>
              <p className="text-sm text-muted-foreground">
                Used for displaying timestamps in sessions and reports
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
              Workflow Automation
            </CardTitle>
            <CardDescription>
              Automatic actions after transcription completes
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* After Transcript Action */}
            <div className="space-y-3">
              <Label htmlFor="after-transcript" className="font-medium">
                After Transcript Completes
              </Label>
              <p className="text-sm text-muted-foreground mb-3">
                Choose what happens automatically after a recording is transcribed
              </p>
              <div className="space-y-2">
                {AFTER_TRANSCRIPT_ACTIONS.map((action) => (
                  <div
                    key={action.value}
                    onClick={() => setAfterTranscriptAction(action.value)}
                    className={`p-4 rounded-lg border cursor-pointer transition-colors ${
                      afterTranscriptAction === action.value
                        ? 'border-primary bg-primary/5'
                        : 'border-border hover:border-primary/50'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div className={`mt-0.5 h-4 w-4 rounded-full border-2 flex items-center justify-center ${
                        afterTranscriptAction === action.value
                          ? 'border-primary'
                          : 'border-muted-foreground'
                      }`}>
                        {afterTranscriptAction === action.value && (
                          <div className="h-2 w-2 rounded-full bg-primary" />
                        )}
                      </div>
                      <div className="flex-1">
                        <p className="font-medium text-foreground">{action.label}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">{action.description}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <Alert className="border-info/30 bg-info/10">
              <Info className="h-4 w-4 text-info" />
              <AlertDescription className="text-foreground/80">
                You can always manually generate additional reports or summaries from any session, 
                regardless of this setting.
              </AlertDescription>
            </Alert>
          </CardContent>
        </Card>

        {/* Security Section */}
        <Card className="border-border">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              Security
            </CardTitle>
            <CardDescription>
              Authentication and access control settings
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* RLS/JWT Info Banner */}
            <Alert className="border-info/30 bg-info/10">
              <Lock className="h-4 w-4 text-info" />
              <AlertTitle className="text-info">Row Level Security Enabled</AlertTitle>
              <AlertDescription className="text-foreground/80">
                Your data is protected by Supabase Row Level Security (RLS). All database
                access is authenticated via JWT tokens and scoped to your organization.
              </AlertDescription>
            </Alert>

            {/* Session Timeout */}
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <Label htmlFor="session-timeout" className="font-medium">
                    Session Timeout
                  </Label>
                </div>
                <p className="text-sm text-muted-foreground">
                  Automatically log out after 30 minutes of inactivity
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
                Two-factor authentication is enabled for your account
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Privacy & Data Retention */}
        <Card className="border-border">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Database className="h-5 w-5" />
              Privacy & Data Retention
            </CardTitle>
            <CardDescription>
              GDPR compliance and data handling preferences
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Retention Policy */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Label htmlFor="retention" className="font-medium">
                  Data Retention Policy
                </Label>
                <Badge variant="outline" className="text-[10px]">
                  GDPR
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground mb-2">
                Automatically delete sessions and outputs after this period
              </p>
              <Select value={retentionPolicy} onValueChange={setRetentionPolicy}>
                <SelectTrigger className="w-[200px] bg-secondary border-border">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="30">30 days</SelectItem>
                  <SelectItem value="90">90 days</SelectItem>
                  <SelectItem value="180">180 days</SelectItem>
                  <SelectItem value="365">1 year</SelectItem>
                  <SelectItem value="never">Never (manual only)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Alert className="border-warning/30 bg-warning/10">
              <AlertTriangle className="h-4 w-4 text-warning" />
              <AlertTitle className="text-warning">Data Subject Requests</AlertTitle>
              <AlertDescription className="text-foreground/80">
                To request data export or deletion under GDPR, please contact your
                organization administrator or support@notissima.app
              </AlertDescription>
            </Alert>
          </CardContent>
        </Card>


        {/* Integrations Section */}
        <Card className="border-border">
          <CardHeader>
            <CardTitle>Integrations</CardTitle>
            <CardDescription>
              Connected services and APIs
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-3">
              {/* Transcription Service */}
              <div className="p-4 rounded-lg border border-border bg-secondary/30">
                <div className="flex items-center justify-between mb-3">
                  <div className="h-8 w-8 rounded bg-primary/10 flex items-center justify-center">
                    <span className="text-xs font-bold text-primary">TR</span>
                  </div>
                  <Badge className="bg-success/20 text-success border-success/30">
                    Connected
                  </Badge>
                </div>
                <h4 className="font-medium text-foreground">DSGVO-Compliant Transcription</h4>
                <p className="text-xs text-muted-foreground mt-1">
                  EU-hosted speech-to-text
                </p>
                <Button variant="ghost" size="sm" className="mt-3 w-full justify-start text-xs">
                  <ExternalLink className="h-3 w-3 mr-1" />
                  Configure
                </Button>
              </div>

              {/* LLM */}
              <div className="p-4 rounded-lg border border-border bg-secondary/30">
                <div className="flex items-center justify-between mb-3">
                  <div className="h-8 w-8 rounded bg-primary/10 flex items-center justify-center">
                    <span className="text-xs font-bold text-primary">AI</span>
                  </div>
                  <Badge className="bg-success/20 text-success border-success/30">
                    Connected
                  </Badge>
                </div>
                <h4 className="font-medium text-foreground">LLM</h4>
                <p className="text-xs text-muted-foreground mt-1">
                  AI-powered content generation
                </p>
                <Button variant="ghost" size="sm" className="mt-3 w-full justify-start text-xs">
                  <ExternalLink className="h-3 w-3 mr-1" />
                  Configure
                </Button>
              </div>

              {/* Database */}
              <div className="p-4 rounded-lg border border-border bg-secondary/30">
                <div className="flex items-center justify-between mb-3">
                  <div className="h-8 w-8 rounded bg-primary/10 flex items-center justify-center">
                    <span className="text-xs font-bold text-primary">DB</span>
                  </div>
                  <Badge className="bg-success/20 text-success border-success/30">
                    Connected
                  </Badge>
                </div>
                <h4 className="font-medium text-foreground">Database</h4>
                <p className="text-xs text-muted-foreground mt-1">
                  Secure data storage & auth
                </p>
                <Button variant="ghost" size="sm" className="mt-3 w-full justify-start text-xs">
                  <ExternalLink className="h-3 w-3 mr-1" />
                  Configure
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </TooltipProvider>
  )
}
