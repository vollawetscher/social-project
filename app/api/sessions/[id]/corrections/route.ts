import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

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

    const body = await request.json()
    const { corrections, type, replace } = body // type: 'name_corrections' | 'pii_redactions' | 'word_corrections'; replace: full replace for type

    if (!corrections || typeof corrections !== 'object') {
      return NextResponse.json({ error: 'Invalid corrections format' }, { status: 400 })
    }

    // Fetch current session to merge corrections
    const { data: session, error: fetchError } = await supabase
      .from('sessions')
      .select('transcript_corrections')
      .eq('id', params.id)
      .eq('user_id', user.id)
      .single()

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
    const { error: updateError } = await supabase
      .from('sessions')
      .update({ transcript_corrections: updatedCorrections })
      .eq('id', params.id)
      .eq('user_id', user.id)

    if (updateError) {
      console.error('[Corrections API] Update error:', updateError)
      return NextResponse.json({ 
        error: 'Failed to save corrections',
        details: updateError.message 
      }, { status: 500 })
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

    const { data: session, error } = await supabase
      .from('sessions')
      .select('transcript_corrections')
      .eq('id', params.id)
      .eq('user_id', user.id)
      .single()

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
