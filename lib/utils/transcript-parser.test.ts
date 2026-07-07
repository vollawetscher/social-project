import { describe, expect, it } from 'vitest'
import { parseTranscriptFile } from './transcript-parser'

describe('parseTranscriptFile VTT', () => {
  it('parses standard WebVTT cues', () => {
    const vtt = `WEBVTT

00:00:00.000 --> 00:00:02.500
Hello world

00:00:02.500 --> 00:00:05.000
Second line`

    const { segments } = parseTranscriptFile(vtt, 'captions.vtt')
    expect(segments).toHaveLength(2)
    expect(segments[0]).toMatchObject({
      start_ms: 0,
      end_ms: 2500,
      text: 'Hello world',
    })
    expect(segments[1]).toMatchObject({
      start_ms: 2500,
      end_ms: 5000,
      text: 'Second line',
    })
  })

  it('parses short MM:SS timestamps', () => {
    const vtt = `WEBVTT

00:05.000 --> 00:10.000
Short timestamp format`

    const { segments } = parseTranscriptFile(vtt, 'short.vtt')
    expect(segments).toHaveLength(1)
    expect(segments[0].start_ms).toBe(5000)
    expect(segments[0].end_ms).toBe(10000)
  })

  it('parses Teams-style speaker blocks with single-digit hours', () => {
    const vtt = `WEBVTT

Michael Westphal
0:00:12.340 --> 0:00:18.560
Guten Tag zusammen.

Alisa Mulic
0:00:18.560 --> 0:00:24.100
Danke, hallo.`

    const { segments } = parseTranscriptFile(vtt, 'teams.vtt')
    expect(segments).toHaveLength(2)
    expect(segments[0]).toMatchObject({
      start_ms: 12340,
      end_ms: 18560,
      speaker: 'Michael Westphal',
      text: 'Guten Tag zusammen.',
    })
    expect(segments[1]).toMatchObject({
      speaker: 'Alisa Mulic',
      text: 'Danke, hallo.',
    })
  })

  it('parses cue IDs, voice tags, and cue settings', () => {
    const vtt = `WEBVTT

cue-1
00:00:00.000 --> 00:00:03.000 align:start
<v Karsten Milde>Karsten Milde: Willkommen.</v>

00:00:03.000 --> 00:00:06.000
S2: Danke.`

    const { segments } = parseTranscriptFile(vtt, 'tags.vtt')
    expect(segments).toHaveLength(2)
    expect(segments[0].text).toBe('Karsten Milde: Willkommen.')
    expect(segments[1]).toMatchObject({
      speaker: 'S2',
      text: 'Danke.',
    })
  })

  it('skips NOTE metadata blocks', () => {
    const vtt = `WEBVTT
Kind: captions
Language: de

NOTE This file was auto-generated

00:00:00.000 --> 00:00:02.000
Actual subtitle`

    const { segments } = parseTranscriptFile(vtt, 'meta.vtt')
    expect(segments).toHaveLength(1)
    expect(segments[0].text).toBe('Actual subtitle')
  })

  it('handles UTF-8 BOM prefix', () => {
    const vtt = `\uFEFFWEBVTT

00:00:00.000 --> 00:00:01.000
BOM test`

    const { segments } = parseTranscriptFile(vtt, 'bom.vtt')
    expect(segments).toHaveLength(1)
    expect(segments[0].text).toBe('BOM test')
  })

  it('parses LiveKit-style VTT with UUID cue ids and voice tags', () => {
    const vtt = `WEBVTT

f33a4a33-0db0-4930-af36-528b5542a96d/33-0
00:00:03.683 --> 00:00:04.083
<v Christian Kruppa>Ne?</v>

f33a4a33-0db0-4930-af36-528b5542a96d/40-0
00:00:08.483 --> 00:00:09.683
<v Thomas Bernhard>So, jetzt übers Set.</v>

f33a4a33-0db0-4930-af36-528b5542a96d/65-0
00:00:19.443 --> 00:00:20.483
<v Jonas de Laporte>Ja, bei mir steht auch.</v>`

    const { segments } = parseTranscriptFile(vtt, 'livekit.vtt')
    expect(segments).toHaveLength(3)
    expect(segments[0]).toMatchObject({
      start_ms: 3683,
      end_ms: 4083,
      speaker: 'Christian Kruppa',
      text: 'Ne?',
    })
    expect(segments[1]).toMatchObject({
      speaker: 'Thomas Bernhard',
      text: 'So, jetzt übers Set.',
    })
    expect(segments[2]).toMatchObject({
      speaker: 'Jonas de Laporte',
      text: 'Ja, bei mir steht auch.',
    })
  })
})
