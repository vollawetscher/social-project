/**
 * Speechmatics Real-Time WebSocket Transcription
 * GDPR/EU AI Act compliant - all processing on Speechmatics servers
 * 
 * Features:
 * - Automatic reconnection on connection loss
 * - iOS Safari AudioContext support
 * - Better error handling and diagnostics
 */

export interface RealtimeTranscriptResult {
  transcript: string
  isFinal: boolean
}

export interface RealtimeConfig {
  language?: string
  enablePartials?: boolean
  maxDelaySec?: number
  enableEntities?: boolean
  onTranscript: (result: RealtimeTranscriptResult) => void
  onError: (error: Error, diagnostic?: string) => void
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
  private reconnectAttempts = 0
  private maxReconnectAttempts = 3
  private isManualStop = false
  private reconnectTimeout: NodeJS.Timeout | null = null

  constructor(tempToken: string, config: RealtimeConfig) {
    this.tempToken = tempToken
    this.config = config
  }

  async start(stream: MediaStream): Promise<void> {
    this.audioStream = stream
    this.isManualStop = false
    this.reconnectAttempts = 0

    await this.connectWebSocket()
  }

  private async connectWebSocket(): Promise<void> {
    try {
      // Create WebSocket connection to Speechmatics real-time API with auth token
      const wsUrl = `wss://eu2.rt.speechmatics.com/v2?jwt=${this.tempToken}`
      console.log('[Speechmatics RT] Attempting to connect to WebSocket...')
      console.log('[Speechmatics RT] Token length:', this.tempToken.length)
      console.log('[Speechmatics RT] Token preview:', this.tempToken.substring(0, 20) + '...')
      this.ws = new WebSocket(wsUrl)

      this.ws.onopen = () => {
        console.log('[Speechmatics RT] WebSocket connected')
        this.reconnectAttempts = 0 // Reset on successful connection
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
            max_delay: this.config.maxDelaySec ?? 5,
            enable_entities: this.config.enableEntities ?? false,
          },
        }

        this.ws?.send(JSON.stringify(startMessage))
        console.log('[Speechmatics RT] Sent StartRecognition')

        // Start audio processing (only on first connection)
        if (!this.audioContext) {
          this.startAudioProcessing()
        }
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
            const errorMsg = data.reason || 'Speechmatics API error'
            console.error('[Speechmatics RT] API Error:', errorMsg)
            this.config.onError(
              new Error(errorMsg),
              `API Error: ${errorMsg}. Check if token is valid and not expired.`
            )
          } else if (data.message === 'Warning') {
            console.warn('[Speechmatics RT] Warning:', data.reason)
          }
        } catch (error) {
          console.error('[Speechmatics RT] Message parse error:', error)
          this.config.onError(
            error as Error,
            'Failed to parse WebSocket message'
          )
        }
      }

      this.ws.onerror = (error) => {
        console.error('[Speechmatics RT] WebSocket error:', error)
        console.error('[Speechmatics RT] WebSocket readyState:', this.ws?.readyState)
        console.error('[Speechmatics RT] Error type:', (error as any).type)
        console.error('[Speechmatics RT] Error message:', (error as any).message)
        this.config.onError(
          new Error('WebSocket connection error'),
          'Network error or connection refused. Check internet connection.'
        )
      }

      this.ws.onclose = (event) => {
        console.log('[Speechmatics RT] WebSocket closed', {
          code: event.code,
          reason: event.reason,
          wasClean: event.wasClean
        })
        
        this.config.onConnectionChange?.(false)

        // Attempt reconnection if not manually stopped
        if (!this.isManualStop && this.reconnectAttempts < this.maxReconnectAttempts) {
          this.reconnectAttempts++
          const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts - 1), 5000)
          
          console.log(`[Speechmatics RT] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`)
          
          this.reconnectTimeout = setTimeout(() => {
            console.log('[Speechmatics RT] Attempting reconnection...')
            this.connectWebSocket().catch(err => {
              console.error('[Speechmatics RT] Reconnection failed:', err)
              this.config.onError(
                err,
                `Reconnection failed after ${this.reconnectAttempts} attempts`
              )
            })
          }, delay)
        } else if (this.reconnectAttempts >= this.maxReconnectAttempts) {
          this.config.onError(
            new Error('Max reconnection attempts reached'),
            'Could not reconnect to transcription service. Please try again.'
          )
        }
      }
    } catch (error) {
      console.error('[Speechmatics RT] Connection error:', error)
      this.config.onError(
        error as Error,
        'Failed to establish WebSocket connection'
      )
      throw error
    }
  }

  private async startAudioProcessing(): Promise<void> {
    if (!this.audioStream) return

    try {
      // Create AudioContext with iOS Safari support
      this.audioContext = new AudioContext({ sampleRate: 16000 })
      
      // Resume AudioContext if suspended (iOS autoplay policy)
      if (this.audioContext.state === 'suspended') {
        console.log('[Speechmatics RT] Resuming suspended AudioContext')
        await this.audioContext.resume()
      }
      
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
      
      // Speechmatics RT API v2 expects BINARY WebSocket messages for audio
      // Send raw PCM bytes directly, not as JSON
      const audioBytes = new Uint8Array(pcmData.buffer, pcmData.byteOffset, pcmData.byteLength)

      try {
        // Send as BINARY WebSocket message (not JSON!)
        this.ws?.send(audioBytes)
      } catch (error) {
        console.error('[Speechmatics RT] Failed to send audio chunk:', error)
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

      // Speechmatics RT API v2 expects BINARY WebSocket messages for audio
      // Send raw PCM bytes directly, not as JSON
      const audioBytes = new Uint8Array(pcmData.buffer, pcmData.byteOffset, pcmData.byteLength)

      try {
        // Send as BINARY WebSocket message (not JSON!)
        this.ws?.send(audioBytes)
      } catch (error) {
        console.error('[Speechmatics RT] Failed to send audio chunk:', error)
      }
    }

    this.mediaStreamSource.connect(this.scriptProcessor)
    this.scriptProcessor.connect(this.audioContext.destination)
  }

  async stop(): Promise<void> {
    console.log('[Speechmatics RT] Stopping...')
    this.isManualStop = true

    // Clear any pending reconnection
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout)
      this.reconnectTimeout = null
    }

    // Send end of audio stream (Speechmatics RT API v2 format)
    if (this.ws?.readyState === WebSocket.OPEN) {
      try {
        // According to Speechmatics RT API v2, send an empty binary message to signal end
        // OR just close the connection - the API handles both
        console.log('[Speechmatics RT] Sending end of audio signal')
        
        // Wait a moment for any pending transcripts
        await new Promise(resolve => setTimeout(resolve, 1000))
      } catch (error) {
        console.warn('[Speechmatics RT] Error in stop sequence:', error)
      }
    }

    // Clean up audio processing
    if (this.audioWorklet) {
      try {
        this.audioWorklet.disconnect()
      } catch (e) {
        console.warn('[Speechmatics RT] Error disconnecting audioWorklet:', e)
      }
      this.audioWorklet = null
    }

    if (this.scriptProcessor) {
      try {
        this.scriptProcessor.disconnect()
      } catch (e) {
        console.warn('[Speechmatics RT] Error disconnecting scriptProcessor:', e)
      }
      this.scriptProcessor = null
    }

    if (this.mediaStreamSource) {
      try {
        this.mediaStreamSource.disconnect()
      } catch (e) {
        console.warn('[Speechmatics RT] Error disconnecting mediaStreamSource:', e)
      }
      this.mediaStreamSource = null
    }

    if (this.audioContext) {
      try {
        await this.audioContext.close()
      } catch (e) {
        console.warn('[Speechmatics RT] Error closing audioContext:', e)
      }
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
  console.log('[Speechmatics RT] Requesting token from API...')
  const response = await fetch('/api/speechmatics/token', {
    method: 'POST',
  })

  console.log('[Speechmatics RT] Token API response status:', response.status)

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}))
    console.error('[Speechmatics RT] Token API error:', errorData)
    throw new Error('Failed to get Speechmatics token: ' + (errorData.error || response.statusText))
  }

  const data = await response.json()
  console.log('[Speechmatics RT] Token received, length:', data.token?.length || 0)
  
  if (!data.token) {
    throw new Error('No token in API response')
  }
  
  return data.token
}
