'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Plus, FileAudio, Clock, Trash2, Eye, Loader2, FolderOpen, Calendar, MapPin, User, FileText, Languages, CheckCircle2 } from 'lucide-react'
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
        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : (
          <Tabs defaultValue="cases" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="cases">Projekte ({cases.length})</TabsTrigger>
              <TabsTrigger value="sessions">Einzelne Gespräche ({sessions.length})</TabsTrigger>
            </TabsList>

            <TabsContent value="cases" className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-2xl font-bold text-primary">Projekte</h2>
                <Button onClick={() => setShowCaseDialog(true)} size="lg">
                  <Plus className="mr-2 h-4 w-4" />
                  Neues Projekt
                </Button>
              </div>

              {cases.length === 0 ? (
                <Card className="border-primary/20 bg-gradient-to-br from-white to-primary/5">
                  <CardContent className="flex flex-col items-center justify-center py-12">
                    <FolderOpen className="h-12 w-12 text-primary mb-4" />
                    <h3 className="text-lg font-semibold text-foreground mb-2">
                      Keine Projekte vorhanden
                    </h3>
                    <p className="text-muted-foreground text-center mb-6">
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
                    <Card key={caseItem.id} className="hover:shadow-lg hover:shadow-primary/20 transition-all cursor-pointer border-primary/20 hover:border-primary/40 bg-gradient-to-br from-white to-primary/5" onClick={() => router.push(`/cases/${caseItem.id}`)}>
                      <CardHeader>
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <CardTitle className="text-lg flex items-center gap-2">
                              <FolderOpen className="h-5 w-5 text-primary" />
                              {caseItem.title}
                            </CardTitle>
                            <CardDescription className="mt-1">
                              {caseItem.session_count} {caseItem.session_count === 1 ? 'Gespräch' : 'Gespräche'}
                            </CardDescription>
                          </div>
                          <Badge>
                            {caseItem.status === 'active' ? 'Aktiv' : caseItem.status === 'closed' ? 'Geschlossen' : 'Archiviert'}
                          </Badge>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        {caseItem.description && (
                          <p className="text-sm text-muted-foreground line-clamp-2">
                            {caseItem.description}
                          </p>
                        )}
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Calendar className="h-4 w-4 text-primary" />
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
              <div className="flex items-center justify-between">
                <h2 className="text-2xl font-bold text-primary">Einzelne Gespräche</h2>
                <Button onClick={() => setShowSessionDialog(true)} size="lg">
                  <Plus className="mr-2 h-4 w-4" />
                  Neues Gespräch
                </Button>
              </div>

              {sessions.length === 0 ? (
                <Card className="border-primary/20 bg-gradient-to-br from-white to-primary/5">
                  <CardContent className="flex flex-col items-center justify-center py-12">
                    <FileAudio className="h-12 w-12 text-primary mb-4" />
                    <h3 className="text-lg font-semibold text-foreground mb-2">
                      Keine einzelnen Gespräche
                    </h3>
                    <p className="text-muted-foreground text-center mb-6">
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
                    <Card 
                      key={session.id} 
                      className="hover:shadow-lg hover:shadow-primary/20 transition-all border-primary/20 hover:border-primary/40 bg-gradient-to-br from-white to-primary/5 cursor-pointer"
                      onClick={() => router.push(`/sessions/${session.id}`)}
                    >
                      <CardHeader>
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <CardTitle className="text-lg text-foreground">
                              {session.internal_case_id || `Gespräch ${session.id.slice(0, 8)}`}
                            </CardTitle>
                            <CardDescription className="mt-1">
                              {formatDistanceToNow(new Date(session.created_at), {
                                addSuffix: true,
                                locale: de,
                              })}
                            </CardDescription>
                          </div>
                          <div className="flex items-center gap-2">
                            {getStatusBadge(session.status)}
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={(e) => {
                                e.stopPropagation()
                                setDeleteSession(session)
                              }}
                              className="h-8 w-8 hover:bg-destructive/10 hover:text-destructive"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        {session.context_note && (
                          <p className="text-sm text-muted-foreground line-clamp-2">
                            {session.context_note}
                          </p>
                        )}
                        
                        {/* Metadata Card */}
                        <div className="space-y-2 pt-2 border-t border-primary/10">
                          <div className="grid grid-cols-2 gap-2 text-xs">
                            {/* Transcription Status */}
                            <div className="flex items-center gap-1.5 text-muted-foreground">
                              <CheckCircle2 className="h-3.5 w-3.5 text-primary" />
                              <span className="truncate">
                                {session.status === 'done' ? 'Abgeschlossen' : 'In Bearbeitung'}
                              </span>
                            </div>
                            
                            {/* Report Language */}
                            {session.preferred_report_language && (
                              <div className="flex items-center gap-1.5 text-muted-foreground">
                                <Languages className="h-3.5 w-3.5 text-primary" />
                                <span className="truncate uppercase">
                                  {session.preferred_report_language}
                                </span>
                              </div>
                            )}
                            
                            {/* Duration */}
                            <div className="flex items-center gap-1.5 text-muted-foreground">
                              <Clock className="h-3.5 w-3.5 text-primary" />
                              <span className="truncate">{formatDuration(session.duration_sec)}</span>
                            </div>
                            
                            {/* Meeting Type */}
                            {session.structured_context?.meeting_type && (
                              <div className="flex items-center gap-1.5 text-muted-foreground">
                                <FileText className="h-3.5 w-3.5 text-primary" />
                                <span className="truncate">{session.structured_context.meeting_type}</span>
                              </div>
                            )}
                            
                            {/* Location */}
                            {session.structured_context?.location && (
                              <div className="flex items-center gap-1.5 text-muted-foreground col-span-2">
                                <MapPin className="h-3.5 w-3.5 text-primary" />
                                <span className="truncate">{session.structured_context.location}</span>
                              </div>
                            )}
                            
                            {/* User Role */}
                            {session.structured_context?.participants && session.structured_context.participants.length > 0 && (
                              <div className="flex items-center gap-1.5 text-muted-foreground col-span-2">
                                <User className="h-3.5 w-3.5 text-primary" />
                                <span className="truncate">
                                  {session.structured_context.participants.map(p => p.role || p.name).join(', ')}
                                </span>
                              </div>
                            )}
                            
                            {/* Date if available */}
                            {session.structured_context?.date && (
                              <div className="flex items-center gap-1.5 text-muted-foreground col-span-2">
                                <Calendar className="h-3.5 w-3.5 text-primary" />
                                <span className="truncate">{session.structured_context.date}</span>
                              </div>
                            )}
                          </div>
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
