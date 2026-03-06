"use client"

import { useState, useEffect } from "react"
import { useTranslations } from "next-intl"
import { toast } from "sonner"
import {
  ChevronDown,
  ChevronUp,
  Info,
  Shield,
  Quote,
  Terminal,
  CheckCircle2,
  Sparkles,
  FileText,
  Users,
  Target,
  ListTodo,
  MapPin,
  Save,
  Check,
  Loader2,
  Edit3,
  Trash2,
  Plus,
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
import type { Session, AiSuggestion, RecordingType, Domain } from "@/lib/types-v0"

interface SessionSetupPanelProps {
  session: Session
  recordingTypeSuggestions: AiSuggestion<RecordingType>[]
  domainSuggestions: AiSuggestion<Domain>[]
  onContextSaved?: () => void // Callback to refresh parent session data
  analyzing?: boolean // AI analysis in progress - show indicator
}

// Helper to get speaker IDs from transcript
function getSpeakerIds(session: Session): string[] {
  const speakers = new Set<string>()
  session.transcript.forEach(segment => {
    speakers.add(segment.speakerName)
  })
  return Array.from(speakers).sort()
}

const recordingTypeToLabelKey = (type: string): string => {
  const map: Record<string, string> = {
    call_inbound: 'incoming_call',
    call_outbound: 'outgoing_call',
    ai_agent_conversation: 'ai_agent',
  }
  return map[type] || type
}

const RECORDING_TYPES: RecordingType[] = [
  'meeting', 'interview', 'presentation', 'consultation',
  'call_inbound', 'call_outbound', 'dictation', 'ai_agent_conversation',
  'legal_deposition', 'sales_call', 'lecture', 'other',
]

const DOMAINS: Domain[] = [
  'legal', 'sales', 'hr', 'medical', 'education', 'consulting', 'general',
]

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
  onContextSaved,
  analyzing = false,
}: SessionSetupPanelProps) {
  const t = useTranslations('sessionSetup')
  const tl = useTranslations('labels')

  const [isContextOpen, setIsContextOpen] = useState(false)
  const [selectedRecordingType, setSelectedRecordingType] = useState<RecordingType | undefined>(
    session.recordingType
  )
  const [selectedDomain, setSelectedDomain] = useState<Domain | undefined>(session.domain)
  const [piiRedaction, setPiiRedaction] = useState(session.piiRedactionEnabled)
  const [citeTimestamps, setCiteTimestamps] = useState(true)

  const [participants, setParticipants] = useState(
    session.extractedContext?.participants
      ?.map((p: any) => typeof p === 'string' ? p : p?.name || 'Unknown')
      .join(", ") || ""
  )
  const [purpose, setPurpose] = useState(session.extractedContext?.purpose || "")
  const [agenda, setAgenda] = useState(session.extractedContext?.agenda?.join("\n") || "")
  const [venue, setVenue] = useState(session.extractedContext?.venue || "")

  // Track if changes have been made
  const [hasChanges, setHasChanges] = useState(false)
  
  // Track if user wants to apply corrections to transcript
  // Default to false if participants are placeholders (S1, S2, Unknown)
  const hasPlaceholderNames = session.extractedContext?.participants?.every((p: any) => {
    const name = typeof p === 'string' ? p : p?.name || ''
    return name.match(/^(S\d+|Unknown|Speaker \d+)$/i)
  })
  const [applyToTranscript, setApplyToTranscript] = useState(!hasPlaceholderNames)
  
  // Track which speaker/participant is the user
  const [userIdentity, setUserIdentity] = useState<string>(() => {
    // Try to find which participant has isUser: true
    const userParticipant = session.extractedContext?.participants?.find((p: any) => 
      typeof p === 'object' && p.isUser
    )
    return userParticipant ? (typeof userParticipant === 'string' ? userParticipant : userParticipant.name) : 'none'
  })
  const [isSaving, setIsSaving] = useState(false)

  // Word corrections: original (misheard) → corrected
  const [wordCorrections, setWordCorrections] = useState<Record<string, string>>(
    () => session.transcriptCorrections?.word_corrections || {}
  )
  const [newOriginal, setNewOriginal] = useState('')
  const [newCorrected, setNewCorrected] = useState('')
  const [savingWordCorrections, setSavingWordCorrections] = useState(false)

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
      participants: session.extractedContext?.participants
        ?.map((p: any) => typeof p === 'string' ? p : p?.name || 'Unknown')
        .join(", ") || "",
      purpose: session.extractedContext?.purpose || "",
      agenda: session.extractedContext?.agenda?.join("\n") || "",
      venue: session.extractedContext?.venue || ""
    })
    setParticipants(session.extractedContext?.participants
      ?.map((p: any) => typeof p === 'string' ? p : p?.name || 'Unknown')
      .join(", ") || "")
    setPurpose(session.extractedContext?.purpose || "")
    setAgenda(session.extractedContext?.agenda?.join("\n") || "")
    setVenue(session.extractedContext?.venue || "")
    setSelectedRecordingType(session.recordingType)
    setSelectedDomain(session.domain)
    setWordCorrections(session.transcriptCorrections?.word_corrections || {})
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
      // Build participant objects with isUser flag
      const participantNames = participants.split(',').map(p => p.trim()).filter(Boolean)
      const speakerIds = getSpeakerIds(session)
      
      const participantObjects = participantNames.map((name, idx) => {
        const speakerId = speakerIds[idx]
        const isUser = userIdentity === speakerId || 
                       (userIdentity !== 'none' && userIdentity !== 'listener' && name.toLowerCase().includes(userIdentity.toLowerCase()))
        
        return {
          name,
          role: null, // User can add roles later if needed
          isUser
        }
      })

      console.log('[Save Context] Built participant objects:', participantObjects)

      // Save context first
      const response = await fetch(`/api/sessions/${session.id}/context`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recordingType: selectedRecordingType,
          domains: selectedDomain ? [{ domain: selectedDomain, confidence: 1.0 }] : [],
          extractedContext: {
            participants: participantObjects,
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

      // Apply transcript corrections if checkbox is checked
      if (applyToTranscript) {
        const newParticipantNames = participants.split(',').map(p => p.trim()).filter(Boolean)
        const speakerIds = getSpeakerIds(session)
        
        // Map speaker IDs to participant names (S1 -> Christian, S2 -> Azat)
        const corrections: Record<string, string> = {}
        speakerIds.forEach((speakerId, idx) => {
          const participantName = newParticipantNames[idx]
          if (participantName && speakerId !== participantName) {
            corrections[speakerId] = participantName
          }
        })

        console.log('[Save Context] Creating corrections mapping:', corrections)

        // Save corrections if any changes
        if (Object.keys(corrections).length > 0) {
          const correctionsResponse = await fetch(`/api/sessions/${session.id}/corrections`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              corrections,
              type: 'name_corrections'
            })
          })

          if (!correctionsResponse.ok) {
            console.warn('Failed to save corrections, but context was saved')
          } else {
            console.log('[Save Context] Corrections saved successfully')
          }
        }
      }
      
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
      
      toast.success(t('contextSaved'), {
        description: applyToTranscript 
          ? t('correctionsSaved') 
          : t('selectionsLocked')
      })
      
      // Notify parent to refresh session data
      if (onContextSaved) {
        onContextSaved()
      }
    } catch (error) {
      console.error('Error saving context:', error)
      toast.error(t('saveFailed'), {
        description: error instanceof Error ? error.message : t('unknownError')
      })
    } finally {
      setIsSaving(false)
    }
  }

  // Save word corrections (replace: true = full replace for add/remove support)
  const handleSaveWordCorrections = async (updates: Record<string, string>) => {
    setSavingWordCorrections(true)
    try {
      const response = await fetch(`/api/sessions/${session.id}/corrections`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ corrections: updates, type: 'word_corrections', replace: true })
      })
      if (!response.ok) throw new Error('Failed to save corrections')
      const data = await response.json()
      setWordCorrections(data.corrections.word_corrections || {})
      toast.success(t('wordCorrectionsSaved'))
      onContextSaved?.()
    } catch (error) {
      toast.error(t('wordCorrectionsFailed'))
    } finally {
      setSavingWordCorrections(false)
    }
  }

  const handleAddWordCorrection = () => {
    const orig = newOriginal.trim()
    const corr = newCorrected.trim()
    if (!orig || !corr) return
    const updated = { ...wordCorrections, [orig]: corr }
    setWordCorrections(updated)
    setNewOriginal('')
    setNewCorrected('')
    handleSaveWordCorrections(updated)
  }

  const handleRemoveWordCorrection = (original: string) => {
    const { [original]: _, ...rest } = wordCorrections
    setWordCorrections(rest)
    handleSaveWordCorrections(rest)
  }

  return (
    <TooltipProvider>
      <div className="flex flex-col h-full">
        {/* Sticky Save bar - visible at top when changes exist (users find it immediately) */}
        {hasChanges && (
          <div className="sticky top-0 z-20 shrink-0 p-3 bg-background/95 backdrop-blur border-b border-border">
            <Button
              onClick={handleSaveContext}
              disabled={isSaving}
              className="w-full"
              size="sm"
            >
              {isSaving ? (
                <>
                  <div className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-solid border-current border-r-transparent mr-2"></div>
                  {t('saving')}
                </>
              ) : (
                <>
                  <Save className="h-3.5 w-3.5 mr-2" />
                  {t('saveContext')}
                </>
              )}
            </Button>
          </div>
        )}
        {/* Scrollable Content Area */}
        <div className="flex-1 overflow-y-auto pb-24">
          <div className="flex flex-col gap-4 p-4">
            {/* Analyzing indicator - shown when AI is processing transcript */}
            {analyzing && (
              <div className="flex items-center gap-2 p-3 rounded-lg bg-primary/10 border border-primary/20">
                <Loader2 className="h-4 w-4 animate-spin text-primary shrink-0" />
                <p className="text-sm font-medium text-foreground">{t('analyzingTranscript')}</p>
                <p className="text-xs text-muted-foreground">{t('analyzingHint')}</p>
              </div>
            )}

        {/* AI Suggestions */}
        <Card className="border-border">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-info" />
              {t('aiSuggestions')}
              {initialValues.recordingType && (
                <Badge variant="outline" className="text-[10px] ml-auto">
                  <Check className="h-3 w-3 mr-1" />
                  {t('locked')}
                </Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Recording Type */}
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">{t('recordingType')}</Label>
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
                  <SelectValue placeholder={t('overrideSelection')} />
                </SelectTrigger>
                <SelectContent>
                  {RECORDING_TYPES.map((key) => (
                    <SelectItem key={key} value={key}>
                      {tl('recordingTypes.' + recordingTypeToLabelKey(key))}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Domain */}
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">{t('domain')}</Label>
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
                  <SelectValue placeholder={t('overrideSelection')} />
                </SelectTrigger>
                <SelectContent>
                  {DOMAINS.map((key) => (
                    <SelectItem key={key} value={key}>
                      {tl('domains.' + key)}
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
                    {t('extractedContext')}
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
                    {t('participants')}
                  </Label>
                  <Input
                    value={participants}
                    onChange={(e) => setParticipants(e.target.value)}
                    placeholder={t('participantsPlaceholder')}
                    className="bg-secondary border-border text-sm"
                  />
                  <div className="space-y-2 pt-1">
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        id="apply-to-transcript-slide"
                        checked={applyToTranscript}
                        onChange={(e) => setApplyToTranscript(e.target.checked)}
                        className="h-3 w-3 rounded border-border"
                      />
                      <Label 
                        htmlFor="apply-to-transcript-slide" 
                        className="text-xs text-muted-foreground cursor-pointer font-normal"
                      >
                        {t('applyNameCorrections')}
                      </Label>
                    </div>
                    
                    {/* User Identity Selection */}
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">
                        {t('whichParticipant')}
                      </Label>
                      <Select value={userIdentity} onValueChange={setUserIdentity}>
                        <SelectTrigger className="h-8 text-xs bg-secondary border-border">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">{t('notInConversation')}</SelectItem>
                          <SelectItem value="listener">{t('listenerOnly')}</SelectItem>
                          {getSpeakerIds(session).map((speaker) => (
                            <SelectItem key={speaker} value={speaker}>
                              {speaker}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground flex items-center gap-1">
                    <Target className="h-3 w-3" />
                    {t('purpose')}
                  </Label>
                  <Textarea
                    value={purpose}
                    onChange={(e) => setPurpose(e.target.value)}
                    placeholder={t('purposePlaceholder')}
                    className="bg-secondary border-border text-sm min-h-[60px]"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground flex items-center gap-1">
                    <ListTodo className="h-3 w-3" />
                    {t('agenda')}
                  </Label>
                  <Textarea
                    value={agenda}
                    onChange={(e) => setAgenda(e.target.value)}
                    placeholder={t('agendaPlaceholder')}
                    className="bg-secondary border-border text-sm min-h-[60px]"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground flex items-center gap-1">
                    <MapPin className="h-3 w-3" />
                    {t('venue')}
                  </Label>
                  <Input
                    value={venue}
                    onChange={(e) => setVenue(e.target.value)}
                    placeholder={t('venuePlaceholder')}
                    className="bg-secondary border-border text-sm"
                  />
                </div>
                {session.extractedContext?.consent && (
                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground flex items-center gap-1">
                      <Shield className="h-3 w-3" />
                      {t('consent')}
                    </Label>
                    <div className="rounded-md bg-secondary/50 border border-border px-3 py-2 text-sm">
                      {session.extractedContext.consent.discussed ? (
                        <div className="space-y-1">
                          <div className="flex items-center gap-1.5 text-foreground">
                            <CheckCircle2 className="h-4 w-4 text-success shrink-0" />
                            <span>{t('consentDiscussed')}</span>
                          </div>
                          {session.extractedContext.consent.summary && (
                            <p className="text-muted-foreground text-xs pl-5">{session.extractedContext.consent.summary}</p>
                          )}
                          {session.extractedContext.consent.participantsConsented?.length ? (
                            <p className="text-muted-foreground text-xs pl-5">
                              {t('participants')}: {session.extractedContext.consent.participantsConsented.join(', ')}
                            </p>
                          ) : null}
                        </div>
                      ) : (
                        <div className="flex items-center gap-1.5 text-muted-foreground">
                          <span>{t('noConsentDetected')}</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}
                {session.extractedContext?.spokenCommands && session.extractedContext.spokenCommands.length > 0 && (
                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground flex items-center gap-1">
                      <Terminal className="h-3 w-3" />
                      {t('extractedCommands')}
                    </Label>
                    <div className="space-y-2">
                      {session.extractedContext.spokenCommands.map((cmd, idx) => (
                        <div
                          key={idx}
                          className="rounded-md bg-secondary/50 border border-border px-3 py-2 text-sm"
                        >
                          <p className="text-foreground font-medium">{cmd.phrase}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {cmd.speaker}{cmd.intentSummary ? ` · ${cmd.intentSummary}` : ''}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </CollapsibleContent>
          </Card>
        </Collapsible>

        {/* Word corrections */}
        <Card className="border-border">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Edit3 className="h-4 w-4 text-muted-foreground" />
              {t('wordCorrections')}
              <Tooltip>
                <TooltipTrigger>
                  <Info className="h-3.5 w-3.5 text-muted-foreground" />
                </TooltipTrigger>
                <TooltipContent className="max-w-[220px]">
                  {t('wordCorrectionsTooltip')}
                </TooltipContent>
              </Tooltip>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex gap-2">
              <Input
                value={newOriginal}
                onChange={(e) => setNewOriginal(e.target.value)}
                placeholder={t('misheardPlaceholder')}
                className="bg-secondary border-border text-sm flex-1"
              />
              <span className="text-muted-foreground self-center text-xs">→</span>
              <Input
                value={newCorrected}
                onChange={(e) => setNewCorrected(e.target.value)}
                placeholder={t('correctPlaceholder')}
                className="bg-secondary border-border text-sm flex-1"
              />
              <Button
                size="sm"
                variant="outline"
                onClick={handleAddWordCorrection}
                disabled={!newOriginal.trim() || !newCorrected.trim() || savingWordCorrections}
              >
                <Plus className="h-3.5 w-3.5" />
              </Button>
            </div>
            {Object.entries(wordCorrections).length > 0 && (
              <ul className="space-y-1.5 text-sm">
                {Object.entries(wordCorrections).map(([orig, corr]) => (
                  <li
                    key={orig}
                    className="flex items-center justify-between gap-2 py-1.5 px-2 rounded bg-secondary/50"
                  >
                    <span className="text-muted-foreground truncate">{orig}</span>
                    <span className="text-muted-foreground">→</span>
                    <span className="truncate flex-1 min-w-0">{corr}</span>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-6 w-6 shrink-0"
                      onClick={() => handleRemoveWordCorrection(orig)}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        {/* Controls */}
        <Card className="border-border">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">{t('outputControls')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Shield className="h-4 w-4 text-muted-foreground" />
                <Label htmlFor="pii-redaction" className="text-sm">
                  {t('piiRedaction')}
                </Label>
                <Tooltip>
                  <TooltipTrigger>
                    <Info className="h-3.5 w-3.5 text-muted-foreground" />
                  </TooltipTrigger>
                  <TooltipContent className="max-w-[200px]">
                    {t('piiRedactionTooltip')}
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
                  {t('citeTimestamps')}
                </Label>
                <Tooltip>
                  <TooltipTrigger>
                    <Info className="h-3.5 w-3.5 text-muted-foreground" />
                  </TooltipTrigger>
                  <TooltipContent className="max-w-[200px]">
                    {t('citeTimestampsTooltip')}
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

          </div>
        </div>

        {/* Sticky Footer - Save Button (backup when scrolled down) */}
        {hasChanges && (
          <div className="sticky bottom-0 left-0 right-0 shrink-0 p-3 bg-background/95 backdrop-blur border-t border-border shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)] z-10">
            <Button 
              onClick={handleSaveContext}
              disabled={isSaving}
              className="w-full"
              size="sm"
            >
              {isSaving ? (
                <>
                  <div className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-solid border-current border-r-transparent mr-2"></div>
                  {t('saving')}
                </>
              ) : (
                <>
                  <Save className="h-3.5 w-3.5 mr-2" />
                  {t('saveContext')}
                </>
              )}
            </Button>
          </div>
        )}
      </div>
    </TooltipProvider>
  )
}
