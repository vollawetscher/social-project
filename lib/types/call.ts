/**
 * Types for telephony/video conferencing feature.
 * Covers both web-to-web (LiveKit) and web-to-PSTN (Twilio SIP) calls.
 */

// --- Database types (match calls table schema) ---

export type CallType = 'web' | 'pstn_outbound'
export type CallStatus = 'waiting' | 'active' | 'ended' | 'processing' | 'transcribing' | 'done' | 'error'

export interface Call {
  id: string
  session_id: string | null
  user_id: string
  room_name: string
  call_type: CallType
  status: CallStatus
  participant_a_identity: string | null
  participant_b_identity: string | null
  phone_number: string | null
  sip_call_id: string | null
  started_at: string | null
  ended_at: string | null
  room_created_at_ms: number | null
  track_a_egress_id: string | null
  track_a_started_at_ns: number | null
  track_b_egress_id: string | null
  track_b_started_at_ns: number | null
  last_error: string | null
  created_at: string
}

// --- UI types (adapted from v0 designs) ---

export type CallMode = 'audio' | 'video'
export type LayoutMode = 'gallery' | 'focus' | 'screenshare'

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
  type: 'outgoing' | 'incoming' | 'missed'
  mode: CallMode
  sessionId?: string
  participants?: number
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
  speaker: 'user' | 'other'
  speakerName?: string
  text: string
  timestamp: number
  isFinal: boolean
}

// --- API types ---

export interface CreateCallRequest {
  callType: CallType
  mode: CallMode
  phoneNumber?: string        // Required for pstn_outbound
  participantName?: string    // Display name for the initiator
}

export interface CreateCallResponse {
  callId: string
  roomName: string
  token: string               // LiveKit access token for the initiator
}

export interface CallTokenRequest {
  participantName?: string    // For guest participants (no auth)
}

export interface CallTokenResponse {
  token: string
}

export interface DialRequest {
  phoneNumber: string         // E.164 format
}

export interface DialResponse {
  sipCallId: string
}
