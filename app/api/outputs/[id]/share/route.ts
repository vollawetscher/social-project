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
      console.error('[Share Enable] Output not found:', fetchError)
      return NextResponse.json({ error: 'Output not found' }, { status: 404 })
    }

    console.log('[Share Enable] Current output state:', {
      id: output.id,
      hasToken: !!output.share_token,
      isPublic: output.is_public
    })

    // Generate share token if needed
    let shareToken = output.share_token
    if (!shareToken) {
      shareToken = crypto.randomUUID()
      console.log('[Share Enable] Generated new token:', shareToken)
    } else {
      console.log('[Share Enable] Using existing token:', shareToken)
    }

    // Enable sharing with explicit token
    const updateData = {
      is_public: true,
      shared_at: new Date().toISOString(),
      share_token: shareToken,
    }
    
    console.log('[Share Enable] Updating with:', updateData)

    const { data: updated, error: updateError } = await supabase
      .from('outputs')
      .update(updateData)
      .eq('id', params.id)
      .eq('created_by', user.id)
      .select('id, share_token, is_public, shared_at')
      .single()

    if (updateError) {
      console.error('[Share Enable] Update error:', updateError)
      return NextResponse.json({ 
        error: 'Failed to enable sharing',
        details: updateError.message 
      }, { status: 500 })
    }

    console.log('[Share Enable] Update successful:', updated)

    const finalToken = updated.share_token
    
    // Generate share URL
    const origin = request.headers.get('origin') || 'https://notissima.up.railway.app'
    const shareUrl = `${origin}/share/${finalToken}`

    console.log('[Share Enable] Generated share URL:', shareUrl)

    return NextResponse.json({
      success: true,
      shareToken: finalToken,
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
