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
  /** Extra metadata to include in the report (e.g. session status, error messages) */
  extraContext?: Record<string, any>
  variant?: 'default' | 'outline' | 'ghost'
  size?: 'default' | 'sm' | 'lg' | 'icon'
  iconOnly?: boolean
  className?: string
}

export function BugReporter({
  caseId,
  sessionId,
  fileId,
  extraContext,
  variant = 'outline',
  size = 'sm',
  iconOnly = false,
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
        title: 'Description required',
        description: 'Please describe the problem you encountered.',
        variant: 'destructive',
      })
      return
    }

    setIsSubmitting(true)

    try {
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
          ...(extraContext || {}),
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
        title: 'Bug report sent',
        description: 'Thank you for your feedback. We will investigate the issue.',
      })

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
        title: 'Error',
        description: 'Could not send the bug report. Please try again later.',
        variant: 'destructive',
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant={variant} size={size} className={className} title="Report a problem">
          <Bug className={iconOnly ? "h-4 w-4" : "h-4 w-4 mr-2"} />
          {!iconOnly && 'Report Problem'}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[525px]">
        <DialogHeader>
          <DialogTitle>Report a Problem</DialogTitle>
          <DialogDescription>
            Describe the issue you encountered. Your feedback helps us improve the application.
          </DialogDescription>
        </DialogHeader>

        {submitSuccess ? (
          <Alert className="bg-green-50 border-green-200 dark:bg-green-950/20 dark:border-green-900">
            <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />
            <AlertDescription className="text-green-800 dark:text-green-300">
              Bug report sent successfully!
              {errorId && (
                <p className="mt-2 text-xs text-green-600 dark:text-green-500">
                  Reference ID: {errorId.substring(0, 8)}...
                </p>
              )}
            </AlertDescription>
          </Alert>
        ) : (
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="description">
                What went wrong? <span className="text-red-500">*</span>
              </Label>
              <Textarea
                id="description"
                placeholder="Describe the problem you encountered..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={4}
                disabled={isSubmitting}
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="reproduction">
                Steps to reproduce (optional)
              </Label>
              <Textarea
                id="reproduction"
                placeholder={"1. Go to...\n2. Click on...\n3. See error..."}
                value={reproductionSteps}
                onChange={(e) => setReproductionSteps(e.target.value)}
                rows={4}
                disabled={isSubmitting}
              />
            </div>

            {(caseId || sessionId || fileId) && (
              <Alert>
                <AlertDescription className="text-xs text-muted-foreground">
                  <strong>Debug context will be included automatically:</strong>
                  {caseId && <div>Case ID: {caseId.substring(0, 8)}...</div>}
                  {sessionId && <div>Session ID: {sessionId.substring(0, 8)}...</div>}
                  {fileId && <div>File ID: {fileId.substring(0, 8)}...</div>}
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
                Cancel
              </Button>
              <Button onClick={handleSubmit} disabled={isSubmitting}>
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Sending...
                  </>
                ) : (
                  'Send Report'
                )}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
