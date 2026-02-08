import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

// Enable sharing for an output
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

    // Verify ownership
    const { data: output, error: fetchError } = await supabase
      .from('outputs')
      .select('id, created_by, share_token, is_public')
      .eq('id', params.id)
      .eq('created_by', user.id)
      .single()

    if (fetchError || !output) {
      return NextResponse.json({ error: 'Output not found' }, { status: 404 })
    }

    // Enable sharing
    const { data: updated, error: updateError } = await supabase
      .from('outputs')
      .update({
        is_public: true,
        shared_at: new Date().toISOString(),
      })
      .eq('id', params.id)
      .select('share_token')
      .single()

    if (updateError) {
      console.error('Error enabling sharing:', updateError)
      return NextResponse.json({ error: 'Failed to enable sharing' }, { status: 500 })
    }

    // Generate share URL
    const shareUrl = `${request.headers.get('origin')}/share/${updated.share_token}`

    return NextResponse.json({
      success: true,
      shareToken: updated.share_token,
      shareUrl,
      isPublic: true,
    })
  } catch (error: any) {
    console.error('Error in POST /api/outputs/[id]/share:', error)
    return NextResponse.json({ 
      error: 'Internal server error',
      message: error.message 
    }, { status: 500 })
  }
}

// Disable sharing for an output
export async function DELETE(
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

    // Verify ownership and disable sharing
    const { error: updateError } = await supabase
      .from('outputs')
      .update({
        is_public: false,
      })
      .eq('id', params.id)
      .eq('created_by', user.id)

    if (updateError) {
      console.error('Error disabling sharing:', updateError)
      return NextResponse.json({ error: 'Failed to disable sharing' }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      isPublic: false,
    })
  } catch (error: any) {
    console.error('Error in DELETE /api/outputs/[id]/share:', error)
    return NextResponse.json({ 
      error: 'Internal server error',
      message: error.message 
    }, { status: 500 })
  }
}
