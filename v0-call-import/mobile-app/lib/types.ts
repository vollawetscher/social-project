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
  duration: number
  type: "incoming" | "outgoing" | "missed"
  isTranscribed: boolean
  sessionId?: string
}

export interface TranscriptEntry {
  id: string
  speaker: "local" | "remote"
  text: string
  timestamp: number
}

export type CallStatus = "idle" | "connecting" | "ringing" | "connected" | "ended"
