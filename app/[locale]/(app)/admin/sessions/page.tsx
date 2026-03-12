"use client"

export const dynamic = 'force-dynamic'

import { useState, useEffect, useCallback } from "react"
import { useTranslations } from "next-intl"
import { useRouter } from "@/i18n/navigation"
import {
  Shield,
  Loader2,
  RefreshCw,
  Search,
  ExternalLink,
  Clock,
  AlertTriangle,
  CheckCircle2,
  RotateCcw,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Card, CardContent } from "@/components/ui/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { cn } from "@/lib/utils"
import { useAuth } from "@/lib/auth/AuthProvider"
import { toast } from "sonner"

interface AdminSession {
  id: string
  user_id: string
  status: string
  context_note: string | null
  internal_case_id: string | null
  duration_sec: number | null
  language: string | null
  last_error: string | null
  created_at: string
  profiles: { display_name: string | null; email: string | null } | null
}

const statusConfig: Record<string, { label: string; className: string }> = {
  created:      { label: "Created",      className: "bg-secondary text-muted-foreground border-border" },
  uploading:    { label: "Uploading",    className: "bg-info/20 text-info border-info/30" },
  transcribing: { label: "Transcribing", className: "bg-warning/20 text-warning border-warning/30" },
  summarizing:  { label: "Summarizing",  className: "bg-warning/20 text-warning border-warning/30" },
  done:         { label: "Done",         className: "bg-success/20 text-success border-success/30" },
  error:        { label: "Error",        className: "bg-destructive/20 text-destructive border-destructive/30" },
}

import { formatDuration } from "@/lib/utils/date-formatters"

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("en-US", {
    year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
  })
}

export default function AdminSessionsPage() {
  const { profile, loading: authLoading } = useAuth()
  const router = useRouter()
  const [sessions, setSessions] = useState<AdminSession[]>([])
  const [count, setCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [status, setStatus] = useState("all")
  const [retrying, setRetrying] = useState<string | null>(null)

  const isAdmin = (profile as any)?.role === 'admin'

  const fetchSessions = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ limit: "50", status })
      if (search) params.set("search", search)
      const res = await fetch(`/api/admin/sessions?${params}`)
      if (!res.ok) throw new Error("Failed to fetch sessions")
      const data = await res.json()
      setSessions(data.sessions || [])
      setCount(data.count || 0)
    } catch (err: any) {
      toast.error(err.message || "Failed to load sessions")
    } finally {
      setLoading(false)
    }
  }, [search, status])

  useEffect(() => {
    if (!authLoading && isAdmin) fetchSessions()
  }, [authLoading, isAdmin, fetchSessions])

  const handleRetranscribe = async (sessionId: string, e: React.MouseEvent) => {
    e.stopPropagation()
    setRetrying(sessionId)
    try {
      const res = await fetch(`/api/sessions/${sessionId}/transcribe`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || "Failed to retranscribe")
      }
      toast.success("Transcription restarted")
      await fetchSessions()
    } catch (err: any) {
      toast.error(err.message)
    } finally {
      setRetrying(null)
    }
  }

  if (authLoading) {
    return (
      <div className="max-w-6xl mx-auto py-12 text-center">
        <Loader2 className="h-8 w-8 animate-spin mx-auto text-muted-foreground" />
      </div>
    )
  }

  if (!isAdmin) {
    return (
      <div className="max-w-6xl mx-auto py-12 text-center">
        <Shield className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
        <h2 className="text-lg font-semibold">Admin Access Required</h2>
        <Button onClick={() => router.push("/sessions")} className="mt-4">Go to Sessions</Button>
      </div>
    )
  }

  return (
    <div className="max-w-6xl space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">All Sessions</h1>
          <p className="text-sm text-muted-foreground mt-1">{count} total sessions across all users</p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchSessions} disabled={loading}>
          <RefreshCw className={cn("h-4 w-4 mr-2", loading && "animate-spin")} />
          Refresh
        </Button>
      </div>

      {/* Filters */}
      <div className="flex gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && fetchSessions()}
            placeholder="Search by ID, case ID, notes..."
            className="pl-9"
          />
        </div>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="created">Created</SelectItem>
            <SelectItem value="transcribing">Transcribing</SelectItem>
            <SelectItem value="done">Done</SelectItem>
            <SelectItem value="error">Error</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Session List */}
      {loading ? (
        <div className="text-center py-12">
          <Loader2 className="h-8 w-8 animate-spin mx-auto text-muted-foreground" />
        </div>
      ) : sessions.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <CheckCircle2 className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
            <p className="text-muted-foreground">No sessions match your filters</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {sessions.map((session) => {
            const st = statusConfig[session.status] || { label: session.status, className: "bg-secondary" }
            const isError = session.status === "error"
            const userName = session.profiles?.display_name || session.profiles?.email || session.user_id.slice(0, 8)

            return (
              <Card
                key={session.id}
                className="border-border hover:border-primary/30 transition-colors cursor-pointer"
                onClick={() => router.push(`/sessions/${session.id}`)}
              >
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <Badge variant="outline" className={cn("text-[10px]", st.className)}>
                          {st.label}
                        </Badge>
                        {session.language && (
                          <span className="text-[10px] text-muted-foreground uppercase">{session.language}</span>
                        )}
                      </div>

                      <p className="text-sm font-medium text-foreground truncate">
                        {session.context_note || session.internal_case_id || <span className="text-muted-foreground italic">No title</span>}
                      </p>

                      {isError && session.last_error && (
                        <p className="text-xs text-destructive mt-1 truncate">
                          <AlertTriangle className="h-3 w-3 inline mr-1" />
                          {session.last_error}
                        </p>
                      )}

                      <div className="flex items-center gap-3 mt-1.5 text-xs text-muted-foreground">
                        <span className="font-medium text-foreground/70">{userName}</span>
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {formatDate(session.created_at)}
                        </span>
                        {session.duration_sec && (
                          <span>{formatDuration(session.duration_sec)}</span>
                        )}
                        <span className="font-mono opacity-50">{session.id.slice(0, 8)}...</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {(isError || session.status === "created" || session.status === "transcribing") && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={(e) => handleRetranscribe(session.id, e)}
                          disabled={retrying === session.id}
                          className="h-7 text-xs"
                        >
                          {retrying === session.id ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            <RotateCcw className="h-3 w-3" />
                          )}
                          <span className="ml-1 hidden sm:inline">Retry</span>
                        </Button>
                      )}
                      <ExternalLink className="h-4 w-4 text-muted-foreground" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
