import { TranscriptSegment } from '@/lib/types/database'

export interface SpeechmaticsConfig {
  apiKey: string
}

export interface SpeechmaticsTranscript {
  segments: TranscriptSegment[]
  language: string
  fullText: string
}

export class SpeechmaticsService {
  private apiKey: string
  private baseUrl = 'https://asr.api.speechmatics.com/v2'

  constructor(config: SpeechmaticsConfig) {
    this.apiKey = config.apiKey
  }

  async transcribeAudio(audioBuffer: Buffer, mimeType: string): Promise<SpeechmaticsTranscript> {
    console.log('[Speechmatics] Starting transcription')
    console.log('[Speechmatics] Audio buffer size:', audioBuffer.length, 'bytes')
    console.log('[Speechmatics] MIME type:', mimeType)

    const formData = new FormData()

    const fileExtension = this.getFileExtensionFromMimeType(mimeType)
    console.log('[Speechmatics] Using file extension:', fileExtension)

    const audioBlob = new Blob([audioBuffer], { type: mimeType })
    formData.append('data_file', audioBlob, `audio.${fileExtension}`)

    const config = {
      type: 'transcription',
      transcription_config: {
        language: 'auto',
        operating_point: 'enhanced',
        diarization: 'speaker',
        enable_entities: true,
      },
    }

    formData.append('config', JSON.stringify(config))

    console.log('[Speechmatics] Sending request to:', `${this.baseUrl}/jobs`)
    let response
    try {
      response = await fetch(`${this.baseUrl}/jobs`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
        },
        body: formData,
      })

      console.log('[Speechmatics] Response status:', response.status)

      if (!response.ok) {
        const errorText = await response.text()
        console.error('[Speechmatics] API error response:', errorText)
        console.error('[Speechmatics] Status code:', response.status)
        console.error('[Speechmatics] File details - MIME:', mimeType, 'Extension:', fileExtension, 'Size:', audioBuffer.length)

        let errorMessage = `Speechmatics API error: ${response.status}`

        if (errorText.toLowerCase().includes('invalid audio')) {
          errorMessage = 'Die Audiodatei ist ungültig. Möglicherweise ist das Format nicht kompatibel oder die Aufnahme war zu kurz. Bitte versuchen Sie es erneut.'
        } else if (errorText.toLowerCase().includes('audio') && errorText.toLowerCase().includes('duration')) {
          errorMessage = 'Die Audiodatei ist ungültig oder zu kurz für die Transkription.'
        } else if (errorText.toLowerCase().includes('format') || errorText.toLowerCase().includes('codec')) {
          errorMessage = 'Das Audioformat wird nicht unterstützt oder die Datei ist beschädigt.'
        } else {
          errorMessage += ` - ${errorText}`
        }

        throw new Error(errorMessage)
      }

      const result = await response.json()
      const jobId = result.id
      console.log('[Speechmatics] Job created with ID:', jobId)

      const transcript = await this.pollJobStatus(jobId)
      return transcript
    } catch (error: any) {
      console.error('[Speechmatics] Fetch failed:', error.message, error.cause)
      throw new Error(`Failed to connect to Speechmatics API: ${error.message}`)
    }
  }

  private async pollJobStatus(jobId: string): Promise<SpeechmaticsTranscript> {
    const maxAttempts = 60
    const pollInterval = 10000

    console.log('[Speechmatics] Starting to poll job status, jobId:', jobId)
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      try {
        console.log(`[Speechmatics] Poll attempt ${attempt + 1}/${maxAttempts}`)
        const statusResponse = await fetch(`${this.baseUrl}/jobs/${jobId}`, {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
          },
        })

        if (!statusResponse.ok) {
          throw new Error(`Failed to get job status: ${statusResponse.status}`)
        }

        const status = await statusResponse.json()
        console.log('[Speechmatics] Job status:', status.job.status)

        if (status.job.status === 'done') {
          console.log('[Speechmatics] Job completed, fetching transcript')
          const transcriptResponse = await fetch(`${this.baseUrl}/jobs/${jobId}/transcript`, {
            headers: {
              'Authorization': `Bearer ${this.apiKey}`,
            },
          })

          if (!transcriptResponse.ok) {
            throw new Error(`Failed to get transcript: ${transcriptResponse.status}`)
          }

          const transcriptData = await transcriptResponse.json()
          console.log('[Speechmatics] Transcript retrieved successfully')
          return this.parseTranscript(transcriptData)
        }

        if (status.job.status === 'rejected' || status.job.status === 'failed') {
          const errorDetails = status.job.errors?.map((e: any) => e.message || e).join(', ') || status.job.status
          throw new Error(`Speechmatics job ${status.job.status}: ${errorDetails}`)
        }

        await new Promise((resolve) => setTimeout(resolve, pollInterval))
      } catch (error: any) {
        console.error('[Speechmatics] Poll error:', error.message)
        throw error
      }
    }

    throw new Error('Transcription job timeout')
  }

  private getFileExtensionFromMimeType(mimeType: string): string {
    const baseMimeType = mimeType.split(';')[0].toLowerCase().trim()

    const mimeMap: { [key: string]: string } = {
      'audio/mpeg': 'mp3',
      'audio/mp3': 'mp3',
      'audio/wav': 'wav',
      'audio/wave': 'wav',
      'audio/x-wav': 'wav',
      'audio/webm': 'webm',
      'audio/ogg': 'ogg',
      'audio/mp4': 'm4a',
      'audio/x-m4a': 'm4a',
      'audio/aac': 'aac',
      'audio/flac': 'flac',
    }

    const extension = mimeMap[baseMimeType]
    if (!extension) {
      console.warn('[Speechmatics] Unknown MIME type:', mimeType, '- defaulting to wav')
      return 'wav'
    }

    return extension
  }

  private parseTranscript(data: any): SpeechmaticsTranscript {
    const segments: TranscriptSegment[] = []
    let fullText = ''
    let currentSpeaker = ''
    let currentSegment: TranscriptSegment | null = null

    const results = data.results || []

    for (const result of results) {
      if (result.type === 'word') {
        const word = result.alternatives[0]
        const speaker = word.speaker || 'S1'
        const startMs = Math.floor(result.start_time * 1000)
        const endMs = Math.floor(result.end_time * 1000)

        if (currentSpeaker !== speaker || !currentSegment) {
          if (currentSegment) {
            segments.push(currentSegment)
          }

          currentSegment = {
            start_ms: startMs,
            end_ms: endMs,
            speaker: speaker,
            text: word.content,
            confidence: word.confidence,
          }
          currentSpeaker = speaker
        } else {
          // Add space before word
          currentSegment.text += ' ' + word.content
          currentSegment.end_ms = endMs
          if (word.confidence && currentSegment.confidence) {
            currentSegment.confidence = (currentSegment.confidence + word.confidence) / 2
          }
        }
      } else if (result.type === 'punctuation') {
        // Add punctuation directly to the current segment without space
        const punctuation = result.alternatives[0]
        if (currentSegment) {
          currentSegment.text += punctuation.content
          // Update end time if punctuation has timing
          if (result.end_time) {
            currentSegment.end_ms = Math.floor(result.end_time * 1000)
          }
        }
      }
    }

    if (currentSegment) {
      segments.push(currentSegment)
    }

    fullText = segments.map((s) => s.text).join(' ')

    const uniqueSpeakers = new Set(segments.map(s => s.speaker))
    const detectedLanguage = data.metadata?.language || 'en'
    console.log(`[Speechmatics] Parsed ${segments.length} segments with ${uniqueSpeakers.size} unique speakers: ${Array.from(uniqueSpeakers).join(', ')}`)
    console.log(`[Speechmatics] Detected language: ${detectedLanguage}`)

    return {
      segments,
      language: detectedLanguage,
      fullText,
    }
  }
}

export function createSpeechmaticsService(): SpeechmaticsService {
  const apiKey = process.env.SPEECHMATICS_API_KEY

  if (!apiKey) {
    throw new Error('SPEECHMATICS_API_KEY is not configured')
  }

  return new SpeechmaticsService({ apiKey })
}
