"use client"

export const dynamic = 'force-dynamic'

import { useState, useEffect, useRef, useCallback } from "react"
import { useParams, useRouter } from "next/navigation"
import Link from "next/link"
import {
  ArrowLeft,
  FileText,
  Settings2,
  ScrollText,
  PanelRightClose,
  PanelRight,
  Copy,
  Download,
  ExternalLink,
  Check,
  Edit2,
  Save,
  X,
  Loader2,
  Sparkles,
  LayoutTemplate,
  UserRoundPlus,
  Mic,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet"
import { Input } from "@/components/ui/input"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { exportOutput } from "@/lib/utils/output-export"
import { TranscriptViewer } from "@/components/transcript-viewer-v0"
import { SessionSetupPanel } from "@/components/session-setup-panel"
import { GenerateOutputModal } from "@/components/generate-output-modal"
import { AudioPlayer } from "@/components/audio/AudioPlayer"
import { toast } from "sonner"
import {
  getRecordingTypeSuggestions,
  getDomainSuggestions,
} from "@/lib/mock/data"
import { toV0Session } from "@/lib/adapters/session-adapter"
import type { Session, SuggestedOutputFormat } from "@/lib/types-v0"
import { cn } from "@/lib/utils"
import { formatDetailDate } from "@/lib/utils/date-formatters"
import { EditableTitle } from "@/components/ui/editable-title"
import { useAuth } from "@/lib/auth/AuthProvider"
import { BugReporter } from "@/components/error/BugReporter"

/** Renders Speechmatics summary with paragraphs and bullet lists */
function FormattedSummary({ text }: { text: string }) {
  const blocks = text.split(/\n\n+/).filter(Boolean)
  return (
    <div className="space-y-4 text-sm text-foreground leading-relaxed">
      {blocks.map((block, i) => {
        const lines = block.split(/\n/).filter(Boolean)
        const isList = lines.every((l) => l.trim().startsWith("- ") || l.trim().startsWith("• "))
        if (isList && lines.length > 0) {
          return (
            <ul key={i} className="list-none space-y-2 pl-0">
              {lines.map((line, j) => (
                <li key={j} className="flex gap-2">
                  <span className="text-muted-foreground shrink-0">•</span>
                  <span>{line.replace(/^[-•]\s*/, "").trim()}</span>
                </li>
              ))}
            </ul>
          )
        }
        return (
          <p key={i} className="text-foreground">
            {block.trim()}
          </p>
        )
      })}
    </div>
  )
}

export default function SessionDetailPage() {
  const params = useParams()
  const router = useRouter()
  const sessionId = params.id as string
  const { user, profile } = useAuth()
  const isAdmin = (profile as any)?.role === 'admin'

  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)
  const [rightPanelOpen, setRightPanelOpen] = useState(false)
  // Ensure context panel is closed when entering session (no persisted open state)
  useEffect(() => {
    setRightPanelOpen(false)
  }, [sessionId])
  const [generateModalOpen, setGenerateModalOpen] = useState(false)
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null)
  const [outputs, setOutputs] = useState<any[]>([])
  const [outputsLoading, setOutputsLoading] = useState(true)
  const [analyzing, setAnalyzing] = useState(false)
  const [analysis, setAnalysis] = useState<any>(null)
  const [currentAudioTime, setCurrentAudioTime] = useState(0)
  const [activeTab, setActiveTab] = useState("transcript")
  const [isAudioPlaying, setIsAudioPlaying] = useState(false)
  const audioPlayerRef = useRef<any>(null)
  const analyzeSessionRef = useRef<((retryCount?: number) => Promise<void>) | null>(null)
  
  // Participant editing state
  const [editingParticipants, setEditingParticipants] = useState(false)
  const [editedParticipants, setEditedParticipants] = useState<any[]>([])
  const [applyToTranscript, setApplyToTranscript] = useState(true)
  const [savingCorrections, setSavingCorrections] = useState(false)
  const   [generatingSuggestionIndex, setGeneratingSuggestionIndex] = useState<number | null>(null)
  const [savingOutputAsTemplate, setSavingOutputAsTemplate] = useState<string | null>(null)
  const [retryingTranscribe, setRetryingTranscribe] = useState(false)
  const [lastRetryAt, setLastRetryAt] = useState<number | null>(null)
  const [profileLanguage, setProfileLanguage] = useState<string | null>(null)
  const [languageMismatch, setLanguageMismatch] = useState<{ sessionLang: string; transcriptLang: string } | null>(null)
  const [updatingLanguage, setUpdatingLanguage] = useState(false)
  const [handOffOpen, setHandOffOpen] = useState(false)
  const [handOffEmail, setHandOffEmail] = useState('')
  const [handOffLoading, setHandOffLoading] = useState(false)
  const [sessionFiles, setSessionFiles] = useState<any[]>([])

  // Fetch user profile for preferred_report_language (used by AI-suggested outputs)
  useEffect(() => {
    fetch('/api/profile')
      .then((r) => r.ok ? r.json() : null)
      .then((profile) => {
        const lang = profile?.preferred_report_language
        if (lang && typeof lang === 'string') setProfileLanguage(lang.slice(0, 2).toLowerCase())
      })
      .catch(() => {})
  }, [])

  // Handle seeking to a specific time from transcript click
  const handleSeekToTime = (time: number) => {
    if (audioPlayerRef.current) {
      audioPlayerRef.current.seekTo(time)
      setIsAudioPlaying(true)
    }
  }

  // Handle toggle play/pause
  const handleTogglePlayback = () => {
    if (audioPlayerRef.current) {
      if (isAudioPlaying) {
        audioPlayerRef.current.pause()
        setIsAudioPlaying(false)
      } else {
        audioPlayerRef.current.play()
        setIsAudioPlaying(true)
      }
    }
  }

  // Handle participant editing
  const handleEditParticipants = () => {
    setEditedParticipants(session?.extractedContext?.participants || [])
    setEditingParticipants(true)
  }

  const handleSaveParticipants = async () => {
    if (!session || !editingParticipants) return

    setSavingCorrections(true)
    try {
      // Build corrections mapping
      const corrections: Record<string, string> = {}
      const originalParticipants = session.extractedContext?.participants || []
      
      editedParticipants.forEach((edited: any, idx: number) => {
        const original = originalParticipants[idx]
        const originalName = typeof original === 'string' ? original : original.name
        const editedName = typeof edited === 'string' ? edited : edited.name
        
        if (originalName !== editedName && applyToTranscript) {
          corrections[originalName] = editedName
        }
      })

      // Save corrections to API
      if (Object.keys(corrections).length > 0) {
        const response = await fetch(`/api/sessions/${sessionId}/corrections`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            corrections, 
            type: 'name_corrections' 
          })
        })

        if (!response.ok) throw new Error('Failed to save corrections')

        const data = await response.json()
        
        // Update session with new corrections
        setSession(prev => prev ? {
          ...prev,
          transcriptCorrections: data.corrections
        } : null)

        toast.success('Corrections saved successfully')
      }

      // Update participants in session
      setSession(prev => prev ? {
        ...prev,
        extractedContext: {
          ...prev.extractedContext!,
          participants: editedParticipants
        }
      } : null)

      setEditingParticipants(false)
    } catch (error) {
      console.error('Failed to save corrections:', error)
      toast.error('Failed to save corrections')
    } finally {
      setSavingCorrections(false)
    }
  }

  const handleCancelEdit = () => {
    setEditingParticipants(false)
    setEditedParticipants([])
  }

  // Fetch outputs - reusable for initial load and after generation
  const fetchOutputs = useCallback(async () => {
    try {
      setOutputsLoading(true)
      const response = await fetch(`/api/outputs?sessionId=${sessionId}`)
      if (response.ok) {
        const data = await response.json()
        setOutputs(data)
      }
    } catch (error) {
      console.error('Error fetching outputs:', error)
    } finally {
      setOutputsLoading(false)
    }
  }, [sessionId])

  // Called when output is generated - refresh list and switch to Outputs tab
  const handleOutputGenerated = useCallback(() => {
    fetchOutputs()
    setActiveTab('outputs')
  }, [fetchOutputs])

  // Generate output from AI suggestion (quick one-click)
  const handleGenerateFromSuggestion = async (suggestion: SuggestedOutputFormat, index: number) => {
    if (!session) return
    setGeneratingSuggestionIndex(index)
    try {
      const response = await fetch('/api/outputs/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: session.id,
          config: {
            templateId: null,
            templateName: suggestion.title,
            perspective: 'observer',
            audience: 'internal',
            language: profileLanguage || session.languageCode || 'de',
            tone: 'neutral',
            format: 'markdown',
            doInstructions: suggestion.generationInstructions,
            dontInstructions: '',
            createTemplateFromConfig: false,
            citeTimestamps: false,
          },
        }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Generation failed')
      toast.success(`Generated: ${suggestion.title}`)
      fetchOutputs()
      setActiveTab('outputs')
    } catch (error) {
      console.error('Generate from suggestion error:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to generate output')
    } finally {
      setGeneratingSuggestionIndex(null)
    }
  }

  const handleSaveOutputAsTemplate = async (outputId: string) => {
    setSavingOutputAsTemplate(outputId)
    try {
      const response = await fetch('/api/templates/from-output', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ outputId }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Failed to save template')
      toast.success(`Saved as template: ${data.name}`)
    } catch (error) {
      console.error('Save as template error:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to save as template')
    } finally {
      setSavingOutputAsTemplate(null)
    }
  }

  // Fetch real session data
  useEffect(() => {
    async function fetchSession() {
      try {
        // Fetch session
        const sessionRes = await fetch(`/api/sessions/${sessionId}`)
        if (!sessionRes.ok) throw new Error('Failed to fetch session')
        const sessionData = await sessionRes.json()

        // Fetch transcript
        const transcriptRes = await fetch(`/api/sessions/${sessionId}/transcript`)
        const transcriptData = transcriptRes.ok ? await transcriptRes.json() : null

        // Convert to v0 format
        const v0Session = toV0Session(sessionData, {
          filename: sessionData.internal_case_id,
          transcript: transcriptData,
          files: sessionData.files
        })

        setSession(v0Session)
        setSessionFiles(sessionData.files || [])

        // Detect language mismatch: session configured language vs transcript-detected language
        const sessionLang = (sessionData.language || '').slice(0, 2).toLowerCase()
        const transcriptLang = (transcriptData?.language || '').slice(0, 2).toLowerCase()
        if (sessionLang && transcriptLang && sessionLang !== transcriptLang) {
          setLanguageMismatch({ sessionLang, transcriptLang })
        } else {
          setLanguageMismatch(null)
        }
        
        // Also fetch outputs for this session
        fetchOutputs()
        return v0Session
      } catch (error) {
        console.error('Error fetching session:', error)
      } finally {
        setLoading(false)
      }
    }

    async function analyzeSession(retryCount = 0) {
      // Skip if already analyzing
      if (analyzing) return

      setAnalyzing(true)
      let retrying = false
      try {
        console.log('[AI Analysis] Starting analysis for session:', sessionId)
        const response = await fetch(`/api/sessions/${sessionId}/analyze`, {
          method: 'POST',
        })
        console.log('[AI Analysis] Response status:', response.status)
        
        if (response.ok) {
          const data = await response.json()
          console.log('[AI Analysis] Success! Data:', data)
          console.log('[AI Analysis] Participants received:', data.extractedContext?.participants)
          setAnalysis(data)
          
          // When auto-generation is triggered, poll for new outputs (generation runs async)
          if (data.autoGeneration?.status === 'triggered') {
            toast.info('Generating output...', { duration: 3000 })
            const delays = [5000, 10000, 15000]
            delays.forEach((delay, i) => {
              setTimeout(() => fetchOutputs(), delay)
            })
          }
          
          // Update session with fresh AI data
          setSession(prev => {
            const updated = prev ? {
              ...prev,
              recordingType: data.recordingType,
              recordingTypeConfidence: data.recordingTypeConfidence,
              domains: data.domains,
              extractedContext: data.extractedContext || {},
              suggestedOutputFormats: data.suggestedOutputFormats || []
            } : null
            console.log('[AI Analysis] Updated session.extractedContext:', updated?.extractedContext)
            return updated
          })
        } else if (response.status === 400 && retryCount < 3) {
          // Transcript not ready yet - retry (transcription may still be in progress)
          retrying = true
          const delay = [2000, 4000, 6000][retryCount]
          console.log(`[AI Analysis] Transcript not ready (400), retrying in ${delay}ms (attempt ${retryCount + 2}/4)`)
          setTimeout(() => analyzeSession(retryCount + 1), delay)
        } else if (response.status === 400) {
          console.log('[AI Analysis] Transcript not ready after retries')
        } else {
          const errorData = await response.json().catch(() => ({}))
          console.warn('[AI Analysis] Failed with status:', response.status, errorData)
        }
      } catch (error) {
        console.error('[AI Analysis] Error analyzing session:', error)
      } finally {
        if (!retrying) setAnalyzing(false)
      }
    }
    analyzeSessionRef.current = analyzeSession
    
    fetchSession()
    // Only analyze if session has transcript - never analyze without one
    fetchSession().then((v0) => {
      if (v0?.transcript?.length) {
        setTimeout(() => analyzeSession(), 1000)
      }
    })
  }, [sessionId, fetchOutputs])

  // Poll when transcribing so badge updates when transcript is ready (stop if stuck >15min)
  useEffect(() => {
    if (!session || !['transcribing', 'uploading', 'summarizing'].includes(session.status)) return
    const age = Date.now() - new Date(session.createdAt).getTime()
    if (age > 15 * 60 * 1000) return
    const interval = setInterval(async () => {
      try {
        const sessionRes = await fetch(`/api/sessions/${sessionId}`)
        if (!sessionRes.ok) return
        const sessionData = await sessionRes.json()
        const transcriptRes = await fetch(`/api/sessions/${sessionId}/transcript`)
        const transcriptData = transcriptRes.ok ? await transcriptRes.json() : null
        const v0Session = toV0Session(sessionData, {
          filename: sessionData.internal_case_id,
          transcript: transcriptData,
          files: sessionData.files
        })
        setSession(v0Session)
        if (v0Session.status === 'ready') {
          fetchOutputs()
          // Workflow automation: auto-gen runs async after transcribe; poll for new outputs
          ;[3000, 6000, 9000, 12000].forEach((delay) => {
            setTimeout(() => fetchOutputs(), delay)
          })
          // Trigger analyze now that we have transcript (no analysis without transcript)
          if (transcriptData?.raw_json?.length && analyzeSessionRef.current) {
            setTimeout(() => analyzeSessionRef.current?.(), 1000)
          }
        }
      } catch {
        // ignore
      }
    }, 3000)
    return () => clearInterval(interval)
  }, [sessionId, session?.status, fetchOutputs])

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="text-center">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-current border-r-transparent"></div>
          <p className="mt-2 text-sm text-muted-foreground">Loading session...</p>
        </div>
      </div>
    )
  }

  if (!session) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="text-center">
          <p className="text-muted-foreground">Session not found</p>
          <Link href="/sessions">
            <Button variant="outline" className="mt-4">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Sessions
            </Button>
          </Link>
        </div>
      </div>
    )
  }

  // Use AI analysis if available, otherwise fall back to mock data
  const recordingTypeSuggestions = analysis?.recordingType 
    ? [{ 
        value: analysis.recordingType, 
        label: analysis.recordingType ? analysis.recordingType.charAt(0).toUpperCase() + analysis.recordingType.slice(1) : 'Unknown',
        confidence: analysis.recordingTypeConfidence 
      }]
    : getRecordingTypeSuggestions(session.id)

  const domainSuggestions = analysis?.domains?.length > 0
    ? analysis.domains.map((d: any) => {
        const domainValue = d.primary || d.domain || 'Unknown'
        return {
          value: domainValue,
          label: domainValue.charAt(0).toUpperCase() + domainValue.slice(1),
          confidence: d.confidence
        }
      })
    : getDomainSuggestions(session.id)
  
  // Debug log
  console.log('[Session Detail] Analysis state:', analysis)
  console.log('[Session Detail] Recording type suggestions:', recordingTypeSuggestions)
  console.log('[Session Detail] Domain suggestions:', domainSuggestions)
  
  const handleGenerateOutput = (templateId: string) => {
    setSelectedTemplateId(templateId)
    setGenerateModalOpen(true)
  }

  // Handle context saved - refresh session data
  const handleContextSaved = async () => {
    try {
      console.log('[Context Saved] Refreshing session data...')
      // Re-fetch session data
      const sessionRes = await fetch(`/api/sessions/${sessionId}`)
      if (!sessionRes.ok) throw new Error('Failed to fetch session')
      const sessionData = await sessionRes.json()

      // Fetch transcript
      const transcriptRes = await fetch(`/api/sessions/${sessionId}/transcript`)
      const transcriptData = transcriptRes.ok ? await transcriptRes.json() : null

      // Convert to v0 format
      const v0Session = toV0Session(sessionData, {
        filename: sessionData.internal_case_id,
        transcript: transcriptData,
        files: sessionData.files
      })

      setSession(v0Session)
      console.log('[Context Saved] Session refreshed successfully')
    } catch (error) {
      console.error('[Context Saved] Error refreshing session:', error)
    }
  }

  const handleRenameSession = async (newName: string) => {
    if (!newName.trim()) return
    const prevName = session.filename
    setSession((s) => (s ? { ...s, filename: newName.trim() } : s))
    try {
      const res = await fetch(`/api/sessions/${sessionId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ internal_case_id: newName.trim() }),
      })
      if (!res.ok) throw new Error('Failed to rename')
      toast.success('Session name updated')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to rename')
      setSession((s) => (s ? { ...s, filename: prevName } : s))
      throw err
    }
  }

  const handleHandOff = async () => {
    if (!handOffEmail.trim()) return
    setHandOffLoading(true)
    try {
      const res = await fetch(`/api/sessions/${sessionId}/reassign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ newOwnerEmail: handOffEmail.trim() }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'Failed to hand off')
      toast.success('Session transferred successfully')
      setHandOffOpen(false)
      setHandOffEmail('')
      router.push('/sessions')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to hand off')
    } finally {
      setHandOffLoading(false)
    }
  }

  const handleUpdateLanguage = async (lang: string) => {
    setUpdatingLanguage(true)
    try {
      const res = await fetch(`/api/sessions/${sessionId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ language: lang }),
      })
      if (!res.ok) throw new Error('Failed to update language')
      setSession(prev => prev ? { ...prev, languageCode: lang } : prev)
      setLanguageMismatch(null)
      toast.success('Session language updated')
    } catch {
      toast.error('Failed to update language')
    } finally {
      setUpdatingLanguage(false)
    }
  }

  const handleRetryTranscription = async () => {
    setRetryingTranscribe(true)
    try {
      const res = await fetch(`/api/sessions/${sessionId}/transcribe`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ language: session?.languageCode || 'de' }),
      })
      if (!res.ok) throw new Error((await res.json()).error || 'Retry failed')
      toast.success('Transcription started. This may take a few minutes.')
      setLastRetryAt(Date.now())
      setSession((s) => (s ? { ...s, status: 'transcribing', lastError: undefined } : s))
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to retry transcription')
    } finally {
      setRetryingTranscribe(false)
    }
  }

  return (
    <div className="min-h-[calc(100vh-3.5rem-4rem)] md:min-h-[calc(100vh-3.5rem-3rem)] flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between pb-4 border-b border-border">
        <div className="flex items-center gap-3">
          <Link href="/sessions">
            <Button variant="ghost" size="sm" className="gap-1.5">
              <ArrowLeft className="h-4 w-4" />
              <span className="hidden sm:inline">Back</span>
            </Button>
          </Link>
          <div className="min-w-0">
            <EditableTitle
              value={session.filename}
              fallback="Untitled Session"
              onSave={handleRenameSession}
              placeholder="Session name"
              className="text-lg font-semibold text-foreground truncate max-w-[300px] md:max-w-[500px]"
            />
            <p className="text-xs text-muted-foreground">
              Session Review
            </p>
          </div>
        </div>
        {session.status === 'failed' && session.lastError ? (
          <div className="flex items-center gap-2 w-full max-w-md rounded-lg border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm">
            <span className="text-destructive flex-1 truncate">{session.lastError}</span>
            {(session.audioUrl || isAdmin) ? (
              <Button size="sm" variant="outline" onClick={handleRetryTranscription} disabled={retryingTranscribe}>
                {retryingTranscribe ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Retry transcription'}
              </Button>
            ) : null}
          </div>
        ) : (session.status === 'transcribing' || session.status === 'uploading') &&
            Date.now() - new Date(session.createdAt).getTime() > 15 * 60 * 1000 &&
            (!lastRetryAt || Date.now() - lastRetryAt > 15 * 60 * 1000) ? (
          <div className="flex items-center gap-2 w-full max-w-md rounded-lg border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm">
            <span className="text-destructive flex-1">
              {session.status === 'transcribing'
                ? 'Transcription appears stuck. The background job may have failed.'
                : 'Stuck — audio may already be uploaded. Tap Retry to start transcription.'}
            </span>
            {(session.audioUrl || isAdmin) ? (
              <Button size="sm" variant="outline" onClick={handleRetryTranscription} disabled={retryingTranscribe}>
                {retryingTranscribe ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Retry'}
              </Button>
            ) : null}
          </div>
        ) : null}
        <div className="flex items-center gap-2">
          {/* Bug reporter with session context */}
          <BugReporter
            sessionId={session.id}
            variant="ghost"
            size="sm"
            iconOnly
            extraContext={{
              sessionStatus: session.status,
              sessionName: session.filename,
              lastError: session.lastError,
              hasSpeakers: session.speakers?.length > 0,
              hasTranscript: !!session.transcript?.length,
            }}
          />
          {/* Hand off session - only when owner */}
          {session.ownerId === user?.id && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setHandOffOpen(true)}
              className="gap-1.5"
            >
              <UserRoundPlus className="h-4 w-4" />
              <span className="hidden sm:inline">Hand off</span>
            </Button>
          )}
          {/* Context panel toggle - floating sheet, transcript stays full width */}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => !analyzing && setRightPanelOpen(!rightPanelOpen)}
            disabled={analyzing}
            title={analyzing ? "Context available after analysis completes" : "Context & corrections"}
          >
            {rightPanelOpen ? (
              <PanelRightClose className="h-4 w-4" />
            ) : (
              <PanelRight className="h-4 w-4" />
            )}
          </Button>
          <Sheet open={rightPanelOpen} onOpenChange={setRightPanelOpen} modal={false}>
            <SheetContent side="right" className="w-[340px] sm:w-[380px] p-0 max-h-[95vh] overflow-hidden flex flex-col" overlayLight>
              <SessionSetupPanel
                session={session}
                recordingTypeSuggestions={recordingTypeSuggestions}
                domainSuggestions={domainSuggestions}
                onContextSaved={handleContextSaved}
                analyzing={analyzing}
              />
            </SheetContent>
          </Sheet>
        </div>
      </div>

      {/* Audio files strip */}
      {sessionFiles.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 pt-3">
          {sessionFiles.map((file: any) => {
            const filename = (file.storage_path as string)?.split('/').pop() ?? 'audio'
            const sizeMb = file.size_bytes ? (file.size_bytes / (1024 * 1024)).toFixed(1) : null
            const hasAudio = !!file.signed_url
            return (
              <span
                key={file.id}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium",
                  hasAudio
                    ? "border-border bg-muted text-muted-foreground"
                    : "border-dashed border-muted-foreground/40 text-muted-foreground/60"
                )}
              >
                <Mic className="h-3 w-3 shrink-0" />
                <span className="max-w-[160px] truncate">{filename}</span>
                {sizeMb && <span className="text-muted-foreground/60">·&nbsp;{sizeMb}&nbsp;MB</span>}
                {!hasAudio && <span className="text-muted-foreground/50">(no signed URL)</span>}
              </span>
            )
          })}
        </div>
      )}

      {/* Language mismatch banner */}
      {languageMismatch && (() => {
        const langNames: Record<string, string> = {
          de: 'German', en: 'English', fr: 'French', es: 'Spanish',
          it: 'Italian', pt: 'Portuguese', nl: 'Dutch', pl: 'Polish',
        }
        const sessionLabel = langNames[languageMismatch.sessionLang] || languageMismatch.sessionLang.toUpperCase()
        const transcriptLabel = langNames[languageMismatch.transcriptLang] || languageMismatch.transcriptLang.toUpperCase()
        return (
          <div className="flex items-center gap-3 rounded-lg border border-info/40 bg-info/10 px-4 py-2.5 text-sm mt-3">
            <span className="flex-1 text-info-foreground">
              Transcript detected as <strong>{transcriptLabel}</strong>, but session is set to <strong>{sessionLabel}</strong>.
              Update session language to match?
            </span>
            <Button
              size="sm"
              variant="outline"
              className="shrink-0 h-7 border-info/40 text-info-foreground hover:bg-info/20"
              onClick={() => handleUpdateLanguage(languageMismatch.transcriptLang)}
              disabled={updatingLanguage}
            >
              {updatingLanguage ? <Loader2 className="h-3 w-3 animate-spin" /> : `Use ${transcriptLabel}`}
            </Button>
            <button
              onClick={() => setLanguageMismatch(null)}
              className="shrink-0 text-muted-foreground hover:text-foreground"
              aria-label="Dismiss"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )
      })()}

      {/* Hand off dialog */}
      <Dialog open={handOffOpen} onOpenChange={setHandOffOpen}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Hand off session</DialogTitle>
            <DialogDescription>
              Transfer this session to a colleague. Enter their email address. They will see it in their sessions.
            </DialogDescription>
          </DialogHeader>
          <div className="rounded-lg border border-amber-500/50 bg-amber-500/10 px-3 py-2.5 text-sm text-amber-800 dark:text-amber-200">
            This session will disappear from your account once transferred. You will be redirected to the sessions list.
          </div>
          <div className="py-4">
            <Input
              type="email"
              placeholder="colleague@example.com"
              value={handOffEmail}
              onChange={(e) => setHandOffEmail(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleHandOff()}
              disabled={handOffLoading}
              className="w-full"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setHandOffOpen(false)} disabled={handOffLoading}>
              Cancel
            </Button>
            <Button onClick={handleHandOff} disabled={!handOffEmail.trim() || handOffLoading}>
              {handOffLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Hand off'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Main Content */}
      <div className="flex-1 flex gap-4 pt-4 min-h-0">
        {/* Left: Secondary Nav Tabs (Desktop) */}
        <div className="hidden md:flex flex-col w-48 shrink-0">
          <div className="flex flex-col gap-1">
            <Button
              variant={activeTab === "transcript" ? "default" : "ghost"}
              className="w-full justify-start gap-2 px-3"
              onClick={() => setActiveTab("transcript")}
            >
              <ScrollText className="h-4 w-4" />
              Transcript
            </Button>
            <Button
              variant={activeTab === "context" ? "default" : "ghost"}
              className="w-full justify-start gap-2 px-3"
              onClick={() => setActiveTab("context")}
            >
              <Settings2 className="h-4 w-4" />
              Context
            </Button>
            <Button
              variant={activeTab === "outputs" ? "default" : "ghost"}
              className="w-full justify-start gap-2 px-3"
              onClick={() => setActiveTab("outputs")}
            >
              <FileText className="h-4 w-4" />
              Outputs
            </Button>
          </div>
        </div>

        {/* Mobile Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col min-h-0 md:hidden">
          <TabsList className="grid w-full grid-cols-3 mb-4">
            <TabsTrigger value="transcript">Transcript</TabsTrigger>
            <TabsTrigger value="context">Context</TabsTrigger>
            <TabsTrigger value="outputs">Outputs</TabsTrigger>
          </TabsList>
          <TabsContent value="transcript" className="flex-1 min-h-0 mt-0 flex flex-col">
            <div className="flex-1 min-h-0 rounded-lg border border-border bg-card overflow-hidden">
              <TranscriptViewer 
                segments={session.transcript}
                currentTime={currentAudioTime}
                onSeek={handleSeekToTime}
                corrections={session.transcriptCorrections}
                onTogglePlayback={handleTogglePlayback}
                isPlaying={isAudioPlaying}
              />
            </div>
          </TabsContent>
          <TabsContent value="context" className="flex-1 min-h-0 mt-0">
            <div className="h-full overflow-auto rounded-lg border border-border bg-card p-6">
              <div className="space-y-6">
                {/* In-context AI analysis indicator */}
                {analyzing && (
                  <div className="flex items-center gap-2 p-4 rounded-lg bg-primary/10 border border-primary/20">
                    <Loader2 className="h-5 w-5 animate-spin text-primary shrink-0" />
                    <p className="text-sm font-medium text-foreground">Analyzing transcript...</p>
                    <p className="text-xs text-muted-foreground">Extracting participants, purpose, and context</p>
                  </div>
                )}
                {/* Recording date/time from audio metadata */}
                {session?.recordedAt && (
                  <div className="space-y-3">
                    <h3 className="text-sm font-semibold text-foreground">Recording Info</h3>
                    <div className="p-3 rounded-lg bg-secondary/50">
                      <p className="text-sm text-foreground">{formatDetailDate(session.recordedAt)}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">From audio file metadata</p>
                    </div>
                  </div>
                )}
                {/* Speechmatics Summary */}
                {session?.speechmaticsSummary && (
                  <div className="space-y-3">
                    <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                      <Sparkles className="h-4 w-4" />
                      Session Summary
                    </h3>
                    <div className="rounded-lg border border-border bg-card p-4 shadow-sm">
                      <FormattedSummary text={session.speechmaticsSummary} />
                    </div>
                  </div>
                )}
                {/* Recording Type & Domain */}
                <div className="space-y-3">
                  <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                    <Settings2 className="h-4 w-4" />
                    Recording Classification
                  </h3>
                  <div className="space-y-2">
                    {session?.recordingType && (
                      <div className="flex items-center justify-between p-3 rounded-lg bg-secondary/50">
                        <span className="text-sm text-muted-foreground">Type</span>
                        <Badge variant="outline" className="capitalize">
                          {session.recordingType.replace(/_/g, ' ')}
                        </Badge>
                      </div>
                    )}
                    {session?.domains && session.domains.length > 0 && (
                      <div className="space-y-2">
                        {session.domains.map((domain: any, idx: number) => (
                          <div key={idx} className="p-3 rounded-lg bg-secondary/50">
                            <div className="flex items-center gap-2 mb-1">
                              <Badge variant="outline" className="capitalize">
                                {domain.primary || domain.domain}
                              </Badge>
                              {domain.specialty && (
                                <span className="text-xs text-muted-foreground">→ {domain.specialty}</span>
                              )}
                            </div>
                            {domain.description && (
                              <p className="text-xs text-muted-foreground mt-1">{domain.description}</p>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Extracted Context */}
                {session?.extractedContext && (
                  <div className="space-y-3">
                    <h3 className="text-sm font-semibold text-foreground">Extracted Context</h3>
                    
                    {session.extractedContext.participants?.length > 0 && (
                      <div className="space-y-2">
                        <p className="text-xs font-medium text-muted-foreground">Participants</p>
                        <div className="text-sm p-3 rounded-lg bg-secondary/50 space-y-1.5">
                          {session.extractedContext.participants.map((participant: any, idx: number) => {
                            const name = typeof participant === 'string' ? participant : participant.name
                            const role = typeof participant === 'object' && participant.role ? participant.role : null
                            const isUser = participant.isUser || false
                            
                            return (
                              <div key={idx} className="flex items-center gap-2 flex-wrap">
                                <span className="text-foreground font-medium">{name}</span>
                                {isUser && <Badge variant="default" className="text-xs px-2 py-0">You</Badge>}
                                {role && <span className="text-xs text-muted-foreground">• {role}</span>}
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    )}

                    {session.extractedContext.purpose && (
                      <div className="space-y-2">
                        <p className="text-xs font-medium text-muted-foreground">Purpose</p>
                        <p className="text-sm text-foreground p-3 rounded-lg bg-secondary/50">
                          {session.extractedContext.purpose}
                        </p>
                      </div>
                    )}

                    {session.extractedContext.agenda?.length > 0 && (
                      <div className="space-y-2">
                        <p className="text-xs font-medium text-muted-foreground">Agenda</p>
                        <ul className="text-sm text-foreground p-3 rounded-lg bg-secondary/50 space-y-1">
                          {session.extractedContext.agenda.map((item, i) => (
                            <li key={i} className="flex items-start gap-2">
                              <span className="text-muted-foreground">•</span>
                              {item}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {session.extractedContext.venue && (
                      <div className="space-y-2">
                        <p className="text-xs font-medium text-muted-foreground">Venue</p>
                        <p className="text-sm text-foreground p-3 rounded-lg bg-secondary/50">
                          {session.extractedContext.venue}
                        </p>
                      </div>
                    )}
                  </div>
                )}

                {/* No Context Available */}
                {!analyzing && !session?.recordingType && !session?.domain && !session?.extractedContext && (
                  <div className="text-center py-8">
                    <Settings2 className="h-8 w-8 text-muted-foreground/50 mx-auto mb-3" />
                    <p className="text-sm text-muted-foreground mb-2">No context extracted yet</p>
                    <p className="text-xs text-muted-foreground">
                      Context will appear after AI analysis completes
                    </p>
                  </div>
                )}
              </div>
            </div>
          </TabsContent>
          <TabsContent value="outputs" className="flex-1 min-h-0 mt-0">
            <div className="h-full overflow-auto rounded-lg border border-border bg-card p-4 space-y-6">
              {/* Suggested for this session */}
              {session?.suggestedOutputFormats && session.suggestedOutputFormats.length > 0 && (
                <div className="space-y-3">
                  <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-primary" />
                    Suggested for this session
                  </h3>
                  <p className="text-xs text-muted-foreground">Based on this conversation&apos;s topic and domain</p>
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {session.suggestedOutputFormats.map((suggestion, idx) => (
                      <div
                        key={idx}
                        className="p-4 rounded-lg border border-border bg-secondary/30 hover:border-primary/30 transition-colors flex flex-col gap-2"
                      >
                        <h4 className="text-sm font-medium text-foreground">{suggestion.title}</h4>
                        <p className="text-xs text-muted-foreground flex-1">
                          {suggestion.description}
                        </p>
                        <Button
                          size="sm"
                          className="w-full"
                          onClick={() => handleGenerateFromSuggestion(suggestion, idx)}
                          disabled={generatingSuggestionIndex !== null}
                        >
                          {generatingSuggestionIndex === idx ? (
                            <>
                              <Loader2 className="h-3.5 w-3.5 animate-spin mr-2" />
                              Generating...
                            </>
                          ) : (
                            'Generate'
                          )}
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {/* Your outputs */}
              {outputsLoading ? (
                <p className="text-sm text-muted-foreground">Loading outputs...</p>
              ) : outputs.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 gap-4">
                  <p className="text-sm text-muted-foreground text-center">
                    No outputs yet. Generate from suggestions above or choose a template.
                  </p>
                  <Button size="sm" onClick={() => { setSelectedTemplateId(null); setGenerateModalOpen(true) }}>
                    Generate Output
                  </Button>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="text-sm font-semibold text-foreground">Your outputs</h3>
                    <Button size="sm" variant="outline" onClick={() => { setSelectedTemplateId(null); setGenerateModalOpen(true) }}>
                      <LayoutTemplate className="h-3.5 w-3.5 mr-1.5" />
                      Generate Output
                    </Button>
                  </div>
                  {outputs.map((output) => (
                    <div key={output.id} className="p-4 border border-border rounded-lg hover:border-muted-foreground/50 transition-colors group">
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex-1 min-w-0">
                          <h4 className="text-sm font-medium truncate">{output.templateName}</h4>
                          <p className="text-xs text-muted-foreground flex items-center gap-2">
                            <span>
                              {new Date(output.createdAt).toLocaleDateString('en-US', { 
                                month: 'short', 
                                day: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit'
                              })}
                            </span>
                            {output.language && (
                              <>
                                <span>•</span>
                                <span className="flex items-center gap-1">
                                  {output.language === 'en' ? 'English' : output.language === 'de' ? 'German' : output.language}
                                </span>
                              </>
                            )}
                          </p>
                        </div>
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => handleSaveOutputAsTemplate(output.id)}
                            disabled={savingOutputAsTemplate === output.id}
                            title="Save as template"
                          >
                            {savingOutputAsTemplate === output.id ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <LayoutTemplate className="h-3.5 w-3.5" />
                            )}
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={async () => {
                              try {
                                await navigator.clipboard.writeText(output.content)
                                toast.success('Output copied to clipboard')
                              } catch (err) {
                                toast.error('Failed to copy to clipboard')
                              }
                            }}
                            title="Copy"
                          >
                            <Copy className="h-3.5 w-3.5" />
                          </Button>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-7 w-7" title="Download">
                                <Download className="h-3.5 w-3.5" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => { exportOutput(output.content, output.templateName, 'md').then(() => toast.success('Output downloaded')); }}>
                                MD
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => { exportOutput(output.content, output.templateName, 'pdf').then(() => toast.success('Output downloaded')); }}>
                                PDF
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => { exportOutput(output.content, output.templateName, 'docx').then(() => toast.success('Output downloaded')); }}>
                                DOCX
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            asChild
                            title="Open full page"
                          >
                            <Link href={`/outputs/${output.id}`}>
                              <ExternalLink className="h-3.5 w-3.5" />
                            </Link>
                          </Button>
                        </div>
                      </div>
                      <p className="text-xs text-muted-foreground line-clamp-2">{output.content.substring(0, 150)}...</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>

        {/* Center: Content Area (Desktop) */}
        <div className="hidden md:flex flex-1 min-h-0 flex-col gap-4">
          {/* Audio Player - only when viewing transcript */}
          {activeTab === "transcript" && session.audioUrl && (
            <AudioPlayer
              ref={audioPlayerRef}
              audioUrl={session.audioUrl}
              onTimeUpdate={setCurrentAudioTime}
              onPlayStateChange={setIsAudioPlaying}
            />
          )}
          
          {/* Tab Content */}
          {activeTab === "transcript" && (
            <div className="flex-1 min-h-0 rounded-lg border border-border bg-card overflow-hidden">
              <TranscriptViewer 
                segments={session.transcript} 
                currentTime={currentAudioTime}
                onSeek={handleSeekToTime}
                corrections={session.transcriptCorrections}
                onTogglePlayback={handleTogglePlayback}
                isPlaying={isAudioPlaying}
              />
            </div>
          )}

          {activeTab === "context" && (
            <div className="flex-1 rounded-lg border border-border bg-card overflow-auto p-6">
              <div className="space-y-6">
                {/* In-context AI analysis indicator */}
                {analyzing && (
                  <div className="flex items-center gap-2 p-4 rounded-lg bg-primary/10 border border-primary/20">
                    <Loader2 className="h-5 w-5 animate-spin text-primary shrink-0" />
                    <p className="text-sm font-medium text-foreground">Analyzing transcript...</p>
                    <p className="text-xs text-muted-foreground">Extracting participants, purpose, and context</p>
                  </div>
                )}
                {/* Recording date/time from audio metadata */}
                {session?.recordedAt && (
                  <div className="space-y-3">
                    <h3 className="text-sm font-semibold text-foreground">Recording Info</h3>
                    <div className="p-3 rounded-lg bg-secondary/50">
                      <p className="text-sm text-foreground">{formatDetailDate(session.recordedAt)}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">From audio file metadata</p>
                    </div>
                  </div>
                )}
                {/* Speechmatics Summary */}
                {session?.speechmaticsSummary && (
                  <div className="space-y-3">
                    <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                      <Sparkles className="h-4 w-4" />
                      Session Summary
                    </h3>
                    <div className="rounded-lg border border-border bg-card p-4 shadow-sm">
                      <FormattedSummary text={session.speechmaticsSummary} />
                    </div>
                  </div>
                )}
                {/* Recording Type & Domain */}
                <div className="space-y-3">
                  <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                    <Settings2 className="h-4 w-4" />
                    Recording Classification
                  </h3>
                  <div className="space-y-2">
                    {session?.recordingType && (
                      <div className="flex items-center justify-between p-3 rounded-lg bg-secondary/50">
                        <span className="text-sm text-muted-foreground">Type</span>
                        <Badge variant="outline" className="capitalize">
                          {session.recordingType.replace(/_/g, ' ')}
                        </Badge>
                      </div>
                    )}
                    {session?.domains && session.domains.length > 0 && (
                      <div className="space-y-2">
                        <span className="text-xs font-medium text-muted-foreground mb-2 block">Domains</span>
                        {session.domains.map((domain: any, idx: number) => (
                          <div key={idx} className="p-3 rounded-lg bg-secondary/50">
                            <div className="flex items-center gap-2 mb-1">
                              <Badge variant="outline" className="capitalize">
                                {domain.primary || domain.domain}
                              </Badge>
                              {domain.specialty && (
                                <span className="text-xs text-muted-foreground">→ {domain.specialty}</span>
                              )}
                            </div>
                            {domain.description && (
                              <p className="text-xs text-muted-foreground mt-1">{domain.description}</p>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Extracted Context */}
                {session?.extractedContext && (
                  <div className="space-y-3">
                    <h3 className="text-sm font-semibold text-foreground">Extracted Context</h3>
                    
                    {session.extractedContext.participants?.length > 0 && (
                      <div className="space-y-2">
                        <p className="text-xs font-medium text-muted-foreground">Participants</p>
                        <div className="text-sm p-3 rounded-lg bg-secondary/50 space-y-1.5">
                          {session.extractedContext.participants.map((participant: any, idx: number) => {
                            const name = typeof participant === 'string' ? participant : participant.name
                            const role = typeof participant === 'object' && participant.role ? participant.role : null
                            const isUser = participant.isUser || false
                            
                            return (
                              <div key={idx} className="flex items-center gap-2 flex-wrap">
                                <span className="text-foreground font-medium">{name}</span>
                                {isUser && <Badge variant="default" className="text-xs px-2 py-0">You</Badge>}
                                {role && <span className="text-xs text-muted-foreground">• {role}</span>}
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    )}

                    {session.extractedContext.purpose && (
                      <div className="space-y-2">
                        <p className="text-xs font-medium text-muted-foreground">Purpose</p>
                        <p className="text-sm text-foreground p-3 rounded-lg bg-secondary/50">
                          {session.extractedContext.purpose}
                        </p>
                      </div>
                    )}

                    {session.extractedContext.agenda?.length > 0 && (
                      <div className="space-y-2">
                        <p className="text-xs font-medium text-muted-foreground">Agenda</p>
                        <ul className="text-sm text-foreground p-3 rounded-lg bg-secondary/50 space-y-1">
                          {session.extractedContext.agenda.map((item, i) => (
                            <li key={i} className="flex items-start gap-2">
                              <span className="text-muted-foreground">•</span>
                              {item}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {session.extractedContext.venue && (
                      <div className="space-y-2">
                        <p className="text-xs font-medium text-muted-foreground">Venue</p>
                        <p className="text-sm text-foreground p-3 rounded-lg bg-secondary/50">
                          {session.extractedContext.venue}
                        </p>
                      </div>
                    )}
                  </div>
                )}

                {/* No Context Available */}
                {!analyzing && !session?.recordingType && !session?.domain && !session?.extractedContext && (
                  <div className="text-center py-8">
                    <Settings2 className="h-8 w-8 text-muted-foreground/50 mx-auto mb-3" />
                    <p className="text-sm text-muted-foreground mb-2">No context extracted yet</p>
                    <p className="text-xs text-muted-foreground">
                      Context will appear after AI analysis completes
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === "outputs" && (
            <div className="flex-1 rounded-lg border border-border bg-card overflow-auto p-4 space-y-6">
              {/* Suggested for this session */}
              {session?.suggestedOutputFormats && session.suggestedOutputFormats.length > 0 && (
                <div className="space-y-3">
                  <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-primary" />
                    Suggested for this session
                  </h3>
                  <p className="text-xs text-muted-foreground">Based on this conversation&apos;s topic and domain</p>
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {session.suggestedOutputFormats.map((suggestion, idx) => (
                      <div
                        key={idx}
                        className="p-4 rounded-lg border border-border bg-secondary/30 hover:border-primary/30 transition-colors flex flex-col gap-2"
                      >
                        <h4 className="text-sm font-medium text-foreground">{suggestion.title}</h4>
                        <p className="text-xs text-muted-foreground flex-1">
                          {suggestion.description}
                        </p>
                        <Button
                          size="sm"
                          className="w-full"
                          onClick={() => handleGenerateFromSuggestion(suggestion, idx)}
                          disabled={generatingSuggestionIndex !== null}
                        >
                          {generatingSuggestionIndex === idx ? (
                            <>
                              <Loader2 className="h-3.5 w-3.5 animate-spin mr-2" />
                              Generating...
                            </>
                          ) : (
                            'Generate'
                          )}
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {/* Your outputs */}
              {outputsLoading ? (
                <p className="text-sm text-muted-foreground">Loading outputs...</p>
              ) : outputs.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 gap-4">
                  <p className="text-sm text-muted-foreground text-center">
                    No outputs yet. Generate from suggestions above or choose a template.
                  </p>
                  <Button size="sm" onClick={() => { setSelectedTemplateId(null); setGenerateModalOpen(true) }}>
                    Generate Output
                  </Button>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="text-sm font-semibold text-foreground">Your outputs</h3>
                    <Button size="sm" variant="outline" onClick={() => { setSelectedTemplateId(null); setGenerateModalOpen(true) }}>
                      <LayoutTemplate className="h-3.5 w-3.5 mr-1.5" />
                      Generate Output
                    </Button>
                  </div>
                  {outputs.map((output) => (
                    <div key={output.id} className="p-4 border border-border rounded-lg hover:border-muted-foreground/50 transition-colors group">
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex-1 min-w-0">
                          <h4 className="text-sm font-medium truncate">{output.templateName}</h4>
                          <p className="text-xs text-muted-foreground flex items-center gap-2">
                            <span>
                              {new Date(output.createdAt).toLocaleDateString('en-US', { 
                                month: 'short', 
                                day: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit'
                              })}
                            </span>
                            {output.language && (
                              <>
                                <span>•</span>
                                <span className="flex items-center gap-1">
                                  {output.language === 'en' ? 'English' : output.language === 'de' ? 'German' : output.language}
                                </span>
                              </>
                            )}
                          </p>
                        </div>
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => handleSaveOutputAsTemplate(output.id)}
                            disabled={savingOutputAsTemplate === output.id}
                            title="Save as template"
                          >
                            {savingOutputAsTemplate === output.id ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <LayoutTemplate className="h-3.5 w-3.5" />
                            )}
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={async () => {
                              try {
                                await navigator.clipboard.writeText(output.content)
                                toast.success('Output copied to clipboard')
                              } catch (err) {
                                toast.error('Failed to copy to clipboard')
                              }
                            }}
                            title="Copy"
                          >
                            <Copy className="h-3.5 w-3.5" />
                          </Button>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-7 w-7" title="Download">
                                <Download className="h-3.5 w-3.5" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => { exportOutput(output.content, output.templateName, 'md').then(() => toast.success('Output downloaded')); }}>
                                MD
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => { exportOutput(output.content, output.templateName, 'pdf').then(() => toast.success('Output downloaded')); }}>
                                PDF
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => { exportOutput(output.content, output.templateName, 'docx').then(() => toast.success('Output downloaded')); }}>
                                DOCX
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            asChild
                            title="Open full page"
                          >
                            <Link href={`/outputs/${output.id}`}>
                              <ExternalLink className="h-3.5 w-3.5" />
                            </Link>
                          </Button>
                        </div>
                      </div>
                      <p className="text-xs text-muted-foreground line-clamp-2">{output.content.substring(0, 150)}...</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

      </div>

      {/* Generate Output Modal */}
      <GenerateOutputModal
        open={generateModalOpen}
        onOpenChange={setGenerateModalOpen}
        initialTemplateId={selectedTemplateId}
        session={session}
        onSuccess={handleOutputGenerated}
      />
    </div>
  )
}
