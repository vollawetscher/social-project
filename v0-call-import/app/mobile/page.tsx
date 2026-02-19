"use client"

import { useState, useMemo } from "react"
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
  Delete,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import {
  mockContacts,
  mockRecentCalls,
  formatPhoneNumber,
  formatCallDuration,
  formatRelativeTime,
} from "@/lib/mock/mobile-data"

type TabType = "recent" | "contacts" | "dialpad"

export default function MobileDialerPage() {
  const router = useRouter()
  const [activeTab, setActiveTab] = useState<TabType>("recent")
  const [searchQuery, setSearchQuery] = useState("")
  const [dialpadNumber, setDialpadNumber] = useState("")

  const filteredContacts = useMemo(() => {
    if (!searchQuery) return mockContacts
    const query = searchQuery.toLowerCase()
    return mockContacts.filter(
      (c) =>
        c.name.toLowerCase().includes(query) ||
        c.phone.includes(query)
    )
  }, [searchQuery])

  const handleCall = (mode: "audio" | "video", phone: string, contactId?: string) => {
    const params = new URLSearchParams({ phone, mode })
    if (contactId) params.set("contactId", contactId)
    if (mode === "video") {
      router.push(`/mobile/room?${params.toString()}`)
    } else {
      router.push(`/mobile/call?${params.toString()}`)
    }
  }

  const handleDialpadPress = (digit: string) => {
    setDialpadNumber((prev) => prev + digit)
  }

  const handleDialpadDelete = () => {
    setDialpadNumber((prev) => prev.slice(0, -1))
  }

  const dialpadKeys = [
    { digit: "1", letters: "" },
    { digit: "2", letters: "ABC" },
    { digit: "3", letters: "DEF" },
    { digit: "4", letters: "GHI" },
    { digit: "5", letters: "JKL" },
    { digit: "6", letters: "MNO" },
    { digit: "7", letters: "PQRS" },
    { digit: "8", letters: "TUV" },
    { digit: "9", letters: "WXYZ" },
    { digit: "*", letters: "" },
    { digit: "0", letters: "+" },
    { digit: "#", letters: "" },
  ]

  const tabs = [
    { id: "recent" as const, label: "Recent", icon: Clock },
    { id: "contacts" as const, label: "Contacts", icon: Users },
    { id: "dialpad" as const, label: "Dialpad", icon: Grid3X3 },
  ]

  return (
    <div className="flex flex-col h-screen bg-background">
      {/* Header */}
      <header className="flex items-center justify-between px-4 py-3 border-b border-border bg-card">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center">
            <Phone className="h-4 w-4 text-primary-foreground" />
          </div>
          <span className="font-semibold text-foreground">Notissima</span>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="gap-1.5 bg-transparent"
          onClick={() => router.push("/mobile/room?mode=create")}
        >
          <Video className="h-3.5 w-3.5" />
          New Room
        </Button>
      </header>

      {/* Quick Actions */}
      <div className="px-4 py-3 bg-card border-b border-border">
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => {
              if (activeTab === "dialpad" && dialpadNumber) {
                handleCall("audio", dialpadNumber)
              } else {
                setActiveTab("dialpad")
              }
            }}
            className="flex items-center gap-3 p-3 rounded-xl bg-primary/10 hover:bg-primary/15 transition-colors"
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
            onClick={() => {
              if (activeTab === "dialpad" && dialpadNumber) {
                handleCall("video", dialpadNumber)
              } else {
                setActiveTab("contacts")
              }
            }}
            className="flex items-center gap-3 p-3 rounded-xl bg-info/10 hover:bg-info/15 transition-colors"
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

      {/* Content Area */}
      <div className="flex-1 overflow-y-auto">
        {/* Recent Calls */}
        {activeTab === "recent" && (
          <div className="divide-y divide-border">
            {mockRecentCalls.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <Clock className="h-12 w-12 text-muted-foreground/50 mb-4" />
                <p className="text-muted-foreground">No recent calls</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Your transcribed calls will appear here
                </p>
              </div>
            ) : (
              mockRecentCalls.map((call) => (
                <button
                  key={call.id}
                  onClick={() => handleCall(call.mode, call.contact.phone, call.contact.id)}
                  className="w-full flex items-center gap-3 px-4 py-3 hover:bg-secondary/50 transition-colors text-left"
                >
                  <div className="relative">
                    <Avatar className="h-11 w-11">
                      <AvatarFallback className="bg-secondary text-foreground text-sm">
                        {call.contact.initials}
                      </AvatarFallback>
                    </Avatar>
                    {call.mode === "video" && (
                      <div className="absolute -bottom-0.5 -right-0.5 h-5 w-5 rounded-full bg-info flex items-center justify-center ring-2 ring-card">
                        <Video className="h-2.5 w-2.5 text-info-foreground" />
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-foreground truncate">
                        {call.contact.name}
                      </span>
                      {call.sessionId && (
                        <Badge variant="secondary" className="shrink-0 text-[10px] px-1.5 py-0 h-4 bg-primary/10 text-primary border-0">
                          Transcribed
                        </Badge>
                      )}
                      {call.mode === "video" && (
                        <Badge variant="secondary" className="shrink-0 text-[10px] px-1.5 py-0 h-4 bg-info/10 text-info border-0">
                          Video
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
                  <ChevronRight className="h-5 w-5 text-muted-foreground shrink-0" />
                </button>
              ))
            )}
          </div>
        )}

        {/* Contacts */}
        {activeTab === "contacts" && (
          <div>
            <div className="p-3 border-b border-border bg-card sticky top-0 z-10">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  type="search"
                  placeholder="Search contacts..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 bg-secondary border-border"
                />
              </div>
            </div>
            <div className="divide-y divide-border">
              {filteredContacts.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <Search className="h-12 w-12 text-muted-foreground/50 mb-4" />
                  <p className="text-muted-foreground">No contacts found</p>
                </div>
              ) : (
                filteredContacts.map((contact) => (
                  <div
                    key={contact.id}
                    className="flex items-center gap-3 px-4 py-3 hover:bg-secondary/50 transition-colors"
                  >
                    <Avatar className="h-11 w-11">
                      <AvatarFallback className="bg-secondary text-foreground text-sm">
                        {contact.initials}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-foreground truncate">
                        {contact.name}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {formatPhoneNumber(contact.phone)}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={() => handleCall("audio", contact.phone, contact.id)}
                        className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center hover:bg-primary/20 transition-colors"
                      >
                        <Phone className="h-4 w-4 text-primary" />
                      </button>
                      <button
                        onClick={() => handleCall("video", contact.phone, contact.id)}
                        className="h-9 w-9 rounded-full bg-info/10 flex items-center justify-center hover:bg-info/20 transition-colors"
                      >
                        <Video className="h-4 w-4 text-info" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* Dialpad */}
        {activeTab === "dialpad" && (
          <div className="flex flex-col h-full">
            <div className="flex items-center justify-center px-4 py-6 min-h-[72px]">
              <span
                className={cn(
                  "font-mono transition-all",
                  dialpadNumber.length > 0
                    ? "text-2xl font-semibold text-foreground"
                    : "text-lg text-muted-foreground"
                )}
              >
                {dialpadNumber || "Enter number"}
              </span>
            </div>

            <div className="flex-1 flex flex-col justify-center px-8 pb-4">
              <div className="grid grid-cols-3 gap-3">
                {dialpadKeys.map((key) => (
                  <button
                    key={key.digit}
                    onClick={() => handleDialpadPress(key.digit)}
                    className="flex flex-col items-center justify-center h-16 rounded-full bg-secondary hover:bg-secondary/80 active:bg-muted transition-colors"
                  >
                    <span className="text-xl font-semibold text-foreground">
                      {key.digit}
                    </span>
                    {key.letters && (
                      <span className="text-[10px] text-muted-foreground tracking-wider">
                        {key.letters}
                      </span>
                    )}
                  </button>
                ))}
              </div>

              {/* Call Buttons + Delete */}
              <div className="flex items-center justify-center gap-4 mt-6">
                <button
                  onClick={handleDialpadDelete}
                  className={cn(
                    "h-14 w-14 rounded-full flex items-center justify-center transition-opacity",
                    dialpadNumber.length > 0
                      ? "opacity-100"
                      : "opacity-0 pointer-events-none"
                  )}
                >
                  <Delete className="h-6 w-6 text-muted-foreground" />
                </button>
                <Button
                  size="lg"
                  onClick={() => dialpadNumber && handleCall("audio", dialpadNumber)}
                  disabled={!dialpadNumber}
                  className="h-16 w-16 rounded-full bg-primary hover:bg-primary/90"
                >
                  <Phone className="h-7 w-7" />
                </Button>
                <Button
                  size="lg"
                  variant="outline"
                  onClick={() => dialpadNumber && handleCall("video", dialpadNumber)}
                  disabled={!dialpadNumber}
                  className="h-14 w-14 rounded-full bg-info/10 border-info/30 hover:bg-info/20"
                >
                  <Video className="h-6 w-6 text-info" />
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Bottom Tab Bar */}
      <nav className="flex border-t border-border bg-card pb-safe">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              "flex-1 flex flex-col items-center gap-1 py-2 transition-colors",
              activeTab === tab.id
                ? "text-primary"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <tab.icon className="h-5 w-5" />
            <span className="text-[10px] font-medium">{tab.label}</span>
          </button>
        ))}
      </nav>
    </div>
  )
}
