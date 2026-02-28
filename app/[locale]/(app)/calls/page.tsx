"use client"

import { useState, useMemo, useEffect, useRef } from "react"
import { useRouter } from "@/i18n/navigation"
import { useTranslations } from "next-intl"
import { useAuth } from "@/lib/auth/AuthProvider"
import { createClient as createSupabaseClient } from "@/lib/supabase/client"
import {
  Phone,
  Video,
  Clock,
  Search,
  Grid3X3,
  Users,
  ChevronRight,
  PhoneOutgoing,
  PhoneMissed,
  Plus,
  Trash2,
  Download,
  Loader2,
  X,
  UserPlus,
  BellRing,
  Link2,
  Send,
  User,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import { cn } from "@/lib/utils"
import { DialPad } from "@/components/call/DialPad"
import { toast } from "sonner"
import type { Call, CallMode } from "@/lib/types/call"

type TabType = "recent" | "contacts" | "dialpad"

interface Contact {
  id: string
  name: string
  phone_number: string | null
  email: string | null
  notes: string | null
  created_at: string
}

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

/**
 * Normalize a phone number to E.164 format.
 * Handles: spaces/dashes/parens, leading 00 (international prefix), missing +.
 * Returns null if the number cannot be normalized to a plausible E.164 form.
 */
function normalizePhone(raw: string): string | null {
  // Strip all whitespace, dashes, dots, parentheses
  let cleaned = raw.replace(/[\s\-().]/g, "")
  // Replace leading 00 with +
  if (cleaned.startsWith("00")) cleaned = "+" + cleaned.slice(2)
  // If it starts with digits only (no +), prepend + — valid for full international numbers
  if (/^\d{7,15}$/.test(cleaned)) cleaned = "+" + cleaned
  // Validate final E.164: + followed by 7–15 digits
  if (/^\+[1-9]\d{6,14}$/.test(cleaned)) return cleaned
  return null
}

export default function CallsPage() {
  const router = useRouter()
  const t = useTranslations('calls')
  const { user } = useAuth()
  const [activeTab, setActiveTab] = useState<TabType>("contacts")
  const [calls, setCalls] = useState<Call[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // Video call dialog: choose "Copy Link" vs "Ring + SMS"
  const [pendingCallMode, setPendingCallMode] = useState<CallMode | null>(null)
  const [videoDialogStep, setVideoDialogStep] = useState<"choose" | "ring-sms">("choose")
  const [ringPhone, setRingPhone] = useState("")
  const [ringContactName, setRingContactName] = useState("")
  const [ringSending, setRingSending] = useState(false)
  // Save-to-contacts prompt: stores the phone number to save
  const [savingNumber, setSavingNumber] = useState<string | null>(null)
  const [saveContactName, setSaveContactName] = useState("")
  // Dialpad pre-fill (from contact tap)
  const [dialpadNumber, setDialpadNumber] = useState("")

  // Contacts state
  const [contacts, setContacts] = useState<Contact[]>([])
  const [contactsLoading, setContactsLoading] = useState(false)
  const [contactSearch, setContactSearch] = useState("")
  const [showAddForm, setShowAddForm] = useState(false)
  const [addName, setAddName] = useState("")
  const [addPhone, setAddPhone] = useState("")
  const [addEmail, setAddEmail] = useState("")
  const [savingContact, setSavingContact] = useState(false)
  const [importingContacts, setImportingContacts] = useState(false)
  const [deletingContactId, setDeletingContactId] = useState<string | null>(null)
  const [incomingInvite, setIncomingInvite] = useState<Call | null>(null)
  const [realtimeDegraded, setRealtimeDegraded] = useState(false)
  const missedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const incomingInviteIdRef = useRef<string | null>(null)

  useEffect(() => {
    fetchCalls()
  }, [])

  useEffect(() => {
    if (!user?.id) return
    const supabase = createSupabaseClient()
    if (!supabase) return

    const upsertCall = (next: Call) => {
      setCalls((prev) => {
        const idx = prev.findIndex((c) => c.id === next.id)
        if (idx === -1) return [next, ...prev].sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at))
        const cloned = [...prev]
        cloned[idx] = next
        return cloned.sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at))
      })

      if (
        next.callee_user_id === user.id &&
        next.status === "invited" &&
        !next.accepted_at &&
        !next.declined_at &&
        !next.missed_at
      ) {
        setIncomingInvite(next)
      } else if (incomingInvite?.id === next.id) {
        setIncomingInvite(null)
      }
    }

    const channel = supabase
      .channel(`calls-realtime-${user.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "calls" },
        (payload: any) => {
          const row = (payload.new || payload.old) as Call | undefined
          if (!row) return
          if (row.user_id !== user.id && row.callee_user_id !== user.id) return
          if (payload.eventType === "DELETE") {
            setCalls((prev) => prev.filter((c) => c.id !== row.id))
            if (incomingInviteIdRef.current === row.id) setIncomingInvite(null)
            return
          }
          upsertCall(payload.new as Call)
        }
      )
      .subscribe((status) => {
        setRealtimeDegraded(status !== "SUBSCRIBED")
      })

    return () => {
      supabase.removeChannel(channel)
    }
  }, [user?.id])

  useEffect(() => {
    if (!realtimeDegraded) return
    const interval = setInterval(fetchCalls, 12_000)
    return () => clearInterval(interval)
  }, [realtimeDegraded])

  useEffect(() => {
    incomingInviteIdRef.current = incomingInvite?.id || null
    if (!incomingInvite) return
    if (missedTimerRef.current) clearTimeout(missedTimerRef.current)
    missedTimerRef.current = setTimeout(async () => {
      try {
        await fetch(`/api/calls/${incomingInvite.id}/miss`, { method: "POST" })
      } catch {
        // best-effort timeout fallback
      } finally {
        setIncomingInvite((curr) => (curr?.id === incomingInvite.id ? null : curr))
      }
    }, 45_000)

    return () => {
      if (missedTimerRef.current) {
        clearTimeout(missedTimerRef.current)
        missedTimerRef.current = null
      }
    }
  }, [incomingInvite])

  useEffect(() => {
    fetchContacts()
  }, [])

  useEffect(() => {
    if (activeTab === "contacts") fetchContacts()
  }, [activeTab])

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

  async function handleAcceptIncomingInvite() {
    if (!incomingInvite) return
    try {
      const res = await fetch(`/api/calls/${incomingInvite.id}/accept`, { method: "POST" })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || "Failed to accept call")
      }
      const data = await res.json()
      setIncomingInvite(null)
      router.push(`/call/${data.roomName}?callId=${data.callId}&token=${encodeURIComponent(data.token)}&mode=${data.mode || "video"}`)
    } catch (err: any) {
      toast.error(err?.message || "Failed to accept call")
    }
  }

  async function handleDeclineIncomingInvite() {
    if (!incomingInvite) return
    try {
      const res = await fetch(`/api/calls/${incomingInvite.id}/decline`, { method: "POST" })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || "Failed to decline call")
      }
      setIncomingInvite(null)
    } catch (err: any) {
      toast.error(err?.message || "Failed to decline call")
    }
  }

  async function handleNewCall(mode: CallMode) {
    if (creating) return
    setCreating(true)
    setError(null)
    try {
      const res = await fetch("/api/calls", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ callType: "web", mode }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || `Failed to create call (${res.status})`)
      }
      const data = await res.json()
      router.push(`/call/${data.roomName}?callId=${data.callId}&token=${encodeURIComponent(data.token)}&mode=${mode}`)
    } catch (err: any) {
      console.error("[Calls] Failed to create call:", err)
      setError(err.message || "Failed to create call")
    } finally {
      setCreating(false)
    }
  }

  async function handleVideoRingSms() {
    if (creating || ringSending) return
    let cleaned = ringPhone.trim().replace(/[\s\-().]/g, "")
    if (cleaned.startsWith("00")) cleaned = "+" + cleaned.slice(2)
    if (/^\d{7,15}$/.test(cleaned)) cleaned = "+" + cleaned
    if (!/^\+[1-9]\d{6,14}$/.test(cleaned)) {
      toast.error(t('invalidPhone'))
      return
    }
    setCreating(true)
    setRingSending(true)
    setError(null)
    try {
      const res = await fetch("/api/calls", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ callType: "web", mode: "video" }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || "Failed to create call")
      }
      const data = await res.json()

      setPendingCallMode(null)
      const ringParams = `&ringPhone=${encodeURIComponent(cleaned)}&ringCallerName=${encodeURIComponent(data.displayName || "Someone")}${ringContactName ? `&ringContactName=${encodeURIComponent(ringContactName)}` : ""}`
      router.push(`/call/${data.roomName}?callId=${data.callId}&token=${encodeURIComponent(data.token)}&mode=video${ringParams}`)
    } catch (err: any) {
      console.error("[Calls] Failed to create Ring+SMS call:", err)
      setError(err.message || "Failed to create call")
    } finally {
      setCreating(false)
      setRingSending(false)
    }
  }

  async function handleDialpadCall(phoneNumber: string, mode: CallMode, contactName?: string) {
    if (creating) return
    setCreating(true)
    setError(null)
    try {
      const normalized = normalizePhone(phoneNumber)
      if (!normalized) {
        throw new Error(`"${phoneNumber}" couldn't be converted to a valid phone number. Try adding the country code, e.g. +49171…`)
      }

      const res = await fetch("/api/calls", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ callType: "pstn_outbound", mode }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || "Failed to create call")
      }
      const data = await res.json()

      const dialRes = await fetch(`/api/calls/${data.callId}/dial`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phoneNumber: normalized, ...(contactName ? { contactName } : {}) }),
      })
      if (!dialRes.ok) {
        const dialData = await dialRes.json().catch(() => ({}))
        throw new Error(dialData.error || "Failed to dial")
      }

      router.push(`/call/${data.roomName}?callId=${data.callId}&token=${encodeURIComponent(data.token)}&mode=${mode}&callType=pstn_outbound&phone=${encodeURIComponent(normalized)}`)
    } catch (err: any) {
      console.error("[Calls] Failed to create PSTN call:", err)
      setError(err.message || "Failed to create call")
    } finally {
      setCreating(false)
    }
  }

  async function fetchContacts() {
    setContactsLoading(true)
    try {
      const res = await fetch("/api/contacts")
      if (res.ok) {
        const data = await res.json()
        setContacts(data.contacts || [])
      }
    } catch {
      // ignore
    } finally {
      setContactsLoading(false)
    }
  }

  async function handleAddContact(e: React.FormEvent) {
    e.preventDefault()
    if (!addName.trim()) return
    setSavingContact(true)
    try {
      const res = await fetch("/api/contacts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: addName.trim(), phone_number: addPhone.trim() || null, email: addEmail.trim() || null }),
      })
      if (!res.ok) throw new Error("Failed to save contact")
      const contact = await res.json()
      setContacts((prev) => [...prev, contact].sort((a, b) => a.name.localeCompare(b.name)))
      setAddName(""); setAddPhone(""); setAddEmail(""); setShowAddForm(false)
      toast.success(`Contact "${contact.name}" added`)
    } catch {
      toast.error(t('contactAddFailed'))
    } finally {
      setSavingContact(false)
    }
  }

  async function handleDeleteContact(id: string, name: string) {
    if (!confirm(t('contactDeleteConfirm', { name }))) return
    setDeletingContactId(id)
    try {
      await fetch(`/api/contacts/${id}`, { method: "DELETE" })
      setContacts((prev) => prev.filter((c) => c.id !== id))
      toast.success(`"${name}" removed`)
    } catch {
      toast.error(t('contactDeleteFailed'))
    } finally {
      setDeletingContactId(null)
    }
  }

  async function handleImportContacts() {
    // Web Contact Picker API support is determined by navigator.contacts.select.
    // Some browsers expose navigator.contacts without a global ContactsManager.
    const contactsApi = (navigator as any).contacts
    if (!contactsApi || typeof contactsApi.select !== "function") {
      toast.error(t('importNotSupported'))
      return
    }
    setImportingContacts(true)
    try {
      const selected = await contactsApi.select(["name", "tel", "email"], { multiple: true })
      if (!selected?.length) return
      let added = 0
      for (const c of selected) {
        const name = c.name?.[0] || "Unknown"
        const phone = c.tel?.[0] || null
        const email = c.email?.[0] || null
        const res = await fetch("/api/contacts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name, phone_number: phone, email }),
        })
        if (res.ok) { const contact = await res.json(); setContacts((prev) => [...prev, contact]); added++ }
      }
      setContacts((prev) => [...prev].sort((a, b) => a.name.localeCompare(b.name)))
      toast.success(`Imported ${added} contact${added !== 1 ? "s" : ""}`)
    } catch (err: any) {
      if (err?.name !== "AbortError") toast.error("Import failed")
    } finally {
      setImportingContacts(false)
    }
  }

  function handleCallContact(contact: Contact, mode: CallMode) {
    if (!contact.phone_number) {
      toast.error(t('noPhoneNumber'))
      return
    }
    // Dial directly, carrying the contact name so it appears in recent calls
    handleDialpadCall(contact.phone_number, mode, contact.name)
  }

  const filteredContacts = useMemo(() => {
    if (!contactSearch.trim()) return contacts
    const q = contactSearch.toLowerCase()
    return contacts.filter(
      (c) => c.name.toLowerCase().includes(q) ||
        c.phone_number?.includes(q) ||
        c.email?.toLowerCase().includes(q)
    )
  }, [contacts, contactSearch])

  const tabs = [
    { id: "recent" as const, labelKey: "recentTab", icon: Clock },
    { id: "contacts" as const, labelKey: "contactsTab", icon: Users },
    { id: "dialpad" as const, labelKey: "dialpadTab", icon: Grid3X3 },
  ]

  const recentCalls = useMemo(() => {
    return calls.filter(
      (c) =>
        c.call_type === "pstn_outbound" &&
        c.status !== "waiting" &&
        c.status !== "active"
    )
  }, [calls])

  return (
    <div className="flex-1 min-h-0 flex flex-col bg-background overflow-hidden">
      {/* Quick Actions */}
      <div className="px-4 py-4 border-b border-border">
        <h1 className="text-lg font-semibold text-foreground mb-3">Calls</h1>
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => setPendingCallMode("audio")}
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
            onClick={() => { setPendingCallMode("video"); setVideoDialogStep("choose"); setRingPhone(""); setRingContactName(""); fetchContacts() }}
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

      {/* Error Banner */}
      {error && (
        <div className="px-4 py-2 bg-destructive/10 border-b border-destructive/20">
          <p className="text-sm text-destructive">{error}</p>
        </div>
      )}
      {realtimeDegraded && (
        <div className="px-4 py-2 bg-warning/10 border-b border-warning/20">
          <p className="text-xs text-warning-foreground">{t('realtimeFallback')}</p>
        </div>
      )}

      {/* Mobile Tab Bar */}
      <div className="flex border-b border-border bg-card md:hidden">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => { setActiveTab(tab.id); if (tab.id === "contacts") fetchContacts() }}
            className={cn(
              "flex-1 flex items-center justify-center gap-1.5 py-3 text-sm font-medium transition-colors border-b-2",
              activeTab === tab.id
                ? "text-primary border-primary"
                : "text-muted-foreground border-transparent hover:text-foreground"
            )}
          >
            <tab.icon className="h-4 w-4" />
            {t(tab.labelKey)}
          </button>
        ))}
      </div>

      {/* Desktop Tab Bar */}
      <div className="hidden md:flex border-b border-border bg-card">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => { setActiveTab(tab.id); if (tab.id === "contacts") fetchContacts() }}
            className={cn(
              "px-4 py-3 flex items-center gap-2 text-sm font-medium transition-colors border-b-2",
              activeTab === tab.id
                ? "text-primary border-primary"
                : "text-muted-foreground border-transparent hover:text-foreground"
            )}
          >
            <tab.icon className="h-4 w-4" />
            {t(tab.labelKey)}
          </button>
        ))}
      </div>

      {/* Desktop Tab Content */}
      <div className="hidden md:flex flex-1 min-h-0 overflow-y-auto">
        {activeTab === "recent" && (
          <div className="w-full">
            <RecentCallsList calls={recentCalls} loading={loading} router={router} setAddPhone={setAddPhone} setActiveTab={setActiveTab} setShowAddForm={setShowAddForm} />
          </div>
        )}
        {activeTab === "contacts" && (
          <div className="w-full">
            <ContactsPanel contacts={contacts} filteredContacts={filteredContacts} contactsLoading={contactsLoading} contactSearch={contactSearch} setContactSearch={setContactSearch} showAddForm={showAddForm} setShowAddForm={setShowAddForm} addName={addName} setAddName={setAddName} addPhone={addPhone} setAddPhone={setAddPhone} addEmail={addEmail} setAddEmail={setAddEmail} savingContact={savingContact} handleAddContact={handleAddContact} handleImportContacts={handleImportContacts} importingContacts={importingContacts} handleCallContact={handleCallContact} handleDeleteContact={handleDeleteContact} deletingContactId={deletingContactId} creating={creating} />
          </div>
        )}
        {activeTab === "dialpad" && (
          <div className="w-full px-6 py-4">
            <div className="max-w-md mx-auto">
              <DialPad key={dialpadNumber} initialNumber={dialpadNumber} onCall={(number, mode) => { setDialpadNumber(""); handleDialpadCall(number, mode) }} disabled={creating} />
            </div>
          </div>
        )}
      </div>

      {/* === Mobile Content (tab-based) === */}
      <div className="flex-1 overflow-y-auto md:hidden">
        {activeTab === "recent" && <RecentCallsList calls={recentCalls} loading={loading} router={router} setAddPhone={setAddPhone} setActiveTab={setActiveTab} setShowAddForm={setShowAddForm} />}
        {activeTab === "contacts" && <ContactsPanel contacts={contacts} filteredContacts={filteredContacts} contactsLoading={contactsLoading} contactSearch={contactSearch} setContactSearch={setContactSearch} showAddForm={showAddForm} setShowAddForm={setShowAddForm} addName={addName} setAddName={setAddName} addPhone={addPhone} setAddPhone={setAddPhone} addEmail={addEmail} setAddEmail={setAddEmail} savingContact={savingContact} handleAddContact={handleAddContact} handleImportContacts={handleImportContacts} importingContacts={importingContacts} handleCallContact={handleCallContact} handleDeleteContact={handleDeleteContact} deletingContactId={deletingContactId} creating={creating} />}
        {activeTab === "dialpad" && <DialPad key={dialpadNumber} initialNumber={dialpadNumber} onCall={(number, mode) => { setDialpadNumber(""); handleDialpadCall(number, mode) }} disabled={creating} />}
      </div>

      {/* Video call dialog — choose Copy Link or Ring + SMS */}
      <Dialog open={pendingCallMode === "video"} onOpenChange={(open) => {
        if (!open) { setPendingCallMode(null); setVideoDialogStep("choose"); setRingPhone(""); setRingContactName(""); }
      }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Video className="h-5 w-5 text-info" />
              {t('startVideoCall')}
            </DialogTitle>
            <DialogDescription>
              {videoDialogStep === "choose"
                ? t('invitePromptVideo')
                : t('invitePromptPhone')}
            </DialogDescription>
          </DialogHeader>

          {videoDialogStep === "choose" ? (
            <div className="flex flex-col gap-3 pt-2">
              <button
                onClick={() => {
                  setPendingCallMode(null)
                  handleNewCall("video")
                }}
                disabled={creating}
                className="flex items-center gap-3 p-3 rounded-xl border border-border hover:bg-accent transition-colors text-left"
              >
                <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                  <Link2 className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-sm font-medium">{t('copyLink')}</p>
                  <p className="text-xs text-muted-foreground">{t('copyLinkDescription')}</p>
                </div>
              </button>
              <button
                onClick={() => setVideoDialogStep("ring-sms")}
                disabled={creating}
                className="flex items-center gap-3 p-3 rounded-xl border border-border hover:bg-accent transition-colors text-left"
              >
                <div className="h-10 w-10 rounded-full bg-orange-500/10 flex items-center justify-center shrink-0">
                  <BellRing className="h-5 w-5 text-orange-600" />
                </div>
                <div>
                  <p className="text-sm font-medium">{t('ringSms')}</p>
                  <p className="text-xs text-muted-foreground">{t('ringSmsDescription')}</p>
                </div>
              </button>
              <Button variant="ghost" size="sm" onClick={() => setPendingCallMode(null)} className="mt-1">
                {t('cancel')}
              </Button>
            </div>
          ) : (
            <div className="flex flex-col gap-3 pt-2">
              <div className="flex gap-2">
                <Input
                  type="text"
                  inputMode="tel"
                  placeholder="+49 170 1234567"
                  value={ringPhone}
                  onChange={(e) => { setRingPhone(e.target.value); setRingContactName("") }}
                  className="flex-1"
                  autoFocus
                />
                <Button
                  onClick={handleVideoRingSms}
                  disabled={ringSending || !ringPhone.trim()}
                  className="bg-orange-500 hover:bg-orange-600 text-white shrink-0"
                >
                  {ringSending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                </Button>
              </div>
              {contacts.length > 0 && (
                <div className="max-h-40 overflow-y-auto border border-border rounded-lg divide-y divide-border">
                  {contacts.filter(c => c.phone_number).map((c) => (
                    <button
                      key={c.id}
                      onClick={() => { setRingPhone(c.phone_number || ""); setRingContactName(c.name) }}
                      className="w-full flex items-center gap-2 px-3 py-2 hover:bg-accent text-left text-sm"
                    >
                      <User className="h-4 w-4 text-muted-foreground shrink-0" />
                      <span className="truncate font-medium">{c.name}</span>
                      <span className="text-xs text-muted-foreground ml-auto shrink-0">{c.phone_number}</span>
                    </button>
                  ))}
                </div>
              )}
              <div className="flex gap-2 justify-end">
                <Button variant="ghost" size="sm" onClick={() => setVideoDialogStep("choose")}>
                  {t('back')}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Audio call confirmation dialog */}
      <Dialog open={pendingCallMode === "audio"} onOpenChange={(open) => { if (!open) setPendingCallMode(null) }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Phone className="h-5 w-5 text-primary" />
              {t('startAudioCall')}
            </DialogTitle>
            <DialogDescription>
              {t('audioCallDescription')}
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-row gap-3 justify-end pt-2">
            <Button variant="outline" onClick={() => setPendingCallMode(null)} disabled={creating}>
              {t('cancel')}
            </Button>
            <Button
              onClick={() => { setPendingCallMode(null); handleNewCall("audio") }}
              disabled={creating}
            >
              {creating ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Phone className="h-4 w-4 mr-2" />}
              {t('startCall')}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!incomingInvite} onOpenChange={(open) => { if (!open) setIncomingInvite(null) }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{t('incomingCallTitle')}</DialogTitle>
            <DialogDescription>
              {(incomingInvite?.contact_name || t('incomingUnknownCaller'))} {t('incomingCallDescription')}
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-row gap-3 justify-end pt-2">
            <Button variant="outline" onClick={handleDeclineIncomingInvite}>
              {t('decline')}
            </Button>
            <Button onClick={handleAcceptIncomingInvite}>
              {t('accept')}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function RecentCallsList({ calls, loading, router, setAddPhone, setActiveTab, setShowAddForm }: {
  calls: Call[]
  loading: boolean
  router: { push: (url: string) => void }
  setAddPhone: (v: string) => void
  setActiveTab: (v: TabType) => void
  setShowAddForm: (v: boolean) => void
}) {
  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <p className="text-sm text-muted-foreground">Loading calls...</p>
      </div>
    )
  }
  if (calls.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <Clock className="h-12 w-12 text-muted-foreground/50 mb-4" />
        <p className="text-muted-foreground">No recent calls</p>
        <p className="text-xs text-muted-foreground mt-1">Your transcribed calls will appear here</p>
      </div>
    )
  }
  return (
    <div className="divide-y divide-border">
      {calls.map((call) => {
        const name = call.contact_name || call.phone_number || "Unknown"
        const initials = name === "Unknown" ? "?" : name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2)
        const isUnknown = !call.contact_name
        const durationSec = call.ended_at && call.started_at
          ? Math.round((new Date(call.ended_at).getTime() - new Date(call.started_at).getTime()) / 1000)
          : 0
        return (
          <button
            key={call.id}
            onClick={() => { if (call.session_id) router.push(`/sessions/${call.session_id}`) }}
            disabled={!call.session_id}
            className="w-full flex items-center gap-3 px-4 py-3 hover:bg-accent transition-colors text-left"
          >
            <Avatar className="h-10 w-10 shrink-0">
              <AvatarFallback className="bg-secondary text-foreground text-sm font-medium">{initials}</AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <p className="font-medium text-foreground text-sm truncate">{name}</p>
                {call.status === "done" && (
                  <Badge variant="secondary" className="text-[9px] h-4 px-1.5 gap-0.5 bg-success/20 text-success border-0 shrink-0">Transcribed</Badge>
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
            {isUnknown && call.phone_number && (
              <button
                onClick={(e) => { e.stopPropagation(); setAddPhone(call.phone_number!); setActiveTab("contacts"); setShowAddForm(true) }}
                className="shrink-0 p-2 text-muted-foreground hover:text-primary transition-colors"
                title="Save to contacts"
              >
                <UserPlus className="h-4 w-4" />
              </button>
            )}
            <ChevronRight className="h-5 w-5 text-muted-foreground shrink-0" />
          </button>
        )
      })}
    </div>
  )
}

function ContactsPanel({ contacts, filteredContacts, contactsLoading, contactSearch, setContactSearch, showAddForm, setShowAddForm, addName, setAddName, addPhone, setAddPhone, addEmail, setAddEmail, savingContact, handleAddContact, handleImportContacts, importingContacts, handleCallContact, handleDeleteContact, deletingContactId, creating }: {
  contacts: Contact[]
  filteredContacts: Contact[]
  contactsLoading: boolean
  contactSearch: string
  setContactSearch: (v: string) => void
  showAddForm: boolean
  setShowAddForm: (v: boolean | ((prev: boolean) => boolean)) => void
  addName: string
  setAddName: (v: string) => void
  addPhone: string
  setAddPhone: (v: string) => void
  addEmail: string
  setAddEmail: (v: string) => void
  savingContact: boolean
  handleAddContact: (e: React.FormEvent) => void
  handleImportContacts: () => void
  importingContacts: boolean
  handleCallContact: (contact: Contact, mode: CallMode) => void
  handleDeleteContact: (id: string, name: string) => void
  deletingContactId: string | null
  creating: boolean
}) {
  return (
    <div className="flex flex-col h-full">
      <div className="p-3 border-b border-border flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input type="search" value={contactSearch} onChange={(e) => setContactSearch(e.target.value)} placeholder="Search contacts..." className="pl-9 bg-secondary border-border h-9" />
        </div>
        <Button size="sm" variant="outline" className="h-9 gap-1.5 shrink-0" onClick={() => setShowAddForm((v: boolean) => !v)}>
          {showAddForm ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
          {showAddForm ? "Cancel" : "Add"}
        </Button>
        <Button size="sm" variant="ghost" className="h-9 gap-1.5 shrink-0" onClick={handleImportContacts} disabled={importingContacts} title="Import from device contacts">
          {importingContacts ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
        </Button>
      </div>
      {showAddForm && (
        <form onSubmit={handleAddContact} className="p-3 border-b border-border bg-secondary/40 flex flex-col gap-2">
          <Input placeholder="Name *" value={addName} onChange={(e) => setAddName(e.target.value)} className="h-9 bg-background" required autoFocus />
          <Input placeholder="Phone (+49171…)" value={addPhone} onChange={(e) => setAddPhone(e.target.value)} type="tel" className="h-9 bg-background" />
          <Input placeholder="Email (optional)" value={addEmail} onChange={(e) => setAddEmail(e.target.value)} type="email" className="h-9 bg-background" />
          <Button type="submit" size="sm" disabled={savingContact || !addName.trim()} className="h-9">
            {savingContact ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save contact"}
          </Button>
        </form>
      )}
      <div className="flex-1 overflow-y-auto">
        {contactsLoading ? (
          <div className="flex items-center justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
        ) : filteredContacts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center px-4">
            <Users className="h-12 w-12 text-muted-foreground/50 mb-4" />
            {contacts.length === 0 ? (
              <>
                <p className="text-muted-foreground font-medium">No contacts yet</p>
                <p className="text-xs text-muted-foreground mt-1">Tap + Add or Import to get started</p>
              </>
            ) : (
              <p className="text-muted-foreground">No contacts match &quot;{contactSearch}&quot;</p>
            )}
          </div>
        ) : (
          <div className="divide-y divide-border">
            {filteredContacts.map((contact) => {
              const initials = contact.name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2)
              return (
                <div key={contact.id} className="flex items-center gap-3 px-4 py-3">
                  <Avatar className="h-10 w-10 shrink-0">
                    <AvatarFallback className="bg-secondary text-foreground text-sm font-medium">{initials}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-foreground text-sm truncate">{contact.name}</p>
                    {contact.phone_number && <p className="text-xs text-muted-foreground truncate">{contact.phone_number}</p>}
                    {!contact.phone_number && contact.email && <p className="text-xs text-muted-foreground truncate">{contact.email}</p>}
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    {contact.phone_number && (
                      <Button size="icon" variant="ghost" className="h-8 w-8 text-primary hover:bg-primary/10" onClick={() => handleCallContact(contact, "audio")} disabled={creating} title="Call">
                        <Phone className="h-4 w-4" />
                      </Button>
                    )}
                    <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive hover:bg-destructive/10" onClick={() => handleDeleteContact(contact.id, contact.name)} disabled={deletingContactId === contact.id} title="Delete">
                      {deletingContactId === contact.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
