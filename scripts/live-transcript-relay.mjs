import { WebSocketServer, WebSocket } from 'ws'
import { createHmac } from 'crypto'
import { createClient } from '@supabase/supabase-js'

const port = Number(process.env.LIVE_TRANSCRIPT_RELAY_PORT || 8081)
const relaySecret = process.env.LIVE_TRANSCRIPT_RELAY_SECRET || ''
const smApiKey = process.env.SPEECHMATICS_API_KEY || ''
const smRtBase = process.env.SPEECHMATICS_RT_URL || 'wss://eu2.rt.speechmatics.com/v2'
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ''

if (!relaySecret) throw new Error('LIVE_TRANSCRIPT_RELAY_SECRET is required')
if (!smApiKey) throw new Error('SPEECHMATICS_API_KEY is required')
if (!supabaseUrl || !supabaseServiceRoleKey) throw new Error('Supabase env vars are required')

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
})

let cachedRtToken = null
let cachedRtTokenExpiresAt = 0

async function getSpeechmaticsRtToken() {
  const now = Date.now()
  if (cachedRtToken && now < cachedRtTokenExpiresAt - 60_000) return cachedRtToken

  const res = await fetch('https://mp.speechmatics.com/v1/api_keys?type=rt', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${smApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ ttl: 3600 }),
  })
  if (!res.ok) {
    const txt = await res.text().catch(() => '')
    throw new Error(`Speechmatics token request failed (${res.status}): ${txt}`)
  }
  const body = await res.json()
  const token = body?.key_value
  if (!token) throw new Error('Speechmatics token response missing key_value')
  cachedRtToken = token
  cachedRtTokenExpiresAt = now + 3_600_000
  return token
}

function verifySignature(callId, room, source, ts, sig) {
  if (!callId || !room || !source || !ts || !sig) return false
  const ageMs = Math.abs(Date.now() - Number(ts))
  if (!Number.isFinite(ageMs) || ageMs > 5 * 60_000) return false
  const payload = `${callId}:${room}:${source}:${ts}`
  const expected = createHmac('sha256', relaySecret).update(payload).digest('hex')
  return expected === sig
}

function extractTranscriptText(data) {
  const metadataTranscript = typeof data?.metadata?.transcript === 'string'
    ? data.metadata.transcript.trim()
    : ''
  if (metadataTranscript) return metadataTranscript
  const results = Array.isArray(data?.results) ? data.results : []
  const parts = []
  for (const result of results) {
    const alternatives = Array.isArray(result?.alternatives) ? result.alternatives : []
    const first = alternatives[0]
    const content = typeof first?.content === 'string' ? first.content.trim() : ''
    if (content) parts.push(content)
  }
  return parts.join(' ').trim()
}

async function insertLine(callId, sourceKey, speakerLabel, text) {
  if (!text) return
  const { error } = await supabase.from('call_live_transcript_lines').insert({
    call_id: callId,
    source_key: sourceKey,
    speaker_label: speakerLabel || sourceKey,
    text,
    is_final: true,
    timestamp_ms: Date.now(),
  })
  if (error) {
    console.error('[Relay] Failed to store line:', error.message)
  }
}

const wss = new WebSocketServer({ port })
console.log(`[Relay] Live transcript relay listening on :${port}`)

wss.on('connection', async (lkWs, req) => {
  const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`)
  const callId = url.searchParams.get('callId') || ''
  const room = url.searchParams.get('room') || ''
  const source = url.searchParams.get('source') || ''
  const speaker = url.searchParams.get('speaker') || source
  const lang = (url.searchParams.get('lang') || 'de').toLowerCase()
  const ts = url.searchParams.get('ts') || ''
  const sig = url.searchParams.get('sig') || ''

  if (!verifySignature(callId, room, source, ts, sig)) {
    lkWs.close(1008, 'Invalid signature')
    return
  }

  let smWs = null
  let smReady = false
  let smStarted = false
  let smStartFailed = false
  let smStartInFlight = false
  let detectedSampleRate = 0
  let detectedChannels = 1
  const pendingAudio = []
  const maxPendingChunks = 128
  let finalBuffer = ''
  let flushTimer = null

  const flush = async () => {
    const value = finalBuffer.trim()
    finalBuffer = ''
    if (!value) return
    await insertLine(callId, source, speaker, value)
  }

  const queueFlush = () => {
    if (flushTimer) clearTimeout(flushTimer)
    flushTimer = setTimeout(() => {
      flush().catch((err) => console.error('[Relay] Flush error:', err))
      flushTimer = null
    }, 1200)
  }

  const startSpeechmatics = async () => {
    if (smStarted || smStartFailed || smStartInFlight) return
    smStartInFlight = true
    try {
      const token = await getSpeechmaticsRtToken()
      smWs = new WebSocket(`${smRtBase}?jwt=${token}`)
      const initialRate = detectedSampleRate || 48000
      const initialChannels = detectedChannels || 1

      smWs.on('open', () => {
        smWs.send(JSON.stringify({
          message: 'StartRecognition',
          audio_format: {
            type: 'raw',
            encoding: 'pcm_s16le',
            sample_rate: initialRate,
            channels: initialChannels,
          },
          transcription_config: {
            language: lang || 'de',
            operating_point: 'enhanced',
            enable_partials: true,
            max_delay: 5,
            enable_entities: false,
          },
        }))
        smStarted = true
        console.log('[Relay] StartRecognition sent', { callId, source, sampleRate: initialRate, channels: initialChannels, lang })
      })

      smWs.on('message', (raw) => {
        try {
          const data = JSON.parse(String(raw))
          if (data.message === 'RecognitionStarted') {
            smReady = true
            if (pendingAudio.length > 0 && smWs?.readyState === WebSocket.OPEN) {
              for (const chunk of pendingAudio.splice(0)) {
                try {
                  smWs.send(chunk)
                } catch {
                  // ignore
                }
              }
            }
            return
          }
          if (data.message === 'AddTranscript') {
            const text = extractTranscriptText(data)
            if (!text) return
            finalBuffer = finalBuffer ? `${finalBuffer} ${text}` : text
            const endsSentence = /[.!?…]$/.test(finalBuffer)
            const words = finalBuffer.split(/\s+/).filter(Boolean).length
            if (endsSentence || words >= 14) {
              if (flushTimer) {
                clearTimeout(flushTimer)
                flushTimer = null
              }
              flush().catch((err) => console.error('[Relay] Immediate flush error:', err))
            } else {
              queueFlush()
            }
          } else if (data.message === 'EndOfTranscript') {
            flush().catch((err) => console.error('[Relay] Final flush error:', err))
          } else if (data.message === 'Error') {
            console.error('[Relay] Speechmatics error:', data.reason || 'unknown')
          }
        } catch {
          // ignore malformed message
        }
      })

      smWs.on('close', () => {
        closeAll().catch(() => {})
      })
      smWs.on('error', (err) => {
        console.error('[Relay] Speechmatics socket error:', err)
        closeAll().catch(() => {})
      })
    } catch (err) {
      smStartFailed = true
      console.error('[Relay] Failed to initialize Speechmatics socket:', err)
      lkWs.close(1011, 'Speechmatics init failed')
    } finally {
      smStartInFlight = false
    }
  }

  const closeAll = async () => {
    if (flushTimer) {
      clearTimeout(flushTimer)
      flushTimer = null
    }
    try {
      if (smWs?.readyState === WebSocket.OPEN) {
        smWs.send(JSON.stringify({ message: 'EndOfStream' }))
      }
    } catch {}
    await flush().catch(() => {})
    try { smWs?.close() } catch {}
    try { lkWs.close() } catch {}
  }

  lkWs.on('message', (chunk, isBinary) => {
    if (!isBinary) {
      const text = String(chunk || '')
      try {
        const meta = JSON.parse(text)
        // LiveKit egress websocket can emit JSON text events carrying format metadata.
        const sr = Number(meta?.sample_rate ?? meta?.sampleRate ?? meta?.rate ?? 0)
        const ch = Number(meta?.channels ?? meta?.num_channels ?? meta?.channelCount ?? 0)
        if (Number.isFinite(sr) && sr >= 8000 && sr <= 96000) detectedSampleRate = sr
        if (Number.isFinite(ch) && ch >= 1 && ch <= 8) detectedChannels = ch
      } catch {
        // ignore non-json text frames
      }
      if (!smStarted && !smStartFailed) {
        void startSpeechmatics()
      }
      return
    }

    if (!smStarted && !smStartFailed) {
      // Binary arrived before metadata. Start with defaults and continue.
      void startSpeechmatics()
    }

    if (!smReady || smWs?.readyState !== WebSocket.OPEN) {
      if (pendingAudio.length < maxPendingChunks) pendingAudio.push(chunk)
      return
    }
    try {
      smWs.send(chunk)
    } catch (err) {
      console.error('[Relay] Failed to forward audio chunk:', err)
    }
  })

  lkWs.on('close', () => {
    closeAll().catch(() => {})
  })
  lkWs.on('error', () => {
    closeAll().catch(() => {})
  })

  // Ensure we initialize even if LiveKit sends no early metadata frame.
  setTimeout(() => {
    if (!smStarted && !smStartFailed) void startSpeechmatics()
  }, 200)
})
