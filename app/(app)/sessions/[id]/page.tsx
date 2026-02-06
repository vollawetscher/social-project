"use client"

export const dynamic = 'force-dynamic'

import { useState, useEffect, useRef } from "react"
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
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet"
import { TranscriptViewer } from "@/components/transcript-viewer-v0"
import { SessionSetupPanel } from "@/components/session-setup-panel"
import { GenerateOutputModal } from "@/components/generate-output-modal"
import { AudioPlayer } from "@/components/audio/AudioPlayer"
import {
  mockTemplates,
  getRecordingTypeSuggestions,
  getDomainSuggestions,
  getSuggestedTemplates,
} from "@/lib/mock/data"
import { toV0Session } from "@/lib/adapters/session-adapter"
import type { Session } from "@/lib/types-v0"
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
  const audioPlayerRef = useRef<any>(null)

  // Handle seeking to a specific time from transcript click
  const handleSeekToTime = (time: number) => {
    if (audioPlayerRef.current) {
      audioPlayerRef.current.seekTo(time)
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

    async function fetchOutputs() {
      try {
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
    }

    async function analyzeSession() {
      // Skip if already analyzing
      if (analyzing) return

      setAnalyzing(true)
      try {
        console.log('[AI Analysis] Starting analysis for session:', sessionId)
        const response = await fetch(`/api/sessions/${sessionId}/analyze`, {
          method: 'POST',
        })
        console.log('[AI Analysis] Response status:', response.status)
        
        if (response.ok) {
          const data = await response.json()
          console.log('[AI Analysis] Success! Data:', data)
          setAnalysis(data)
        } else if (response.status === 400) {
          // Transcript not ready yet, skip silently
          console.log('[AI Analysis] Transcript not ready for analysis yet (400)')
        } else {
          const errorData = await response.json().catch(() => ({}))
          console.warn('[AI Analysis] Failed with status:', response.status, errorData)
        }
      } catch (error) {
        console.error('[AI Analysis] Error analyzing session:', error)
      } finally {
        setAnalyzing(false)
      }
    }
    
    fetchSession()
    // Only analyze if session is ready (has transcript)
    fetchSession().then(() => {
      // Wait a bit to see if transcript exists
      setTimeout(() => analyzeSession(), 1000)
    })
  }, [sessionId])

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
        label: analysis.recordingType.charAt(0).toUpperCase() + analysis.recordingType.slice(1),
        confidence: analysis.recordingTypeConfidence 
      }]
    : getRecordingTypeSuggestions(session.id)
  
  const domainSuggestions = analysis?.domains?.length > 0
    ? analysis.domains.map((d: any) => ({
        value: d.domain,
        label: d.domain.charAt(0).toUpperCase() + d.domain.slice(1),
        confidence: d.confidence
      }))
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

  const selectedTemplate = mockTemplates.find((t) => t.id === selectedTemplateId)

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
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleGenerateOutput(suggestedTemplates[0]?.id || "tmpl_1")}
          >
            Generate Output
          </Button>
          {/* Desktop toggle for right panel */}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setRightPanelOpen(!rightPanelOpen)}
            className="hidden lg:flex"
          >
            {rightPanelOpen ? (
              <PanelRightClose className="h-4 w-4" />
            ) : (
              <PanelRight className="h-4 w-4" />
            )}
          </Button>
          {/* Mobile sheet trigger */}
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="ghost" size="sm" className="lg:hidden">
                <Settings2 className="h-4 w-4" />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-[340px] p-0">
              <SessionSetupPanel
                session={session}
                recordingTypeSuggestions={recordingTypeSuggestions}
                domainSuggestions={domainSuggestions}
                suggestedTemplates={suggestedTemplates}
                onGenerateOutput={handleGenerateOutput}
              />
            </SheetContent>
          </Sheet>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex gap-4 pt-4 min-h-0">
        {/* Left: Secondary Nav Tabs (Desktop) */}
        <div className="hidden md:flex flex-col w-48 shrink-0">
          <Tabs defaultValue="transcript" orientation="vertical" className="h-full">
            <TabsList className="flex flex-col h-auto bg-transparent p-0 gap-1">
              <TabsTrigger
                value="transcript"
                className="w-full justify-start gap-2 px-3 data-[state=active]:bg-secondary"
              >
                <ScrollText className="h-4 w-4" />
                Transcript
              </TabsTrigger>
              <TabsTrigger
                value="context"
                className="w-full justify-start gap-2 px-3 data-[state=active]:bg-secondary"
              >
                <Settings2 className="h-4 w-4" />
                Context
              </TabsTrigger>
              <TabsTrigger
                value="outputs"
                className="w-full justify-start gap-2 px-3 data-[state=active]:bg-secondary"
              >
                <FileText className="h-4 w-4" />
                Outputs
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        {/* Mobile Tabs */}
        <Tabs defaultValue="transcript" className="flex-1 flex flex-col min-h-0 md:hidden">
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
              />
            </div>
          </TabsContent>
          <TabsContent value="context" className="flex-1 min-h-0 mt-0">
            <div className="h-full rounded-lg border border-border bg-card overflow-auto p-4">
              <p className="text-sm text-muted-foreground">Context settings are available in the side panel.</p>
            </div>
          </TabsContent>
          <TabsContent value="outputs" className="flex-1 min-h-0 mt-0">
            <div className="h-full rounded-lg border border-border bg-card overflow-auto p-4">
              {outputsLoading ? (
                <p className="text-sm text-muted-foreground">Loading outputs...</p>
              ) : outputs.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-sm text-muted-foreground mb-4">No outputs generated yet.</p>
                  <Button size="sm" onClick={() => setGenerateModalOpen(true)}>
                    Generate Your First Output
                  </Button>
                </div>
              ) : (
                <div className="space-y-3">
                  {outputs.map((output) => (
                    <div key={output.id} className="p-3 border border-border rounded-lg">
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex-1">
                          <h4 className="text-sm font-medium">{output.templateName}</h4>
                          <p className="text-xs text-muted-foreground">
                            {output.audience} · {output.perspective} · {output.tone}
                          </p>
                        </div>
                        <div className="flex items-center gap-1">
                          <Badge variant="outline" className="text-xs mr-1">{output.format}</Badge>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={async () => {
                              try {
                                await navigator.clipboard.writeText(output.content)
                                alert('Copied to clipboard!')
                              } catch (err) {
                                console.error('Failed to copy:', err)
                                alert('Failed to copy to clipboard')
                              }
                            }}
                            title="Copy to clipboard"
                          >
                            <Copy className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => {
                              const blob = new Blob([output.content], { type: 'text/plain' })
                              const url = window.URL.createObjectURL(blob)
                              const a = document.createElement('a')
                              a.href = url
                              a.download = `${output.templateName}-${output.perspective}-${output.audience}.txt`
                              document.body.appendChild(a)
                              a.click()
                              window.URL.revokeObjectURL(url)
                              document.body.removeChild(a)
                            }}
                            title="Download"
                          >
                            <Download className="h-3.5 w-3.5" />
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

        {/* Center: Transcript Viewer (Desktop) */}
        <div className="hidden md:flex flex-1 min-h-0 flex-col gap-4">
          {/* Audio Player */}
          {session.audioUrl && (
            <AudioPlayer
              ref={audioPlayerRef}
              audioUrl={session.audioUrl}
              onTimeUpdate={setCurrentAudioTime}
            />
          )}
          
          {/* Transcript */}
          <div className="flex-1 rounded-lg border border-border bg-card overflow-hidden">
                      <TranscriptViewer 
                        segments={session.transcript} 
                        currentTime={currentAudioTime}
                        onSeek={handleSeekToTime}
                      />
          </div>
        </div>

        {/* Right: Session Setup Panel (Desktop) */}
        <div
          className={cn(
            "hidden lg:block w-80 shrink-0 transition-all duration-300 overflow-hidden",
            !rightPanelOpen && "w-0"
          )}
        >
          <div className="h-full rounded-lg border border-border bg-card overflow-hidden">
            <SessionSetupPanel
              session={session}
              recordingTypeSuggestions={recordingTypeSuggestions}
              domainSuggestions={domainSuggestions}
              suggestedTemplates={suggestedTemplates}
              onGenerateOutput={handleGenerateOutput}
            />
          </div>
        </div>
      </div>

      {/* Generate Output Modal */}
      <GenerateOutputModal
        open={generateModalOpen}
        onOpenChange={setGenerateModalOpen}
        template={selectedTemplate}
        session={session}
      />
    </div>
  )
}
