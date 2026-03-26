import {
  AccessToken,
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

export async function createRoom(
  roomName: string,
  options?: { maxParticipants?: number; emptyTimeout?: number; metadata?: string }
) {
  const roomService = getRoomService()
  const room = await roomService.createRoom({
    name: roomName,
    maxParticipants: options?.maxParticipants ?? 2,
    emptyTimeout: options?.emptyTimeout ?? 90, // 90 s empty timeout (outbound call answer window)
    metadata: options?.metadata,
  })
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
