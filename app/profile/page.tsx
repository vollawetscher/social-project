'use client';

import * as React from 'react';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, Sparkles, Settings, Zap } from 'lucide-react';
import { useAuth } from '@/lib/auth/AuthProvider';
import { createClient } from '@/lib/supabase/client';
import { ChangelogDialog } from '@/components/changelog/ChangelogDialog';
import { Switch } from '@/components/ui/switch';

export default function ProfilePage() {
  const router = useRouter();
  const { user, profile, loading: authLoading, refreshProfile } = useAuth();
  const supabase = createClient();

  const [displayName, setDisplayName] = useState('');
  const [autoGenerateReports, setAutoGenerateReports] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [settingsError, setSettingsError] = useState<string | null>(null);
  const [settingsSuccess, setSettingsSuccess] = useState<string | null>(null);
  const [showChangelog, setShowChangelog] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) {
      router.replace('/login');
    }
  }, [authLoading, user, router]);

  useEffect(() => {
    if (profile?.display_name) {
      setDisplayName(profile.display_name);
    }
    if (profile?.auto_generate_reports !== undefined) {
      setAutoGenerateReports(profile.auto_generate_reports);
    }
  }, [profile]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const { error: upError } = await supabase
        .from('profiles')
        .update({ display_name: displayName || null })
        .eq('id', user.id);
      if (upError) throw upError;
      
      // Refresh profile data in context
      await refreshProfile();
      
      setSuccess('Profile updated! Redirecting...');
      
      // Navigate back to dashboard after short delay
      setTimeout(() => {
        router.push('/dashboard');
      }, 1500);
    } catch (err: any) {
      setError(err?.message || 'Failed to update profile');
      setSaving(false);
    }
  };

  const handleSettingsSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setSavingSettings(true);
    setSettingsError(null);
    setSettingsSuccess(null);
    try {
      const { error: upError } = await supabase
        .from('profiles')
        .update({ auto_generate_reports: autoGenerateReports })
        .eq('id', user.id);
      if (upError) throw upError;
      
      // Refresh profile data in context
      await refreshProfile();
      
      setSettingsSuccess('Settings saved successfully!');
      setTimeout(() => setSettingsSuccess(null), 3000);
    } catch (err: any) {
      setSettingsError(err?.message || 'Failed to update settings');
      setSavingSettings(false);
    } finally {
      setSavingSettings(false);
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 py-8 px-4">
      <div className="max-w-2xl mx-auto space-y-4">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Your profile</CardTitle>
                <CardDescription>Manage your account details.</CardDescription>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowChangelog(true)}
                className="gap-2"
              >
                <Sparkles className="h-4 w-4" />
                What's New
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSave} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label>Email</Label>
                  <Input value={profile?.email || ''} disabled />
                </div>
                <div className="space-y-2">
                  <Label>Phone number</Label>
                  <Input value={profile?.phone_number || ''} disabled />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="displayName">Display name</Label>
                <Input
                  id="displayName"
                  placeholder="Enter your name"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  disabled={saving}
                />
              </div>

              {error && (
                <Alert variant="destructive">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}
              {success && (
                <Alert>
                  <AlertDescription>{success}</AlertDescription>
                </Alert>
              )}

              <div className="flex justify-end">
                <Button type="submit" disabled={saving}>
                  {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Save changes
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <Settings className="h-5 w-5 text-slate-600" />
              <div>
                <CardTitle>Workflow Settings</CardTitle>
                <CardDescription>Control what happens after audio transcription</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSettingsSave} className="space-y-6">
              <div className="flex items-start justify-between space-x-4 p-4 border rounded-lg bg-slate-50">
                <div className="flex-1 space-y-1">
                  <div className="flex items-center gap-2">
                    <Zap className="h-4 w-4 text-blue-600" />
                    <Label htmlFor="auto-reports" className="text-base font-semibold cursor-pointer">
                      Auto-generate Reports
                    </Label>
                  </div>
                  <p className="text-sm text-slate-600">
                    Automatically create reports after transcribing meeting recordings (30+ seconds).
                    When disabled, you'll need to manually click "Report neu erstellen" after transcription.
                  </p>
                  <p className="text-xs text-slate-500 mt-2">
                    💡 <strong>Recommended:</strong> Leave OFF to review transcripts before generating reports.
                  </p>
                </div>
                <Switch
                  id="auto-reports"
                  checked={autoGenerateReports}
                  onCheckedChange={setAutoGenerateReports}
                  disabled={savingSettings}
                />
              </div>

              {settingsError && (
                <Alert variant="destructive">
                  <AlertDescription>{settingsError}</AlertDescription>
                </Alert>
              )}
              {settingsSuccess && (
                <Alert>
                  <AlertDescription>{settingsSuccess}</AlertDescription>
                </Alert>
              )}

              <div className="flex justify-end">
                <Button type="submit" disabled={savingSettings}>
                  {savingSettings && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Save Settings
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>

      <ChangelogDialog open={showChangelog} onOpenChange={setShowChangelog} />
    </div>
  );
}

