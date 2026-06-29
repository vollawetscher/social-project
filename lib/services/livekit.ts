import {
  AccessToken,
  AgentDispatchClient,
  RoomServiceClient,
  EgressClient,
  SipClient,
  WebhookReceiver,
  DirectFileOutput,
  EncodedFileOutput,
  EncodedFileType,
  S3Upload,
} from 'livekit-server-sdk'
import type { EgressInfo } from 'livekit-server-sdk'
import { resolveCallerIdForDestination } from '@/lib/services/pstn-routing'
import { createHmac } from 'crypto'

export const NOTISSIMA_VOICE_AGENT_NAME =
  process.env.LIVEKIT_VOICE_AGENT_NAME || 'notissima-voice-agent'

// LiveKit Cloud uses wss:// for client, https:// for server API
function getLivekitHttpUrl(): string {
  const url = process.env.LIVEKIT_URL
  if (!url) throw new Error('LIVEKIT_URL is not configured')
  return url.replace('wss://', 'https://').replace('ws://', 'http://')
}

function getApiKey(): string {
  const key = process.env.LIVEKIT_API_KEY
  if (!key) throw new Error('LIVEKIT_API_KEY is not configured')
  return key
}

function getApiSecret(): string {
  const secret = process.env.LIVEKIT_API_SECRET
  if (!secret) throw new Error('LIVEKIT_API_SECRET is not configured')
  return secret
}

// --- Token Generation ---

export async function createRoomToken(
  roomName: string,
  participantIdentity: string,
  participantName: string,
  options?: { canPublish?: boolean; canSubscribe?: boolean }
): Promise<string> {
  const token = new AccessToken(getApiKey(), getApiSecret(), {
    identity: participantIdentity,
    name: participantName,
    ttl: '6h',
  })

  token.addGrant({
    room: roomName,
    roomJoin: true,
    canPublish: options?.canPublish ?? true,
    canSubscribe: options?.canSubscribe ?? true,
  })

  return token.toJwt()
}

// --- Room Management ---

function getRoomService(): RoomServiceClient {
  return new RoomServiceClient(getLivekitHttpUrl(), getApiKey(), getApiSecret())
}

function getAgentDispatchClient(): AgentDispatchClient {
  return new AgentDispatchClient(getLivekitHttpUrl(), getApiKey(), getApiSecret())
}

export async function createRoom(
  roomName: string,
  options?: { maxParticipants?: number; emptyTimeout?: number; metadata?: string }
) {
  const roomService = getRoomService()
  const roomConfig: {
    name: string
    emptyTimeout: number
    metadata?: string
    maxParticipants?: number
  } = {
    name: roomName,
    emptyTimeout: options?.emptyTimeout ?? 90, // 90 s empty timeout (outbound call answer window)
    metadata: options?.metadata,
  }
  if (typeof options?.maxParticipants === 'number' && options.maxParticipants > 0) {
    roomConfig.maxParticipants = options.maxParticipants
  }
  const room = await roomService.createRoom(roomConfig)
  console.log('[LiveKit] Room created:', room.name)
  return room
}

export async function deleteRoom(roomName: string) {
  const roomService = getRoomService()
  await roomService.deleteRoom(roomName)
  console.log('[LiveKit] Room deleted:', roomName)
}

export async function listParticipants(roomName: string) {
  const roomService = getRoomService()
  return roomService.listParticipants(roomName)
}

export async function dispatchNotissimaVoiceAgent(
  roomName: string,
  metadata: Record<string, unknown>,
) {
  console.log('[LiveKit] Voice agent dispatch requested:', {
    agentName: NOTISSIMA_VOICE_AGENT_NAME,
    roomName,
    metadata,
  })
  const dispatchClient = getAgentDispatchClient()
  const existingDispatches = await dispatchClient.listDispatch(roomName).catch((err) => {
    console.warn('[LiveKit] Failed to list agent dispatches:', {
      agentName: NOTISSIMA_VOICE_AGENT_NAME,
      roomName,
      error: err?.message || err,
    })
    return []
  })

  console.log('[LiveKit] Voice agent dispatch list result:', {
    agentName: NOTISSIMA_VOICE_AGENT_NAME,
    roomName,
    count: existingDispatches.length,
    existing: existingDispatches.map((dispatch: any) => ({
      id: dispatch.id || dispatch.dispatchId,
      agentName: dispatch.agentName,
      room: dispatch.room,
    })),
  })

  const existing = existingDispatches.find((dispatch: any) => dispatch.agentName === NOTISSIMA_VOICE_AGENT_NAME)
  if (existing) {
    console.log('[LiveKit] Voice agent already dispatched:', {
      agentName: NOTISSIMA_VOICE_AGENT_NAME,
      roomName,
      dispatchId: (existing as any).id || (existing as any).dispatchId,
    })
    return existing
  }

  try {
    const dispatch = await dispatchClient.createDispatch(roomName, NOTISSIMA_VOICE_AGENT_NAME, {
      metadata: JSON.stringify(metadata),
    })
    console.log('[LiveKit] Voice agent dispatched:', {
      agentName: NOTISSIMA_VOICE_AGENT_NAME,
      roomName,
      dispatchId: (dispatch as any).id || (dispatch as any).dispatchId,
    })
    return dispatch
  } catch (err: any) {
    console.error('[LiveKit] Voice agent dispatch create failed:', {
      agentName: NOTISSIMA_VOICE_AGENT_NAME,
      roomName,
      error: err?.message || err,
    })
    throw err
  }
}

export async function removeParticipant(roomName: string, participantIdentity: string) {
  const roomService = getRoomService()
  await roomService.removeParticipant(roomName, participantIdentity)
  console.log('[LiveKit] Participant removed:', participantIdentity, 'room:', roomName)
}

// --- Egress (recording) ---

function getEgressClient(): EgressClient {
  return new EgressClient(getLivekitHttpUrl(), getApiKey(), getApiSecret())
}

function getSupabaseS3Upload(): S3Upload {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  if (!supabaseUrl) throw new Error('NEXT_PUBLIC_SUPABASE_URL is not configured')
  const accessKey = process.env.SUPABASE_S3_ACCESS_KEY
  if (!accessKey) throw new Error('SUPABASE_S3_ACCESS_KEY is not configured')
  const secretKey = process.env.SUPABASE_S3_SECRET_KEY
  if (!secretKey) throw new Error('SUPABASE_S3_SECRET_KEY is not configured')

  // Derive the storage-specific hostname: project-ref.storage.supabase.co
  // from the standard project URL: https://project-ref.supabase.co
  let endpointHost: string
  try {
    const url = new URL(supabaseUrl)
    endpointHost = url.host.replace('.supabase.co', '.storage.supabase.co')
  } catch {
    throw new Error('NEXT_PUBLIC_SUPABASE_URL is not a valid URL')
  }

  const endpoint = `https://${endpointHost}/storage/v1/s3`

  // Supabase project is in eu-west-1 (Frankfurt). Hardcoded to prevent
  // env var misconfiguration causing S3 signature mismatches.
  return new S3Upload({
    accessKey,
    secret: secretKey,
    bucket: 'rohbericht-audio',
    region: 'eu-west-1',
    endpoint,
    forcePathStyle: true,
  })
}

/**
 * Start a Room Composite Egress that records mixed audio from all
 * participants as a single OGG file, written directly to Supabase Storage.
 */
export async function startCompositeEgress(
  roomName: string,
  sessionId: string,
): Promise<EgressInfo> {
  const egressClient = getEgressClient()
  const storagePath = `sessions/${sessionId}/call_${roomName}_${Date.now()}.ogg`

  const output = new EncodedFileOutput({
    fileType: EncodedFileType.OGG,
    filepath: storagePath,
    output: {
      case: 's3',
      value: getSupabaseS3Upload(),
    },
  })

  const egress = await egressClient.startRoomCompositeEgress(
    roomName,
    output,
    { audioOnly: true },
  )

  console.log('[LiveKit] Composite egress started:', egress.egressId, 'room:', roomName, 'path:', storagePath)
  return egress
}

/**
 * Start a Track Composite Egress that records only a specific participant's
 * audio track as an OGG file. Used when the callee declines transcription
 * consent — only the caller's side is recorded.
 */
export async function startTrackEgressForParticipant(
  roomName: string,
  sessionId: string,
  participantIdentity: string,
  outputTag: string = 'caller',
): Promise<EgressInfo> {
  const egressClient = getEgressClient()
  const roomService = getRoomService()

  const participants = await roomService.listParticipants(roomName)
  const participant = participants.find(p => p.identity === participantIdentity)
  if (!participant) throw new Error(`Participant ${participantIdentity} not found in room`)

  const audioTrack = participant.tracks.find(
    t => t.type === 1 /* AUDIO */ || t.source === 1 /* MICROPHONE */
  )
  if (!audioTrack?.sid) throw new Error(`No audio track found for ${participantIdentity}`)

  const safeTag = String(outputTag || 'caller')
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, '')
    .slice(0, 32) || 'caller'
  const storagePath = `sessions/${sessionId}/call_${roomName}_${Date.now()}_${safeTag}.ogg`

  const output = new EncodedFileOutput({
    fileType: EncodedFileType.OGG,
    filepath: storagePath,
    output: {
      case: 's3',
      value: getSupabaseS3Upload(),
    },
  })

  const egress = await egressClient.startTrackCompositeEgress(
    roomName,
    output,
    { audioTrackId: audioTrack.sid },
  )

  console.log('[LiveKit] Track egress started:', egress.egressId, 'track:', audioTrack.sid, 'participant:', participantIdentity, 'path:', storagePath)
  return egress
}

/**
 * Start raw track egress to a WebSocket endpoint (server-side relay).
 * LiveKit sends PCM binary chunks directly to the given websocket URL.
 */
export async function startTrackRealtimeEgressForParticipant(
  roomName: string,
  participantIdentity: string,
  websocketUrl: string,
): Promise<EgressInfo> {
  const egressClient = getEgressClient()
  const roomService = getRoomService()

  const participants = await roomService.listParticipants(roomName)
  const participant = participants.find((p) => p.identity === participantIdentity)
  if (!participant) throw new Error(`Participant ${participantIdentity} not found in room`)

  const audioTrack = participant.tracks.find(
    (t) => t.type === 1 /* AUDIO */ || t.source === 1 /* MICROPHONE */
  )
  if (!audioTrack?.sid) throw new Error(`No audio track found for ${participantIdentity}`)

  const egress = await egressClient.startTrackEgress(roomName, websocketUrl, audioTrack.sid)
  console.log('[LiveKit] Track realtime egress started:', egress.egressId, 'track:', audioTrack.sid, 'participant:', participantIdentity)
  return egress
}

export function buildLiveRelayIngestUrl(input: {
  callId: string
  roomName: string
  sourceKey: 'track_a' | 'track_b'
  speakerLabel: string
  language?: string
}): string | null {
  const base = process.env.LIVE_TRANSCRIPT_RELAY_WS_BASE
  const secret = process.env.LIVE_TRANSCRIPT_RELAY_SECRET
  if (!base || !secret) return null

  const ts = Date.now().toString()
  const payload = `${input.callId}:${input.roomName}:${input.sourceKey}:${ts}`
  const sig = createHmac('sha256', secret).update(payload).digest('hex')

  const url = new URL(base)
  url.searchParams.set('callId', input.callId)
  url.searchParams.set('room', input.roomName)
  url.searchParams.set('source', input.sourceKey)
  url.searchParams.set('speaker', input.speakerLabel || input.sourceKey)
  url.searchParams.set('lang', (input.language || 'de').toLowerCase())
  url.searchParams.set('ts', ts)
  url.searchParams.set('sig', sig)
  return url.toString()
}

/**
 * Stop a running egress by ID.
 */
export async function stopEgress(egressId: string): Promise<EgressInfo> {
  const egressClient = getEgressClient()
  const egress = await egressClient.stopEgress(egressId)
  console.log('[LiveKit] Egress stopped:', egressId)
  return egress
}

/**
 * List active egresses for a room.
 */
export async function listEgress(roomName: string): Promise<EgressInfo[]> {
  const egressClient = getEgressClient()
  return egressClient.listEgress({ roomName, active: true })
}

// --- SIP (PSTN outbound via Twilio) ---

function getSipClient(): SipClient {
  return new SipClient(getLivekitHttpUrl(), getApiKey(), getApiSecret())
}

/**
 * Create a SIP participant in a LiveKit room, dialing out via Twilio.
 * The phone callee's audio appears as a regular participant track.
 */
export async function createSipParticipant(
  roomName: string,
  phoneNumber: string,
  options?: {
    participantIdentity?: string
    participantName?: string
    playDialtone?: boolean
    ringingTimeout?: number
    maxCallDuration?: number
  }
) {
  const sipTrunkId = process.env.LIVEKIT_SIP_TRUNK_ID
  if (!sipTrunkId) throw new Error('LIVEKIT_SIP_TRUNK_ID is not configured')

  const callerId = resolveCallerIdForDestination(phoneNumber)
  if (!callerId) throw new Error('TWILIO_CALLER_ID is not configured')
  const sipClient = getSipClient()

  const participant = await sipClient.createSipParticipant(
    sipTrunkId,
    phoneNumber,
    roomName,
    {
      fromNumber: callerId,
      participantIdentity: options?.participantIdentity ?? `phone-${phoneNumber}`,
      participantName: options?.participantName ?? phoneNumber,
      playDialtone: options?.playDialtone ?? true,
      ringingTimeout: options?.ringingTimeout ?? 90,
      maxCallDuration: options?.maxCallDuration ?? 3600, // 1 hour max
    },
  )

  console.log('[LiveKit] SIP participant created:', participant.participantId, 'phone:', phoneNumber)
  return participant
}

// --- Webhook Verification ---

let webhookReceiver: WebhookReceiver | null = null

function getWebhookReceiver(): WebhookReceiver {
  if (!webhookReceiver) {
    webhookReceiver = new WebhookReceiver(getApiKey(), getApiSecret())
  }
  return webhookReceiver
}

/**
 * Verify and parse a LiveKit webhook event.
 * Returns the parsed event or throws if verification fails.
 */
export async function verifyWebhook(body: string, authHeader: string) {
  const receiver = getWebhookReceiver()
  return receiver.receive(body, authHeader)
}

// --- Utility ---

/**
 * Generate a unique room name for a new call.
 */
export function generateRoomName(): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789'
  const segments = []
  for (let s = 0; s < 3; s++) {
    let segment = ''
    for (let i = 0; i < 4; i++) {
      segment += chars[Math.floor(Math.random() * chars.length)]
    }
    segments.push(segment)
  }
  return segments.join('-')
}
