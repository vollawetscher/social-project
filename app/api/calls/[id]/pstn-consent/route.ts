import { createServiceRoleClient } from '@/lib/supabase/server'
import { createSipParticipant, startTrackEgressForParticipant } from '@/lib/services/livekit'
import { verifyTwilioSignature } from '@/lib/services/twilio-voice'
import { getAppBaseUrl } from '@/lib/utils/app-url'

type Locale = 'en' | 'de' | 'es'
type ConsentState = 'granted' | 'declined' | 'timeout'

const LOCALE_PROMPTS: Record<Locale, {
  language: string
  prompt: string
  options: string
  connecting: string
    declined: string
  timeout: string
  hints: string
}> = {
  en: {
    language: 'en-US',
    prompt: 'This call may be recorded for documentation. Do you consent?',
    options: 'Say yes or no. You can also press 1 for yes or 2 for no.',
    connecting: 'Thank you. Connecting your call now.',
    declined: 'Understood. You will be connected without recording your side.',
    timeout: 'No response received. We will end this call now. Goodbye.',
    hints: 'yes,no',
  },
  de: {
    language: 'de-DE',
    prompt: 'Dieser Anruf kann zu Dokumentationszwecken aufgezeichnet werden. Stimmen Sie zu?',
    options: 'Sagen Sie Ja oder Nein. Oder drücken Sie 1 für Ja oder 2 für Nein.',
    connecting: 'Danke. Wir verbinden Sie jetzt.',
    declined: 'Verstanden. Sie werden verbunden, ohne dass Ihre Seite aufgezeichnet wird.',
    timeout: 'Keine Antwort erhalten. Wir beenden den Anruf jetzt. Auf Wiederhören.',
    hints: 'ja,nein,yes,no',
  },
  es: {
    language: 'es-ES',
    prompt: 'Esta llamada puede ser grabada con fines de documentación. ¿Aceptas?',
    options: 'Di sí o no. También puedes pulsar 1 para sí o 2 para no.',
    connecting: 'Gracias. Te estamos conectando ahora.',
    declined: 'Entendido. Te conectaremos sin grabar tu lado.',
    timeout: 'No recibimos respuesta. Terminaremos la llamada ahora. Adiós.',
    hints: 'si,sí,no,yes',
  },
}

function normalizeLocale(raw: string | null): Locale {
  const lower = String(raw || 'en').toLowerCase()
  if (lower.startsWith('de')) return 'de'
  if (lower.startsWith('es')) return 'es'
  return 'en'
}

function toTwimlResponse(twiml: string) {
  return new Response(twiml, {
    status: 200,
    headers: { 'Content-Type': 'text/xml; charset=utf-8' },
  })
}

function parseConsentDecision(locale: Locale, digits: string, speech: string): ConsentState {
  if (digits === '1') return 'granted'
  if (digits === '2') return 'declined'

  const s = speech.toLowerCase()
  const yesWords = locale === 'de'
    ? ['ja', 'yes', 'ok', 'okay']
    : locale === 'es'
      ? ['si', 'sí', 'yes', 'ok', 'okay']
      : ['yes', 'yeah', 'yep', 'ok', 'okay']
  const noWords = locale === 'de'
    ? ['nein', 'no', 'nicht']
    : locale === 'es'
      ? ['no']
      : ['no', 'nope']

  if (yesWords.some((w) => s.includes(w))) return 'granted'
  if (noWords.some((w) => s.includes(w))) return 'declined'
  return 'timeout'
}

async function handleConsentWebhook(
  request: Request,
  { params }: { params: { id: string } }
) {
  const callId = params.id
  const parsedUrl = new URL(request.url)
  const stage = parsedUrl.searchParams.get('stage')
  const locale = normalizeLocale(parsedUrl.searchParams.get('locale'))
  const cfg = LOCALE_PROMPTS[locale]
  console.log('[PSTN Consent] Webhook hit', { method: request.method, stage, locale, url: request.url })

  // --- Twilio signature verification ---
  const authToken = process.env.TWILIO_AUTH_TOKEN ?? ''
  const twilioSignature = request.headers.get('X-Twilio-Signature') ?? ''

  // Reconstruct the canonical URL Twilio signed. Twilio uses the URL you put
  // in your TwiML/dashboard, which is always the production HTTPS base URL.
  const canonicalUrl =
    `${getAppBaseUrl()}/api/calls/${callId}/pstn-consent` +
    (parsedUrl.search ? parsedUrl.search : '')

  // For POST requests, signature covers sorted form params appended to the URL.
  // We need to read the body here to extract params; we clone so the original
  // body stream can still be consumed later.
  let formParams: Record<string, string> = {}
  let formDataForLater: FormData | null = null

  if (request.method === 'POST') {
    const cloned = request.clone()
    formDataForLater = await cloned.formData()
    formDataForLater.forEach((value, key) => {
      formParams[key] = String(value)
    })
  }

  const signatureValid = verifyTwilioSignature(authToken, twilioSignature, canonicalUrl, formParams)

  if (!signatureValid) {
    // Allow unsigned requests only in local development (no auth token configured).
    if (authToken) {
      console.warn('[PSTN Consent] Invalid Twilio signature — rejecting request', {
        canonicalUrl,
        hasSignature: Boolean(twilioSignature),
      })
      return new Response('Forbidden', { status: 403 })
    }
    console.warn('[PSTN Consent] TWILIO_AUTH_TOKEN not set — skipping signature check (dev mode)')
  }
  // --- end verification ---

  // Initial IVR prompt.
  if (stage !== 'result') {
    const actionUrl = `${getAppBaseUrl()}/api/calls/${callId}/pstn-consent?stage=result&locale=${locale}`
    const twiml = [
      '<?xml version="1.0" encoding="UTF-8"?>',
      '<Response>',
      `<Gather input="speech dtmf" method="POST" action="${actionUrl}" numDigits="1" timeout="8" speechTimeout="auto" actionOnEmptyResult="true">`,
      `<Say language="${cfg.language}" voice="alice">${cfg.prompt}</Say>`,
      `<Say language="${cfg.language}" voice="alice">${cfg.options}</Say>`,
      '</Gather>',
      `<Say language="${cfg.language}" voice="alice">${cfg.timeout}</Say>`,
      '<Hangup/>',
      '</Response>',
    ].join('')
    return toTwimlResponse(twiml)
  }

  try {
    const db = createServiceRoleClient()
    // Use the already-parsed form data (consumed above for signature verification).
    const form = formDataForLater ?? await request.formData()
    const digits = String(form.get('Digits') || '').trim()
    const speech = String(form.get('SpeechResult') || '').trim()
    const decision = parseConsentDecision(locale, digits, speech)

    const { data: call } = await db
      .from('calls')
      .select('id, room_name, phone_number, participant_a_identity, track_a_egress_id, session_id, contact_name, sip_call_id')
      .eq('id', callId)
      .maybeSingle()

    if (!call) {
      return toTwimlResponse('<?xml version="1.0" encoding="UTF-8"?><Response><Hangup/></Response>')
    }

    const participantIdentity = call.phone_number ? `sip-${call.phone_number}` : 'pstn-unknown'
    const participantName = call.contact_name || call.phone_number || 'Phone Participant'

    if (decision === 'granted') {
      await db
        .from('calls')
        .update({
          pstn_consent_state: 'granted',
          callee_declined: false,
        })
        .eq('id', call.id)

      await db.from('consent_logs').insert({
        call_id: call.id,
        participant_name: participantName,
        participant_identity: participantIdentity,
        granted: true,
      })

      if (!call.sip_call_id && call.phone_number) {
        const sipParticipant = await createSipParticipant(call.room_name, call.phone_number, {
          participantIdentity,
          participantName,
          playDialtone: true,
          ringingTimeout: 90,
        })

        await db
          .from('calls')
          .update({
            sip_call_id: sipParticipant.participantId,
            participant_b_identity: participantIdentity,
          })
          .eq('id', call.id)
      }

      const twiml = [
        '<?xml version="1.0" encoding="UTF-8"?>',
        '<Response>',
        `<Say language="${cfg.language}" voice="alice">${cfg.connecting}</Say>`,
        '<Hangup/>',
        '</Response>',
      ].join('')
      return toTwimlResponse(twiml)
    }

    const nextState = decision === 'declined' ? 'declined' : 'timeout'
    await db
      .from('calls')
      .update({
        pstn_consent_state: nextState,
        callee_declined: true,
      })
      .eq('id', call.id)

    await db.from('consent_logs').insert({
      call_id: call.id,
      participant_name: participantName,
      participant_identity: participantIdentity,
      granted: false,
    })

    // Keep initiator recording even when callee declines/does not respond.
    if (call.session_id && call.participant_a_identity && !call.track_a_egress_id) {
      try {
        const egress = await startTrackEgressForParticipant(
          call.room_name,
          call.session_id,
          call.participant_a_identity,
        )
        await db
          .from('calls')
          .update({ track_a_egress_id: egress.egressId })
          .eq('id', call.id)
        await db
          .from('sessions')
          .update({ status: 'recording' })
          .eq('id', call.session_id)
      } catch (egressError: any) {
        console.error('[PSTN Consent] Failed to start caller-only egress:', egressError)
      }
    }

    // If the callee explicitly declines consent, still connect them but keep caller-only recording.
    if (decision === 'declined' && !call.sip_call_id && call.phone_number) {
      try {
        const sipParticipant = await createSipParticipant(call.room_name, call.phone_number, {
          participantIdentity,
          participantName,
          playDialtone: true,
          ringingTimeout: 90,
        })
        await db
          .from('calls')
          .update({
            sip_call_id: sipParticipant.participantId,
            participant_b_identity: participantIdentity,
          })
          .eq('id', call.id)
      } catch (sipError: any) {
        console.error('[PSTN Consent] Failed to connect declined callee:', sipError)
      }
    }

    const declinedMessage = decision === 'declined' ? cfg.declined : cfg.timeout
    const twiml = [
      '<?xml version="1.0" encoding="UTF-8"?>',
      '<Response>',
      `<Say language="${cfg.language}" voice="alice">${declinedMessage}</Say>`,
      '<Hangup/>',
      '</Response>',
    ].join('')
    return toTwimlResponse(twiml)
  } catch (error: any) {
    console.error('[PSTN Consent] Error:', error)
    return toTwimlResponse('<?xml version="1.0" encoding="UTF-8"?><Response><Say>An error occurred.</Say><Hangup/></Response>')
  }
}

export async function POST(
  request: Request,
  ctx: { params: { id: string } }
) {
  return handleConsentWebhook(request, ctx)
}

// Twilio can be configured for GET or POST webhooks.
// Accepting both prevents "application error" due to method mismatch.
export async function GET(
  request: Request,
  ctx: { params: { id: string } }
) {
  return handleConsentWebhook(request, ctx)
}
