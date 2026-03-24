import type { SupabaseClient } from '@supabase/supabase-js'

export type CallReachabilityState = 'reachable_now' | 'probably_offline' | 'unknown'

export interface CallReachability {
  state: CallReachabilityState
  reason: string
  lastHeartbeatAt: string | null
  appState: 'foreground' | 'background' | null
}

const PRESENCE_STALE_MS = 90_000
const PRESENCE_RECENT_MS = 30_000

export async function getCalleeReachability(
  supabase: SupabaseClient,
  calleeUserId: string
): Promise<CallReachability> {
  const { data: presence } = await supabase
    .from('call_presence')
    .select('app_state, last_heartbeat_at')
    .eq('user_id', calleeUserId)
    .maybeSingle()

  const lastHeartbeatAt = presence?.last_heartbeat_at || null
  const appState =
    presence?.app_state === 'foreground' || presence?.app_state === 'background'
      ? presence.app_state
      : null

  if (!lastHeartbeatAt) {
    return {
      state: 'unknown',
      reason: 'No recent app presence signal for callee.',
      lastHeartbeatAt: null,
      appState,
    }
  }

  const ageMs = Date.now() - new Date(lastHeartbeatAt).getTime()
  if (Number.isNaN(ageMs)) {
    return {
      state: 'unknown',
      reason: 'Presence timestamp invalid.',
      lastHeartbeatAt,
      appState,
    }
  }

  if (ageMs <= PRESENCE_RECENT_MS && appState === 'foreground') {
    return {
      state: 'reachable_now',
      reason: 'Callee app is active in foreground with recent heartbeat.',
      lastHeartbeatAt,
      appState,
    }
  }

  if (ageMs > PRESENCE_STALE_MS) {
    return {
      state: 'probably_offline',
      reason: 'Presence heartbeat is stale.',
      lastHeartbeatAt,
      appState,
    }
  }

  return {
    state: 'unknown',
    reason: appState === 'background'
      ? 'Callee app is backgrounded.'
      : 'Callee presence is recent but inconclusive.',
    lastHeartbeatAt,
    appState,
  }
}
