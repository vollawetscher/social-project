'use client'

import * as tus from 'tus-js-client'
import { SupabaseClient } from '@supabase/supabase-js'

const RESUMABLE_THRESHOLD = 40 * 1024 * 1024 // 40 MB
// 2 MB chunks are much more resilient on flaky wifi / mobile / proxied networks
// than the previous 5 MB chunks. The cost of a failed retry is smaller and
// intermediate proxies (corporate firewalls, CDNs) are less likely to drop the
// PATCH request mid-flight.
const CHUNK_SIZE = 2 * 1024 * 1024

interface UploadOptions {
  contentType: string
  onProgress?: (fraction: number) => void
}

function humanizeTusError(error: Error | any): Error {
  const raw = String(error?.message || error || '')
  const lower = raw.toLowerCase()
  if (raw.includes('response code: 413') || lower.includes('maximum size exceeded')) {
    return new Error(
      'Upload rejected by storage size limits (HTTP 413). File may exceed the project\u2019s storage limit.'
    )
  }
  if (raw.includes('response code: 401') || raw.includes('response code: 403')) {
    return new Error('Your session expired during upload. Please sign in again and retry.')
  }
  if (
    raw.includes('response code: n/a') ||
    raw.includes('XMLHttpRequestProgressEvent') ||
    lower.includes('networkerror') ||
    lower.includes('network error') ||
    lower.includes('failed to fetch')
  ) {
    return new Error(
      'Network error during upload. Check your connection and retry \u2014 large uploads can resume from where they stopped.'
    )
  }
  return error instanceof Error ? error : new Error(raw || 'Upload failed')
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

  const getAccessToken = async (): Promise<string> => {
    const {
      data: { session },
    } = await supabase.auth.getSession()
    if (!session?.access_token) throw new Error('Not authenticated')
    return session.access_token
  }

  // Prime the token so we fail fast if the user isn't signed in.
  const initialToken = await getAccessToken()

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  if (!supabaseUrl) throw new Error('Supabase URL not configured')

  return new Promise<void>((resolve, reject) => {
    const upload = new tus.Upload(file, {
      endpoint: `${supabaseUrl}/storage/v1/upload/resumable`,
      // Longer, more generous backoff so transient network blips during long
      // uploads don't surface as hard failures to the user.
      retryDelays: [0, 1000, 3000, 5000, 10000, 20000, 30000, 60000],
      headers: {
        authorization: `Bearer ${initialToken}`,
        // Allow resuming over a previously-created object when the TUS
        // fingerprint was lost (e.g. hard refresh) so the user can just retry.
        'x-upsert': 'true',
      },
      // Keep creation request minimal; some environments reject create-with-upload.
      uploadDataDuringCreation: false,
      removeFingerprintOnSuccess: true,
      metadata: {
        bucketName: bucket,
        objectName: path,
        contentType: opts.contentType,
        cacheControl: '3600',
      },
      chunkSize: CHUNK_SIZE,
      // Refresh the auth header before every HTTP request so long uploads
      // survive access_token rotation (default Supabase session ~1h).
      onBeforeRequest: async (req: any) => {
        try {
          const token = await getAccessToken()
          if (typeof req?.setHeader === 'function') {
            req.setHeader('authorization', `Bearer ${token}`)
          }
        } catch {
          // If we can't get a fresh token we fall back to the initial header;
          // a subsequent 401 will surface via humanizeTusError.
        }
      },
      // Retry network errors (status 0 / n/a) and 5xx; give up on auth/size/conflict
      // so we don't burn retries on unfixable conditions.
      onShouldRetry: (err: any, retryAttempt: number, options: any) => {
        const statusRaw = err?.originalResponse?.getStatus?.()
        const status = typeof statusRaw === 'number' ? statusRaw : 0
        if (status === 401 || status === 403) return false
        if (status === 413) return false
        if (status === 409) return false
        return retryAttempt < (options?.retryDelays?.length ?? 0)
      },
      onError: (error) => {
        reject(humanizeTusError(error))
      },
      onProgress: (bytesUploaded, bytesTotal) => {
        opts.onProgress?.(bytesUploaded / bytesTotal)
      },
      onSuccess: () => resolve(),
    })

    upload
      .findPreviousUploads()
      .then((prev) => {
        if (prev.length) upload.resumeFromPreviousUpload(prev[0])
        upload.start()
      })
      .catch(() => upload.start())
  })
}
