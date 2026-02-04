import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  
  // During build/SSR, return null if env vars aren't available
  if (!url || !key) {
    return null as any
  }
  
  return createBrowserClient(url, key)
}
