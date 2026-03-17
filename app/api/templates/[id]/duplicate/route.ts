import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient()
    
    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Fetch the original template
    const { data: originalTemplate, error: fetchError } = await supabase
      .from('templates')
      .select('*')
      .eq('id', params.id)
      .single()

    if (fetchError || !originalTemplate) {
      return NextResponse.json({ error: 'Template not found' }, { status: 404 })
    }

    // Create a duplicate with "Copy of" prefix
    const { data: duplicateTemplate, error: insertError } = await supabase
      .from('templates')
      .insert({
        name: `Copy of ${originalTemplate.name}`,
        description: originalTemplate.description,
        intended_perspectives: originalTemplate.intended_perspectives,
        allowed_audience: originalTemplate.allowed_audience,
        domain_tags: originalTemplate.domain_tags,
        sections: originalTemplate.sections,
        required_inputs: originalTemplate.required_inputs,
        style_rules: originalTemplate.style_rules,
        suggestion_triggers: originalTemplate.suggestion_triggers,
        instructions: originalTemplate.instructions,
        sample_content: originalTemplate.sample_content,
        default_do_instructions: originalTemplate.default_do_instructions || '',
        default_dont_instructions: originalTemplate.default_dont_instructions || '',
        output_format: originalTemplate.output_format || 'markdown',
        created_by: user.id,
        is_system: false, // User copies are never system templates
      })
      .select()
      .single()

    if (insertError) {
      console.error('Error duplicating template:', insertError)
      return NextResponse.json({ error: 'Failed to duplicate template' }, { status: 500 })
    }

    return NextResponse.json({ 
      id: duplicateTemplate.id,
      name: duplicateTemplate.name 
    }, { status: 201 })
  } catch (error) {
    console.error('Unexpected error duplicating template:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
