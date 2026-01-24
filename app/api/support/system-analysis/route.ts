import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireAuth, handleAuthError } from '@/lib/auth/helpers'
import { createAISupportService } from '@/lib/services/ai-support'

// GET /api/support/system-analysis - Get system-wide error analysis (admin only)
export async function GET(request: Request) {
  try {
    const user = await requireAuth()
    const supabase = createClient()

    // Check if user is admin
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (profile?.role !== 'admin') {
      return NextResponse.json(
        { error: 'Admin access required' },
        { status: 403 }
      )
    }

    // Parse query parameters
    const { searchParams } = new URL(request.url)
    const days = parseInt(searchParams.get('days') || '7')

    // Get system-wide analysis
    const aiSupport = createAISupportService(supabase)
    const analysis = await aiSupport.analyzeSystemErrors(days)

    return NextResponse.json({
      analysis,
      period: `Last ${days} days`,
    })
  } catch (error) {
    console.error('[System Analysis API] Failed to analyze system:', error)

    if (error instanceof Error) {
      const authError = handleAuthError(error)
      return NextResponse.json(
        { error: authError.message },
        { status: authError.status }
      )
    }

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
