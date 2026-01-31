/**
 * Speechmatics Real-Time WebSocket Transcription
 * GDPR/EU AI Act compliant - all processing on Speechmatics servers
 */

export interface RealtimeTranscriptResult {
  transcript: string
  isFinal: boolean
}

export interface RealtimeConfig {
  language?: string
  enablePartials?: boolean
  onTranscript: (result: RealtimeTranscriptResult) => void
  onError: (error: Error) => void
  onConnectionChange?: (connected: boolean) => void
}

export class SpeechmaticsRealtimeService {
  private ws: WebSocket | null = null
  private audioContext: AudioContext | null = null
  private audioStream: MediaStream | null = null
  private audioWorklet: AudioWorkletNode | null = null
  private mediaStreamSource: MediaStreamAudioSourceNode | null = null
  private config: RealtimeConfig
  private tempToken: string

  constructor(tempToken: string, config: RealtimeConfig) {
    this.tempToken = tempToken
    this.config = config
  }

  async start(stream: MediaStream): Promise<void> {
    this.audioStream = stream

    // Create WebSocket connection to Speechmatics real-time API with auth token
    const wsUrl = `wss://eu2.rt.speechmatics.com/v2?jwt=${this.tempToken}`
    this.ws = new WebSocket(wsUrl)

    this.ws.onopen = () => {
      console.log('[Speechmatics RT] WebSocket connected')
      this.config.onConnectionChange?.(true)

      // Send start recognition message
      const startMessage = {
        message: 'StartRecognition',
        audio_format: {
          type: 'raw',
          encoding: 'pcm_s16le',
          sample_rate: 16000,
        },
        transcription_config: {
          language: this.config.language || 'de',
          enable_partials: this.config.enablePartials ?? true,
          max_delay: 2,
          enable_entities: true,
        },
      }

      this.ws?.send(JSON.stringify(startMessage))
      console.log('[Speechmatics RT] Sent StartRecognition')

      // Start audio processing
      this.startAudioProcessing()
    }

    this.ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data)
        
        if (data.message === 'AddPartialTranscript') {
          this.config.onTranscript({
            transcript: data.metadata.transcript,
            isFinal: false,
          })
        } else if (data.message === 'AddTranscript') {
          this.config.onTranscript({
            transcript: data.metadata.transcript,
            isFinal: true,
          })
        } else if (data.message === 'RecognitionStarted') {
          console.log('[Speechmatics RT] Recognition started')
        } else if (data.message === 'Error') {
          this.config.onError(new Error(data.reason || 'Speechmatics error'))
        }
      } catch (error) {
        console.error('[Speechmatics RT] Message parse error:', error)
      }
    }

    this.ws.onerror = (error) => {
      console.error('[Speechmatics RT] WebSocket error:', error)
      this.config.onError(new Error('WebSocket connection error'))
      this.config.onConnectionChange?.(false)
    }

    this.ws.onclose = () => {
      console.log('[Speechmatics RT] WebSocket closed')
      this.config.onConnectionChange?.(false)
    }
  }

  private async startAudioProcessing(): Promise<void> {
    if (!this.audioStream) return

    try {
      this.audioContext = new AudioContext({ sampleRate: 16000 })
      this.mediaStreamSource = this.audioContext.createMediaStreamSource(this.audioStream)

      // Create audio processor using ScriptProcessorNode (compatible with all browsers)
      const bufferSize = 4096
      const processor = this.audioContext.createScriptProcessor(bufferSize, 1, 1)

      processor.onaudioprocess = (event) => {
        if (this.ws?.readyState !== WebSocket.OPEN) return

        const inputData = event.inputBuffer.getChannelData(0)
        
        // Convert Float32Array to Int16Array (PCM 16-bit little-endian)
        const pcmData = new Int16Array(inputData.length)
        for (let i = 0; i < inputData.length; i++) {
          const s = Math.max(-1, Math.min(1, inputData[i]))
          pcmData[i] = s < 0 ? s * 0x8000 : s * 0x7FFF
        }

        // Send raw binary audio to Speechmatics
        // Format: JSON message with base64-encoded audio
        const audioBase64 = btoa(
          String.fromCharCode(...new Uint8Array(pcmData.buffer))
        )

        const message = {
          message: 'AddAudio',
          audio: audioBase64,
        }

        try {
          this.ws?.send(JSON.stringify(message))
        } catch (error) {
          console.error('[Speechmatics RT] Failed to send audio:', error)
        }
      }

      this.mediaStreamSource.connect(processor)
      processor.connect(this.audioContext.destination)

      console.log('[Speechmatics RT] Audio processing started')
    } catch (error) {
      console.error('[Speechmatics RT] Audio processing error:', error)
      this.config.onError(error as Error)
    }
  }

  async stop(): Promise<void> {
    console.log('[Speechmatics RT] Stopping...')

    // Send end of stream
    if (this.ws?.readyState === WebSocket.OPEN) {
      const endMessage = {
        message: 'EndOfStream',
      }
      this.ws.send(JSON.stringify(endMessage))
      
      // Wait a bit for final transcripts
      await new Promise(resolve => setTimeout(resolve, 500))
    }

    // Clean up audio processing
    if (this.audioContext) {
      await this.audioContext.close()
      this.audioContext = null
    }

    this.mediaStreamSource?.disconnect()
    this.mediaStreamSource = null

    // Close WebSocket
    if (this.ws) {
      this.ws.close()
      this.ws = null
    }

    this.audioStream = null
    this.config.onConnectionChange?.(false)
    console.log('[Speechmatics RT] Stopped')
  }
}

/**
 * Get a temporary JWT token for Speechmatics real-time API
 * This should be called from the client to get a secure token
 */
export async function getSpeechmaticsRealtimeToken(): Promise<string> {
  const response = await fetch('/api/speechmatics/token', {
    method: 'POST',
  })

  if (!response.ok) {
    throw new Error('Failed to get Speechmatics token')
  }

  const data = await response.json()
  return data.token
}
