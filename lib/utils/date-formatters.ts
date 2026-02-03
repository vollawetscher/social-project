/**
 * Shared date and time formatting utilities
 */

import { formatDistanceToNow, format, differenceInHours } from 'date-fns'
import { de } from 'date-fns/locale'

/**
 * Format a date for session lists
 * Shows relative time if < 8 hours, otherwise shows full date/time
 */
export function formatSessionDate(dateString: string): string {
  const date = new Date(dateString)
  const hoursDiff = differenceInHours(new Date(), date)
  
  if (hoursDiff > 8) {
    return format(date, 'dd.MM.yyyy HH:mm', { locale: de })
  } else {
    return formatDistanceToNow(date, {
      addSuffix: true,
      locale: de,
    })
  }
}

/**
 * Format a date for detailed views
 */
export function formatDetailDate(dateString: string): string {
  const date = new Date(dateString)
  return date.toLocaleString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
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
