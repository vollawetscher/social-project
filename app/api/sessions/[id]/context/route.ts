import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    console.log('[Context API] Saving user context for session:', params.id)
    
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { 
      recordingType, 
      domains, 
      extractedContext,
      lockContext = true 
    } = body

    console.log('[Context API] Received:', {
      recordingType,
      domains: domains?.length,
      extractedContext: Object.keys(extractedContext || {}).length,
      lockContext
    })

    // Build update object
    const updates: any = {
      context_locked: lockContext,
    }

    if (recordingType) {
      updates.user_recording_type = recordingType
    }

    if (domains) {
      updates.user_domains = domains
    }

    if (extractedContext) {
      // Merge with existing AI-extracted context, preserving user edits
      const { data: existingSession } = await supabase
        .from('sessions')
        .select('ai_extracted_context')
        .eq('id', params.id)
        .single()

      updates.ai_extracted_context = {
        ...(existingSession?.ai_extracted_context || {}),
        ...extractedContext,
        userEdited: true,
        editedAt: new Date().toISOString()
      }
    }

    console.log('[Context API] Updating session with:', Object.keys(updates))

    // Update session
    const { data: session, error: updateError } = await supabase
      .from('sessions')
      .update(updates)
      .eq('id', params.id)
      .eq('user_id', user.id)
      .select()
      .single()

    if (updateError) {
      console.error('[Context API] Error updating session:', updateError)
      return NextResponse.json({ 
        error: 'Failed to save context', 
        details: updateError 
      }, { status: 500 })
    }

    console.log('[Context API] Context saved successfully')
    return NextResponse.json({ 
      success: true,
      session: {
        id: session.id,
        contextLocked: session.context_locked,
        userRecordingType: session.user_recording_type,
        userDomains: session.user_domains,
        extractedContext: session.ai_extracted_context
      }
    })
  } catch (error: any) {
    console.error('[Context API] Error:', error)
    return NextResponse.json({ 
      error: 'Failed to save context',
      message: error?.message 
    }, { status: 500 })
  }
}
