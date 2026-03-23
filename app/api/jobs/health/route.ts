import { NextResponse } from 'next/server'
import { createClient, createServiceRoleClient } from '@/lib/supabase/server'
import { getQueueHealthSummary } from '@/lib/services/queue-health'

export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (profile?.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const serviceRole = createServiceRoleClient()
    const summary = await getQueueHealthSummary(serviceRole)
    return NextResponse.json(summary)
  } catch (error) {
    console.error('[Jobs Health API] Error:', error)
    return NextResponse.json({ error: 'Failed to read queue health' }, { status: 500 })
  }
}

