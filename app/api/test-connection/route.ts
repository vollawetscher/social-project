import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET() {
  try {
    const supabase = createClient()

    const { data, error } = await supabase
      .from('sessions')
      .select('count')
      .limit(1)

    if (error) {
      return NextResponse.json({
        success: false,
        error: error.message,
        details: error
      }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      message: 'Supabase connection successful',
      url: process.env.NEXT_PUBLIC_SUPABASE_URL,
      hasKey: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    })
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: 'Connection test failed',
      details: String(error)
    }, { status: 500 })
  }
}
