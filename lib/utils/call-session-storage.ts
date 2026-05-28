/** Persists in-call LiveKit credentials across reloads (sessionStorage, tab-scoped). */

const STORAGE_PREFIX = 'notissima.callSession.'
const MAX_AGE_MS = 4 * 60 * 60 * 1000

export type StoredCallPhase = 'active' | 'consent'

export interface StoredCallSession {
  token: string
  callId: string
  roomName: string
  phase: StoredCallPhase
  isInitiator?: boolean
  participantIdentity?: string | null
  savedAt: number
}

function storageKey(scope: string) {
  return `${STORAGE_PREFIX}${scope}`
}

export function saveCallSession(
  scope: string,
  session: Omit<StoredCallSession, 'savedAt'>,
) {
  if (typeof window === 'undefined') return
  try {
    const payload: StoredCallSession = { ...session, savedAt: Date.now() }
    sessionStorage.setItem(storageKey(scope), JSON.stringify(payload))
  } catch {
    // Quota or private mode — best effort only.
  }
}

export function loadCallSession(scope: string): StoredCallSession | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = sessionStorage.getItem(storageKey(scope))
    if (!raw) return null
    const parsed = JSON.parse(raw) as StoredCallSession
    if (!parsed?.token || !parsed?.callId || !parsed?.roomName) return null
    if (Date.now() - (parsed.savedAt || 0) > MAX_AGE_MS) {
      sessionStorage.removeItem(storageKey(scope))
      return null
    }
    return parsed
  } catch {
    return null
  }
}

export function clearCallSession(scope: string) {
  if (typeof window === 'undefined') return
  try {
    sessionStorage.removeItem(storageKey(scope))
  } catch {
    // ignore
  }
}
