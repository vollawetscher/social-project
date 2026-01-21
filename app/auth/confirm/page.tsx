'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';

export default function AuthConfirmPage() {
  const router = useRouter();

  useEffect(() => {
    // Get hash params (Supabase puts tokens in hash)
    const hash = window.location.hash.substring(1);
    const params = new URLSearchParams(hash);
    const type = params.get('type');

    // Redirect based on type
    if (type === 'invite') {
      router.push('/auth/set-password');
    } else {
      router.push('/dashboard');
    }
  }, [router]);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <Loader2 className="h-8 w-8 animate-spin" />
    </div>
  );
}
