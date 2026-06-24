import type { CallMode } from '@/lib/types/call'

export interface InviteLinkContent {
  inviteUrl: string
  plainText: string
  htmlText: string
}

export function buildCallInviteUrl(
  roomName: string,
  callId: string,
  mode: CallMode,
  origin = typeof window !== 'undefined' ? window.location.origin : ''
): string {
  const url = new URL(`/call/${roomName}`, origin)
  url.searchParams.set('callId', callId)
  url.searchParams.set('mode', mode)
  return url.toString()
}

export function buildInviteLinkContent(
  inviteUrl: string,
  callerName: string,
  mode: CallMode
): InviteLinkContent {
  const caller = callerName || 'Someone'
  const callLabel = mode === 'video' ? 'video call' : 'audio call'
  const plainText = `Join ${caller} in a ${callLabel} now: ${inviteUrl}`
  const htmlText = `<p>Join <strong>${caller}</strong> in a ${callLabel}:<br><a href="${inviteUrl}">${inviteUrl}</a></p>`
  return { inviteUrl, plainText, htmlText }
}

export function buildInviteLinkFromCurrentUrl(
  callId: string,
  callerName: string,
  mode: CallMode
): InviteLinkContent {
  const url = new URL(window.location.href)
  url.searchParams.delete('token')
  if (callId && !url.searchParams.get('callId')) {
    url.searchParams.set('callId', callId)
  }
  return buildInviteLinkContent(url.toString(), callerName, mode)
}

export function execCopyFallback(text: string): boolean {
  const ta = document.createElement('textarea')
  ta.value = text
  ta.setAttribute('readonly', '')
  ta.style.cssText = 'position:absolute;left:-9999px'
  document.body.appendChild(ta)
  ta.select()
  let ok = false
  try {
    ok = document.execCommand('copy')
  } catch {
    ok = false
  }
  document.body.removeChild(ta)
  return ok
}

export async function copyInviteLinkContent(
  content: InviteLinkContent,
  options?: { preferShare?: boolean }
): Promise<boolean> {
  const { inviteUrl, plainText, htmlText } = content
  const preferShare = options?.preferShare ?? true

  if (preferShare) {
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent)
    if (isMobile && navigator.share) {
      try {
        await navigator.share({
          text: plainText.replace(` ${inviteUrl}`, ':'),
          url: inviteUrl,
        })
        return true
      } catch (err: unknown) {
        if (err instanceof Error && err.name === 'AbortError') return false
      }
    }
  }

  if (typeof ClipboardItem !== 'undefined') {
    try {
      await navigator.clipboard.write([
        new ClipboardItem({
          'text/plain': new Blob([plainText], { type: 'text/plain' }),
          'text/html': new Blob([htmlText], { type: 'text/html' }),
        }),
      ])
      return true
    } catch {
      // Fall through
    }
  }

  try {
    await navigator.clipboard.writeText(plainText)
    return true
  } catch {
    return execCopyFallback(plainText)
  }
}

interface CreateCallResponse {
  callId: string
  roomName: string
  displayName?: string
}

/**
 * Preserves user activation by starting a clipboard write synchronously while
 * the call-creation fetch is still in flight.
 */
export async function copyInviteLinkAfterCreateCall<T extends CreateCallResponse>(
  createCallPromise: Promise<T>,
  mode: CallMode
): Promise<boolean> {
  if (typeof ClipboardItem !== 'undefined') {
    try {
      const plainBlobPromise = createCallPromise.then((data) => {
        const inviteUrl = buildCallInviteUrl(data.roomName, data.callId, mode)
        const { plainText } = buildInviteLinkContent(inviteUrl, data.displayName || 'Someone', mode)
        return new Blob([plainText], { type: 'text/plain' })
      })
      const htmlBlobPromise = createCallPromise.then((data) => {
        const inviteUrl = buildCallInviteUrl(data.roomName, data.callId, mode)
        const { htmlText } = buildInviteLinkContent(inviteUrl, data.displayName || 'Someone', mode)
        return new Blob([htmlText], { type: 'text/html' })
      })
      await navigator.clipboard.write([
        new ClipboardItem({
          'text/plain': plainBlobPromise,
          'text/html': htmlBlobPromise,
        }),
      ])
      return true
    } catch {
      // Fall through to post-fetch copy
    }
  }

  try {
    const data = await createCallPromise
    const inviteUrl = buildCallInviteUrl(data.roomName, data.callId, mode)
    const content = buildInviteLinkContent(inviteUrl, data.displayName || 'Someone', mode)
    return copyInviteLinkContent(content, { preferShare: false })
  } catch {
    return false
  }
}
