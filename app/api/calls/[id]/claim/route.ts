import { NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { requireAuth, handleAuthError } from '@/lib/auth/helpers'

/**
 * POST /api/calls/[id]/claim
 *
 * Called after a callee signs up (or is already logged in) to:
 *  1. Fork the caller's session into a new session owned by the callee
 *  2. Copy the transcript if it is already done, or mark as pending if not
 *  3. Set callee_user_id + callee_session_id on the call row
 *  4. Set onboarding_expires_at on the profile (5-day trial) if not already set
 */
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth()
    const { id: callId } = await params
    const supabase = createServiceRoleClient()

    // --- 1. Fetch the call ---
    const { data: call, error: callError } = await supabase
      .from('calls')
      .select('id, user_id, session_id, status, callee_user_id, callee_session_id, participant_b_identity, contact_name')
      .eq('id', callId)
      .maybeSingle()

    if (callError || !call) {
      return NextResponse.json({ error: 'Call not found' }, { status: 404 })
    }

    // Caller cannot claim their own call
    if (call.user_id === user.id) {
      return NextResponse.json({ error: 'Cannot claim your own call' }, { status: 400 })
    }

    // Already claimed by someone else
    if (call.callee_user_id && call.callee_user_id !== user.id) {
      return NextResponse.json({ error: 'Call already claimed' }, { status: 409 })
    }

    // If already claimed by this user, just return the existing session
    if (call.callee_user_id === user.id && call.callee_session_id) {
      return NextResponse.json({ sessionId: call.callee_session_id })
    }

    // Call must have happened (not still waiting)
    if (call.status === 'waiting') {
      return NextResponse.json({ error: 'Call has not started yet' }, { status: 400 })
    }

    if (!call.session_id) {
      return NextResponse.json({ error: 'No session found for this call' }, { status: 404 })
    }

    // --- 2. Fetch caller's session details ---
    const { data: callerSession } = await supabase
      .from('sessions')
      .select('id, status, duration_sec, language, internal_case_id')
      .eq('id', call.session_id)
      .maybeSingle()

    if (!callerSession) {
      return NextResponse.json({ error: 'Caller session not found' }, { status: 404 })
    }

    // --- 3. Fetch the caller's file (audio) ---
    const { data: callerFiles } = await supabase
      .from('files')
      .select('id, storage_path, mime_type, size_bytes, file_purpose')
      .eq('session_id', call.session_id)

    // --- 4. Check if transcript is already complete ---
    const { data: callerTranscripts } = await supabase
      .from('transcripts')
      .select('*')
      .eq('session_id', call.session_id)

    const transcriptDone = (callerTranscripts?.length ?? 0) > 0

    // --- 5. Create the callee's forked session ---
    const callName = call.contact_name
      ? `Call with ${call.contact_name}`
      : callerSession.internal_case_id || 'Shared call'

    const calleeStatus = transcriptDone ? 'done' : 'transcribing'
    const { data: calleeSession, error: sessionError } = await supabase
      .from('sessions')
      .insert({
        user_id: user.id,
        internal_case_id: callName,
        status: calleeStatus,
        duration_sec: callerSession.duration_sec || 0,
        language: callerSession.language || 'de',
        is_callee_pending: !transcriptDone,
      })
      .select('id')
      .single()

    if (sessionError || !calleeSession) {
      console.error('[Claim] Failed to create callee session:', sessionError)
      return NextResponse.json({ error: 'Failed to create session' }, { status: 500 })
    }

    // --- 6. Create file records pointing to the same audio storage_path ---
    for (const f of callerFiles || []) {
      await supabase.from('files').insert({
        session_id: calleeSession.id,
        storage_path: f.storage_path,
        mime_type: f.mime_type,
        size_bytes: f.size_bytes,
        file_purpose: f.file_purpose,
        upload_status: 'completed',
      })
    }

    // --- 7. Copy transcripts if already done ---
    if (transcriptDone && callerTranscripts) {
      // Get the callee's new file id for the first file
      const { data: calleeFile } = await supabase
        .from('files')
        .select('id')
        .eq('session_id', calleeSession.id)
        .maybeSingle()

      for (const t of callerTranscripts) {
        await supabase.from('transcripts').insert({
          session_id: calleeSession.id,
          file_id: calleeFile?.id ?? null,
          raw_json: t.raw_json,
          redacted_json: t.redacted_json,
          raw_text: t.raw_text,
          redacted_text: t.redacted_text,
          language: t.language,
          summary: t.summary ?? null,
        })
      }
    }

    // --- 8. Update the call with callee info ---
    await supabase
      .from('calls')
      .update({
        callee_user_id: user.id,
        callee_session_id: calleeSession.id,
      })
      .eq('id', callId)

    // --- 9. Set 5-day trial on profile only if not already set ---
    const { data: profile } = await supabase
      .from('profiles')
      .select('onboarding_expires_at, created_at')
      .eq('id', user.id)
      .maybeSingle()

    if (profile && !profile.onboarding_expires_at) {
      const expiresAt = new Date()
      expiresAt.setDate(expiresAt.getDate() + 5)
      await supabase
        .from('profiles')
        .update({ onboarding_expires_at: expiresAt.toISOString() })
        .eq('id', user.id)
    }

    console.log('[Claim] Call claimed:', callId, 'callee:', user.id, 'session:', calleeSession.id, 'transcript done:', transcriptDone)

    return NextResponse.json({ sessionId: calleeSession.id })
  } catch (error) {
    if (error instanceof Error) {
      const authError = handleAuthError(error)
      return NextResponse.json({ error: authError.message }, { status: authError.status })
    }
    console.error('[Claim] Unexpected error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
