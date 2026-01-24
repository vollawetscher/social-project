import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { requireAuth, handleAuthError } from '@/lib/auth/helpers'

// DELETE /api/files/[id] - Delete a file and its associated data
export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const user = await requireAuth()
    const supabase = createClient()

    // Get the file and verify ownership through session
    const { data: file, error: fileError } = await supabase
      .from('files')
      .select(`
        id,
        storage_path,
        sessions!inner (
          id,
          user_id
        )
      `)
      .eq('id', params.id)
      .single()

    if (fileError || !file) {
      return NextResponse.json({ error: 'File not found' }, { status: 404 })
    }

    // Check ownership
    const session = (file as any).sessions
    if (session.user_id !== user.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    // Delete the file from storage
    const { error: storageError } = await supabase.storage
      .from('rohbericht-audio')
      .remove([file.storage_path])

    if (storageError) {
      console.error('Failed to delete file from storage:', storageError)
      // Continue anyway - the database record should be deleted
    }

    // Delete the file record (this will cascade delete transcripts and pii_hits)
    const { error: deleteError } = await supabase
      .from('files')
      .delete()
      .eq('id', params.id)

    if (deleteError) {
      return NextResponse.json({ error: deleteError.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    if (error instanceof Error) {
      const authError = handleAuthError(error)
      return NextResponse.json({ error: authError.message }, { status: authError.status })
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
