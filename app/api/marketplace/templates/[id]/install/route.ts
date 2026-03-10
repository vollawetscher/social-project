import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(
  _request: NextRequest,
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

  await supabase.from('marketplace_downloads').insert({
    template_id: params.id,
    user_id: user.id,
  })

  const cfg = template.template_config || {}

  const sectionFromPrompt = cfg.generation_prompt
    ? [{
        id: 'generated-output',
        name: 'Generated Output',
        description: cfg.generation_prompt,
        isRequired: true,
      }]
    : []

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
    intended_perspectives: cfg.perspectives || [],
    allowed_audience: cfg.audiences || [],
    domain_tags: cfg.domains || [],
    sections: sectionFromPrompt,
    required_inputs: [],
    style_rules: styleRules,
    suggestion_triggers: template.tags || [],
    default_do_instructions: cfg.do_include || '',
    default_dont_instructions: cfg.do_not_include || '',
    created_by: user.id,
    is_system: false,
    marketplace_source_id: params.id,
  }).select('id, name').single()

  if (cloneError) {
    console.error('Error cloning template:', cloneError)
    return NextResponse.json({ error: cloneError.message }, { status: 500 })
  }

  return NextResponse.json({ success: true, template_id: cloned.id, name: cloned.name })
}
