/**
 * AI-First File Type Classifier
 * Analyzes transcripts to suggest the appropriate file type
 * Based on duration, speaker count, content patterns
 */

import { FilePurpose, TranscriptSegment } from '@/lib/types/database'

export interface ClassificationResult {
  suggestedType: FilePurpose
  confidence: number
  reason: string
}

interface ClassificationFeatures {
  duration: number
  speakerCount: number
  wordCount: number
  firstWords: string
  hasQuestions: boolean
  hasImperatives: boolean
  hasDescriptive: boolean
}

export class FileTypeClassifier {
  
  /**
   * Classify a transcript based on its features
   */
  classify(segments: TranscriptSegment[], duration: number): ClassificationResult {
    const features = this.extractFeatures(segments, duration)
    
    // Rule-based classification (can be replaced with LLM later)
    return this.ruleBasedClassification(features)
  }

  private extractFeatures(segments: TranscriptSegment[], duration: number): ClassificationFeatures {
    const fullText = segments.map(s => s.text).join(' ')
    const speakers = new Set(segments.map(s => s.speaker)).size
    const words = fullText.split(/\s+/).filter(w => w.length > 0)
    const firstWords = words.slice(0, 50).join(' ').toLowerCase()

    return {
      duration,
      speakerCount: speakers,
      wordCount: words.length,
      firstWords,
      hasQuestions: /\?|frage|wie|was|wer|wo|warum|wann/i.test(fullText),
      hasImperatives: /bitte|soll|muss|wichtig|erledigen|kontakt|senden|anrufen|schreiben/i.test(fullText),
      hasDescriptive: /teilnehmer|agenda|hintergrund|kontext|situation|thema/i.test(firstWords),
    }
  }

  private ruleBasedClassification(features: ClassificationFeatures): ClassificationResult {
    // Rule 1: Multiple speakers + long duration = Meeting
    if (features.speakerCount >= 2 && features.duration >= 180) {
      return {
        suggestedType: 'meeting',
        confidence: 0.95,
        reason: `${features.speakerCount} Sprecher, ${Math.round(features.duration / 60)} Minuten - typisches Gespräch`,
      }
    }

    // Rule 2: Short + descriptive words at start = Context
    if (features.duration < 300 && features.hasDescriptive && features.speakerCount === 1) {
      return {
        suggestedType: 'context',
        confidence: 0.85,
        reason: 'Kurz, beschreibende Sprache am Anfang (Teilnehmer, Agenda, etc.)',
      }
    }

    // Rule 3: Very short + imperatives = Instructions
    if (features.duration < 180 && features.hasImperatives && features.speakerCount === 1) {
      return {
        suggestedType: 'dictation',
        confidence: 0.80,
        reason: 'Kurz, enthält Anweisungen oder Aufgaben',
      }
    }

    // Rule 4: Very short (< 2 min) + single speaker = Private notes/dictation
    if (features.duration < 120 && features.speakerCount === 1) {
      return {
        suggestedType: 'dictation',
        confidence: 0.75,
        reason: 'Sehr kurz, einzelner Sprecher - wahrscheinlich Notizen',
      }
    }

    // Rule 5: Single speaker + long (5-30 min) = Could be context or dictation
    if (features.speakerCount === 1 && features.duration >= 300 && features.duration < 1800) {
      if (features.hasDescriptive) {
        return {
          suggestedType: 'context',
          confidence: 0.70,
          reason: 'Einzelner Sprecher, mittlere Länge, beschreibende Sprache',
        }
      }
      return {
        suggestedType: 'dictation',
        confidence: 0.65,
        reason: 'Einzelner Sprecher, mittlere Länge - vermutlich Diktat',
      }
    }

    // Rule 6: Multiple speakers but short = Meeting
    if (features.speakerCount >= 2) {
      return {
        suggestedType: 'meeting',
        confidence: 0.90,
        reason: `${features.speakerCount} Sprecher - Gespräch erkannt`,
      }
    }

    // Default: Meeting (safest default)
    return {
      suggestedType: 'meeting',
      confidence: 0.60,
      reason: 'Standard-Klassifizierung - kann manuell angepasst werden',
    }
  }

  /**
   * Get human-readable label for file type
   */
  getTypeLabel(type: FilePurpose): string {
    const labels: Record<FilePurpose, string> = {
      meeting: '💬 Gespräch / Meeting',
      context: '📝 Kontext / Hintergrund',
      dictation: '🎙️ Diktat / Notizen',
      instruction: '📋 Anweisungen',
      addition: '➕ Ergänzung',
    }
    return labels[type] || type
  }
}

export const fileTypeClassifier = new FileTypeClassifier()
