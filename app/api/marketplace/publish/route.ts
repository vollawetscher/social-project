import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json()
  const { title, description, instructions, template_config, category_id, tags, is_published } = body

  if (!title?.trim()) {
    return NextResponse.json({ error: 'Title is required' }, { status: 400 })
  }

  const { data, error } = await supabase.from('marketplace_templates').insert({
    author_id: user.id,
    title: title.trim(),
    description: (description || '').trim(),
    instructions: (instructions || '').trim(),
    template_config: template_config || {},
    category_id: category_id || null,
    tags: tags || [],
    is_published: is_published ?? false,
  }).select().single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data, { status: 201 })
}
