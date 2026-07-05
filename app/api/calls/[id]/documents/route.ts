import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { requireAuth, handleAuthError } from '@/lib/auth/helpers'
import { createClient, createServiceRoleClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'

const MAX_FILE_BYTES = 20 * 1024 * 1024 // 20 MB
const MAX_EXTRACTED_CHARS = 40000
const SUMMARY_THRESHOLD_CHARS = 6000

async function extractText(buffer: Buffer, mimeType: string, filename: string): Promise<string> {
  const isPdf = mimeType === 'application/pdf' || filename.toLowerCase().endsWith('.pdf')
  if (isPdf) {
    // Import the lib entry directly: the package index runs a debug block that
    // reads a bundled test PDF and can throw when bundled by Next.
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const pdfParse = require('pdf-parse/lib/pdf-parse.js')
    const parsed = await pdfParse(buffer)
    return String(parsed?.text || '')
  }
  // Plain text / markdown / anything text-like
  return buffer.toString('utf-8')
}

async function summarizeIfLong(text: string): Promise<string | null> {
  if (text.length <= SUMMARY_THRESHOLD_CHARS) return null
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) return null
  try {
    const client = new Anthropic({ apiKey })
    const message = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 700,
      messages: [
        {
          role: 'user',
          content:
            'Fasse das folgende Dokument präzise auf Deutsch zusammen, damit ein Sprachassistent es im Gespräch besprechen kann. ' +
            'Nenne die wichtigsten Punkte, Zahlen und offenen Fragen. Maximal 200 Wörter.\n\n' +
            text.slice(0, MAX_EXTRACTED_CHARS),
        },
      ],
    })
    const part = message.content.find((c) => c.type === 'text') as { text?: string } | undefined
    return part?.text?.trim() || null
  } catch (err) {
    console.error('[Call Documents] Summary failed:', err)
    return null
  }
}

/**
 * POST /api/calls/[id]/documents
 * Upload a document for the call; extract text and (for long docs) a summary so
 * the voice assistant can reference and discuss it.
 */
export async function POST(request: Request, { params }: { params: { id: string } }) {
  try {
    const user = await requireAuth()
    const supabase = await createClient()

    const { data: call } = await supabase
      .from('calls')
      .select('id, user_id')
      .eq('id', params.id)
      .eq('user_id', user.id)
      .maybeSingle()

    if (!call) {
      return NextResponse.json({ error: 'Call not found' }, { status: 404 })
    }

    // Ownership is verified above via the user-scoped client. Use the service
    // role for storage + DB writes so uploads don't fail on storage-bucket RLS
    // path restrictions, and so the final status update isn't blocked (the
    // call_documents table has no UPDATE policy for authenticated users).
    const db = createServiceRoleClient()

    const formData = await request.formData()
    const file = formData.get('file')
    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }
    if (file.size > MAX_FILE_BYTES) {
      return NextResponse.json({ error: 'File too large (max 20 MB)' }, { status: 400 })
    }

    const mimeType = file.type || 'application/octet-stream'
    const isSupported =
      mimeType === 'application/pdf' ||
      mimeType.startsWith('text/') ||
      /\.(pdf|txt|md)$/i.test(file.name)
    if (!isSupported) {
      return NextResponse.json({ error: 'Unsupported file type (PDF or text only)' }, { status: 400 })
    }

    const buffer = Buffer.from(await file.arrayBuffer())
    const ext = (file.name.split('.').pop() || 'bin').toLowerCase()
    const storagePath = `documents/${user.id}/${Date.now()}-${crypto.randomUUID()}.${ext}`

    const { error: uploadError } = await db.storage
      .from('rohbericht-audio')
      .upload(storagePath, buffer, { contentType: mimeType, upsert: false })
    if (uploadError) {
      console.error('[Call Documents] Storage upload failed:', uploadError)
      return NextResponse.json({ error: `Upload failed: ${uploadError.message}` }, { status: 500 })
    }

    const { data: inserted, error: insertError } = await db
      .from('call_documents')
      .insert({
        call_id: call.id,
        user_id: user.id,
        filename: file.name,
        storage_path: storagePath,
        mime_type: mimeType,
        status: 'processing',
      })
      .select('id')
      .single()

    if (insertError || !inserted) {
      console.error('[Call Documents] DB insert failed:', insertError)
      return NextResponse.json(
        { error: `Failed to save document record${insertError?.message ? `: ${insertError.message}` : ''}` },
        { status: 500 },
      )
    }

    let extracted = ''
    try {
      extracted = (await extractText(buffer, mimeType, file.name)).trim().slice(0, MAX_EXTRACTED_CHARS)
    } catch (err) {
      console.error('[Call Documents] Extraction failed:', err)
      await db
        .from('call_documents')
        .update({ status: 'error' })
        .eq('id', inserted.id)
      return NextResponse.json({ error: 'Could not read the document' }, { status: 422 })
    }

    const summary = await summarizeIfLong(extracted)

    const { error: updateError } = await db
      .from('call_documents')
      .update({ extracted_text: extracted, summary, status: 'ready' })
      .eq('id', inserted.id)
    if (updateError) {
      console.error('[Call Documents] Status update failed:', updateError)
      return NextResponse.json(
        { error: `Failed to finalize document: ${updateError.message}` },
        { status: 500 },
      )
    }

    return NextResponse.json({
      id: inserted.id,
      filename: file.name,
      status: 'ready',
      hasSummary: Boolean(summary),
    })
  } catch (error) {
    if (error instanceof Error) {
      const authError = handleAuthError(error)
      if (authError.status === 401) {
        return NextResponse.json({ error: authError.message }, { status: 401 })
      }
    }
    console.error('[Call Documents] Error:', error)
    return NextResponse.json({ error: 'Failed to attach document' }, { status: 500 })
  }
}

/**
 * GET /api/calls/[id]/documents — list attached documents for the call.
 */
export async function GET(_request: Request, { params }: { params: { id: string } }) {
  try {
    const user = await requireAuth()
    const supabase = await createClient()

    const { data, error } = await supabase
      .from('call_documents')
      .select('id, filename, status, created_at')
      .eq('call_id', params.id)
      .eq('user_id', user.id)
      .order('created_at', { ascending: true })

    if (error) throw error
    return NextResponse.json({ documents: data || [] })
  } catch (error) {
    if (error instanceof Error) {
      const authError = handleAuthError(error)
      if (authError.status === 401) {
        return NextResponse.json({ error: authError.message }, { status: 401 })
      }
    }
    return NextResponse.json({ error: 'Failed to load documents' }, { status: 500 })
  }
}
