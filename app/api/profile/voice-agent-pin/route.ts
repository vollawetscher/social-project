import { NextResponse } from 'next/server'
import { createHash } from 'crypto'
import { createClient } from '@/lib/supabase/server'

/**
 * Manage the owner's inbound voice-agent PIN.
 *
 * The PIN gates the assistant's access to the owner's Notissima data when the
 * owner calls their own number (inbound). Only a hash is ever stored, and the
 * hash is never returned to the client.
 *
 * POST { pin }  -> set/replace the PIN (4-6 digits)
 * DELETE        -> remove the PIN
 */

// Must match the agent's verification (agent/config_loader.py: _hash_pin).
function hashPin(userId: string, pin: string): string {
  const pepper = process.env.VOICE_AGENT_PIN_PEPPER || ''
  return createHash('sha256').update(`${pepper}:${userId}:${pin}`).digest('hex')
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json().catch(() => ({}))
    const pin = String((body as any)?.pin ?? '').trim()
    if (!/^\d{4,6}$/.test(pin)) {
      return NextResponse.json({ error: 'PIN must be 4 to 6 digits' }, { status: 400 })
    }

    const { error } = await supabase
      .from('profiles')
      .update({ voice_agent_pin_hash: hashPin(user.id, pin) })
      .eq('id', user.id)

    if (error) {
      console.error('[VoiceAgentPin] Failed to set PIN:', error)
      return NextResponse.json({ error: 'Failed to set PIN' }, { status: 500 })
    }

    return NextResponse.json({ hasPin: true })
  } catch (error) {
    console.error('[VoiceAgentPin] POST error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE() {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { error } = await supabase
      .from('profiles')
      .update({ voice_agent_pin_hash: null })
      .eq('id', user.id)

    if (error) {
      console.error('[VoiceAgentPin] Failed to clear PIN:', error)
      return NextResponse.json({ error: 'Failed to clear PIN' }, { status: 500 })
    }

    return NextResponse.json({ hasPin: false })
  } catch (error) {
    console.error('[VoiceAgentPin] DELETE error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
