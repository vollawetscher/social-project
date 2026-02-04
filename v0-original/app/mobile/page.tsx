"use client"

import { useState, useMemo } from "react"
import { useRouter } from "next/navigation"
import {
  Phone,
  Clock,
  Search,
  Grid3X3,
  ChevronRight,
  PhoneOutgoing,
  PhoneMissed,
  Delete,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
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

  const handleCall = (phone: string, contactId?: string) => {
    // Navigate to call screen with phone number
    const params = new URLSearchParams({ phone })
    if (contactId) params.set("contactId", contactId)
    router.push(`/mobile/call?${params.toString()}`)
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
        <span className="text-xs text-muted-foreground">Transcribed Calls</span>
      </header>

      {/* Tab Navigation */}
      <div className="flex border-b border-border bg-card">
        <button
          onClick={() => setActiveTab("recent")}
          className={cn(
            "flex-1 flex items-center justify-center gap-2 py-3 text-sm font-medium transition-colors border-b-2",
            activeTab === "recent"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          )}
        >
          <Clock className="h-4 w-4" />
          Recent
        </button>
        <button
          onClick={() => setActiveTab("contacts")}
          className={cn(
            "flex-1 flex items-center justify-center gap-2 py-3 text-sm font-medium transition-colors border-b-2",
            activeTab === "contacts"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          )}
        >
          <Search className="h-4 w-4" />
          Contacts
        </button>
        <button
          onClick={() => setActiveTab("dialpad")}
          className={cn(
            "flex-1 flex items-center justify-center gap-2 py-3 text-sm font-medium transition-colors border-b-2",
            activeTab === "dialpad"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          )}
        >
          <Grid3X3 className="h-4 w-4" />
          Dialpad
        </button>
      </div>

      {/* Content */}
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
                  onClick={() => handleCall(call.contact.phone, call.contact.id)}
                  className="w-full flex items-center gap-3 px-4 py-3 hover:bg-secondary/50 transition-colors text-left"
                >
                  <Avatar className="h-11 w-11">
                    <AvatarFallback className="bg-secondary text-foreground text-sm">
                      {call.contact.initials}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-foreground truncate">
                        {call.contact.name}
                      </span>
                      {call.sessionId && (
                        <span className="shrink-0 text-[10px] px-1.5 py-0.5 rounded bg-primary/10 text-primary font-medium">
                          Transcribed
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      {call.type === "outgoing" ? (
                        <PhoneOutgoing className="h-3 w-3 text-muted-foreground" />
                      ) : call.type === "missed" ? (
                        <PhoneMissed className="h-3 w-3 text-destructive" />
                      ) : null}
                      <span className="text-xs text-muted-foreground">
                        {formatRelativeTime(call.timestamp)}
                        {call.duration > 0 && ` · ${formatCallDuration(call.duration)}`}
                      </span>
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
            <div className="p-3 border-b border-border bg-card sticky top-0">
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
                  <button
                    key={contact.id}
                    onClick={() => handleCall(contact.phone, contact.id)}
                    className="w-full flex items-center gap-3 px-4 py-3 hover:bg-secondary/50 transition-colors text-left"
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
                    <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                      <Phone className="h-4 w-4 text-primary" />
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>
        )}

        {/* Dialpad */}
        {activeTab === "dialpad" && (
          <div className="flex flex-col h-full">
            {/* Number Display */}
            <div className="flex items-center justify-center px-4 py-6 min-h-[80px]">
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

            {/* Dialpad Grid */}
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

              {/* Call and Delete Buttons */}
              <div className="flex items-center justify-center gap-8 mt-6">
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
                  onClick={() => dialpadNumber && handleCall(dialpadNumber)}
                  disabled={!dialpadNumber}
                  className="h-16 w-16 rounded-full bg-primary hover:bg-primary/90"
                >
                  <Phone className="h-7 w-7" />
                </Button>
                <div className="h-14 w-14" /> {/* Spacer for symmetry */}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
