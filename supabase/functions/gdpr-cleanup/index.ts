/**
 * GDPR Cleanup Edge Function
 *
 * Deletes archived projects whose scheduled_deletion_at has passed.
 * Deploy and schedule via Supabase Dashboard → Edge Functions → Schedule
 * or invoke via pg_cron: SELECT cron.schedule('gdpr-cleanup', '0 3 * * *', $$SELECT net.http_post(...)$$);
 *
 * Recommended schedule: daily at 03:00 UTC
 *
 * Environment variables required:
 *   SUPABASE_URL            — set automatically by Supabase
 *   SUPABASE_SERVICE_ROLE_KEY — set automatically by Supabase
 *   GDPR_CLEANUP_SECRET     — optional bearer token to protect manual invocations
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const GDPR_SECRET = Deno.env.get('GDPR_CLEANUP_SECRET')

Deno.serve(async (req: Request) => {
  // Optional: protect manual HTTP invocations with a shared secret
  if (GDPR_SECRET) {
    const auth = req.headers.get('authorization') ?? ''
    if (auth !== `Bearer ${GDPR_SECRET}`) {
      return new Response('Unauthorized', { status: 401 })
    }
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )

  const { data, error } = await supabase.rpc('process_gdpr_deletions')

  if (error) {
    console.error('GDPR cleanup failed:', error)
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const deletedCount = data as number
  console.log(`GDPR cleanup: deleted ${deletedCount} expired project(s)`)

  return new Response(
    JSON.stringify({ ok: true, deleted: deletedCount, timestamp: new Date().toISOString() }),
    { status: 200, headers: { 'Content-Type': 'application/json' } },
  )
})
