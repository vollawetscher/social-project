"use client"

import { useState } from "react"
import { useParams } from "next/navigation"
import Link from "next/link"
import {
  ArrowLeft,
  FileText,
  Settings2,
  ScrollText,
  PanelRightClose,
  PanelRight,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet"
import { TranscriptViewer } from "@/components/transcript-viewer-v0"
import { SessionSetupPanel } from "@/components/session-setup-panel"
import { GenerateOutputModal } from "@/components/generate-output-modal"
import {
  mockSessions,
  mockTemplates,
  getRecordingTypeSuggestions,
  getDomainSuggestions,
  getSuggestedTemplates,
} from "@/lib/mock/data"
import { cn } from "@/lib/utils"

export default function SessionDetailPage() {
  const params = useParams()
  const sessionId = params.id as string

  const session = mockSessions.find((s) => s.id === sessionId) || mockSessions[0]
  const recordingTypeSuggestions = getRecordingTypeSuggestions(session.id)
  const domainSuggestions = getDomainSuggestions(session.id)
  const suggestedTemplates = getSuggestedTemplates(session.domain)

  const [rightPanelOpen, setRightPanelOpen] = useState(true)
  const [generateModalOpen, setGenerateModalOpen] = useState(false)
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null)

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
          <Link href="/app/sessions">
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
              <TranscriptViewer segments={session.transcript} />
            </div>
          </TabsContent>
          <TabsContent value="context" className="flex-1 min-h-0 mt-0">
            <div className="h-full rounded-lg border border-border bg-card overflow-auto p-4">
              <p className="text-sm text-muted-foreground">Context settings are available in the side panel.</p>
            </div>
          </TabsContent>
          <TabsContent value="outputs" className="flex-1 min-h-0 mt-0">
            <div className="h-full rounded-lg border border-border bg-card overflow-auto p-4">
              <p className="text-sm text-muted-foreground">No outputs generated yet.</p>
            </div>
          </TabsContent>
        </Tabs>

        {/* Center: Transcript Viewer (Desktop) */}
        <div className="hidden md:flex flex-1 min-h-0">
          <div className="w-full h-full rounded-lg border border-border bg-card overflow-hidden">
            <TranscriptViewer segments={session.transcript} />
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
