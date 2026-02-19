export interface Contact {
  id: string
  name: string
  phone: string
  avatar?: string
  initials: string
}

export type CallMode = "audio" | "video"
export type LayoutMode = "gallery" | "focus" | "screenshare"

export interface RecentCall {
  id: string
  contact: Contact
  timestamp: string
  duration: number
  type: "outgoing" | "incoming" | "missed"
  mode: CallMode
  sessionId?: string
  participants?: number // for video rooms
}

export interface ActiveCall {
  id: string
  contact: Contact
  startTime: Date
  status: "connecting" | "ringing" | "connected" | "ended"
  mode: CallMode
  isMuted: boolean
  isSpeaker: boolean
  isOnHold: boolean
  isCameraOn: boolean
  isScreenSharing: boolean
}

export interface VideoParticipant {
  id: string
  name: string
  initials: string
  isSpeaking: boolean
  hasVideo: boolean
  hasAudio: boolean
  isScreenSharing: boolean
  isLocal: boolean
}

export interface RoomState {
  roomId: string
  roomName: string
  participants: VideoParticipant[]
  layout: LayoutMode
  isRecording: boolean
  isTranscribing: boolean
}

export interface LiveTranscriptSegment {
  id: string
  speaker: "user" | "other"
  speakerName?: string
  text: string
  timestamp: number
  isFinal: boolean
}
