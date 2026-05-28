import { describe, expect, it } from 'vitest'
import {
  buildVoiceMessageSpeakerResolution,
  detectVoiceMessageAddresseeCorrections,
  parseVoiceMessageVisitorName,
  resolveVoiceMessageContext,
} from './voice-message'

describe('parseVoiceMessageVisitorName', () => {
  it('reads visitor name from context_note', () => {
    expect(
      parseVoiceMessageVisitorName({
        context_note: 'Voice message from Maria Schmidt\nEmail: maria@example.com',
      })
    ).toBe('Maria Schmidt')
  })

  it('falls back to internal_case_id', () => {
    expect(
      parseVoiceMessageVisitorName({
        internal_case_id: 'Voice message from Test User',
      })
    ).toBe('Test User')
  })
})

describe('buildVoiceMessageSpeakerResolution', () => {
  it('maps S1 to the visitor and marks the owner as recipient', () => {
    const resolution = buildVoiceMessageSpeakerResolution(
      [{ speaker: 'S1', text: 'Hallo, Herr Kruppa' }],
      'Maria Schmidt',
      'Thomas Kruppa'
    )

    expect(resolution?.nameMap).toEqual({ S1: 'Maria Schmidt' })
    expect(resolution?.participants).toEqual([
      { name: 'Maria Schmidt', role: 'sender', isUser: false },
      { name: 'Thomas Kruppa', role: 'recipient', isUser: true },
    ])
  })
})

describe('detectVoiceMessageAddresseeCorrections', () => {
  it('corrects a misheard recipient surname in the opening salutation', () => {
    expect(
      detectVoiceMessageAddresseeCorrections(
        [{ text: 'Hallo, Herr Gruber, ich wollte Ihnen kurz eine Nachricht schicken.' }],
        'Thomas Kruppa'
      )
    ).toEqual({ 'Herr Gruber': 'Herr Kruppa' })
  })

  it('does not change a salutation that already matches the owner', () => {
    expect(
      detectVoiceMessageAddresseeCorrections(
        [{ text: 'Hallo, Herr Kruppa, kurze Nachricht.' }],
        'Thomas Kruppa'
      )
    ).toEqual({})
  })
})

describe('resolveVoiceMessageContext', () => {
  it('combines visitor speaker mapping and addressee correction', () => {
    const context = resolveVoiceMessageContext({
      segments: [{ speaker: 'S1', text: 'Hallo, Herr Gruber, ich melde mich wegen des Updates.' }],
      session: { context_note: 'Voice message from Test Visitor' },
      userName: 'Thomas Kruppa',
    })

    expect(context.visitorName).toBe('Test Visitor')
    expect(context.speakerResolution?.nameMap.S1).toBe('Test Visitor')
    expect(context.addresseeCorrections).toEqual({ 'Herr Gruber': 'Herr Kruppa' })
  })
})
