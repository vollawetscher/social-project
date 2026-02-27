'use client'

import * as tus from 'tus-js-client'
import { SupabaseClient } from '@supabase/supabase-js'

const RESUMABLE_THRESHOLD = 40 * 1024 * 1024 // 40 MB
const CHUNK_SIZE = 5 * 1024 * 1024 // 5 MB

interface UploadOptions {
  contentType: string
  onProgress?: (fraction: number) => void
}

/**
 * Upload a file to Supabase Storage, automatically using TUS resumable
 * uploads for files above 40 MB for improved reliability on large files.
 */
export async function uploadToStorage(
  supabase: SupabaseClient,
  bucket: string,
  path: string,
  file: File,
  opts: UploadOptions
): Promise<void> {
  if (file.size < RESUMABLE_THRESHOLD) {
    const { error } = await supabase.storage
      .from(bucket)
      .upload(path, file, {
        contentType: opts.contentType,
        upsert: false,
      })
    if (error) throw error
    return
  }

  const {
    data: { session },
  } = await supabase.auth.getSession()
  if (!session) throw new Error('Not authenticated')

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  if (!supabaseUrl) throw new Error('Supabase URL not configured')

  return new Promise<void>((resolve, reject) => {
    const upload = new tus.Upload(file, {
      endpoint: `${supabaseUrl}/storage/v1/upload/resumable`,
      retryDelays: [0, 3000, 5000, 10000, 20000],
      headers: {
        authorization: `Bearer ${session.access_token}`,
      },
      // Keep creation request minimal; some environments reject create-with-upload.
      uploadDataDuringCreation: false,
      removeFingerprintOnSuccess: true,
      metadata: {
        bucketName: bucket,
        objectName: path,
        contentType: opts.contentType,
      },
      chunkSize: CHUNK_SIZE,
      onError: (error) => {
        const raw = String((error as Error)?.message || error)
        if (raw.includes('response code: 413') || raw.toLowerCase().includes('maximum size exceeded')) {
          reject(new Error('Upload rejected by storage size limits (HTTP 413). Check global Storage upload limit and bucket file size limit.'))
          return
        }
        reject(error)
      },
      onProgress: (bytesUploaded, bytesTotal) => {
        opts.onProgress?.(bytesUploaded / bytesTotal)
      },
      onSuccess: () => resolve(),
    })

    upload.findPreviousUploads().then((prev) => {
      if (prev.length) upload.resumeFromPreviousUpload(prev[0])
      upload.start()
    })
  })
}
