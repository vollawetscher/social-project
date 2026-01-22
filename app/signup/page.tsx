'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { CountryCodeSelector } from '@/components/auth/CountryCodeSelector';
import { OTPInput } from '@/components/auth/OTPInput';
import { Loader2 } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { isValidPhoneNumber, formatPhoneNumber } from '@/lib/services/sms';

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

  // Phone signup state
  const [dialCode, setDialCode] = useState('+49');
  const [localPhone, setLocalPhone] = useState('');
  const [requestingOTP, setRequestingOTP] = useState(false);
  const [verifyingOTP, setVerifyingOTP] = useState(false);
  const [otpRequested, setOtpRequested] = useState(false);
  const [otpCode, setOtpCode] = useState('');
  const [phoneError, setPhoneError] = useState<string | null>(null);
  const [phoneSuccess, setPhoneSuccess] = useState<string | null>(null);

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
          emailRedirectTo: `${siteUrl}/auth/callback?next=/dashboard`,
        },
      });

      if (error) throw error;

      // Check if email confirmation is required
      if (data?.user && !data.user.confirmed_at && data.user.identities && data.user.identities.length === 0) {
        // User already exists but hasn't confirmed email
        setEmailError('This email is already registered. Please check your inbox for the confirmation email, or try logging in.');
        return;
      }

      if (data?.user && data.user.confirmed_at) {
        // Auto-confirmed (email confirmation disabled in Supabase)
        setEmailSuccess('Account created! Redirecting to dashboard...');
        setTimeout(() => router.push('/dashboard'), 2000);
      } else {
        // Email confirmation required
        setEmailSuccess('Account created! Check your email for a confirmation link to complete signup.');
      }
    } catch (err: any) {
      setEmailError(err?.message || 'Failed to sign up');
    } finally {
      setEmailLoading(false);
    }
  };

  function buildE164(dial: string, local: string) {
    const cleanedLocal = local.replace(/\D/g, '');
    const cleanedDial = dial.startsWith('+') ? dial : `+${dial.replace(/\D/g, '')}`;
    return `${cleanedDial}${cleanedLocal}`;
  }

  const handleRequestOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    setPhoneError(null);
    setPhoneSuccess(null);
    setOtpRequested(false);

    const full = buildE164(dialCode, localPhone);
    if (!isValidPhoneNumber(full)) {
      setPhoneError('Invalid phone number. Use international format like +49151234567.');
      return;
    }

    setRequestingOTP(true);
    try {
      const res = await fetch('/api/auth/phone/request-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phoneNumber: full }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error || 'Failed to send verification code');
      }
      setOtpRequested(true);
      setPhoneSuccess(`Verification code sent to ${formatPhoneNumber(full)}.`);
    } catch (err: any) {
      setPhoneError(err?.message || 'Failed to send verification code');
    } finally {
      setRequestingOTP(false);
    }
  };

  const handleVerifyOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    setPhoneError(null);
    setPhoneSuccess(null);

    const full = buildE164(dialCode, localPhone);
    if (!otpCode || otpCode.length !== 6) {
      setPhoneError('Enter the 6-digit code.');
      return;
    }

    setVerifyingOTP(true);
    try {
      const res = await fetch('/api/auth/phone/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phoneNumber: full, otp: otpCode }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error || 'Verification failed');
      }

      // Set Supabase session from returned tokens
      const { access_token, refresh_token, expires_in } = data.session || {};
      if (!access_token || !refresh_token) {
        throw new Error('Invalid session response');
      }
      const { error: setError } = await supabase.auth.setSession({
        access_token,
        refresh_token,
      });
      if (setError) {
        throw setError;
      }

      setPhoneSuccess('Phone verified. Redirecting…');
      // Route to profile to complete details on first login
      router.replace('/profile');
    } catch (err: any) {
      setPhoneError(err?.message || 'Verification failed');
    } finally {
      setVerifyingOTP(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 p-4">
      <Card className="w-full max-w-xl shadow-lg">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl font-bold text-center">Create your account</CardTitle>
          <CardDescription className="text-center">
            Sign up with email or phone number
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="email">
            <TabsList className="grid grid-cols-2">
              <TabsTrigger value="email">Email</TabsTrigger>
              <TabsTrigger value="phone">Phone</TabsTrigger>
            </TabsList>

            <TabsContent value="email" className="mt-6">
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
            </TabsContent>

            <TabsContent value="phone" className="mt-6">
              {!otpRequested ? (
                <form onSubmit={handleRequestOTP} className="space-y-4">
                  <div className="space-y-2">
                    <Label>Phone number</Label>
                    <div className="flex gap-2">
                      <CountryCodeSelector
                        value={dialCode}
                        onChange={setDialCode}
                        disabled={requestingOTP}
                      />
                      <Input
                        placeholder="1512345678"
                        value={localPhone}
                        onChange={(e) => setLocalPhone(e.target.value)}
                        disabled={requestingOTP}
                        inputMode="numeric"
                        autoComplete="tel"
                      />
                    </div>
                  </div>

                  {phoneError && (
                    <Alert variant="destructive">
                      <AlertDescription>{phoneError}</AlertDescription>
                    </Alert>
                  )}
                  {phoneSuccess && (
                    <Alert>
                      <AlertDescription>{phoneSuccess}</AlertDescription>
                    </Alert>
                  )}

                  <Button type="submit" className="w-full" disabled={requestingOTP}>
                    {requestingOTP && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Send verification code
                  </Button>
                </form>
              ) : (
                <form onSubmit={handleVerifyOTP} className="space-y-4">
                  <div className="space-y-2">
                    <Label>Enter verification code</Label>
                    <OTPInput value={otpCode} onChange={setOtpCode} length={6} disabled={verifyingOTP} />
                  </div>

                  {phoneError && (
                    <Alert variant="destructive">
                      <AlertDescription>{phoneError}</AlertDescription>
                    </Alert>
                  )}
                  {phoneSuccess && (
                    <Alert>
                      <AlertDescription>{phoneSuccess}</AlertDescription>
                    </Alert>
                  )}

                  <Button type="submit" className="w-full" disabled={verifyingOTP}>
                    {verifyingOTP && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Verify and continue
                  </Button>

                  <div className="text-center text-sm text-muted-foreground">
                    Code didn’t arrive? You can request a new one after a short while.
                  </div>
                </form>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}

