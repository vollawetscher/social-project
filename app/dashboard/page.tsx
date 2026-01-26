'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Plus, FileAudio, Clock, Trash2, Eye, Loader2, FolderOpen, Calendar } from 'lucide-react'
import { Session, Case } from '@/lib/types/database'
import { toast } from 'sonner'
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
import { formatDistanceToNow } from 'date-fns'
import { de } from 'date-fns/locale'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'

export default function DashboardPage() {
  const [cases, setCases] = useState<(Case & { session_count: number })[]>([])
  const [sessions, setSessions] = useState<Session[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [showSessionDialog, setShowSessionDialog] = useState(false)
  const [showCaseDialog, setShowCaseDialog] = useState(false)
  const [contextNote, setContextNote] = useState('')
  const [caseTitle, setCaseTitle] = useState('')
  const [caseDescription, setCaseDescription] = useState('')
  const [deleteSession, setDeleteSession] = useState<Session | null>(null)
  const [deleting, setDeleting] = useState(false)
  const router = useRouter()

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    try {
      // Load cases
      const casesResponse = await fetch('/api/cases')
      if (casesResponse.ok) {
        const casesData = await casesResponse.json()
        setCases(casesData || [])
      }

      // Load standalone sessions (sessions without case_id)
      const sessionsResponse = await fetch('/api/sessions')
      if (sessionsResponse.ok) {
        const sessionsData = await sessionsResponse.json()
        const standalone = sessionsData.filter((s: Session) => !s.case_id)
        setSessions(standalone)
      }
    } catch (error: any) {
      console.error('Failed to load data:', error)
      toast.error(`Fehler beim Laden: ${error.message}`)
    } finally {
      setLoading(false)
    }
  }

  const handleCreateCase = async () => {
    if (!caseTitle.trim()) {
      toast.error('Bitte geben Sie einen Titel ein')
      return
    }

    setCreating(true)
    try {
      const response = await fetch('/api/cases', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: caseTitle,
          description: caseDescription,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to create case')
      }

      const newCase = await response.json()
      toast.success('Neues Projekt erstellt')
      router.push(`/cases/${newCase.id}`)
    } catch (error: any) {
      console.error('Failed to create case:', error)
      toast.error(`Fehler: ${error.message}`)
    } finally {
      setCreating(false)
      setShowCaseDialog(false)
      setCaseTitle('')
      setCaseDescription('')
    }
  }

  const handleCreateSession = async () => {
    setCreating(true)
    try {
      const response = await fetch('/api/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          context_note: contextNote,
          case_id: null, // Standalone session
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to create session')
      }

      const newSession = await response.json()
      toast.success('Neues Gespräch erstellt')
      router.push(`/sessions/${newSession.id}`)
    } catch (error: any) {
      console.error('Failed to create session:', error)
      toast.error(`Fehler: ${error.message}`)
    } finally {
      setCreating(false)
      setShowSessionDialog(false)
      setContextNote('')
    }
  }

  const handleDelete = async () => {
    if (!deleteSession) return

    setDeleting(true)
    try {
      const response = await fetch(`/api/sessions/${deleteSession.id}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to delete session')
      }

      toast.success('Gespräch gelöscht')
      setSessions(sessions.filter((s) => s.id !== deleteSession.id))
    } catch (error: any) {
      console.error('Failed to delete session:', error)
      toast.error(`Fehler: ${error.message}`)
    } finally {
      setDeleting(false)
      setDeleteSession(null)
    }
  }

  const getStatusBadge = (status: string) => {
    const variants: Record<string, { variant: 'default' | 'secondary' | 'destructive' | 'outline'; text: string }> = {
      created: { variant: 'secondary', text: 'Erstellt' },
      uploading: { variant: 'default', text: 'Wird hochgeladen' },
      transcribing: { variant: 'default', text: 'Wird transkribiert' },
      summarizing: { variant: 'default', text: 'Wird zusammengefasst' },
      done: { variant: 'outline', text: 'Fertig' },
      error: { variant: 'destructive', text: 'Fehler' },
    }

    const config = variants[status] || variants.created

    return (
      <Badge variant={config.variant}>
        {config.text}
      </Badge>
    )
  }

  const formatDuration = (seconds: number) => {
    if (seconds === 0) return '-'
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  return (
    <DashboardLayout>
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Dashboard</h1>
            <p className="text-slate-600 mt-1">
              Verwalten Sie Ihre Projekte und Aufnahmen
            </p>
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-slate-600" />
          </div>
        ) : (
          <Tabs defaultValue="cases" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="cases">Projekte ({cases.length})</TabsTrigger>
              <TabsTrigger value="sessions">Einzelne Gespräche ({sessions.length})</TabsTrigger>
            </TabsList>

            <TabsContent value="cases" className="space-y-4">
              <div className="flex justify-end">
                <Button onClick={() => setShowCaseDialog(true)} size="lg">
                  <Plus className="mr-2 h-4 w-4" />
                  Neues Projekt
                </Button>
              </div>

              {cases.length === 0 ? (
                <Card>
                  <CardContent className="flex flex-col items-center justify-center py-12">
                    <FolderOpen className="h-12 w-12 text-slate-300 mb-4" />
                    <h3 className="text-lg font-semibold text-slate-900 mb-2">
                      Keine Projekte vorhanden
                    </h3>
                    <p className="text-slate-600 text-center mb-6">
                      Erstellen Sie Ihr erstes Projekt, um Gespräche zu verwalten
                    </p>
                    <Button onClick={() => setShowCaseDialog(true)}>
                      <Plus className="mr-2 h-4 w-4" />
                      Neues Projekt erstellen
                    </Button>
                  </CardContent>
                </Card>
              ) : (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {cases.map((caseItem) => (
                    <Card key={caseItem.id} className="hover:shadow-md transition-shadow cursor-pointer" onClick={() => router.push(`/cases/${caseItem.id}`)}>
                      <CardHeader>
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <CardTitle className="text-lg flex items-center gap-2">
                              <FolderOpen className="h-5 w-5" />
                              {caseItem.title}
                            </CardTitle>
                            <CardDescription className="mt-1">
                              {caseItem.session_count} {caseItem.session_count === 1 ? 'Gespräch' : 'Gespräche'}
                            </CardDescription>
                          </div>
                          <Badge>{caseItem.status === 'active' ? 'Aktiv' : caseItem.status === 'closed' ? 'Geschlossen' : 'Archiviert'}</Badge>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        {caseItem.description && (
                          <p className="text-sm text-slate-600 line-clamp-2">
                            {caseItem.description}
                          </p>
                        )}
                        <div className="flex items-center gap-2 text-sm text-slate-500">
                          <Calendar className="h-4 w-4" />
                          <span>
                            {formatDistanceToNow(new Date(caseItem.updated_at), {
                              addSuffix: true,
                              locale: de,
                            })}
                          </span>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </TabsContent>

            <TabsContent value="sessions" className="space-y-4">
              <div className="flex justify-end">
                <Button onClick={() => setShowSessionDialog(true)} size="lg">
                  <Plus className="mr-2 h-4 w-4" />
                  Neues Gespräch
                </Button>
              </div>

              {sessions.length === 0 ? (
                <Card>
                  <CardContent className="flex flex-col items-center justify-center py-12">
                    <FileAudio className="h-12 w-12 text-slate-300 mb-4" />
                    <h3 className="text-lg font-semibold text-slate-900 mb-2">
                      Keine einzelnen Gespräche
                    </h3>
                    <p className="text-slate-600 text-center mb-6">
                      Einzelne Gespräche sind nicht mit einem Projekt verknüpft
                    </p>
                    <Button onClick={() => setShowSessionDialog(true)}>
                      <Plus className="mr-2 h-4 w-4" />
                      Einzelnes Gespräch erstellen
                    </Button>
                  </CardContent>
                </Card>
              ) : (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {sessions.map((session) => (
                    <Card key={session.id} className="hover:shadow-md transition-shadow">
                      <CardHeader>
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <CardTitle className="text-lg">
                              {session.internal_case_id || `Gespräch ${session.id.slice(0, 8)}`}
                            </CardTitle>
                            <CardDescription className="mt-1">
                              {formatDistanceToNow(new Date(session.created_at), {
                                addSuffix: true,
                                locale: de,
                              })}
                            </CardDescription>
                          </div>
                          {getStatusBadge(session.status)}
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        {session.context_note && (
                          <p className="text-sm text-slate-600 line-clamp-2">
                            {session.context_note}
                          </p>
                        )}
                        <div className="flex items-center gap-2 text-sm text-slate-500">
                          <Clock className="h-4 w-4" />
                          <span>{formatDuration(session.duration_sec)}</span>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            variant="default"
                            className="flex-1"
                            onClick={() => router.push(`/sessions/${session.id}`)}
                          >
                            <Eye className="mr-2 h-4 w-4" />
                            Öffnen
                          </Button>
                          <Button
                            variant="outline"
                            size="icon"
                            onClick={() => setDeleteSession(session)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </TabsContent>
          </Tabs>
        )}
      </div>

      {/* Create Case Dialog */}
      <Dialog open={showCaseDialog} onOpenChange={setShowCaseDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Neues Projekt erstellen</DialogTitle>
            <DialogDescription>
              Erstellen Sie ein neues Projekt, um mehrere Gespräche zu verwalten
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="case-title">Titel *</Label>
              <Input
                id="case-title"
                placeholder="z.B. Familie Müller, HELOC-Beratung"
                value={caseTitle}
                onChange={(e) => setCaseTitle(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="case-description">Beschreibung (optional)</Label>
              <Textarea
                id="case-description"
                placeholder="Zusätzliche Informationen zum Projekt..."
                value={caseDescription}
                onChange={(e) => setCaseDescription(e.target.value)}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowCaseDialog(false)
                setCaseTitle('')
                setCaseDescription('')
              }}
            >
              Abbrechen
            </Button>
            <Button onClick={handleCreateCase} disabled={creating}>
              {creating ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Wird erstellt...
                </>
              ) : (
                'Erstellen'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create Session Dialog */}
      <Dialog open={showSessionDialog} onOpenChange={setShowSessionDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Neues Gespräch erstellen</DialogTitle>
            <DialogDescription>
              Einzelnes Gespräch ohne Projektverknüpfung
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="context">Kontext (optional)</Label>
              <Textarea
                id="context"
                placeholder="z.B. meeting my banker about HELOC..."
                value={contextNote}
                onChange={(e) => setContextNote(e.target.value)}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowSessionDialog(false)
                setContextNote('')
              }}
            >
              Abbrechen
            </Button>
            <Button onClick={handleCreateSession} disabled={creating}>
              {creating ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Wird erstellt...
                </>
              ) : (
                'Erstellen'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteSession} onOpenChange={() => setDeleteSession(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Gespräch löschen?</AlertDialogTitle>
            <AlertDialogDescription>
              Diese Aktion kann nicht rückgängig gemacht werden. Alle zugehörigen Dateien,
              Transkripte und Berichte werden dauerhaft gelöscht.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Abbrechen</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleting}
              className="bg-red-600 hover:bg-red-700"
            >
              {deleting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Wird gelöscht...
                </>
              ) : (
                'Löschen'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardLayout>
  )
}
