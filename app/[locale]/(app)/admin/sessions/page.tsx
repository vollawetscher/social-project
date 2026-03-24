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
  DollarSign,
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

interface AdminCostRow {
  userId: string
  displayName: string | null
  email: string | null
  transcriptionMinutes: number
  aiInputTokens: number
  aiOutputTokens: number
  aiGenerations: number
  emailCostUsd: number
  estimatedCostUsd: number
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
  const [costPeriod, setCostPeriod] = useState<"week" | "month" | "all">("month")
  const [costRows, setCostRows] = useState<AdminCostRow[]>([])
  const [loadingCosts, setLoadingCosts] = useState(true)
  const [costTotals, setCostTotals] = useState<{
    transcriptionMinutes: number
    aiInputTokens: number
    aiOutputTokens: number
    aiGenerations: number
    emailCostUsd: number
    estimatedCostUsd: number
  } | null>(null)

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

  const fetchCosts = useCallback(async () => {
    setLoadingCosts(true)
    try {
      const res = await fetch(`/api/admin/usage-costs?period=${costPeriod}`)
      if (!res.ok) throw new Error("Failed to fetch cost estimates")
      const data = await res.json()
      setCostRows(Array.isArray(data?.users) ? data.users : [])
      setCostTotals(data?.totals || null)
    } catch (err: any) {
      toast.error(err?.message || "Failed to load cost estimates")
    } finally {
      setLoadingCosts(false)
    }
  }, [costPeriod])

  useEffect(() => {
    if (!authLoading && isAdmin) fetchSessions()
  }, [authLoading, isAdmin, fetchSessions])

  useEffect(() => {
    if (!authLoading && isAdmin) fetchCosts()
  }, [authLoading, isAdmin, fetchCosts])

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

      {/* Cost Estimates */}
      <Card className="border-border">
        <CardContent className="p-4 space-y-4">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div>
              <h2 className="text-base font-semibold flex items-center gap-2">
                <DollarSign className="h-4 w-4" />
                User Cost Estimates
              </h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                Estimated from usage events (transcription, AI tokens, email spend).
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Select value={costPeriod} onValueChange={(v) => setCostPeriod(v as "week" | "month" | "all")}>
                <SelectTrigger className="w-[130px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="week">Last 7 days</SelectItem>
                  <SelectItem value="month">Last 30 days</SelectItem>
                  <SelectItem value="all">All time</SelectItem>
                </SelectContent>
              </Select>
              <Button variant="outline" size="sm" onClick={fetchCosts} disabled={loadingCosts}>
                <RefreshCw className={cn("h-4 w-4", loadingCosts && "animate-spin")} />
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="rounded-md border border-border p-2.5">
              <p className="text-[11px] text-muted-foreground">Estimated total</p>
              <p className="text-base font-semibold">${(costTotals?.estimatedCostUsd || 0).toFixed(2)}</p>
            </div>
            <div className="rounded-md border border-border p-2.5">
              <p className="text-[11px] text-muted-foreground">Transcription min</p>
              <p className="text-base font-semibold">{Math.round(costTotals?.transcriptionMinutes || 0)}</p>
            </div>
            <div className="rounded-md border border-border p-2.5">
              <p className="text-[11px] text-muted-foreground">AI input tokens</p>
              <p className="text-base font-semibold">{Math.round(costTotals?.aiInputTokens || 0).toLocaleString()}</p>
            </div>
            <div className="rounded-md border border-border p-2.5">
              <p className="text-[11px] text-muted-foreground">AI output tokens</p>
              <p className="text-base font-semibold">{Math.round(costTotals?.aiOutputTokens || 0).toLocaleString()}</p>
            </div>
          </div>

          {loadingCosts ? (
            <div className="py-6 text-center">
              <Loader2 className="h-5 w-5 animate-spin mx-auto text-muted-foreground" />
            </div>
          ) : (
            <div className="max-h-72 overflow-y-auto border border-border rounded-md">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-card border-b border-border">
                  <tr className="text-left">
                    <th className="px-3 py-2 font-medium text-muted-foreground">User</th>
                    <th className="px-3 py-2 font-medium text-muted-foreground text-right">Minutes</th>
                    <th className="px-3 py-2 font-medium text-muted-foreground text-right">AI Tokens</th>
                    <th className="px-3 py-2 font-medium text-muted-foreground text-right">Est. Cost</th>
                  </tr>
                </thead>
                <tbody>
                  {costRows.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-3 py-6 text-center text-muted-foreground text-xs">
                        No usage data in selected period.
                      </td>
                    </tr>
                  ) : (
                    costRows.map((row) => (
                      <tr key={row.userId} className="border-b border-border/60 last:border-b-0">
                        <td className="px-3 py-2">
                          <p className="font-medium truncate max-w-[240px]">{row.displayName || row.email || row.userId.slice(0, 8)}</p>
                          {row.email && <p className="text-xs text-muted-foreground truncate max-w-[240px]">{row.email}</p>}
                        </td>
                        <td className="px-3 py-2 text-right">{Math.round(row.transcriptionMinutes)}</td>
                        <td className="px-3 py-2 text-right">{Math.round(row.aiInputTokens + row.aiOutputTokens).toLocaleString()}</td>
                        <td className="px-3 py-2 text-right font-medium">${row.estimatedCostUsd.toFixed(2)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

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
