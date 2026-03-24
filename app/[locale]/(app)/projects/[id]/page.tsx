'use client'

import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'next/navigation'
import { useRouter, Link } from '@/i18n/navigation'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { toast } from 'sonner'
import {
  Loader2,
  ArrowLeft,
  FolderOpen,
  Calendar,
  Clock,
  Settings,
  Pencil,
  Check,
  X,
  RefreshCw,
  Users,
  ListChecks,
  Sparkles,
  MessageSquareDot,
} from 'lucide-react'
import { formatDuration } from '@/lib/utils/date-formatters'

interface CaseData {
  id: string
  title: string
  client_identifier: string
  description: string
  status: 'active' | 'closed' | 'archived'
  created_at: string
  updated_at: string
  sessions: SessionRow[]
}

interface SessionRow {
  id: string
  internal_case_id?: string
  context_note?: string
  private_comments?: string
  status: string
  created_at: string
  duration_sec: number
}

type CaseStatus = 'active' | 'closed' | 'archived'
type DriftScore = 'green' | 'yellow' | 'red'
type Momentum = 'accelerating' | 'stable' | 'stalling'

interface PulseDecision {
  decision: string
  session_index: number
  session_date: string
}

interface PulseParticipant {
  name: string
  sessions: number[]
  last_seen: string
}

interface ProjectPulse {
  original_intent: string
  current_direction: string
  drift_score: DriftScore
  drift_rationale: string
  open_loops: string[]
  decision_log: PulseDecision[]
  momentum: Momentum
  momentum_rationale: string
  participant_map: PulseParticipant[]
  session_count: number
  narrative: string
  updated_at: string
  pulse_version: number
}

interface PulseResponse {
  caseId: string
  pulse: ProjectPulse | null
  pulseUpdatedAt: string | null
  pulseVersion: number
}

function getSessionStatusConfig(status: string) {
  const configs: Record<string, { label: string; className: string }> = {
    created:      { label: 'ready',        className: 'bg-muted text-muted-foreground' },
    uploading:    { label: 'uploading',    className: 'bg-info/20 text-info border-info/30 animate-pulse' },
    transcribing: { label: 'transcribing', className: 'bg-warning/20 text-warning border-warning/30 animate-pulse' },
    summarizing:  { label: 'processing',   className: 'bg-warning/20 text-warning border-warning/30 animate-pulse' },
    done:         { label: 'ready',        className: 'bg-success/20 text-success border-success/30' },
    ready:        { label: 'ready',        className: 'bg-success/20 text-success border-success/30' },
    error:        { label: 'failed',       className: 'bg-destructive/20 text-destructive' },
    failed:       { label: 'failed',       className: 'bg-destructive/20 text-destructive' },
  }
  return configs[status] ?? configs.created
}

function formatDate(dateString: string, locale: string): string {
  return new Date(dateString).toLocaleDateString(locale, {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}

function formatTime(dateString: string, locale: string): string {
  return new Date(dateString).toLocaleTimeString(locale, {
    hour: '2-digit',
    minute: '2-digit',
  })
}

export default function ProjectDetailPage() {
  const params = useParams()
  const router = useRouter()
  const projectId = params.id as string
  const locale = (params.locale as string) ?? 'en'

  const t = useTranslations('sessions')
  const tc = useTranslations('common')

  const [caseData, setCaseData] = useState<CaseData | null>(null)
  const [loading, setLoading] = useState(true)
  const [showEditDialog, setShowEditDialog] = useState(false)
  const [editDescription, setEditDescription] = useState('')
  const [editClientId, setEditClientId] = useState('')
  const [editStatus, setEditStatus] = useState<CaseStatus>('active')
  const [saving, setSaving] = useState(false)
  const [editingTitle, setEditingTitle] = useState(false)
  const [titleValue, setTitleValue] = useState('')
  const [pulseData, setPulseData] = useState<PulseResponse | null>(null)
  const [loadingPulse, setLoadingPulse] = useState(true)
  const [refreshingPulse, setRefreshingPulse] = useState(false)
  const [decisionExpanded, setDecisionExpanded] = useState(false)
  const [resolvingLoop, setResolvingLoop] = useState<string | null>(null)

  useEffect(() => {
    loadProject()
    loadPulse()
  }, [projectId])

  const loadProject = async () => {
    try {
      const res = await fetch(`/api/cases/${projectId}`)
      if (res.ok) {
        const data = await res.json()
        setCaseData(data)
        setTitleValue(data.title)
      } else {
        toast.error(tc('error'))
        router.push('/sessions?view=projects')
      }
    } catch {
      toast.error(tc('error'))
    } finally {
      setLoading(false)
    }
  }

  const loadPulse = async () => {
    setLoadingPulse(true)
    try {
      const res = await fetch(`/api/cases/${projectId}/pulse`, { cache: 'no-store' })
      if (res.ok) {
        const data = await res.json()
        setPulseData(data as PulseResponse)
      }
    } catch {
      // Best-effort UI load.
    } finally {
      setLoadingPulse(false)
    }
  }

  const handleRefreshPulse = async () => {
    setRefreshingPulse(true)
    try {
      const res = await fetch(`/api/cases/${projectId}/pulse/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data?.error || 'Failed to refresh pulse')
      if (data?.queued && data?.jobId) {
        const startedAt = Date.now()
        const timeoutMs = 120000
        while (Date.now() - startedAt < timeoutMs) {
          const jobRes = await fetch(`/api/jobs/${data.jobId}`, { cache: 'no-store' })
          const job = await jobRes.json().catch(() => ({}))
          if (!jobRes.ok) break
          if (job.status === 'completed') {
            await loadPulse()
            toast.success(t('projects.pulse.refreshCompleted'))
            return
          }
          if (job.status === 'failed') {
            throw new Error(job.lastError || t('projects.pulse.refreshFailed'))
          }
          await new Promise((resolve) => setTimeout(resolve, 1200))
        }
        toast.success(t('projects.pulse.refreshQueued'))
      } else {
        toast.success(t('projects.pulse.refreshQueued'))
      }
      await loadPulse()
    } catch (error: any) {
      toast.error(error?.message || tc('error'))
    } finally {
      setRefreshingPulse(false)
    }
  }

  const handleMarkLoopResolved = async (loop: string) => {
    setResolvingLoop(loop)
    try {
      const res = await fetch(`/api/cases/${projectId}/pulse/resolve-loop`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ loop }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data?.error || 'Failed to mark loop resolved')
      toast.success(t('projects.pulse.resolvedSuccess'))
      await handleRefreshPulse()
    } catch (error: any) {
      toast.error(error?.message || tc('error'))
    } finally {
      setResolvingLoop(null)
    }
  }

  const handleSaveTitle = async () => {
    if (!titleValue.trim() || titleValue === caseData?.title) {
      setEditingTitle(false)
      return
    }
    try {
      const res = await fetch(`/api/cases/${projectId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: titleValue.trim() }),
      })
      if (res.ok) {
        const updated = await res.json()
        setCaseData((prev) => prev ? { ...prev, ...updated } : null)
        toast.success(tc('saved'))
      } else {
        toast.error(tc('error'))
      }
    } catch {
      toast.error(tc('error'))
    } finally {
      setEditingTitle(false)
    }
  }

  const handleOpenEditDialog = () => {
    if (!caseData) return
    setEditDescription(caseData.description)
    setEditClientId(caseData.client_identifier)
    setEditStatus(caseData.status)
    setShowEditDialog(true)
  }

  const handleSaveDetails = async () => {
    setSaving(true)
    try {
      const res = await fetch(`/api/cases/${projectId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          description: editDescription,
          client_identifier: editClientId,
          status: editStatus,
        }),
      })
      if (res.ok) {
        const updated = await res.json()
        setCaseData((prev) => prev ? { ...prev, ...updated } : null)
        setShowEditDialog(false)
        toast.success(tc('saved'))
      } else {
        toast.error(tc('error'))
      }
    } catch {
      toast.error(tc('error'))
    } finally {
      setSaving(false)
    }
  }

  const statusLabel = (s: CaseStatus) => {
    if (s === 'active') return t('projects.status.active')
    if (s === 'closed') return t('projects.status.closed')
    return t('projects.status.archived')
  }

  const pulse = pulseData?.pulse || null
  const firstSessionPulse = (pulse?.session_count || 0) === 1
  const loopCounts = useMemo(() => {
    const entries = pulse?.open_loops || []
    const map = new Map<string, number>()
    entries.forEach((loop) => map.set(loop, (map.get(loop) || 0) + 1))
    return Array.from(map.entries()).map(([loop, count]) => ({ loop, count }))
  }, [pulse?.open_loops])

  const visibleDecisionLog = useMemo(() => {
    const decisions = pulse?.decision_log || []
    if (decisionExpanded || decisions.length <= 5) return decisions
    return decisions.slice(0, 5)
  }, [pulse?.decision_log, decisionExpanded])

  const participantRows = useMemo(() => {
    const count = Math.max(1, pulse?.session_count || 1)
    return (pulse?.participant_map || []).map((participant) => {
      const lastSeen = Math.max(...participant.sessions, 0)
      const stale = lastSeen > 0 && lastSeen <= count - 2
      return { ...participant, stale, sessionCount: count }
    })
  }, [pulse?.participant_map, pulse?.session_count])

  const driftBadgeText = (score: DriftScore | null) => {
    if (!score) return '--'
    if (score === 'green') return '🟢 Green'
    if (score === 'yellow') return '🟡 Yellow'
    return '🔴 Red'
  }

  const momentumBadgeText = (momentum: Momentum | null) => {
    if (!momentum) return '--'
    if (momentum === 'accelerating') return '⚡ Accelerating'
    if (momentum === 'stable') return '➡️ Stable'
    return '🐢 Stalling'
  }

  const relativeMinutes = (iso?: string | null) => {
    if (!iso) return t('projects.pulse.neverUpdated')
    const diffMs = Date.now() - new Date(iso).getTime()
    const mins = Math.max(0, Math.round(diffMs / 60000))
    if (mins < 1) return t('projects.pulse.justNow')
    if (mins < 60) return t('projects.pulse.minutesAgo', { count: mins })
    const hours = Math.round(mins / 60)
    return t('projects.pulse.hoursAgo', { count: hours })
  }

  if (loading || !caseData) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="w-full max-w-4xl lg:max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => router.push('/sessions?view=projects')}
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1 min-w-0">
          {editingTitle ? (
            <div className="flex items-center gap-2">
              <Input
                value={titleValue}
                onChange={(e) => setTitleValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSaveTitle()
                  if (e.key === 'Escape') { setTitleValue(caseData.title); setEditingTitle(false) }
                }}
                autoFocus
                className="text-xl font-semibold h-9 max-w-sm"
              />
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={handleSaveTitle}>
                <Check className="h-4 w-4 text-success" />
              </Button>
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { setTitleValue(caseData.title); setEditingTitle(false) }}>
                <X className="h-4 w-4 text-muted-foreground" />
              </Button>
            </div>
          ) : (
            <button
              className="flex items-center gap-2 group"
              onClick={() => setEditingTitle(true)}
            >
              <h1 className="text-xl font-semibold text-foreground truncate">
                {caseData.title}
              </h1>
              <Pencil className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
            </button>
          )}
          {caseData.description && (
            <p className="text-sm text-muted-foreground mt-0.5 truncate">{caseData.description}</p>
          )}
          {caseData.client_identifier && (
            <p className="text-xs text-muted-foreground mt-0.5">ID: {caseData.client_identifier}</p>
          )}
        </div>
        <Badge variant="outline">{statusLabel(caseData.status)}</Badge>
        <Button variant="outline" size="icon" onClick={handleOpenEditDialog} title="Edit project">
          <Settings className="h-4 w-4" />
        </Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-5">
        <div className="lg:col-span-2">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <FolderOpen className="h-4 w-4" />
                Sessions ({caseData.sessions.length})
              </CardTitle>
              <CardDescription>
                {caseData.sessions.length === 0
                  ? 'No sessions yet'
                  : 'All sessions in this project'}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {caseData.sessions.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <FolderOpen className="h-8 w-8 mx-auto mb-2 opacity-30" />
                  <p className="text-sm">No sessions in this project yet.</p>
                  <p className="text-xs mt-1">Assign sessions from the Sessions view.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {caseData.sessions.map((session) => {
                    const statusCfg = getSessionStatusConfig(session.status)
                    return (
                      <Link
                        key={session.id}
                        href={`/sessions/${session.id}?fromProject=${projectId}`}
                        className="flex items-start justify-between gap-4 p-3 border border-border rounded-lg hover:bg-muted/50 transition-colors group"
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <h3 className="font-medium text-sm text-foreground truncate">
                              {session.internal_case_id || `Session ${session.id.slice(0, 8)}`}
                            </h3>
                            <Badge variant="outline" className={`text-[10px] px-1.5 py-0 h-4 ${statusCfg.className}`}>
                              {statusCfg.label}
                            </Badge>
                          </div>
                          {session.context_note && (
                            <p className="text-xs text-muted-foreground mb-1 line-clamp-1">{session.context_note}</p>
                          )}
                          <div className="flex items-center gap-3 text-xs text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <Calendar className="h-3 w-3" />
                              {formatDate(session.created_at, locale)} · {formatTime(session.created_at, locale)}
                            </span>
                            {session.duration_sec > 0 && (
                              <span className="flex items-center gap-1">
                                <Clock className="h-3 w-3" />
                                {formatDuration(session.duration_sec)}
                              </span>
                            )}
                          </div>
                        </div>
                      </Link>
                    )
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="lg:col-span-3">
          <Card className="h-full">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Sparkles className="h-4 w-4" />
                    {t('projects.pulse.title')}
                  </CardTitle>
                  <CardDescription>{t('projects.pulse.subtitle')}</CardDescription>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleRefreshPulse}
                  disabled={refreshingPulse}
                >
                  {refreshingPulse ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                  <span className="ml-1">{t('projects.pulse.refresh')}</span>
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {loadingPulse ? (
                <div className="py-8 flex items-center justify-center">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              ) : !pulse ? (
                <div className="rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">
                  {t('projects.pulse.empty')}
                </div>
              ) : (
                  <div className="space-y-4">
                    <div className="sticky top-0 z-10 -mx-6 px-6 py-3 border-b border-border bg-card">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge
                          variant="outline"
                          title={firstSessionPulse ? t('projects.pulse.activatesFromSecondSession') : (pulse.drift_rationale || '')}
                          className="cursor-help"
                        >
                          {firstSessionPulse ? '--' : driftBadgeText(pulse.drift_score)}
                        </Badge>
                        <Badge
                          variant="outline"
                          title={firstSessionPulse ? t('projects.pulse.activatesFromSecondSession') : (pulse.momentum_rationale || '')}
                          className="cursor-help"
                        >
                          {firstSessionPulse ? '--' : momentumBadgeText(pulse.momentum)}
                        </Badge>
                        <Badge variant="secondary">{t('projects.pulse.version', { version: pulse.pulse_version })}</Badge>
                      </div>
                    </div>

                    <div className="rounded-lg border border-border p-3 space-y-2">
                      <p className="text-xs text-muted-foreground italic">{pulse.original_intent || t('projects.pulse.notAvailable')}</p>
                      <p className="text-sm font-semibold text-foreground">{pulse.current_direction || t('projects.pulse.notAvailable')}</p>
                    </div>

                    <div className="rounded-lg border border-border p-3 space-y-2">
                      <p className="text-sm font-medium flex items-center gap-2">
                        <ListChecks className="h-4 w-4" />
                        {t('projects.pulse.openLoops')}
                      </p>
                      {loopCounts.length === 0 ? (
                        <p className="text-xs text-muted-foreground">{t('projects.pulse.noOpenLoops')}</p>
                      ) : (
                        <ol className="space-y-2 list-decimal pl-5">
                          {loopCounts.map(({ loop, count }) => (
                            <li key={loop} className="text-sm">
                              <div className="flex items-center justify-between gap-2">
                                <div className="flex items-center gap-2">
                                  <span>{loop}</span>
                                  <Badge variant="outline" className="text-[10px]">{count}x</Badge>
                                </div>
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="ghost"
                                  disabled={resolvingLoop === loop}
                                  onClick={() => handleMarkLoopResolved(loop)}
                                >
                                  {resolvingLoop === loop ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : t('projects.pulse.markResolved')}
                                </Button>
                              </div>
                            </li>
                          ))}
                        </ol>
                      )}
                    </div>

                    <div className="rounded-lg border border-border p-3 space-y-2">
                      <p className="text-sm font-medium">{t('projects.pulse.decisionLog')}</p>
                      {(pulse.decision_log || []).length === 0 ? (
                        <p className="text-xs text-muted-foreground">{t('projects.pulse.noDecisions')}</p>
                      ) : (
                        <>
                          <div className="space-y-2">
                            {visibleDecisionLog.map((entry, idx) => (
                              <div key={`${entry.session_index}-${idx}`} className="text-sm">
                                <p className="text-foreground">{entry.decision}</p>
                                <p className="text-xs text-muted-foreground">
                                  S{entry.session_index} · {formatDate(entry.session_date, locale)}
                                </p>
                              </div>
                            ))}
                          </div>
                          {(pulse.decision_log || []).length > 5 && (
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              onClick={() => setDecisionExpanded((prev) => !prev)}
                            >
                              {decisionExpanded ? t('projects.pulse.showLess') : t('projects.pulse.showMore')}
                            </Button>
                          )}
                        </>
                      )}
                    </div>

                    <div className="rounded-lg border border-border p-3 space-y-2">
                      <p className="text-sm font-medium flex items-center gap-2">
                        <Users className="h-4 w-4" />
                        {t('projects.pulse.participantMap')}
                      </p>
                      {participantRows.length === 0 ? (
                        <p className="text-xs text-muted-foreground">{t('projects.pulse.noParticipants')}</p>
                      ) : (
                        <div className="space-y-2">
                          {participantRows.map((participant) => (
                            <div key={participant.name} className={`rounded-md border p-2 ${participant.stale ? 'border-amber-500/40 bg-amber-500/10' : 'border-border'}`}>
                              <div className="flex items-center justify-between gap-2">
                                <p className="text-sm font-medium">{participant.name}</p>
                                <p className="text-xs text-muted-foreground">
                                  {t('projects.pulse.lastSeen')} {formatDate(participant.last_seen, locale)}
                                </p>
                              </div>
                              <div className="mt-2 flex items-center gap-1 flex-wrap">
                                {Array.from({ length: participant.sessionCount }).map((_, index) => {
                                  const sessionNo = index + 1
                                  const present = participant.sessions.includes(sessionNo)
                                  return (
                                    <span
                                      key={`${participant.name}-${sessionNo}`}
                                      className={`h-2.5 w-2.5 rounded-full ${present ? 'bg-primary' : 'bg-muted'}`}
                                      title={`S${sessionNo}`}
                                    />
                                  )
                                })}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="rounded-lg border border-border p-3">
                      <p className="text-sm font-medium flex items-center gap-2 mb-2">
                        <MessageSquareDot className="h-4 w-4" />
                        {t('projects.pulse.narrative')}
                      </p>
                      <p className="text-sm leading-relaxed text-foreground">{pulse.narrative || t('projects.pulse.notAvailable')}</p>
                    </div>

                    <div className="text-xs text-muted-foreground flex flex-wrap items-center gap-2">
                      <span>{t('projects.pulse.lastUpdated')} {relativeMinutes(pulse.updated_at || pulseData?.pulseUpdatedAt)}</span>
                      <span>·</span>
                      <span>{t('projects.pulse.basedOnSessions', { count: pulse.session_count || 0 })}</span>
                    </div>
                  </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Edit Details Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Project</DialogTitle>
            <DialogDescription>Update project details and status.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-3">
            <div className="space-y-1.5">
              <Label>{t('projects.status.active')}</Label>
              <Select value={editStatus} onValueChange={(v) => setEditStatus(v as CaseStatus)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">{t('projects.status.active')}</SelectItem>
                  <SelectItem value="closed">{t('projects.status.closed')}</SelectItem>
                  <SelectItem value="archived">{t('projects.status.archived')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>{t('projects.createDialog.clientIdLabel')}</Label>
              <Input
                placeholder={t('projects.createDialog.clientIdPlaceholder')}
                value={editClientId}
                onChange={(e) => setEditClientId(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>{t('projects.createDialog.descriptionLabel')}</Label>
              <Textarea
                placeholder={t('projects.createDialog.descriptionPlaceholder')}
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
                rows={4}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditDialog(false)}>
              {tc('cancel')}
            </Button>
            <Button onClick={handleSaveDetails} disabled={saving}>
              {saving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {tc('saving')}
                </>
              ) : tc('save')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
