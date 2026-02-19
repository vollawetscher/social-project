import type { Contact, RecentCall } from "./types"

export const mockContacts: Contact[] = [
  { id: "c1", name: "Alice Johnson", phone: "+1 (555) 123-4567", initials: "AJ" },
  { id: "c2", name: "Bob Smith", phone: "+1 (555) 234-5678", initials: "BS" },
  { id: "c3", name: "Carol Williams", phone: "+1 (555) 345-6789", initials: "CW" },
  { id: "c4", name: "David Brown", phone: "+1 (555) 456-7890", initials: "DB" },
  { id: "c5", name: "Emma Davis", phone: "+1 (555) 567-8901", initials: "ED" },
  { id: "c6", name: "Frank Miller", phone: "+1 (555) 678-9012", initials: "FM" },
  { id: "c7", name: "Grace Wilson", phone: "+1 (555) 789-0123", initials: "GW" },
  { id: "c8", name: "Henry Taylor", phone: "+1 (555) 890-1234", initials: "HT" },
  { id: "c9", name: "Ivy Anderson", phone: "+1 (555) 901-2345", initials: "IA" },
  { id: "c10", name: "Jack Thomas", phone: "+1 (555) 012-3456", initials: "JT" },
]

export const mockRecentCalls: RecentCall[] = [
  {
    id: "r1",
    contact: mockContacts[0],
    timestamp: "2025-02-04T14:30:00Z",
    duration: 847,
    type: "outgoing",
    isTranscribed: true,
    sessionId: "session-1",
  },
  {
    id: "r2",
    contact: mockContacts[2],
    timestamp: "2025-02-04T11:15:00Z",
    duration: 312,
    type: "incoming",
    isTranscribed: true,
    sessionId: "session-2",
  },
  {
    id: "r3",
    contact: mockContacts[4],
    timestamp: "2025-02-03T16:45:00Z",
    duration: 0,
    type: "missed",
    isTranscribed: false,
  },
  {
    id: "r4",
    contact: mockContacts[1],
    timestamp: "2025-02-03T09:20:00Z",
    duration: 1523,
    type: "outgoing",
    isTranscribed: true,
    sessionId: "session-3",
  },
  {
    id: "r5",
    contact: mockContacts[5],
    timestamp: "2025-02-02T13:00:00Z",
    duration: 425,
    type: "incoming",
    isTranscribed: false,
  },
]

export function formatDuration(seconds: number): string {
  const hrs = Math.floor(seconds / 3600)
  const mins = Math.floor((seconds % 3600) / 60)
  const secs = seconds % 60
  if (hrs > 0) {
    return `${hrs}:${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`
  }
  return `${mins}:${secs.toString().padStart(2, "0")}`
}

export function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)

  if (diffMins < 1) return "Just now"
  if (diffMins < 60) return `${diffMins}m ago`
  if (diffHours < 24) return `${diffHours}h ago`
  if (diffDays === 1) return "Yesterday"
  if (diffDays < 7) return `${diffDays}d ago`
  return date.toLocaleDateString()
}
