'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { Breadcrumbs } from '@/components/layout/Breadcrumbs'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { EditableTitle } from '@/components/ui/editable-title'
import { toast } from 'sonner'
import { Case, Session, CaseStatus } from '@/lib/types/database'
import { Loader2, ArrowLeft, Plus, FolderOpen, Calendar, Clock, Settings } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

export default function CaseDetailPage() {
  const params = useParams()
  const router = useRouter()
  const caseId = params.id as string

  const [caseData, setCaseData] = useState<(Case & { sessions: Session[] }) | null>(null)
  const [loading, setLoading] = useState(true)
  const [showEditDialog, setShowEditDialog] = useState(false)
  const [editDescription, setEditDescription] = useState('')
  const [editClientId, setEditClientId] = useState('')
  const [editStatus, setEditStatus] = useState<CaseStatus>('active')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    loadCase()
  }, [caseId])

  const loadCase = async () => {
    try {
      const response = await fetch(`/api/cases/${caseId}`)
      if (response.ok) {
        const data = await response.json()
        setCaseData(data)
      } else {
        toast.error('Fehler beim Laden des Projekts')
        router.push('/dashboard')
      }
    } catch (error) {
      toast.error('Fehler beim Laden des Projekts')
    } finally {
      setLoading(false)
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
      const response = await fetch(`/api/cases/${caseId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          description: editDescription,
          client_identifier: editClientId,
          status: editStatus,
        }),
      })

      if (response.ok) {
        const updated = await response.json()
        setCaseData((prev) => prev ? { ...prev, ...updated } : null)
        setShowEditDialog(false)
        toast.success('Änderungen gespeichert')
      } else {
        toast.error('Fehler beim Speichern')
      }
    } catch (error) {
      toast.error('Fehler beim Speichern')
    } finally {
      setSaving(false)
    }
  }

  const handleUpdateTitle = async (newTitle: string) => {
    try {
      const response = await fetch(`/api/cases/${caseId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: newTitle }),
      })

      if (response.ok) {
        const updated = await response.json()
        setCaseData((prev) => prev ? { ...prev, ...updated } : null)
        toast.success('Titel aktualisiert')
      } else {
        toast.error('Fehler beim Aktualisieren')
      }
    } catch (error) {
      toast.error('Fehler beim Aktualisieren')
    }
  }

  const handleCreateSession = async () => {
    try {
      const response = await fetch('/api/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ case_id: caseId }),
      })

      if (response.ok) {
        const session = await response.json()
        router.push(`/sessions/${session.id}`)
      } else {
        toast.error('Fehler beim Erstellen der Sitzung')
      }
    } catch (error) {
      toast.error('Fehler beim Erstellen der Sitzung')
    }
  }

  const getStatusBadge = (status: string) => {
    const variants: Record<string, { variant: 'default' | 'secondary' | 'destructive' | 'outline'; text: string }> = {
      created: { variant: 'secondary', text: 'Bereit' },
      uploading: { variant: 'default', text: 'Wird hochgeladen' },
      transcribing: { variant: 'default', text: 'Wird transkribiert' },
      summarizing: { variant: 'default', text: 'Wird zusammengefasst' },
      done: { variant: 'outline', text: 'Fertig' },
      error: { variant: 'destructive', text: 'Fehler' },
    }

    const config = variants[status] || variants.created
    return <Badge variant={config.variant}>{config.text}</Badge>
  }

  const formatDate = (dateString: string): string => {
    const date = new Date(dateString)
    return date.toLocaleDateString('de-DE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    })
  }

  const formatTime = (dateString: string): string => {
    const date = new Date(dateString)
    return date.toLocaleTimeString('de-DE', {
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  const formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  if (loading || !caseData) {
    return (
      <DashboardLayout>
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-slate-600" />
        </div>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout>
      <div className="max-w-6xl mx-auto space-y-6">
        <Breadcrumbs
          items={[
            { label: 'Projekte', href: '/dashboard' },
            { label: caseData.title || 'Unbenanntes Projekt' },
          ]}
        />
        
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => router.push('/dashboard')}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="flex-1">
            <EditableTitle
              value={caseData.title}
              fallback="Unbenanntes Projekt"
              onSave={handleUpdateTitle}
              placeholder="Projektname eingeben"
            />
            {caseData.description && (
              <p className="text-slate-600 mt-1">{caseData.description}</p>
            )}
            {caseData.client_identifier && (
              <p className="text-sm text-slate-500 mt-1">
                Klient-ID: {caseData.client_identifier}
              </p>
            )}
          </div>
          <Badge>{caseData.status === 'active' ? 'Aktiv' : caseData.status === 'closed' ? 'Geschlossen' : 'Archiviert'}</Badge>
          <Button
            variant="outline"
            size="icon"
            onClick={handleOpenEditDialog}
          >
            <Settings className="h-4 w-4" />
          </Button>
        </div>

        {/* Actions */}
        <Card>
          <CardContent className="pt-6">
            <Button onClick={handleCreateSession} className="w-full" size="lg">
              <Plus className="mr-2 h-4 w-4" />
              Neue Sitzung erstellen
            </Button>
          </CardContent>
        </Card>

        {/* Sessions */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FolderOpen className="h-5 w-5" />
              Sitzungen ({caseData.sessions.length})
            </CardTitle>
            <CardDescription>
              Alle Sitzungen für dieses Projekt
            </CardDescription>
          </CardHeader>
          <CardContent>
            {caseData.sessions.length === 0 ? (
              <div className="text-center py-12 text-slate-500">
                <p>Noch keine Sitzungen</p>
                <p className="text-sm mt-1">Erstellen Sie Ihre erste Sitzung für dieses Projekt</p>
              </div>
            ) : (
              <div className="space-y-3">
                {caseData.sessions.map((session) => (
                  <div
                    key={session.id}
                    onClick={() => router.push(`/sessions/${session.id}`)}
                    className="p-4 border rounded-lg hover:bg-slate-50 cursor-pointer transition-colors"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-medium text-slate-900 truncate">
                            {session.internal_case_id || `Sitzung ${session.id.slice(0, 8)}`}
                          </h3>
                          {getStatusBadge(session.status)}
                        </div>
                        {session.context_note && (
                          <p className="text-sm text-slate-600 mb-2 line-clamp-2">
                            {session.context_note}
                          </p>
                        )}
                        <div className="flex items-center gap-3 text-xs text-slate-500">
                          <span className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {formatDate(session.created_at)} um {formatTime(session.created_at)}
                          </span>
                          {session.duration_sec > 0 && (
                            <span className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {formatDuration(session.duration_sec)}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Edit Case Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Projekt bearbeiten</DialogTitle>
            <DialogDescription>
              Aktualisieren Sie die Projektdetails
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="edit-status">Status</Label>
              <Select value={editStatus} onValueChange={(value) => setEditStatus(value as CaseStatus)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Aktiv</SelectItem>
                  <SelectItem value="closed">Geschlossen</SelectItem>
                  <SelectItem value="archived">Archiviert</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-client-id">Klient-ID (optional)</Label>
              <Input
                id="edit-client-id"
                placeholder="z.B. K-2024-001"
                value={editClientId}
                onChange={(e) => setEditClientId(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-description">Beschreibung (optional)</Label>
              <Textarea
                id="edit-description"
                placeholder="Zusätzliche Informationen zum Projekt..."
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
                rows={4}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowEditDialog(false)}
            >
              Abbrechen
            </Button>
            <Button onClick={handleSaveDetails} disabled={saving}>
              {saving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Wird gespeichert...
                </>
              ) : (
                'Speichern'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  )
}
