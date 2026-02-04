import type { Contact, RecentCall, LiveTranscriptSegment } from "@/lib/mobile-types"

export const mockContacts: Contact[] = [
  { id: "c1", name: "John Smith", phone: "+1 (555) 123-4567", initials: "JS" },
  { id: "c2", name: "Sarah Williams", phone: "+1 (555) 234-5678", initials: "SW" },
  { id: "c3", name: "Michael Chen", phone: "+1 (555) 345-6789", initials: "MC" },
  { id: "c4", name: "Emily Davis", phone: "+1 (555) 456-7890", initials: "ED" },
  { id: "c5", name: "Robert Johnson", phone: "+1 (555) 567-8901", initials: "RJ" },
  { id: "c6", name: "Amanda Miller", phone: "+1 (555) 678-9012", initials: "AM" },
  { id: "c7", name: "David Lee", phone: "+1 (555) 789-0123", initials: "DL" },
  { id: "c8", name: "Jennifer Brown", phone: "+1 (555) 890-1234", initials: "JB" },
]

export const mockRecentCalls: RecentCall[] = [
  {
    id: "rc1",
    contact: mockContacts[0],
    timestamp: new Date(Date.now() - 1000 * 60 * 30).toISOString(), // 30 min ago
    duration: 845,
    type: "outgoing",
    sessionId: "session-1",
  },
  {
    id: "rc2",
    contact: mockContacts[2],
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(), // 2 hours ago
    duration: 1230,
    type: "outgoing",
    sessionId: "session-2",
  },
  {
    id: "rc3",
    contact: mockContacts[4],
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(), // Yesterday
    duration: 456,
    type: "outgoing",
    sessionId: "session-3",
  },
  {
    id: "rc4",
    contact: mockContacts[1],
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 48).toISOString(), // 2 days ago
    duration: 0,
    type: "missed",
  },
]

export const mockLiveTranscript: LiveTranscriptSegment[] = [
  { id: "t1", speaker: "user", text: "Hi John, thanks for taking my call.", timestamp: 5, isFinal: true },
  { id: "t2", speaker: "other", text: "Of course, what can I help you with today?", timestamp: 12, isFinal: true },
  { id: "t3", speaker: "user", text: "I wanted to discuss the contract terms we talked about last week.", timestamp: 20, isFinal: true },
  { id: "t4", speaker: "other", text: "Sure, I've had a chance to review everything with my team.", timestamp: 28, isFinal: true },
  { id: "t5", speaker: "other", text: "We're generally happy with the proposal, but...", timestamp: 35, isFinal: false },
]

export function formatPhoneNumber(phone: string): string {
  return phone
}

export function formatCallDuration(seconds: number): string {
  const hrs = Math.floor(seconds / 3600)
  const mins = Math.floor((seconds % 3600) / 60)
  const secs = seconds % 60
  
  if (hrs > 0) {
    return `${hrs}:${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`
  }
  return `${mins}:${secs.toString().padStart(2, "0")}`
}

export function formatRelativeTime(timestamp: string): string {
  const date = new Date(timestamp)
  const now = new Date()
  const diff = now.getTime() - date.getTime()
  
  const minutes = Math.floor(diff / (1000 * 60))
  const hours = Math.floor(diff / (1000 * 60 * 60))
  const days = Math.floor(diff / (1000 * 60 * 60 * 24))
  
  if (minutes < 60) return `${minutes}m ago`
  if (hours < 24) return `${hours}h ago`
  if (days === 1) return "Yesterday"
  if (days < 7) return `${days}d ago`
  return date.toLocaleDateString()
}
