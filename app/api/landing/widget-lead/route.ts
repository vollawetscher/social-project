import { NextRequest, NextResponse } from 'next/server'
import { createRouteHandlerClient, createServiceRoleClient } from '@/lib/supabase/server'

// POST /api/landing/widget-lead
//
// action: 'create'  — on first AI result; returns the new lead id
// action: 'update'  — on correction applied or CTA clicked; uses id + session_id to verify
//
// The client stores the lead id and session_id in sessionStorage so it can
// update the same row later in the same browsing session.

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}))
    const action = String(body?.action || 'create')
    const sessionId = String(body?.sessionId || '').trim()

    if (!sessionId) {
      return NextResponse.json({ error: 'sessionId required' }, { status: 400 })
    }

    const supabase = createServiceRoleClient()

    if (action === 'create') {
      const selfDescription = String(body?.selfDescription || '').trim()
      if (!selfDescription) {
        return NextResponse.json({ error: 'selfDescription required' }, { status: 400 })
      }

      const { data, error } = await supabase
        .from('widget_leads')
        .insert({
          session_id: sessionId,
          self_description: selfDescription.slice(0, 500),
          browser_locale: String(body?.browserLocale || '').trim().slice(0, 20) || null,
          correction: String(body?.correction || '').trim().slice(0, 500) || null,
          classification: body?.classification ?? null,
          not_relevant: body?.notRelevant === true,
          clicked_start_free: false,
        })
        .select('id')
        .single()

      if (error) {
        console.error('[widget-lead] insert error:', error.message)
        return NextResponse.json({ error: 'Failed to save lead' }, { status: 500 })
      }

      return NextResponse.json({ id: data.id })
    }

    if (action === 'update') {
      const leadId = String(body?.id || '').trim()
      if (!leadId) {
        return NextResponse.json({ error: 'id required for update' }, { status: 400 })
      }

      const patch: Record<string, unknown> = {}
      if (body?.correction !== undefined) {
        patch.correction = String(body.correction).trim().slice(0, 500) || null
      }
      if (body?.classification !== undefined) {
        patch.classification = body.classification
      }
      if (body?.clickedStartFree === true) {
        patch.clicked_start_free = true
      }

      if (Object.keys(patch).length === 0) {
        return NextResponse.json({ ok: true })
      }

      const { error } = await supabase
        .from('widget_leads')
        .update(patch)
        .eq('id', leadId)
        .eq('session_id', sessionId)   // session_id acts as write token

      if (error) {
        console.error('[widget-lead] update error:', error.message)
        return NextResponse.json({ error: 'Failed to update lead' }, { status: 500 })
      }

      return NextResponse.json({ ok: true })
    }

    if (action === 'link') {
      // Link all leads from this browser session to the newly signed-up user.
      // We verify identity via the auth session cookie — the userId in the body
      // is only used as a double-check; the authoritative value comes from the session.
      const authClient = createRouteHandlerClient(request)
      const { data: { user } } = await authClient.auth.getUser()

      if (!user) {
        return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 })
      }

      const supabase = createServiceRoleClient()
      const { error } = await supabase
        .from('widget_leads')
        .update({ linked_user_id: user.id })
        .eq('session_id', sessionId)
        .is('linked_user_id', null)  // never overwrite an existing link

      if (error) {
        console.error('[widget-lead] link error:', error.message)
        return NextResponse.json({ error: 'Failed to link lead' }, { status: 500 })
      }

      return NextResponse.json({ ok: true })
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
  } catch (err) {
    console.error('[widget-lead] unexpected error:', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
