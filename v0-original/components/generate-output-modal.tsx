"use client"

import { useState, useEffect } from "react"
import {
  AlertTriangle,
  Sparkles,
  ChevronDown,
  ChevronUp,
  Info,
  CheckCircle2,
  Users,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"
import type { Template, Session, ParticipantRole, Audience, OutputTone, OutputFormat } from "@/lib/types-v0"
import { participantRoleLabels, semanticRoleLabels, audienceLabels, languages, mockTemplates } from "@/lib/mock/data"

interface GenerateOutputModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  template?: Template | null
  session: Session
}

export function GenerateOutputModal({
  open,
  onOpenChange,
  template,
  session,
}: GenerateOutputModalProps) {
  const [selectedTemplate, setSelectedTemplate] = useState<string>(template?.id || "")
  const [selectedPerspective, setSelectedPerspective] = useState<ParticipantRole | "">("")
  const [selectedAudience, setSelectedAudience] = useState<Audience | "">("")
  const [selectedLanguage, setSelectedLanguage] = useState("English")
  const [tone, setTone] = useState<OutputTone>("neutral")
  const [format, setFormat] = useState<OutputFormat>("markdown")
  const [doInstructions, setDoInstructions] = useState("")
  const [dontInstructions, setDontInstructions] = useState("")
  const [createTemplate, setCreateTemplate] = useState(false)
  const [advancedOpen, setAdvancedOpen] = useState(false)
  const [perspectiveConfirmed, setPerspectiveConfirmed] = useState(false)
  const [audienceConfirmed, setAudienceConfirmed] = useState(false)

  // Get speakers with their roles for perspective selection
  const sessionSpeakers = session.speakers.filter(s => s.participantRole !== 'observer')
  
  // AI suggestions based on session data - suggest party_a by default
  const aiSuggestedPerspective: ParticipantRole | null = sessionSpeakers[0]?.participantRole || null
  const aiPerspectiveConfidence = 0.85
  const aiSuggestedAudience: Audience | null = session.domain === "sales" ? "internal" : null
  const aiAudienceConfidence = 0.72

  // Update selected template when prop changes
  useEffect(() => {
    if (template) {
      setSelectedTemplate(template.id)
    }
  }, [template])

  const currentTemplate = mockTemplates.find((t) => t.id === selectedTemplate)

  const isPerspectiveValid = selectedPerspective !== "" && perspectiveConfirmed
  const isAudienceValid = selectedAudience !== "" && audienceConfirmed
  const canGenerate = selectedTemplate && isPerspectiveValid && isAudienceValid

  // Get label for a perspective based on session speakers
  const getPerspectiveLabel = (role: ParticipantRole): string => {
    const speaker = session.speakers.find(s => s.participantRole === role)
    if (speaker) {
      const semanticLabel = speaker.semanticRole ? semanticRoleLabels[speaker.semanticRole] : null
      if (semanticLabel) {
        return `${speaker.name} (${semanticLabel})`
      }
      return `${speaker.name} (${participantRoleLabels[role]})`
    }
    return participantRoleLabels[role]
  }

  const handlePerspectiveSelect = (perspective: ParticipantRole) => {
    setSelectedPerspective(perspective)
    // Auto-confirm if it matches AI suggestion with high confidence
    if (perspective === aiSuggestedPerspective && aiPerspectiveConfidence >= 0.8) {
      setPerspectiveConfirmed(true)
    } else {
      setPerspectiveConfirmed(false)
    }
  }

  const handleAudienceSelect = (audience: Audience) => {
    setSelectedAudience(audience)
    // Auto-confirm if it matches AI suggestion with high confidence
    if (audience === aiSuggestedAudience && aiAudienceConfidence >= 0.8) {
      setAudienceConfirmed(true)
    } else {
      setAudienceConfirmed(false)
    }
  }

  const handleGenerate = () => {
    if (!canGenerate) return
    // Mock generation
    onOpenChange(false)
  }

  const handleReset = () => {
    setSelectedPerspective("")
    setSelectedAudience("")
    setPerspectiveConfirmed(false)
    setAudienceConfirmed(false)
  }

  return (
    <TooltipProvider>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Generate Output</DialogTitle>
            <DialogDescription>
              Configure your output settings. Perspective and audience are required.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-4">
            {/* Warning Banner */}
            <div className="flex items-start gap-3 p-3 rounded-lg bg-warning/10 border border-warning/20">
              <AlertTriangle className="h-5 w-5 text-warning shrink-0 mt-0.5" />
              <p className="text-sm text-foreground">
                <span className="font-medium">Perspective and audience affect tone, risk, and interpretation.</span>{" "}
                Please confirm these selections before generating.
              </p>
            </div>

            {/* Template Selection */}
            <div className="space-y-2">
              <Label>Template</Label>
              <Select value={selectedTemplate} onValueChange={setSelectedTemplate}>
                <SelectTrigger className="bg-secondary border-border">
                  <SelectValue placeholder="Select a template..." />
                </SelectTrigger>
                <SelectContent>
                  {mockTemplates.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {currentTemplate && (
                <p className="text-xs text-muted-foreground">{currentTemplate.description}</p>
              )}
            </div>

            {/* Perspective Selection - REQUIRED */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="flex items-center gap-1">
                  Output Perspective
                  <span className="text-destructive">*</span>
                  <Tooltip>
                    <TooltipTrigger>
                      <Info className="h-3.5 w-3.5 text-muted-foreground" />
                    </TooltipTrigger>
                    <TooltipContent className="max-w-[220px]">
                      Choose from whose viewpoint the output should be generated. This affects how information is framed and what details are emphasized.
                    </TooltipContent>
                  </Tooltip>
                </Label>
                {!isPerspectiveValid && selectedPerspective && (
                  <span className="text-xs text-warning">Confirmation required</span>
                )}
              </div>
              
              {/* Session Speakers Info */}
              {sessionSpeakers.length > 0 && (
                <div className="p-2 rounded-md bg-secondary/50 border border-border">
                  <p className="text-xs text-muted-foreground mb-1.5 flex items-center gap-1">
                    <Users className="h-3 w-3" />
                    Participants in this session:
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {session.speakers.map((speaker) => (
                      <Badge
                        key={speaker.id}
                        variant="outline"
                        className="text-[10px]"
                      >
                        {speaker.name}
                        {speaker.semanticRole && (
                          <span className="text-muted-foreground ml-1">
                            ({semanticRoleLabels[speaker.semanticRole]})
                          </span>
                        )}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {/* AI Suggestion */}
              {aiSuggestedPerspective && (
                <div className="flex items-center gap-2 p-2 rounded-md bg-info/10 border border-info/20">
                  <Sparkles className="h-4 w-4 text-info" />
                  <span className="text-sm text-foreground">
                    AI suggests: <span className="font-medium">{getPerspectiveLabel(aiSuggestedPerspective)}</span>
                  </span>
                  <Badge variant="outline" className="text-[10px] border-info/50 text-info">
                    {Math.round(aiPerspectiveConfidence * 100)}% confident
                  </Badge>
                </div>
              )}

              <Select
                value={selectedPerspective}
                onValueChange={(v) => handlePerspectiveSelect(v as ParticipantRole)}
              >
                <SelectTrigger
                  className={cn(
                    "bg-secondary border-border",
                    !isPerspectiveValid && selectedPerspective && "border-warning"
                  )}
                >
                  <SelectValue placeholder="Select perspective..." />
                </SelectTrigger>
                <SelectContent>
                  {sessionSpeakers.length > 0 ? (
                    // Show actual speakers from session
                    sessionSpeakers.map((speaker) => (
                      <SelectItem key={speaker.participantRole} value={speaker.participantRole}>
                        {getPerspectiveLabel(speaker.participantRole)}
                      </SelectItem>
                    ))
                  ) : (
                    // Fallback to generic options
                    Object.entries(participantRoleLabels)
                      .filter(([key]) => key !== 'observer')
                      .map(([key, label]) => (
                        <SelectItem key={key} value={key}>
                          {label}
                        </SelectItem>
                      ))
                  )}
                  {/* Always show observer option */}
                  <SelectItem value="observer">
                    {participantRoleLabels.observer}
                  </SelectItem>
                </SelectContent>
              </Select>

              {/* Confirm checkbox */}
              {selectedPerspective && !perspectiveConfirmed && (
                <div className="flex items-center gap-2 mt-2">
                  <Checkbox
                    id="confirm-perspective"
                    checked={perspectiveConfirmed}
                    onCheckedChange={(checked) => setPerspectiveConfirmed(checked === true)}
                  />
                  <label
                    htmlFor="confirm-perspective"
                    className="text-sm text-foreground cursor-pointer"
                  >
                    I confirm this perspective selection
                  </label>
                </div>
              )}

              {isPerspectiveValid && (
                <div className="flex items-center gap-1.5 text-success text-xs">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  Perspective confirmed
                </div>
              )}
            </div>

            {/* Audience Selection - REQUIRED */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="flex items-center gap-1">
                  Audience
                  <span className="text-destructive">*</span>
                  <Tooltip>
                    <TooltipTrigger>
                      <Info className="h-3.5 w-3.5 text-muted-foreground" />
                    </TooltipTrigger>
                    <TooltipContent className="max-w-[200px]">
                      Internal: for team/organization use. External: for third parties, clients, or public.
                    </TooltipContent>
                  </Tooltip>
                </Label>
                {!isAudienceValid && selectedAudience && (
                  <span className="text-xs text-warning">Confirmation required</span>
                )}
              </div>

              {/* AI Suggestion */}
              {aiSuggestedAudience && (
                <div className="flex items-center gap-2 p-2 rounded-md bg-info/10 border border-info/20">
                  <Sparkles className="h-4 w-4 text-info" />
                  <span className="text-sm text-foreground">
                    AI suggests: <span className="font-medium">{audienceLabels[aiSuggestedAudience]}</span>
                  </span>
                  <Badge variant="outline" className="text-[10px] border-info/50 text-info">
                    {Math.round(aiAudienceConfidence * 100)}% confident
                  </Badge>
                </div>
              )}

              <Select
                value={selectedAudience}
                onValueChange={(v) => handleAudienceSelect(v as Audience)}
              >
                <SelectTrigger
                  className={cn(
                    "bg-secondary border-border",
                    !isAudienceValid && selectedAudience && "border-warning"
                  )}
                >
                  <SelectValue placeholder="Select audience..." />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(audienceLabels).map(([key, label]) => (
                    <SelectItem key={key} value={key}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* Confirm checkbox */}
              {selectedAudience && !audienceConfirmed && (
                <div className="flex items-center gap-2 mt-2">
                  <Checkbox
                    id="confirm-audience"
                    checked={audienceConfirmed}
                    onCheckedChange={(checked) => setAudienceConfirmed(checked === true)}
                  />
                  <label
                    htmlFor="confirm-audience"
                    className="text-sm text-foreground cursor-pointer"
                  >
                    I confirm this audience selection
                  </label>
                </div>
              )}

              {isAudienceValid && (
                <div className="flex items-center gap-1.5 text-success text-xs">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  Audience confirmed
                </div>
              )}
            </div>

            {/* Output Language */}
            <div className="space-y-2">
              <Label>Output Language</Label>
              <Select value={selectedLanguage} onValueChange={setSelectedLanguage}>
                <SelectTrigger className="bg-secondary border-border">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {languages.map((lang) => (
                    <SelectItem key={lang} value={lang}>
                      {lang}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Advanced Options */}
            <Collapsible open={advancedOpen} onOpenChange={setAdvancedOpen}>
              <CollapsibleTrigger asChild>
                <Button variant="ghost" className="w-full justify-between px-0 hover:bg-transparent">
                  <span className="text-sm font-medium">Advanced Options</span>
                  {advancedOpen ? (
                    <ChevronUp className="h-4 w-4" />
                  ) : (
                    <ChevronDown className="h-4 w-4" />
                  )}
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent className="space-y-4 pt-2">
                {/* Tone */}
                <div className="space-y-2">
                  <Label>Tone</Label>
                  <Select value={tone} onValueChange={(v) => setTone(v as OutputTone)}>
                    <SelectTrigger className="bg-secondary border-border">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="direct">Direct</SelectItem>
                      <SelectItem value="neutral">Neutral</SelectItem>
                      <SelectItem value="formal">Formal</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Format */}
                <div className="space-y-2">
                  <Label>Output Format</Label>
                  <Select value={format} onValueChange={(v) => setFormat(v as OutputFormat)}>
                    <SelectTrigger className="bg-secondary border-border">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="markdown">Markdown</SelectItem>
                      <SelectItem value="json">JSON</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Do Instructions */}
                <div className="space-y-2">
                  <Label>Do include...</Label>
                  <Textarea
                    value={doInstructions}
                    onChange={(e) => setDoInstructions(e.target.value)}
                    placeholder="e.g., Include action items, mention specific deadlines..."
                    className="bg-secondary border-border min-h-[80px]"
                  />
                </div>

                {/* Don't Instructions */}
                <div className="space-y-2">
                  <Label>Do not include...</Label>
                  <Textarea
                    value={dontInstructions}
                    onChange={(e) => setDontInstructions(e.target.value)}
                    placeholder="e.g., Avoid mentioning competitor names..."
                    className="bg-secondary border-border min-h-[80px]"
                  />
                </div>

                {/* Create Template Checkbox */}
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="create-template"
                    checked={createTemplate}
                    onCheckedChange={(checked) => setCreateTemplate(checked === true)}
                  />
                  <label htmlFor="create-template" className="text-sm text-foreground cursor-pointer">
                    Create a template from this configuration
                  </label>
                </div>
              </CollapsibleContent>
            </Collapsible>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={handleReset}>
              Reset
            </Button>
            <Button onClick={handleGenerate} disabled={!canGenerate}>
              {canGenerate ? "Generate Output" : "Confirm Required Fields"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </TooltipProvider>
  )
}
