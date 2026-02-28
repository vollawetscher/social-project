import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

function normalizePhone(raw: string): string | null {
  let cleaned = raw.replace(/[\s\-().]/g, '')
  if (cleaned.startsWith('00')) cleaned = `+${cleaned.slice(2)}`
  if (/^\d{7,15}$/.test(cleaned)) cleaned = `+${cleaned}`
  return /^\+[1-9]\d{6,14}$/.test(cleaned) ? cleaned : null
}

export async function GET() {
  try {
    const supabase = await createClient()
    
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: profile, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single()

    if (error) {
      console.error('Error fetching profile:', error)
      return NextResponse.json({ error: 'Failed to fetch profile' }, { status: 500 })
    }

    return NextResponse.json(profile)
  } catch (error) {
    console.error('Error in GET /api/profile:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PATCH(request: Request) {
  try {
    const supabase = await createClient()
    
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const updates = await request.json()
    
    // Whitelist allowed fields to prevent unauthorized updates
    const allowedFields = [
      'default_recording_language',
      'preferred_report_language',
      'preferred_locale',
      'timezone',
      'after_transcript_action',
      'after_transcript_template_id',
      'auto_generate_reports',
      'phone_number',
    ]
    
    const filteredUpdates = Object.keys(updates)
      .filter(key => allowedFields.includes(key))
      .reduce((obj: any, key) => {
        obj[key] = updates[key]
        return obj
      }, {})

    if ('phone_number' in filteredUpdates) {
      const rawPhone = filteredUpdates.phone_number
      if (rawPhone === null || rawPhone === undefined || String(rawPhone).trim() === '') {
        filteredUpdates.phone_number = null
      } else {
        const normalized = normalizePhone(String(rawPhone))
        if (!normalized) {
          return NextResponse.json(
            { error: 'Invalid phone number. Use international format, e.g. +491701234567' },
            { status: 400 }
          )
        }
        filteredUpdates.phone_number = normalized
      }
    }

    if (Object.keys(filteredUpdates).length === 0) {
      return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 })
    }

    const { data: profile, error } = await supabase
      .from('profiles')
      .update(filteredUpdates)
      .eq('id', user.id)
      .select()
      .single()

    if (error) {
      console.error('Error updating profile:', error)
      console.error('Error details:', JSON.stringify(error, null, 2))
      if (error.code === '23505' && (error.message || '').includes('phone_number')) {
        return NextResponse.json(
          { error: 'This phone number is already used by another account' },
          { status: 409 }
        )
      }
      return NextResponse.json({ 
        error: 'Failed to update profile', 
        details: error.message,
        hint: error.hint 
      }, { status: 500 })
    }

    return NextResponse.json(profile)
  } catch (error) {
    console.error('Error in PATCH /api/profile:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
