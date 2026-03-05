'use client'
export const dynamic = 'force-dynamic'

import * as React from 'react'
import { useSearchParams } from 'next/navigation'
import { Link, useRouter } from '@/i18n/navigation'
import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Loader2 } from 'lucide-react'
import { useAuth } from '@/lib/auth/AuthProvider'
import { createClient } from '@/lib/supabase/client'
import { Logo } from '@/components/ui/logo'
import { LocaleSwitcher } from '@/components/locale-switcher'

export default function LoginPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { user } = useAuth()
  const supabase = createClient()
  const t = useTranslations('auth')
  const tc = useTranslations('common')

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const redirectParam = searchParams?.get('redirect')
  const redirect = redirectParam && redirectParam.startsWith('/') ? redirectParam : '/sessions'

  React.useEffect(() => {
    if (user) {
      router.push(redirect)
    }
  }, [user, router, redirect])

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) throw error
      router.refresh()
      router.push(redirect)
    } catch (err: any) {
      setError(err.message || t('failedSignIn'))
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 p-4">
      <div className="absolute top-4 right-4">
        <LocaleSwitcher />
      </div>
      <Link href="/" className="absolute top-4 left-4">
        <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground">
          &larr; Back to Home
        </Button>
      </Link>
      <Card className="w-full max-w-md shadow-lg">
        <CardHeader className="space-y-6">
          <div className="flex flex-col items-center space-y-3">
            <Logo className="h-10" />
            <div className="text-center space-y-1">
              <p className="text-lg font-medium text-foreground">{tc('tagline')}</p>
              <p className="text-xs text-muted-foreground">{tc('madeInGermany')}</p>
            </div>
          </div>
          <div className="text-center space-y-1 pt-2">
            <CardTitle className="text-2xl font-bold">{t('signInTitle')}</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">{t('email')}</Label>
              <Input
                id="email"
                type="email"
                placeholder={t('emailPlaceholder')}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={loading}
                required
                autoComplete="email"
              />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="password">{t('password')}</Label>
                <Link href="/reset-password" className="text-xs text-primary hover:underline">
                  {t('forgotPassword')}
                </Link>
              </div>
              <Input
                id="password"
                type="password"
                placeholder={t('passwordPlaceholder')}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={loading}
                required
                autoComplete="current-password"
              />
            </div>

            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <Button type="submit" className="w-full" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t('signIn')}
            </Button>
          </form>
          <div className="mt-4 text-center text-sm text-muted-foreground">
            {t('noAccount')}{' '}
            <Link href="/signup" className="text-primary underline-offset-2 hover:underline">
              {t('signUp')}
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
