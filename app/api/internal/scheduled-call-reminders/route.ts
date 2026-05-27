import { NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { inferLocaleFromPhone } from '@/lib/services/locale-from-phone'
import { sendCommunicationHubEmail } from '@/lib/services/communication-hub-email'
import { sendInitiatorReminderSMS } from '@/lib/services/sms'
import { logError } from '@/lib/services/error-logger'
import { getAppBaseUrl } from '@/lib/utils/app-url'
import { recordSmsUsage } from '@/lib/services/usage-tracker'

function toDisplayTime(iso: string, locale: 'en' | 'de' | 'es', timezone?: string | null) {
  const localeMap = { en: 'en-US', de: 'de-DE', es: 'es-ES' } as const
  const opts: Intl.DateTimeFormatOptions = {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }
  if (timezone) opts.timeZone = timezone
  return new Date(iso).toLocaleString(localeMap[locale], opts)
}

/**
 * POST /api/internal/scheduled-call-reminders
 * Sends a one-time reminder email to the guest for each scheduled call that starts soon.
 * Also auto-deletes expired scheduled calls that were never started.
 *
 * Security: Requires x-internal-secret header when INTERNAL_API_SECRET is set.
 * Scheduler: GitHub Actions cron, every 5 minutes.
 */
export async function POST(request: Request) {
  const expectedSecret = process.env.INTERNAL_API_SECRET
  const providedSecret = request.headers.get('x-internal-secret')
  if (expectedSecret && providedSecret !== expectedSecret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const supabase = createServiceRoleClient()
    const now = Date.now()
    const leadMinutesRaw = Number(process.env.SCHEDULED_CALL_REMINDER_LEAD_MINUTES ?? 10)
    const leadMinutes = Number.isFinite(leadMinutesRaw) && leadMinutesRaw > 0 ? leadMinutesRaw : 10
    const windowEnd = now + leadMinutes * 60 * 1000
    const deleteGraceRaw = Number(process.env.SCHEDULED_CALL_EXPIRED_DELETE_GRACE_MINUTES ?? 60)
    const deleteGraceMinutes = Number.isFinite(deleteGraceRaw) && deleteGraceRaw >= 0 ? deleteGraceRaw : 60
    const deleteBeforeIso = new Date(now - deleteGraceMinutes * 60 * 1000).toISOString()

    // Auto-cleanup: delete stale scheduled calls that already expired.
    let deletedExpired = 0
    const { data: expiredCalls, error: expiredSelectError } = await supabase
      .from('calls')
      .select('id')
      .eq('status', 'scheduled')
      .lt('scheduled_for', deleteBeforeIso)
      .limit(500)

    if (expiredSelectError) {
      return NextResponse.json({ error: expiredSelectError.message }, { status: 500 })
    }
    if (expiredCalls && expiredCalls.length > 0) {
      const expiredIds = expiredCalls.map((c) => c.id)
      const { error: expiredDeleteError } = await supabase
        .from('calls')
        .delete()
        .in('id', expiredIds)
      if (expiredDeleteError) {
        return NextResponse.json({ error: expiredDeleteError.message }, { status: 500 })
      }
      deletedExpired = expiredIds.length
    }

    const smsBefore = 5 * 60 * 1000 // 5-minute SMS window for initiator

    const { data: dueCalls, error: dueCallsError } = await supabase
      .from('calls')
      .select('id, user_id, callee_user_id, room_name, contact_name, scheduled_for, scheduled_timezone, guest_invite_email, guest_reminder_email_sent_at, initiator_reminder_sms_sent_at')
      .in('status', ['scheduled', 'invited', 'waiting'])
      .not('user_id', 'is', null)
      .not('room_name', 'is', null)
      .gt('scheduled_for', new Date(now).toISOString())
      .lte('scheduled_for', new Date(windowEnd).toISOString())
      .order('scheduled_for', { ascending: true })
      .limit(200)

    if (dueCallsError) {
      return NextResponse.json({ error: dueCallsError.message }, { status: 500 })
    }

    if (!dueCalls || dueCalls.length === 0) {
      return NextResponse.json({ ok: true, checked: 0, sent: 0, failed: 0 })
    }

    const userIds = Array.from(
      new Set(
        dueCalls.flatMap((c) => [c.user_id, c.callee_user_id]).filter(Boolean)
      )
    )
    const { data: profiles, error: profileError } = await supabase
      .from('profiles')
      .select('id, phone_number, email, timezone')
      .in('id', userIds)

    if (profileError) {
      return NextResponse.json({ error: profileError.message }, { status: 500 })
    }

    const emailByUserId = new Map<string, string>()
    const timezoneByUserId = new Map<string, string>()
    const phoneByUserId = new Map<string, string>()
    for (const p of profiles || []) {
      if (p.email) emailByUserId.set(p.id, p.email)
      if (p.timezone) timezoneByUserId.set(p.id, p.timezone)
      if (p.phone_number) phoneByUserId.set(p.id, p.phone_number)
    }

    const baseUrl = getAppBaseUrl()
    let emailSent = 0
    let smsSent = 0
    let failed = 0
    const failures: Array<{ callId: string; reason: string }> = []

    for (const call of dueCalls) {
      const scheduledAtMs = new Date(String(call.scheduled_for)).getTime()
      const initiatorPhone = call.user_id ? (phoneByUserId.get(call.user_id) ?? null) : null
      const initiatorLocale = inferLocaleFromPhone(initiatorPhone ?? '')

      // Initiator SMS: fire at ≤5 min before the call
      if (
        !call.initiator_reminder_sms_sent_at &&
        initiatorPhone &&
        scheduledAtMs <= now + smsBefore
      ) {
        const joinUrl = `${baseUrl}/call/${call.room_name}?callId=${call.id}`
        const initiatorTimezone = call.user_id ? (timezoneByUserId.get(call.user_id) ?? null) : null
        const displayTimezone = call.scheduled_timezone || initiatorTimezone
        const startsAt = toDisplayTime(String(call.scheduled_for), initiatorLocale, displayTimezone)

        const sms = await sendInitiatorReminderSMS(initiatorPhone, joinUrl, startsAt, initiatorLocale)
        recordSmsUsage(supabase, call.user_id || null, {
          provider: sms.provider || 'seven',
          success: !!sms.success,
          callId: call.id,
          phoneNumber: initiatorPhone,
          reason: sms.error,
        })
        if (sms.success) {
          await supabase
            .from('calls')
            .update({ initiator_reminder_sms_sent_at: new Date().toISOString() })
            .eq('id', call.id)
            .is('initiator_reminder_sms_sent_at', null)
          smsSent += 1
        } else {
          await logError({
            errorType: 'api_error',
            severity: 'warning',
            message: `Initiator reminder SMS failed for scheduled call ${call.id}`,
            userId: call.user_id || undefined,
            endpoint: '/api/internal/scheduled-call-reminders',
            method: 'POST',
            metadata: { callId: call.id, smsError: sms.error || 'sms_failed' },
          }).catch(() => {})
          failed += 1
          failures.push({ callId: call.id, reason: sms.error || 'sms_failed' })
        }
      }

      if (call.guest_reminder_email_sent_at) continue

      const guestEmail =
        call.guest_invite_email ||
        (call.callee_user_id ? emailByUserId.get(call.callee_user_id) : null)

      if (!guestEmail) continue

      const joinUrl = `${baseUrl}/call/${call.room_name}?callId=${call.id}`
      const startsAtIso = String(call.scheduled_for)
      const initiatorTimezone = call.user_id ? (timezoneByUserId.get(call.user_id) ?? null) : null
      const locale = inferLocaleFromPhone(call.user_id ? (phoneByUserId.get(call.user_id) ?? '') : '')
      const guestTimezone = call.scheduled_timezone || initiatorTimezone
      const startsAt = toDisplayTime(startsAtIso, locale, guestTimezone)

      const callTitle = call.contact_name?.trim() || null
      const subject = callTitle
        ? `Ihr Video Call "${callTitle}" beginnt in Kürze`
        : 'Ihr Video Call beginnt in Kürze'
      const body = [
        `<p>Hallo,</p>`,
        `<p>Ihr Notissima Video Call beginnt in Kürze.</p>`,
        `<p><strong>Wann:</strong> ${startsAt}</p>`,
        callTitle ? `<p><strong>Betreff:</strong> ${callTitle}</p>` : '',
        `<p><a href="${joinUrl}" style="display:inline-block;padding:12px 24px;background:#2563eb;color:#ffffff;text-decoration:none;border-radius:6px;font-weight:600;">Jetzt beitreten</a></p>`,
        `<p style="color:#6b7280;font-size:12px;">Link: ${joinUrl}</p>`,
      ].filter(Boolean).join('\n')
      const textBody = [
        'Ihr Notissima Video Call beginnt in Kürze.',
        `Wann: ${startsAt}`,
        callTitle ? `Betreff: ${callTitle}` : '',
        `Link: ${joinUrl}`,
      ].filter(Boolean).join('\n')

      const email = await sendCommunicationHubEmail({
        to: guestEmail,
        subject,
        body,
        fromName: 'Notissima',
        textBody,
      })

      if (!email.success) {
        await logError({
          errorType: 'api_error',
          severity: 'warning',
          message: `Guest reminder email failed for scheduled call ${call.id}`,
          userId: call.user_id || undefined,
          endpoint: '/api/internal/scheduled-call-reminders',
          method: 'POST',
          metadata: { callId: call.id, guestEmail, providerError: email.error || 'email_failed' },
        }).catch(() => {})
        failed += 1
        failures.push({ callId: call.id, reason: email.error || 'email_failed' })
      } else {
        const { error: updateError } = await supabase
          .from('calls')
          .update({ guest_reminder_email_sent_at: new Date().toISOString() })
          .eq('id', call.id)
          .is('guest_reminder_email_sent_at', null)

        if (updateError) {
          failed += 1
          failures.push({ callId: call.id, reason: `update_failed:${updateError.message}` })
        } else {
          emailSent += 1
        }
      }
    }

    return NextResponse.json({
      ok: true,
      checked: dueCalls.length,
      sent: emailSent,
      emailSent,
      smsSent,
      deletedExpired,
      failed,
      failures,
      leadMinutes,
      deleteGraceMinutes,
    })
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Internal server error' }, { status: 500 })
  }
}

