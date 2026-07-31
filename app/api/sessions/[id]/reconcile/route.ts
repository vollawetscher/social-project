/**
 * POST /api/sessions/[id]/reconcile
 *
 * The speaker-reconciliation pass. Runs AFTER transcription and BEFORE the
 * expensive analysis, for diarized audio whose transcript still carries
 * acoustic speaker labels (S1, S2, …). A focused Claude call:
 *
 *   1. Proposes speaker MERGES — collapsing acoustic labels that are the same
 *      person (including the same speaker split across languages) and folding
 *      noise/one-off fragments into the nearest real participant.
 *   2. Produces the OWNER ASSESSMENT (the "who are you in this conversation?"
 *      role question), the same one the analyzer used to emit AFTER analysis —
 *      pulled forward so the user answers speakers + role in a single gate and
 *      the later analysis never has to re-ask.
 *
 * The merges are stored as SUGGESTIONS (transcript_corrections.reconcile_merges)
 * for the review gate to display; they are only applied to speaker_merge_map
 * when the user confirms. The session is parked at status
 * 'awaiting_speaker_review'. Nothing is analyzed until the gate is released.
 */
import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createClient, createServiceRoleClient } from '@/lib/supabase/server'
import { requireAuth, requireSessionAccess, handleAuthError } from '@/lib/auth/helpers'
import { recordAiTokens } from '@/lib/services/usage-tracker'
import { logPipelineEvent } from '@/lib/services/pipeline-logger'
import { JSON_ONLY_SUFFIX, withJsonPrefill } from '@/lib/utils/claude-json'
import { isAcousticSpeakerLabel, countAcousticSpeakers } from '@/lib/utils/speaker-resolution'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })

type Segment = { speaker?: string; text?: string; start_ms?: number; end_ms?: number }

const asSegmentArray = (value: unknown): Segment[] =>
  Array.isArray(value) ? (value as Segment[]) : []

function wordCount(text: string): number {
  const t = String(text || '').trim()
  return t ? t.split(/\s+/).length : 0
}

/**
 * Compact per-speaker overview so Claude can decide merges without the full
 * (potentially 80+ minute) transcript: stats + a few representative utterances.
 */
function buildSpeakerOverview(segments: Segment[]): string {
  const stats = new Map<string, { turns: number; words: number; ms: number; samples: string[] }>()
  for (const seg of segments) {
    const label = String(seg?.speaker || '').trim()
    if (!isAcousticSpeakerLabel(label)) continue
    const key = label.toUpperCase()
    const cur = stats.get(key) || { turns: 0, words: 0, ms: 0, samples: [] }
    cur.turns += 1
    cur.words += wordCount(seg.text || '')
    cur.ms += Math.max(0, Number(seg.end_ms || 0) - Number(seg.start_ms || 0))
    const text = String(seg.text || '').trim()
    if (text && cur.samples.length < 5) cur.samples.push(text.slice(0, 160))
    stats.set(key, cur)
  }

  const ordered = Array.from(stats.entries()).sort((a, b) => b[1].ms - a[1].ms)
  return ordered
    .map(([label, s]) => {
      const secs = Math.round(s.ms / 1000)
      const samples = s.samples.map((t) => `    • "${t}"`).join('\n')
      return `${label}: ${s.turns} turns, ${s.words} words, ~${secs}s\n${samples}`
    })
    .join('\n\n')
}

function normalizeLabel(value: unknown): string {
  const s = String(value || '').trim().toUpperCase()
  return isAcousticSpeakerLabel(s) ? s : ''
}

/**
 * Validate the model's merges: both sides must be real acoustic labels present
 * in the transcript, no self-merges, and no cycles (A→B and B→A).
 */
function sanitizeMerges(
  raw: unknown,
  presentLabels: Set<string>
): Array<{ from: string; to: string; reason: string }> {
  if (!Array.isArray(raw)) return []
  const out: Array<{ from: string; to: string; reason: string }> = []
  const targetOf = new Map<string, string>()
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue
    const from = normalizeLabel((item as any).from)
    const to = normalizeLabel((item as any).to)
    if (!from || !to || from === to) continue
    if (!presentLabels.has(from) || !presentLabels.has(to)) continue
    // Prevent cycles: if `to` already merges back to `from`, skip.
    if (targetOf.get(to) === from) continue
    if (targetOf.has(from)) continue
    targetOf.set(from, to)
    out.push({ from, to, reason: String((item as any).reason || '').slice(0, 200) })
  }
  return out
}

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const internalSecret = request.headers.get('x-internal-secret')
    const internalUserId = request.headers.get('x-internal-user-id')
    const isInternalCall =
      !!process.env.INTERNAL_API_SECRET &&
      internalSecret === process.env.INTERNAL_API_SECRET &&
      !!internalUserId

    let supabase: Awaited<ReturnType<typeof createClient>>
    let userId: string
    if (isInternalCall) {
      supabase = createServiceRoleClient() as any
      userId = internalUserId!
    } else {
      const user = await requireAuth(request)
      await requireSessionAccess(params.id, user.id)
      supabase = await createClient()
      userId = user.id
    }

    const { data: session } = await supabase
      .from('sessions')
      .select('id, user_id, language, input_hint, context_note, internal_case_id, transcript_corrections, owner_context, user_is_speaker')
      .eq('id', params.id)
      .single()

    if (!session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 })
    }

    const { data: transcripts } = await supabase
      .from('transcripts')
      .select('raw_json')
      .eq('session_id', params.id)

    const segments: Segment[] = (transcripts || []).flatMap((t: any) => asSegmentArray(t?.raw_json))
    const acousticCount = countAcousticSpeakers(segments)

    // Defensive: reconcile is only enqueued for ≥2 acoustic speakers. If that no
    // longer holds, there is nothing to reconcile — just park at the gate so the
    // user can still release analysis (or the caller can proceed directly).
    if (acousticCount < 2) {
      await supabase
        .from('sessions')
        .update({ status: 'awaiting_speaker_review' })
        .eq('id', params.id)
      return NextResponse.json({ ok: true, skipped: 'not_enough_acoustic_speakers', acousticCount })
    }

    const presentLabels = new Set<string>()
    for (const seg of segments) {
      const label = normalizeLabel(seg?.speaker)
      if (label) presentLabels.add(label)
    }

    const { data: ownerProfile } = await supabase
      .from('profiles')
      .select('display_name')
      .eq('id', session.user_id)
      .maybeSingle()
    const ownerName = String((ownerProfile as any)?.display_name || '').trim() || 'the session owner'

    const overview = buildSpeakerOverview(segments)
    const contextNote = String((session as any)?.context_note || '').trim()
    const inputHint = String((session as any)?.input_hint || '').trim() || 'unknown'

    // The owner explicitly marked themselves as NOT a speaker (e.g. unchecked
    // "I am a speaker in this meeting" on upload). Never ask which speaker they
    // are — they are not in the recording.
    const ownerIsNotSpeaker = (session as any)?.user_is_speaker === false

    const ownerSection = ownerIsNotSpeaker
      ? `Only do part 1. The owner ("${ownerName}") is NOT a speaker in this recording, so do not attempt to identify or ask about the owner.`
      : `2. OWNER ASSESSMENT — Determine "${ownerName}"'s role in this conversation (they own this recording). If you can infer it confidently from the transcript, provide it. If not, emit a single grounded clarification question with 2-4 concrete options tied to actual speaker labels.`

    const ownerJsonShape = ownerIsNotSpeaker
      ? ''
      : `,
  "ownerAssessment": {
    "needsClarification": false,
    "context": { "role": "…", "speakerId": "S1 or null", "goal": "… or null", "counterpartyRole": "… or null", "confidence": 0.0 }
  }`

    const ownerRules = ownerIsNotSpeaker
      ? ''
      : `\n- ownerAssessment: if confidence >= 0.75 use the "context" branch (needsClarification=false). If lower, use: "ownerAssessment": { "needsClarification": true, "clarification": { "question": "…", "options": [ { "id": "opt1", "label": "…", "suggestedContext": { "role": "…", "speakerId": "S1" } } ], "allowFreeText": true } }.`

    const prompt = `You are reconciling the SPEAKER LABELS of a transcript produced by acoustic diarization. The diarizer assigns provisional labels (S1, S2, …) and commonly OVER-SEGMENTS: it splits one real person into several labels (especially when a person switches languages, changes tone, or is picked up at a different mic distance) and it invents tiny labels for background noise or one-word interjections.

Your job is NOT to summarize:

1. SPEAKER MERGES — Decide which acoustic labels are actually the SAME person, and which tiny labels are noise/one-off fragments that belong to a neighbouring real speaker. Merge them. Use the CONTENT and conversational flow, not just acoustics — e.g. a person speaking Spanish in one label and English in another is still one person; a technical explanation attributed to a label that otherwise only says "yes/okay" was almost certainly the presenter.

${ownerSection}

SESSION CONTEXT:
- Owner: ${ownerName}
- User-provided hint: ${inputHint}${contextNote ? `\n- Owner's note: ${contextNote}` : ''}

SPEAKERS (acoustic label: stats + representative utterances):
${overview}

Return JSON with this exact shape:
{
  "speakerMerges": [
    { "from": "S9", "to": "S1", "reason": "same speaker; S9 is S1 continuing in English" }
  ]${ownerJsonShape}
}

Rules:
- "from"/"to" MUST be labels that appear in the SPEAKERS list above. Never merge a label into itself. Merge INTO the label that most represents the real person (usually the one with more speech).
- Only propose merges you are reasonably confident about. It is fine to return an empty "speakerMerges" array if the diarization already looks clean.${ownerRules}${JSON_ONLY_SUFFIX}`

    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 2000,
      messages: [{ role: 'user', content: prompt }],
    })

    const usage = (message as { usage?: { input_tokens?: number; output_tokens?: number } }).usage
    if (usage?.input_tokens != null || usage?.output_tokens != null) {
      recordAiTokens(supabase, userId, usage.input_tokens ?? 0, usage.output_tokens ?? 0, {
        sessionId: params.id,
        endpoint: 'sessions/reconcile',
      })
    }

    const rawText = message.content[0]?.type === 'text' ? message.content[0].text : ''
    let parsed: Record<string, any> = {}
    try {
      parsed = JSON.parse(withJsonPrefill(rawText))
    } catch (parseError: any) {
      await logPipelineEvent({
        sessionId: params.id,
        caseId: (session as any)?.case_id || null,
        userId,
        stage: 'reconcile',
        event: 'parse_failed',
        severity: 'error',
        metadata: { message: String(parseError?.message || 'parse failed'), responseHead: rawText.slice(0, 400) },
      }, supabase as any)
      // Do not block the pipeline on a parse failure: park at the gate with no
      // AI suggestions so the user can still review manually.
      parsed = {}
    }

    const merges = sanitizeMerges(parsed.speakerMerges, presentLabels)

    // Apply the AI merges directly into speaker_merge_map so the review gate
    // shows the collapsed speaker count immediately — the user reviews the
    // result and can split any speaker back via the dropdown. Requiring a
    // manual click per merge (14+ for a heavily over-segmented recording) made
    // the AI pass effectively useless. We keep reconcile_merges as an audit
    // trail. Never overwrite a mapping the user already set.
    const existingCorrections = ((session as any)?.transcript_corrections || {}) as Record<string, any>
    const existingMergeMap = (existingCorrections.speaker_merge_map || {}) as Record<string, string>
    const appliedMergeMap: Record<string, string> = { ...existingMergeMap }
    for (const m of merges) {
      if (!appliedMergeMap[m.from]) appliedMergeMap[m.from] = m.to
    }
    const nextCorrections = {
      ...existingCorrections,
      speaker_merge_map: appliedMergeMap,
      reconcile_merges: merges,
    }

    // Owner assessment → owner_context (confident) or pending_clarification
    // (uncertain), mirroring the analyzer. Never override an owner_context the
    // user already answered.
    const existingOwnerContext = ((session as any)?.owner_context || null) as Record<string, any> | null
    let nextOwnerContext: Record<string, any> | null = existingOwnerContext
    let nextPendingClarification: Record<string, any> | null = null
    const ownerAssessment = parsed?.ownerAssessment
    if (ownerIsNotSpeaker) {
      // Owner is not a participant — record that once, never ask.
      if (!existingOwnerContext) {
        nextOwnerContext = { role: 'observer', speakerId: null, source: 'not_speaker', updatedAt: new Date().toISOString() }
      }
    } else if (!existingOwnerContext && ownerAssessment && typeof ownerAssessment === 'object') {
      const needsClarification = Boolean(ownerAssessment.needsClarification)
      if (needsClarification && ownerAssessment.clarification && typeof ownerAssessment.clarification === 'object') {
        const clarification = ownerAssessment.clarification as Record<string, any>
        const options = (Array.isArray(clarification.options) ? clarification.options : [])
          .map((opt: any) => {
            if (!opt || typeof opt !== 'object') return null
            const id = String(opt.id || '').trim()
            const label = String(opt.label || '').trim()
            if (!id || !label) return null
            return {
              id,
              label,
              suggestedContext:
                opt.suggestedContext && typeof opt.suggestedContext === 'object' ? opt.suggestedContext : null,
            }
          })
          .filter(Boolean)
        const question = String(clarification.question || '').trim()
        if (question && options.length >= 2) {
          nextPendingClarification = {
            question,
            options,
            allowFreeText: clarification.allowFreeText !== false,
            createdAt: new Date().toISOString(),
          }
        }
      } else if (ownerAssessment.context && typeof ownerAssessment.context === 'object') {
        const ctx = ownerAssessment.context as Record<string, any>
        const role = String(ctx.role || '').trim()
        if (role) {
          nextOwnerContext = {
            role,
            speakerId: ctx.speakerId ? String(ctx.speakerId) : null,
            goal: ctx.goal ? String(ctx.goal) : null,
            counterpartyRole: ctx.counterpartyRole ? String(ctx.counterpartyRole) : null,
            confidence: typeof ctx.confidence === 'number' ? ctx.confidence : null,
            source: 'inferred',
            updatedAt: new Date().toISOString(),
          }
        }
      }
    }

    await supabase
      .from('sessions')
      .update({
        transcript_corrections: nextCorrections,
        owner_context: nextOwnerContext,
        pending_clarification: nextPendingClarification,
        status: 'awaiting_speaker_review',
      })
      .eq('id', params.id)

    await logPipelineEvent({
      sessionId: params.id,
      caseId: (session as any)?.case_id || null,
      userId,
      stage: 'reconcile',
      event: 'job_completed',
      metadata: {
        acousticSpeakers: acousticCount,
        proposedMerges: merges.length,
        ownerNeedsClarification: Boolean(nextPendingClarification),
        ownerInferred: Boolean(nextOwnerContext && (nextOwnerContext as any)?.source === 'inferred'),
      },
    }, supabase as any)

    return NextResponse.json({
      ok: true,
      acousticSpeakers: acousticCount,
      proposedMerges: merges.length,
      needsClarification: Boolean(nextPendingClarification),
    })
  } catch (error: any) {
    const handled = handleAuthError(error)
    return NextResponse.json({ error: handled.message }, { status: handled.status })
  }
}
