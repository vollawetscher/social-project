/**
 * Twilio Programmable Voice — lightweight client using REST API directly.
 * Used for short notification calls (ring + TTS message), not for LiveKit SIP calls.
 */

type SupportedLocale = 'en' | 'de' | 'es'

interface TwilioCallResult {
  success: boolean
  callSid?: string
  error?: string
}

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
  const callerId = process.env.TWILIO_CALLER_ID

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
