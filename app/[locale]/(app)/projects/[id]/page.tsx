'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
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
  Clock,
  ChevronRight,
  Settings,
  Pencil,
  Check,
  X,
  RefreshCw,
  Users,
  ListChecks,
  Sparkles,
  MessageSquareDot,
  MapPin,
  CalendarDays,
  Globe,
  Download,
  Lightbulb,
  Contact,
} from 'lucide-react'
import { formatDuration } from '@/lib/utils/date-formatters'
import type { EventMetadata, EventDigest } from '@/lib/types/database'

interface CaseData {
  id: string
  title: string
  client_identifier: string
  description: string
  status: 'active' | 'closed' | 'archived'
  created_at: string
  updated_at: string
  project_type: string | null
  user_role: string | null
  event_metadata?: EventMetadata | null
  sessions: SessionRow[]
}

interface EventProposal {
  event_name: string
  venue: string
  address: string
  dates: string
  official_speakers: string[]
  agenda_url: string | null
  source_url: string | null
  confidence: number
  rationale: string
}

// An Event project gets the auto-grouping / web-enrichment / digest surface.
// project_type is free text, so match the event family loosely.
function isEventProject(projectType: string | null | undefined): boolean {
  const t = String(projectType || '').toLowerCase()
  return /event|summit|conference|congress|trade ?show|messe|kongress|tagung/.test(t)
}

interface SessionRow {
  id: string
  internal_case_id?: string
  context_note?: string
  private_comments?: string
  status: string
  created_at: string
  duration_sec: number
  input_hint?: string | null
  recording_type?: string | null
  language_code?: string | null
  ai_extracted_context?: {
    purpose?: string
    agenda?: string[]
    participants?: Array<string | { name?: string; role?: string }>
    summary?: string[]
  } | null
}

type CaseStatus = 'active' | 'closed' | 'archived'

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

interface PulseHistoryChunk {
  period_label: string
  date_range: { from: string; to: string }
  session_indices: number[]
  summary: string
  key_decisions: string[]
}

interface PulseTypeMismatch {
  suggested_type: string
  suggested_role: string
  confidence: number
  rationale: string
  triggering_session_id: string
  detected_at: string
}

// Phase 2 universal frame. Legacy fields are kept optional so older pulses
// still render gracefully until they are re-written by the next refresh.
interface ProjectPulse {
  // Universal frame
  project_type?: string
  user_role?: string
  current_status?: string
  covered?: string[]
  missing?: string[]
  next_actions?: string[]
  open_loops: string[]
  decision_log: PulseDecision[]
  participants?: PulseParticipant[]
  narrative: string
  type_mismatch_suggestion?: PulseTypeMismatch | null
  history_chunks?: PulseHistoryChunk[]
  // Bookkeeping
  session_count: number
  pulse_version: number
  updated_at: string
  // Deprecated (pre-Phase-2)
  original_intent?: string
  current_direction?: string
  drift_score?: 'green' | 'yellow' | 'red'
  drift_rationale?: string
  momentum?: 'accelerating' | 'stable' | 'stalling'
  momentum_rationale?: string
  participant_map?: PulseParticipant[]
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

function formatSessionKindLabel(session: SessionRow): string {
  const raw = (session.input_hint || session.recording_type || '').trim()
  if (!raw) return 'Session'
  return raw
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (m) => m.toUpperCase())
}

function getSessionParticipants(session: SessionRow): string[] {
  const items = session.ai_extracted_context?.participants || []
  const names = items
    .map((participant) => {
      if (typeof participant === 'string') return participant.trim()
      return String(participant?.name || '').trim()
    })
    .filter(Boolean)
  return Array.from(new Set(names))
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
  const [editProjectType, setEditProjectType] = useState('')
  const [editUserRole, setEditUserRole] = useState('')
  const [editDefaultPurpose, setEditDefaultPurpose] = useState('')
  const [saving, setSaving] = useState(false)
  const [editingTitle, setEditingTitle] = useState(false)
  const [titleValue, setTitleValue] = useState('')
  const [pulseData, setPulseData] = useState<PulseResponse | null>(null)
  const [loadingPulse, setLoadingPulse] = useState(true)
  const [refreshingPulse, setRefreshingPulse] = useState(false)
  const [showPulseEditDialog, setShowPulseEditDialog] = useState(false)
  const [pulseOverrideStatus, setPulseOverrideStatus] = useState('')
  const [pulseOverrideNarrative, setPulseOverrideNarrative] = useState('')
  const [savingPulseOverride, setSavingPulseOverride] = useState(false)
  const [decisionExpanded, setDecisionExpanded] = useState(false)
  const [resolvingLoop, setResolvingLoop] = useState<string | null>(null)
  const [dismissingTypeMismatch, setDismissingTypeMismatch] = useState(false)
  const [applyingTypeMismatch, setApplyingTypeMismatch] = useState(false)
  const [historyExpanded, setHistoryExpanded] = useState(false)
  const [expandedSessionId, setExpandedSessionId] = useState<string | null>(null)
  const [sparkleSessionId, setSparkleSessionId] = useState<string | null>(null)
  const sparkleTimeoutRef = useRef<number | null>(null)

  // Event project state
  const [eventDigest, setEventDigest] = useState<EventDigest | null>(null)
  const [generatingDigest, setGeneratingDigest] = useState(false)
  const [enriching, setEnriching] = useState(false)
  const [eventProposal, setEventProposal] = useState<EventProposal | null>(null)
  const [showProposalDialog, setShowProposalDialog] = useState(false)
  const [confirmingEvent, setConfirmingEvent] = useState(false)
  const [editingEvent, setEditingEvent] = useState(false)
  const [eventForm, setEventForm] = useState({ event_name: '', venue: '', address: '', dates: '' })

  useEffect(() => {
    loadProject()
    loadPulse()
    loadEventDigest()
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

  const loadEventDigest = async () => {
    try {
      const res = await fetch(`/api/cases/${projectId}/digest`, { cache: 'no-store' })
      if (res.ok) {
        const data = await res.json()
        setEventDigest((data?.digest as EventDigest) || null)
      }
    } catch {
      // Best-effort.
    }
  }

  const handleGenerateDigest = async () => {
    setGeneratingDigest(true)
    try {
      const res = await fetch(`/api/cases/${projectId}/digest`, { method: 'POST' })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data?.error || tc('error'))
      await loadEventDigest()
      toast.success(t('projects.event.digestGenerated'))
    } catch (error: any) {
      toast.error(error?.message || tc('error'))
    } finally {
      setGeneratingDigest(false)
    }
  }

  const handleIdentifyEvent = async () => {
    setEnriching(true)
    try {
      const res = await fetch(`/api/cases/${projectId}/enrich-event`, { method: 'POST' })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data?.error || tc('error'))
      const proposal = data.proposal as EventProposal
      setEventProposal(proposal)
      // When the web lookup can't confidently name the event, drop straight into
      // manual entry (seeded with the project title) rather than a dead end.
      const lookupFailed = !proposal.event_name
      setEventForm({
        event_name: proposal.event_name || (lookupFailed ? caseData?.title || '' : ''),
        venue: proposal.venue || '',
        address: proposal.address || '',
        dates: proposal.dates || '',
      })
      setEditingEvent(lookupFailed)
      setShowProposalDialog(true)
    } catch (error: any) {
      toast.error(error?.message || tc('error'))
    } finally {
      setEnriching(false)
    }
  }

  const startEditingEvent = () => {
    setEventForm({
      event_name: eventProposal?.event_name || caseData?.title || '',
      venue: eventProposal?.venue || '',
      address: eventProposal?.address || '',
      dates: eventProposal?.dates || '',
    })
    setEditingEvent(true)
  }

  const handleConfirmEvent = async () => {
    // Identity fields come from the edit form when correcting/forcing a result,
    // otherwise straight from the lookup. Roster + source carry through from the
    // lookup either way.
    const eventName = (editingEvent ? eventForm.event_name : eventProposal?.event_name || '').trim()
    if (!eventName) return
    setConfirmingEvent(true)
    try {
      const metadata: EventMetadata = {
        event_name: eventName,
        venue: (editingEvent ? eventForm.venue : eventProposal?.venue || '').trim(),
        address: (editingEvent ? eventForm.address : eventProposal?.address || '').trim(),
        dates: (editingEvent ? eventForm.dates : eventProposal?.dates || '').trim(),
        official_speakers: eventProposal?.official_speakers ?? [],
        agenda_url: eventProposal?.agenda_url ?? null,
        source_url: eventProposal?.source_url ?? null,
        confirmed: true,
      }
      const res = await fetch(`/api/cases/${projectId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ event_metadata: metadata }),
      })
      const updated = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(updated?.error || tc('error'))
      setCaseData((prev) => (prev ? { ...prev, event_metadata: metadata } : prev))
      setShowProposalDialog(false)
      setEditingEvent(false)
      toast.success(t('projects.event.identityConfirmed'))
    } catch (error: any) {
      toast.error(error?.message || tc('error'))
    } finally {
      setConfirmingEvent(false)
    }
  }

  const handleExportDigest = () => {
    const content = eventDigest?.content
    if (!content) return
    const ev = caseData?.event_metadata
    const lines: string[] = []
    lines.push(`# ${content.event_name || ev?.event_name || caseData?.title || 'Event digest'}`)
    if (ev?.venue || ev?.dates) {
      lines.push('')
      lines.push([ev?.venue, ev?.dates].filter(Boolean).join(' · '))
    }
    if (content.key_takeaways?.length) {
      lines.push('', '## Key takeaways', ...content.key_takeaways.map((x) => `- ${x}`))
    }
    const personLine = (p: { name: string; affiliation?: string; note?: string }) => {
      const tail = [p.affiliation, p.note].filter(Boolean).join(' — ')
      return `- ${p.name}${tail ? ` (${tail})` : ''}`
    }
    if (content.presenters?.length) {
      lines.push('', '## Presenters', ...content.presenters.map(personLine))
    }
    if (content.people_met?.length) {
      lines.push('', '## People met', ...content.people_met.map(personLine))
    }
    if (content.follow_ups?.length) {
      lines.push('', '## Follow-ups', ...content.follow_ups.map((x) => `- ${x}`))
    }
    if (content.narrative) {
      lines.push('', '## Summary', content.narrative)
    }
    const blob = new Blob([lines.join('\n')], { type: 'text/markdown' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `event-digest-${projectId.slice(0, 8)}.md`
    a.click()
    URL.revokeObjectURL(url)
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

  const openPulseCorrectionDialog = () => {
    const pulse = pulseData?.pulse
    if (!pulse) {
      toast.error(t('projects.pulse.empty'))
      return
    }
    setPulseOverrideStatus(String(pulse.current_status || pulse.current_direction || ''))
    setPulseOverrideNarrative(String(pulse.narrative || ''))
    setShowPulseEditDialog(true)
  }

  const handleSavePulseCorrections = async () => {
    if (!pulseOverrideStatus.trim() || !pulseOverrideNarrative.trim()) {
      toast.error(t('projects.pulse.correctionRequired'))
      return
    }

    setSavingPulseOverride(true)
    try {
      const res = await fetch(`/api/cases/${projectId}/pulse`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          currentStatus: pulseOverrideStatus.trim(),
          narrative: pulseOverrideNarrative.trim(),
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data?.error || t('projects.pulse.correctionFailed'))
      setShowPulseEditDialog(false)
      await loadPulse()
      toast.success(t('projects.pulse.correctionSaved'))
    } catch (error: any) {
      toast.error(error?.message || t('projects.pulse.correctionFailed'))
    } finally {
      setSavingPulseOverride(false)
    }
  }

  const handleApplyTypeMismatch = async () => {
    const suggestion = pulseData?.pulse?.type_mismatch_suggestion
    if (!suggestion) return
    setApplyingTypeMismatch(true)
    try {
      const res = await fetch(`/api/cases/${projectId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          project_type: suggestion.suggested_type,
          user_role: suggestion.suggested_role || caseData?.user_role || '',
        }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data?.error || tc('error'))
      }
      const updated = await res.json()
      setCaseData((prev) => (prev ? { ...prev, ...updated } : null))
      // Also clear the suggestion from the pulse so it doesn't keep prompting.
      await fetch(`/api/cases/${projectId}/pulse/dismiss-type-mismatch`, { method: 'POST' }).catch(() => {})
      await loadPulse()
      toast.success(t('projects.pulse.typeSwitched'))
    } catch (error: any) {
      toast.error(error?.message || tc('error'))
    } finally {
      setApplyingTypeMismatch(false)
    }
  }

  const handleDismissTypeMismatch = async () => {
    setDismissingTypeMismatch(true)
    try {
      const res = await fetch(`/api/cases/${projectId}/pulse/dismiss-type-mismatch`, { method: 'POST' })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data?.error || tc('error'))
      }
      await loadPulse()
    } catch (error: any) {
      toast.error(error?.message || tc('error'))
    } finally {
      setDismissingTypeMismatch(false)
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
    setEditProjectType(caseData.project_type || '')
    setEditUserRole(caseData.user_role || '')
    setEditDefaultPurpose((caseData as any).default_session_purpose || '')
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
          project_type: editProjectType.trim() || null,
          user_role: editUserRole.trim() || null,
          default_session_purpose: editDefaultPurpose.trim() || null,
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
    const source: PulseParticipant[] = (pulse?.participants && pulse.participants.length > 0)
      ? pulse.participants
      : (pulse?.participant_map || [])
    return source.map((participant) => {
      const lastSeen = Math.max(...participant.sessions, 0)
      const stale = lastSeen > 0 && lastSeen <= count - 2
      return { ...participant, stale, sessionCount: count }
    })
  }, [pulse?.participants, pulse?.participant_map, pulse?.session_count])

  const historyChunks = useMemo(() => pulse?.history_chunks || [], [pulse?.history_chunks])
  const visibleHistoryChunks = useMemo(() => {
    if (historyExpanded || historyChunks.length <= 2) return historyChunks
    return historyChunks.slice(-2)
  }, [historyChunks, historyExpanded])

  const typeMismatch = pulse?.type_mismatch_suggestion || null

  const relativeMinutes = (iso?: string | null) => {
    if (!iso) return t('projects.pulse.neverUpdated')
    const diffMs = Date.now() - new Date(iso).getTime()
    const mins = Math.max(0, Math.round(diffMs / 60000))
    if (mins < 1) return t('projects.pulse.justNow')
    if (mins < 60) return t('projects.pulse.minutesAgo', { count: mins })
    const hours = Math.round(mins / 60)
    return t('projects.pulse.hoursAgo', { count: hours })
  }

  const toggleSessionExpanded = (sessionId: string) => {
    if (sparkleTimeoutRef.current) window.clearTimeout(sparkleTimeoutRef.current)
    setSparkleSessionId(sessionId)
    sparkleTimeoutRef.current = window.setTimeout(() => {
      setSparkleSessionId((prev) => (prev === sessionId ? null : prev))
    }, 520)
    setExpandedSessionId((prev) => (prev === sessionId ? null : sessionId))
  }

  useEffect(() => {
    return () => {
      if (sparkleTimeoutRef.current) window.clearTimeout(sparkleTimeoutRef.current)
    }
  }, [])

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
          {(caseData.project_type || caseData.user_role) && (
            <div className="flex flex-wrap items-center gap-1.5 mt-1">
              {caseData.project_type && (
                <Badge variant="secondary" className="font-normal">
                  {caseData.project_type}
                </Badge>
              )}
              {caseData.user_role && (
                <Badge variant="outline" className="font-normal">
                  {t('projects.createDialog.userRoleLabel')}: {caseData.user_role}
                </Badge>
              )}
            </div>
          )}
        </div>
        <Badge variant="outline">{statusLabel(caseData.status)}</Badge>
        <Button variant="outline" size="icon" onClick={handleOpenEditDialog} title="Edit project">
          <Settings className="h-4 w-4" />
        </Button>
      </div>

      {isEventProject(caseData.project_type) && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <CardTitle className="flex items-center gap-2 text-base">
                  <CalendarDays className="h-4 w-4" />
                  {t('projects.event.title')}
                </CardTitle>
                <CardDescription>{t('projects.event.subtitle')}</CardDescription>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleIdentifyEvent}
                  disabled={enriching}
                >
                  {enriching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Globe className="h-4 w-4" />}
                  <span className="ml-1">
                    {caseData.event_metadata?.confirmed
                      ? t('projects.event.reidentify')
                      : t('projects.event.identify')}
                  </span>
                </Button>
                <Button
                  type="button"
                  size="sm"
                  onClick={handleGenerateDigest}
                  disabled={generatingDigest}
                >
                  {generatingDigest ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                  <span className="ml-1">
                    {eventDigest ? t('projects.event.refreshDigest') : t('projects.event.generateDigest')}
                  </span>
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {caseData.event_metadata?.confirmed ? (
              <div className="rounded-lg border border-border p-3 space-y-1.5">
                <p className="text-sm font-semibold text-foreground">
                  {caseData.event_metadata.event_name || caseData.title}
                </p>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                  {(caseData.event_metadata.venue || caseData.event_metadata.address) && (
                    <span className="flex items-center gap-1">
                      <MapPin className="h-3.5 w-3.5" />
                      {[caseData.event_metadata.venue, caseData.event_metadata.address].filter(Boolean).join(', ')}
                    </span>
                  )}
                  {caseData.event_metadata.dates && (
                    <span className="flex items-center gap-1">
                      <CalendarDays className="h-3.5 w-3.5" />
                      {caseData.event_metadata.dates}
                    </span>
                  )}
                  {caseData.event_metadata.source_url && (
                    <a
                      href={caseData.event_metadata.source_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 underline hover:text-foreground"
                    >
                      <Globe className="h-3.5 w-3.5" />
                      {t('projects.event.source')}
                    </a>
                  )}
                </div>
              </div>
            ) : (
              <div className="rounded-lg border border-dashed border-border p-3 text-sm text-muted-foreground">
                {t('projects.event.notIdentified')}
              </div>
            )}

            {!eventDigest ? (
              <div className="rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">
                {t('projects.event.digestEmpty')}
              </div>
            ) : (
              <div className="space-y-4">
                {eventDigest.content.key_takeaways?.length > 0 && (
                  <div className="rounded-lg border border-border p-3 space-y-2">
                    <p className="text-sm font-medium flex items-center gap-2">
                      <Lightbulb className="h-4 w-4" />
                      {t('projects.event.keyTakeaways')}
                    </p>
                    <ul className="space-y-1 list-disc pl-5 text-sm text-foreground">
                      {eventDigest.content.key_takeaways.map((item, idx) => (
                        <li key={`takeaway-${idx}`}>{item}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {(eventDigest.content.presenters?.length ?? 0) > 0 && (
                  <div className="rounded-lg border border-border p-3 space-y-2">
                    <p className="text-sm font-medium flex items-center gap-2">
                      <Users className="h-4 w-4" />
                      {t('projects.event.presenters')}
                    </p>
                    <ul className="space-y-1.5 text-sm text-foreground">
                      {eventDigest.content.presenters!.map((person, idx) => (
                        <li key={`presenter-${idx}`}>
                          <span className="font-medium">{person.name}</span>
                          {person.affiliation && (
                            <span className="text-muted-foreground"> · {person.affiliation}</span>
                          )}
                          {person.note && <span className="text-muted-foreground"> — {person.note}</span>}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {eventDigest.content.people_met?.length > 0 && (
                  <div className="rounded-lg border border-border p-3 space-y-2">
                    <p className="text-sm font-medium flex items-center gap-2">
                      <Contact className="h-4 w-4" />
                      {t('projects.event.peopleMet')}
                    </p>
                    <ul className="space-y-1.5 text-sm text-foreground">
                      {eventDigest.content.people_met.map((person, idx) => (
                        <li key={`person-${idx}`}>
                          <span className="font-medium">{person.name}</span>
                          {person.affiliation && (
                            <span className="text-muted-foreground"> · {person.affiliation}</span>
                          )}
                          {person.note && <span className="text-muted-foreground"> — {person.note}</span>}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {eventDigest.content.follow_ups?.length > 0 && (
                  <div className="rounded-lg border border-border p-3 space-y-2">
                    <p className="text-sm font-medium flex items-center gap-2">
                      <ListChecks className="h-4 w-4" />
                      {t('projects.event.followUps')}
                    </p>
                    <ul className="space-y-1 list-disc pl-5 text-sm text-foreground">
                      {eventDigest.content.follow_ups.map((item, idx) => (
                        <li key={`followup-${idx}`}>{item}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {eventDigest.content.narrative && (
                  <div className="rounded-lg border border-border p-3">
                    <p className="text-sm font-medium flex items-center gap-2 mb-2">
                      <MessageSquareDot className="h-4 w-4" />
                      {t('projects.event.summary')}
                    </p>
                    <p className="text-sm leading-relaxed text-foreground">{eventDigest.content.narrative}</p>
                  </div>
                )}

                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-xs text-muted-foreground">
                    {t('projects.event.basedOnRecordings', { count: eventDigest.source_session_ids.length })}
                  </span>
                  <Button type="button" variant="outline" size="sm" onClick={handleExportDigest}>
                    <Download className="h-4 w-4" />
                    <span className="ml-1">{t('projects.event.export')}</span>
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

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
                    const isExpanded = expandedSessionId === session.id
                    const extracted = session.ai_extracted_context ?? null
                    const participants = getSessionParticipants(session)
                    const purpose = String(extracted?.purpose || '').trim()
                    const agendaSource: unknown[] = Array.isArray(extracted?.agenda)
                      ? (extracted!.agenda as unknown[])
                      : []
                    const summarySource: unknown[] = Array.isArray(extracted?.summary)
                      ? (extracted!.summary as unknown[])
                      : []
                    const agendaItems: string[] = agendaSource
                      .filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
                      .slice(0, 3)
                    const summaryItems: string[] = summarySource
                      .filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
                      .slice(0, 2)
                    return (
                      <div
                        key={session.id}
                        className="border border-border rounded-lg transition-colors"
                      >
                        <button
                          type="button"
                          onClick={() => toggleSessionExpanded(session.id)}
                          className="w-full flex items-start justify-between gap-3 p-3 text-left hover:bg-muted/40 rounded-lg"
                        >
                          <div className="flex-1 min-w-0">
                            <div className="flex flex-wrap items-center gap-2 mb-1">
                              <span className="text-sm font-medium text-foreground">
                                {formatDate(session.created_at, locale)} · {formatTime(session.created_at, locale)}
                              </span>
                              <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4">
                                {formatSessionKindLabel(session)}
                              </Badge>
                              <Badge variant="outline" className={`text-[10px] px-1.5 py-0 h-4 ${statusCfg.className}`}>
                                {statusCfg.label}
                              </Badge>
                            </div>
                            <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                              {participants.length > 0 ? (
                                <span className="truncate">{participants.join(', ')}</span>
                              ) : (
                                <span>{session.internal_case_id || `Session ${session.id.slice(0, 8)}`}</span>
                              )}
                              {session.duration_sec > 0 && (
                                <span className="flex items-center gap-1">
                                  <Clock className="h-3 w-3" />
                                  {formatDuration(session.duration_sec)}
                                </span>
                              )}
                            </div>
                          </div>
                          <span className="relative mt-0.5 shrink-0 inline-flex items-center justify-center">
                            <ChevronRight
                              className={`h-4 w-4 text-muted-foreground transition-transform duration-200 ease-out ${
                                isExpanded ? 'rotate-90' : 'rotate-0'
                              }`}
                            />
                            <Sparkles
                              className={`absolute -right-1 -top-1 h-3 w-3 text-yellow-400 pointer-events-none transition-all duration-300 ${
                                sparkleSessionId === session.id ? 'opacity-100 scale-100 animate-pulse' : 'opacity-0 scale-75'
                              }`}
                            />
                          </span>
                        </button>

                        <div
                          className={isExpanded
                            ? 'grid transition-[grid-template-rows,opacity] duration-200 ease-out grid-rows-[1fr] opacity-100'
                            : 'grid transition-[grid-template-rows,opacity] duration-200 ease-out grid-rows-[0fr] opacity-0'}
                          aria-hidden={!isExpanded}
                        >
                          <div className="overflow-hidden">
                            <div className="px-3 pb-3 space-y-3 border-t border-border/60">
                              <div className="pt-3 grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                                <div className="rounded-md bg-muted/40 px-2.5 py-2">
                                  <span className="text-muted-foreground">Language</span>
                                  <p className="text-foreground mt-0.5">{session.language_code || 'n/a'}</p>
                                </div>
                                <div className="rounded-md bg-muted/40 px-2.5 py-2">
                                  <span className="text-muted-foreground">Participants</span>
                                  <p className="text-foreground mt-0.5">
                                    {participants.length > 0 ? participants.join(', ') : 'n/a'}
                                  </p>
                                </div>
                              </div>

                              {purpose && (
                                <div className="text-xs">
                                  <p className="text-muted-foreground mb-1">Purpose</p>
                                  <p className="text-foreground">{purpose}</p>
                                </div>
                              )}

                              {agendaItems.length > 0 && (
                                <div className="text-xs">
                                  <p className="text-muted-foreground mb-1">Agenda</p>
                                  <ul className="space-y-1 list-disc pl-4 text-foreground">
                                    {agendaItems.map((item, index) => (
                                      <li key={`${session.id}-agenda-${index}`}>{item}</li>
                                    ))}
                                  </ul>
                                </div>
                              )}

                              {summaryItems.length > 0 && (
                                <div className="text-xs">
                                  <p className="text-muted-foreground mb-1">Highlights</p>
                                  <ul className="space-y-1 list-disc pl-4 text-foreground">
                                    {summaryItems.map((item, index) => (
                                      <li key={`${session.id}-summary-${index}`}>{item}</li>
                                    ))}
                                  </ul>
                                </div>
                              )}

                              {session.context_note && (
                                <div className="text-xs">
                                  <p className="text-muted-foreground mb-1">Context note</p>
                                  <p className="text-foreground whitespace-pre-wrap">{session.context_note}</p>
                                </div>
                              )}

                              {session.private_comments && (
                                <div className="text-xs">
                                  <p className="text-muted-foreground mb-1">Private comments</p>
                                  <p className="text-foreground whitespace-pre-wrap">{session.private_comments}</p>
                                </div>
                              )}

                              <div className="pt-1">
                                <Link href={`/sessions/${session.id}?fromProject=${projectId}`}>
                                  <Button size="sm" variant="outline">
                                    Open session
                                  </Button>
                                </Link>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
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
                  onClick={openPulseCorrectionDialog}
                  disabled={!pulse}
                >
                  <Pencil className="h-4 w-4" />
                  <span className="ml-1">{t('projects.pulse.correct')}</span>
                </Button>
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
                        {pulse.project_type && (
                          <Badge variant="secondary" className="font-normal">
                            {pulse.project_type}
                          </Badge>
                        )}
                        {pulse.user_role && (
                          <Badge variant="outline" className="font-normal">
                            {pulse.user_role}
                          </Badge>
                        )}
                        <Badge variant="secondary">{t('projects.pulse.version', { version: pulse.pulse_version })}</Badge>
                      </div>
                    </div>

                    {typeMismatch && (
                      <div className="rounded-lg border border-amber-500/50 bg-amber-500/10 p-3 space-y-2">
                        <div className="flex items-start gap-2">
                          <Sparkles className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-foreground">
                              {t('projects.pulse.typeMismatchTitle')}
                            </p>
                            <p className="text-xs text-muted-foreground mt-1">
                              {t('projects.pulse.typeMismatchSuggested', {
                                type: typeMismatch.suggested_type,
                                role: typeMismatch.suggested_role || '—',
                              })}
                            </p>
                            {typeMismatch.rationale && (
                              <p className="text-xs text-foreground/80 mt-1 italic">{typeMismatch.rationale}</p>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2 pt-1">
                          <Button
                            type="button"
                            size="sm"
                            onClick={handleApplyTypeMismatch}
                            disabled={applyingTypeMismatch || dismissingTypeMismatch}
                          >
                            {applyingTypeMismatch ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                            <span className="ml-1">{t('projects.pulse.typeMismatchApply')}</span>
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={handleDismissTypeMismatch}
                            disabled={dismissingTypeMismatch || applyingTypeMismatch}
                          >
                            {dismissingTypeMismatch ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                            <span className="ml-1">{t('projects.pulse.typeMismatchDismiss')}</span>
                          </Button>
                        </div>
                      </div>
                    )}

                    <div className="rounded-lg border border-border p-3 space-y-1">
                      <p className="text-xs text-muted-foreground uppercase tracking-wide">{t('projects.pulse.currentStatus')}</p>
                      <p className="text-sm font-semibold text-foreground">
                        {pulse.current_status || pulse.current_direction || t('projects.pulse.notAvailable')}
                      </p>
                    </div>

                    {(pulse.covered && pulse.covered.length > 0) && (
                      <div className="rounded-lg border border-border p-3 space-y-2">
                        <p className="text-sm font-medium">{t('projects.pulse.covered')}</p>
                        <ul className="space-y-1 list-disc pl-5 text-sm text-foreground">
                          {pulse.covered.map((item, idx) => (
                            <li key={`covered-${idx}`}>{item}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {(pulse.missing && pulse.missing.length > 0) && (
                      <div className="rounded-lg border border-border p-3 space-y-2">
                        <p className="text-sm font-medium">{t('projects.pulse.missing')}</p>
                        <ul className="space-y-1 list-disc pl-5 text-sm text-foreground">
                          {pulse.missing.map((item, idx) => (
                            <li key={`missing-${idx}`}>{item}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {(pulse.next_actions && pulse.next_actions.length > 0) && (
                      <div className="rounded-lg border border-border p-3 space-y-2">
                        <p className="text-sm font-medium">{t('projects.pulse.nextActions')}</p>
                        <ul className="space-y-1 list-disc pl-5 text-sm text-foreground">
                          {pulse.next_actions.map((item, idx) => (
                            <li key={`next-${idx}`}>{item}</li>
                          ))}
                        </ul>
                      </div>
                    )}

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

                    {historyChunks.length > 0 && (
                      <div className="rounded-lg border border-border p-3 space-y-2">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-sm font-medium">{t('projects.pulse.history')}</p>
                          {historyChunks.length > 2 && (
                            <Button
                              type="button"
                              size="sm"
                              variant="ghost"
                              onClick={() => setHistoryExpanded((prev) => !prev)}
                            >
                              {historyExpanded
                                ? t('projects.pulse.showLess')
                                : t('projects.pulse.historyShowAll', { count: historyChunks.length })}
                            </Button>
                          )}
                        </div>
                        <div className="space-y-2">
                          {visibleHistoryChunks.map((chunk, idx) => (
                            <div key={`history-${idx}`} className="rounded-md border border-border/60 p-2 bg-muted/20">
                              <div className="flex items-center justify-between gap-2">
                                <p className="text-sm font-medium">{chunk.period_label}</p>
                                <p className="text-xs text-muted-foreground">
                                  S{chunk.session_indices[0] || '?'}–S{chunk.session_indices[chunk.session_indices.length - 1] || '?'}
                                </p>
                              </div>
                              <p className="text-sm text-foreground mt-1">{chunk.summary}</p>
                              {chunk.key_decisions && chunk.key_decisions.length > 0 && (
                                <ul className="mt-2 space-y-0.5 list-disc pl-5 text-xs text-muted-foreground">
                                  {chunk.key_decisions.map((d, di) => (
                                    <li key={`history-${idx}-d-${di}`}>{d}</li>
                                  ))}
                                </ul>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

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
            <div className="space-y-1.5">
              <Label>{t('projects.createDialog.projectTypeLabel')}</Label>
              <Input
                placeholder={t('projects.createDialog.projectTypePlaceholder')}
                value={editProjectType}
                onChange={(e) => setEditProjectType(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>{t('projects.createDialog.userRoleLabel')}</Label>
              <Input
                placeholder={t('projects.createDialog.userRolePlaceholder')}
                value={editUserRole}
                onChange={(e) => setEditUserRole(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>{t('projects.editDialog.defaultPurposeLabel')}</Label>
              <Input
                placeholder={t('projects.editDialog.defaultPurposePlaceholder')}
                value={editDefaultPurpose}
                onChange={(e) => setEditDefaultPurpose(e.target.value)}
              />
              <p className="text-[11px] text-muted-foreground">{t('projects.editDialog.defaultPurposeHint')}</p>
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

      <Dialog open={showPulseEditDialog} onOpenChange={setShowPulseEditDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{t('projects.pulse.correctTitle')}</DialogTitle>
            <DialogDescription>{t('projects.pulse.correctDescription')}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>{t('projects.pulse.currentStatusLabel')}</Label>
              <Textarea
                rows={2}
                value={pulseOverrideStatus}
                onChange={(e) => setPulseOverrideStatus(e.target.value)}
                placeholder={t('projects.pulse.currentStatusPlaceholder')}
              />
            </div>
            <div className="space-y-1.5">
              <Label>{t('projects.pulse.narrativeLabel')}</Label>
              <Textarea
                rows={4}
                value={pulseOverrideNarrative}
                onChange={(e) => setPulseOverrideNarrative(e.target.value)}
                placeholder={t('projects.pulse.narrativePlaceholder')}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPulseEditDialog(false)}>
              {tc('cancel')}
            </Button>
            <Button onClick={handleSavePulseCorrections} disabled={savingPulseOverride}>
              {savingPulseOverride ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              {t('projects.pulse.saveCorrections')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Event identity confirmation */}
      <Dialog
        open={showProposalDialog}
        onOpenChange={(open) => {
          setShowProposalDialog(open)
          if (!open) setEditingEvent(false)
        }}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editingEvent ? t('projects.event.manualTitle') : t('projects.event.confirmTitle')}
            </DialogTitle>
            <DialogDescription>
              {editingEvent ? t('projects.event.manualDescription') : t('projects.event.confirmDescription')}
            </DialogDescription>
          </DialogHeader>

          {editingEvent ? (
            <div className="space-y-3 py-2">
              <div className="space-y-1.5">
                <Label htmlFor="event-name">{t('projects.event.fieldName')}</Label>
                <Input
                  id="event-name"
                  value={eventForm.event_name}
                  onChange={(e) => setEventForm((f) => ({ ...f, event_name: e.target.value }))}
                  placeholder={t('projects.event.fieldNamePlaceholder')}
                  autoFocus
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="event-venue">{t('projects.event.fieldVenue')}</Label>
                <Input
                  id="event-venue"
                  value={eventForm.venue}
                  onChange={(e) => setEventForm((f) => ({ ...f, venue: e.target.value }))}
                  placeholder={t('projects.event.fieldVenuePlaceholder')}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="event-address">{t('projects.event.fieldAddress')}</Label>
                <Input
                  id="event-address"
                  value={eventForm.address}
                  onChange={(e) => setEventForm((f) => ({ ...f, address: e.target.value }))}
                  placeholder={t('projects.event.fieldAddressPlaceholder')}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="event-dates">{t('projects.event.fieldDates')}</Label>
                <Input
                  id="event-dates"
                  value={eventForm.dates}
                  onChange={(e) => setEventForm((f) => ({ ...f, dates: e.target.value }))}
                  placeholder={t('projects.event.fieldDatesPlaceholder')}
                />
              </div>
            </div>
          ) : (
            eventProposal && (
              <div className="space-y-3 py-2">
                <div className="rounded-lg border border-border p-3 space-y-2">
                  <p className="text-base font-semibold text-foreground">
                    {eventProposal.event_name || t('projects.event.unknownEvent')}
                  </p>
                  {(eventProposal.venue || eventProposal.address) && (
                    <p className="text-sm text-muted-foreground flex items-center gap-1.5">
                      <MapPin className="h-3.5 w-3.5 shrink-0" />
                      {[eventProposal.venue, eventProposal.address].filter(Boolean).join(', ')}
                    </p>
                  )}
                  {eventProposal.dates && (
                    <p className="text-sm text-muted-foreground flex items-center gap-1.5">
                      <CalendarDays className="h-3.5 w-3.5 shrink-0" />
                      {eventProposal.dates}
                    </p>
                  )}
                  {eventProposal.official_speakers.length > 0 && (
                    <p className="text-xs text-muted-foreground">
                      {t('projects.event.speakersFound', { count: eventProposal.official_speakers.length })}
                    </p>
                  )}
                  {eventProposal.source_url && (
                    <a
                      href={eventProposal.source_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs underline text-muted-foreground hover:text-foreground flex items-center gap-1"
                    >
                      <Globe className="h-3.5 w-3.5" />
                      {eventProposal.source_url}
                    </a>
                  )}
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Badge variant="secondary">
                    {t('projects.event.confidence', { percent: Math.round(eventProposal.confidence * 100) })}
                  </Badge>
                  {eventProposal.rationale && <span className="italic">{eventProposal.rationale}</span>}
                </div>
              </div>
            )
          )}

          <DialogFooter>
            {editingEvent ? (
              <Button variant="outline" onClick={() => setShowProposalDialog(false)} disabled={confirmingEvent}>
                {tc('cancel')}
              </Button>
            ) : (
              <Button variant="outline" onClick={startEditingEvent} disabled={confirmingEvent}>
                {t('projects.event.notRight')}
              </Button>
            )}
            <Button
              onClick={handleConfirmEvent}
              disabled={
                confirmingEvent ||
                (editingEvent ? !eventForm.event_name.trim() : !eventProposal?.event_name)
              }
            >
              {confirmingEvent ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Check className="h-4 w-4 mr-1" />}
              {t('projects.event.confirm')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
