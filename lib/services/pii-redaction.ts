import crypto from 'crypto'
import { TranscriptSegment, PIIHit, PIIType } from '@/lib/types/database'

export interface PIIRedactionResult {
  redactedSegments: TranscriptSegment[]
  redactedText: string
  piiHits: Omit<PIIHit, 'id' | 'session_id' | 'created_at'>[]
}

export class PIIRedactionService {
  private nameCounter = 0
  private phoneCounter = 0
  private emailCounter = 0
  private addressCounter = 0
  private dateCounter = 0

  private namePatterns = [
    // Standard two-word capitalized pattern (filtered by isLikelyName)
    /\b[A-ZÄÖÜ][a-zäöüß]+\s+[A-ZÄÖÜ][a-zäöüß]+\b/g,
    // Title + name patterns (high confidence)
    /\b(?:Herr|Frau|Dr\.|Prof\.|Doktor)\s+[A-ZÄÖÜ][a-zäöüß]+(?:\s+[A-ZÄÖÜ][a-zäöüß]+)?\b/g,
  ]

  // Context patterns that indicate a name follows (high confidence)
  private nameContextPatterns = [
    // "Ich bin [Name]", "Das ist [Name]", "Ich heiße [Name]"
    /\b(?:ich bin|das ist|ich heiße|ich heisse|mein name ist|name ist)\s+([A-ZÄÖÜ][a-zäöüß]+(?:\s+[A-ZÄÖÜ][a-zäöüß]+)?)\b/gi,
    // "von [Name]", "für [Name]", "mit [Name]" (when followed by capitalized words)
    /\b(?:von|für|mit|bei)\s+(?:Herr|Frau|Dr\.|Prof\.)?\s*([A-ZÄÖÜ][a-zäöüß]+(?:\s+[A-ZÄÖÜ][a-zäöüß]+)?)\b/gi,
  ]

  private phonePattern = /\b(?:\+49|0)[\s\-]?\d{2,5}[\s\-]?\d{3,}[\s\-]?\d{3,}\b/g

  private emailPattern = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g

  private addressPatterns = [
    /\b[A-ZÄÖÜ][a-zäöüß]+(?:straße|str\.|weg|platz|allee|gasse)\s+\d+[a-z]?\b/gi,
    /\b\d{5}\s+[A-ZÄÖÜ][a-zäöüß]+(?:\s+[A-ZÄÖÜ][a-zäöüß]+)?\b/g,
  ]

  private datePatterns = [
    /\b\d{1,2}\.\s?\d{1,2}\.\s?\d{2,4}\b/g,
    /\b\d{1,2}\s+(?:Januar|Februar|März|April|Mai|Juni|Juli|August|September|Oktober|November|Dezember)\s+\d{4}\b/gi,
  ]

  redact(segments: TranscriptSegment[]): PIIRedactionResult {
    this.resetCounters()

    const redactedSegments: TranscriptSegment[] = []
    const piiHits: Omit<PIIHit, 'id' | 'session_id' | 'created_at'>[] = []

    for (const segment of segments) {
      let redactedText = segment.text

      redactedText = this.redactEmails(redactedText, segment.start_ms, segment.end_ms, piiHits)
      redactedText = this.redactPhones(redactedText, segment.start_ms, segment.end_ms, piiHits)
      redactedText = this.redactAddresses(redactedText, segment.start_ms, segment.end_ms, piiHits)
      redactedText = this.redactDates(redactedText, segment.start_ms, segment.end_ms, piiHits)
      redactedText = this.redactNames(redactedText, segment.start_ms, segment.end_ms, piiHits)

      redactedSegments.push({
        ...segment,
        text: redactedText,
      })
    }

    const redactedText = redactedSegments.map((s) => s.text).join(' ')

    return {
      redactedSegments,
      redactedText,
      piiHits,
    }
  }

  private resetCounters() {
    this.nameCounter = 0
    this.phoneCounter = 0
    this.emailCounter = 0
    this.addressCounter = 0
    this.dateCounter = 0
  }

  private hashValue(value: string): string {
    return crypto.createHash('sha256').update(value).digest('hex')
  }

  private redactEmails(
    text: string,
    startMs: number,
    endMs: number,
    piiHits: Omit<PIIHit, 'id' | 'session_id' | 'created_at'>[]
  ): string {
    return text.replace(this.emailPattern, (match) => {
      this.emailCounter++
      const placeholder = `[EMAIL_${this.emailCounter}]`
      piiHits.push({
        type: 'email',
        placeholder,
        original_hash: this.hashValue(match),
        start_ms: startMs,
        end_ms: endMs,
      })
      return placeholder
    })
  }

  private redactPhones(
    text: string,
    startMs: number,
    endMs: number,
    piiHits: Omit<PIIHit, 'id' | 'session_id' | 'created_at'>[]
  ): string {
    return text.replace(this.phonePattern, (match) => {
      this.phoneCounter++
      const placeholder = `[PHONE_${this.phoneCounter}]`
      piiHits.push({
        type: 'phone',
        placeholder,
        original_hash: this.hashValue(match),
        start_ms: startMs,
        end_ms: endMs,
      })
      return placeholder
    })
  }

  private redactAddresses(
    text: string,
    startMs: number,
    endMs: number,
    piiHits: Omit<PIIHit, 'id' | 'session_id' | 'created_at'>[]
  ): string {
    let result = text
    for (const pattern of this.addressPatterns) {
      result = result.replace(pattern, (match) => {
        this.addressCounter++
        const placeholder = `[ADDRESS_${this.addressCounter}]`
        piiHits.push({
          type: 'address',
          placeholder,
          original_hash: this.hashValue(match),
          start_ms: startMs,
          end_ms: endMs,
        })
        return placeholder
      })
    }
    return result
  }

  private redactDates(
    text: string,
    startMs: number,
    endMs: number,
    piiHits: Omit<PIIHit, 'id' | 'session_id' | 'created_at'>[]
  ): string {
    let result = text
    for (const pattern of this.datePatterns) {
      result = result.replace(pattern, (match) => {
        this.dateCounter++
        const placeholder = `[DATE_${this.dateCounter}]`
        piiHits.push({
          type: 'date',
          placeholder,
          original_hash: this.hashValue(match),
          start_ms: startMs,
          end_ms: endMs,
        })
        return placeholder
      })
    }
    return result
  }

  private redactNames(
    text: string,
    startMs: number,
    endMs: number,
    piiHits: Omit<PIIHit, 'id' | 'session_id' | 'created_at'>[]
  ): string {
    let result = text
    const redactedNames = new Set<string>()

    // First pass: High-confidence context-based name detection
    for (const pattern of this.nameContextPatterns) {
      result = result.replace(pattern, (match, capturedName) => {
        // capturedName is the name captured in the group
        if (capturedName && !redactedNames.has(capturedName)) {
          this.nameCounter++
          const placeholder = `[NAME_${this.nameCounter}]`
          piiHits.push({
            type: 'name',
            placeholder,
            original_hash: this.hashValue(capturedName),
            start_ms: startMs,
            end_ms: endMs,
          })
          redactedNames.add(capturedName)
          // Replace just the name part, keep the context words
          return match.replace(capturedName, placeholder)
        }
        return match
      })
    }

    // Second pass: General name patterns (with isLikelyName filter)
    for (const pattern of this.namePatterns) {
      result = result.replace(pattern, (match) => {
        // Skip if already redacted
        if (redactedNames.has(match)) {
          return match
        }

        // Check if it contains a title (high confidence)
        const hasTitle = /(?:Herr|Frau|Dr\.|Prof\.|Doktor)/i.test(match)
        
        if (hasTitle || this.isLikelyName(match)) {
          this.nameCounter++
          const placeholder = `[NAME_${this.nameCounter}]`
          piiHits.push({
            type: 'name',
            placeholder,
            original_hash: this.hashValue(match),
            start_ms: startMs,
            end_ms: endMs,
          })
          redactedNames.add(match)
          return placeholder
        }
        return match
      })
    }
    return result
  }

  private isLikelyName(text: string): boolean {
    // Comprehensive German stopword list - common words that shouldn't be redacted
    const commonWords = new Set([
      // Articles
      'Die', 'Der', 'Das', 'Ein', 'Eine', 'Einer', 'Einem', 'Einen', 'Des', 'Dem', 'Den',
      // Conjunctions
      'Und', 'Oder', 'Aber', 'Denn', 'Sondern', 'Weil', 'Dass', 'Obwohl', 'Wenn', 'Als',
      // Adverbs
      'Auch', 'Nur', 'Noch', 'Schon', 'Sehr', 'Mehr', 'Weniger', 'Immer', 'Nie', 'Oft',
      'Manchmal', 'Heute', 'Gestern', 'Morgen', 'Hier', 'Dort', 'Jetzt', 'Dann', 'Damals',
      'Vielleicht', 'Bestimmt', 'Sicher', 'Wahrscheinlich', 'Wirklich', 'Eigentlich',
      // Common nouns (often falsely detected as names)
      'Mensch', 'Menschen', 'Person', 'Personen', 'Mann', 'Frau', 'Kind', 'Kinder',
      'Leute', 'Familie', 'Eltern', 'Mutter', 'Vater', 'Schwester', 'Bruder',
      'Freund', 'Freunde', 'Freundin', 'Kollege', 'Kollegin', 'Chef', 'Chefin',
      'Arbeit', 'Beruf', 'Job', 'Stelle', 'Unternehmen', 'Firma', 'Büro',
      'Leben', 'Zeit', 'Jahr', 'Jahre', 'Monat', 'Monate', 'Woche', 'Wochen', 'Tag', 'Tage',
      'Welt', 'Land', 'Stadt', 'Haus', 'Wohnung', 'Zimmer',
      'Problem', 'Probleme', 'Lösung', 'Lösungen', 'Frage', 'Fragen', 'Antwort', 'Antworten',
      'Aufgabe', 'Aufgaben', 'Ziel', 'Ziele', 'Plan', 'Pläne',
      'Stärke', 'Stärken', 'Schwäche', 'Schwächen', 'Fähigkeit', 'Fähigkeiten',
      'Erfahrung', 'Erfahrungen', 'Wissen', 'Können', 'Kompetenz', 'Kompetenzen',
      'Interesse', 'Interessen', 'Hobby', 'Hobbys',
      'Gefühl', 'Gefühle', 'Emotion', 'Emotionen', 'Angst', 'Freude', 'Trauer',
      'Geld', 'Euro', 'Dollar', 'Kosten', 'Preis', 'Gehalt',
      'Recht', 'Rechte', 'Gesetz', 'Gesetze', 'Regel', 'Regeln',
      'Schule', 'Uni', 'Universität', 'Ausbildung', 'Studium',
      'Gesundheit', 'Krankheit', 'Arzt', 'Ärztin', 'Krankenhaus',
      'Hilfe', 'Unterstützung', 'Beratung', 'Therapie',
      // Possessive/demonstrative pronouns
      'Meine', 'Mein', 'Deine', 'Dein', 'Seine', 'Sein', 'Ihre', 'Ihr', 'Unsere', 'Unser',
      'Diese', 'Dieser', 'Dieses', 'Jene', 'Jener', 'Jenes', 'Welche', 'Welcher', 'Welches',
      // Common adjectives (capitalized in titles/headings)
      'Neue', 'Neuer', 'Neues', 'Alte', 'Alter', 'Altes', 'Große', 'Großer', 'Großes',
      'Kleine', 'Kleiner', 'Kleines', 'Gute', 'Guter', 'Gutes', 'Schlechte', 'Schlechter',
      'Wichtige', 'Wichtiger', 'Wichtiges', 'Richtige', 'Richtiger', 'Richtiges',
      // Verbs (nominalized - common in German)
      'Arbeiten', 'Leben', 'Lernen', 'Denken', 'Fühlen', 'Sprechen', 'Hören', 'Sehen',
      'Gehen', 'Kommen', 'Machen', 'Tun', 'Sein', 'Haben', 'Werden', 'Können', 'Müssen',
      // Common sentence starters
      'Danke', 'Bitte', 'Natürlich', 'Klar', 'Okay', 'Genau', 'Richtig',
      // Social work specific terms
      'Betreuung', 'Sozialarbeiter', 'Sozialarbeiterin', 'Betreuer', 'Betreuerin',
      'Klient', 'Klientin', 'Klienten', 'Jugendamt', 'Jobcenter',
      'Termin', 'Termine', 'Gespräch', 'Gespräche', 'Sitzung', 'Sitzungen',
    ])

    const words = text.split(/\s+/)
    
    // Check if any word is in the common words set
    for (const word of words) {
      if (commonWords.has(word)) {
        return false
      }
    }

    // Additional heuristic: if the text contains only single capitalized words
    // without typical name structure, it's likely not a name
    if (words.length === 2) {
      // Check for possessive pronoun + noun pattern (e.g., "Ihre Aufgaben")
      const possessivePronouns = ['Meine', 'Deine', 'Seine', 'Ihre', 'Unsere', 'Eure']
      if (possessivePronouns.includes(words[0])) {
        return false
      }
    }

    return true
  }
}

export function createPIIRedactionService(): PIIRedactionService {
  return new PIIRedactionService()
}
