/**
 * Shared date and time formatting utilities
 * Uses locale-aware formatting via Intl API
 */

import { formatDistanceToNow, format, differenceInHours } from 'date-fns'
import { de, es, enUS } from 'date-fns/locale'

const dateFnsLocales: Record<string, any> = { de, es, en: enUS }

function getDateFnsLocale(locale?: string) {
  return dateFnsLocales[locale || 'en'] || enUS
}

function getIntlLocale(locale?: string): string {
  const map: Record<string, string> = { en: 'en-US', de: 'de-DE', es: 'es-ES' }
  return map[locale || 'en'] || locale || 'en-US'
}

/**
 * Format a date for session lists.
 * Shows relative time if < 8 hours, otherwise shows full date/time.
 */
export function formatSessionDate(dateString: string, locale?: string): string {
  const date = new Date(dateString)
  const hoursDiff = differenceInHours(new Date(), date)
  const dfLocale = getDateFnsLocale(locale)

  if (hoursDiff > 8) {
    const pattern = locale === 'en' ? 'MM/dd/yyyy HH:mm' : 'dd.MM.yyyy HH:mm'
    return format(date, pattern, { locale: dfLocale })
  } else {
    return formatDistanceToNow(date, { addSuffix: true, locale: dfLocale })
  }
}

/**
 * Format a date for detailed views using Intl.DateTimeFormat.
 */
export function formatDetailDate(dateString: string, locale?: string): string {
  const date = new Date(dateString)
  return date.toLocaleString(getIntlLocale(locale), {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

/**
 * Short date for compact displays (e.g. output cards).
 */
export function formatShortDate(dateString: string, locale?: string): string {
  const date = new Date(dateString)
  return date.toLocaleDateString(getIntlLocale(locale), {
    month: 'short',
    day: 'numeric',
  })
}

/**
 * Timestamp for logs (month short, day, time).
 */
export function formatTimestamp(dateString: string, locale?: string): string {
  const date = new Date(dateString)
  return date.toLocaleString(getIntlLocale(locale), {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
}

/**
 * Format duration in seconds to MM:SS
 */
export function formatDuration(seconds: number): string {
  if (seconds === 0) return '-'
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  return `${mins}:${secs.toString().padStart(2, '0')}`
}

/**
 * Format timecode in milliseconds to MM:SS
 */
export function formatTimecode(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${minutes}:${seconds.toString().padStart(2, '0')}`
}

/**
 * Format file size in bytes to human-readable format
 */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + ' KB'
  return (bytes / (1024 * 1024)).toFixed(2) + ' MB'
}
