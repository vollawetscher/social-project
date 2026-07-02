'use client'

import * as React from 'react'
import { useSearchParams } from 'next/navigation'
import { Link, useRouter } from '@/i18n/navigation'
import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { ArrowLeft, Loader2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { Logo } from '@/components/ui/logo'
import { LocaleSwitcher } from '@/components/locale-switcher'

export default function SignupPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const supabase = createClient()
  const t = useTranslations('auth')

  const [email, setEmail] = useState(searchParams.get('email') || '')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [emailLoading, setEmailLoading] = useState(false)
  const [emailError, setEmailError] = useState<string | null>(null)
  const [emailSuccess, setEmailSuccess] = useState<string | null>(null)

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'

  const handleEmailSignup = async (e: React.FormEvent) => {
    e.preventDefault()
    setEmailError(null)
    setEmailSuccess(null)

    if (password !== confirmPassword) {
      setEmailError(t('passwordsNoMatch'))
      return
    }

    if (password.length < 6) {
      setEmailError(t('passwordMinLength'))
      return
    }

    setEmailLoading(true)
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${siteUrl}/auth/callback?next=/sessions`,
        },
      })

      if (error) throw error

      if (data?.user && data.user.identities && data.user.identities.length === 0) {
        setEmailError(t('emailAlreadyRegistered'))
        return
      }

      if (data?.user) {
        // Back-fill any widget leads from this browser session with the new user id
        try {
          const sid = sessionStorage.getItem('nts_wl_sid')
          if (sid) {
            fetch('/api/landing/widget-lead', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ action: 'link', sessionId: sid }),
            }).catch(() => {})
          }
        } catch { /* sessionStorage unavailable */ }
      }

      if (data?.session) {
        setEmailSuccess(t('accountCreatedRedirect'))
        setTimeout(() => router.push('/sessions'), 2000)
      } else if (data?.user) {
        setEmailSuccess(t('accountCreatedCheckEmail'))
      } else {
        setEmailError(t('unexpectedResponse'))
      }
    } catch (err: any) {
      setEmailError(err?.message || t('failedSignUp'))
    } finally {
      setEmailLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 p-4">
      <div className="absolute top-4 right-4">
        <LocaleSwitcher />
      </div>
      <Link href="/" className="absolute top-4 left-4">
        <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4 mr-1" />
          Back to Home
        </Button>
      </Link>
      <Card className="w-full max-w-xl shadow-lg">
        <CardHeader className="space-y-6">
          <div className="flex flex-col items-center space-y-3">
            <Logo className="h-10" />
          </div>
          <div className="text-center space-y-1 pt-2">
            <CardTitle className="text-2xl font-bold">{t('createAccountTitle')}</CardTitle>
            <CardDescription>{t('signUpDescription')}</CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <div className="mt-6">
            <form onSubmit={handleEmailSignup} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">{t('email')}</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder={t('emailPlaceholder')}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={emailLoading}
                  required
                  autoComplete="email"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">{t('password')}</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder={t('createPasswordPlaceholder')}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={emailLoading}
                  required
                  autoComplete="new-password"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirmPassword">{t('confirmPassword')}</Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  placeholder={t('confirmPasswordPlaceholder')}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  disabled={emailLoading}
                  required
                  autoComplete="new-password"
                />
              </div>

              {emailError && (
                <Alert variant="destructive">
                  <AlertDescription>{emailError}</AlertDescription>
                </Alert>
              )}
              {emailSuccess && (
                <Alert>
                  <AlertDescription>{emailSuccess}</AlertDescription>
                </Alert>
              )}

              <Button type="submit" className="w-full" disabled={emailLoading}>
                {emailLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {t('createAccount')}
              </Button>
            </form>
          </div>
          <p className="mt-5 text-center text-[11px] text-muted-foreground/80">
            Engineered in Germany
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
