import { NextResponse } from 'next/server'
import { requireAuth, requireSessionAccess, handleAuthError } from '@/lib/auth/helpers'
import { createClient } from '@/lib/supabase/server'

/**
 * POST /api/sessions/[id]/owner-context
 *
 * Persists the session owner's answer to an analyzer-emitted clarification
 * ("who are you in this conversation?"), clears pending_clarification, and
 * kicks off a re-analyze so suggestions reflect the now-known context.
 *
 * Body shape:
 *   { context: { role: string, speakerId?: string|null, goal?: string|null,
 *                counterpartyRole?: string|null } }
 * or
 *   { dismiss: true }  // user chose to proceed without clarifying; clear the
 *                      // pending prompt and do not ask again for this session.
 */
export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const user = await requireAuth(request)
    await requireSessionAccess(params.id, user.id)

    const body = await request.json().catch(() => ({}))
    const dismiss = Boolean((body as any)?.dismiss)
    const rawCtx = (body as any)?.context

    const supabase = await createClient()

    if (dismiss) {
      // Tombstone: store a "dismissed" marker so subsequent analyze runs do
      // not re-ask. The marker has no role/speakerId, so the generator will
      // treat outputs as neutral/observer by default.
      const tombstone = {
        source: 'dismissed' as const,
        updatedAt: new Date().toISOString(),
      }
      const { error } = await supabase
        .from('sessions')
        .update({
          owner_context: tombstone,
          pending_clarification: null,
        })
        .eq('id', params.id)
      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 })
      }
      return NextResponse.json({ success: true, ownerContext: tombstone, cleared: true })
    }

    if (!rawCtx || typeof rawCtx !== 'object') {
      return NextResponse.json({ error: 'context is required' }, { status: 400 })
    }

    const role = String(rawCtx.role || '').trim()
    if (!role) {
      return NextResponse.json({ error: 'context.role is required' }, { status: 400 })
    }

    const nextOwnerContext = {
      role,
      speakerId: rawCtx.speakerId ? String(rawCtx.speakerId) : null,
      goal: rawCtx.goal ? String(rawCtx.goal) : null,
      counterpartyRole: rawCtx.counterpartyRole ? String(rawCtx.counterpartyRole) : null,
      source: 'user' as const,
      updatedAt: new Date().toISOString(),
    }

    const { error: updateError } = await supabase
      .from('sessions')
      .update({
        owner_context: nextOwnerContext,
        pending_clarification: null,
      })
      .eq('id', params.id)

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 })
    }

    // Re-run analyze asynchronously so suggestions reflect the new context.
    // Forward caller auth so the re-run runs as the same user.
    const baseUrl = new URL(request.url).origin
    const headers: Record<string, string> = { 'Content-Type': 'application/json' }
    const auth = request.headers.get('Authorization')
    const cookie = request.headers.get('Cookie')
    if (auth) headers.Authorization = auth
    if (cookie) headers.Cookie = cookie

    fetch(`${baseUrl}/api/sessions/${params.id}/analyze`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ force: true }),
    }).catch((err) => {
      console.error('[OwnerContext] Re-analyze trigger failed:', err)
    })

    return NextResponse.json({
      success: true,
      ownerContext: nextOwnerContext,
      reanalyzeTriggered: true,
    })
  } catch (error: any) {
    const handled = handleAuthError(error)
    return NextResponse.json({ error: handled.message }, { status: handled.status })
  }
}
