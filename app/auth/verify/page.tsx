'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Loader2 } from 'lucide-react';

export default function AuthVerifyPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const handleAuth = async () => {
      const supabase = createClient();
      
      // Get hash params (where Supabase puts tokens)
      const hash = window.location.hash.substring(1);
      const hashParams = new URLSearchParams(hash);
      
      // Get query params (where code might be)
      const queryParams = new URLSearchParams(window.location.search);
      const code = queryParams.get('code');
      const type = hashParams.get('type');

      // If there's a code, exchange it for session
      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        if (error) {
          setError(error.message);
          setTimeout(() => router.push('/login?error=auth_failed'), 2000);
          return;
        }
      }

      // Check if this is an invite
      if (type === 'invite') {
        // Invited user needs to set password
        router.push('/auth/set-password');
      } else {
        // Regular login, go to dashboard
        router.push('/dashboard');
      }
    };

    handleAuth();
  }, [router]);

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-600 mb-2">Authentication failed</p>
          <p className="text-sm text-muted-foreground">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <Loader2 className="h-8 w-8 animate-spin mx-auto mb-2" />
        <p className="text-sm text-muted-foreground">Verifying...</p>
      </div>
    </div>
  );
}
