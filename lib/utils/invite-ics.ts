function toUtcStamp(iso: string): string {
  return new Date(iso).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z')
}

export function buildInviteIcs(params: {
  uid: string
  startIso: string
  endIso: string
  title: string
  description: string
  joinUrl: string
}): string {
  const nowStamp = toUtcStamp(new Date().toISOString())
  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Notissima//Scheduled Calls//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${params.uid}`,
    `DTSTAMP:${nowStamp}`,
    `DTSTART:${toUtcStamp(params.startIso)}`,
    `DTEND:${toUtcStamp(params.endIso)}`,
    `SUMMARY:${params.title}`,
    `DESCRIPTION:${params.description.replace(/\n/g, '\\n')}`,
    `LOCATION:${params.joinUrl}`,
    `URL:${params.joinUrl}`,
    'BEGIN:VALARM',
    'ACTION:DISPLAY',
    `DESCRIPTION:${params.title}`,
    'TRIGGER:-PT5M',
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR',
    '',
  ].join('\r\n')
}

