export interface Contact {
  id: string
  name: string
  phone: string
  avatar?: string
  initials: string
}

export interface RecentCall {
  id: string
  contact: Contact
  timestamp: string
  duration: number // seconds
  type: "outgoing" | "incoming" | "missed"
  sessionId?: string // Link to transcribed session
}

export interface ActiveCall {
  id: string
  contact: Contact
  startTime: Date
  status: "connecting" | "ringing" | "connected" | "ended"
  isMuted: boolean
  isSpeaker: boolean
  isOnHold: boolean
}

export interface LiveTranscriptSegment {
  id: string
  speaker: "user" | "other"
  text: string
  timestamp: number // seconds into call
  isFinal: boolean
}
