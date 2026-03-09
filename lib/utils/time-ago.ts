export function timeAgo(dateString: string): { key: string; count: number } {
  const now = Date.now()
  const date = new Date(dateString).getTime()
  const seconds = Math.floor((now - date) / 1000)

  if (seconds < 60) return { key: 'community.timeAgo.now', count: 0 }

  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return { key: 'community.timeAgo.minutes', count: minutes }

  const hours = Math.floor(minutes / 60)
  if (hours < 24) return { key: 'community.timeAgo.hours', count: hours }

  const days = Math.floor(hours / 24)
  if (days < 7) return { key: 'community.timeAgo.days', count: days }

  const weeks = Math.floor(days / 7)
  return { key: 'community.timeAgo.weeks', count: weeks }
}
