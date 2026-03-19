'use client'

import { useEffect, useState } from 'react'
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
  Plus,
  FolderOpen,
  Calendar,
  Clock,
  Settings,
  FileText,
  Mic,
  Sparkles,
  Pencil,
  Check,
  X,
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
  status: string
  created_at: string
  duration_sec: number
}

type CaseStatus = 'active' | 'closed' | 'archived'

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

  useEffect(() => {
    loadProject()
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
        router.push('/sessions')
      }
    } catch {
      toast.error(tc('error'))
    } finally {
      setLoading(false)
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

  const handleCreateSession = async () => {
    try {
      const res = await fetch('/api/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ case_id: projectId }),
      })
      if (res.ok) {
        const session = await res.json()
        router.push(`/sessions/${session.id}`)
      } else {
        toast.error(tc('error'))
      }
    } catch {
      toast.error(tc('error'))
    }
  }

  const statusLabel = (s: CaseStatus) => {
    if (s === 'active') return t('projects.status.active')
    if (s === 'closed') return t('projects.status.closed')
    return t('projects.status.archived')
  }

  if (loading || !caseData) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => router.push('/sessions')}
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

      {/* Create Session */}
      <Card>
        <CardContent className="pt-4">
          <Button onClick={handleCreateSession} className="w-full" size="lg">
            <Plus className="mr-2 h-4 w-4" />
            {tc('new')} Session
          </Button>
        </CardContent>
      </Card>

      {/* Sessions */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <FolderOpen className="h-4 w-4" />
            Sessions ({caseData.sessions.length})
          </CardTitle>
          <CardDescription>
            {caseData.sessions.length === 0
              ? 'No sessions yet'
              : `All sessions in this project`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {caseData.sessions.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <FolderOpen className="h-8 w-8 mx-auto mb-2 opacity-30" />
              <p className="text-sm">No sessions in this project yet.</p>
              <p className="text-xs mt-1">Assign sessions from the Sessions view, or create a new one above.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {caseData.sessions.map((session) => {
                const statusCfg = getSessionStatusConfig(session.status)
                return (
                  <Link
                    key={session.id}
                    href={`/sessions/${session.id}`}
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
