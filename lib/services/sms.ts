/**
 * seven.io SMS Service Integration
 *
 * Handles SMS OTP delivery for phone authentication
 * Supports German-speaking EU countries (DE, AT, CH)
 */

interface SendSMSResponse {
  success: boolean;
  messageId?: string;
  error?: string;
}

interface SendSMSParams {
  to: string;
  text: string;
}

/**
 * Sends an SMS using seven.io API
 */
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
      to: to.replace('+', ''), // Remove + prefix for seven.io
      text: text,
      from: 'RohberichtAI', // Sender ID
    });

    const response = await fetch(`${url}?${params.toString()}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    });

    const responseText = await response.text();

    // seven.io returns success codes as numbers (e.g., "100", "101")
    // Error codes are also numeric but indicate failure
    if (response.ok && !responseText.startsWith('9')) {
      return {
        success: true,
        messageId: responseText,
      };
    }

    // Parse error codes
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

/**
 * Generates a 6-digit OTP code
 */
export function generateOTP(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

/**
 * Sends an OTP code via SMS
 */
export async function sendOTPSMS(phoneNumber: string, otp: string): Promise<SendSMSResponse> {
  const message = `Ihr RohberichtAI Verifizierungscode ist: ${otp}\n\nDieser Code ist 5 Minuten gültig.\n\nYour RohberichtAI verification code is: ${otp}\n\nThis code is valid for 5 minutes.`;

  return sendSMS({
    to: phoneNumber,
    text: message,
  });
}

/**
 * Validates phone number format (international format with country code)
 */
export function isValidPhoneNumber(phoneNumber: string): boolean {
  // Must start with + followed by country code and number
  // Length between 10-15 digits total
  const phoneRegex = /^\+[1-9]\d{9,14}$/;
  return phoneRegex.test(phoneNumber);
}

/**
 * Formats phone number for display
 * Example: +4915112345678 -> +49 151 12345678
 */
export function formatPhoneNumber(phoneNumber: string): string {
  if (!phoneNumber || !phoneNumber.startsWith('+')) {
    return phoneNumber;
  }

  // Remove + for processing
  const cleaned = phoneNumber.substring(1);

  // Common formats for DE, AT, CH
  if (cleaned.startsWith('49')) {
    // Germany: +49 151 12345678
    return `+49 ${cleaned.substring(2, 5)} ${cleaned.substring(5)}`;
  } else if (cleaned.startsWith('43')) {
    // Austria: +43 664 12345678
    return `+43 ${cleaned.substring(2, 5)} ${cleaned.substring(5)}`;
  } else if (cleaned.startsWith('41')) {
    // Switzerland: +41 76 1234567
    return `+41 ${cleaned.substring(2, 4)} ${cleaned.substring(4)}`;
  }

  // Generic format for other countries
  return `+${cleaned.substring(0, 2)} ${cleaned.substring(2)}`;
}
