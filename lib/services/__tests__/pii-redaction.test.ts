import { createPIIRedactionService } from '../pii-redaction'
import { TranscriptSegment } from '@/lib/types/database'

describe('PIIRedactionService - German Language Improvements', () => {
  const service = createPIIRedactionService()

  describe('Common German words should NOT be redacted', () => {
    it('should not redact "Mensch" and "Menschen"', () => {
      const segments: TranscriptSegment[] = [
        {
          start_ms: 0,
          end_ms: 1000,
          speaker: 'S1',
          text: 'Jeder Mensch hat Stärken und Schwächen.',
          confidence: 0.95,
        },
      ]

      const result = service.redact(segments)
      
      expect(result.redactedText).toBe('Jeder Mensch hat Stärken und Schwächen.')
      expect(result.piiHits).toHaveLength(0)
    })

    it('should not redact "Ihre Aufgaben"', () => {
      const segments: TranscriptSegment[] = [
        {
          start_ms: 0,
          end_ms: 1000,
          speaker: 'S1',
          text: 'Ihre Aufgaben sind sehr wichtig.',
          confidence: 0.95,
        },
      ]

      const result = service.redact(segments)
      
      expect(result.redactedText).toBe('Ihre Aufgaben sind sehr wichtig.')
      expect(result.piiHits).toHaveLength(0)
    })

    it('should not redact common possessive + noun patterns', () => {
      const segments: TranscriptSegment[] = [
        {
          start_ms: 0,
          end_ms: 1000,
          speaker: 'S1',
          text: 'Meine Stärken sind Kommunikation und Empathie. Deine Schwächen können verbessert werden.',
          confidence: 0.95,
        },
      ]

      const result = service.redact(segments)
      
      expect(result.redactedText).toContain('Meine Stärken')
      expect(result.redactedText).toContain('Deine Schwächen')
      expect(result.piiHits).toHaveLength(0)
    })

    it('should not redact social work terminology', () => {
      const segments: TranscriptSegment[] = [
        {
          start_ms: 0,
          end_ms: 1000,
          speaker: 'S1',
          text: 'Die Betreuung durch den Sozialarbeiter war hilfreich. Der Termin beim Jobcenter ist nächste Woche.',
          confidence: 0.95,
        },
      ]

      const result = service.redact(segments)
      
      expect(result.redactedText).toContain('Sozialarbeiter')
      expect(result.redactedText).toContain('Jobcenter')
      expect(result.piiHits).toHaveLength(0)
    })
  })

  describe('Actual names SHOULD still be redacted', () => {
    it('should redact full names', () => {
      const segments: TranscriptSegment[] = [
        {
          start_ms: 0,
          end_ms: 1000,
          speaker: 'S1',
          text: 'Ich habe mit Maria Schmidt gesprochen.',
          confidence: 0.95,
        },
      ]

      const result = service.redact(segments)
      
      expect(result.redactedText).not.toContain('Maria Schmidt')
      expect(result.redactedText).toContain('[NAME_')
      expect(result.piiHits).toHaveLength(1)
      expect(result.piiHits[0].type).toBe('name')
    })

    it('should redact names with titles', () => {
      const segments: TranscriptSegment[] = [
        {
          start_ms: 0,
          end_ms: 1000,
          speaker: 'S1',
          text: 'Herr Müller und Frau Wagner sind heute nicht da. Dr. Schmidt kommt später.',
          confidence: 0.95,
        },
      ]

      const result = service.redact(segments)
      
      expect(result.redactedText).not.toContain('Müller')
      expect(result.redactedText).not.toContain('Wagner')
      expect(result.redactedText).not.toContain('Schmidt')
      expect(result.piiHits.length).toBeGreaterThanOrEqual(3)
    })

    it('should redact names introduced with context', () => {
      const segments: TranscriptSegment[] = [
        {
          start_ms: 0,
          end_ms: 1000,
          speaker: 'S1',
          text: 'Ich bin Thomas Meyer. Mein Name ist Anna Weber.',
          confidence: 0.95,
        },
      ]

      const result = service.redact(segments)
      
      expect(result.redactedText).not.toContain('Thomas Meyer')
      expect(result.redactedText).not.toContain('Anna Weber')
      expect(result.redactedText).toContain('Ich bin [NAME_')
      expect(result.redactedText).toContain('Mein Name ist [NAME_')
      expect(result.piiHits.length).toBeGreaterThanOrEqual(2)
    })

    it('should redact names with prepositions', () => {
      const segments: TranscriptSegment[] = [
        {
          start_ms: 0,
          end_ms: 1000,
          speaker: 'S1',
          text: 'Ich arbeite mit Peter Schulz zusammen. Das ist für Maria Koch.',
          confidence: 0.95,
        },
      ]

      const result = service.redact(segments)
      
      expect(result.redactedText).not.toContain('Peter Schulz')
      expect(result.redactedText).not.toContain('Maria Koch')
      expect(result.piiHits.length).toBeGreaterThanOrEqual(2)
    })
  })

  describe('Other PII types still work', () => {
    it('should redact email addresses', () => {
      const segments: TranscriptSegment[] = [
        {
          start_ms: 0,
          end_ms: 1000,
          speaker: 'S1',
          text: 'Meine E-Mail ist test@example.com',
          confidence: 0.95,
        },
      ]

      const result = service.redact(segments)
      
      expect(result.redactedText).not.toContain('test@example.com')
      expect(result.redactedText).toContain('[EMAIL_')
      expect(result.piiHits).toHaveLength(1)
      expect(result.piiHits[0].type).toBe('email')
    })

    it('should redact phone numbers', () => {
      const segments: TranscriptSegment[] = [
        {
          start_ms: 0,
          end_ms: 1000,
          speaker: 'S1',
          text: 'Rufen Sie mich an: 0171 1234567',
          confidence: 0.95,
        },
      ]

      const result = service.redact(segments)
      
      expect(result.redactedText).not.toContain('0171 1234567')
      expect(result.redactedText).toContain('[PHONE_')
      expect(result.piiHits).toHaveLength(1)
      expect(result.piiHits[0].type).toBe('phone')
    })

    it('should redact dates', () => {
      const segments: TranscriptSegment[] = [
        {
          start_ms: 0,
          end_ms: 1000,
          speaker: 'S1',
          text: 'Der Termin ist am 15.03.2024',
          confidence: 0.95,
        },
      ]

      const result = service.redact(segments)
      
      expect(result.redactedText).not.toContain('15.03.2024')
      expect(result.redactedText).toContain('[DATE_')
      expect(result.piiHits).toHaveLength(1)
      expect(result.piiHits[0].type).toBe('date')
    })
  })

  describe('Complex real-world scenarios', () => {
    it('should handle mixed content correctly', () => {
      const segments: TranscriptSegment[] = [
        {
          start_ms: 0,
          end_ms: 5000,
          speaker: 'S1',
          text: 'Ich bin Frau Meier und arbeite als Sozialarbeiterin. Ihre Aufgaben und Stärken sind sehr wichtig für den Menschen. Meine E-Mail ist kontakt@beispiel.de und ich bin unter 030 12345678 erreichbar.',
          confidence: 0.95,
        },
      ]

      const result = service.redact(segments)
      
      // Should NOT redact these common words
      expect(result.redactedText).toContain('Sozialarbeiterin')
      expect(result.redactedText).toContain('Ihre Aufgaben')
      expect(result.redactedText).toContain('Stärken')
      expect(result.redactedText).toContain('Menschen')
      
      // SHOULD redact these
      expect(result.redactedText).not.toContain('Frau Meier')
      expect(result.redactedText).not.toContain('kontakt@beispiel.de')
      expect(result.redactedText).not.toContain('030 12345678')
      
      expect(result.redactedText).toContain('[NAME_')
      expect(result.redactedText).toContain('[EMAIL_')
      expect(result.redactedText).toContain('[PHONE_')
    })
  })
})
