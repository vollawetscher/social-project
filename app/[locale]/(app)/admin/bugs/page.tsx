"use client"

export const dynamic = 'force-dynamic'

import { useState, useEffect, useCallback } from "react"
import { useTranslations } from "next-intl"
import { useRouter } from "@/i18n/navigation"
import {
  Bug,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Filter,
  RefreshCw,
  Loader2,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  X,
  Shield,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"
import { useAuth } from "@/lib/auth/AuthProvider"
import { toast } from "sonner"

interface ErrorLog {
  id: string
  case_id: string | null
  session_id: string | null
  file_id: string | null
  user_id: string | null
  owner_email?: string | null
  error_type: string
  severity: string
  message: string
  stack_trace: string | null
  error_code: string | null
  endpoint: string | null
  method: string | null
  user_agent: string | null
  ip_address: string | null
  app_version: string | null
  environment: string | null
  metadata: Record<string, any> | null
  user_description: string | null
  reproduction_steps: string | null
  resolved: boolean
  resolved_at: string | null
  resolution_notes: string | null
  created_at: string
}

const severityConfig: Record<string, { color: string; label: string }> = {
  critical: { color: "bg-red-500/20 text-red-700 dark:text-red-400 border-red-500/30", label: "Critical" },
  error: { color: "bg-destructive/20 text-destructive border-destructive/30", label: "Error" },
  warning: { color: "bg-yellow-500/20 text-yellow-700 dark:text-yellow-400 border-yellow-500/30", label: "Warning" },
  info: { color: "bg-blue-500/20 text-blue-700 dark:text-blue-400 border-blue-500/30", label: "Info" },
  debug: { color: "bg-muted text-muted-foreground border-border", label: "Debug" },
}

const typeConfig: Record<string, { label: string }> = {
  bug_report: { label: "Bug Report" },
  server_error: { label: "Server Error" },
  client_error: { label: "Client Error" },
  api_error: { label: "API Error" },
}

export default function AdminBugsPage() {
  const { profile, loading: authLoading } = useAuth()
  const router = useRouter()
  const [errors, setErrors] = useState<ErrorLog[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [resolvingIds, setResolvingIds] = useState<Set<string>>(new Set())
  const [resolutionNotes, setResolutionNotes] = useState<Record<string, string>>({})

  // Filters
  const [filterType, setFilterType] = useState<string>("all")
  const [filterSeverity, setFilterSeverity] = useState<string>("all")
  const [filterResolved, setFilterResolved] = useState<string>("false")
  const [filterLimit, setFilterLimit] = useState<string>("50")

  const isAdmin = (profile as any)?.role === 'admin'

  const fetchErrors = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (filterType !== "all") params.set("errorType", filterType)
      if (filterSeverity !== "all") params.set("severity", filterSeverity)
      if (filterResolved !== "all") params.set("resolved", filterResolved)
      params.set("limit", filterLimit)

      const res = await fetch(`/api/error-logs?${params}`)
      if (!res.ok) throw new Error("Failed to fetch error logs")
      const data = await res.json()
      setErrors(data.errors || [])
    } catch (err) {
      console.error("Failed to fetch errors:", err)
      toast.error("Failed to load error logs")
    } finally {
      setLoading(false)
    }
  }, [filterType, filterSeverity, filterResolved, filterLimit])

  useEffect(() => {
    if (!authLoading && isAdmin) {
      fetchErrors()
    }
  }, [authLoading, isAdmin, fetchErrors])

  const handleResolve = async (id: string, resolved: boolean) => {
    setResolvingIds(prev => new Set(prev).add(id))
    try {
      const notes = resolutionNotes[id]
      const res = await fetch("/api/error-logs", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id,
          resolved,
          resolution_notes: resolved ? notes || undefined : undefined,
        }),
      })
      if (!res.ok) throw new Error("Failed to update")
      toast.success(resolved ? "Marked as resolved" : "Reopened")
      setResolutionNotes(prev => {
        const next = { ...prev }
        delete next[id]
        return next
      })
      setExpandedId(null)
      await fetchErrors()
    } catch (err) {
      toast.error("Failed to update error log")
    } finally {
      setResolvingIds(prev => {
        const next = new Set(prev)
        next.delete(id)
        return next
      })
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
        <p className="text-sm text-muted-foreground mt-2">
          This page is only available to administrators.
        </p>
        <Button onClick={() => router.push("/sessions")} className="mt-4">
          Go to Sessions
        </Button>
      </div>
    )
  }

  const stats = {
    total: errors.length,
    bugs: errors.filter((e) => e.error_type === "bug_report").length,
    unresolved: errors.filter((e) => !e.resolved).length,
    critical: errors.filter((e) => e.severity === "critical" || e.severity === "error").length,
  }

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr)
    return d.toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    })
  }

  return (
    <div className="max-w-6xl space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground flex items-center gap-2">
            <Bug className="h-6 w-6" />
            Bug Reports & Errors
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Monitor and resolve reported issues and system errors
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchErrors} disabled={loading}>
          <RefreshCw className={cn("h-4 w-4 mr-2", loading && "animate-spin")} />
          Refresh
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="border-border">
          <CardContent className="pt-4 pb-3 px-4">
            <div className="text-2xl font-bold">{stats.total}</div>
            <p className="text-xs text-muted-foreground">Total shown</p>
          </CardContent>
        </Card>
        <Card className="border-border">
          <CardContent className="pt-4 pb-3 px-4">
            <div className="text-2xl font-bold text-yellow-600">{stats.bugs}</div>
            <p className="text-xs text-muted-foreground">User reports</p>
          </CardContent>
        </Card>
        <Card className="border-border">
          <CardContent className="pt-4 pb-3 px-4">
            <div className="text-2xl font-bold text-destructive">{stats.unresolved}</div>
            <p className="text-xs text-muted-foreground">Unresolved</p>
          </CardContent>
        </Card>
        <Card className="border-border">
          <CardContent className="pt-4 pb-3 px-4">
            <div className="text-2xl font-bold text-red-600">{stats.critical}</div>
            <p className="text-xs text-muted-foreground">Error / Critical</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card className="border-border">
        <CardContent className="pt-4 pb-3 px-4">
          <div className="flex flex-wrap items-center gap-3">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <Select value={filterType} onValueChange={setFilterType}>
              <SelectTrigger className="w-[160px] h-8 text-sm">
                <SelectValue placeholder="Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All types</SelectItem>
                <SelectItem value="bug_report">Bug Reports</SelectItem>
                <SelectItem value="server_error">Server Errors</SelectItem>
                <SelectItem value="client_error">Client Errors</SelectItem>
                <SelectItem value="api_error">API Errors</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filterSeverity} onValueChange={setFilterSeverity}>
              <SelectTrigger className="w-[140px] h-8 text-sm">
                <SelectValue placeholder="Severity" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All severity</SelectItem>
                <SelectItem value="critical">Critical</SelectItem>
                <SelectItem value="error">Error</SelectItem>
                <SelectItem value="warning">Warning</SelectItem>
                <SelectItem value="info">Info</SelectItem>
                <SelectItem value="debug">Debug</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filterResolved} onValueChange={setFilterResolved}>
              <SelectTrigger className="w-[140px] h-8 text-sm">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="false">Unresolved</SelectItem>
                <SelectItem value="true">Resolved</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filterLimit} onValueChange={setFilterLimit}>
              <SelectTrigger className="w-[100px] h-8 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="25">25</SelectItem>
                <SelectItem value="50">50</SelectItem>
                <SelectItem value="100">100</SelectItem>
                <SelectItem value="200">200</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Error List */}
      {loading ? (
        <div className="text-center py-12">
          <Loader2 className="h-8 w-8 animate-spin mx-auto text-muted-foreground" />
          <p className="text-sm text-muted-foreground mt-4">Loading error logs...</p>
        </div>
      ) : errors.length === 0 ? (
        <Card className="border-border">
          <CardContent className="py-12 text-center">
            <CheckCircle2 className="h-12 w-12 mx-auto text-success mb-4" />
            <h3 className="text-lg font-semibold">All clear</h3>
            <p className="text-sm text-muted-foreground mt-1">No error logs match your filters.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {errors.map((err) => {
            const isExpanded = expandedId === err.id
            const sev = severityConfig[err.severity] || severityConfig.info
            const typ = typeConfig[err.error_type] || { label: err.error_type }

            return (
              <Card
                key={err.id}
                className={cn(
                  "border-border transition-colors",
                  err.resolved && "opacity-60"
                )}
              >
                <CardContent className="p-4">
                  {/* Row header */}
                  <div
                    className="flex items-start gap-3 cursor-pointer"
                    onClick={() => {
                      setExpandedId(isExpanded ? null : err.id)
                    }}
                  >
                    <div className="flex flex-col items-center gap-1 pt-0.5">
                      {err.resolved ? (
                        <CheckCircle2 className="h-4 w-4 text-success" />
                      ) : err.severity === "critical" || err.severity === "error" ? (
                        <AlertTriangle className="h-4 w-4 text-destructive" />
                      ) : (
                        <Bug className="h-4 w-4 text-muted-foreground" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge variant="outline" className={cn("text-[10px]", sev.color)}>
                          {sev.label}
                        </Badge>
                        <Badge variant="secondary" className="text-[10px]">
                          {typ.label}
                        </Badge>
                        {err.resolved && (
                          <Badge variant="outline" className="text-[10px] bg-success/10 text-success border-success/30">
                            Resolved
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm font-medium text-foreground mt-1 truncate">
                        {err.user_description || err.message}
                      </p>
                      <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {formatDate(err.created_at)}
                        </span>
                        {err.endpoint && (
                          <span className="font-mono">{err.endpoint}</span>
                        )}
                        {err.session_id && (
                          <span className="font-mono">session:{err.session_id.substring(0, 8)}</span>
                        )}
                        {err.owner_email && (
                          <span className="truncate max-w-[220px]">{err.owner_email}</span>
                        )}
                      </div>
                    </div>
                    <div className="shrink-0 flex items-center gap-2">
                      {!err.resolved && (
                        <Button
                          size="sm"
                          className="h-7 text-xs"
                          onClick={(e) => {
                            e.stopPropagation()
                            handleResolve(err.id, true)
                          }}
                          disabled={resolvingIds.has(err.id)}
                        >
                          {resolvingIds.has(err.id) ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            <CheckCircle2 className="h-3 w-3" />
                          )}
                          <span className="ml-1 hidden sm:inline">Resolve</span>
                        </Button>
                      )}
                      {isExpanded ? (
                        <ChevronUp className="h-4 w-4 text-muted-foreground" />
                      ) : (
                        <ChevronDown className="h-4 w-4 text-muted-foreground" />
                      )}
                    </div>
                  </div>

                  {/* Expanded details */}
                  {isExpanded && (
                    <div className="mt-4 pt-4 border-t border-border space-y-4">
                      {/* IDs */}
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                        <div>
                          <span className="text-muted-foreground">Error ID</span>
                          <p className="font-mono text-foreground">{err.id.substring(0, 12)}...</p>
                        </div>
                        {err.user_id && (
                          <div>
                            <span className="text-muted-foreground">User ID</span>
                            <p className="font-mono text-foreground">{err.user_id.substring(0, 12)}...</p>
                          </div>
                        )}
                        {err.owner_email && (
                          <div>
                            <span className="text-muted-foreground">Owner Email</span>
                            <p className="text-foreground">{err.owner_email}</p>
                          </div>
                        )}
                        {err.session_id && (
                          <div>
                            <span className="text-muted-foreground">Session ID</span>
                            <button
                              className="font-mono text-foreground hover:text-primary flex items-center gap-1"
                              onClick={(e) => {
                                e.stopPropagation()
                                router.push(`/sessions/${err.session_id}`)
                              }}
                            >
                              {err.session_id.substring(0, 12)}...
                              <ExternalLink className="h-3 w-3" />
                            </button>
                          </div>
                        )}
                        {err.error_code && (
                          <div>
                            <span className="text-muted-foreground">Error Code</span>
                            <p className="font-mono text-foreground">{err.error_code}</p>
                          </div>
                        )}
                      </div>

                      {/* Message */}
                      <div>
                        <span className="text-xs text-muted-foreground">Message</span>
                        <p className="text-sm text-foreground mt-0.5">{err.message}</p>
                      </div>

                      {/* User description (bug reports) */}
                      {err.user_description && (
                        <div>
                          <span className="text-xs text-muted-foreground">User Description</span>
                          <p className="text-sm text-foreground mt-0.5 whitespace-pre-wrap">{err.user_description}</p>
                        </div>
                      )}

                      {/* Reproduction steps */}
                      {err.reproduction_steps && (
                        <div>
                          <span className="text-xs text-muted-foreground">Steps to Reproduce</span>
                          <p className="text-sm text-foreground mt-0.5 whitespace-pre-wrap">{err.reproduction_steps}</p>
                        </div>
                      )}

                      {/* Stack trace */}
                      {err.stack_trace && (
                        <div>
                          <span className="text-xs text-muted-foreground">Stack Trace</span>
                          <pre className="text-xs text-foreground mt-0.5 bg-muted p-3 rounded-md overflow-x-auto max-h-48">
                            {err.stack_trace}
                          </pre>
                        </div>
                      )}

                      {/* Metadata */}
                      {err.metadata && Object.keys(err.metadata).length > 0 && (
                        <div>
                          <span className="text-xs text-muted-foreground">Metadata</span>
                          <pre className="text-xs text-foreground mt-0.5 bg-muted p-3 rounded-md overflow-x-auto max-h-48">
                            {JSON.stringify(err.metadata, null, 2)}
                          </pre>
                        </div>
                      )}

                      {/* Request context */}
                      {(err.endpoint || err.method || err.user_agent) && (
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
                          {err.endpoint && (
                            <div>
                              <span className="text-muted-foreground">Endpoint</span>
                              <p className="font-mono text-foreground">{err.method ? `${err.method} ` : ''}{err.endpoint}</p>
                            </div>
                          )}
                          {err.user_agent && (
                            <div className="md:col-span-2">
                              <span className="text-muted-foreground">User Agent</span>
                              <p className="font-mono text-foreground truncate">{err.user_agent}</p>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Resolution notes (if resolved) */}
                      {err.resolved && err.resolution_notes && (
                        <div className="p-3 rounded-md bg-success/10 border border-success/20">
                          <span className="text-xs text-success font-medium">Resolution Notes</span>
                          <p className="text-sm text-foreground mt-0.5">{err.resolution_notes}</p>
                          {err.resolved_at && (
                            <p className="text-xs text-muted-foreground mt-1">
                              Resolved {formatDate(err.resolved_at)}
                            </p>
                          )}
                        </div>
                      )}

                      {/* Actions */}
                      <div className="flex items-center gap-2 pt-2">
                        {err.resolved ? (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation()
                              handleResolve(err.id, false)
                            }}
                            disabled={resolvingIds.has(err.id)}
                          >
                            {resolvingIds.has(err.id) ? (
                              <Loader2 className="h-4 w-4 animate-spin mr-1" />
                            ) : null}
                            Reopen
                          </Button>
                        ) : (
                          <div className="flex items-center gap-2 flex-1">
                            <Input
                              placeholder="Resolution notes (optional)..."
                              value={resolutionNotes[err.id] || ""}
                              onChange={(e) => setResolutionNotes(prev => ({ ...prev, [err.id]: e.target.value }))}
                              className="h-8 text-sm flex-1"
                              onClick={(e) => e.stopPropagation()}
                            />
                            <Button
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation()
                                handleResolve(err.id, true)
                              }}
                              disabled={resolvingIds.has(err.id)}
                            >
                              {resolvingIds.has(err.id) ? (
                                <Loader2 className="h-4 w-4 animate-spin mr-1" />
                              ) : (
                                <CheckCircle2 className="h-4 w-4 mr-1" />
                              )}
                              Resolve
                            </Button>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
