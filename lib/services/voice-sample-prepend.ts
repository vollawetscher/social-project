import { execFile } from 'child_process'
import { writeFile, unlink, mkdtemp, readFile } from 'fs/promises'
import { tmpdir } from 'os'
import { join } from 'path'
import { promisify } from 'util'

const execFileAsync = promisify(execFile)

let ffmpegPath: string | null = null
try {
  ffmpegPath = require('ffmpeg-static') as string
  console.log('[VoiceSamplePrepend] ffmpeg-static resolved to:', ffmpegPath)
} catch (e) {
  console.warn('[VoiceSamplePrepend] ffmpeg-static not available:', (e as Error)?.message)
}

export async function prependVoiceSample(
  voiceSampleBuffer: Buffer,
  voiceSampleMime: string,
  callAudioBuffer: Buffer,
  callAudioMime: string,
): Promise<{ buffer: Buffer; mimeType: string } | null> {
  if (!ffmpegPath) {
    console.warn('[VoiceSamplePrepend] ffmpeg-static not available, skipping prepend')
    return null
  }

  const dir = await mkdtemp(join(tmpdir(), 'voice-prepend-'))
  const sampleExt = mimeToExt(voiceSampleMime)
  const callExt = mimeToExt(callAudioMime)
  const sampleFile = join(dir, `sample.${sampleExt}`)
  const callFile = join(dir, `call.${callExt}`)
  const concatList = join(dir, 'concat.txt')
  const outputFile = join(dir, 'output.ogg')

  try {
    await writeFile(sampleFile, voiceSampleBuffer)
    await writeFile(callFile, callAudioBuffer)

    await execFileAsync(ffmpegPath, [
      '-i', sampleFile,
      '-i', callFile,
      '-filter_complex', '[0:a][1:a]concat=n=2:v=0:a=1[a]',
      '-map', '[a]',
      '-c:a', 'libopus',
      '-b:a', '48k',
      '-y',
      outputFile,
    ], { timeout: 30_000 })

    const outputBuffer = await readFile(outputFile)
    return { buffer: outputBuffer, mimeType: 'audio/ogg' }
  } catch (err: any) {
    console.error('[VoiceSamplePrepend] FFmpeg concatenation failed:', err?.message || err)
    if (err?.stderr) console.error('[VoiceSamplePrepend] FFmpeg stderr:', err.stderr)
    if (err?.code) console.error('[VoiceSamplePrepend] FFmpeg exit code:', err.code)
    return null
  } finally {
    for (const f of [sampleFile, callFile, concatList, outputFile]) {
      await unlink(f).catch(() => {})
    }
    await unlink(dir).catch(() => {})
  }
}

export function offsetTranscriptSegments(
  segments: Array<{ start_ms: number; end_ms: number; speaker: string; text: string; confidence?: number }>,
  offsetMs: number,
): typeof segments {
  return segments
    .map((seg) => ({
      ...seg,
      start_ms: Math.max(0, seg.start_ms - offsetMs),
      end_ms: Math.max(0, seg.end_ms - offsetMs),
    }))
    .filter((seg) => seg.end_ms > 0)
}

export function identifyPrimedSpeaker(
  segments: Array<{ start_ms: number; end_ms: number; speaker: string; text: string }>,
  voiceSampleDurationMs: number,
): string | null {
  const speakerDurations: Record<string, number> = {}
  for (const seg of segments) {
    if (seg.start_ms >= voiceSampleDurationMs) break
    const dur = Math.min(seg.end_ms, voiceSampleDurationMs) - seg.start_ms
    if (dur > 0) {
      speakerDurations[seg.speaker] = (speakerDurations[seg.speaker] || 0) + dur
    }
  }

  let maxSpeaker: string | null = null
  let maxDuration = 0
  for (const [speaker, duration] of Object.entries(speakerDurations)) {
    if (duration > maxDuration) {
      maxSpeaker = speaker
      maxDuration = duration
    }
  }
  return maxSpeaker
}

function mimeToExt(mime: string): string {
  if (mime.includes('ogg')) return 'ogg'
  if (mime.includes('webm')) return 'webm'
  if (mime.includes('mp4') || mime.includes('m4a')) return 'mp4'
  if (mime.includes('mpeg') || mime.includes('mp3')) return 'mp3'
  if (mime.includes('wav')) return 'wav'
  return 'ogg'
}
