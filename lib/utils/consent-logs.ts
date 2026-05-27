export type ConsentLogRow = {
  participant_name: string
  participant_identity: string
  granted: boolean
  created_at: string
}

/**
 * Collapse duplicate consent rows and show implicit host consent for personal
 * meeting link calls. Registered hosts consent implicitly when they accept an
 * incoming call on their link; guests consent explicitly in the call UI.
 */
export function normalizeConsentLogsForDisplay(
  logs: ConsentLogRow[],
  options?: {
    callUserId?: string | null
    hostDisplayName?: string | null
    /** When the registered host accepted the call (implicit consent moment). */
    callAcceptedAt?: string | null
    isPersonalMeetingLink?: boolean
  }
): ConsentLogRow[] {
  if (!logs.length) return []

  const byIdentity = new Map<string, ConsentLogRow>()
  for (const log of logs) {
    const key =
      log.participant_identity?.trim() ||
      `name:${(log.participant_name || '').trim().toLowerCase()}`
    const existing = byIdentity.get(key)
    if (!existing || new Date(log.created_at) >= new Date(existing.created_at)) {
      byIdentity.set(key, log)
    }
  }

  let result = [...byIdentity.values()]

  const guestByName = new Map<string, ConsentLogRow[]>()
  for (const log of result) {
    if (!String(log.participant_identity).startsWith('guest-')) continue
    const nameKey = (log.participant_name || '').trim().toLowerCase()
    if (!nameKey) continue
    const group = guestByName.get(nameKey) || []
    group.push(log)
    guestByName.set(nameKey, group)
  }
  for (const group of guestByName.values()) {
    if (group.length <= 1) continue
    const keep = group.sort(
      (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    )[0]
    result = result.filter((log) => !group.includes(log) || log === keep)
  }

  const callUserId = options?.callUserId
  const hostDisplayName = options?.hostDisplayName?.trim()
  if (callUserId && hostDisplayName) {
    result = result.map((log) =>
      log.participant_identity === callUserId
        ? { ...log, participant_name: hostDisplayName }
        : log
    )

    const hasHostLog = result.some((log) => log.participant_identity === callUserId)
    const guestGranted = result.some((log) => log.granted)
    const showImplicitHost =
      options?.isPersonalMeetingLink !== false &&
      !hasHostLog &&
      guestGranted

    if (showImplicitHost) {
      result.unshift({
        participant_name: hostDisplayName,
        participant_identity: callUserId,
        granted: true,
        created_at:
          options?.callAcceptedAt ||
          result[0]?.created_at ||
          new Date().toISOString(),
      })
    }
  }

  return result.sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  )
}
