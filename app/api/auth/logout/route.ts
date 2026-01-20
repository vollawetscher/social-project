import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST() {
  try {
    const supabase = createClient()
    await supabase.auth.signOut()
    return NextResponse.json({ success: true })
  } catch (error) {
    // Return 200 to avoid leaking details; client will navigate away regardless
    return NextResponse.json({ success: false }, { status: 200 })
  }
}

