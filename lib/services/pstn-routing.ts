/**
 * Resolve outbound caller ID for PSTN calls based on destination country code.
 *
 * Current rule:
 * - +1 (NANP/US-CA) => TWILIO_CALLER_ID_US (if configured)
 * - otherwise       => TWILIO_CALLER_ID
 */
export function resolveCallerIdForDestination(destinationE164: string): string | null {
  const defaultCallerId = process.env.TWILIO_CALLER_ID || null
  const usCallerId = process.env.TWILIO_CALLER_ID_US || null

  if (/^\+1\d{10}$/.test(destinationE164) && usCallerId) {
    return usCallerId
  }

  return defaultCallerId
}

