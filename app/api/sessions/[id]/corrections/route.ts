import { createClient, createServiceRoleClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { requireSessionAccess } from '@/lib/auth/helpers'

function isObjectRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value)
}

function validateSpeakerMergeMap(map: Record<string, string>): { valid: boolean; error?: string } {
  // Prevent self-mapping and simple/indirect cycles.
  for (const [from, to] of Object.entries(map)) {
    if (!from || !to) continue
    if (from === to) {
      return { valid: false, error: `Invalid speaker merge "${from} -> ${to}"` }
    }
  }

  const visitedGlobal = new Set<string>()
  for (const start of Object.keys(map)) {
    if (visitedGlobal.has(start)) continue
    const visitedPath = new Set<string>()
    let current: string | undefined = start
    while (current && map[current]) {
      if (visitedPath.has(current)) {
        return { valid: false, error: `Speaker merge cycle detected at "${current}"` }
      }
      visitedPath.add(current)
      visitedGlobal.add(current)
      current = map[current]
    }
  }

  return { valid: true }
}

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient()
    
    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    await requireSessionAccess(params.id, user.id)

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()
    const isAdmin = profile?.role === 'admin'
    const db = isAdmin ? createServiceRoleClient() : supabase

    const body = await request.json()
    const { corrections, type, replace } = body // type: 'name_corrections' | 'pii_redactions' | 'word_corrections' | 'bulk_cleanup'

    if (!corrections || typeof corrections !== 'object') {
      return NextResponse.json({ error: 'Invalid corrections format' }, { status: 400 })
    }

    // Fetch current session to merge corrections
    const sessionQuery = db.from('sessions').select('transcript_corrections').eq('id', params.id)
    const { data: session, error: fetchError } = isAdmin
      ? await sessionQuery.single()
      : await sessionQuery.eq('user_id', user.id).single()

    if (fetchError || !session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 })
    }

    const existingCorrections = (session.transcript_corrections || {}) as Record<string, any>
    const allowedTypes = new Set([
      'name_corrections',
      'pii_redactions',
      'word_corrections',
      'speaker_name_map',
      'speaker_merge_map',
      'segment_speaker_overrides',
      'accepted_suggestions',
      'bulk_cleanup',
    ])
    if (!allowedTypes.has(String(type || ''))) {
      return NextResponse.json({ error: `Unsupported correction type: ${type}` }, { status: 400 })
    }

    let updatedCorrections: Record<string, any> = existingCorrections

    if (type === 'bulk_cleanup') {
      if (!isObjectRecord(corrections)) {
        return NextResponse.json({ error: 'Invalid bulk cleanup payload' }, { status: 400 })
      }

      const incomingSpeakerNameMap = isObjectRecord(corrections.speaker_name_map)
        ? (corrections.speaker_name_map as Record<string, string>)
        : {}
      const incomingSpeakerMergeMap = isObjectRecord(corrections.speaker_merge_map)
        ? (corrections.speaker_merge_map as Record<string, string>)
        : {}
      const incomingWordCorrections = isObjectRecord(corrections.word_corrections)
        ? (corrections.word_corrections as Record<string, string>)
        : {}
      const incomingAccepted = Array.isArray(corrections.accepted_suggestions)
        ? corrections.accepted_suggestions.map((v) => String(v))
        : []

      // Replace (not merge) maps on bulk cleanup. The UI preloads existing corrections
      // into its draft state, so the incoming draft represents the intended final state.
      // Merging would make removals (un-merging speakers, deleting word corrections)
      // impossible and thus cleanup effectively irreversible.
      const mergeValidation = validateSpeakerMergeMap(incomingSpeakerMergeMap)
      if (!mergeValidation.valid) {
        return NextResponse.json({ error: mergeValidation.error || 'Invalid speaker merge map' }, { status: 400 })
      }

      updatedCorrections = {
        ...existingCorrections,
        speaker_name_map: incomingSpeakerNameMap,
        speaker_merge_map: incomingSpeakerMergeMap,
        word_corrections: incomingWordCorrections,
        accepted_suggestions: incomingAccepted,
        // Keep legacy compatibility for existing UI/output paths.
        name_corrections: incomingSpeakerNameMap,
      }
    } else {
      updatedCorrections = {
        ...existingCorrections,
        [type]: replace
          ? corrections
          : {
              ...(existingCorrections[type as keyof typeof existingCorrections] || {}),
              ...corrections
            }
      }

      // Keep legacy and new speaker name map in sync.
      if (type === 'name_corrections' || type === 'speaker_name_map') {
        const mergedNames = updatedCorrections[type] || {}
        updatedCorrections.name_corrections = mergedNames
        updatedCorrections.speaker_name_map = mergedNames
      }
      if (type === 'speaker_merge_map') {
        const mergeValidation = validateSpeakerMergeMap(updatedCorrections.speaker_merge_map || {})
        if (!mergeValidation.valid) {
          return NextResponse.json({ error: mergeValidation.error || 'Invalid speaker merge map' }, { status: 400 })
        }
      }
    }

    // Update session with merged corrections
    const updateQuery = db.from('sessions').update({ transcript_corrections: updatedCorrections }).eq('id', params.id)
    const { error: updateError } = isAdmin
      ? await updateQuery
      : await updateQuery.eq('user_id', user.id)

    if (updateError) {
      console.error('[Corrections API] Update error:', updateError)
      return NextResponse.json({ 
        error: 'Failed to save corrections',
        details: updateError.message 
      }, { status: 500 })
    }

    // Persist word corrections for later quality analysis / dictionary rollout.
    // Only increment when correction is new or changed (avoid inflating on every save).
    const wordCorrectionsToPersist: Record<string, string> | null =
      type === 'word_corrections' && typeof corrections === 'object' && !Array.isArray(corrections)
        ? (corrections as Record<string, string>)
        : type === 'bulk_cleanup' && isObjectRecord((corrections as Record<string, unknown>).word_corrections)
          ? ((corrections as Record<string, unknown>).word_corrections as Record<string, string>)
          : null

    if (wordCorrectionsToPersist) {
      const prev = (existingCorrections.word_corrections || {}) as Record<string, string>
      for (const [original, corrected] of Object.entries(wordCorrectionsToPersist)) {
        const o = String(original ?? '').trim()
        const c = String(corrected ?? '').trim()
        if (!o || !c) continue
        const unchanged = prev[o] === c
        const { data: existing } = await db
          .from('user_word_corrections')
          .select('id, use_count')
          .eq('user_id', user.id)
          .eq('original', o)
          .maybeSingle()
        if (existing) {
          await db
            .from('user_word_corrections')
            .update({
              corrected: c,
              ...(unchanged ? {} : { use_count: (existing.use_count ?? 1) + 1 }),
              updated_at: new Date().toISOString(),
            })
            .eq('id', existing.id)
        } else {
          await db.from('user_word_corrections').insert({
            user_id: user.id,
            original: o,
            corrected: c,
            use_count: 1,
          })
        }
      }
    }

    return NextResponse.json({ 
      success: true,
      corrections: updatedCorrections
    })
  } catch (error: any) {
    console.error('[Corrections API] Error:', error)
    return NextResponse.json({ 
      error: 'Failed to save corrections',
      message: error?.message 
    }, { status: 500 })
  }
}

// DELETE endpoint to reset transcript cleanup (speaker names, merges, word corrections,
// accepted suggestions, and segment overrides). Raw transcript data is not touched.
export async function DELETE(
  _request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    await requireSessionAccess(params.id, user.id)

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()
    const isAdmin = profile?.role === 'admin'
    const db = isAdmin ? createServiceRoleClient() : supabase

    const sessionQuery = db.from('sessions').select('transcript_corrections').eq('id', params.id)
    const { data: session, error: fetchError } = isAdmin
      ? await sessionQuery.single()
      : await sessionQuery.eq('user_id', user.id).single()

    if (fetchError || !session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 })
    }

    const existingCorrections = (session.transcript_corrections || {}) as Record<string, any>

    // Strip cleanup-related keys, preserving any other fields (e.g. pii_redactions).
    const preserved: Record<string, any> = { ...existingCorrections }
    delete preserved.speaker_name_map
    delete preserved.speaker_merge_map
    delete preserved.word_corrections
    delete preserved.accepted_suggestions
    delete preserved.segment_speaker_overrides
    delete preserved.name_corrections

    const updateQuery = db
      .from('sessions')
      .update({ transcript_corrections: preserved })
      .eq('id', params.id)
    const { error: updateError } = isAdmin
      ? await updateQuery
      : await updateQuery.eq('user_id', user.id)

    if (updateError) {
      console.error('[Corrections API] Reset error:', updateError)
      return NextResponse.json({
        error: 'Failed to reset cleanup',
        details: updateError.message,
      }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      corrections: preserved,
    })
  } catch (error: any) {
    console.error('[Corrections API] Reset error:', error)
    return NextResponse.json({
      error: 'Failed to reset cleanup',
      message: error?.message,
    }, { status: 500 })
  }
}

// GET endpoint to retrieve corrections
export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient()
    
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    await requireSessionAccess(params.id, user.id)

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()
    const isAdmin = profile?.role === 'admin'
    const db = isAdmin ? createServiceRoleClient() : supabase

    const sessionQuery = db.from('sessions').select('transcript_corrections').eq('id', params.id)
    const { data: session, error } = isAdmin
      ? await sessionQuery.single()
      : await sessionQuery.eq('user_id', user.id).single()

    if (error || !session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 })
    }

    return NextResponse.json({ 
      corrections: session.transcript_corrections || {}
    })
  } catch (error: any) {
    console.error('[Corrections API] Error:', error)
    return NextResponse.json({ 
      error: 'Failed to fetch corrections',
      message: error?.message 
    }, { status: 500 })
  }
}
