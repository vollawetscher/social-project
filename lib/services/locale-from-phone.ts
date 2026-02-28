export type SupportedLocale = 'en' | 'de' | 'es'

const DE_PREFIXES = ['49', '43', '41', '423']
const ES_PREFIXES = [
  '34', // Spain
  '52', // Mexico
  '54', // Argentina
  '56', // Chile
  '57', // Colombia
  '58', // Venezuela
  '591', // Bolivia
  '593', // Ecuador
  '595', // Paraguay
  '598', // Uruguay
  '503', // El Salvador
  '502', // Guatemala
  '504', // Honduras
  '505', // Nicaragua
  '506', // Costa Rica
  '507', // Panama
  '51', // Peru
]

/**
 * Infer message locale from E.164 phone number country code.
 * Falls back to English if no explicit mapping is found.
 */
export function inferLocaleFromPhone(phoneNumber: string): SupportedLocale {
  const digits = phoneNumber.replace(/[^\d]/g, '')
  if (!digits) return 'en'

  if (DE_PREFIXES.some((prefix) => digits.startsWith(prefix))) return 'de'
  if (ES_PREFIXES.some((prefix) => digits.startsWith(prefix))) return 'es'
  return 'en'
}
