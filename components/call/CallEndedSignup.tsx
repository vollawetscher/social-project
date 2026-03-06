"use client"

import { useState } from "react"
import { useTranslations } from "next-intl"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Logo } from "@/components/ui/logo"
import { CheckCircle, ArrowRight, Clock } from "lucide-react"

interface CallEndedSignupProps {
  callerName: string
  callId: string
}

export function CallEndedSignup({ callerName, callId }: CallEndedSignupProps) {
  const t = useTranslations('callEnded')
  const [email, setEmail] = useState("")

  function saveAndRedirect(path: string) {
    if (callId) {
      localStorage.setItem("pendingCallId", callId)
    }
    const url = new URL(path, window.location.origin)
    if (email) {
      url.searchParams.set("email", email)
    }
    window.location.href = url.toString()
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 p-4">
      <div className="w-full max-w-md space-y-6">
        {/* Logo */}
        <div className="flex justify-center">
          <Logo className="h-8" />
        </div>

        {/* Processing notice */}
        <div className="bg-card border border-border rounded-xl p-5 space-y-3">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-full bg-warning/15 flex items-center justify-center shrink-0">
              <Clock className="h-5 w-5 text-warning" />
            </div>
            <div>
              <p className="font-medium text-foreground text-sm">{t('recordingProcessing')}</p>
              <p className="text-xs text-muted-foreground">
                {t('callBeingTranscribed', { name: callerName })}
              </p>
            </div>
          </div>
        </div>

        {/* CTA card */}
        <div className="bg-card border border-border rounded-xl p-6 space-y-5">
          <div className="space-y-1">
            <h1 className="text-xl font-bold text-foreground">{t('accessRecording')}</h1>
            <p className="text-sm text-muted-foreground">
              {t('freeAccountDescription')}
            </p>
          </div>

          {/* Benefits */}
          <ul className="space-y-2">
            {(['featureTranscript', 'featureSummary', 'featureReports'] as const).map((key) => (
              <li key={key} className="flex items-center gap-2 text-sm text-muted-foreground">
                <CheckCircle className="h-4 w-4 text-success shrink-0" />
                {t(key)}
              </li>
            ))}
          </ul>

          {/* Email input */}
          <div className="space-y-2">
            <Label htmlFor="email" className="text-sm">
              {t('yourEmail')}
            </Label>
            <Input
              id="email"
              type="email"
              placeholder={t('emailPlaceholder')}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              onKeyDown={(e) => {
                if (e.key === "Enter" && email) saveAndRedirect("/signup")
              }}
            />
          </div>

          <Button
            className="w-full"
            onClick={() => saveAndRedirect("/signup")}
            disabled={!email}
          >
            {t('createAccount')}
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>

          <p className="text-center text-sm text-muted-foreground">
            {t('alreadyHaveAccount')}{" "}
            <button
              className="text-primary hover:underline font-medium"
              onClick={() => saveAndRedirect("/login")}
            >
              {t('logIn')}
            </button>
          </p>
        </div>

        <p className="text-center text-xs text-muted-foreground">
          {t('recordingReady')}
        </p>
      </div>
    </div>
  )
}
