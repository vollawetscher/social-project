"use client"

export const dynamic = 'force-dynamic'

import { useState } from "react"
import {
  Shield,
  Lock,
  Eye,
  Clock,
  Database,
  Wifi,
  Trash2,
  ExternalLink,
  Info,
  Check,
  AlertTriangle,
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

export default function SettingsPage() {
  const [sessionTimeout, setSessionTimeout] = useState(true)
  const [piiRedactionDefault, setPiiRedactionDefault] = useState(true)
  const [retentionPolicy, setRetentionPolicy] = useState("90")

  return (
    <TooltipProvider>
      <div className="max-w-4xl space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Settings</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage your security, privacy, and integration preferences
          </p>
        </div>

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

        {/* Privacy Section */}
        <Card className="border-border">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Eye className="h-5 w-5" />
              Privacy
            </CardTitle>
            <CardDescription>
              GDPR compliance and data handling preferences
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* PII Redaction Default */}
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <div className="flex items-center gap-2">
                  <Label htmlFor="pii-default" className="font-medium">
                    Default PII Redaction
                  </Label>
                  <Tooltip>
                    <TooltipTrigger>
                      <Info className="h-3.5 w-3.5 text-muted-foreground" />
                    </TooltipTrigger>
                    <TooltipContent className="max-w-[200px]">
                      When enabled, all new sessions will have PII redaction turned on by default
                    </TooltipContent>
                  </Tooltip>
                </div>
                <p className="text-sm text-muted-foreground">
                  Automatically redact emails, phone numbers, and addresses
                </p>
              </div>
              <Switch
                id="pii-default"
                checked={piiRedactionDefault}
                onCheckedChange={setPiiRedactionDefault}
              />
            </div>

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

        {/* PWA / Offline Section */}
        <Card className="border-border">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Wifi className="h-5 w-5" />
              Offline & PWA
            </CardTitle>
            <CardDescription>
              Progressive Web App and offline cache settings
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <div className="flex items-center gap-2">
                  <Database className="h-4 w-4 text-muted-foreground" />
                  <Label className="font-medium">Offline Cache Size</Label>
                </div>
                <p className="text-sm text-muted-foreground">
                  IndexedDB storage used for offline access
                </p>
              </div>
              <div className="text-right">
                <p className="font-medium text-foreground">245 MB</p>
                <p className="text-xs text-muted-foreground">of 500 MB limit</p>
              </div>
            </div>

            <div className="h-2 rounded-full bg-secondary overflow-hidden">
              <div className="h-full w-[49%] bg-info rounded-full" />
            </div>

            <div className="flex items-center justify-between p-3 rounded-lg bg-secondary/50 border border-border">
              <div className="flex items-center gap-2">
                <Check className="h-4 w-4 text-success" />
                <span className="text-sm text-foreground">
                  3 sessions cached for offline access
                </span>
              </div>
              <Button variant="outline" size="sm" className="text-destructive bg-transparent">
                <Trash2 className="h-4 w-4 mr-2" />
                Clear Cache
              </Button>
            </div>

            <p className="text-xs text-muted-foreground">
              Cached sessions are stored locally using IndexedDB and encrypted at rest.
              They will sync automatically when you reconnect.
            </p>
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
              {/* Speechmatics */}
              <div className="p-4 rounded-lg border border-border bg-secondary/30">
                <div className="flex items-center justify-between mb-3">
                  <div className="h-8 w-8 rounded bg-primary/10 flex items-center justify-center">
                    <span className="text-xs font-bold text-primary">SM</span>
                  </div>
                  <Badge className="bg-success/20 text-success border-success/30">
                    Connected
                  </Badge>
                </div>
                <h4 className="font-medium text-foreground">Speechmatics</h4>
                <p className="text-xs text-muted-foreground mt-1">
                  GDPR-compliant speech-to-text
                </p>
                <Button variant="ghost" size="sm" className="mt-3 w-full justify-start text-xs">
                  <ExternalLink className="h-3 w-3 mr-1" />
                  Configure
                </Button>
              </div>

              {/* Anthropic */}
              <div className="p-4 rounded-lg border border-border bg-secondary/30">
                <div className="flex items-center justify-between mb-3">
                  <div className="h-8 w-8 rounded bg-primary/10 flex items-center justify-center">
                    <span className="text-xs font-bold text-primary">A</span>
                  </div>
                  <Badge className="bg-success/20 text-success border-success/30">
                    Connected
                  </Badge>
                </div>
                <h4 className="font-medium text-foreground">Anthropic</h4>
                <p className="text-xs text-muted-foreground mt-1">
                  Claude Sonnet 4.5 for generation
                </p>
                <Button variant="ghost" size="sm" className="mt-3 w-full justify-start text-xs">
                  <ExternalLink className="h-3 w-3 mr-1" />
                  Configure
                </Button>
              </div>

              {/* Supabase */}
              <div className="p-4 rounded-lg border border-border bg-secondary/30">
                <div className="flex items-center justify-between mb-3">
                  <div className="h-8 w-8 rounded bg-primary/10 flex items-center justify-center">
                    <span className="text-xs font-bold text-primary">SB</span>
                  </div>
                  <Badge className="bg-success/20 text-success border-success/30">
                    Connected
                  </Badge>
                </div>
                <h4 className="font-medium text-foreground">Supabase</h4>
                <p className="text-xs text-muted-foreground mt-1">
                  Auth, Storage, and Database
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
