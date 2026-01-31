import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

/**
 * Generate a temporary JWT token for Speechmatics real-time API
 * This keeps the API key secure on the server
 */
export async function POST() {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const apiKey = process.env.SPEECHMATICS_API_KEY
    if (!apiKey) {
      console.error('[Speechmatics Token] API key not configured')
      return NextResponse.json(
        { error: 'Speechmatics not configured' },
        { status: 500 }
      )
    }

    // Generate a temporary JWT token for the client
    // The token URL is for real-time authentication
    const response = await fetch('https://mp.speechmatics.com/v1/api_keys?type=rt', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        ttl: 3600, // Token valid for 1 hour
      }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('[Speechmatics Token] API error:', response.status, errorText)
      return NextResponse.json(
        { error: 'Failed to generate token' },
        { status: 500 }
      )
    }

    const data = await response.json()
    
    return NextResponse.json({ 
      token: data.key_value,
    })
  } catch (error: any) {
    console.error('[Speechmatics Token] Error:', error)
    return NextResponse.json(
      { error: 'Failed to generate token' },
      { status: 500 }
    )
  }
}
