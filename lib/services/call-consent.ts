import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * Registered Notissima users who host a personal meeting link implicitly consent
 * to transcription when they accept an incoming call on that link.
 */
export async function logImplicitPersonalLinkHostConsent(
  db: SupabaseClient,
  params: {
    callId: string
    hostUserId: string
    hostDisplayName: string
    grantedAt?: string
  }
): Promise<void> {
  const { callId, hostUserId, hostDisplayName } = params
  const grantedAt = params.grantedAt || new Date().toISOString()

  const { data: existing } = await db
    .from('consent_logs')
    .select('id')
    .eq('call_id', callId)
    .eq('participant_identity', hostUserId)
    .maybeSingle()

  if (existing) return

  const { error } = await db.from('consent_logs').insert({
    call_id: callId,
    participant_name: hostDisplayName,
    participant_identity: hostUserId,
    granted: true,
    created_at: grantedAt,
  })

  if (error && error.code !== '23505') {
    console.error('[Consent] Failed to log implicit host consent:', error)
  }
}
