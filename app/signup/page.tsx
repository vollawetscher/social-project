'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2 } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { Logo } from '@/components/ui/logo';

export default function SignupPage() {
  const router = useRouter();
  const supabase = createClient();

  // Email signup state
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [emailLoading, setEmailLoading] = useState(false);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [emailSuccess, setEmailSuccess] = useState<string | null>(null);

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';

  const handleEmailSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setEmailError(null);
    setEmailSuccess(null);

    if (password !== confirmPassword) {
      setEmailError('Passwords do not match');
      return;
    }

    if (password.length < 6) {
      setEmailError('Password must be at least 6 characters');
      return;
    }

    setEmailLoading(true);
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${siteUrl}/auth/callback?next=/sessions`,
        },
      });

      if (error) throw error;

      // Check if user already exists (will have identities but no session)
      if (data?.user && data.user.identities && data.user.identities.length === 0) {
        // Email already registered - Supabase returns user but no identities
        setEmailError('This email is already registered. Please check your inbox for the confirmation email, or try logging in.');
        return;
      }

      // Check if user is auto-confirmed (email confirmation disabled)
      if (data?.session) {
        // User has immediate session = auto-confirmed
        setEmailSuccess('Account created! Redirecting to dashboard...');
        setTimeout(() => router.push('/sessions'), 2000);
      } else if (data?.user) {
        // User created but no session = email confirmation required
        setEmailSuccess('Account created! Check your email for a confirmation link. Note: Email delivery may take a few minutes due to rate limits.');
      } else {
        // Unexpected response
        setEmailError('Unexpected response. Please try logging in.');
      }
    } catch (err: any) {
      setEmailError(err?.message || 'Failed to sign up');
    } finally {
      setEmailLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 p-4">
      <Card className="w-full max-w-xl shadow-lg">
        <CardHeader className="space-y-6">
          {/* Logo and Branding */}
          <div className="flex flex-col items-center space-y-3">
            <Logo className="h-10" />
            <div className="text-center space-y-1">
              <p className="text-lg font-medium text-foreground">
                When words carry weight
              </p>
              <p className="text-xs text-muted-foreground">
                Made in Germany
              </p>
            </div>
          </div>
          
          {/* Sign Up Header */}
          <div className="text-center space-y-1 pt-2">
            <CardTitle className="text-2xl font-bold">Create your account</CardTitle>
            <CardDescription>
              Sign up with your email address
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <div className="mt-6">
              <form onSubmit={handleEmailSignup} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="name@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    disabled={emailLoading}
                    required
                    autoComplete="email"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">Password</Label>
                  <Input
                    id="password"
                    type="password"
                    placeholder="Create a password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    disabled={emailLoading}
                    required
                    autoComplete="new-password"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="confirmPassword">Confirm password</Label>
                  <Input
                    id="confirmPassword"
                    type="password"
                    placeholder="Re-enter your password"
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
                  Create account
                </Button>
              </form>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

