"use client"

import { useState, useEffect } from "react"
import { useTranslations } from "next-intl"
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
import { toast } from "sonner"
import type { Template, Session, ParticipantRole, Audience, OutputTone, OutputFormat } from "@/lib/types-v0"
import { participantRoleLabels, semanticRoleLabels, audienceLabels, languages, mockTemplates } from "@/lib/mock/data"

interface GenerateOutputModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  template?: Template | null
  /** When template is not provided, use this ID to pre-select (works for user templates) */
  initialTemplateId?: string | null
  session: Session
  onSuccess?: () => void | Promise<void> // Called after output generated - use to refresh outputs list
}

// Map display language name to ISO code and AI instruction
const languageToConfig: Record<string, { code: string; instruction: string }> = {
  English: { code: 'en', instruction: 'English' },
  German: { code: 'de', instruction: 'German' },
  French: { code: 'fr', instruction: 'French' },
  Spanish: { code: 'es', instruction: 'Spanish' },
  Italian: { code: 'it', instruction: 'Italian' },
  Portuguese: { code: 'pt', instruction: 'Portuguese' },
  Dutch: { code: 'nl', instruction: 'Dutch' },
  Polish: { code: 'pl', instruction: 'Polish' },
  Thai: { code: 'th', instruction: 'Thai' },
}
const codeToLanguage = Object.fromEntries(
  Object.entries(languageToConfig).map(([name, { code }]) => [code, name])
)

export function GenerateOutputModal({
  open,
  onOpenChange,
  template,
  initialTemplateId,
  session,
  onSuccess,
}: GenerateOutputModalProps) {
  const t = useTranslations('generateModal')
  const [templates, setTemplates] = useState<Template[]>([])
  const [loadingTemplates, setLoadingTemplates] = useState(true)
  const [selectedTemplate, setSelectedTemplate] = useState<string>(template?.id || initialTemplateId || "")
  const [selectedPerspective, setSelectedPerspective] = useState<ParticipantRole | "">("")
  const [selectedAudience, setSelectedAudience] = useState<Audience | "">("")
  const [selectedLanguage, setSelectedLanguage] = useState("German")  // App default; updated by profile/session
  const [profileLanguage, setProfileLanguage] = useState<string | null>(null)

  // Fetch user profile for preferred_report_language (fallback when session language is missing/wrong)
  useEffect(() => {
    if (!open) return
    fetch('/api/profile')
      .then((r) => r.ok ? r.json() : null)
      .then((profile) => {
        const lang = profile?.preferred_report_language
        if (lang && typeof lang === 'string') {
          const normalized = lang.toLowerCase()
          setProfileLanguage(normalized === 'session' ? 'session' : normalized.slice(0, 2))
        }
      })
      .catch(() => {})
  }, [open])

  // Default output language: user profile preference > session (from transcript) > English
  // Profile wins because user explicitly set it; session language can be misdetected (e.g. German audio → "en")
  useEffect(() => {
    const normalize = (code?: string | null): string | null => {
      if (!code) return null
      const lower = code.toLowerCase()
      if (lower === 'session') return null
      if (lower === 'auto') return null
      return lower.slice(0, 2)
    }

    const preferredCode = normalize(profileLanguage)
    const sessionCode = normalize(session?.languageCode)
    const effectiveCode = preferredCode || sessionCode
    if (effectiveCode && codeToLanguage[effectiveCode]) {
      setSelectedLanguage(codeToLanguage[effectiveCode])
    }
  }, [session?.id, session?.languageCode, profileLanguage])
  const [tone, setTone] = useState<OutputTone>("neutral")
  const [format, setFormat] = useState<OutputFormat>("markdown")
  const [doInstructions, setDoInstructions] = useState("")
  const [dontInstructions, setDontInstructions] = useState("")
  const [createTemplate, setCreateTemplate] = useState(false)
  const [advancedOpen, setAdvancedOpen] = useState(false)
  const [previousInstructions, setPreviousInstructions] = useState<{ doInstructions: string; dontInstructions: string } | null>(null)
  const [perspectiveConfirmed, setPerspectiveConfirmed] = useState(false)
  const [audienceConfirmed, setAudienceConfirmed] = useState(false)
  const [generating, setGenerating] = useState(false)

  // Fetch templates: use suggested order for this session when available
  useEffect(() => {
    async function fetchTemplates() {
      try {
        const allRes = await fetch('/api/templates')
        const allData = allRes.ok ? await allRes.json() : []
        const allTemplates = allData.length > 0 ? allData : mockTemplates

        if (session?.id) {
          const suggestedRes = await fetch(`/api/templates/suggested?sessionId=${session.id}`)
          if (suggestedRes.ok) {
            const suggested = await suggestedRes.json()
            const suggestedIdsOrdered = suggested.map((t: Template) => t.id)
            const byId = new Map(allTemplates.map((t: Template) => [t.id, t]))
            const ordered = suggestedIdsOrdered.map((id: string) => byId.get(id)).filter(Boolean)
            const rest = allTemplates.filter((t: Template) => !suggestedIdsOrdered.includes(t.id))
            setTemplates([...ordered, ...rest])
          } else {
            setTemplates(allTemplates)
          }
        } else {
          setTemplates(allTemplates)
        }
      } catch (error) {
        console.error('Error fetching templates:', error)
        setTemplates(mockTemplates)
      } finally {
        setLoadingTemplates(false)
      }
    }
    fetchTemplates()
  }, [session?.id])

  // Get speakers with their roles for perspective selection
  const sessionSpeakers = session.speakers.filter(s => s.participantRole !== 'observer')
  
  // AI suggestions based on session data - suggest party_a by default
  const aiSuggestedPerspective: ParticipantRole | null = sessionSpeakers[0]?.participantRole || null
  const aiPerspectiveConfidence = 0.85
  const aiSuggestedAudience: Audience | null = session.domain === "sales" ? "internal" : null
  const aiAudienceConfidence = 0.72

  // Update selected template when prop changes or when templates load with initialTemplateId
  useEffect(() => {
    if (template) {
      setSelectedTemplate(template.id)
    } else if (initialTemplateId && templates.length > 0) {
      const exists = templates.some((t) => t.id === initialTemplateId)
      if (exists) setSelectedTemplate(initialTemplateId)
    }
  }, [template, initialTemplateId, templates])

  const currentTemplate = templates.find((t) => t.id === selectedTemplate)

  // Pre-fill do/don't instructions from template defaults when template selection changes,
  // and fetch previous instructions for this template
  const [lastPrefilledTemplateId, setLastPrefilledTemplateId] = useState<string | null>(null)
  useEffect(() => {
    if (!currentTemplate || currentTemplate.id === lastPrefilledTemplateId) return
    setDoInstructions(currentTemplate.defaultDoInstructions || '')
    setDontInstructions(currentTemplate.defaultDontInstructions || '')
    setLastPrefilledTemplateId(currentTemplate.id)
    setPreviousInstructions(null)

    fetch(`/api/templates/${currentTemplate.id}/last-instructions`)
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (!data) return
        const hasPrevDo = data.doInstructions && data.doInstructions !== (currentTemplate.defaultDoInstructions || '')
        const hasPrevDont = data.dontInstructions && data.dontInstructions !== (currentTemplate.defaultDontInstructions || '')
        if (hasPrevDo || hasPrevDont) {
          setPreviousInstructions(data)
        }
      })
      .catch(() => {})
  }, [currentTemplate?.id])

  const isPerspectiveValid = selectedPerspective !== "" && perspectiveConfirmed
  const isAudienceValid = selectedAudience !== "" && audienceConfirmed
  const canGenerate = selectedTemplate && isPerspectiveValid && isAudienceValid

  // Get label for a perspective: prefer real name over S1/S2
  const getDisplayName = (speaker: { id: string; name: string }) => {
    const corrected = session.transcriptCorrections?.name_corrections?.[speaker.name] 
      || session.transcriptCorrections?.name_corrections?.[speaker.id]
    if (corrected) return corrected
    // Fallback: use extractedContext participants by order (S1=first, S2=second)
    if (/^S\d+$/i.test(speaker.name)) {
      const participants = session.extractedContext?.participants || []
      const idx = session.speakers.findIndex(s => s.id === speaker.id)
      const p = participants[idx]
      if (p) return typeof p === 'string' ? p : p.name
    }
    return speaker.name
  }

  const getPerspectiveLabel = (role: ParticipantRole): string => {
    const speaker = session.speakers.find(s => s.participantRole === role)
    if (speaker) {
      const displayName = getDisplayName(speaker)
      const semanticLabel = speaker.semanticRole ? semanticRoleLabels[speaker.semanticRole] : null
      if (semanticLabel) {
        return `${displayName} (${semanticLabel})`
      }
      return `${displayName} (${participantRoleLabels[role]})`
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

  const resolveLanguageCodeForRequest = (): string => {
    const mapped = languageToConfig[selectedLanguage]?.code
    if (mapped) return mapped

    const sessionCode = (session?.languageCode || '').toLowerCase()
    if (sessionCode && sessionCode !== 'auto') return sessionCode.slice(0, 2)

    const preferredCode = (profileLanguage || '').toLowerCase()
    if (preferredCode && preferredCode !== 'session' && preferredCode !== 'auto') {
      return preferredCode.slice(0, 2)
    }

    return 'de'
  }

  const handleGenerate = async () => {
    if (!canGenerate || generating) return
    
    setGenerating(true)
    
    try {
      const response = await fetch('/api/outputs/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: session.id,
          config: {
            templateId: selectedTemplate || null,
            templateName: templates.find((t) => t.id === selectedTemplate)?.name || 'Custom Output',
            perspective: selectedPerspective,
            perspectiveSpeakerName: (() => {
              if (!selectedPerspective || selectedPerspective === 'observer') return undefined
              const speaker = session.speakers.find(s => s.participantRole === selectedPerspective)
              return speaker ? getDisplayName(speaker) : undefined
            })(),
            audience: selectedAudience,
            language: resolveLanguageCodeForRequest(),
            tone,
            format,
            doInstructions,
            dontInstructions,
            createTemplateFromConfig: createTemplate,
            citeTimestamps: false, // TODO: Add UI control for this
          }
        })
      })
      
      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to generate output')
      }
      
      const data = await response.json()
      
      // Success! Refresh outputs list and close modal
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('notissima:outputs-updated'))
      }
      await Promise.resolve(onSuccess?.())
      onOpenChange(false)
      
      toast.success(
        data.createdTemplateId
          ? 'Output generated and saved as template! View both in their tabs.'
          : 'Output generated! View it in the Outputs tab.'
      )
      
      // Optional: Navigate to outputs page
      // window.location.href = '/outputs'
      
    } catch (error) {
      console.error('Error generating output:', error)
      toast.error(t('generateFailed') + ': ' + (error as Error).message)
    } finally {
      setGenerating(false)
    }
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
              <Select value={selectedTemplate} onValueChange={setSelectedTemplate} disabled={loadingTemplates}>
                <SelectTrigger className="bg-secondary border-border">
                  <SelectValue placeholder={loadingTemplates ? "Loading templates..." : "Select a template..."} />
                </SelectTrigger>
                <SelectContent>
                  {templates.map((t) => (
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
                        {getDisplayName(speaker)}
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
                      <SelectItem value="casual">Casual</SelectItem>
                      <SelectItem value="funny">Funny</SelectItem>
                      <SelectItem value="technical">Technical</SelectItem>
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
                    placeholder={"e.g., Focus on action items and deadlines\nAnnotate if something is unclear or ambiguous\nInclude exact quotes for key decisions\nHighlight areas of disagreement"}
                    className="bg-secondary border-border min-h-[80px]"
                  />
                  {previousInstructions?.doInstructions && doInstructions !== previousInstructions.doInstructions && (
                    <button
                      type="button"
                      onClick={() => setDoInstructions(previousInstructions.doInstructions)}
                      className="text-xs text-info hover:text-info/80 flex items-center gap-1"
                    >
                      <Sparkles className="h-3 w-3" />
                      Use previous: &quot;{previousInstructions.doInstructions.slice(0, 60)}{previousInstructions.doInstructions.length > 60 ? '...' : ''}&quot;
                    </button>
                  )}
                </div>

                {/* Don't Instructions */}
                <div className="space-y-2">
                  <Label>Do not include...</Label>
                  <Textarea
                    value={dontInstructions}
                    onChange={(e) => setDontInstructions(e.target.value)}
                    placeholder={"e.g., Skip smalltalk and greetings\nLeave out off-topic tangents\nAvoid mentioning competitor names\nDon't include personal anecdotes"}
                    className="bg-secondary border-border min-h-[80px]"
                  />
                  {previousInstructions?.dontInstructions && dontInstructions !== previousInstructions.dontInstructions && (
                    <button
                      type="button"
                      onClick={() => setDontInstructions(previousInstructions.dontInstructions)}
                      className="text-xs text-info hover:text-info/80 flex items-center gap-1"
                    >
                      <Sparkles className="h-3 w-3" />
                      Use previous: &quot;{previousInstructions.dontInstructions.slice(0, 60)}{previousInstructions.dontInstructions.length > 60 ? '...' : ''}&quot;
                    </button>
                  )}
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
            <Button onClick={handleGenerate} disabled={!canGenerate || generating}>
              {generating ? (
                <>
                  <div className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-solid border-current border-r-transparent mr-2"></div>
                  Generating...
                </>
              ) : canGenerate ? (
                "Generate Output"
              ) : (
                "Confirm Required Fields"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </TooltipProvider>
  )
}
