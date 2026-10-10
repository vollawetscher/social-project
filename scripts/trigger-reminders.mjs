#!/usr/bin/env node
// Fires a POST to the internal scheduled-call-reminders endpoint.
// Invoked from scripts/trigger-reminders.sh on Railway Cron.

const appBaseUrl = process.env.APP_BASE_URL
const internalSecret = process.env.INTERNAL_API_SECRET

if (!appBaseUrl) {
  console.error('ERROR: APP_BASE_URL is not set')
  process.exit(1)
}
if (!internalSecret) {
  console.error('ERROR: INTERNAL_API_SECRET is not set')
  process.exit(1)
}

const baseUrl = appBaseUrl.replace(/\/+$/, '')

// Each endpoint gets its own abort controller so a slow one can't starve the
// other. Both must succeed for the cron run to exit 0 — otherwise Railway
// surfaces a clean failure.
async function post(path, { timeoutMs = 60_000, body = '{}' } = {}) {
  const url = `${baseUrl}${path}`
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-internal-secret': internalSecret,
      },
      body,
      signal: controller.signal,
    })
    const text = await res.text()
    console.log(`[${path}] HTTP ${res.status} ${text}`)
    if (!res.ok) {
      throw new Error(`endpoint returned HTTP ${res.status}`)
    }
  } catch (err) {
    if (err && err.name === 'AbortError') {
      throw new Error(`request timed out after ${timeoutMs}ms`)
    }
    throw err
  } finally {
    clearTimeout(timer)
  }
}

const results = await Promise.allSettled([
  // Original job: fire scheduled call reminders.
  post('/api/internal/scheduled-call-reminders'),
  // Drain the async job queue — retryable jobs (pulse_update, session_analyze,
  // etc.) have run_at set to a future time after a failure, and nothing else
  // wakes the worker up when that time arrives. Without this, failed jobs sit
  // in `retryable` forever until some unrelated enqueue happens to trigger it.
  post('/api/internal/jobs/run', { body: JSON.stringify({ limit: 25 }) }),
])

let failed = false
for (const r of results) {
  if (r.status === 'rejected') {
    failed = true
    console.error(`ERROR: ${r.reason && r.reason.message ? r.reason.message : String(r.reason)}`)
  }
}
if (failed) process.exit(1)
