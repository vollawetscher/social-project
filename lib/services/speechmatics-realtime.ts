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
  private scriptProcessor: ScriptProcessorNode | null = null
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

      // Try AudioWorkletNode (modern), fallback to ScriptProcessorNode (deprecated but compatible)
      const useWorklet = 'audioWorklet' in this.audioContext && typeof this.audioContext.audioWorklet.addModule === 'function'
      
      if (useWorklet) {
        try {
          await this.startAudioWorkletProcessing()
          console.log('[Speechmatics RT] Audio processing started (AudioWorklet)')
          return
        } catch (workletError) {
          console.warn('[Speechmatics RT] AudioWorklet failed, falling back to ScriptProcessor:', workletError)
        }
      }

      // Fallback to ScriptProcessorNode for older browsers
      this.startScriptProcessorProcessing()
      console.log('[Speechmatics RT] Audio processing started (ScriptProcessor fallback)')
    } catch (error) {
      console.error('[Speechmatics RT] Audio processing error:', error)
      this.config.onError(error as Error)
    }
  }

  private async startAudioWorkletProcessing(): Promise<void> {
    if (!this.audioContext || !this.mediaStreamSource) return

    // Create inline AudioWorklet processor
    const processorCode = `
      class SpeechmaticsProcessor extends AudioWorkletProcessor {
        process(inputs, outputs) {
          const input = inputs[0]
          if (input && input[0]) {
            const inputData = input[0]
            // Convert Float32Array to Int16Array (PCM 16-bit)
            const pcmData = new Int16Array(inputData.length)
            for (let i = 0; i < inputData.length; i++) {
              const s = Math.max(-1, Math.min(1, inputData[i]))
              pcmData[i] = s < 0 ? s * 0x8000 : s * 0x7FFF
            }
            this.port.postMessage(pcmData)
          }
          return true
        }
      }
      registerProcessor('speechmatics-processor', SpeechmaticsProcessor)
    `

    const blob = new Blob([processorCode], { type: 'application/javascript' })
    const processorUrl = URL.createObjectURL(blob)

    await this.audioContext.audioWorklet.addModule(processorUrl)
    URL.revokeObjectURL(processorUrl)

    this.audioWorklet = new AudioWorkletNode(this.audioContext, 'speechmatics-processor')

    this.audioWorklet.port.onmessage = (event) => {
      if (this.ws?.readyState !== WebSocket.OPEN) return

      const pcmData: Int16Array = event.data
      const uint8Array = new Uint8Array(pcmData.buffer)
      
      // Convert to base64
      let binaryString = ''
      for (let i = 0; i < uint8Array.length; i++) {
        binaryString += String.fromCharCode(uint8Array[i])
      }
      const audioBase64 = btoa(binaryString)

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

    this.mediaStreamSource.connect(this.audioWorklet)
    this.audioWorklet.connect(this.audioContext.destination)
  }

  private startScriptProcessorProcessing(): void {
    if (!this.audioContext || !this.mediaStreamSource) return

    const bufferSize = 4096
    this.scriptProcessor = this.audioContext.createScriptProcessor(bufferSize, 1, 1)

    this.scriptProcessor.onaudioprocess = (event) => {
      if (this.ws?.readyState !== WebSocket.OPEN) return

      const inputData = event.inputBuffer.getChannelData(0)
      
      // Convert Float32Array to Int16Array (PCM 16-bit little-endian)
      const pcmData = new Int16Array(inputData.length)
      for (let i = 0; i < inputData.length; i++) {
        const s = Math.max(-1, Math.min(1, inputData[i]))
        pcmData[i] = s < 0 ? s * 0x8000 : s * 0x7FFF
      }

      // Send raw binary audio to Speechmatics
      const uint8Array = new Uint8Array(pcmData.buffer)
      let binaryString = ''
      for (let i = 0; i < uint8Array.length; i++) {
        binaryString += String.fromCharCode(uint8Array[i])
      }
      const audioBase64 = btoa(binaryString)

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

    this.mediaStreamSource.connect(this.scriptProcessor)
    this.scriptProcessor.connect(this.audioContext.destination)
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
    if (this.audioWorklet) {
      this.audioWorklet.disconnect()
      this.audioWorklet = null
    }

    if (this.scriptProcessor) {
      this.scriptProcessor.disconnect()
      this.scriptProcessor = null
    }

    if (this.mediaStreamSource) {
      this.mediaStreamSource.disconnect()
      this.mediaStreamSource = null
    }

    if (this.audioContext) {
      await this.audioContext.close()
      this.audioContext = null
    }

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
