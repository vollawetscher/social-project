import { NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { requireAuth, requireSessionAccess } from '@/lib/auth/helpers'

type CleanupSuggestion = {
  id: string
  type: 'speaker_merge' | 'word'
  from: string
  to: string
  confidence: number
  evidence?: string
}

const COMMON_PHRASE_FIXES: Array<{ from: string; to: string; confidence: number }> = [
  { from: 'Ruhm loggen', to: 'Room locken', confidence: 0.87 },
  { from: 'Jokereinladung', to: 'Join Einladung', confidence: 0.7 },
  { from: 'Live Chat Userid', to: 'LiveKit User ID', confidence: 0.76 },
]

export async function GET(
  _request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const user = await requireAuth()
    await requireSessionAccess(params.id, user.id)

    const db = createServiceRoleClient()
    const { data: sessionRow, error: sessionError } = await db
      .from('sessions')
      .select('transcript_corrections')
      .eq('id', params.id)
      .single()

    if (sessionError) {
      return NextResponse.json({ error: sessionError.message }, { status: 500 })
    }

    const { data: transcripts, error } = await db
      .from('transcripts')
      .select('id, raw_json, raw_text, created_at')
      .eq('session_id', params.id)
      .order('created_at', { ascending: true })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    if (!transcripts || transcripts.length === 0) {
      return NextResponse.json({ suggestions: [] })
    }

    const allSegments = (transcripts || []).flatMap((t: any) =>
      Array.isArray(t.raw_json) ? t.raw_json : []
    )
    const corrections = ((sessionRow as any)?.transcript_corrections || {}) as Record<string, any>
    const acceptedSuggestionIds = new Set(
      Array.isArray(corrections.accepted_suggestions)
        ? corrections.accepted_suggestions.map((v: unknown) => String(v))
        : []
    )
    const existingSpeakerMerges = (corrections.speaker_merge_map || {}) as Record<string, string>
    const existingWordCorrections = (corrections.word_corrections || {}) as Record<string, string>

    const speakerStats = new Map<string, { turns: number; words: number }>()
    for (const seg of allSegments) {
      const speaker = String(seg?.speaker || '').trim()
      if (!speaker) continue
      const words = String(seg?.text || '').trim().split(/\s+/).filter(Boolean).length
      const cur = speakerStats.get(speaker) || { turns: 0, words: 0 }
      cur.turns += 1
      cur.words += words
      speakerStats.set(speaker, cur)
    }

    const suggestions: CleanupSuggestion[] = []

    // Detect likely one-off diarization artifacts and propose merges.
    for (let i = 0; i < allSegments.length; i += 1) {
      const seg = allSegments[i]
      const speaker = String(seg?.speaker || '').trim()
      if (!speaker) continue
      const stats = speakerStats.get(speaker)
      if (!stats) continue

      const singleton = stats.turns <= 1 || (stats.turns <= 2 && stats.words <= 6)
      if (!singleton) continue

      const prevSpeaker = String(allSegments[i - 1]?.speaker || '').trim()
      const nextSpeaker = String(allSegments[i + 1]?.speaker || '').trim()
      let target = ''
      if (prevSpeaker && prevSpeaker === nextSpeaker && prevSpeaker !== speaker) {
        target = prevSpeaker
      } else if (prevSpeaker && prevSpeaker !== speaker) {
        target = prevSpeaker
      } else if (nextSpeaker && nextSpeaker !== speaker) {
        target = nextSpeaker
      }
      if (!target) continue

      const id = `speaker_merge:${speaker}->${target}`
      if (suggestions.some((s) => s.id === id)) continue
      if (acceptedSuggestionIds.has(id)) continue
      if (existingSpeakerMerges[speaker] === target) continue
      suggestions.push({
        id,
        type: 'speaker_merge',
        from: speaker,
        to: target,
        confidence: 0.82,
        evidence: String(seg?.text || '').slice(0, 160),
      })
    }

    // Common phrase corrections (cheap deterministic layer).
    const fullText = transcripts
      .map((t: any) => String(t?.raw_text || ''))
      .join('\n')
    for (const phraseFix of COMMON_PHRASE_FIXES) {
      if (!fullText.includes(phraseFix.from)) continue
      const id = `word:${phraseFix.from}`
      if (acceptedSuggestionIds.has(id)) continue
      if (existingWordCorrections[phraseFix.from] === phraseFix.to) continue
      suggestions.push({
        id,
        type: 'word',
        from: phraseFix.from,
        to: phraseFix.to,
        confidence: phraseFix.confidence,
        evidence: phraseFix.from,
      })
    }

    // AI reconciliation merges (from the speaker-review gate's Claude pass).
    // These are content-aware — they catch cross-language duplicates and larger
    // spurious labels the deterministic singleton heuristic cannot. Surfaced
    // through the same suggestion channel so the existing apply/persist flow
    // handles them.
    const reconcileMerges = Array.isArray(corrections.reconcile_merges) ? corrections.reconcile_merges : []
    for (const m of reconcileMerges) {
      const from = String((m as any)?.from || '').trim()
      const to = String((m as any)?.to || '').trim()
      if (!from || !to || from === to) continue
      const id = `speaker_merge:${from}->${to}`
      if (suggestions.some((s) => s.id === id)) continue
      if (acceptedSuggestionIds.has(id)) continue
      if (existingSpeakerMerges[from] === to) continue
      suggestions.push({
        id,
        type: 'speaker_merge',
        from,
        to,
        confidence: 0.9,
        evidence: String((m as any)?.reason || '').slice(0, 160),
      })
    }

    suggestions.sort((a, b) => b.confidence - a.confidence)
    return NextResponse.json({ suggestions })
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || 'Failed to generate cleanup suggestions' },
      { status: 500 }
    )
  }
}
