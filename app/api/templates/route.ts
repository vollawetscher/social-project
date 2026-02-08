import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import type { Template } from '@/lib/types-v0'

export async function GET() {
  try {
    const supabase = await createClient()
    
    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Fetch templates (system templates + user's own templates)
    const { data: templates, error } = await supabase
      .from('templates')
      .select('*')
      .or(`is_system.eq.true,created_by.eq.${user.id}`)
      .order('is_system', { ascending: false })
      .order('used_count', { ascending: false })

    if (error) {
      console.error('Error fetching templates:', error)
      return NextResponse.json({ error: 'Failed to fetch templates' }, { status: 500 })
    }

    // Transform to v0 format
    const formattedTemplates: Template[] = templates.map((t: any) => ({
      id: t.id,
      name: t.name,
      description: t.description,
      intendedPerspectives: t.intended_perspectives || [],
      allowedAudience: t.allowed_audience || [],
      domainTags: t.domain_tags || [],
      usedCount: t.used_count || 0,
      sections: t.sections || [],
      requiredInputs: t.required_inputs || [],
      styleRules: t.style_rules || [],
      suggestionTriggers: t.suggestion_triggers || [],
    }))

    return NextResponse.json(formattedTemplates)
  } catch (error) {
    console.error('Unexpected error in templates route:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    
    // Get current user
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
      instructions 
    } = body

    // Validate required fields
    if (!name || !description) {
      return NextResponse.json({ error: 'Name and description are required' }, { status: 400 })
    }

    // Insert template
    const { data: template, error } = await supabase
      .from('templates')
      .insert({
        name,
        description,
        intended_perspectives: intendedPerspectives || [],
        allowed_audience: allowedAudience || [],
        domain_tags: domainTags || [],
        sections: sections || [],
        required_inputs: requiredInputs || [],
        style_rules: styleRules || [],
        suggestion_triggers: suggestionTriggers || [],
        instructions: instructions || `Generate a ${name} following the defined structure and style.`,
        created_by: user.id,
        is_system: false,
      })
      .select()
      .single()

    if (error) {
      console.error('Error creating template:', error)
      return NextResponse.json({ error: 'Failed to create template' }, { status: 500 })
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
    }

    return NextResponse.json(formattedTemplate, { status: 201 })
  } catch (error) {
    console.error('Unexpected error creating template:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
