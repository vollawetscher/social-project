import { NextResponse } from 'next/server'
import { verifyWebhook, startCompositeEgress } from '@/lib/services/livekit'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { getAppBaseUrl } from '@/lib/utils/app-url'

/**
 * POST /api/calls/webhook - LiveKit webhook handler.
 * 
 * Events handled:
 * - participant_joined: Record participant B, mark active, start composite egress
 * - room_finished: Mark call ended
 * - egress_ended: Recording file is in Supabase Storage; create file record + trigger transcription
 */
export async function POST(request: Request) {
  try {
    const body = await request.text()
    const authHeader = request.headers.get('Authorization') || ''

    const event = await verifyWebhook(body, authHeader)
    console.log('[LiveKit Webhook] Event:', event.event, 'Room:', event.room?.name)

    const supabase = createServiceRoleClient()

    switch (event.event) {
      case 'participant_joined': {
        const roomName = event.room?.name
        const identity = event.participant?.identity
        if (!roomName || !identity) break

        const { data: call } = await supabase
          .from('calls')
          .select('id, session_id, participant_a_identity, participant_b_identity, status, track_a_egress_id')
          .eq('room_name', roomName)
          .maybeSingle()

        if (!call) break

        // Participant B is:
        //  - any non-A identity when participant_b_identity not yet set (web calls), OR
        //  - the identity that matches the pre-set participant_b_identity (PSTN/SIP calls,
        //    where the dial route sets participant_b_identity before the callee answers).
        // Guard with !track_a_egress_id so we never start a second egress.
        const isParticipantB =
          identity !== call.participant_a_identity &&
          (!call.participant_b_identity || identity === call.participant_b_identity) &&
          !call.track_a_egress_id

        if (isParticipantB) {
          await supabase
            .from('calls')
            .update({
              participant_b_identity: identity,
              status: 'active',
              started_at: new Date().toISOString(),
              accepted_at: call.status === 'invited' ? new Date().toISOString() : undefined,
            })
            .eq('id', call.id)

          console.log('[LiveKit Webhook] Call activated:', call.id, 'participant B:', identity)

          // Start recording now that both participants are present
          if (call.session_id) {
            try {
              const egress = await startCompositeEgress(roomName, call.session_id)
              await supabase
                .from('calls')
                .update({ track_a_egress_id: egress.egressId })
                .eq('id', call.id)
              await supabase
                .from('sessions')
                .update({ status: 'recording' })
                .eq('id', call.session_id)
              console.log('[LiveKit Webhook] Composite egress started:', egress.egressId)
            } catch (err: any) {
              console.error('[LiveKit Webhook] Failed to start egress:', err.message)
              await supabase
                .from('calls')
                .update({ last_error: `Egress start failed: ${err.message}` })
                .eq('id', call.id)
            }
          }
        }
        break
      }

      case 'room_finished': {
        const roomName = event.room?.name
        if (!roomName) break

        const { data: call } = await supabase
          .from('calls')
          .select('id, status, session_id, track_a_egress_id')
          .eq('room_name', roomName)
          .maybeSingle()

        if (!call) break

        if (call.status === 'active' || call.status === 'waiting' || call.status === 'invited') {
          const nextStatus = call.status === 'invited' ? 'missed' : 'ended'
          await supabase
            .from('calls')
            .update({
              status: nextStatus,
              ended_at: new Date().toISOString(),
              missed_at: nextStatus === 'missed' ? new Date().toISOString() : undefined,
            })
            .eq('id', call.id)

          console.log('[LiveKit Webhook] Call ended:', call.id)
        }

        // Recording exists — egress is still uploading the file to S3.
        // Set session to 'uploading' so the UI shows progress instead of "stuck".
        if (call.session_id && call.track_a_egress_id) {
          await supabase
            .from('sessions')
            .update({ status: 'uploading' })
            .eq('id', call.session_id)
          console.log('[LiveKit Webhook] Session set to uploading (egress pending):', call.session_id)
        }

        // If no egress was started (nobody answered), delete the session + call entirely
        // so they don't pollute the user's sessions list.
        if (call.session_id && !call.track_a_egress_id) {
          const { data: session } = await supabase
            .from('sessions')
            .select('status')
            .eq('id', call.session_id)
            .maybeSingle()

          if (session?.status === 'created') {
            // Null out session_id on call first (FK), then delete both
            await supabase
              .from('calls')
              .update({ session_id: null })
              .eq('id', call.id)
            await supabase
              .from('sessions')
              .delete()
              .eq('id', call.session_id)
            console.log('[LiveKit Webhook] Deleted unanswered session+call (no egress):', call.session_id, call.id)
          }
        }
        break
      }

      case 'egress_ended': {
        const egressInfo = event.egressInfo
        if (!egressInfo) break

        const roomName = egressInfo.roomName
        const egressId = egressInfo.egressId

        // Log full egress info for debugging
        const egressStatus = (egressInfo as any).status
        const egressError = (egressInfo as any).error
        console.log('[LiveKit Webhook] Egress ended:', egressId, 'room:', roomName, 'status:', egressStatus, 'error:', egressError)
        console.log('[LiveKit Webhook] Egress file info:', JSON.stringify((egressInfo as any).fileResults || (egressInfo as any).file || 'none'))

        const { data: call } = await supabase
          .from('calls')
          .select('id, session_id, started_at, ended_at, track_a_egress_id')
          .eq('room_name', roomName)
          .maybeSingle()

        if (!call || call.track_a_egress_id !== egressId) break
        if (!call.session_id) break

        if (egressError) {
          console.error('[LiveKit Webhook] Egress failed:', egressError)
          await supabase
            .from('calls')
            .update({ status: 'error', last_error: `Egress failed: ${egressError}` })
            .eq('id', call.id)
          if (call.session_id) {
            await supabase
              .from('sessions')
              .update({ status: 'error', last_error: `Recording failed: ${egressError}` })
              .eq('id', call.session_id)
          }
          break
        }

        // Extract the storage path from egress file results
        const fileResults = (egressInfo as any).fileResults || []
        const fileResult = fileResults[0] || (egressInfo as any).file
        const storagePath = fileResult?.filename || fileResult?.filepath
        const fileSize = fileResult?.size ? Number(fileResult.size) : 0
        const durationNs = fileResult?.duration ? Number(fileResult.duration) : 0
        const durationSec = Math.round(durationNs / 1_000_000_000)

        if (!storagePath) {
          console.error('[LiveKit Webhook] No file path in egress result:', JSON.stringify(egressInfo))
          await supabase
            .from('calls')
            .update({ status: 'error', last_error: 'No recording file path in egress result' })
            .eq('id', call.id)
          if (call.session_id) {
            await supabase
              .from('sessions')
              .update({ status: 'error', last_error: 'No recording file in egress result' })
              .eq('id', call.session_id)
          }
          break
        }

        console.log('[LiveKit Webhook] Recording stored at:', storagePath, 'size:', fileSize, 'duration:', durationSec, 's')

        try {
          // Create file record -- recording is already in Supabase Storage
          const { error: fileError } = await supabase
            .from('files')
            .insert({
              session_id: call.session_id,
              storage_path: storagePath,
              mime_type: 'audio/ogg',
              size_bytes: fileSize,
              file_purpose: 'meeting',
            })

          if (fileError) {
            throw new Error(`Failed to create file record: ${fileError.message}`)
          }

          // Update session duration
          if (durationSec > 0) {
            await supabase
              .from('sessions')
              .update({ duration_sec: durationSec })
              .eq('id', call.session_id)
          }

          // Update call status
          await supabase
            .from('calls')
            .update({ status: 'transcribing' })
            .eq('id', call.id)

          // Set session to transcribing before triggering the job
          await supabase
            .from('sessions')
            .update({ status: 'transcribing' })
            .eq('id', call.session_id)

          // Trigger actual Speechmatics transcription (fire and forget)
          const baseUrl = getAppBaseUrl()
          const secret = process.env.INTERNAL_API_SECRET

          console.log('[LiveKit Webhook] Triggering transcription for session:', call.session_id)
          const transcribeHeaders: Record<string, string> = { 'Content-Type': 'application/json' }
          if (secret) transcribeHeaders['x-internal-secret'] = secret

          fetch(`${baseUrl}/api/sessions/${call.session_id}/transcribe`, {
            method: 'POST',
            headers: transcribeHeaders,
            body: JSON.stringify({}),
          }).catch(err => console.error('[LiveKit Webhook] Transcription trigger failed:', err))
        } catch (err: any) {
          console.error('[LiveKit Webhook] Post-egress processing failed:', err)
          await supabase
            .from('calls')
            .update({ status: 'error', last_error: err.message })
            .eq('id', call.id)
          if (call.session_id) {
            await supabase
              .from('sessions')
              .update({ status: 'error', last_error: err.message })
              .eq('id', call.session_id)
          }
        }

        break
      }

      default:
        console.log('[LiveKit Webhook] Unhandled event:', event.event)
    }

    return NextResponse.json({ received: true })
  } catch (error: any) {
    console.error('[LiveKit Webhook] Error:', error)
    return NextResponse.json({ error: 'Webhook processing failed' }, { status: 200 })
  }
}
