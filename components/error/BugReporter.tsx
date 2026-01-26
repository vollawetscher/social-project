'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Bug, CheckCircle2, Loader2 } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'

interface BugReporterProps {
  caseId?: string | null
  sessionId?: string | null
  fileId?: string | null
  variant?: 'default' | 'outline' | 'ghost'
  size?: 'default' | 'sm' | 'lg' | 'icon'
  className?: string
}

export function BugReporter({
  caseId,
  sessionId,
  fileId,
  variant = 'outline',
  size = 'sm',
  className,
}: BugReporterProps) {
  const [open, setOpen] = useState(false)
  const [description, setDescription] = useState('')
  const [reproductionSteps, setReproductionSteps] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitSuccess, setSubmitSuccess] = useState(false)
  const [errorId, setErrorId] = useState<string | null>(null)
  const { toast } = useToast()

  const handleSubmit = async () => {
    if (!description.trim()) {
      toast({
        title: 'Beschreibung erforderlich',
        description: 'Bitte beschreiben Sie das Problem.',
        variant: 'destructive',
      })
      return
    }

    setIsSubmitting(true)

    try {
      // Gather client-side context
      const errorContext = {
        caseId,
        sessionId,
        fileId,
        errorType: 'bug_report',
        severity: 'warning',
        message: `User bug report: ${description.substring(0, 100)}`,
        userDescription: description,
        reproductionSteps: reproductionSteps || undefined,
        metadata: {
          url: window.location.href,
          pathname: window.location.pathname,
          browser: navigator.userAgent,
          viewport: {
            width: window.innerWidth,
            height: window.innerHeight,
          },
          timestamp: new Date().toISOString(),
          language: navigator.language,
        },
      }

      const response = await fetch('/api/error-logs', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(errorContext),
      })

      if (!response.ok) {
        throw new Error('Failed to submit bug report')
      }

      const data = await response.json()
      setErrorId(data.id)
      setSubmitSuccess(true)

      toast({
        title: 'Fehlerbericht gesendet',
        description: 'Vielen Dank für Ihr Feedback. Wir werden das Problem untersuchen.',
      })

      // Reset form after a delay
      setTimeout(() => {
        setOpen(false)
        setDescription('')
        setReproductionSteps('')
        setSubmitSuccess(false)
        setErrorId(null)
      }, 2000)
    } catch (error) {
      console.error('Failed to submit bug report:', error)
      toast({
        title: 'Fehler',
        description: 'Der Fehlerbericht konnte nicht gesendet werden. Bitte versuchen Sie es später erneut.',
        variant: 'destructive',
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant={variant} size={size} className={className}>
          <Bug className="h-4 w-4 mr-2" />
          Problem melden
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[525px]">
        <DialogHeader>
          <DialogTitle>Problem melden</DialogTitle>
          <DialogDescription>
            Beschreiben Sie das Problem, das Sie festgestellt haben. Ihre Rückmeldung hilft uns, die Anwendung zu verbessern.
          </DialogDescription>
        </DialogHeader>

        {submitSuccess ? (
          <Alert className="bg-green-50 border-green-200">
            <CheckCircle2 className="h-4 w-4 text-green-600" />
            <AlertDescription className="text-green-800">
              Fehlerbericht erfolgreich gesendet!
              {errorId && (
                <p className="mt-2 text-xs text-green-600">
                  Referenz-ID: {errorId.substring(0, 8)}...
                </p>
              )}
            </AlertDescription>
          </Alert>
        ) : (
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="description">
                Was ist das Problem? <span className="text-red-500">*</span>
              </Label>
              <Textarea
                id="description"
                placeholder="Beschreiben Sie das Problem, das Sie festgestellt haben..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={4}
                disabled={isSubmitting}
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="reproduction">
                Schritte zum Reproduzieren (optional)
              </Label>
              <Textarea
                id="reproduction"
                placeholder="1. Gehe zu...&#10;2. Klicke auf...&#10;3. Sehe Fehler..."
                value={reproductionSteps}
                onChange={(e) => setReproductionSteps(e.target.value)}
                rows={4}
                disabled={isSubmitting}
              />
            </div>

            {(caseId || sessionId || fileId) && (
              <Alert>
                <AlertDescription className="text-xs text-muted-foreground">
                  <strong>Debug-Kontext wird automatisch hinzugefügt:</strong>
                  {caseId && <div>Projekt-ID: {caseId.substring(0, 8)}...</div>}
                  {sessionId && <div>Gesprächs-ID: {sessionId.substring(0, 8)}...</div>}
                  {fileId && <div>Datei-ID: {fileId.substring(0, 8)}...</div>}
                </AlertDescription>
              </Alert>
            )}
          </div>
        )}

        <DialogFooter>
          {!submitSuccess && (
            <>
              <Button
                variant="outline"
                onClick={() => setOpen(false)}
                disabled={isSubmitting}
              >
                Abbrechen
              </Button>
              <Button onClick={handleSubmit} disabled={isSubmitting}>
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Sende...
                  </>
                ) : (
                  'Bericht senden'
                )}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
