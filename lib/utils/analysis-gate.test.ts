import { describe, expect, it } from 'vitest'
import {
  applyListenerTranscriptAdjustments,
  buildTranscriptSample,
  hasConfirmedOwnerRole,
  isListenerOwnerRole,
  resolveAutoOwnerContext,
  uniqueSpeakerLabels,
} from './analysis-gate'

describe('hasConfirmedOwnerRole', () => {
  it('requires a non-empty role', () => {
    expect(hasConfirmedOwnerRole(null)).toBe(false)
    expect(hasConfirmedOwnerRole({ source: 'dismissed' })).toBe(false)
    expect(hasConfirmedOwnerRole({ role: 'observer', source: 'dismissed' })).toBe(true)
    expect(hasConfirmedOwnerRole({ role: '  ', speakerId: 'S1' })).toBe(false)
  })
})

describe('isListenerOwnerRole', () => {
  it('treats observer / listener / recipient as listener', () => {
    expect(isListenerOwnerRole({ role: 'observer', speakerId: null })).toBe(true)
    expect(isListenerOwnerRole({ role: 'Nur Zuhörer' })).toBe(true)
    expect(isListenerOwnerRole({
      role: 'Recipient/respondent, possibly a project partner or colleague',
      speakerId: 'S4',
    })).toBe(true)
    expect(isListenerOwnerRole({ source: 'not_speaker', role: 'observer' })).toBe(true)
  })

  it('does not treat active speaking roles as listener', () => {
    expect(isListenerOwnerRole({ role: 'interviewer', speakerId: 'S1' })).toBe(false)
    expect(isListenerOwnerRole({ role: 'speaker', speakerId: 'S2' })).toBe(false)
  })
})

describe('resolveAutoOwnerContext', () => {
  it('does nothing when a role is already set', () => {
    expect(resolveAutoOwnerContext({
      ownerContext: { role: 'interviewer' },
      speakers: ['S1'],
    })).toBeNull()
  })

  it('sets observer when the owner is not a speaker', () => {
    const ctx = resolveAutoOwnerContext({ userIsSpeaker: false, speakers: ['S1', 'S2'] })
    expect(ctx?.role).toBe('observer')
    expect(ctx?.speakerId).toBeNull()
    expect(ctx?.source).toBe('not_speaker')
  })

  it('sets speaker for a single-speaker recording', () => {
    const ctx = resolveAutoOwnerContext({ speakers: ['S1'], userIsSpeaker: true })
    expect(ctx?.role).toBe('speaker')
    expect(ctx?.speakerId).toBe('S1')
    expect(ctx?.source).toBe('auto')
  })

  it('holds multi-speaker recordings for a user role', () => {
    expect(resolveAutoOwnerContext({ speakers: ['S1', 'S2'], userIsSpeaker: true })).toBeNull()
  })
})

describe('applyListenerTranscriptAdjustments', () => {
  it('removes the owner name from speaker maps', () => {
    const next = applyListenerTranscriptAdjustments({
      speaker_name_map: { S4: 'Christian Kruppa', S2: 'Partner' },
      name_corrections: { S4: 'Christian Kruppa' },
    }, 'Christian Kruppa')
    expect(next.speaker_name_map).toEqual({ S2: 'Partner' })
    expect(next.name_corrections).toEqual({ S2: 'Partner' })
  })
})

describe('buildTranscriptSample', () => {
  it('sends every segment when the transcript fits', () => {
    const segs = [
      { speaker: 'S2', text: 'Zu viel Aufwand.' },
      { speaker: 'S4', text: 'Okay.' },
      { speaker: 'S2', text: 'Der Bürgermeister nimmt das in die Sitzung.' },
    ]
    const sample = buildTranscriptSample(segs, (s) => `${s.speaker}: ${s.text}`)
    expect(sample).toContain('Bürgermeister')
    expect(sample).toContain('S4: Okay.')
  })

  it('does not collapse short transcripts to the first line', () => {
    const segs = Array.from({ length: 9 }, (_, i) => ({
      speaker: i === 0 ? 'S2' : 'S4',
      text: i === 0 ? 'Nur der erste Satz.' : `Inhalt ${i} mit genug Text um sichtbar zu bleiben.`,
    }))
    const sample = buildTranscriptSample(segs, (s) => `${s.speaker}: ${s.text}`)
    expect(sample).toContain('Nur der erste Satz.')
    expect(sample).toContain('Inhalt 8')
  })
})

describe('uniqueSpeakerLabels', () => {
  it('skips call notes and blanks', () => {
    expect(uniqueSpeakerLabels([
      { speaker: 'S2' },
      { speaker: 'S2' },
      { speaker: 'S4' },
      { speaker: 'Note', isCallNote: true },
      { speaker: '' },
    ])).toEqual(['S2', 'S4'])
  })
})
