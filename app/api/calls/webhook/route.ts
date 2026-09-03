import { NextResponse } from 'next/server'
import {
  verifyWebhook,
  startCompositeEgress,
  startTrackEgressForParticipant,
  startTrackRealtimeEgressForParticipant,
  buildLiveRelayIngestUrl,
  listParticipants,
} from '@/lib/services/livekit'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { getAppBaseUrl } from '@/lib/utils/app-url'
import { isVoiceAgentEnabledForUser } from '@/lib/services/voice-agent'
import { createPIIRedactionService } from '@/lib/services/pii-redaction'
import { enqueueSessionAnalyzeWhenRoleReady } from '@/lib/services/session-analyze-gate'

/**
 * Voice-agent calls create their transcript here in the webhook rather than via
 * the batch transcribe pipeline, so the post-transcribe → session_analyze step
 * is never triggered for them. Enqueue it explicitly so voice-agent sessions get
 * context extraction and suggested outputs just like normal calls.
 */
async function enqueueVoiceAgentAnalysis(sessionId: string | null, userId: string | null): Promise<void> {
  if (!sessionId || !userId) return
  try {
    const analyze = await enqueueSessionAnalyzeWhenRoleReady({
      supabase: createServiceRoleClient(),
      sessionId,
      userId,
      fallbackRole: { role: 'speaker', speakerId: null, source: 'auto' },
    })
    console.log('[LiveKit Webhook] Voice agent analysis:', sessionId, analyze)
  } catch (err: any) {
    console.error('[LiveKit Webhook] Failed to enqueue voice agent analysis:', err?.message || err)
  }
}

type LiveTranscriptLine = {
  source_key: string
  speaker_label: string
  text: string
  timestamp_ms: number | string
}

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

async function finalizeVoiceAgentTranscript(supabase: any, call: any): Promise<string | null> {
  const { data: lines, error: linesError } = await supabase
    .from('call_live_transcript_lines')
    .select('source_key, speaker_label, text, timestamp_ms')
    .eq('call_id', call.id)
    .order('timestamp_ms', { ascending: true })

  if (linesError) {
    console.error('[LiveKit Webhook] Failed to load voice agent transcript lines:', linesError.message)
    return call.session_id || null
  }

  const liveLines = (lines || [])
    .map((line: LiveTranscriptLine) => ({
      ...line,
      timestamp_ms: Number(line.timestamp_ms) || Date.now(),
      text: String(line.text || '').trim(),
      speaker_label: String(line.speaker_label || line.source_key || 'Speaker').trim(),
    }))
    .filter((line: LiveTranscriptLine) => line.text)

  let sessionId = call.session_id as string | null

  // The session may have been deleted by a concurrent call-end cleanup. Treat a
  // dangling session_id the same as a missing one so we always end up with a
  // valid row before inserting the transcript.
  if (sessionId) {
    const { data: existingSession } = await supabase
      .from('sessions')
      .select('id')
      .eq('id', sessionId)
      .maybeSingle()
    if (!existingSession) {
      console.log('[LiveKit Webhook] Voice agent session was removed, recreating:', sessionId)
      sessionId = null
    }
  }

  if (!sessionId) {
    const callMode = call.call_mode
    const inputHint = call.call_type === 'pstn_outbound' ? 'phone_call' : callMode === 'video' ? 'video_call' : 'phone_call'
    const sessionLabel = call.call_type === 'pstn_outbound' ? 'Call' : callMode === 'video' ? 'Video Call' : 'Voice Call'
    const { data: newSession, error: sessionError } = await supabase
      .from('sessions')
      .insert({
        user_id: call.user_id,
        status: 'done',
        context_note: '',
        internal_case_id: sessionLabel,
        duration_sec: 0,
        last_error: '',
        input_hint: inputHint,
        language: 'de',
        user_is_speaker: true,
        recording_type: 'ai_agent_conversation',
        ...(call.purpose && String(call.purpose).trim()
          ? { purpose: String(call.purpose).trim(), purpose_source: 'user' as const }
          : {}),
      })
      .select('id')
      .single()

    if (sessionError || !newSession) {
      console.error('[LiveKit Webhook] Failed to create voice agent transcript session:', sessionError?.message)
      return null
    }
    sessionId = newSession.id
    await supabase.from('calls').update({ session_id: sessionId }).eq('id', call.id)
  }

  if (liveLines.length === 0) {
    console.log('[LiveKit Webhook] Voice agent call ended without live transcript lines:', call.id, 'session:', sessionId)
    await supabase
      .from('sessions')
      .update({ status: 'done', duration_sec: 0, language: 'de', last_error: '' })
      .eq('id', sessionId)
    await finalizeVoiceAgentCalleeSession(supabase, call.id, sessionId)
    return sessionId
  }

  const { data: existingTranscript } = await supabase
    .from('transcripts')
    .select('id')
    .eq('session_id', sessionId)
    .limit(1)
    .maybeSingle()

  if (!existingTranscript) {
    const firstTs = liveLines[0].timestamp_ms
    const segments = liveLines.map((line: LiveTranscriptLine) => {
      const startMs = Math.max(0, Number(line.timestamp_ms) - firstTs)
      return {
        start_ms: startMs,
        end_ms: startMs + 1000,
        speaker: line.speaker_label,
        text: line.text,
        confidence: 1,
      }
    })
    const rawText = liveLines.map((line: LiveTranscriptLine) => `${line.speaker_label}: ${line.text}`).join('\n')
    const piiService = createPIIRedactionService()
    const redactionResult = piiService.redact(segments)

    const { error: transcriptError } = await supabase.from('transcripts').insert({
      session_id: sessionId,
      file_id: null,
      raw_json: segments,
      redacted_json: redactionResult.redactedSegments,
      raw_text: rawText,
      redacted_text: redactionResult.redactedText,
      language: 'de',
      summary: null,
    })

    if (transcriptError) {
      console.error('[LiveKit Webhook] Failed to save voice agent transcript:', transcriptError.message)
    }
  }

  const durationSec = Math.max(
    0,
    Math.round((liveLines[liveLines.length - 1].timestamp_ms - liveLines[0].timestamp_ms) / 1000),
  )
  await supabase
    .from('sessions')
    .update({ status: 'done', duration_sec: durationSec, language: 'de', last_error: '' })
    .eq('id', sessionId)

  await finalizeVoiceAgentCalleeSession(supabase, call.id, sessionId)

  // Trigger analysis (context + suggested outputs) for the host session, which
  // the voice-agent path would otherwise skip.
  await enqueueVoiceAgentAnalysis(sessionId, call.user_id)

  console.log('[LiveKit Webhook] Voice agent transcript finalized:', sessionId, 'lines:', liveLines.length)
  return sessionId
}

/**
 * Resolve a callee's forked session for a voice-agent call. When the callee
 * claimed the call before the transcript existed, their session was left in
 * `transcribing`/`is_callee_pending`. Voice-agent calls finalize via this webhook
 * (not the batch transcribe pipeline), so we copy the transcript across and mark
 * the callee session done here.
 */
async function finalizeVoiceAgentCalleeSession(
  supabase: any,
  callId: string,
  hostSessionId: string | null,
): Promise<void> {
  if (!hostSessionId) return
  try {
    const { data: callRow } = await supabase
      .from('calls')
      .select('callee_session_id, callee_user_id')
      .eq('id', callId)
      .not('callee_session_id', 'is', null)
      .maybeSingle()

    const calleeSessionId = callRow?.callee_session_id as string | null
    const calleeUserId = (callRow?.callee_user_id as string | null) || null
    if (!calleeSessionId) return

    const { data: calleeSession } = await supabase
      .from('sessions')
      .select('id, status, is_callee_pending')
      .eq('id', calleeSessionId)
      .maybeSingle()
    if (!calleeSession) return

    // Copy the host transcript to the callee session if it doesn't have one yet.
    const { data: existingCalleeTranscript } = await supabase
      .from('transcripts')
      .select('id')
      .eq('session_id', calleeSessionId)
      .limit(1)
      .maybeSingle()

    let hasTranscript = !!existingCalleeTranscript
    if (!existingCalleeTranscript) {
      const { data: hostTranscripts } = await supabase
        .from('transcripts')
        .select('raw_json, redacted_json, raw_text, redacted_text, language, summary')
        .eq('session_id', hostSessionId)
      for (const t of hostTranscripts || []) {
        await supabase.from('transcripts').insert({
          session_id: calleeSessionId,
          file_id: null,
          raw_json: t.raw_json,
          redacted_json: t.redacted_json,
          raw_text: t.raw_text,
          redacted_text: t.redacted_text,
          language: t.language,
          summary: t.summary ?? null,
        })
      }
      hasTranscript = (hostTranscripts?.length ?? 0) > 0
    }

    const { data: hostSession } = await supabase
      .from('sessions')
      .select('duration_sec, language, speechmatics_summary')
      .eq('id', hostSessionId)
      .maybeSingle()

    await supabase
      .from('sessions')
      .update({
        status: 'done',
        is_callee_pending: false,
        duration_sec: hostSession?.duration_sec || 0,
        language: hostSession?.language || 'de',
        speechmatics_summary: hostSession?.speechmatics_summary ?? null,
      })
      .eq('id', calleeSessionId)

    // Analyze the callee's own session too so they get context + suggested
    // outputs — only when it actually has transcript content.
    if (hasTranscript) {
      await enqueueVoiceAgentAnalysis(calleeSessionId, calleeUserId)
    }

    console.log('[LiveKit Webhook] Voice agent callee session finalized:', calleeSessionId)
  } catch (err: any) {
    console.error('[LiveKit Webhook] Failed to finalize callee session:', err?.message || err)
  }
}

/** True when the call host (participant A) and at least one guest are in the LiveKit room. */
async function callHasHostAndGuestInRoom(roomName: string, hostIdentity: string | null): Promise<boolean> {
  if (!hostIdentity) return false
  try {
    const participants = await listParticipants(roomName)
    const identities = participants.map((p) => p.identity).filter(Boolean) as string[]
    return identities.includes(hostIdentity) && identities.some((id) => id !== hostIdentity)
  } catch (err) {
    console.error('[LiveKit Webhook] listParticipants failed:', roomName, err)
    return false
  }
}

/**
 * POST /api/calls/webhook - LiveKit webhook handler.
 * 
 * Events handled:
 * - participant_joined: Record guest, activate + start egress when host and guest are both present
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
          .select('id, user_id, session_id, participant_a_identity, participant_b_identity, status, started_at, track_a_egress_id, track_b_egress_id, live_track_a_egress_id, live_track_b_egress_id, track_a_started_at_ns, track_b_started_at_ns, call_type, call_mode, contact_name, phone_number, pstn_consent_state, pstn_transcription_mode, purpose')
          .eq('room_name', roomName)
          .maybeSingle()

        if (primaryQuery.error && /pstn_consent_state|live_track_a_egress_id|live_track_b_egress_id|column .* does not exist/i.test(primaryQuery.error.message || '')) {
          const fallbackQuery = await supabase
            .from('calls')
            .select('id, user_id, session_id, participant_a_identity, participant_b_identity, status, started_at, track_a_egress_id, track_b_egress_id, live_track_a_egress_id, live_track_b_egress_id, track_a_started_at_ns, track_b_started_at_ns, call_type, call_mode, contact_name, phone_number, purpose')
            .eq('room_name', roomName)
            .maybeSingle()
          call = fallbackQuery.data
        } else {
          call = primaryQuery.data
        }

        if (!call) break

        // Inbound SIP calls are owned end-to-end by the voice agent: it creates
        // the calls row, transcribes both sides, and the room_finished webhook
        // finalizes the transcript. No batch egress is ever started here.
        if (call.call_type === 'pstn_inbound') {
          console.log('[LiveKit Webhook] Inbound voice-agent call — skipping egress:', call.id)
          break
        }

        const isParticipantB =
          identity !== call.participant_a_identity &&
          (!call.participant_b_identity || identity === call.participant_b_identity)

        // Remember who joined as the guest, even if the host is not in the room yet.
        if (isParticipantB) {
          const guestUpdates: Record<string, unknown> = {}
          if (call.participant_b_identity !== identity) {
            guestUpdates.participant_b_identity = identity
          }
          if (call.status === 'invited') {
            guestUpdates.accepted_at = new Date().toISOString()
          }
          if (Object.keys(guestUpdates).length > 0) {
            await supabase.from('calls').update(guestUpdates).eq('id', call.id)
            Object.assign(call, guestUpdates)
          }
        }

        // Recording and started_at begin only when host (A) and guest are both present.
        // This covers scheduled calls where the invitee arrives before the organizer.
        const bothPresent = await callHasHostAndGuestInRoom(roomName, call.participant_a_identity)
        if (!bothPresent) {
          console.log('[LiveKit Webhook] Waiting for both participants:', call.id, 'latest join:', identity)
          break
        }

        const activationUpdate: Record<string, unknown> = { status: 'active' }
        if (!call.started_at) {
          activationUpdate.started_at = new Date().toISOString()
        }
        await supabase.from('calls').update(activationUpdate).eq('id', call.id)

        console.log('[LiveKit Webhook] Call activated (both participants present):', call.id)

        const hasExistingEgress = Boolean(call.track_a_egress_id || call.track_b_egress_id)
        const calleeDeclinedPstnConsent =
          call.call_type === 'pstn_outbound' && call.pstn_consent_state === 'declined'
        const voiceAgentEnabled = await isVoiceAgentEnabledForUser(supabase, call.user_id)

        if (!hasExistingEgress && !calleeDeclinedPstnConsent) {
          try {
            let sessionId = call.session_id as string | null
            if (!sessionId) {
              const callMode = (call as any).call_mode
              const inputHint = call.call_type === 'pstn_outbound' ? 'phone_call' : callMode === 'video' ? 'video_call' : 'phone_call'
              const sessionLabel = call.call_type === 'pstn_outbound' ? 'Call' : callMode === 'video' ? 'Video Call' : 'Voice Call'
              const { data: newSession, error: sessionError } = await supabase
                .from('sessions')
                .insert({
                  user_id: call.user_id,
                  status: 'recording',
                  context_note: '',
                  internal_case_id: sessionLabel,
                  duration_sec: 0,
                  last_error: '',
                  input_hint: inputHint,
                  language: 'auto',
                  user_is_speaker: true,
                  recording_type: voiceAgentEnabled ? 'ai_agent_conversation' : undefined,
                  ...(call.purpose && String(call.purpose).trim()
                    ? { purpose: String(call.purpose).trim(), purpose_source: 'user' as const }
                    : {}),
                })
                .select('id')
                .single()
              if (sessionError || !newSession) {
                throw new Error(`Session creation failed: ${sessionError?.message || 'unknown'}`)
              }
              sessionId = newSession.id
              await supabase.from('calls').update({ session_id: sessionId }).eq('id', call.id)
              console.log('[LiveKit Webhook] Session created for call:', call.id, 'session:', sessionId)
            }

            if (voiceAgentEnabled) {
              console.log('[LiveKit Webhook] Voice agent enabled — skipping batch recording egress for call:', call.id)
              if (sessionId) {
                await supabase
                  .from('sessions')
                  .update({ status: 'recording' })
                  .eq('id', sessionId)
              }
            } else {
            const useDualTrack =
              call.call_type === 'pstn_outbound' &&
              (call as any).pstn_transcription_mode === 'live' &&
              !!call.participant_a_identity &&
              !!(call.participant_b_identity || identity)

            if (useDualTrack) {
              const participantAIdentity = call.participant_a_identity
              const participantBIdentity = call.participant_b_identity || identity
              const [egressA, egressB] = await Promise.all([
                startTrackEgressForParticipant(roomName, sessionId!, participantAIdentity, 'track_a'),
                startTrackEgressForParticipant(roomName, sessionId!, participantBIdentity, 'track_b'),
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
              const egress = await startCompositeEgress(roomName, sessionId!)
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
              .eq('id', sessionId)
            }
          } catch (err: any) {
            console.error('[LiveKit Webhook] Failed to start egress:', err.message)
            await supabase
              .from('calls')
              .update({ last_error: `Egress start failed: ${err.message}` })
              .eq('id', call.id)
          }
        }
        break
      }

      case 'room_finished': {
        const roomName = event.room?.name
        if (!roomName) break

        const { data: call } = await supabase
          .from('calls')
          .select('id, user_id, status, session_id, started_at, track_a_egress_id, track_b_egress_id, call_type, call_mode, purpose')
          .eq('room_name', roomName)
          .maybeSingle()

        if (!call) break

        const hasEgress = !!(call.track_a_egress_id || call.track_b_egress_id)
        const wasNeverActive = call.status === 'invited' || call.status === 'waiting'
        const isInbound = call.call_type === 'pstn_inbound'
        // Inbound voice-agent calls are finalized from live transcript lines the
        // same way as outbound voice-agent calls, regardless of the owner flag.
        const voiceAgentEnabled = isInbound || (call.user_id
          ? await isVoiceAgentEnabledForUser(supabase, call.user_id)
          : false)

        if (call.status === 'active' || call.status === 'waiting' || call.status === 'invited') {
          const nextStatus = wasNeverActive ? 'missed' : 'ended'

          if (call.status === 'active' && !hasEgress && !voiceAgentEnabled) {
            console.error('[LiveKit Webhook] WARNING: Active call ended with NO recording:', call.id,
              'started_at:', call.started_at, 'session:', call.session_id)
            await supabase
              .from('calls')
              .update({
                status: nextStatus,
                ended_at: new Date().toISOString(),
                last_error: 'Call was active but no recording was started (egress never triggered)',
              })
              .eq('id', call.id)
          } else {
            await supabase
              .from('calls')
              .update({
                status: nextStatus,
                ended_at: new Date().toISOString(),
                missed_at: nextStatus === 'missed' ? new Date().toISOString() : undefined,
                ...(voiceAgentEnabled && !hasEgress ? { last_error: null } : {}),
              })
              .eq('id', call.id)
          }

          console.log('[LiveKit Webhook] Call', nextStatus, ':', call.id)
        }

        if (voiceAgentEnabled && !hasEgress) {
          const sessionId = await finalizeVoiceAgentTranscript(supabase, call)
          console.log('[LiveKit Webhook] Voice agent call finalized without batch recording:', sessionId || 'no transcript')
          break
        }

        if (call.session_id && hasEgress && !wasNeverActive) {
          // Egress is still flushing to S3 — set session to 'uploading'.
          // egress_ended webhook will transition to 'transcribing'.
          // Guard: only downgrade from recording/created; never overwrite a later
          // pipeline state (transcribing/summarizing/done/error). Webhooks can be
          // redelivered, and a late room_finished retry after egress_ended would
          // otherwise regress status and desync the UI (list shows "Uploading"
          // while async_jobs is already running "session_transcribe").
          const { data: updatedRows, error: updateErr } = await supabase
            .from('sessions')
            .update({ status: 'uploading' })
            .eq('id', call.session_id)
            .in('status', ['created', 'recording', 'uploading'])
            .select('id')
          if (updateErr) {
            console.error('[LiveKit Webhook] Failed to set session uploading:', updateErr.message)
          } else if ((updatedRows?.length || 0) === 0) {
            console.log('[LiveKit Webhook] Skipped uploading downgrade (session past uploading):', call.session_id)
          } else {
            console.log('[LiveKit Webhook] Session set to uploading (egress pending):', call.session_id)
          }
        }

        // Sessions are now created only when recording starts (participant_joined),
        // so calls that never connected will have session_id = null — no cleanup needed.
        // Guard: if a session exists but has no egress (edge case), clean it up.
        // Voice-agent calls intentionally have no batch egress — keep the session.
        if (call.session_id && !hasEgress && !voiceAgentEnabled) {
          await supabase.from('calls').update({ session_id: null }).eq('id', call.id)
          await supabase.from('sessions').delete().eq('id', call.session_id)
          console.log('[LiveKit Webhook] Deleted session with no recording:', call.session_id, call.id)
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
              // Guard: same monotonic-pipeline protection as room_finished.
              // Avoid clobbering a later 'transcribing'/'summarizing'/'done' state if
              // this egress_ended is redelivered after the other track already
              // transitioned the session forward.
              await supabase
                .from('sessions')
                .update({ status: 'uploading' })
                .eq('id', call.session_id)
                .in('status', ['created', 'recording', 'uploading'])
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
