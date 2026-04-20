import { createClient, createServiceRoleClient } from '@/lib/supabase/server'
import type { User } from '@supabase/supabase-js'

export async function requireAuth(request?: Request): Promise<User> {
  // Fallback path for clients where cookie auth is temporarily out of sync:
  // accept explicit bearer token and verify it server-side.
  const authHeader = request?.headers.get('authorization') || ''
  const bearerMatch = authHeader.match(/^Bearer\s+(.+)$/i)
  const bearerToken = bearerMatch?.[1]?.trim()
  if (bearerToken) {
    const serviceClient = createServiceRoleClient()
    const { data: bearerData, error: bearerError } = await serviceClient.auth.getUser(bearerToken)
    if (!bearerError && bearerData?.user) {
      return bearerData.user
    }
  }

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

/**
 * Grants access to a session for:
 *   - the session owner (sessions.user_id === userId)
 *   - any user in session_collaborators for this session
 *   - admins (profiles.role === 'admin')
 *
 * Throws 'Session not found' or 'Forbidden' — `handleAuthError` maps both.
 */
export async function requireSessionAccess(sessionId: string, userId: string): Promise<void> {
  const supabase = await createClient()

  const { data: session, error: fetchError } = await supabase
    .from('sessions')
    .select('user_id')
    .eq('id', sessionId)
    .maybeSingle()

  if (fetchError) {
    throw new Error('Session not found')
  }

  if (session) {
    if (session.user_id === userId) return
    // If RLS returned the row for a non-owner it must be because the caller is
    // a collaborator (the "Collaborators can read shared sessions" policy).
    return
  }

  // RLS hid the row from the caller. Two paths can still grant access:
  //   1. The user is a collaborator but the collaborator SELECT policy hasn't
  //      propagated (defensive service-role check).
  //   2. The user is an admin.
  const serviceClient = createServiceRoleClient()

  const { data: collaboratorRow } = await serviceClient
    .from('session_collaborators')
    .select('session_id')
    .eq('session_id', sessionId)
    .eq('user_id', userId)
    .maybeSingle()

  if (collaboratorRow) {
    const { data: adminSession } = await serviceClient
      .from('sessions')
      .select('id')
      .eq('id', sessionId)
      .maybeSingle()
    if (adminSession) return
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', userId)
    .single()

  if (profile?.role === 'admin') {
    const { data: adminSession } = await serviceClient
      .from('sessions')
      .select('id')
      .eq('id', sessionId)
      .maybeSingle()
    if (adminSession) return
    throw new Error('Session not found')
  }

  throw new Error('Session not found')
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
