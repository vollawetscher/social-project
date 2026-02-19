"use client"

import { useState, useMemo } from "react"
import { useRouter } from "next/navigation"
import {
  Phone,
  Video,
  Clock,
  ChevronRight,
  PhoneOutgoing,
  PhoneIncoming,
  PhoneMissed,
  Users,
  ArrowLeft,
  Filter,
  FileText,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import {
  mockRecentCalls,
  formatCallDuration,
  formatRelativeTime,
} from "@/lib/mock/mobile-data"
import type { CallMode } from "@/lib/mobile-types"

type FilterType = "all" | "audio" | "video" | "transcribed"

export default function CallHistoryPage() {
  const router = useRouter()
  const [filter, setFilter] = useState<FilterType>("all")

  const filteredCalls = useMemo(() => {
    switch (filter) {
      case "audio":
        return mockRecentCalls.filter((c) => c.mode === "audio")
      case "video":
        return mockRecentCalls.filter((c) => c.mode === "video")
      case "transcribed":
        return mockRecentCalls.filter((c) => c.sessionId)
      default:
        return mockRecentCalls
    }
  }, [filter])

  const filters: { id: FilterType; label: string; count: number }[] = [
    { id: "all", label: "All", count: mockRecentCalls.length },
    { id: "audio", label: "Audio", count: mockRecentCalls.filter((c) => c.mode === "audio").length },
    { id: "video", label: "Video", count: mockRecentCalls.filter((c) => c.mode === "video").length },
    { id: "transcribed", label: "Transcribed", count: mockRecentCalls.filter((c) => c.sessionId).length },
  ]

  const handleCall = (mode: CallMode, phone: string, contactId?: string) => {
    const params = new URLSearchParams({ phone, mode })
    if (contactId) params.set("contactId", contactId)
    if (mode === "video") {
      router.push(`/mobile/room?${params.toString()}`)
    } else {
      router.push(`/mobile/call?${params.toString()}`)
    }
  }

  return (
    <div className="flex flex-col h-screen bg-background">
      {/* Header */}
      <header className="flex items-center gap-3 px-4 py-3 border-b border-border bg-card shrink-0">
        <button onClick={() => router.push("/mobile")} className="hover:opacity-80 transition-opacity">
          <ArrowLeft className="h-5 w-5 text-foreground" />
        </button>
        <div className="flex-1">
          <h1 className="text-base font-semibold text-foreground">Call History</h1>
          <p className="text-xs text-muted-foreground">{mockRecentCalls.length} calls total</p>
        </div>
        <Filter className="h-4 w-4 text-muted-foreground" />
      </header>

      {/* Filter Pills */}
      <div className="flex gap-2 px-4 py-3 border-b border-border bg-card overflow-x-auto shrink-0">
        {filters.map((f) => (
          <button
            key={f.id}
            onClick={() => setFilter(f.id)}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors shrink-0",
              filter === f.id
                ? "bg-primary text-primary-foreground"
                : "bg-secondary text-muted-foreground hover:text-foreground"
            )}
          >
            {f.label}
            <span className={cn(
              "text-[10px] px-1 py-0.5 rounded-full min-w-[18px] text-center",
              filter === f.id ? "bg-primary-foreground/20" : "bg-muted"
            )}>
              {f.count}
            </span>
          </button>
        ))}
      </div>

      {/* Call List */}
      <div className="flex-1 overflow-y-auto">
        {filteredCalls.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <Clock className="h-12 w-12 text-muted-foreground/50 mb-4" />
            <p className="text-muted-foreground">No calls found</p>
            <p className="text-xs text-muted-foreground mt-1">
              Try adjusting the filter
            </p>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {filteredCalls.map((call) => (
              <div
                key={call.id}
                className="flex items-center gap-3 px-4 py-3 hover:bg-secondary/50 transition-colors"
              >
                {/* Avatar with mode indicator */}
                <div className="relative shrink-0">
                  <Avatar className="h-11 w-11">
                    <AvatarFallback className="bg-secondary text-foreground text-sm">
                      {call.contact.initials}
                    </AvatarFallback>
                  </Avatar>
                  <div className={cn(
                    "absolute -bottom-0.5 -right-0.5 h-5 w-5 rounded-full flex items-center justify-center ring-2 ring-card",
                    call.mode === "video" ? "bg-info" : "bg-primary"
                  )}>
                    {call.mode === "video" ? (
                      <Video className="h-2.5 w-2.5 text-info-foreground" />
                    ) : (
                      <Phone className="h-2.5 w-2.5 text-primary-foreground" />
                    )}
                  </div>
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className={cn(
                      "font-medium truncate",
                      call.type === "missed" ? "text-destructive" : "text-foreground"
                    )}>
                      {call.contact.name}
                    </span>
                    {call.sessionId && (
                      <Badge variant="secondary" className="shrink-0 text-[10px] px-1.5 py-0 h-4 bg-primary/10 text-primary border-0 gap-0.5">
                        <FileText className="h-2.5 w-2.5" />
                        Transcribed
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-2 mt-0.5">
                    {call.type === "outgoing" ? (
                      <PhoneOutgoing className="h-3 w-3 text-muted-foreground" />
                    ) : call.type === "missed" ? (
                      <PhoneMissed className="h-3 w-3 text-destructive" />
                    ) : (
                      <PhoneIncoming className="h-3 w-3 text-primary" />
                    )}
                    <span className="text-xs text-muted-foreground">
                      {formatRelativeTime(call.timestamp)}
                      {call.duration > 0 && ` \u00B7 ${formatCallDuration(call.duration)}`}
                    </span>
                    {call.participants && call.participants > 1 && (
                      <span className="text-xs text-muted-foreground flex items-center gap-0.5">
                        <Users className="h-3 w-3" />
                        {call.participants}
                      </span>
                    )}
                  </div>
                </div>

                {/* Quick redial */}
                <button
                  onClick={() => handleCall(call.mode, call.contact.phone, call.contact.id)}
                  className={cn(
                    "h-9 w-9 rounded-full flex items-center justify-center shrink-0 transition-colors",
                    call.mode === "video"
                      ? "bg-info/10 hover:bg-info/20"
                      : "bg-primary/10 hover:bg-primary/20"
                  )}
                >
                  {call.mode === "video" ? (
                    <Video className="h-4 w-4 text-info" />
                  ) : (
                    <Phone className="h-4 w-4 text-primary" />
                  )}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
