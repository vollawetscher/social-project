import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth/helpers'
import { logError } from '@/lib/services/error-logger'

export async function POST(request: Request) {
  try {
    const user = await requireAuth()
    const supabase = createClient()

    const body = await request.json()
    const { title, description } = body

    if (!title || !description) {
      return NextResponse.json(
        { error: 'Title and description are required' },
        { status: 400 }
      )
    }

    // Store feature request in database
    // You can create a feature_requests table or use error_logs with a specific type
    const { error: insertError } = await supabase
      .from('error_logs')
      .insert({
        user_id: user.id,
        error_type: 'feature_request',
        severity: 'info',
        message: title,
        metadata: {
          description,
          submitted_at: new Date().toISOString(),
          user_email: user.email,
        },
      })

    if (insertError) {
      console.error('Failed to save feature request:', insertError)
      throw new Error('Failed to save feature request')
    }

    return NextResponse.json({
      success: true,
      message: 'Feature request submitted successfully',
    })
  } catch (error) {
    console.error('Feature request error:', error)

    // Log the error
    try {
      const user = await requireAuth().catch(() => null)
      if (user) {
        await logError({
          errorType: 'server_error',
          severity: 'error',
          message: 'Failed to submit feature request',
          error: error instanceof Error ? error : new Error(String(error)),
          userId: user.id,
          endpoint: '/api/support/feature-request',
          method: 'POST',
        })
      }
    } catch (logErr) {
      console.error('Failed to log feature request error:', logErr)
    }

    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    return NextResponse.json(
      { error: 'Failed to submit feature request' },
      { status: 500 }
    )
  }
}
