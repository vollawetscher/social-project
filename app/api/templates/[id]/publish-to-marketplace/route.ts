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

  const { data: existing } = await supabase
    .from('marketplace_templates')
    .select('id')
    .eq('source_template_id', params.id)
    .eq('author_id', user.id)
    .maybeSingle()

  if (existing) {
    return NextResponse.json(
      { error: 'Already published', marketplace_id: existing.id },
      { status: 409 }
    )
  }

  const body = await request.json()
  const { category_id, tags, description_override } = body

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
    languages: ['en', 'de'] as string[],
    domains: template.domain_tags || [],
    generation_prompt: generationPrompt,
    do_include: template.default_do_instructions || '',
    do_not_include: template.default_dont_instructions || '',
  }

  const { data: marketplaceTemplate, error: insertError } = await supabase
    .from('marketplace_templates')
    .insert({
      author_id: user.id,
      title: template.name,
      description: description_override || template.description || '',
      instructions: generationPrompt,
      template_config: templateConfig,
      category_id: category_id || null,
      tags: tags || template.domain_tags || [],
      is_published: true,
      source_template_id: params.id,
    })
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
