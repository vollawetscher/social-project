import { createClient, createServiceRoleClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { sendCreatorLeadEmail } from '@/lib/services/communication-hub-email'

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: template, error: tplError } = await supabase
    .from('marketplace_templates')
    .select('*')
    .eq('id', params.id)
    .eq('is_published', true)
    .maybeSingle()

  if (tplError || !template) {
    return NextResponse.json({ error: 'Template not found' }, { status: 404 })
  }

  let creatorEmail: string | null = null
  if (template.lead_capture_enabled && template.author_id) {
    const adminClient = createServiceRoleClient()
    const { data: authorProfile } = await adminClient
      .from('profiles')
      .select('email')
      .eq('id', template.author_id)
      .maybeSingle()
    creatorEmail = authorProfile?.email || null
  }

  let consent = false
  try {
    const body = await request.json().catch(() => ({}))
    consent = body?.consent === true
  } catch {
    // no body is fine for open templates
  }

  if (template.lead_capture_enabled && !consent) {
    return NextResponse.json(
      { error: 'Consent required for this template', consent_required: true },
      { status: 400 }
    )
  }

  const { data: existingClone } = await supabase
    .from('templates')
    .select('id')
    .eq('marketplace_source_id', params.id)
    .eq('created_by', user.id)
    .maybeSingle()

  if (existingClone) {
    return NextResponse.json(
      { error: 'Template already installed', already_installed: true },
      { status: 409 }
    )
  }

  const { error: downloadError } = await supabase
    .from('marketplace_downloads')
    .upsert(
      { template_id: params.id, user_id: user.id },
      { onConflict: 'template_id,user_id' }
    )

  if (downloadError) {
    console.error('Error recording download:', downloadError)
    return NextResponse.json({ error: 'Failed to record download' }, { status: 500 })
  }

  const cfg = template.template_config || {}

  const styleRules: string[] = []
  if (cfg.do_include) {
    styleRules.push(...cfg.do_include.split('\n').filter(Boolean).map((s: string) => `DO: ${s.trim()}`))
  }
  if (cfg.do_not_include) {
    styleRules.push(...cfg.do_not_include.split('\n').filter(Boolean).map((s: string) => `DON'T: ${s.trim()}`))
  }

  const { data: cloned, error: cloneError } = await supabase.from('templates').insert({
    name: template.title,
    description: template.description || '',
    instructions: cfg.generation_prompt || template.instructions || '',
    intended_perspectives: cfg.perspectives || [],
    allowed_audience: cfg.audiences || [],
    domain_tags: cfg.domains || [],
    sections: [],
    required_inputs: [],
    style_rules: styleRules,
    suggestion_triggers: template.tags || [],
    default_do_instructions: cfg.do_include || '',
    default_dont_instructions: cfg.do_not_include || '',
    output_format: cfg.output_format === 'email' ? 'email_text' : (cfg.output_format === 'json' ? 'json' : 'markdown'),
    created_by: user.id,
    is_system: false,
    marketplace_source_id: params.id,
  }).select('id, name').single()

  if (cloneError) {
    console.error('Error cloning template:', cloneError)
    return NextResponse.json({ error: cloneError.message }, { status: 500 })
  }

  if (template.lead_capture_enabled && consent) {
    if (creatorEmail) {
      sendCreatorLeadEmail({
        creatorEmail,
        userEmail: user.email!,
        templateName: template.title,
        installedAt: new Date().toLocaleString('de-DE', { timeZone: 'Europe/Berlin' }),
      }).catch((err) => {
        console.error('Failed to send creator lead email:', err)
      })
    }
  }

  return NextResponse.json({ success: true, template_id: cloned.id, name: cloned.name })
}
