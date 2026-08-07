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

const url = `${appBaseUrl.replace(/\/+$/, '')}/api/internal/scheduled-call-reminders`

// Guard against the endpoint hanging forever — Railway cron runs are already
// short-lived, but an explicit timeout gives a clean failure signal instead of
// an eventual container kill.
const controller = new AbortController()
const timeoutMs = 60_000
const timer = setTimeout(() => controller.abort(), timeoutMs)

try {
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-internal-secret': internalSecret,
    },
    body: '{}',
    signal: controller.signal,
  })

  const text = await res.text()
  console.log(text)

  if (!res.ok) {
    console.error(`ERROR: endpoint returned HTTP ${res.status}`)
    process.exit(1)
  }
} catch (err) {
  if (err && err.name === 'AbortError') {
    console.error(`ERROR: request timed out after ${timeoutMs}ms`)
  } else {
    console.error(`ERROR: request failed: ${err && err.message ? err.message : String(err)}`)
  }
  process.exit(1)
} finally {
  clearTimeout(timer)
}
