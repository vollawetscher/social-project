import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

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
    .from('templates')
    .select('*')
    .eq('id', params.id)
    .eq('created_by', user.id)
    .maybeSingle()

  if (tplError || !template) {
    return NextResponse.json({ error: 'Template not found or not owned by you' }, { status: 404 })
  }

  if (template.marketplace_source_id) {
    return NextResponse.json(
      { error: 'Installed marketplace templates cannot be republished. Please create an original template.' },
      { status: 403 }
    )
  }

  const { data: existing } = await supabase
    .from('marketplace_templates')
    .select('id')
    .eq('source_template_id', params.id)
    .eq('author_id', user.id)
    .maybeSingle()

  if (existing) {
    return NextResponse.json(
      { error: 'Template is already published. Delete the existing listing first to re-publish.' },
      { status: 409 }
    )
  }

  const body = await request.json()
  const { category_id, tags, description_override, language, lead_capture_enabled } = body

  const finalDescription = description_override || template.description || ''

  const sectionNames = (template.sections || [])
    .map((s: any) => s.name)
    .filter(Boolean)
  const generationPrompt = template.instructions
    || (sectionNames.length > 0
      ? `Generate a structured ${template.name} covering: ${sectionNames.join(', ')}.`
      : `Generate a ${template.name} following the defined structure and style.`)

  const templateConfig = {
    perspectives: template.intended_perspectives || [],
    audiences: template.allowed_audience || [],
    tone: 'neutral' as const,
    output_format: 'markdown' as const,
    languages: language ? [language] : ['en'],
    domains: template.domain_tags || [],
    generation_prompt: generationPrompt,
    do_include: template.default_do_instructions || '',
    do_not_include: template.default_dont_instructions || '',
  }

  const payload = {
    author_id: user.id,
    title: template.name,
    description: finalDescription,
    instructions: generationPrompt,
    template_config: templateConfig,
    category_id: category_id || null,
    tags: tags || template.domain_tags || [],
    is_published: true,
    source_template_id: params.id,
    language: language || null,
    lead_capture_enabled: lead_capture_enabled === true,
  }

  const { data: marketplaceTemplate, error: insertError } = await supabase
    .from('marketplace_templates')
    .insert(payload)
    .select('id, title')
    .single()

  if (insertError) {
    console.error('Error publishing to marketplace:', insertError)
    return NextResponse.json({ error: insertError.message }, { status: 500 })
  }

  return NextResponse.json({
    success: true,
    marketplace_id: marketplaceTemplate.id,
    title: marketplaceTemplate.title,
  }, { status: 201 })
}
