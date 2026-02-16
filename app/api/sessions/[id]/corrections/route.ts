import { createClient, createServiceRoleClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { requireSessionAccess } from '@/lib/auth/helpers'

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
    const { corrections, type, replace } = body // type: 'name_corrections' | 'pii_redactions' | 'word_corrections'; replace: full replace for type

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

    const existingCorrections = session.transcript_corrections || {}
    const updatedCorrections = {
      ...existingCorrections,
      [type]: replace
        ? corrections
        : {
            ...(existingCorrections[type as keyof typeof existingCorrections] || {}),
            ...corrections
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

    // Record word corrections to user_word_corrections for Speechmatics dictionary (top used)
    // Only increment when correction is new or changed (avoid inflating on every save)
    if (type === 'word_corrections' && typeof corrections === 'object' && !Array.isArray(corrections)) {
      const prev = (existingCorrections.word_corrections || {}) as Record<string, string>
      const wordCorrections = corrections as Record<string, string>
      for (const [original, corrected] of Object.entries(wordCorrections)) {
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
