export interface AudioFormatInfo {
  mimeType: string
  extension: string
  isSupported: boolean
}

const AUDIO_FORMATS_PRIORITY = [
  { mimeType: 'audio/webm;codecs=opus', extension: 'webm' },
  { mimeType: 'audio/webm', extension: 'webm' },
  { mimeType: 'audio/mp4', extension: 'mp4' },
  { mimeType: 'audio/mpeg', extension: 'mp3' },
  { mimeType: 'audio/wav', extension: 'wav' },
]

export function detectSupportedAudioFormat(): AudioFormatInfo {
  if (typeof window === 'undefined' || !window.MediaRecorder) {
    return {
      mimeType: '',
      extension: 'webm',
      isSupported: false,
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

  console.warn('[AudioFormat] No preferred format supported, using browser default')
  return {
    mimeType: '',
    extension: 'webm',
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
