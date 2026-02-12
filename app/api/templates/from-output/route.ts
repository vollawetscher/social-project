import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { extractSampleFromOutput } from '@/lib/utils/extract-sample'

export async function POST(request: Request) {
  try {
    const supabase = await createClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { outputId } = body
    if (!outputId) {
      return NextResponse.json({ error: 'outputId is required' }, { status: 400 })
    }

    const { data: output, error: outputError } = await supabase
      .from('outputs')
      .select('*')
      .eq('id', outputId)
      .eq('created_by', user.id)
      .single()

    if (outputError || !output) {
      return NextResponse.json({ error: 'Output not found' }, { status: 404 })
    }

    const sampleContent = extractSampleFromOutput(output.content)
    const description = output.content.slice(0, 200).trim()
    const templateName = output.template_name || 'Custom Output'
    const instructions = `Generate output matching the structure and style shown in the sample. Follow the same section headings and format. Use professional tone.`

    const { data: template, error: templateError } = await supabase
      .from('templates')
      .insert({
        name: templateName,
        description: description.length > 200 ? description.slice(0, 197) + '...' : description,
        intended_perspectives: [output.perspective || 'observer'],
        allowed_audience: [output.audience || 'internal'],
        domain_tags: ['general'],
        sections: [],
        required_inputs: [],
        style_rules: [`Tone: ${output.tone || 'neutral'}`, `Format: ${output.format || 'markdown'}`],
        instructions,
        sample_content: sampleContent || null,
        created_by: user.id,
        is_system: false,
      })
      .select('id, name')
      .single()

    if (templateError) {
      console.error('[Templates from-output] Failed to create template:', templateError)
      return NextResponse.json(
        { error: 'Failed to create template', details: templateError.message },
        { status: 500 }
      )
    }

    return NextResponse.json(
      { id: template.id, name: template.name },
      { status: 201 }
    )
  } catch (error) {
    console.error('[Templates from-output] Unexpected error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
