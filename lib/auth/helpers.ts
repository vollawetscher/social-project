import { createClient } from '@/lib/supabase/server'
import type { User } from '@supabase/supabase-js'

export async function requireAuth(): Promise<User> {
  const supabase = await createClient()
  const { data: { user }, error } = await supabase.auth.getUser()

  if (error || !user) {
    throw new Error('Unauthorized')
  }

  return user
}

export async function requireSessionOwnership(sessionId: string, userId: string): Promise<void> {
  const supabase = await createClient()

  const { data: session, error } = await supabase
    .from('sessions')
    .select('user_id')
    .eq('id', sessionId)
    .maybeSingle()

  if (error || !session) {
    throw new Error('Session not found')
  }

  if (session.user_id !== userId) {
    throw new Error('Forbidden')
  }
}

/** Same as requireSessionOwnership but allows admins to access any session. */
export async function requireSessionAccess(sessionId: string, userId: string): Promise<void> {
  const supabase = await createClient()

  const { data: session, error } = await supabase
    .from('sessions')
    .select('user_id')
    .eq('id', sessionId)
    .maybeSingle()

  if (error || !session) {
    throw new Error('Session not found')
  }

  if (session.user_id === userId) return

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', userId)
    .single()

  if (profile?.role === 'admin') return

  throw new Error('Forbidden')
}

export function handleAuthError(error: Error): { status: number; message: string } {
  if (error.message === 'Unauthorized') {
    return { status: 401, message: 'Authentication required' }
  }
  if (error.message === 'Forbidden') {
    return { status: 403, message: 'Access denied' }
  }
  if (error.message === 'Session not found') {
    return { status: 404, message: 'Session not found' }
  }
  return { status: 500, message: 'Internal server error' }
}
