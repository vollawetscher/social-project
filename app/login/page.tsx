'use client'

import { useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'
import { Mail, Loader2 } from 'lucide-react'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const router = useRouter()
  const searchParams = useSearchParams()
  const supabase = createClient()

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!email || !email.includes('@')) {
      toast.error('Bitte geben Sie eine gültige E-Mail-Adresse ein')
      return
    }

    setLoading(true)

    try {
      const redirectUrl = `${process.env.NEXT_PUBLIC_APP_URL || window.location.origin}/auth/callback`

      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: redirectUrl,
        },
      })

      if (error) {
        toast.error('Fehler beim Senden des Magic Links: ' + error.message)
      } else {
        setSent(true)
        toast.success('Magic Link wurde an Ihre E-Mail-Adresse gesendet')
      }
    } catch (error) {
      toast.error('Ein unerwarteter Fehler ist aufgetreten')
    } finally {
      setLoading(false)
    }
  }

  if (sent) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mb-4">
              <Mail className="w-6 h-6 text-green-600" />
            </div>
            <CardTitle>E-Mail versendet</CardTitle>
            <CardDescription>
              Wir haben Ihnen einen Magic Link an <strong>{email}</strong> gesendet.
              Bitte überprüfen Sie Ihr Postfach und klicken Sie auf den Link, um sich anzumelden.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              variant="outline"
              className="w-full"
              onClick={() => {
                setSent(false)
                setEmail('')
              }}
            >
              Andere E-Mail-Adresse verwenden
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold">Rohbericht MVP</CardTitle>
          <CardDescription>
            Melden Sie sich mit Ihrer E-Mail-Adresse an. Wir senden Ihnen einen Magic Link.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">E-Mail-Adresse</Label>
              <Input
                id="email"
                type="email"
                placeholder="name@beispiel.de"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={loading}
                required
              />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Wird gesendet...
                </>
              ) : (
                <>
                  <Mail className="mr-2 h-4 w-4" />
                  Magic Link senden
                </>
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
