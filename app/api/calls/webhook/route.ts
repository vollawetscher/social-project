import { NextResponse } from 'next/server'
import {
  verifyWebhook,
  startCompositeEgress,
  startTrackEgressForParticipant,
  startTrackRealtimeEgressForParticipant,
  buildLiveRelayIngestUrl,
} from '@/lib/services/livekit'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { getAppBaseUrl } from '@/lib/utils/app-url'

function extractEgressStartedAtNs(info: any): number | null {
  if (!info) return null
  if (typeof info.startedAtNs === 'number' && Number.isFinite(info.startedAtNs)) return Math.round(info.startedAtNs)
  if (typeof info.startedAtNs === 'string' && /^\d+$/.test(info.startedAtNs)) return Number(info.startedAtNs)
  const startedAt = info.startedAt
  if (startedAt && typeof startedAt === 'object') {
    if (typeof startedAt.seconds === 'number') {
      const nanos = typeof startedAt.nanos === 'number' ? startedAt.nanos : 0
      return Math.round(startedAt.seconds * 1_000_000_000 + nanos)
    }
    if (typeof startedAt.toDate === 'function') {
      try {
        return startedAt.toDate().getTime() * 1_000_000
      } catch {
        // ignore
      }
    }
  }
  if (typeof startedAt === 'string') {
    const ms = Date.parse(startedAt)
    if (Number.isFinite(ms)) return Math.round(ms * 1_000_000)
  }
  return null
}

function inferTrackKindFromPath(path: string): 'a' | 'b' | null {
  if (!path) return null
  if (path.includes('_track_a.')) return 'a'
  if (path.includes('_track_b.')) return 'b'
  return null
}

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

        let call: any = null
        const primaryQuery = await supabase
          .from('calls')
          .select('id, user_id, session_id, participant_a_identity, participant_b_identity, status, track_a_egress_id, track_b_egress_id, live_track_a_egress_id, live_track_b_egress_id, track_a_started_at_ns, track_b_started_at_ns, call_type, contact_name, phone_number, pstn_consent_state, pstn_transcription_mode')
          .eq('room_name', roomName)
          .maybeSingle()

        if (primaryQuery.error && /pstn_consent_state|live_track_a_egress_id|live_track_b_egress_id|column .* does not exist/i.test(primaryQuery.error.message || '')) {
          const fallbackQuery = await supabase
            .from('calls')
            .select('id, user_id, session_id, participant_a_identity, participant_b_identity, status, track_a_egress_id, track_b_egress_id, live_track_a_egress_id, live_track_b_egress_id, track_a_started_at_ns, track_b_started_at_ns, call_type, contact_name, phone_number')
            .eq('room_name', roomName)
            .maybeSingle()
          call = fallbackQuery.data
        } else {
          call = primaryQuery.data
        }

        if (!call) break

        // Participant B is:
        //  - any non-A identity when participant_b_identity not yet set (web calls), OR
        //  - the identity that matches the pre-set participant_b_identity (PSTN/SIP calls,
        //    where the dial route sets participant_b_identity before the callee answers).
        // We always need to detect and activate participant B.
        // Egress-start logic is handled separately to avoid duplicate starts.
        const isParticipantB =
          identity !== call.participant_a_identity &&
          (!call.participant_b_identity || identity === call.participant_b_identity)

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

          // Start recording now that both participants are present unless egress already exists.
          const hasExistingEgress = Boolean(call.track_a_egress_id || call.track_b_egress_id)
          const calleeDeclinedPstnConsent =
            call.call_type === 'pstn_outbound' && call.pstn_consent_state === 'declined'

          if (call.session_id && !hasExistingEgress && !calleeDeclinedPstnConsent) {
            try {
              const useDualTrack =
                call.call_type === 'pstn_outbound' &&
                (call as any).pstn_transcription_mode === 'live' &&
                !!call.participant_a_identity &&
                !!(call.participant_b_identity || identity)

              if (useDualTrack) {
                const participantAIdentity = call.participant_a_identity
                const participantBIdentity = call.participant_b_identity || identity
                const [egressA, egressB] = await Promise.all([
                  startTrackEgressForParticipant(roomName, call.session_id, participantAIdentity, 'track_a'),
                  startTrackEgressForParticipant(roomName, call.session_id, participantBIdentity, 'track_b'),
                ])
                let liveTrackAId: string | null = null
                let liveTrackBId: string | null = null
                const speakerB = call.contact_name || call.phone_number || 'Participant'
                const relayUrlA = buildLiveRelayIngestUrl({
                  callId: call.id,
                  roomName,
                  sourceKey: 'track_a',
                  speakerLabel: 'You',
                  language: 'de',
                })
                const relayUrlB = buildLiveRelayIngestUrl({
                  callId: call.id,
                  roomName,
                  sourceKey: 'track_b',
                  speakerLabel: speakerB,
                  language: 'de',
                })
                if (relayUrlA && relayUrlB) {
                  try {
                    const [liveA, liveB] = await Promise.all([
                      startTrackRealtimeEgressForParticipant(roomName, participantAIdentity, relayUrlA),
                      startTrackRealtimeEgressForParticipant(roomName, participantBIdentity, relayUrlB),
                    ])
                    liveTrackAId = liveA.egressId || null
                    liveTrackBId = liveB.egressId || null
                    console.log('[LiveKit Webhook] Server relay egress started:', liveTrackAId, liveTrackBId)
                  } catch (relayErr: any) {
                    console.error('[LiveKit Webhook] Failed to start server relay egress:', relayErr?.message || relayErr)
                  }
                }
                await supabase
                  .from('calls')
                  .update({
                    track_a_egress_id: egressA.egressId,
                    track_b_egress_id: egressB.egressId,
                    live_track_a_egress_id: liveTrackAId,
                    live_track_b_egress_id: liveTrackBId,
                    track_a_started_at_ns: extractEgressStartedAtNs(egressA),
                    track_b_started_at_ns: extractEgressStartedAtNs(egressB),
                  })
                  .eq('id', call.id)
                console.log('[LiveKit Webhook] Dual track egress started:', egressA.egressId, egressB.egressId)
              } else {
                const egress = await startCompositeEgress(roomName, call.session_id)
                await supabase
                  .from('calls')
                  .update({
                    track_a_egress_id: egress.egressId,
                    track_a_started_at_ns: extractEgressStartedAtNs(egress),
                  })
                  .eq('id', call.id)
                console.log('[LiveKit Webhook] Composite egress started:', egress.egressId)
              }
              await supabase
                .from('sessions')
                .update({ status: 'recording' })
                .eq('id', call.session_id)
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
          .select('id, status, session_id, started_at, track_a_egress_id, track_b_egress_id')
          .eq('room_name', roomName)
          .maybeSingle()

        if (!call) break

        const wasNeverActive = call.status === 'invited' || call.status === 'waiting'
        if (call.status === 'active' || call.status === 'waiting' || call.status === 'invited') {
          const nextStatus = wasNeverActive ? 'missed' : 'ended'
          await supabase
            .from('calls')
            .update({
              status: nextStatus,
              ended_at: new Date().toISOString(),
              missed_at: nextStatus === 'missed' ? new Date().toISOString() : undefined,
            })
            .eq('id', call.id)

          console.log('[LiveKit Webhook] Call', nextStatus, ':', call.id)
        }

        const hasEgress = !!(call.track_a_egress_id || call.track_b_egress_id)

        if (call.session_id && hasEgress && !wasNeverActive) {
          // Egress is still flushing to S3 — set session to 'uploading'.
          // egress_ended webhook will transition to 'transcribing'.
          await supabase
            .from('sessions')
            .update({ status: 'uploading' })
            .eq('id', call.session_id)
          console.log('[LiveKit Webhook] Session set to uploading (egress pending):', call.session_id)
        }

        // Delete session for calls that never connected or had no recording.
        // Covers: missed/declined calls, calls ended before egress started,
        // and edge cases where egress IDs exist but call was never active.
        const shouldDeleteSession =
          call.session_id &&
          (!hasEgress || wasNeverActive)

        if (shouldDeleteSession) {
          const { data: session } = await supabase
            .from('sessions')
            .select('status')
            .eq('id', call.session_id)
            .maybeSingle()

          const deletableStatuses = ['created', 'recording', 'uploading']
          if (session && deletableStatuses.includes(session.status)) {
            await supabase
              .from('calls')
              .update({ session_id: null })
              .eq('id', call.id)
            await supabase
              .from('sessions')
              .delete()
              .eq('id', call.session_id)
            console.log('[LiveKit Webhook] Deleted orphan session (call never active or no egress):', call.session_id, call.id)
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
          .select('id, session_id, started_at, ended_at, call_type, pstn_transcription_mode, track_a_egress_id, track_b_egress_id, track_a_started_at_ns, track_b_started_at_ns')
          .eq('room_name', roomName)
          .maybeSingle()

        if (!call) break
        const isTrackA = call.track_a_egress_id === egressId
        const isTrackB = call.track_b_egress_id === egressId
        if (!isTrackA && !isTrackB) break
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
        const trackKindFromPath = storagePath ? inferTrackKindFromPath(storagePath) : null
        const fileSize = fileResult?.size ? Number(fileResult.size) : 0
        const durationNs = fileResult?.duration ? Number(fileResult.duration) : 0
        const durationSecFromEgress = Math.round(durationNs / 1_000_000_000)
        const callStartedAtMs = call.started_at ? new Date(call.started_at).getTime() : 0
        const callEndedAtMs = call.ended_at ? new Date(call.ended_at).getTime() : 0
        const durationSecFromCallWindow =
          callStartedAtMs > 0 && callEndedAtMs > callStartedAtMs
            ? Math.round((callEndedAtMs - callStartedAtMs) / 1000)
            : 0
        // Prefer egress-reported duration, but clamp to the known call window when present.
        // This prevents occasional inflated durations from surfacing in sessions.
        const durationSec =
          durationSecFromCallWindow > 0
            ? (
                durationSecFromEgress > 0
                  ? Math.min(durationSecFromEgress, durationSecFromCallWindow)
                  : durationSecFromCallWindow
              )
            : durationSecFromEgress

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

        console.log(
          '[LiveKit Webhook] Recording stored at:',
          storagePath,
          'size:',
          fileSize,
          'duration:',
          durationSec,
          's',
          '(egress:',
          durationSecFromEgress,
          'window:',
          durationSecFromCallWindow,
          ')'
        )

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
              original_filename: trackKindFromPath === 'a' ? 'track_a' : trackKindFromPath === 'b' ? 'track_b' : null,
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

          const dualTrackMode =
            call.call_type === 'pstn_outbound' &&
            (call as any).pstn_transcription_mode === 'live' &&
            !!call.track_a_egress_id &&
            !!call.track_b_egress_id

          if (dualTrackMode) {
            await supabase
              .from('calls')
              .update({
                ...(isTrackA && !call.track_a_started_at_ns ? { track_a_started_at_ns: extractEgressStartedAtNs(egressInfo) } : {}),
                ...(isTrackB && !call.track_b_started_at_ns ? { track_b_started_at_ns: extractEgressStartedAtNs(egressInfo) } : {}),
              })
              .eq('id', call.id)

            const { data: dualFiles } = await supabase
              .from('files')
              .select('id, storage_path')
              .eq('session_id', call.session_id)
            const hasTrackAFile = (dualFiles || []).some((f: any) => String(f.storage_path || '').includes('_track_a.'))
            const hasTrackBFile = (dualFiles || []).some((f: any) => String(f.storage_path || '').includes('_track_b.'))
            if (!hasTrackAFile || !hasTrackBFile) {
              console.log('[LiveKit Webhook] Waiting for both track files before transcribe', {
                hasTrackAFile,
                hasTrackBFile,
                sessionId: call.session_id,
              })
              await supabase
                .from('sessions')
                .update({ status: 'uploading' })
                .eq('id', call.session_id)
              break
            }
          }

          // Update call/session status and trigger transcription (once ready)
          await supabase.from('calls').update({ status: 'transcribing' }).eq('id', call.id)
          await supabase.from('sessions').update({ status: 'transcribing' }).eq('id', call.session_id)

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
