/**
 * Twilio Programmable Voice — lightweight client using REST API directly.
 * Used for short notification calls (ring + TTS message), not for LiveKit SIP calls.
 */

import { createHmac, timingSafeEqual } from 'crypto'

type SupportedLocale = 'en' | 'de' | 'es'
import { resolveCallerIdForDestination } from '@/lib/services/pstn-routing'

/**
 * Verifies the X-Twilio-Signature header on an incoming webhook request.
 *
 * Twilio signs every webhook with HMAC-SHA1:
 *   signature = Base64( HMAC-SHA1( authToken, url + sorted(postParams) ) )
 *
 * For POST requests the sorted form fields are appended to the URL (key+value,
 * alphabetically by key, no separator between pairs). For GET requests only the
 * URL is signed. Query-string parameters are considered part of the URL for
 * both methods.
 *
 * @param authToken  TWILIO_AUTH_TOKEN env var value
 * @param signature  Value of the X-Twilio-Signature header
 * @param url        Canonical full URL Twilio is posting to (must match exactly)
 * @param params     Key/value pairs from the parsed form body (POST only)
 */
export function verifyTwilioSignature(
  authToken: string,
  signature: string,
  url: string,
  params: Record<string, string> = {}
): boolean {
  if (!authToken || !signature) return false

  // Twilio appends sorted POST params directly to the URL string (no separator).
  const sortedKeys = Object.keys(params).sort()
  const stringToSign = sortedKeys.reduce((acc, key) => acc + key + (params[key] ?? ''), url)

  const expected = createHmac('sha1', authToken).update(stringToSign, 'utf8').digest('base64')

  try {
    return timingSafeEqual(Buffer.from(expected), Buffer.from(signature))
  } catch {
    // Buffers of different length throw — treat as invalid
    return false
  }
}

interface TwilioCallResult {
  success: boolean
  callSid?: string
  error?: string
}

interface PlaceConsentCallParams {
  to: string
  consentWebhookUrl: string
}

type TwilioCallStatus =
  | 'queued'
  | 'ringing'
  | 'in-progress'
  | 'completed'
  | 'busy'
  | 'failed'
  | 'no-answer'
  | 'canceled'

const voiceConfig: Record<SupportedLocale, { language: string; voice: string; message: (callerName: string) => string }> = {
  en: {
    language: 'en-US',
    voice: 'Polly.Joanna',
    message: (callerName) => `${callerName} is inviting you to a video call. Please click the link in the SMS.`,
  },
  de: {
    language: 'de-DE',
    voice: 'Polly.Vicki',
    message: (callerName) => `${callerName} möchte einen Videoanruf starten. Klicken Sie einfach den Link in der SMS.`,
  },
  es: {
    language: 'es-ES',
    voice: 'Polly.Lucia',
    message: (callerName) => `${callerName} le invita a una videollamada. Haga clic en el enlace del SMS.`,
  },
}

/**
 * Places a short Twilio voice call that plays a TTS message and hangs up.
 * Uses Twilio REST API with inline TwiML (no webhook needed).
 * The locale determines the language of the voice message; falls back to bilingual DE+EN.
 */
export async function placeNotificationCall(
  to: string,
  callerName: string,
  locale: SupportedLocale = 'en',
): Promise<TwilioCallResult> {
  const accountSid = process.env.TWILIO_ACCOUNT_SID
  const authToken = process.env.TWILIO_AUTH_TOKEN
  const callerId = resolveCallerIdForDestination(to)

  if (!accountSid || !authToken || !callerId) {
    console.error('[TwilioVoice] Missing TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, or TWILIO_CALLER_ID')
    return { success: false, error: 'Twilio voice not configured' }
  }

  const cfg = voiceConfig[locale] || voiceConfig.en

  const twiml = [
    '<Response>',
    `<Say language="${cfg.language}" voice="${cfg.voice}">`,
    cfg.message(callerName),
    '</Say>',
    '<Pause length="1"/>',
    // Always add English fallback for non-English locales
    ...(locale !== 'en'
      ? [
          `<Say language="en-US" voice="Polly.Joanna">`,
          voiceConfig.en.message(callerName),
          '</Say>',
        ]
      : []),
    '</Response>',
  ].join('')

  try {
    const url = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Calls.json`
    const body = new URLSearchParams({
      To: to,
      From: callerId,
      Twiml: twiml,
      Timeout: '30',
    })

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: 'Basic ' + Buffer.from(`${accountSid}:${authToken}`).toString('base64'),
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: body.toString(),
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      console.error('[TwilioVoice] Call failed:', response.status, errorData)
      return { success: false, error: errorData.message || `HTTP ${response.status}` }
    }

    const data = await response.json()
    console.log('[TwilioVoice] Notification call placed:', data.sid)
    return { success: true, callSid: data.sid }
  } catch (error: any) {
    console.error('[TwilioVoice] Error placing call:', error)
    return { success: false, error: error.message || 'Network error' }
  }
}

/**
 * Places a Twilio call that executes consent IVR logic via webhook TwiML.
 * The webhook is expected to return <Gather input="speech dtmf">.
 */
export async function placeConsentCall({
  to,
  consentWebhookUrl,
}: PlaceConsentCallParams): Promise<TwilioCallResult> {
  const accountSid = process.env.TWILIO_ACCOUNT_SID
  const authToken = process.env.TWILIO_AUTH_TOKEN
  const callerId = resolveCallerIdForDestination(to)

  if (!accountSid || !authToken || !callerId) {
    console.error('[TwilioVoice] Missing TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, or TWILIO_CALLER_ID')
    return { success: false, error: 'Twilio voice not configured' }
  }

  try {
    const url = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Calls.json`
    const body = new URLSearchParams({
      To: to,
      From: callerId,
      Url: consentWebhookUrl,
      Method: 'POST',
      Timeout: '30',
    })

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: 'Basic ' + Buffer.from(`${accountSid}:${authToken}`).toString('base64'),
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: body.toString(),
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      console.error('[TwilioVoice] Consent call failed:', response.status, errorData)
      return { success: false, error: errorData.message || `HTTP ${response.status}` }
    }

    const data = await response.json()
    console.log('[TwilioVoice] Consent call placed:', data.sid)
    return { success: true, callSid: data.sid }
  } catch (error: any) {
    console.error('[TwilioVoice] Error placing consent call:', error)
    return { success: false, error: error.message || 'Network error' }
  }
}

/**
 * Polls Twilio for call progress and returns true once the call appears answered.
 * We treat "in-progress" as answered; "completed" may already be after a brief answered call.
 */
export async function waitForCallAnswered(
  callSid: string,
  opts?: { timeoutMs?: number; pollIntervalMs?: number }
): Promise<{ answered: boolean; status?: string; error?: string }> {
  const accountSid = process.env.TWILIO_ACCOUNT_SID
  const authToken = process.env.TWILIO_AUTH_TOKEN

  if (!accountSid || !authToken) {
    return { answered: false, error: 'Twilio voice not configured' }
  }

  const timeoutMs = opts?.timeoutMs ?? 45_000
  const pollIntervalMs = opts?.pollIntervalMs ?? 2_000
  const startedAt = Date.now()

  while (Date.now() - startedAt < timeoutMs) {
    try {
      const url = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Calls/${callSid}.json`
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          Authorization: 'Basic ' + Buffer.from(`${accountSid}:${authToken}`).toString('base64'),
        },
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        return { answered: false, error: errorData.message || `HTTP ${response.status}` }
      }

      const data = await response.json()
      const status = (data?.status as TwilioCallStatus | undefined) || 'queued'

      if (status === 'in-progress' || status === 'completed') {
        return { answered: true, status }
      }

      if (status === 'busy' || status === 'failed' || status === 'no-answer' || status === 'canceled') {
        return { answered: false, status }
      }
    } catch (error: any) {
      return { answered: false, error: error?.message || 'Network error' }
    }

    await new Promise((resolve) => setTimeout(resolve, pollIntervalMs))
  }

  return { answered: false, status: 'timeout' }
}
