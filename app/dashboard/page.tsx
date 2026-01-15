'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth/AuthProvider'
import { createClient } from '@/lib/supabase/client'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Plus, FileAudio, Clock, Trash2, Eye, Loader2 } from 'lucide-react'
import { Session } from '@/lib/types/database'
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
  const { user, loading: authLoading } = useAuth()
  const [sessions, setSessions] = useState<Session[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [showDialog, setShowDialog] = useState(false)
  const [contextNote, setContextNote] = useState('')
  const [caseId, setCaseId] = useState('')
  const [deleteSession, setDeleteSession] = useState<Session | null>(null)
  const [deleting, setDeleting] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login')
    }
  }, [user, authLoading, router])

  useEffect(() => {
    if (user) {
      loadSessions()
    }
  }, [user])

  const loadSessions = async () => {
    try {
      const { data, error } = await supabase
        .from('sessions')
        .select('*')
        .eq('user_id', user!.id)
        .order('created_at', { ascending: false })

      if (error) {
        console.error('Database error:', error)
        toast.error(`Fehler beim Laden: ${error.message}`)
      } else {
        setSessions(data || [])
      }
    } catch (error) {
      console.error('Failed to load sessions:', error)
      toast.error('Fehler beim Laden der Sitzungen')
    } finally {
      setLoading(false)
    }
  }

  const handleCreateSession = async () => {
    setCreating(true)
    try {
      const { data: newSession, error } = await supabase
        .from('sessions')
        .insert({
          user_id: user!.id,
          context_note: contextNote,
          internal_case_id: caseId,
          status: 'created',
        })
        .select()
        .single()

      if (error) {
        console.error('Database error:', error)
        toast.error(`Fehler: ${error.message}`)
      } else {
        toast.success('Neue Sitzung erstellt')
        router.push(`/sessions/${newSession.id}`)
      }
    } catch (error) {
      console.error('Failed to create session:', error)
      toast.error('Fehler beim Erstellen der Sitzung')
    } finally {
      setCreating(false)
      setShowDialog(false)
      setContextNote('')
      setCaseId('')
    }
  }

  const handleDelete = async () => {
    if (!deleteSession) return

    setDeleting(true)
    try {
      const { error } = await supabase
        .from('sessions')
        .delete()
        .eq('id', deleteSession.id)

      if (error) {
        console.error('Database error:', error)
        toast.error(`Fehler: ${error.message}`)
      } else {
        toast.success('Sitzung gelöscht')
        setSessions(sessions.filter((s) => s.id !== deleteSession.id))
      }
    } catch (error) {
      console.error('Failed to delete session:', error)
      toast.error('Fehler beim Löschen der Sitzung')
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

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-slate-600" />
      </div>
    )
  }

  if (!user) {
    return null
  }

  return (
    <DashboardLayout>
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Sitzungen</h1>
            <p className="text-slate-600 mt-1">
              Verwalten Sie Ihre Gesprächsaufnahmen und Berichte
            </p>
          </div>
          <Button onClick={() => setShowDialog(true)} size="lg">
            <Plus className="mr-2 h-4 w-4" />
            Neue Sitzung
          </Button>
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-slate-600" />
          </div>
        ) : sessions.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <FileAudio className="h-12 w-12 text-slate-300 mb-4" />
              <h3 className="text-lg font-semibold text-slate-900 mb-2">
                Keine Sitzungen vorhanden
              </h3>
              <p className="text-slate-600 text-center mb-6">
                Erstellen Sie Ihre erste Sitzung, um Gespräche aufzunehmen oder hochzuladen
              </p>
              <Button onClick={() => setShowDialog(true)}>
                <Plus className="mr-2 h-4 w-4" />
                Neue Sitzung erstellen
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
                        {session.internal_case_id || `Sitzung ${session.id.slice(0, 8)}`}
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
      </div>

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Neue Sitzung erstellen</DialogTitle>
            <DialogDescription>
              Erfassen Sie optionale Metadaten für diese Gesprächssitzung
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="case-id">Fallnummer (optional)</Label>
              <Input
                id="case-id"
                placeholder="z.B. FALL-2024-001"
                value={caseId}
                onChange={(e) => setCaseId(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="context">Kontext/Setting (optional)</Label>
              <Textarea
                id="context"
                placeholder="z.B. Hausbesuch, Erstgespräch, Follow-up..."
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
                setShowDialog(false)
                setContextNote('')
                setCaseId('')
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
            <AlertDialogTitle>Sitzung löschen?</AlertDialogTitle>
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
