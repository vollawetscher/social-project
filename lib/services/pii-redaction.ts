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
    /\b[A-ZÄÖÜ][a-zäöüß]+\s+[A-ZÄÖÜ][a-zäöüß]+\b/g,
    /\b(?:Herr|Frau|Dr\.|Prof\.)\s+[A-ZÄÖÜ][a-zäöüß]+(?:\s+[A-ZÄÖÜ][a-zäöüß]+)?\b/g,
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
    for (const pattern of this.namePatterns) {
      result = result.replace(pattern, (match) => {
        if (this.isLikelyName(match)) {
          this.nameCounter++
          const placeholder = `[NAME_${this.nameCounter}]`
          piiHits.push({
            type: 'name',
            placeholder,
            original_hash: this.hashValue(match),
            start_ms: startMs,
            end_ms: endMs,
          })
          return placeholder
        }
        return match
      })
    }
    return result
  }

  private isLikelyName(text: string): boolean {
    const commonWords = [
      'Die', 'Der', 'Das', 'Ein', 'Eine', 'Und', 'Oder', 'Aber',
      'Auch', 'Nur', 'Noch', 'Schon', 'Sehr', 'Mehr', 'Weniger',
    ]

    const words = text.split(/\s+/)
    for (const word of words) {
      if (commonWords.includes(word)) {
        return false
      }
    }

    return true
  }
}

export function createPIIRedactionService(): PIIRedactionService {
  return new PIIRedactionService()
}
