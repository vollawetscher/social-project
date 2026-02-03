/**
 * Global Microphone Manager
 * 
 * Ensures only one component can access the microphone at a time.
 * Prevents conflicts between AudioRecorder and live dictation components.
 */

type MicrophoneOwner = 'audio-recorder' | 'live-dictation' | null

class MicrophoneManager {
  private currentOwner: MicrophoneOwner = null
  private currentStream: MediaStream | null = null
  private listeners: Set<(owner: MicrophoneOwner) => void> = new Set()

  /**
   * Request microphone access
   * Returns null if microphone is already in use by another component
   */
  async requestMicrophone(owner: MicrophoneOwner): Promise<MediaStream | null> {
    // Check if already owned by someone else
    if (this.currentOwner && this.currentOwner !== owner) {
      console.warn(`[MicrophoneManager] Microphone already in use by: ${this.currentOwner}`)
      return null
    }

    // If this owner already has it, return existing stream
    if (this.currentOwner === owner && this.currentStream) {
      console.log(`[MicrophoneManager] Returning existing stream for: ${owner}`)
      return this.currentStream
    }

    try {
      // Request new microphone access
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        }
      })

      this.currentStream = stream
      this.currentOwner = owner
      this.notifyListeners(owner)

      console.log(`[MicrophoneManager] Microphone granted to: ${owner}`)
      return stream
    } catch (error) {
      console.error(`[MicrophoneManager] Failed to get microphone for ${owner}:`, error)
      throw error
    }
  }

  /**
   * Release microphone access
   */
  releaseMicrophone(owner: MicrophoneOwner): void {
    if (this.currentOwner !== owner) {
      console.warn(`[MicrophoneManager] ${owner} tried to release but doesn't own microphone`)
      return
    }

    // Stop all tracks
    if (this.currentStream) {
      this.currentStream.getTracks().forEach(track => {
        track.stop()
        console.log(`[MicrophoneManager] Stopped track for: ${owner}`)
      })
    }

    this.currentStream = null
    this.currentOwner = null
    this.notifyListeners(null)

    console.log(`[MicrophoneManager] Microphone released by: ${owner}`)
  }

  /**
   * Check if microphone is available
   */
  isAvailable(): boolean {
    return this.currentOwner === null
  }

  /**
   * Get current owner
   */
  getCurrentOwner(): MicrophoneOwner {
    return this.currentOwner
  }

  /**
   * Get owner display name for user-facing messages
   */
  getOwnerDisplayName(owner: MicrophoneOwner): string {
    switch (owner) {
      case 'audio-recorder':
        return 'Audioaufnahme'
      case 'live-dictation':
        return 'Live-Diktat'
      default:
        return 'Unbekannt'
    }
  }

  /**
   * Subscribe to ownership changes
   */
  subscribe(listener: (owner: MicrophoneOwner) => void): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  private notifyListeners(owner: MicrophoneOwner): void {
    this.listeners.forEach(listener => listener(owner))
  }

  /**
   * Force release (for cleanup/error recovery)
   */
  forceRelease(): void {
    if (this.currentStream) {
      this.currentStream.getTracks().forEach(track => track.stop())
    }
    this.currentStream = null
    const previousOwner = this.currentOwner
    this.currentOwner = null
    this.notifyListeners(null)
    console.warn(`[MicrophoneManager] Force released from: ${previousOwner}`)
  }
}

// Singleton instance
export const microphoneManager = new MicrophoneManager()
