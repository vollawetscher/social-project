/**
 * seven.io SMS Service Integration
 *
 * Handles SMS OTP delivery for phone authentication
 * Supports German-speaking EU countries (DE, AT, CH)
 */

type SupportedLocale = 'en' | 'de' | 'es'

interface SendSMSResponse {
  success: boolean;
  messageId?: string;
  error?: string;
}

interface SendSMSParams {
  to: string;
  text: string;
}

async function sendSMS({ to, text }: SendSMSParams): Promise<SendSMSResponse> {
  const apiKey = process.env.SEVEN_IO_API_KEY;

  if (!apiKey) {
    console.error('SEVEN_IO_API_KEY is not configured');
    return {
      success: false,
      error: 'SMS service not configured',
    };
  }

  try {
    const url = 'https://gateway.seven.io/api/sms';

    const params = new URLSearchParams({
      p: apiKey,
      to: to.replace('+', ''),
      text: text,
      from: 'Notissima',
    });

    const response = await fetch(`${url}?${params.toString()}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    });

    const responseText = await response.text();

    if (response.ok && !responseText.startsWith('9')) {
      return {
        success: true,
        messageId: responseText,
      };
    }

    let errorMessage = 'Failed to send SMS';
    if (responseText.startsWith('900')) errorMessage = 'Invalid API key';
    else if (responseText.startsWith('901')) errorMessage = 'Insufficient credits';
    else if (responseText.startsWith('902')) errorMessage = 'Invalid recipient number';
    else if (responseText.startsWith('903')) errorMessage = 'Message text missing';

    console.error('seven.io SMS error:', responseText);

    return {
      success: false,
      error: errorMessage,
    };
  } catch (error) {
    console.error('SMS service error:', error);
    return {
      success: false,
      error: 'Network error sending SMS',
    };
  }
}

export function generateOTP(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

const otpMessages: Record<SupportedLocale, (otp: string) => string> = {
  en: (otp) => `Your Notissima verification code is: ${otp}\n\nThis code is valid for 5 minutes.`,
  de: (otp) => `Ihr Notissima Verifizierungscode ist: ${otp}\n\nDieser Code ist 5 Minuten gültig.`,
  es: (otp) => `Su código de verificación de Notissima es: ${otp}\n\nEste código es válido durante 5 minutos.`,
}

export async function sendOTPSMS(
  phoneNumber: string,
  otp: string,
  locale: SupportedLocale = 'en',
): Promise<SendSMSResponse> {
  const getMessage = otpMessages[locale] || otpMessages.en
  return sendSMS({ to: phoneNumber, text: getMessage(otp) });
}

const inviteMessages: Record<SupportedLocale, (callerName: string, joinUrl: string) => string> = {
  en: (callerName, joinUrl) => `${callerName} is inviting you to a video call.\n\nJoin now: ${joinUrl}`,
  de: (callerName, joinUrl) => `${callerName} lädt Sie zu einem Videoanruf ein.\n\nJetzt beitreten: ${joinUrl}`,
  es: (callerName, joinUrl) => `${callerName} le invita a una videollamada.\n\nUnirse ahora: ${joinUrl}`,
}

export async function sendVideoCallInviteSMS(
  phoneNumber: string,
  callerName: string,
  joinUrl: string,
  locale: SupportedLocale = 'en',
): Promise<SendSMSResponse> {
  const getMessage = inviteMessages[locale] || inviteMessages.en
  return sendSMS({ to: phoneNumber, text: getMessage(callerName, joinUrl) })
}

export function isValidPhoneNumber(phoneNumber: string): boolean {
  const phoneRegex = /^\+[1-9]\d{9,14}$/;
  return phoneRegex.test(phoneNumber);
}

export function formatPhoneNumber(phoneNumber: string): string {
  if (!phoneNumber || !phoneNumber.startsWith('+')) {
    return phoneNumber;
  }

  const cleaned = phoneNumber.substring(1);

  if (cleaned.startsWith('49')) {
    return `+49 ${cleaned.substring(2, 5)} ${cleaned.substring(5)}`;
  } else if (cleaned.startsWith('43')) {
    return `+43 ${cleaned.substring(2, 5)} ${cleaned.substring(5)}`;
  } else if (cleaned.startsWith('41')) {
    return `+41 ${cleaned.substring(2, 4)} ${cleaned.substring(4)}`;
  }

  return `+${cleaned.substring(0, 2)} ${cleaned.substring(2)}`;
}
