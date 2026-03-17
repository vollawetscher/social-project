import { createClient, createServiceRoleClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

// Legacy action-to-template-name mapping (for backward compat when template_id not set)
const LEGACY_ACTION_TO_TEMPLATE: Record<string, string> = {
  short_summary: 'Meeting Minutes',
  long_summary: 'Meeting Summary',
  full_report: 'Meeting Summary',
  action_items: 'Action Items & Next Steps',
}

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    console.log('[Auto-Generate API] Starting for session:', params.id)

    const internalSecret = request.headers.get('x-internal-secret')
    const internalUserId = request.headers.get('x-internal-user-id')
    const isInternalCall = !!process.env.INTERNAL_API_SECRET &&
      internalSecret === process.env.INTERNAL_API_SECRET &&
      internalUserId

    let supabase: Awaited<ReturnType<typeof createClient>>
    let userId: string

    if (isInternalCall) {
      supabase = createServiceRoleClient()
      userId = internalUserId
      console.log('[Auto-Generate API] Internal call mode, userId:', userId)
    } else {
      supabase = await createClient()
      const { data: { user }, error: authError } = await supabase.auth.getUser()
      if (authError || !user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }
      userId = user.id
    }

    const body = await request.json()
    const { templateId, action, language = 'de' } = body

    let template: { id: string; name: string; output_format?: string } | null = null

    if (templateId) {
      // Template-based: fetch by ID (user's or system)
      const { data, error } = await supabase
        .from('templates')
        .select('id, name, output_format')
        .eq('id', templateId)
        .or(`is_system.eq.true,created_by.eq.${userId}`)
        .single()

      if (error || !data) {
        console.log('[Auto-Generate API] Template not found:', templateId)
        return NextResponse.json({ error: 'Template not found' }, { status: 404 })
      }
      template = data
    } else if (action && LEGACY_ACTION_TO_TEMPLATE[action]) {
      // Legacy: look up by name
      const templateName = LEGACY_ACTION_TO_TEMPLATE[action]
      const { data } = await supabase
        .from('templates')
        .select('id, name')
        .eq('name', templateName)
        .eq('is_system', true)
        .single()
      template = data
    }

    if (!template) {
      console.log('[Auto-Generate API] No template (templateId or valid action required)')
      return NextResponse.json({ error: 'No template selected for auto-generation' }, { status: 400 })
    }

    const resolveOutputLanguageCode = (requested: string, sessionLanguage?: string | null): string => {
      const req = (requested || '').toLowerCase()
      if (req && req !== 'session' && req !== 'auto') return req.slice(0, 2)
      const detected = (sessionLanguage || '').toLowerCase()
      if (detected && detected !== 'auto') return detected.slice(0, 2)
      return 'de'
    }

    // Session language fallback when request uses "session" option
    const { data: sessionForLanguage } = await supabase
      .from('sessions')
      .select('language')
      .eq('id', params.id)
      .maybeSingle()

    // Call the outputs/generate API with proper config
    const baseUrl = new URL(request.url).origin
    const languageCode = resolveOutputLanguageCode(
      typeof language === 'string' ? language : 'de',
      (sessionForLanguage as any)?.language
    )
    
    const genHeaders: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(request.headers.get('Authorization') && { Authorization: request.headers.get('Authorization')! }),
      ...(request.headers.get('Cookie') && { Cookie: request.headers.get('Cookie')! }),
    }
    if (isInternalCall && process.env.INTERNAL_API_SECRET) {
      genHeaders['x-internal-secret'] = process.env.INTERNAL_API_SECRET
      genHeaders['x-internal-user-id'] = userId
    }
    const generateResponse = await fetch(`${baseUrl}/api/outputs/generate`, {
      method: 'POST',
      headers: genHeaders,
      body: JSON.stringify({
        sessionId: params.id,
        config: {
          templateId: template.id,
          templateName: template.name,
          perspective: 'observer',
          audience: 'internal',
          language: languageCode,
          tone: 'neutral',
          format: template.output_format === 'email_text' ? 'email' : 'markdown',
          doInstructions: '',
          dontInstructions: '',
          createTemplateFromConfig: false,
          citeTimestamps: false,
        },
      }),
    })

    const result = await generateResponse.json()

    if (!generateResponse.ok) {
      console.error('[Auto-Generate API] Generate failed:', result)
      return NextResponse.json(
        { error: result.error || 'Failed to generate output' },
        { status: generateResponse.status }
      )
    }

    console.log('[Auto-Generate API] Output generated successfully:', result.id)
    return NextResponse.json({
      success: true,
      outputId: result.id,
      templateName: result.templateName || template.name,
    })
  } catch (error: any) {
    console.error('[Auto-Generate API] Error:', error)
    return NextResponse.json({
      error: 'Failed to auto-generate output',
      message: error?.message,
    }, { status: 500 })
  }
}
