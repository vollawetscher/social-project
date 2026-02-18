"use client"

import { useState, useMemo, useEffect } from "react"
import { useRouter } from "next/navigation"
import {
  Phone,
  Video,
  Clock,
  Search,
  Grid3X3,
  Users,
  ChevronRight,
  PhoneOutgoing,
  PhoneIncoming,
  PhoneMissed,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { DialPad } from "@/components/call/DialPad"
import type { Call, CallMode } from "@/lib/types/call"

type TabType = "recent" | "contacts" | "dialpad"

function formatCallDuration(seconds: number): string {
  const hrs = Math.floor(seconds / 3600)
  const mins = Math.floor((seconds % 3600) / 60)
  const secs = seconds % 60
  if (hrs > 0) return `${hrs}:${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`
  return `${mins}:${secs.toString().padStart(2, "0")}`
}

function formatRelativeTime(timestamp: string): string {
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

export default function CallsPage() {
  const router = useRouter()
  const [activeTab, setActiveTab] = useState<TabType>("recent")
  const [calls, setCalls] = useState<Call[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)

  useEffect(() => {
    fetchCalls()
  }, [])

  async function fetchCalls() {
    try {
      const res = await fetch("/api/calls")
      if (res.ok) {
        const data = await res.json()
        setCalls(data.calls || [])
      }
    } catch (err) {
      console.error("[Calls] Failed to fetch calls:", err)
    } finally {
      setLoading(false)
    }
  }

  async function handleNewCall(mode: CallMode) {
    if (creating) return
    setCreating(true)
    try {
      const res = await fetch("/api/calls", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ callType: "web", mode }),
      })
      if (res.ok) {
        const data = await res.json()
        router.push(`/call/${data.roomName}?callId=${data.callId}&token=${encodeURIComponent(data.token)}&mode=${mode}`)
      }
    } catch (err) {
      console.error("[Calls] Failed to create call:", err)
    } finally {
      setCreating(false)
    }
  }

  async function handleDialpadCall(phoneNumber: string, mode: CallMode) {
    if (creating) return
    setCreating(true)
    try {
      const res = await fetch("/api/calls", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ callType: "pstn_outbound", mode }),
      })
      if (!res.ok) throw new Error("Failed to create call")
      const data = await res.json()

      // Dial the phone number
      const dialRes = await fetch(`/api/calls/${data.callId}/dial`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phoneNumber }),
      })
      if (!dialRes.ok) throw new Error("Failed to dial")

      router.push(`/call/${data.roomName}?callId=${data.callId}&token=${encodeURIComponent(data.token)}&mode=${mode}&phone=${encodeURIComponent(phoneNumber)}`)
    } catch (err) {
      console.error("[Calls] Failed to create PSTN call:", err)
    } finally {
      setCreating(false)
    }
  }

  const tabs = [
    { id: "recent" as const, label: "Recent", icon: Clock },
    { id: "contacts" as const, label: "Contacts", icon: Users },
    { id: "dialpad" as const, label: "Dialpad", icon: Grid3X3 },
  ]

  const recentCalls = useMemo(() => {
    return calls.filter((c) => c.status === "done" || c.status === "ended" || c.status === "error")
  }, [calls])

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Quick Actions */}
      <div className="px-4 py-4 border-b border-border">
        <h1 className="text-lg font-semibold text-foreground mb-3">Calls</h1>
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => {
              if (activeTab === "dialpad") return
              handleNewCall("audio")
            }}
            disabled={creating}
            className="flex items-center gap-3 p-3 rounded-xl bg-primary/10 hover:bg-primary/15 transition-colors disabled:opacity-50"
          >
            <div className="h-10 w-10 rounded-full bg-primary flex items-center justify-center shrink-0">
              <Phone className="h-5 w-5 text-primary-foreground" />
            </div>
            <div className="text-left">
              <p className="text-sm font-medium text-foreground">Audio Call</p>
              <p className="text-[11px] text-muted-foreground">Twilio + Transcription</p>
            </div>
          </button>
          <button
            onClick={() => handleNewCall("video")}
            disabled={creating}
            className="flex items-center gap-3 p-3 rounded-xl bg-info/10 hover:bg-info/15 transition-colors disabled:opacity-50"
          >
            <div className="h-10 w-10 rounded-full bg-info flex items-center justify-center shrink-0">
              <Video className="h-5 w-5 text-info-foreground" />
            </div>
            <div className="text-left">
              <p className="text-sm font-medium text-foreground">Video Call</p>
              <p className="text-[11px] text-muted-foreground">LiveKit + Transcription</p>
            </div>
          </button>
        </div>
      </div>

      {/* Tab Bar */}
      <div className="flex border-b border-border bg-card">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              "flex-1 flex items-center justify-center gap-1.5 py-3 text-sm font-medium transition-colors border-b-2",
              activeTab === tab.id
                ? "text-primary border-primary"
                : "text-muted-foreground border-transparent hover:text-foreground"
            )}
          >
            <tab.icon className="h-4 w-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-y-auto">
        {/* Recent Calls */}
        {activeTab === "recent" && (
          <div>
            {loading ? (
              <div className="flex items-center justify-center py-16">
                <p className="text-sm text-muted-foreground">Loading calls...</p>
              </div>
            ) : recentCalls.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <Clock className="h-12 w-12 text-muted-foreground/50 mb-4" />
                <p className="text-muted-foreground">No recent calls</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Your transcribed calls will appear here
                </p>
              </div>
            ) : (
              <div className="divide-y divide-border">
                {recentCalls.map((call) => {
                  const isVideo = call.call_type === "web"
                  const name = call.participant_b_identity || call.phone_number || "Unknown"
                  const initials = name.slice(0, 2).toUpperCase()
                  const durationSec = call.started_at && call.ended_at
                    ? Math.round((new Date(call.ended_at).getTime() - new Date(call.started_at).getTime()) / 1000)
                    : 0

                  return (
                    <button
                      key={call.id}
                      onClick={() => {
                        if (call.session_id) router.push(`/sessions/${call.session_id}`)
                      }}
                      className="w-full flex items-center gap-3 px-4 py-3 hover:bg-secondary/50 transition-colors text-left"
                    >
                      <div className="relative">
                        <Avatar className="h-11 w-11">
                          <AvatarFallback className="bg-secondary text-foreground text-sm">
                            {initials}
                          </AvatarFallback>
                        </Avatar>
                        {isVideo && (
                          <div className="absolute -bottom-0.5 -right-0.5 h-5 w-5 rounded-full bg-info flex items-center justify-center ring-2 ring-card">
                            <Video className="h-2.5 w-2.5 text-info-foreground" />
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-foreground truncate">{name}</span>
                          {call.session_id && call.status === "done" && (
                            <Badge variant="secondary" className="shrink-0 text-[10px] px-1.5 py-0 h-4 bg-primary/10 text-primary border-0">
                              Transcribed
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-2 mt-0.5">
                          <PhoneOutgoing className="h-3 w-3 text-muted-foreground" />
                          <span className="text-xs text-muted-foreground">
                            {formatRelativeTime(call.created_at)}
                            {durationSec > 0 && ` · ${formatCallDuration(durationSec)}`}
                          </span>
                        </div>
                      </div>
                      <ChevronRight className="h-5 w-5 text-muted-foreground shrink-0" />
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {/* Contacts - placeholder for now */}
        {activeTab === "contacts" && (
          <div className="p-4">
            <div className="relative mb-4">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                type="search"
                placeholder="Search contacts..."
                className="pl-9 bg-secondary border-border"
              />
            </div>
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Users className="h-12 w-12 text-muted-foreground/50 mb-4" />
              <p className="text-muted-foreground">Contact list coming soon</p>
              <p className="text-xs text-muted-foreground mt-1">
                Use the dialpad to call a phone number
              </p>
            </div>
          </div>
        )}

        {/* Dialpad */}
        {activeTab === "dialpad" && (
          <DialPad onCall={handleDialpadCall} disabled={creating} />
        )}
      </div>
    </div>
  )
}
