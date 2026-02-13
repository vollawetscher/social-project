"use client"

export const dynamic = 'force-dynamic'

import { useState, useEffect, useRef, useCallback } from "react"
import { useParams } from "next/navigation"
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
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet"
import { Input } from "@/components/ui/input"
import { TranscriptViewer } from "@/components/transcript-viewer-v0"
import { SessionSetupPanel } from "@/components/session-setup-panel"
import { GenerateOutputModal } from "@/components/generate-output-modal"
import { AudioPlayer } from "@/components/audio/AudioPlayer"
import { toast } from "sonner"
import {
  mockTemplates,
  getRecordingTypeSuggestions,
  getDomainSuggestions,
  getSuggestedTemplates,
} from "@/lib/mock/data"
import { toV0Session } from "@/lib/adapters/session-adapter"
import type { Session, SuggestedOutputFormat } from "@/lib/types-v0"
import { cn } from "@/lib/utils"

export default function SessionDetailPage() {
  const params = useParams()
  const sessionId = params.id as string

  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)
  const [rightPanelOpen, setRightPanelOpen] = useState(true)
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
  
  // Participant editing state
  const [editingParticipants, setEditingParticipants] = useState(false)
  const [editedParticipants, setEditedParticipants] = useState<any[]>([])
  const [applyToTranscript, setApplyToTranscript] = useState(true)
  const [savingCorrections, setSavingCorrections] = useState(false)
  const   [generatingSuggestionIndex, setGeneratingSuggestionIndex] = useState<number | null>(null)
  const [savingOutputAsTemplate, setSavingOutputAsTemplate] = useState<string | null>(null)

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
            language: session.languageCode || 'en',
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
        
        // Also fetch outputs for this session
        fetchOutputs()
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
    
    fetchSession()
    // Only analyze if session is ready (has transcript)
    fetchSession().then(() => {
      // Wait a bit to see if transcript exists
      setTimeout(() => analyzeSession(), 1000)
    })
  }, [sessionId, fetchOutputs])

  // Poll when transcribing so badge updates when transcript is ready
  useEffect(() => {
    if (!session || !['transcribing', 'uploading', 'summarizing'].includes(session.status)) return
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
        }
      } catch {
        // ignore
      }
    }, 3000)
    return () => clearInterval(interval)
  }, [sessionId, session?.status])

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
  
  const suggestedTemplates = getSuggestedTemplates(session.domain)

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

  const selectedTemplate = mockTemplates.find((t) => t.id === selectedTemplateId)

  const [retryingTranscribe, setRetryingTranscribe] = useState(false)
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
      // Optimistically show transcribing
      setSession(s => s ? { ...s, status: 'transcribing' as const, lastError: undefined } : s)
    } catch (err: any) {
      toast.error(err?.message || 'Failed to retry transcription')
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
          <div>
            <h1 className="text-lg font-semibold text-foreground truncate max-w-[300px] md:max-w-[500px]">
              {session.filename}
            </h1>
            <p className="text-xs text-muted-foreground">
              Session Review
            </p>
          </div>
        </div>
        <div className="flex flex-col gap-2 items-end">
          {session.status === 'failed' && session.lastError && (
            <div className="flex items-center gap-2 w-full max-w-md rounded-lg border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm">
              <span className="text-destructive flex-1 truncate">{session.lastError}</span>
              {session.audioUrl && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleRetryTranscription}
                  disabled={retryingTranscribe}
                >
                  {retryingTranscribe ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    'Retry transcription'
                  )}
                </Button>
              )}
            </div>
          )}
        <div className="flex items-center gap-2">
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
          <TabsContent value="transcript" className="flex-1 min-h-0 mt-0">
            <div className="h-full rounded-lg border border-border bg-card overflow-hidden">
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
            <div className="h-full rounded-lg border border-border bg-card overflow-auto p-6">
              <div className="space-y-6">
                {/* In-context AI analysis indicator */}
                {analyzing && (
                  <div className="flex items-center gap-2 p-4 rounded-lg bg-primary/10 border border-primary/20">
                    <Loader2 className="h-5 w-5 animate-spin text-primary shrink-0" />
                    <p className="text-sm font-medium text-foreground">Analyzing transcript...</p>
                    <p className="text-xs text-muted-foreground">Extracting participants, purpose, and context</p>
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
            <div className="h-full rounded-lg border border-border bg-card overflow-auto p-4 space-y-6">
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
                        <p className="text-xs text-muted-foreground flex-1 line-clamp-2">
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
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => {
                              const blob = new Blob([output.content], { type: 'text/markdown' })
                              const url = window.URL.createObjectURL(blob)
                              const a = document.createElement('a')
                              a.href = url
                              a.download = `${output.templateName.replace(/\s+/g, '-').toLowerCase()}.md`
                              document.body.appendChild(a)
                              a.click()
                              window.URL.revokeObjectURL(url)
                              document.body.removeChild(a)
                              toast.success('Output downloaded')
                            }}
                            title="Download"
                          >
                            <Download className="h-3.5 w-3.5" />
                          </Button>
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
          {/* Audio Player */}
          {session.audioUrl && (
            <AudioPlayer
              ref={audioPlayerRef}
              audioUrl={session.audioUrl}
              onTimeUpdate={setCurrentAudioTime}
              onPlayStateChange={setIsAudioPlaying}
            />
          )}
          
          {/* Tab Content */}
          {activeTab === "transcript" && (
            <div className="flex-1 rounded-lg border border-border bg-card overflow-hidden">
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
                        <p className="text-xs text-muted-foreground flex-1 line-clamp-2">
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
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => {
                              const blob = new Blob([output.content], { type: 'text/markdown' })
                              const url = window.URL.createObjectURL(blob)
                              const a = document.createElement('a')
                              a.href = url
                              a.download = `${output.templateName.replace(/\s+/g, '-').toLowerCase()}.md`
                              document.body.appendChild(a)
                              a.click()
                              window.URL.revokeObjectURL(url)
                              document.body.removeChild(a)
                              toast.success('Output downloaded')
                            }}
                            title="Download"
                          >
                            <Download className="h-3.5 w-3.5" />
                          </Button>
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
        template={selectedTemplate}
        session={session}
        onSuccess={handleOutputGenerated}
      />
    </div>
  )
}
