export function formatScheduledCallTime(
  iso: string,
  timezone: string,
  locale = 'de-DE'
): string {
  return new Date(iso).toLocaleString(locale, {
    timeZone: timezone,
    weekday: 'short',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZoneName: 'short',
  })
}

export function scheduledCallEndMs(
  scheduledFor: string,
  durationMin: number | null | undefined
): number {
  return new Date(scheduledFor).getTime() + Number(durationMin || 30) * 60 * 1000
}

export function toDatetimeLocalInputValue(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}
