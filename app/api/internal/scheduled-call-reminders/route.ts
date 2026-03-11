import { NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { inferLocaleFromPhone } from '@/lib/services/locale-from-phone'
import { sendInitiatorReminderSMS } from '@/lib/services/sms'

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
      .select('id, user_id, room_name, scheduled_for')
      .in('status', ['scheduled', 'invited', 'waiting'])
      .not('user_id', 'is', null)
      .not('room_name', 'is', null)
      .gte('scheduled_for', new Date(now).toISOString())
      .lte('scheduled_for', new Date(windowEnd).toISOString())
      .is('initiator_reminder_sms_sent_at', null)
      .order('scheduled_for', { ascending: true })
      .limit(200)

    if (dueCallsError) {
      return NextResponse.json({ error: dueCallsError.message }, { status: 500 })
    }

    if (!dueCalls || dueCalls.length === 0) {
      return NextResponse.json({ ok: true, checked: 0, sent: 0, failed: 0 })
    }

    const userIds = Array.from(new Set(dueCalls.map((c) => c.user_id).filter(Boolean)))
    const { data: profiles, error: profileError } = await supabase
      .from('profiles')
      .select('id, phone_number')
      .in('id', userIds)

    if (profileError) {
      return NextResponse.json({ error: profileError.message }, { status: 500 })
    }

    const phoneByUserId = new Map<string, string>()
    for (const p of profiles || []) {
      if (p.phone_number) phoneByUserId.set(p.id, p.phone_number)
    }

    const baseUrl = resolveBaseUrl()
    let sent = 0
    let failed = 0
    const failures: Array<{ callId: string; reason: string }> = []

    for (const call of dueCalls) {
      const phone = call.user_id ? phoneByUserId.get(call.user_id) : null
      if (!phone) {
        failed += 1
        failures.push({ callId: call.id, reason: 'missing_phone' })
        continue
      }

      const locale = inferLocaleFromPhone(phone)
      const joinUrl = `${baseUrl}/call/${call.room_name}?callId=${call.id}`
      const startsAt = toDisplayTime(String(call.scheduled_for), locale)
      const sms = await sendInitiatorReminderSMS(phone, joinUrl, startsAt, locale)
      if (!sms.success) {
        failed += 1
        failures.push({ callId: call.id, reason: sms.error || 'sms_failed' })
        continue
      }

      const { error: updateError } = await supabase
        .from('calls')
        .update({ initiator_reminder_sms_sent_at: new Date().toISOString() })
        .eq('id', call.id)
        .is('initiator_reminder_sms_sent_at', null)

      if (updateError) {
        failed += 1
        failures.push({ callId: call.id, reason: `update_failed:${updateError.message}` })
        continue
      }

      sent += 1
    }

    return NextResponse.json({
      ok: true,
      checked: dueCalls.length,
      sent,
      failed,
      failures,
      leadMinutes,
    })
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Internal server error' }, { status: 500 })
  }
}

