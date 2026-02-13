import { createClient, createServiceRoleClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { requireSessionAccess } from '@/lib/auth/helpers'

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

    await requireSessionAccess(params.id, user.id)

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()
    const isAdmin = profile?.role === 'admin'
    const db = isAdmin ? createServiceRoleClient() : supabase

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
      const existingQuery = db.from('sessions').select('ai_extracted_context').eq('id', params.id)
      const { data: existingSession } = isAdmin
        ? await existingQuery.single()
        : await existingQuery.eq('user_id', user.id).single()

      updates.ai_extracted_context = {
        ...(existingSession?.ai_extracted_context || {}),
        ...extractedContext,
        userEdited: true,
        editedAt: new Date().toISOString()
      }
    }

    console.log('[Context API] Updating session with:', Object.keys(updates))

    // Update session
    const updateQuery = db.from('sessions').update(updates).eq('id', params.id)
    const { data: session, error: updateError } = isAdmin
      ? await updateQuery.select().single()
      : await updateQuery.eq('user_id', user.id).select().single()

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
