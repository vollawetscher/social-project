/**
 * Sanitizers for generated output content.
 * - Enforces "no emoji/emoticon" policy.
 * - Normalizes tricky Unicode for safer PDF rendering with jsPDF core fonts.
 */

const ZERO_WIDTH_AND_BOM_RE = /[\u200B-\u200D\u2060\uFEFF]/g
const SPECIAL_SPACES_RE = /[\u00A0\u2007\u202F]/g
const EMOJI_RE = /\p{Extended_Pictographic}/gu
const EMOJI_VARIATION_AND_JOINERS_RE = /[\uFE0E\uFE0F\u200D]/g

// Common ASCII emoticons like :-) ;) :P :(
const ASCII_EMOTICON_RE =
  /(^|[\s([{<])(?:[:;=8xX]-?[)(DPpOo\/\\|]|[)(DPpOo\/\\|]-?[:;=8xX])(?=$|[\s)\]}>.,!?;:])/g
const HEART_EMOTICON_RE = /(^|[\s([{<])<3(?=$|[\s)\]}>.,!?;:])/g

export function sanitizeOutputText(input: string): string {
  let text = (input || '').normalize('NFC')
  text = text.replace(ZERO_WIDTH_AND_BOM_RE, '')
  text = text.replace(SPECIAL_SPACES_RE, ' ')
  text = text.replace(EMOJI_RE, '')
  text = text.replace(EMOJI_VARIATION_AND_JOINERS_RE, '')
  text = text.replace(ASCII_EMOTICON_RE, '$1')
  text = text.replace(HEART_EMOTICON_RE, '$1')
  return text
}

/**
 * Additional normalization for PDF exports using built-in jsPDF fonts.
 * These fonts are limited and can render some Unicode symbols poorly.
 */
export function sanitizeOutputForPdf(input: string): string {
  let text = sanitizeOutputText(input)

  // Replace common non-ASCII symbols with safe ASCII equivalents.
  text = text
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/[–—]/g, '-')
    .replace(/…/g, '...')
    .replace(/→/g, '->')
    .replace(/←/g, '<-')
    .replace(/↔/g, '<->')
    .replace(/≥/g, '>=')
    .replace(/≤/g, '<=')
    .replace(/−/g, '-')
    .replace(/•/g, '*')

  return text
}

