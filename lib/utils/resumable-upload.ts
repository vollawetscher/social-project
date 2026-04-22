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
  // Optional context used only for diagnostic logging when the upload fails.
  diagnostics?: {
    sessionId?: string | null
    originalFilename?: string | null
  }
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

// Best-effort diagnostic log of a failed TUS upload to /api/error-logs. This
// helps us debug cases like Safari + corporate proxies silently dropping PATCH
// requests (failure mode: many HEADs, zero PATCHes, "response code: n/a").
async function logTusDiagnostics(params: {
  error: any
  file: File
  bucket: string
  path: string
  uploadUrl: string | null
  bytesUploaded: number
  retryAttempt: number
  sessionId?: string | null
  originalFilename?: string | null
}): Promise<void> {
  try {
    const { error, file, bucket, path, uploadUrl, bytesUploaded, retryAttempt, sessionId, originalFilename } = params
    const rawMessage = String(error?.message || error || '')
    const originalResponse = (error as any)?.originalResponse
    const responseStatus =
      typeof originalResponse?.getStatus === 'function' ? originalResponse.getStatus() : null
    const responseBody =
      typeof originalResponse?.getBody === 'function' ? originalResponse.getBody() : null

    const metadata: Record<string, any> = {
      stage: 'resumable_upload',
      bucket,
      storagePath: path,
      uploadUrl,
      tusMessage: rawMessage.slice(0, 2000),
      responseStatus,
      responseBody: typeof responseBody === 'string' ? responseBody.slice(0, 500) : null,
      fileSize: file.size,
      fileType: file.type || null,
      originalFilename: originalFilename || file.name || null,
      bytesUploaded,
      retryAttempt,
      chunkSize: CHUNK_SIZE,
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : null,
      online: typeof navigator !== 'undefined' && 'onLine' in navigator ? navigator.onLine : null,
      connection:
        typeof navigator !== 'undefined' && (navigator as any).connection
          ? {
              effectiveType: (navigator as any).connection.effectiveType || null,
              downlink: (navigator as any).connection.downlink || null,
              rtt: (navigator as any).connection.rtt || null,
              saveData: (navigator as any).connection.saveData || null,
            }
          : null,
      pathname: typeof window !== 'undefined' ? window.location.pathname : null,
    }

    await fetch('/api/error-logs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        errorType: 'upload_error',
        severity: 'error',
        message: `TUS resumable upload failed: ${rawMessage.slice(0, 500)}`,
        sessionId: sessionId || null,
        metadata,
      }),
    }).catch(() => {
      // swallow — logging is best-effort
    })
  } catch {
    // swallow — logging is best-effort
  }
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

  // Prime the token so we fail fast if the user isn't signed in. We do NOT
  // pass it via the static `headers` option: see onBeforeRequest below.
  await getAccessToken()

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  if (!supabaseUrl) throw new Error('Supabase URL not configured')

  let lastBytesUploaded = 0
  let lastRetryAttempt = 0
  let resolvedUploadUrl: string | null = null

  return new Promise<void>((resolve, reject) => {
    const upload = new tus.Upload(file, {
      endpoint: `${supabaseUrl}/storage/v1/upload/resumable`,
      retryDelays: [0, 1000, 3000, 5000, 10000, 20000, 30000, 60000],
      // Scope the resumable-upload fingerprint to the exact target object path.
      //
      // The default tus-js-client fingerprint is keyed on
      //   (file.name, file.type, file.size, file.lastModified, endpoint)
      // — it does NOT include our target storage path. That caused a nasty
      // cross-session bug: when a user re-picked the same file after a failed
      // upload (which created a new `sessions` row with a new `storage_path`),
      // `findPreviousUploads()` returned the *old* upload URL from IndexedDB
      // and `resumeFromPreviousUpload()` pointed the chunks at the old path.
      // The new session then stayed in `status=uploading` forever because its
      // expected file never existed in storage.
      //
      // Including `objectName` (our session-specific storage path) in the
      // fingerprint means each new session gets a fresh cache entry and
      // creates a fresh tus upload, while genuine same-session resumes (same
      // file, same path) still benefit from resuming across tab reloads /
      // network blips.
      fingerprint: (f, options) =>
        Promise.resolve(
          [
            'tus',
            f.name,
            f.type,
            f.size,
            f.lastModified,
            options?.endpoint,
            (options?.metadata as Record<string, string> | undefined)?.objectName,
          ]
            .map((v) => String(v ?? ''))
            .join('-')
        ),
      // IMPORTANT: do NOT include `authorization` here. XHR's setRequestHeader
      // appends duplicate values when the same header is set twice on one
      // request, and the second write comes from onBeforeRequest below. The
      // resulting "authorization: Bearer X, Bearer X" made Supabase reject
      // the request with "Invalid Compact JWS". onBeforeRequest is now the
      // sole setter of the auth header.
      headers: {
        'x-upsert': 'true',
      },
      // IMPORTANT: do NOT enable `overridePatchMethod`.
      // We tried it briefly to work around a single user whose network
      // (mobile hotspot at the time) dropped the PATCH verb. Supabase's
      // TUS server does NOT honor `X-HTTP-Method-Override: PATCH` for chunk
      // uploads — it treats the POST as a CREATE and rejects every chunk
      // with HTTP 400 "Upload-Length or Upload-Defer-Length header required",
      // breaking all resumable uploads (>= 40 MB) for every user and every
      // browser. Evidence: storage logs showing POST 400 on every chunk URL
      // from both Chrome 146 and Safari 26.2. Keep real PATCH.
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
      onShouldRetry: (err: any, retryAttempt: number, options: any) => {
        lastRetryAttempt = retryAttempt
        const statusRaw = err?.originalResponse?.getStatus?.()
        const status = typeof statusRaw === 'number' ? statusRaw : 0
        if (status === 401 || status === 403) return false
        if (status === 413) return false
        if (status === 409) return false
        return retryAttempt < (options?.retryDelays?.length ?? 0)
      },
      onError: (error) => {
        // Fire-and-forget diagnostic log so the next time this happens we
        // have the full context (browser, chunk size, connection state,
        // HTTP status from TUS, upload URL).
        logTusDiagnostics({
          error,
          file,
          bucket,
          path,
          uploadUrl: resolvedUploadUrl,
          bytesUploaded: lastBytesUploaded,
          retryAttempt: lastRetryAttempt,
          sessionId: opts.diagnostics?.sessionId,
          originalFilename: opts.diagnostics?.originalFilename,
        })
        reject(humanizeTusError(error))
      },
      onProgress: (bytesUploaded, bytesTotal) => {
        lastBytesUploaded = bytesUploaded
        opts.onProgress?.(bytesUploaded / bytesTotal)
      },
      onSuccess: () => resolve(),
    })

    upload
      .findPreviousUploads()
      .then((prev) => {
        if (prev.length) upload.resumeFromPreviousUpload(prev[0])
        upload.start()
        // tus-js-client exposes the upload URL asynchronously once the POST
        // create has succeeded. Capture it for diagnostics.
        const captureUrl = () => {
          try {
            resolvedUploadUrl = (upload as any).url || null
          } catch {
            resolvedUploadUrl = null
          }
        }
        setTimeout(captureUrl, 1000)
        setTimeout(captureUrl, 5000)
        setTimeout(captureUrl, 15000)
      })
      .catch(() => upload.start())
  })
}
