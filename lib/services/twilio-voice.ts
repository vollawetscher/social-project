/**
 * Twilio Programmable Voice — lightweight client using REST API directly.
 * Used for short notification calls (ring + TTS message), not for LiveKit SIP calls.
 */

interface TwilioCallResult {
  success: boolean
  callSid?: string
  error?: string
}

/**
 * Places a short Twilio voice call that plays a TTS message and hangs up.
 * Uses Twilio REST API with inline TwiML (no webhook needed).
 */
export async function placeNotificationCall(
  to: string,
  callerName: string,
): Promise<TwilioCallResult> {
  const accountSid = process.env.TWILIO_ACCOUNT_SID
  const authToken = process.env.TWILIO_AUTH_TOKEN
  const callerId = process.env.TWILIO_CALLER_ID

  if (!accountSid || !authToken || !callerId) {
    console.error('[TwilioVoice] Missing TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, or TWILIO_CALLER_ID')
    return { success: false, error: 'Twilio voice not configured' }
  }

  const twiml = [
    '<Response>',
    `<Say language="de-DE" voice="Polly.Vicki">`,
    `${callerName} möchte einen Videoanruf mit Ihnen starten. Bitte prüfen Sie die SMS mit dem Einladungslink.`,
    '</Say>',
    '<Pause length="1"/>',
    `<Say language="en-US" voice="Polly.Joanna">`,
    `${callerName} is inviting you to a video call. Please check your text messages for the link.`,
    '</Say>',
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
