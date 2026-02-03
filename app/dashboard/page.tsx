'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Plus, FileAudio, Clock, Trash2, Loader2, Calendar, MapPin, User, FileText, Languages, CheckCircle2, Mic, Filter } from 'lucide-react'
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
import { formatSessionDate } from '@/lib/utils/date-formatters'
import { SESSION_STATUS_CONFIG } from '@/lib/constants/ui'
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
  const [conversations, setConversations] = useState<Session[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [showDialog, setShowDialog] = useState(false)
  const [context, setContext] = useState('')
  const [deleteConversation, setDeleteConversation] = useState<Session | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [filterStatus, setFilterStatus] = useState<'all' | 'done' | 'processing'>('all')
  const router = useRouter()

  const loadConversations = useCallback(async () => {
    try {
      const response = await fetch('/api/sessions')
      if (response.ok) {
        const data = await response.json()
        setConversations(data || [])
      }
    } catch (error: any) {
      console.error('Failed to load conversations:', error)
      toast.error(`Fehler beim Laden: ${error.message}`)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadConversations()
  }, [loadConversations])

  const handleCreateConversation = async () => {
    setCreating(true)
    try {
      const response = await fetch('/api/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          context_note: context,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to create conversation')
      }

      const newConversation = await response.json()
      toast.success('Neues Gespräch erstellt')
      router.push(`/sessions/${newConversation.id}`)
    } catch (error: any) {
      console.error('Failed to create conversation:', error)
      toast.error(`Fehler: ${error.message}`)
    } finally {
      setCreating(false)
      setShowDialog(false)
      setContext('')
    }
  }

  const handleDelete = async () => {
    if (!deleteConversation) return

    setDeleting(true)
    try {
      const response = await fetch(`/api/sessions/${deleteConversation.id}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to delete conversation')
      }

      toast.success('Gespräch gelöscht')
      setConversations(conversations.filter((c) => c.id !== deleteConversation.id))
    } catch (error: any) {
      console.error('Failed to delete conversation:', error)
      toast.error(`Fehler: ${error.message}`)
    } finally {
      setDeleting(false)
      setDeleteConversation(null)
    }
  }

  const filteredConversations = conversations.filter((conv) => {
    if (filterStatus === 'all') return true
    if (filterStatus === 'done') return conv.status === 'done'
    if (filterStatus === 'processing') return conv.status !== 'done' && conv.status !== 'error'
    return true
  })

  const getStatusBadge = (status: string) => {
    const config = SESSION_STATUS_CONFIG[status as keyof typeof SESSION_STATUS_CONFIG] || SESSION_STATUS_CONFIG.created
    const Icon = config.icon
    const animated = 'animated' in config && config.animated

    return (
      <Badge variant={config.variant} className="gap-1">
        <Icon className={`h-3 w-3 ${animated ? 'animate-spin' : ''}`} />
        {config.label}
      </Badge>
    )
  }

  // Use shared date formatter for consistency
  const formatDateTime = formatSessionDate
  
  const formatDuration = (seconds: number) => {
    if (seconds === 0) return '-'
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  return (
    <DashboardLayout>
      <div className="max-w-4xl mx-auto pb-24">
        {/* Header with Filters - Fixed responsive sticky positioning */}
        <div className="sticky top-14 sm:top-16 z-40 bg-background pb-4 space-y-3">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold text-primary">Gespräche</h1>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => router.push('/record')}
              className="h-9 w-9"
            >
              <Mic className="h-5 w-5 text-primary" />
            </Button>
          </div>
          
          {/* Status Filter */}
          <div className="flex gap-2">
            <Button
              variant={filterStatus === 'all' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFilterStatus('all')}
              className="flex-1"
            >
              Alle ({conversations.length})
            </Button>
            <Button
              variant={filterStatus === 'done' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFilterStatus('done')}
              className="flex-1"
            >
              Fertig ({conversations.filter(c => c.status === 'done').length})
            </Button>
            <Button
              variant={filterStatus === 'processing' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFilterStatus('processing')}
              className="flex-1"
            >
              Aktiv ({conversations.filter(c => c.status !== 'done' && c.status !== 'error').length})
            </Button>
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : filteredConversations.length === 0 ? (
          <Card className="border-primary/20 bg-white mt-4">
            <CardContent className="flex flex-col items-center justify-center py-12">
              <FileAudio className="h-12 w-12 text-primary mb-4" />
              <h3 className="text-lg font-semibold text-foreground mb-2">
                Keine Gespräche
              </h3>
              <p className="text-muted-foreground text-center mb-6 text-sm px-4">
                Starte eine neue Aufnahme oder erstelle ein Gespräch mit Kontext
              </p>
              <div className="flex gap-3">
                <Button onClick={() => router.push('/record')} size="sm">
                  <Mic className="mr-2 h-4 w-4" />
                  Aufnehmen
                </Button>
                <Button onClick={() => setShowDialog(true)} variant="outline" size="sm">
                  <Plus className="mr-2 h-4 w-4" />
                  Mit Kontext
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3 mt-4">
            {filteredConversations.map((conversation) => (
              <Card 
                key={conversation.id} 
                className="hover:shadow-lg hover:shadow-primary/20 transition-all border-primary/20 hover:border-primary/40 bg-white cursor-pointer active:scale-[0.98]"
                onClick={() => router.push(`/sessions/${conversation.id}`)}
              >
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <CardTitle className="text-base text-foreground truncate">
                        {conversation.internal_case_id || `Gespräch ${conversation.id.slice(0, 8)}`}
                      </CardTitle>
                      <CardDescription className="text-xs mt-0.5 space-y-0.5">
                        <div>{formatDateTime(conversation.created_at)}</div>
                        {conversation.structured_context?.meeting_type && (
                          <div className="flex items-center gap-1 text-muted-foreground">
                            <User className="h-3 w-3" />
                            <span>{conversation.structured_context.meeting_type}</span>
                            {conversation.structured_context?.location && (
                              <>
                                <span>•</span>
                                <span>{conversation.structured_context.location}</span>
                              </>
                            )}
                          </div>
                        )}
                      </CardDescription>
                    </div>
                    <div className="flex items-center gap-1">
                      {getStatusBadge(conversation.status)}
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={(e) => {
                          e.stopPropagation()
                          setDeleteConversation(conversation)
                        }}
                        className="h-7 w-7 hover:bg-destructive/10 hover:text-destructive"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="pt-0 space-y-2.5">
                  {conversation.context_note && (
                    <p className="text-xs text-muted-foreground line-clamp-2">
                      {conversation.context_note}
                    </p>
                  )}
                  
                  {/* Compact Metadata - Fixed for mobile */}
                  <div className="flex flex-wrap gap-2 pt-2 border-t border-primary/10 text-xs sm:text-sm">
                    {/* Duration */}
                    {conversation.duration_sec > 0 && (
                      <div className="flex items-center gap-1 text-xs text-muted-foreground bg-primary/5 px-2 py-0.5 rounded">
                        <Clock className="h-3 w-3 text-primary" />
                        <span>{formatDuration(conversation.duration_sec)}</span>
                      </div>
                    )}
                    
                    {/* Report Language */}
                    {conversation.preferred_report_language && (
                      <div className="flex items-center gap-1 text-xs text-muted-foreground bg-primary/5 px-2 py-0.5 rounded uppercase">
                        <Languages className="h-3 w-3 text-primary" />
                        <span>{conversation.preferred_report_language}</span>
                      </div>
                    )}
                    
                    {/* Meeting Type */}
                    {conversation.structured_context?.meeting_type && (
                      <div className="flex items-center gap-1 text-xs text-muted-foreground bg-primary/5 px-2 py-0.5 rounded">
                        <User className="h-3 w-3 text-primary" />
                        <span>{conversation.structured_context.meeting_type}</span>
                      </div>
                    )}
                    
                    {/* Location */}
                    {conversation.structured_context?.location && (
                      <div className="flex items-center gap-1 text-xs text-muted-foreground bg-primary/5 px-2 py-0.5 rounded">
                        <MapPin className="h-3 w-3 text-primary" />
                        <span className="truncate max-w-[120px]">{conversation.structured_context.location}</span>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Floating Action Button (FAB) - Mobile friendly positioning */}
      <div className="fixed bottom-20 sm:bottom-6 right-6 z-50 flex flex-col gap-3">
        <Button
          onClick={() => setShowDialog(true)}
          size="icon"
          className="h-12 w-12 rounded-full shadow-lg"
          title="Neues Gespräch"
        >
          <Plus className="h-6 w-6" />
        </Button>
      </div>

      {/* Create Conversation Dialog */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Neues Gespräch</DialogTitle>
            <DialogDescription>
              Erstelle ein Gespräch mit Kontext. Oder starte direkt eine Aufnahme.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="context">Kontext (optional)</Label>
              <Textarea
                id="context"
                placeholder="z.B. Beratungsgespräch Familie Müller, HELOC-Antrag..."
                value={context}
                onChange={(e) => setContext(e.target.value)}
                rows={4}
                className="text-sm"
              />
            </div>
          </div>
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setShowDialog(false)
                setContext('')
              }}
              className="w-full sm:w-auto"
            >
              Abbrechen
            </Button>
            <Button 
              variant="outline"
              onClick={() => {
                setShowDialog(false)
                router.push('/record')
              }}
              className="w-full sm:w-auto"
            >
              <Mic className="mr-2 h-4 w-4" />
              Aufnehmen
            </Button>
            <Button 
              onClick={handleCreateConversation} 
              disabled={creating}
              className="w-full sm:w-auto"
            >
              {creating ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Erstellen...
                </>
              ) : (
                'Erstellen'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteConversation} onOpenChange={() => setDeleteConversation(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Gespräch löschen?</AlertDialogTitle>
            <AlertDialogDescription>
              Alle Aufnahmen, Transkripte und Berichte werden dauerhaft gelöscht.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Abbrechen</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleting}
              className="bg-destructive hover:bg-destructive/90"
            >
              {deleting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Löschen...
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
