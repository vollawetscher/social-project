export interface AudioFormatInfo {
  mimeType: string
  extension: string
  isSupported: boolean
}

// Speechmatics-compatible formats only
// See: https://docs.speechmatics.com/introduction/supported-languages
// Supported: wav, mp3, aac, ogg, mpeg, amr, m4a, mp4, flac
// NOT supported: webm
const AUDIO_FORMATS_PRIORITY = [
  { mimeType: 'audio/mp4', extension: 'mp4' },
  { mimeType: 'audio/mpeg', extension: 'mp3' },
  { mimeType: 'audio/mp3', extension: 'mp3' },
  { mimeType: 'audio/wav', extension: 'wav' },
  { mimeType: 'audio/ogg', extension: 'ogg' },
  { mimeType: 'audio/ogg;codecs=opus', extension: 'ogg' },
  { mimeType: 'audio/aac', extension: 'aac' },
  { mimeType: 'audio/flac', extension: 'flac' },
  { mimeType: 'audio/x-m4a', extension: 'm4a' },
]

export function detectSupportedAudioFormat(): AudioFormatInfo {
  if (typeof window === 'undefined' || !window.MediaRecorder) {
    return {
      mimeType: '',
      extension: 'webm',
      isSupported: false,
    }
  }

  if (isMobileSafari()) {
    console.log('[AudioFormat] Mobile Safari detected - forcing MP4 format to avoid broken WebM support')
    const mp4Formats = [
      { mimeType: 'audio/mp4', extension: 'mp4' },
      { mimeType: 'audio/mp4;codecs=mp4a.40.2', extension: 'mp4' },
    ]

    for (const format of mp4Formats) {
      if (MediaRecorder.isTypeSupported(format.mimeType)) {
        console.log('[AudioFormat] Using iOS-compatible format:', format.mimeType)
        return {
          mimeType: format.mimeType,
          extension: format.extension,
          isSupported: true,
        }
      }
    }

    console.log('[AudioFormat] iOS fallback - using empty mimeType for browser default')
    return {
      mimeType: '',
      extension: 'mp4',
      isSupported: true,
    }
  }

  for (const format of AUDIO_FORMATS_PRIORITY) {
    if (MediaRecorder.isTypeSupported(format.mimeType)) {
      console.log('[AudioFormat] Selected supported format:', format.mimeType)
      return {
        mimeType: format.mimeType,
        extension: format.extension,
        isSupported: true,
      }
    }
  }

  console.warn('[AudioFormat] No Speechmatics-compatible format supported by browser')
  console.warn('[AudioFormat] Falling back to browser default - transcription may fail')
  return {
    mimeType: '',
    extension: 'mp4',
    isSupported: true,
  }
}

export function isMobileSafari(): boolean {
  if (typeof window === 'undefined') return false

  const ua = window.navigator.userAgent
  const iOS = /iPad|iPhone|iPod/.test(ua)
  const webkit = /WebKit/.test(ua)
  const notChrome = !/CriOS/.test(ua) && !/Chrome/.test(ua)

  return iOS && webkit && notChrome
}

export function getBrowserAudioCapabilities(): {
  isMobileSafari: boolean
  supportedFormats: string[]
  recommendedFormat: AudioFormatInfo
} {
  const supportedFormats = AUDIO_FORMATS_PRIORITY
    .filter(format => MediaRecorder.isTypeSupported(format.mimeType))
    .map(format => format.mimeType)

  return {
    isMobileSafari: isMobileSafari(),
    supportedFormats,
    recommendedFormat: detectSupportedAudioFormat(),
  }
}
