import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import type { Template } from '@/lib/types-v0'

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient()
    
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: template, error } = await supabase
      .from('templates')
      .select('*')
      .eq('id', params.id)
      .or(`is_system.eq.true,created_by.eq.${user.id}`)
      .single()

    if (error || !template) {
      return NextResponse.json({ error: 'Template not found' }, { status: 404 })
    }

    // Transform to v0 format
    const formattedTemplate: Template = {
      id: template.id,
      name: template.name,
      description: template.description,
      intendedPerspectives: template.intended_perspectives || [],
      allowedAudience: template.allowed_audience || [],
      domainTags: template.domain_tags || [],
      usedCount: template.used_count || 0,
      sections: template.sections || [],
      requiredInputs: template.required_inputs || [],
      styleRules: template.style_rules || [],
      suggestionTriggers: template.suggestion_triggers || [],
      sampleContent: template.sample_content || null,
      defaultDoInstructions: template.default_do_instructions || '',
      defaultDontInstructions: template.default_dont_instructions || '',
    }

    return NextResponse.json(formattedTemplate)
  } catch (error) {
    console.error('Error fetching template:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PUT(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient()
    
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { 
      name, 
      description, 
      intendedPerspectives, 
      allowedAudience, 
      domainTags, 
      sections, 
      requiredInputs, 
      styleRules, 
      suggestionTriggers,
      defaultDoInstructions,
      defaultDontInstructions,
    } = body

    // Update template (only if user owns it)
    const { data: template, error } = await supabase
      .from('templates')
      .update({
        name,
        description,
        intended_perspectives: intendedPerspectives,
        allowed_audience: allowedAudience,
        domain_tags: domainTags,
        sections,
        required_inputs: requiredInputs,
        style_rules: styleRules,
        suggestion_triggers: suggestionTriggers,
        default_do_instructions: defaultDoInstructions ?? '',
        default_dont_instructions: defaultDontInstructions ?? '',
      })
      .eq('id', params.id)
      .eq('created_by', user.id)
      .select()
      .single()

    if (error || !template) {
      return NextResponse.json({ error: 'Template not found or unauthorized' }, { status: 404 })
    }

    // Transform to v0 format
    const formattedTemplate: Template = {
      id: template.id,
      name: template.name,
      description: template.description,
      intendedPerspectives: template.intended_perspectives || [],
      allowedAudience: template.allowed_audience || [],
      domainTags: template.domain_tags || [],
      usedCount: template.used_count || 0,
      sections: template.sections || [],
      requiredInputs: template.required_inputs || [],
      styleRules: template.style_rules || [],
      suggestionTriggers: template.suggestion_triggers || [],
      sampleContent: template.sample_content || null,
      defaultDoInstructions: template.default_do_instructions || '',
      defaultDontInstructions: template.default_dont_instructions || '',
    }

    return NextResponse.json(formattedTemplate)
  } catch (error) {
    console.error('Error updating template:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient()
    
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Delete template (only if user owns it)
    const { error } = await supabase
      .from('templates')
      .delete()
      .eq('id', params.id)
      .eq('created_by', user.id)

    if (error) {
      return NextResponse.json({ error: 'Template not found or unauthorized' }, { status: 404 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting template:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
