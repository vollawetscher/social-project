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

  const { error: dlError } = await supabase.from('marketplace_downloads').insert({
    template_id: params.id,
    user_id: user.id,
  })

  if (dlError) {
    return NextResponse.json({ error: dlError.message }, { status: 500 })
  }

  const { error: cloneError } = await supabase.from('templates').insert({
    user_id: user.id,
    name: template.title,
    description: template.description,
    template_config: template.template_config,
    is_default: false,
  })

  if (cloneError) {
    return NextResponse.json({ error: cloneError.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
