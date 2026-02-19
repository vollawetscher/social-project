"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import {
  Phone,
  PhoneIncoming,
  PhoneOutgoing,
  PhoneMissed,
  Search,
  Delete,
  FileText,
} from "lucide-react"
import { Button } from "../../components/ui/button"
import { Input } from "../../components/ui/input"
import { Badge } from "../../components/ui/badge"
import { Avatar, AvatarFallback } from "../../components/ui/avatar"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../../components/ui/tabs"
import { ScrollArea } from "../../components/ui/scroll-area"
import { cn } from "../../lib/utils"
import {
  mockContacts,
  mockRecentCalls,
  formatDuration,
  formatRelativeTime,
} from "../../lib/mock-data"
import type { Contact, RecentCall } from "../../lib/types"

export default function MobileDialerPage() {
  const router = useRouter()
  const [searchQuery, setSearchQuery] = useState("")
  const [dialpadNumber, setDialpadNumber] = useState("")
  const [activeTab, setActiveTab] = useState("recent")

  const filteredContacts = mockContacts.filter(
    (contact) =>
      contact.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      contact.phone.includes(searchQuery)
  )

  const handleCall = (contact: Contact) => {
    router.push(`/mobile/call?name=${encodeURIComponent(contact.name)}&phone=${encodeURIComponent(contact.phone)}`)
  }

  const handleDialpadCall = () => {
    if (dialpadNumber.length > 0) {
      router.push(`/mobile/call?phone=${encodeURIComponent(dialpadNumber)}`)
    }
  }

  const handleDialpadPress = (digit: string) => {
    setDialpadNumber((prev) => prev + digit)
  }

  const handleDialpadDelete = () => {
    setDialpadNumber((prev) => prev.slice(0, -1))
  }

  const getCallIcon = (type: RecentCall["type"]) => {
    switch (type) {
      case "incoming":
        return <PhoneIncoming className="h-4 w-4 text-primary" />
      case "outgoing":
        return <PhoneOutgoing className="h-4 w-4 text-muted-foreground" />
      case "missed":
        return <PhoneMissed className="h-4 w-4 text-destructive" />
    }
  }

  return (
    <div className="flex flex-col h-screen">
      {/* Header */}
      <header className="flex items-center justify-between px-4 py-3 border-b border-border bg-card">
        <h1 className="text-lg font-semibold text-foreground">Notissima</h1>
        <Badge variant="secondary" className="text-xs">
          Connected
        </Badge>
      </header>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">
        <TabsList className="w-full justify-start rounded-none border-b border-border bg-card px-4 h-12">
          <TabsTrigger value="recent" className="flex-1">
            Recent
          </TabsTrigger>
          <TabsTrigger value="contacts" className="flex-1">
            Contacts
          </TabsTrigger>
          <TabsTrigger value="dialpad" className="flex-1">
            Dialpad
          </TabsTrigger>
        </TabsList>

        {/* Recent Calls */}
        <TabsContent value="recent" className="flex-1 m-0">
          <ScrollArea className="h-[calc(100vh-120px)]">
            <div className="divide-y divide-border">
              {mockRecentCalls.map((call) => (
                <button
                  key={call.id}
                  onClick={() => handleCall(call.contact)}
                  className="w-full flex items-center gap-3 px-4 py-3 hover:bg-secondary/50 transition-colors text-left"
                >
                  <Avatar className="h-11 w-11">
                    <AvatarFallback className="bg-primary/10 text-primary text-sm">
                      {call.contact.initials}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className={cn(
                        "font-medium truncate",
                        call.type === "missed" ? "text-destructive" : "text-foreground"
                      )}>
                        {call.contact.name}
                      </span>
                      {call.isTranscribed && (
                        <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4 gap-0.5">
                          <FileText className="h-2.5 w-2.5" />
                          Transcribed
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      {getCallIcon(call.type)}
                      <span>{formatRelativeTime(call.timestamp)}</span>
                      {call.duration > 0 && (
                        <>
                          <span>·</span>
                          <span>{formatDuration(call.duration)}</span>
                        </>
                      )}
                    </div>
                  </div>
                  <Button variant="ghost" size="icon" className="shrink-0 h-10 w-10 rounded-full">
                    <Phone className="h-5 w-5 text-primary" />
                  </Button>
                </button>
              ))}
            </div>
          </ScrollArea>
        </TabsContent>

        {/* Contacts */}
        <TabsContent value="contacts" className="flex-1 m-0 flex flex-col">
          <div className="px-4 py-3 border-b border-border">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                type="search"
                placeholder="Search contacts..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 bg-secondary border-0"
              />
            </div>
          </div>
          <ScrollArea className="flex-1">
            <div className="divide-y divide-border">
              {filteredContacts.map((contact) => (
                <button
                  key={contact.id}
                  onClick={() => handleCall(contact)}
                  className="w-full flex items-center gap-3 px-4 py-3 hover:bg-secondary/50 transition-colors text-left"
                >
                  <Avatar className="h-11 w-11">
                    <AvatarFallback className="bg-primary/10 text-primary text-sm">
                      {contact.initials}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-foreground truncate">
                      {contact.name}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {contact.phone}
                    </p>
                  </div>
                  <Button variant="ghost" size="icon" className="shrink-0 h-10 w-10 rounded-full">
                    <Phone className="h-5 w-5 text-primary" />
                  </Button>
                </button>
              ))}
            </div>
          </ScrollArea>
        </TabsContent>

        {/* Dialpad */}
        <TabsContent value="dialpad" className="flex-1 m-0 flex flex-col">
          <div className="flex-1 flex flex-col items-center justify-center px-6 py-4">
            {/* Number Display */}
            <div className="w-full h-16 flex items-center justify-center mb-4">
              <span className="text-3xl font-light text-foreground tracking-wider">
                {dialpadNumber || "Enter number"}
              </span>
              {dialpadNumber && (
                <button
                  onClick={handleDialpadDelete}
                  className="ml-3 p-2 hover:bg-secondary rounded-full transition-colors"
                >
                  <Delete className="h-5 w-5 text-muted-foreground" />
                </button>
              )}
            </div>

            {/* Dialpad Grid */}
            <div className="grid grid-cols-3 gap-4 w-full max-w-[280px]">
              {["1", "2", "3", "4", "5", "6", "7", "8", "9", "*", "0", "#"].map(
                (digit) => (
                  <button
                    key={digit}
                    onClick={() => handleDialpadPress(digit)}
                    className="h-16 w-16 mx-auto rounded-full bg-secondary hover:bg-secondary/80 flex items-center justify-center text-2xl font-medium text-foreground transition-colors"
                  >
                    {digit}
                  </button>
                )
              )}
            </div>

            {/* Call Button */}
            <button
              onClick={handleDialpadCall}
              disabled={dialpadNumber.length === 0}
              className={cn(
                "mt-8 h-16 w-16 rounded-full flex items-center justify-center transition-colors",
                dialpadNumber.length > 0
                  ? "bg-primary hover:bg-primary/90"
                  : "bg-muted"
              )}
            >
              <Phone className={cn(
                "h-7 w-7",
                dialpadNumber.length > 0 ? "text-primary-foreground" : "text-muted-foreground"
              )} />
            </button>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
