import { NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { getQueueHealthSummary } from '@/lib/services/queue-health'

export async function GET(request: Request) {
  const internalSecret = request.headers.get('x-internal-secret')
  if (!process.env.INTERNAL_API_SECRET || internalSecret !== process.env.INTERNAL_API_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const supabase = createServiceRoleClient()
    const summary = await getQueueHealthSummary(supabase)
    return NextResponse.json(summary)
  } catch (error) {
    console.error('[Internal Jobs Health] Error:', error)
    return NextResponse.json({ error: 'Failed to read queue health' }, { status: 500 })
  }
}

