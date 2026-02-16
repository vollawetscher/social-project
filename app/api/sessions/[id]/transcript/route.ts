import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { requireAuth, requireSessionAccess, handleAuthError } from '@/lib/auth/helpers'
import { mergeTranscripts } from '@/lib/utils/merge-transcripts'

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const user = await requireAuth()
    await requireSessionAccess(params.id, user.id)
    const supabase = await createClient()

    const { data: transcripts, error } = await supabase
      .from('transcripts')
      .select('*')
      .eq('session_id', params.id)
      .order('created_at', { ascending: true })

    if (error || !transcripts?.length) {
      return NextResponse.json({ error: 'Transcript not found' }, { status: 404 })
    }

    const merged = mergeTranscripts(transcripts)
    return NextResponse.json(merged)
  } catch (error) {
    if (error instanceof Error) {
      const authError = handleAuthError(error)
      return NextResponse.json({ error: authError.message }, { status: authError.status })
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
