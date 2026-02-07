"use client"

import { useState, useEffect } from "react"
import { toast } from "sonner"
import {
  ChevronDown,
  ChevronUp,
  Info,
  Shield,
  Quote,
  Sparkles,
  FileText,
  Users,
  Target,
  ListTodo,
  MapPin,
  Save,
  Check,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import { cn } from "@/lib/utils"
import type { Session, Template, AiSuggestion, RecordingType, Domain } from "@/lib/types-v0"

interface SessionSetupPanelProps {
  session: Session
  recordingTypeSuggestions: AiSuggestion<RecordingType>[]
  domainSuggestions: AiSuggestion<Domain>[]
  suggestedTemplates: Template[]
  onGenerateOutput: (templateId: string) => void
}

const recordingTypeLabels: Record<RecordingType, string> = {
  meeting: "Meeting",
  interview: "Interview",
  legal_deposition: "Legal Deposition",
  sales_call: "Sales Call",
  lecture: "Lecture",
  consultation: "Consultation",
  other: "Other",
}

const domainLabels: Record<Domain, string> = {
  legal: "Legal",
  sales: "Sales",
  hr: "Human Resources",
  medical: "Medical",
  education: "Education",
  consulting: "Consulting",
  general: "General",
}

function ConfidenceBadge({ confidence }: { confidence: number }) {
  const isHigh = confidence >= 0.8
  const isMedium = confidence >= 0.6 && confidence < 0.8
  return (
    <Badge
      variant="outline"
      className={cn(
        "text-[10px] ml-1",
        isHigh && "border-success/50 text-success",
        isMedium && "border-warning/50 text-warning",
        !isHigh && !isMedium && "border-muted-foreground/50 text-muted-foreground"
      )}
    >
      {Math.round(confidence * 100)}%
    </Badge>
  )
}

export function SessionSetupPanel({
  session,
  recordingTypeSuggestions,
  domainSuggestions,
  suggestedTemplates,
  onGenerateOutput,
}: SessionSetupPanelProps) {
  const [isContextOpen, setIsContextOpen] = useState(true)
  const [selectedRecordingType, setSelectedRecordingType] = useState<RecordingType | undefined>(
    session.recordingType
  )
  const [selectedDomain, setSelectedDomain] = useState<Domain | undefined>(session.domain)
  const [piiRedaction, setPiiRedaction] = useState(session.piiRedactionEnabled)
  const [citeTimestamps, setCiteTimestamps] = useState(true)

  const [participants, setParticipants] = useState(
    session.extractedContext?.participants.join(", ") || ""
  )
  const [purpose, setPurpose] = useState(session.extractedContext?.purpose || "")
  const [agenda, setAgenda] = useState(session.extractedContext?.agenda.join("\n") || "")
  const [venue, setVenue] = useState(session.extractedContext?.venue || "")

  // Track if changes have been made
  const [hasChanges, setHasChanges] = useState(false)
  const [isSaving, setIsSaving] = useState(false)

  // Initial values for comparison
  const [initialValues, setInitialValues] = useState({
    recordingType: session.recordingType,
    domain: session.domain,
    participants,
    purpose,
    agenda,
    venue
  })

  // Update initial values when session changes (e.g., after AI analysis)
  useEffect(() => {
    setInitialValues({
      recordingType: session.recordingType,
      domain: session.domain,
      participants: session.extractedContext?.participants.join(", ") || "",
      purpose: session.extractedContext?.purpose || "",
      agenda: session.extractedContext?.agenda.join("\n") || "",
      venue: session.extractedContext?.venue || ""
    })
    setParticipants(session.extractedContext?.participants.join(", ") || "")
    setPurpose(session.extractedContext?.purpose || "")
    setAgenda(session.extractedContext?.agenda.join("\n") || "")
    setVenue(session.extractedContext?.venue || "")
    setSelectedRecordingType(session.recordingType)
    setSelectedDomain(session.domain)
  }, [session])

  // Check for changes
  useEffect(() => {
    const changed = 
      selectedRecordingType !== initialValues.recordingType ||
      selectedDomain !== initialValues.domain ||
      participants !== initialValues.participants ||
      purpose !== initialValues.purpose ||
      agenda !== initialValues.agenda ||
      venue !== initialValues.venue
    setHasChanges(changed)
  }, [selectedRecordingType, selectedDomain, participants, purpose, agenda, venue, initialValues])

  // Save context
  const handleSaveContext = async () => {
    setIsSaving(true)
    try {
      const response = await fetch(`/api/sessions/${session.id}/context`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recordingType: selectedRecordingType,
          domains: selectedDomain ? [{ domain: selectedDomain, confidence: 1.0 }] : [],
          extractedContext: {
            participants: participants.split(',').map(p => p.trim()).filter(Boolean),
            purpose,
            agenda: agenda.split('\n').filter(Boolean),
            venue
          },
          lockContext: true
        })
      })

      if (!response.ok) {
        throw new Error('Failed to save context')
      }

      const data = await response.json()
      
      // Update initial values to reflect saved state
      setInitialValues({
        recordingType: selectedRecordingType,
        domain: selectedDomain,
        participants,
        purpose,
        agenda,
        venue
      })
      setHasChanges(false)
      
      toast.success('Context saved successfully', {
        description: 'Your selections won\'t be overwritten by AI analysis'
      })
    } catch (error) {
      console.error('Error saving context:', error)
      toast.error('Failed to save context', {
        description: error instanceof Error ? error.message : 'Unknown error'
      })
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <TooltipProvider>
      <div className="flex flex-col gap-4 p-4 h-full overflow-auto">
        {/* Save Button - Visible when changes detected */}
        {hasChanges && (
          <Button 
            onClick={handleSaveContext}
            disabled={isSaving}
            className="w-full sticky top-0 z-10 shadow-md"
            size="sm"
          >
            {isSaving ? (
              <>
                <div className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-solid border-current border-r-transparent mr-2"></div>
                Saving...
              </>
            ) : (
              <>
                <Save className="h-3.5 w-3.5 mr-2" />
                Save Context & Lock AI Suggestions
              </>
            )}
          </Button>
        )}

        {/* AI Suggestions */}
        <Card className="border-border">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-info" />
              AI Suggestions
              {initialValues.recordingType && (
                <Badge variant="outline" className="text-[10px] ml-auto">
                  <Check className="h-3 w-3 mr-1" />
                  Locked
                </Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Recording Type */}
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Recording Type</Label>
              <div className="flex flex-wrap gap-1.5 mb-2">
                {recordingTypeSuggestions.map((suggestion) => (
                  <button
                    key={suggestion.value}
                    onClick={() => setSelectedRecordingType(suggestion.value)}
                    className={cn(
                      "flex items-center gap-1 px-2 py-1 rounded-md text-xs transition-colors",
                      selectedRecordingType === suggestion.value
                        ? "bg-primary text-primary-foreground"
                        : "bg-secondary hover:bg-accent text-foreground"
                    )}
                  >
                    {suggestion.label}
                    <ConfidenceBadge confidence={suggestion.confidence} />
                  </button>
                ))}
              </div>
              <Select
                value={selectedRecordingType}
                onValueChange={(v) => setSelectedRecordingType(v as RecordingType)}
              >
                <SelectTrigger className="bg-secondary border-border">
                  <SelectValue placeholder="Override selection..." />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(recordingTypeLabels).map(([key, label]) => (
                    <SelectItem key={key} value={key}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Domain */}
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Domain</Label>
              <div className="flex flex-wrap gap-1.5 mb-2">
                {domainSuggestions.map((suggestion) => (
                  <button
                    key={suggestion.value}
                    onClick={() => setSelectedDomain(suggestion.value)}
                    className={cn(
                      "flex items-center gap-1 px-2 py-1 rounded-md text-xs transition-colors",
                      selectedDomain === suggestion.value
                        ? "bg-primary text-primary-foreground"
                        : "bg-secondary hover:bg-accent text-foreground"
                    )}
                  >
                    {suggestion.label}
                    <ConfidenceBadge confidence={suggestion.confidence} />
                  </button>
                ))}
              </div>
              <Select
                value={selectedDomain}
                onValueChange={(v) => setSelectedDomain(v as Domain)}
              >
                <SelectTrigger className="bg-secondary border-border">
                  <SelectValue placeholder="Override selection..." />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(domainLabels).map(([key, label]) => (
                    <SelectItem key={key} value={key}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Extracted Context */}
        <Collapsible open={isContextOpen} onOpenChange={setIsContextOpen}>
          <Card className="border-border">
            <CollapsibleTrigger asChild>
              <CardHeader className="pb-3 cursor-pointer hover:bg-secondary/50 transition-colors">
                <CardTitle className="text-sm flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <FileText className="h-4 w-4 text-muted-foreground" />
                    Extracted Context
                  </span>
                  {isContextOpen ? (
                    <ChevronUp className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <ChevronDown className="h-4 w-4 text-muted-foreground" />
                  )}
                </CardTitle>
              </CardHeader>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <CardContent className="space-y-4 pt-0">
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground flex items-center gap-1">
                    <Users className="h-3 w-3" />
                    Participants
                  </Label>
                  <Input
                    value={participants}
                    onChange={(e) => setParticipants(e.target.value)}
                    placeholder="Enter participant names..."
                    className="bg-secondary border-border text-sm"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground flex items-center gap-1">
                    <Target className="h-3 w-3" />
                    Purpose
                  </Label>
                  <Textarea
                    value={purpose}
                    onChange={(e) => setPurpose(e.target.value)}
                    placeholder="Describe the purpose..."
                    className="bg-secondary border-border text-sm min-h-[60px]"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground flex items-center gap-1">
                    <ListTodo className="h-3 w-3" />
                    Agenda
                  </Label>
                  <Textarea
                    value={agenda}
                    onChange={(e) => setAgenda(e.target.value)}
                    placeholder="One item per line..."
                    className="bg-secondary border-border text-sm min-h-[60px]"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground flex items-center gap-1">
                    <MapPin className="h-3 w-3" />
                    Venue
                  </Label>
                  <Input
                    value={venue}
                    onChange={(e) => setVenue(e.target.value)}
                    placeholder="Location or meeting type..."
                    className="bg-secondary border-border text-sm"
                  />
                </div>
              </CardContent>
            </CollapsibleContent>
          </Card>
        </Collapsible>

        {/* Controls */}
        <Card className="border-border">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Output Controls</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Shield className="h-4 w-4 text-muted-foreground" />
                <Label htmlFor="pii-redaction" className="text-sm">
                  PII Redaction
                </Label>
                <Tooltip>
                  <TooltipTrigger>
                    <Info className="h-3.5 w-3.5 text-muted-foreground" />
                  </TooltipTrigger>
                  <TooltipContent className="max-w-[200px]">
                    Automatically redact emails, phone numbers, and addresses from outputs
                  </TooltipContent>
                </Tooltip>
              </div>
              <Switch
                id="pii-redaction"
                checked={piiRedaction}
                onCheckedChange={setPiiRedaction}
              />
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Quote className="h-4 w-4 text-muted-foreground" />
                <Label htmlFor="cite-timestamps" className="text-sm">
                  Cite Timestamps
                </Label>
                <Tooltip>
                  <TooltipTrigger>
                    <Info className="h-3.5 w-3.5 text-muted-foreground" />
                  </TooltipTrigger>
                  <TooltipContent className="max-w-[200px]">
                    Include transcript timestamps in output citations
                  </TooltipContent>
                </Tooltip>
              </div>
              <Switch
                id="cite-timestamps"
                checked={citeTimestamps}
                onCheckedChange={setCiteTimestamps}
              />
            </div>
          </CardContent>
        </Card>

        {/* Suggested Outputs */}
        <Card className="border-border">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-info" />
              Suggested Outputs
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {suggestedTemplates.map((template) => (
              <div
                key={template.id}
                className="p-3 rounded-lg border border-border bg-secondary/30 space-y-2"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h4 className="text-sm font-medium text-foreground">
                      {template.name}
                    </h4>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {template.description}
                    </p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-1">
                  {template.sections.slice(0, 3).map((section) => (
                    <Badge
                      key={section.id}
                      variant="outline"
                      className="text-[10px]"
                    >
                      {section.name}
                    </Badge>
                  ))}
                  {template.sections.length > 3 && (
                    <Badge variant="outline" className="text-[10px]">
                      +{template.sections.length - 3} more
                    </Badge>
                  )}
                </div>
                <Button
                  size="sm"
                  className="w-full mt-2"
                  onClick={() => onGenerateOutput(template.id)}
                >
                  Generate
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </TooltipProvider>
  )
}
