import { NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { inferLocaleFromPhone } from '@/lib/services/locale-from-phone'
import { sendInitiatorReminderSMS } from '@/lib/services/sms'
import { sendCommunicationHubEmail } from '@/lib/services/communication-hub-email'
import { logError } from '@/lib/services/error-logger'

function resolveBaseUrl(): string {
  return (
    process.env.NEXT_PUBLIC_APP_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null) ||
    (process.env.RAILWAY_PUBLIC_DOMAIN ? `https://${process.env.RAILWAY_PUBLIC_DOMAIN}` : null) ||
    'http://localhost:3000'
  )
}

function toDisplayTime(iso: string, locale: 'en' | 'de' | 'es') {
  const localeMap = { en: 'en-US', de: 'de-DE', es: 'es-ES' } as const
  return new Date(iso).toLocaleString(localeMap[locale], {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

/**
 * POST /api/internal/scheduled-call-reminders
 * Sends one-time initiator SMS reminders for scheduled calls that start soon.
 *
 * Security: Requires x-internal-secret header when INTERNAL_API_SECRET is set.
 * Scheduler: Run every minute from Railway cron/job.
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

    const { data: dueCalls, error: dueCallsError } = await supabase
      .from('calls')
      .select('id, user_id, callee_user_id, room_name, contact_name, scheduled_for, guest_invite_email, initiator_reminder_sms_sent_at, guest_reminder_email_sent_at')
      .in('status', ['scheduled', 'invited', 'waiting'])
      .not('user_id', 'is', null)
      .not('room_name', 'is', null)
      .gte('scheduled_for', new Date(now).toISOString())
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
      .select('id, phone_number, email')
      .in('id', userIds)

    if (profileError) {
      return NextResponse.json({ error: profileError.message }, { status: 500 })
    }

    const phoneByUserId = new Map<string, string>()
    const emailByUserId = new Map<string, string>()
    for (const p of profiles || []) {
      if (p.phone_number) phoneByUserId.set(p.id, p.phone_number)
      if (p.email) emailByUserId.set(p.id, p.email)
    }

    const baseUrl = resolveBaseUrl()
    let smsSent = 0
    let emailSent = 0
    let failed = 0
    const failures: Array<{ callId: string; channel: 'sms' | 'email'; reason: string }> = []

    for (const call of dueCalls) {
      const joinUrl = `${baseUrl}/call/${call.room_name}?callId=${call.id}`
      const startsAtIso = String(call.scheduled_for)

      if (!call.initiator_reminder_sms_sent_at) {
        const phone = call.user_id ? phoneByUserId.get(call.user_id) : null
        if (!phone) {
          failed += 1
          failures.push({ callId: call.id, channel: 'sms', reason: 'missing_phone' })
        } else {
          const locale = inferLocaleFromPhone(phone)
          const startsAt = toDisplayTime(startsAtIso, locale)
          const sms = await sendInitiatorReminderSMS(phone, joinUrl, startsAt, locale)
          if (!sms.success) {
            failed += 1
            failures.push({ callId: call.id, channel: 'sms', reason: sms.error || 'sms_failed' })
          } else {
            const { error: updateError } = await supabase
              .from('calls')
              .update({ initiator_reminder_sms_sent_at: new Date().toISOString() })
              .eq('id', call.id)
              .is('initiator_reminder_sms_sent_at', null)

            if (updateError) {
              failed += 1
              failures.push({ callId: call.id, channel: 'sms', reason: `update_failed:${updateError.message}` })
            } else {
              smsSent += 1
            }
          }
        }
      }

      if (!call.guest_reminder_email_sent_at) {
        const guestEmail =
          call.guest_invite_email ||
          (call.callee_user_id ? emailByUserId.get(call.callee_user_id) : null)

        if (!guestEmail) {
          continue
        }

        const startsAt = new Date(startsAtIso).toLocaleString()
        const subject = call.contact_name?.trim()
          ? `Reminder: ${call.contact_name} starts soon`
          : 'Reminder: Your Notissima call starts soon'
        const body = `<p>Reminder: your scheduled Notissima video call starts at ${startsAt}.</p><p><a href="${joinUrl}">Join call</a></p>`
        const email = await sendCommunicationHubEmail({
          to: guestEmail,
          subject,
          body,
        })

        if (!email.success) {
          await logError({
            errorType: 'api_error',
            severity: 'warning',
            message: `Guest reminder email failed for scheduled call ${call.id}`,
            userId: call.user_id || undefined,
            endpoint: '/api/internal/scheduled-call-reminders',
            method: 'POST',
            metadata: {
              callId: call.id,
              guestEmail,
              provider: 'communication-hub',
              providerError: email.error || 'email_failed',
            },
          }).catch(() => {})

          failed += 1
          failures.push({ callId: call.id, channel: 'email', reason: email.error || 'email_failed' })
        } else {
          const { error: updateError } = await supabase
            .from('calls')
            .update({ guest_reminder_email_sent_at: new Date().toISOString() })
            .eq('id', call.id)
            .is('guest_reminder_email_sent_at', null)

          if (updateError) {
            failed += 1
            failures.push({ callId: call.id, channel: 'email', reason: `update_failed:${updateError.message}` })
          } else {
            emailSent += 1
          }
        }
      }
    }

    return NextResponse.json({
      ok: true,
      checked: dueCalls.length,
      sent: smsSent + emailSent,
      smsSent,
      emailSent,
      failed,
      failures,
      leadMinutes,
    })
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Internal server error' }, { status: 500 })
  }
}

