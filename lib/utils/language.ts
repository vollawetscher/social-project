/**
 * Consolidated language utilities.
 *
 * All language detection, normalization, and resolution logic lives here.
 * Consumer files (analyze, outputs/generate, import-transcript, pulse)
 * import from this single module instead of maintaining inline copies.
 */

/** ISO 639-1 code → English name */
export const LANG_NAMES: Record<string, string> = {
  de: 'German',
  en: 'English',
  es: 'Spanish',
  fr: 'French',
  it: 'Italian',
  pt: 'Portuguese',
  nl: 'Dutch',
  pl: 'Polish',
  cs: 'Czech',
  da: 'Danish',
  fi: 'Finnish',
  no: 'Norwegian',
  sv: 'Swedish',
  ru: 'Russian',
  ja: 'Japanese',
  zh: 'Chinese',
  ko: 'Korean',
  ar: 'Arabic',
  hi: 'Hindi',
  th: 'Thai',
  tr: 'Turkish',
  vi: 'Vietnamese',
}

const ALIASES: Record<string, string> = {
  en: 'en',
  english: 'en',
  de: 'de',
  german: 'de',
  deutsch: 'de',
  es: 'es',
  spanish: 'es',
  espanol: 'es',
  'español': 'es',
  fr: 'fr',
  french: 'fr',
  'français': 'fr',
  francais: 'fr',
  it: 'it',
  italian: 'it',
  pt: 'pt',
  portuguese: 'pt',
  nl: 'nl',
  dutch: 'nl',
  pl: 'pl',
  polish: 'pl',
  cs: 'cs',
  da: 'da',
  fi: 'fi',
  no: 'no',
  sv: 'sv',
  ru: 'ru',
  russian: 'ru',
  ja: 'ja',
  japanese: 'ja',
  ko: 'ko',
  korean: 'ko',
  zh: 'zh',
  chinese: 'zh',
  ar: 'ar',
  arabic: 'ar',
  hi: 'hi',
  hindi: 'hi',
  th: 'th',
  thai: 'th',
  tr: 'tr',
  turkish: 'tr',
  vi: 'vi',
  vietnamese: 'vi',
}

/**
 * Normalize a raw language value to a 2-letter ISO 639-1 code.
 * Returns `null` for empty, 'auto', or 'session' — those mean "unset".
 * Handles full names ("english" → "en"), locale variants ("de-DE" → "de"), etc.
 */
export function normalizeLanguageCode(raw: string | null | undefined): string | null {
  const value = String(raw || '').trim().toLowerCase()
  if (!value || value === 'auto' || value === 'session') return null

  if (ALIASES[value]) return ALIASES[value]

  const localePrefix = value.split(/[-_]/)[0]
  if (ALIASES[localePrefix]) return ALIASES[localePrefix]

  return null
}

// ---------------------------------------------------------------------------
// Stop-word sets for Latin-script language detection
// ---------------------------------------------------------------------------

const STOP_WORDS: Record<string, Set<string>> = {
  en: new Set(['the', 'and', 'is', 'are', 'was', 'were', 'for', 'you', 'that', 'with', 'have', 'this', 'from', 'they', 'been', 'would', 'could', 'should', 'about', 'which', 'their', 'what', 'your', 'will', 'there', 'also', 'does', 'had', 'but', 'not', 'can']),
  de: new Set(['der', 'die', 'das', 'und', 'ist', 'ein', 'eine', 'für', 'nicht', 'mit', 'auf', 'den', 'dem', 'von', 'des', 'sich', 'auch', 'wird', 'oder', 'nach', 'wie', 'noch', 'bei', 'hat', 'aus', 'wenn', 'über', 'aber', 'dann', 'kann', 'dass']),
  fr: new Set(['les', 'des', 'une', 'est', 'dans', 'pour', 'que', 'pas', 'sur', 'sont', 'avec', 'plus', 'par', 'qui', 'ont', 'mais', 'cette', 'nous', 'vous', 'leur', 'elle', 'ses', 'aux', 'ces', 'entre', 'comme', 'tout', 'fait', 'bien', 'aussi']),
  es: new Set(['los', 'las', 'una', 'del', 'con', 'para', 'por', 'que', 'como', 'más', 'pero', 'sus', 'sobre', 'este', 'entre', 'cuando', 'esta', 'son', 'todo', 'desde', 'está', 'muy', 'hay', 'puede', 'todos', 'nos', 'sido', 'tiene', 'también', 'ese']),
  it: new Set(['il', 'la', 'di', 'che', 'con', 'per', 'nel', 'una', 'sono', 'non', 'del', 'più', 'questo', 'anche', 'come', 'loro']),
  pt: new Set(['de', 'que', 'com', 'para', 'uma', 'não', 'mais', 'dos', 'como', 'por', 'mas', 'foi', 'tem', 'ser', 'seu', 'sua']),
  nl: new Set(['de', 'het', 'een', 'met', 'van', 'voor', 'dat', 'zijn', 'ook', 'niet', 'maar', 'nog', 'wel', 'naar', 'dan', 'als']),
  pl: new Set(['i', 'że', 'nie', 'się', 'jest', 'dla', 'to', 'na', 'tak', 'ale', 'jak', 'już', 'ich', 'ten', 'czy', 'przy']),
  tr: new Set(['ve', 'bir', 'ile', 'için', 'gibi', 'ama', 'bu', 'da', 'den', 'var', 'olan', 'daha']),
  vi: new Set(['và', 'là', 'cho', 'trong', 'không', 'của', 'một', 'này', 'có', 'được', 'với', 'các']),
}

/**
 * Lightweight heuristic for pre-analysis language detection.
 * NOT authoritative — Claude provides the final answer during analysis.
 * Returns `null` when ambiguous.
 */
export function detectLanguageHint(text: string, filename?: string): string | null {
  if (filename) {
    const lower = filename.toLowerCase()
    if (/english/i.test(lower)) return 'en'
    if (/deutsch|german/i.test(lower)) return 'de'
    if (/fran[çc]ais|french/i.test(lower)) return 'fr'
    if (/espa[ñn]ol|spanish/i.test(lower)) return 'es'
  }

  const sample = String(text || '').slice(0, 6000)
  if (!sample.trim()) return null

  // Script-based detection — high confidence for non-Latin scripts
  if (/[\u3040-\u30ff]/.test(sample)) return 'ja'
  if (/[\uac00-\ud7af]/.test(sample)) return 'ko'
  if (/[\u0e00-\u0e7f]/.test(sample)) return 'th'
  if (/[\u0600-\u06ff]/.test(sample)) return 'ar'
  if (/[\u0900-\u097f]/.test(sample)) return 'hi'
  if (/[\u0400-\u04ff]/.test(sample)) return 'ru'
  if (/[\u4e00-\u9fff]/.test(sample)) return 'zh'

  // Stop-word counting for Latin scripts
  const words = sample
    .toLowerCase()
    .replace(/[^a-zäöüßàâéèêëïîôùûçñ\s]/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
  if (words.length < 10) return null

  const scores: Record<string, number> = {}
  for (const lang of Object.keys(STOP_WORDS)) scores[lang] = 0
  for (const w of words) {
    for (const [lang, wordSet] of Object.entries(STOP_WORDS)) {
      if (wordSet.has(w)) scores[lang]++
    }
  }

  const ranked = Object.entries(scores).sort((a, b) => b[1] - a[1])
  if (!ranked[0] || ranked[0][1] < 3) return null
  if (ranked[1] && ranked[1][1] > 0 && ranked[0][1] / ranked[1][1] < 1.5) return null
  return ranked[0][0]
}

/**
 * Determine the output language for reports/analysis text.
 * This is the language the USER wants to READ, not necessarily the transcript language.
 *
 * Resolution chain:
 *   requested → userPreference → transcriptLanguage → sessionLanguage → heuristic → 'de'
 */
export function resolveOutputLanguageCode(opts: {
  requested?: string | null
  userPreference?: string | null
  sessionLanguage?: string | null
  transcriptLanguage?: string | null
  transcriptText?: string | null
}): string {
  const requested = normalizeLanguageCode(opts.requested)
  if (requested) return requested

  const pref = normalizeLanguageCode(opts.userPreference)
  if (pref) return pref

  const transcriptLang = normalizeLanguageCode(opts.transcriptLanguage)
  if (transcriptLang) return transcriptLang

  const sessionLang = normalizeLanguageCode(opts.sessionLanguage)
  if (sessionLang) return sessionLang

  if (opts.transcriptText) {
    const hint = detectLanguageHint(opts.transcriptText)
    if (hint) return hint
  }

  return 'de'
}
