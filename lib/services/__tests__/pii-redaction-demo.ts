/**
 * PII Redaction Improvements Demonstration
 * 
 * Run with: npx ts-node --esm lib/services/__tests__/pii-redaction-demo.ts
 * (or just review the test cases to see the improvements)
 */

import { createPIIRedactionService } from '../pii-redaction'
import { TranscriptSegment } from '@/lib/types/database'

const service = createPIIRedactionService()

console.log('='.repeat(80))
console.log('PII REDACTION IMPROVEMENTS - DEMONSTRATION')
console.log('='.repeat(80))

// Test Case 1: Common German words that were INCORRECTLY redacted before
console.log('\n📋 TEST 1: Common German words (should NOT be redacted)')
console.log('-'.repeat(80))

const test1: TranscriptSegment[] = [
  {
    start_ms: 0,
    end_ms: 5000,
    speaker: 'S1',
    text: 'Jeder Mensch hat Stärken und Schwächen. Ihre Aufgaben sind wichtig.',
    confidence: 0.95,
  },
]

const result1 = service.redact(test1)
console.log('Original: ', test1[0].text)
console.log('Redacted: ', result1.redactedText)
console.log('✅ Should contain: Mensch, Stärken, Schwächen, Ihre Aufgaben')
console.log('PII hits:', result1.piiHits.length, '(should be 0)')

// Test Case 2: Possessive pronouns + nouns
console.log('\n📋 TEST 2: Possessive pronouns (should NOT be redacted)')
console.log('-'.repeat(80))

const test2: TranscriptSegment[] = [
  {
    start_ms: 0,
    end_ms: 5000,
    speaker: 'S1',
    text: 'Meine Stärken sind Empathie und Kommunikation. Deine Schwächen können verbessert werden.',
    confidence: 0.95,
  },
]

const result2 = service.redact(test2)
console.log('Original: ', test2[0].text)
console.log('Redacted: ', result2.redactedText)
console.log('✅ Should contain: Meine Stärken, Deine Schwächen')
console.log('PII hits:', result2.piiHits.length, '(should be 0)')

// Test Case 3: Social work terminology
console.log('\n📋 TEST 3: Social work terms (should NOT be redacted)')
console.log('-'.repeat(80))

const test3: TranscriptSegment[] = [
  {
    start_ms: 0,
    end_ms: 5000,
    speaker: 'S1',
    text: 'Der Sozialarbeiter half beim Termin. Die Betreuung durch das Jugendamt läuft gut.',
    confidence: 0.95,
  },
]

const result3 = service.redact(test3)
console.log('Original: ', test3[0].text)
console.log('Redacted: ', result3.redactedText)
console.log('✅ Should contain: Sozialarbeiter, Jugendamt, Betreuung')
console.log('PII hits:', result3.piiHits.length, '(should be 0)')

// Test Case 4: Actual names SHOULD be redacted
console.log('\n📋 TEST 4: Real names (SHOULD be redacted)')
console.log('-'.repeat(80))

const test4: TranscriptSegment[] = [
  {
    start_ms: 0,
    end_ms: 5000,
    speaker: 'S1',
    text: 'Ich habe mit Maria Schmidt und Thomas Meyer gesprochen. Herr Müller kommt später.',
    confidence: 0.95,
  },
]

const result4 = service.redact(test4)
console.log('Original: ', test4[0].text)
console.log('Redacted: ', result4.redactedText)
console.log('❌ Should NOT contain: Maria Schmidt, Thomas Meyer, Müller')
console.log('✅ Should contain: [NAME_X] placeholders')
console.log('PII hits:', result4.piiHits.length, '(should be 3)')

// Test Case 5: Context-based name detection
console.log('\n📋 TEST 5: Context-based name detection (SHOULD be redacted)')
console.log('-'.repeat(80))

const test5: TranscriptSegment[] = [
  {
    start_ms: 0,
    end_ms: 5000,
    speaker: 'S1',
    text: 'Ich bin Anna Weber. Mein Name ist Peter Schulz. Ich arbeite mit Maria Koch zusammen.',
    confidence: 0.95,
  },
]

const result5 = service.redact(test5)
console.log('Original: ', test5[0].text)
console.log('Redacted: ', result5.redactedText)
console.log('❌ Should NOT contain: Anna Weber, Peter Schulz, Maria Koch')
console.log('✅ Should detect "Ich bin", "Mein Name ist", "mit" contexts')
console.log('PII hits:', result5.piiHits.length, '(should be 3)')

// Test Case 6: Other PII types still work
console.log('\n📋 TEST 6: Other PII types (emails, phones, dates)')
console.log('-'.repeat(80))

const test6: TranscriptSegment[] = [
  {
    start_ms: 0,
    end_ms: 5000,
    speaker: 'S1',
    text: 'Kontakt: test@beispiel.de, Tel: 0171 1234567, Termin am 15.03.2024',
    confidence: 0.95,
  },
]

const result6 = service.redact(test6)
console.log('Original: ', test6[0].text)
console.log('Redacted: ', result6.redactedText)
console.log('❌ Should NOT contain: test@beispiel.de, 0171 1234567, 15.03.2024')
console.log('✅ Should contain: [EMAIL_1], [PHONE_1], [DATE_1]')
console.log('PII hits:', result6.piiHits.length, '(should be 3)')

// Test Case 7: Complex real-world scenario
console.log('\n📋 TEST 7: Complex real-world scenario (mixed content)')
console.log('-'.repeat(80))

const test7: TranscriptSegment[] = [
  {
    start_ms: 0,
    end_ms: 10000,
    speaker: 'S1',
    text: 'Ich bin Frau Meier und arbeite als Sozialarbeiterin. Ihre Aufgaben und Stärken sind sehr wichtig für den Menschen. Erreichen Sie mich unter kontakt@beispiel.de oder 030 12345678. Der Termin ist am 20.05.2024.',
    confidence: 0.95,
  },
]

const result7 = service.redact(test7)
console.log('Original: ', test7[0].text)
console.log('Redacted: ', result7.redactedText)
console.log('\n✅ Should contain (NOT redacted):')
console.log('   - Sozialarbeiterin')
console.log('   - Ihre Aufgaben')
console.log('   - Stärken')
console.log('   - Menschen')
console.log('\n❌ Should NOT contain (redacted):')
console.log('   - Frau Meier')
console.log('   - kontakt@beispiel.de')
console.log('   - 030 12345678')
console.log('   - 20.05.2024')
console.log('\nPII hits:', result7.piiHits.length, '(should be 4)')
console.log('Types:', result7.piiHits.map(h => h.type).join(', '))

console.log('\n' + '='.repeat(80))
console.log('✅ IMPROVEMENTS SUMMARY')
console.log('='.repeat(80))
console.log('1. ✅ 70+ common German words now excluded from name detection')
console.log('2. ✅ Social work terminology preserved (Sozialarbeiter, Jugendamt, etc.)')
console.log('3. ✅ Possessive pronoun patterns detected (Ihre Aufgaben, Meine Stärken)')
console.log('4. ✅ Context-based name detection (Ich bin, Mein Name ist, etc.)')
console.log('5. ✅ Names with titles still detected (Herr/Frau/Dr./Prof.)')
console.log('6. ✅ Other PII types unaffected (emails, phones, dates, addresses)')
console.log('='.repeat(80))
