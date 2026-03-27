"use client"

export const dynamic = 'force-dynamic'

import { useState, useEffect, useRef, useCallback } from "react"
import { useTranslations, useLocale } from "next-intl"
import { useParams, useSearchParams } from "next/navigation"
import { Link, useRouter } from "@/i18n/navigation"
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
  ShieldCheck,
  MessageSquare,
  Trash2,
  Shuffle,
  ChevronRight,
  ChevronDown,
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
import { exportOutput, isPdfExportSupportedLanguage } from "@/lib/utils/output-export"
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
import type { TranscriptParseStrategy } from "@/lib/utils/transcript-parser"
import { SessionGuidanceBanner } from "@/components/session/SessionGuidanceBanner"
import { SessionProgressGuide } from "@/components/session/SessionProgressGuide"

function normalizeWordCorrections(raw: unknown): Record<string, string> {
  if (Array.isArray(raw)) {
    const map: Record<string, string> = {}
    for (const item of raw) {
      if (item && typeof item === 'object' && 'original' in item && 'corrected' in item) {
        map[String((item as Record<string, unknown>).original)] = String((item as Record<string, unknown>).corrected)
      }
    }
    return map
  }
  if (raw && typeof raw === 'object') {
    const map: Record<string, string> = {}
    for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
      if (typeof v === 'string') map[k] = v
    }
    return map
  }
  return {}
}

const SUGGESTION_AUDIENCES = ['internal', 'external', 'client', 'legal', 'executive'] as const
type SuggestionAudience = (typeof SUGGESTION_AUDIENCES)[number]
function isSuggestionAudience(value: unknown): value is SuggestionAudience {
  return typeof value === 'string' && SUGGESTION_AUDIENCES.includes(value as SuggestionAudience)
}

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
        const sentenceItems = block
          .split(/(?<=[.!?])\s+/)
          .map((s) => s.trim())
          .filter(Boolean)
        const shouldAutoList = lines.length <= 2 && block.length > 220 && sentenceItems.length >= 3
        if (shouldAutoList) {
          return (
            <ul key={i} className="list-none space-y-2 pl-0">
              {sentenceItems.slice(0, 8).map((line, j) => (
                <li key={j} className="flex gap-2">
                  <span className="text-muted-foreground shrink-0">•</span>
                  <span>{line}</span>
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

type CleanupSuggestion = {
  id: string
  type: 'speaker_merge' | 'word'
  from: string
  to: string
  confidence: number
  evidence?: string
}

export default function SessionDetailPage() {
  const params = useParams()
  const searchParams = useSearchParams()
  const router = useRouter()
  const sessionId = params.id as string
  const fromProjectId = searchParams.get('fromProject')
  const initialTab = searchParams.get('tab')
  const backHref = fromProjectId ? `/projects/${fromProjectId}` : '/sessions'
  const t = useTranslations('sessionDetail')
  const tCommon = useTranslations('common')
  const tOutputs = useTranslations('outputs')
  const tErrors = useTranslations('errors')
  const tLabels = useTranslations('labels')
  const locale = useLocale()
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
  const [activeTab, setActiveTab] = useState(initialTab && ["transcript", "context", "outputs"].includes(initialTab) ? initialTab : "transcript")
  const [isAudioPlaying, setIsAudioPlaying] = useState(false)
  const audioPlayerRef = useRef<any>(null)
  const analyzeSessionRef = useRef<((retryCount?: number) => Promise<void>) | null>(null)
  const analyzeBusyRef = useRef(false)
  
  // Participant editing state
  const [editingParticipants, setEditingParticipants] = useState(false)
  const [editedParticipants, setEditedParticipants] = useState<any[]>([])
  const [applyToTranscript, setApplyToTranscript] = useState(true)
  const [savingCorrections, setSavingCorrections] = useState(false)
  const   [generatingSuggestionIndex, setGeneratingSuggestionIndex] = useState<number | null>(null)
  const [savingOutputAsTemplate, setSavingOutputAsTemplate] = useState<string | null>(null)
  const [deletingOutputId, setDeletingOutputId] = useState<string | null>(null)
  const [retryingTranscribe, setRetryingTranscribe] = useState(false)
  const [languageMismatch, setLanguageMismatch] = useState<{ sessionLang: string; transcriptLang: string } | null>(null)
  const [updatingLanguage, setUpdatingLanguage] = useState(false)
  const [handOffOpen, setHandOffOpen] = useState(false)
  const [handOffEmail, setHandOffEmail] = useState('')
  const [handOffLoading, setHandOffLoading] = useState(false)
  const [sessionFiles, setSessionFiles] = useState<any[]>([])
  const [reparseModeIndex, setReparseModeIndex] = useState(0)
  const [reparsingTranscript, setReparsingTranscript] = useState(false)
  const [cleanupSuggestions, setCleanupSuggestions] = useState<CleanupSuggestion[]>([])
  const [loadingCleanupSuggestions, setLoadingCleanupSuggestions] = useState(false)
  const [speakerNameMap, setSpeakerNameMap] = useState<Record<string, string>>({})
  const [speakerMergeMap, setSpeakerMergeMap] = useState<Record<string, string>>({})
  const [wordCorrectionsDraft, setWordCorrectionsDraft] = useState<Record<string, string>>({})
  const [newWordFrom, setNewWordFrom] = useState('')
  const [newWordTo, setNewWordTo] = useState('')
  const [savingCleanup, setSavingCleanup] = useState(false)
  const [cleanupPanelOpen, setCleanupPanelOpen] = useState(false)
  const tPastePreview = useTranslations('pastePreview')
  const hasAudioInSession =
    Boolean(session?.audioUrl) ||
    Boolean(session?.hasAudioFile) ||
    (sessionFiles?.length || 0) > 0
  const canShowTranscriptReparseControls = !hasAudioInSession

  const reparseModes: TranscriptParseStrategy[] = ['auto', 'sprecher_zeit', 'timestamped_speaker_lines', 'plain_txt', 'raw_text']
  const reparseModeLabel: Record<TranscriptParseStrategy, string> = {
    auto: tPastePreview('parseModes.auto'),
    sprecher_zeit: tPastePreview('parseModes.sprecherZeit'),
    timestamped_speaker_lines: tPastePreview('parseModes.timestampedSpeakerLines'),
    plain_txt: tPastePreview('parseModes.plainText'),
    raw_text: tPastePreview('parseModes.rawText'),
  }

  const getOutputDisplayName = useCallback((templateName: string) => {
    const prefix = session?.filename?.trim()
    return prefix ? `${prefix} - ${templateName}` : templateName
  }, [session?.filename])

  const normalizePersonName = useCallback((value: string | null | undefined) => {
    return String(value || '')
      .toLowerCase()
      .normalize('NFKD')
      .replace(/[^\w\s'-]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
  }, [])

  const isParticipantYou = useCallback((participant: any, allParticipants: any[]) => {
    const explicitExists = allParticipants.some((p: any) => typeof p === 'object' && p?.isUser === true)
    if (explicitExists) return typeof participant === 'object' && participant?.isUser === true

    const role = typeof participant === 'object' && participant?.role
      ? String(participant.role).toLowerCase()
      : ''
    if (role) {
      if (session?.isFromCall) {
        if (role.includes('recipient') || role.includes('callee')) return true
      } else {
        if (role.includes('caller') || role.includes('initiator')) return true
      }
    }

    const participantName = normalizePersonName(typeof participant === 'string' ? participant : participant?.name)
    const userName = normalizePersonName(
      (profile as any)?.display_name ||
      (profile as any)?.full_name ||
      (profile as any)?.company_name ||
      ''
    )
    if (!participantName || !userName) return false
    return participantName === userName || userName.includes(participantName) || participantName.includes(userName)
  }, [normalizePersonName, profile, session?.isFromCall])

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

        // TODO: i18n - "Corrections saved successfully" needs a new key
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

  const loadCleanupSuggestions = useCallback(async () => {
    if (!sessionId) return
    setLoadingCleanupSuggestions(true)
    try {
      const res = await fetch(`/api/sessions/${sessionId}/cleanup-suggestions`, { cache: 'no-store' })
      if (!res.ok) throw new Error('Failed to load cleanup suggestions')
      const data = await res.json()
      setCleanupSuggestions(Array.isArray(data?.suggestions) ? data.suggestions : [])
    } catch (error) {
      console.warn('[Cleanup] Failed to load suggestions:', error)
      setCleanupSuggestions([])
    } finally {
      setLoadingCleanupSuggestions(false)
    }
  }, [sessionId])

  const getSpeakerIds = useCallback(() => {
    if (!session?.transcript?.length) return [] as string[]
    return Array.from(
      new Set(
        session.transcript
          .map((seg) => (seg.speakerId || seg.speakerName || '').trim())
          .filter(Boolean)
      )
    )
  }, [session?.transcript])

  const handleApplyCleanupSuggestion = useCallback((suggestion: CleanupSuggestion) => {
    if (suggestion.type === 'speaker_merge') {
      setSpeakerMergeMap((prev) => ({
        ...prev,
        [suggestion.from]: suggestion.to,
      }))
      toast.success(t('cleanup.suggestionApplied', { from: suggestion.from, to: suggestion.to }))
      return
    }
    if (suggestion.type === 'word') {
      setWordCorrectionsDraft((prev) => ({
        ...prev,
        [suggestion.from]: suggestion.to,
      }))
      toast.success(t('cleanup.correctionAdded', { from: suggestion.from, to: suggestion.to }))
    }
  }, [t])

  const handleSaveCleanup = useCallback(async () => {
    if (!session) return
    setSavingCleanup(true)
    try {
      const payload = {
        corrections: {
          speaker_name_map: speakerNameMap,
          speaker_merge_map: speakerMergeMap,
          word_corrections: wordCorrectionsDraft,
          accepted_suggestions: cleanupSuggestions
            .filter((s) =>
              (s.type === 'speaker_merge' && speakerMergeMap[s.from] === s.to) ||
              (s.type === 'word' && wordCorrectionsDraft[s.from] === s.to)
            )
            .map((s) => s.id),
        },
        type: 'bulk_cleanup',
      }
      const response = await fetch(`/api/sessions/${sessionId}/corrections`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(data?.error || t('cleanup.saveFailed'))

      setSession((prev) => prev ? {
        ...prev,
        transcriptCorrections: data.corrections || prev.transcriptCorrections,
      } : prev)
      toast.success(t('cleanup.saved'))
    } catch (error) {
      console.error('[Cleanup] Save failed:', error)
      toast.error(error instanceof Error ? error.message : t('cleanup.saveFailed'))
    } finally {
      setSavingCleanup(false)
    }
  }, [cleanupSuggestions, session, sessionId, speakerMergeMap, speakerNameMap, t, wordCorrectionsDraft])

  // Fetch outputs - reusable for initial load and after generation
  const fetchOutputs = useCallback(async () => {
    try {
      setOutputsLoading(true)
      const response = await fetch(`/api/outputs?sessionId=${sessionId}`, { cache: 'no-store' })
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

  const waitForJobCompletion = useCallback(async (jobId: string) => {
    const startedAt = Date.now()
    const timeoutMs = 3 * 60 * 1000
    while (Date.now() - startedAt < timeoutMs) {
      const res = await fetch(`/api/jobs/${jobId}`, { cache: 'no-store' })
      const job = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(job?.error || 'Failed to read async job status')
      if (job.status === 'completed') return job.result || {}
      if (job.status === 'failed') throw new Error(job.lastError || 'Async job failed')
      await new Promise((resolve) => setTimeout(resolve, 1200))
    }
    throw new Error('Async output generation timed out')
  }, [])

  // Generate output from AI suggestion (quick one-click)
  const handleGenerateFromSuggestion = async (suggestion: SuggestedOutputFormat, index: number) => {
    if (!session) return
    const suggestionAudience = isSuggestionAudience(suggestion.audience)
      ? suggestion.audience
      : 'internal'
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
            audience: suggestionAudience,
            language: 'session',
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
      if (data?.queued && data?.jobId) {
        await waitForJobCompletion(data.jobId)
      }
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

  const getSuggestionAudienceLabel = (audience?: SuggestedOutputFormat['audience']) => {
    const normalizedAudience = isSuggestionAudience(audience) ? audience : 'internal'
    return tLabels(`audiences.${normalizedAudience}`)
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

  const handleDeleteOutput = async (outputId: string, outputName: string) => {
    if (!confirm(`Delete output "${outputName}"?`)) return
    setDeletingOutputId(outputId)
    try {
      const response = await fetch(`/api/outputs/${outputId}`, { method: 'DELETE' })
      if (!response.ok) {
        const data = await response.json().catch(() => ({}))
        throw new Error(data.error || 'Failed to delete output')
      }
      setOutputs((prev) => prev.filter((o) => o.id !== outputId))
      toast.success(tOutputs('deleteSuccess'))
    } catch (error) {
      console.error('Delete output error:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to delete output')
    } finally {
      setDeletingOutputId(null)
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
      if (analyzeBusyRef.current) return
      analyzeBusyRef.current = true
      setAnalyzing(true)

      try {
        console.log('[AI Analysis] Starting analysis for session:', sessionId)
        const response = await fetch(`/api/sessions/${sessionId}/analyze`, {
          method: 'POST',
        })
        console.log('[AI Analysis] Response status:', response.status)

        if (response.status === 202) {
          toast.info('Analyzing session...', { id: 'analyze-progress', duration: 20000 })
          const pollDelays = [3000, 5000, 8000, 12000, 18000]
          for (const delay of pollDelays) {
            await new Promise(r => setTimeout(r, delay))
            try {
              const poll = await fetch(`/api/sessions/${sessionId}/analyze`, { method: 'POST' })
              if (poll.ok) {
                const data = await poll.json()
                applyAnalysisResult(data)
                return
              }
              if (poll.status !== 202) {
                console.warn('[AI Analysis] Poll returned', poll.status, '— stopping')
                return
              }
            } catch { /* network error, try next */ }
          }
          console.log('[AI Analysis] Polling exhausted — fetching session for cached data')
          fetchSession()
        } else if (response.ok) {
          const data = await response.json()
          applyAnalysisResult(data)
        } else if (response.status === 400 && retryCount < 3) {
          const delay = [2000, 4000, 6000][retryCount]
          console.log(`[AI Analysis] Transcript not ready (400), retrying in ${delay}ms (attempt ${retryCount + 2}/4)`)
          analyzeBusyRef.current = false
          setTimeout(() => analyzeSession(retryCount + 1), delay)
          return
        } else if (response.status === 400) {
          console.log('[AI Analysis] Transcript not ready after retries')
        } else {
          const errorData = await response.json().catch(() => ({}))
          console.warn('[AI Analysis] Failed with status:', response.status, errorData)
        }
      } catch (error) {
        console.error('[AI Analysis] Error analyzing session:', error)
      } finally {
        analyzeBusyRef.current = false
        setAnalyzing(false)
      }
    }

    function applyAnalysisResult(data: any) {
      toast.dismiss('analyze-progress')
      toast.success('Analysis complete', { duration: 3000 })
      setAnalysis(data)
      if (data.autoGeneration?.status === 'triggered') {
        toast.info('Generating output...', { duration: 3000 })
        ;[5000, 10000, 15000].forEach(d => setTimeout(() => fetchOutputs(), d))
      }
      setSession(prev => prev ? {
        ...prev,
        recordingType: data.recordingType,
        recordingTypeConfidence: data.recordingTypeConfidence,
        domains: data.domains,
        extractedContext: data.extractedContext || {},
        suggestedOutputFormats: data.suggestedOutputFormats || []
      } : null)
    }
    analyzeSessionRef.current = analyzeSession
    
    fetchSession().then((v0) => {
      if (v0?.transcript?.length) {
        setTimeout(() => analyzeSession(), 1000)
      }
    })
  }, [sessionId, fetchOutputs])

  // Poll while call is recording, uploading, or transcribing so the UI stays in sync
  useEffect(() => {
    if (!session || !['recording', 'transcribing', 'uploading', 'summarizing'].includes(session.status)) return
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

  useEffect(() => {
    if (!session) return
    const corrections = session.transcriptCorrections || {}
    const initialSpeakerNameMap = (corrections.speaker_name_map || corrections.name_corrections || {}) as Record<string, string>
    const initialSpeakerMergeMap = (corrections.speaker_merge_map || {}) as Record<string, string>
    const initialWordCorrections = normalizeWordCorrections(corrections.word_corrections)
    setSpeakerNameMap(initialSpeakerNameMap)
    setSpeakerMergeMap(initialSpeakerMergeMap)
    setWordCorrectionsDraft(initialWordCorrections)
    void loadCleanupSuggestions()
  }, [session, loadCleanupSuggestions])

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="text-center">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-current border-r-transparent"></div>
          <p className="mt-2 text-sm text-muted-foreground">{tCommon('loading')}</p>
        </div>
      </div>
    )
  }

  if (!session) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="text-center">
          <p className="text-muted-foreground">{tErrors('sessionNotFound')}</p>
          <Link href={backHref}>
            <Button variant="outline" className="mt-4">
              <ArrowLeft className="mr-2 h-4 w-4" />
              {tCommon('back')}
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
      setSession((s) => (s ? { ...s, status: 'transcribing', lastError: undefined } : s))
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to retry transcription')
    } finally {
      setRetryingTranscribe(false)
    }
  }

  const mapTranscriptToV0 = (rawJson: any[]) => {
    return (rawJson || []).map((segment: any, index: number) => ({
      id: `seg_${index}`,
      speakerId: segment.speaker || 'unknown',
      speakerName: segment.speaker || 'Unknown',
      startTime: (segment.start_ms || 0) / 1000,
      endTime: (segment.end_ms || 0) / 1000,
      text: segment.text || '',
      isPiiRedacted: false,
    }))
  }

  const handleReparseTranscript = async () => {
    setReparsingTranscript(true)
    try {
      const strategy = reparseModes[reparseModeIndex]
      const res = await fetch(`/api/sessions/${sessionId}/transcript/reparse`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ strategy }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data?.error || 'Failed to re-parse transcript')
      const updatedSegments = mapTranscriptToV0(data?.transcript?.raw_json || [])
      setSession((prev) => (prev ? { ...prev, transcript: updatedSegments } : prev))
      toast.success(`Transcript re-parsed using ${reparseModeLabel[strategy]}`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to re-parse transcript')
    } finally {
      setReparsingTranscript(false)
    }
  }

  const speakerIds = getSpeakerIds()

  const renderCleanupPanel = () => (
    <div className="mb-3 rounded-lg border border-border bg-card p-3 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          className="flex items-start gap-2 text-left"
          onClick={() => setCleanupPanelOpen((prev) => !prev)}
          aria-expanded={cleanupPanelOpen}
        >
          {cleanupPanelOpen ? (
            <ChevronDown className="h-4 w-4 mt-0.5 text-muted-foreground" />
          ) : (
            <ChevronRight className="h-4 w-4 mt-0.5 text-muted-foreground" />
          )}
          <div>
            <p className="text-sm font-semibold text-foreground">{t('cleanup.title')}</p>
            <p className="text-xs text-muted-foreground">
              {t('cleanup.description')}
            </p>
          </div>
        </button>
        <Button
          size="sm"
          variant="outline"
          onClick={() => void loadCleanupSuggestions()}
          disabled={loadingCleanupSuggestions || !cleanupPanelOpen}
        >
          {loadingCleanupSuggestions ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : t('cleanup.refresh')}
        </Button>
      </div>

      {!cleanupPanelOpen ? null : (
        <>
      {speakerIds.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground">{t('cleanup.speakers')}</p>
          <div className="space-y-2">
            {speakerIds.map((speakerId) => (
              <div key={speakerId} className="grid grid-cols-1 sm:grid-cols-3 gap-2 items-center">
                <Badge variant="outline" className="w-fit">{speakerId}</Badge>
                <Input
                  value={speakerNameMap[speakerId] || ''}
                  onChange={(e) => setSpeakerNameMap((prev) => ({ ...prev, [speakerId]: e.target.value }))}
                  placeholder={t('cleanup.displayNamePlaceholder', { speakerId })}
                />
                <select
                  className="h-9 rounded-md border border-input bg-background px-2 text-sm"
                  value={speakerMergeMap[speakerId] || ''}
                  onChange={(e) => {
                    const value = e.target.value
                    setSpeakerMergeMap((prev) => {
                      const next = { ...prev }
                      if (!value) delete next[speakerId]
                      else next[speakerId] = value
                      return next
                    })
                  }}
                >
                  <option value="">{t('cleanup.doNotMerge')}</option>
                  {speakerIds.filter((id) => id !== speakerId).map((id) => (
                    <option key={id} value={id}>{t('cleanup.mergeInto', { speakerId: id })}</option>
                  ))}
                </select>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="space-y-2">
        <p className="text-xs font-medium text-muted-foreground">{t('cleanup.wordCorrections')}</p>
        <div className="grid grid-cols-1 sm:grid-cols-[1fr_1fr_auto] gap-2">
          <Input value={newWordFrom} onChange={(e) => setNewWordFrom(e.target.value)} placeholder={t('cleanup.from')} />
          <Input value={newWordTo} onChange={(e) => setNewWordTo(e.target.value)} placeholder={t('cleanup.to')} />
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              const from = newWordFrom.trim()
              const to = newWordTo.trim()
              if (!from || !to) return
              setWordCorrectionsDraft((prev) => ({ ...prev, [from]: to }))
              setNewWordFrom('')
              setNewWordTo('')
            }}
          >
            {t('cleanup.add')}
          </Button>
        </div>
        {Object.keys(wordCorrectionsDraft).length > 0 && (
          <div className="space-y-1 max-h-28 overflow-y-auto pr-1">
            {Object.entries(wordCorrectionsDraft).map(([from, to]) => (
              <div key={from} className="flex items-center justify-between text-xs rounded border border-border px-2 py-1">
                <span className="truncate">{from}{' -> '}{to}</span>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-6 px-2"
                  onClick={() => {
                    setWordCorrectionsDraft((prev) => {
                      const next = { ...prev }
                      delete next[from]
                      return next
                    })
                  }}
                >
                  <X className="h-3 w-3" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="space-y-2">
        <p className="text-xs font-medium text-muted-foreground">{t('cleanup.suggestions')}</p>
        {cleanupSuggestions.length === 0 ? (
          <p className="text-xs text-muted-foreground">{t('cleanup.noSuggestions')}</p>
        ) : (
          <div className="space-y-1 max-h-40 overflow-y-auto pr-1">
            {cleanupSuggestions.map((s) => (
              <div key={s.id} className="rounded border border-border px-2 py-1.5 text-xs">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium">
                    {s.type === 'speaker_merge'
                      ? t('cleanup.mergeSuggestionLabel', { from: s.from, to: s.to })
                      : t('cleanup.wordSuggestionLabel', { from: s.from, to: s.to })}
                  </span>
                  <Button size="sm" variant="outline" className="h-6 px-2" onClick={() => handleApplyCleanupSuggestion(s)}>
                    {t('cleanup.apply')}
                  </Button>
                </div>
                <p className="text-muted-foreground mt-0.5">
                  {t('cleanup.confidence', { percent: Math.round(s.confidence * 100) })}{s.evidence ? ` · ${s.evidence}` : ''}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="flex justify-end">
        <Button size="sm" onClick={() => void handleSaveCleanup()} disabled={savingCleanup}>
          {savingCleanup ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : null}
          {t('cleanup.applyCleanup')}
        </Button>
      </div>
      </>
      )}
    </div>
  )

  return (
    <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between pb-4 border-b border-border shrink-0">
        <div className="flex items-center gap-3">
          <Link href={backHref}>
            <Button variant="ghost" size="sm" className="gap-1.5">
              <ArrowLeft className="h-4 w-4" />
              <span className="hidden sm:inline">{tCommon('back')}</span>
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
            {/* TODO: i18n - "Session Review" needs a new key */}
            <p className="text-xs text-muted-foreground">
              Session Review
            </p>
          </div>
        </div>
        {session.status === 'failed' && session.lastError ? (() => {
          const err = session.lastError.toLowerCase()
          const isRetryable = !err.includes('too short') && !err.includes('no speech') && !err.includes('no usable speech') && !err.includes('not supported') && !err.includes('format')
          return (
            <div className="flex flex-col sm:flex-row sm:items-center gap-2 w-full max-w-md rounded-lg border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm overflow-hidden">
              <span className="text-destructive flex-1 min-w-0 break-words">{session.lastError}</span>
              {isRetryable && (session.audioUrl || isAdmin) ? (
                <Button size="sm" variant="outline" className="shrink-0 self-end sm:self-auto" onClick={handleRetryTranscription} disabled={retryingTranscribe}>
                  {retryingTranscribe ? <Loader2 className="h-4 w-4 animate-spin" /> : tCommon('retry')}
                </Button>
              ) : null}
            </div>
          )
        })() : null}
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
              {/* TODO: i18n - "Hand off" needs a new key */}
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

      {/* Audio file name is shown inside the AudioPlayer component */}

      {/* Language mismatch banner */}
      {languageMismatch && (() => {
        const langNames: Record<string, string> = {
          auto: 'Auto', de: 'German', en: 'English', fr: 'French', es: 'Spanish',
          it: 'Italian', pt: 'Portuguese', nl: 'Dutch', pl: 'Polish',
        }
        const sessionLabel = langNames[languageMismatch.sessionLang] || languageMismatch.sessionLang.toUpperCase()
        const transcriptLabel = langNames[languageMismatch.transcriptLang] || languageMismatch.transcriptLang.toUpperCase()
        return (
          <div className="flex items-center gap-3 rounded-lg border border-info/40 bg-info/10 px-4 py-2.5 text-sm mt-3 shrink-0">
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
              title="Dismiss"
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
            {/* TODO: i18n - "Hand off session" needs a new key */}
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
              {tCommon('cancel')}
            </Button>
            <Button onClick={handleHandOff} disabled={!handOffEmail.trim() || handOffLoading}>
              {/* TODO: i18n - "Hand off" button needs a new key */}
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
              {t('transcript')}
            </Button>
            <Button
              variant={activeTab === "context" ? "default" : "ghost"}
              className="w-full justify-start gap-2 px-3"
              onClick={() => setActiveTab("context")}
            >
              <Settings2 className="h-4 w-4" />
              {t('context')}
            </Button>
            <Button
              variant={activeTab === "outputs" ? "default" : "ghost"}
              className="w-full justify-start gap-2 px-3"
              onClick={() => setActiveTab("outputs")}
            >
              <FileText className="h-4 w-4" />
              {t('outputs')}
            </Button>
          </div>
        </div>

        {/* Mobile Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col min-h-0 md:hidden">
          <TabsList className="grid w-full grid-cols-3 mb-4 shrink-0">
            <TabsTrigger value="transcript">{t('transcript')}</TabsTrigger>
            <TabsTrigger value="context">{t('context')}</TabsTrigger>
            <TabsTrigger value="outputs">{t('outputs')}</TabsTrigger>
          </TabsList>

          {/* Mobile: first-time onboarding guide above all tabs */}
          <SessionProgressGuide
            hasTranscript={Boolean(session?.transcript?.length)}
            hasAnalysis={Boolean(session?.recordingType)}
            hasOutputs={outputs.length > 0}
            activeTab={activeTab}
            onSwitchTab={setActiveTab}
          />

          <TabsContent value="transcript" className="mt-0 flex-1 min-h-0 data-[state=inactive]:hidden">
            <SessionGuidanceBanner
              activeTab={activeTab}
              sessionStatus={session?.status}
              hasAnalysis={Boolean(session?.recordingType)}
              analyzing={analyzing}
              hasOutputs={outputs.length > 0}
              onSwitchTab={setActiveTab}
            />
            {canShowTranscriptReparseControls && (
              <div className="mb-2 flex items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setReparseModeIndex((i) => (i + 1) % reparseModes.length)}
                  disabled={reparsingTranscript}
                >
                  <Shuffle className="h-3.5 w-3.5 mr-1.5" />
                  {tPastePreview('tryNextParse')}: {reparseModeLabel[reparseModes[reparseModeIndex]]}
                </Button>
                <Button size="sm" onClick={handleReparseTranscript} disabled={reparsingTranscript}>
                  {reparsingTranscript ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : null}
                  Apply
                </Button>
              </div>
            )}
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
          <TabsContent value="context" className="mt-0 flex-1 min-h-0 data-[state=inactive]:hidden">
            <div className="h-full overflow-y-auto rounded-lg border border-border bg-card p-6">
              <div className="space-y-6">
                <SessionGuidanceBanner
                  activeTab={activeTab}
                  sessionStatus={session?.status}
                  hasAnalysis={Boolean(session?.recordingType)}
                  analyzing={analyzing}
                  hasOutputs={outputs.length > 0}
                  onSwitchTab={setActiveTab}
                />
                {/* In-context AI analysis indicator */}
                {analyzing && (
                  <div className="flex items-center gap-2 p-4 rounded-lg bg-primary/10 border border-primary/20">
                    <Loader2 className="h-5 w-5 animate-spin text-primary shrink-0" />
                    {/* TODO: i18n - "Analyzing transcript..." / "Extracting participants, purpose, and context" need new keys */}
                    <p className="text-sm font-medium text-foreground">Analyzing transcript...</p>
                    <p className="text-xs text-muted-foreground">Extracting participants, purpose, and context</p>
                  </div>
                )}
                {/* Recording date/time from audio metadata */}
                {session?.recordedAt && (
                  <div className="space-y-3">
                    <h3 className="text-sm font-semibold text-foreground">{t('recordedAt')}</h3>
                    <div className="p-3 rounded-lg bg-secondary/50">
                      <p className="text-sm text-foreground">{formatDetailDate(session.recordedAt)}</p>
                      {/* TODO: i18n - "From audio file metadata" needs a new key */}
                      <p className="text-xs text-muted-foreground mt-0.5">From audio file metadata</p>
                    </div>
                  </div>
                )}
                {/* Speechmatics Summary */}
                {session?.speechmaticsSummary && (
                  <div className="space-y-3">
                    <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                      <Sparkles className="h-4 w-4" />
                      {t('summary')}
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
                    {/* TODO: i18n - "Recording Classification" needs a new key */}
                    Recording Classification
                  </h3>
                  <div className="space-y-2">
                    {session?.recordingType && (
                      <div className="flex items-center p-3 rounded-lg bg-secondary/50">
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
                    <h3 className="text-sm font-semibold text-foreground">{t('context')}</h3>
                    
                    {session.extractedContext.participants?.length > 0 && (
                      <div className="space-y-2">
                        <p className="text-xs font-medium text-muted-foreground">{t('speakers')}</p>
                        <div className="text-sm p-3 rounded-lg bg-secondary/50 space-y-1.5">
                          {(session.extractedContext.participants || []).map((participant: any, idx: number) => {
                            const name = typeof participant === 'string' ? participant : participant.name
                            const role = typeof participant === 'object' && participant.role ? participant.role : null
                            const isUser = isParticipantYou(participant, session?.extractedContext?.participants || [])
                            
                            return (
                              <div key={idx} className="flex items-center gap-2 flex-wrap">
                                <span className="text-foreground font-medium">{name}</span>
                                {/* TODO: i18n - "You" badge needs common.you key */}
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
                        <p className="text-xs font-medium text-muted-foreground">{t('purpose')}</p>
                        <p className="text-sm text-foreground p-3 rounded-lg bg-secondary/50">
                          {session.extractedContext.purpose}
                        </p>
                      </div>
                    )}

                    {session.extractedContext.agenda?.length > 0 && (
                      <div className="space-y-2">
                        {/* TODO: i18n - "Agenda" needs a new key */}
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
                        {/* TODO: i18n - "Venue" needs a new key */}
                        <p className="text-xs font-medium text-muted-foreground">Venue</p>
                        <p className="text-sm text-foreground p-3 rounded-lg bg-secondary/50">
                          {session.extractedContext.venue}
                        </p>
                      </div>
                    )}

                    {session.extractedContext.consent && session.extractedContext.consent.discussed && (
                      <div className="space-y-2">
                        <p className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                          <ShieldCheck className="h-3.5 w-3.5" />
                          {t('consent')}
                        </p>
                        <div className="text-sm p-3 rounded-lg bg-secondary/50 space-y-1.5">
                          {session.extractedContext.consent.summary && (
                            <p className="text-foreground">{session.extractedContext.consent.summary}</p>
                          )}
                          {session.extractedContext.consent.participantsConsented && session.extractedContext.consent.participantsConsented.length > 0 && (
                            <p className="text-xs text-muted-foreground">
                              {/* TODO: i18n - "Consented:" needs a new key */}
                              Consented: {session.extractedContext.consent.participantsConsented.join(", ")}
                            </p>
                          )}
                        </div>
                      </div>
                    )}

                    {session.extractedContext.spokenCommands && session.extractedContext.spokenCommands.length > 0 && (
                      <div className="space-y-2">
                        <p className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                          <MessageSquare className="h-3.5 w-3.5" />
                          {/* TODO: i18n - "Spoken Commands" needs a new key */}
                          Spoken Commands
                        </p>
                        <div className="text-sm p-3 rounded-lg bg-secondary/50 space-y-2">
                          {session.extractedContext.spokenCommands.map((cmd: any, idx: number) => (
                            <div key={idx} className="space-y-0.5">
                              <p className="text-foreground">&ldquo;{cmd.phrase}&rdquo;</p>
                              <div className="flex items-center gap-2">
                                <span className="text-xs text-muted-foreground">{cmd.speaker}</span>
                                {cmd.intentSummary && <span className="text-xs text-muted-foreground">· {cmd.intentSummary}</span>}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* In-Call Consent Logs (from consent dialog button) */}
                {session?.consentLogs && session.consentLogs.length > 0 && (
                  <div className="space-y-3">
                    <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                      <ShieldCheck className="h-4 w-4" />
                      {t('consent')}
                    </h3>
                    <div className="text-sm p-3 rounded-lg bg-secondary/50 space-y-2">
                      {session.consentLogs.map((log: any, idx: number) => (
                        <div key={idx} className="flex items-center justify-between gap-2">
                          <div className="min-w-0">
                            {/* TODO: i18n - "Participant" fallback needs a new key */}
                            <span className="text-foreground">{log.participant_name || log.participant_identity || "Participant"}</span>
                            {log.created_at && (
                              <p className="text-[10px] text-muted-foreground">
                                {new Date(log.created_at).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                              </p>
                            )}
                          </div>
                          <Badge variant={log.granted ? "default" : "outline"} className={cn("shrink-0", log.granted ? "bg-success/20 text-success border-0" : "bg-destructive/20 text-destructive border-0")}>
                            {log.granted ? t('agreed') : t('declined')}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* No Context Available */}
                {!analyzing && !session?.recordingType && !session?.domain && !session?.extractedContext && !((session?.consentLogs ?? []).length > 0) && (
                  <div className="text-center py-8">
                    <Settings2 className="h-8 w-8 text-muted-foreground/50 mx-auto mb-3" />
                    {/* TODO: i18n - "No context extracted yet" / "Context will appear..." need new keys */}
                    <p className="text-sm text-muted-foreground mb-2">No context extracted yet</p>
                    <p className="text-xs text-muted-foreground">
                      Context will appear after AI analysis completes
                    </p>
                  </div>
                )}
              </div>
            </div>
          </TabsContent>
          <TabsContent value="outputs" className="mt-0 flex-1 min-h-0 data-[state=inactive]:hidden overflow-hidden">
            <div className="h-full overflow-y-auto overflow-x-hidden rounded-lg border border-border bg-card p-4 space-y-6">
              <SessionGuidanceBanner
                activeTab={activeTab}
                sessionStatus={session?.status}
                hasAnalysis={Boolean(session?.recordingType)}
                analyzing={analyzing}
                hasOutputs={outputs.length > 0}
                onSwitchTab={setActiveTab}
              />
              {/* Suggested for this session */}
              {session?.suggestedOutputFormats && session.suggestedOutputFormats.length > 0 && (
                <div className="space-y-3">
                  <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-primary" />
                    {t('suggestedFormats')}
                  </h3>
                  {/* TODO: i18n - "Based on this conversation's topic and domain" needs a new key */}
                  <p className="text-xs text-muted-foreground">Based on this conversation&apos;s topic and domain</p>
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {session.suggestedOutputFormats.map((suggestion, idx) => (
                      <div
                        key={idx}
                        className="p-4 rounded-lg border border-border bg-secondary/30 hover:border-primary/30 transition-colors flex flex-col gap-2 overflow-hidden min-w-0"
                      >
                        <h4 className="text-sm font-medium text-foreground break-words line-clamp-2">{suggestion.title}</h4>
                        <div>
                          <Badge variant="secondary" className="text-[10px]">
                            {getSuggestionAudienceLabel(suggestion.audience)}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground flex-1 break-words line-clamp-3">
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
                              {/* TODO: i18n - "Generating..." needs a new key */}
                              Generating...
                            </>
                          ) : (
                            t('generateOutput')
                          )}
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {/* Your outputs */}
              {outputsLoading ? (
                <p className="text-sm text-muted-foreground">{tOutputs('loadingOutputs')}</p>
              ) : outputs.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 gap-4">
                  <p className="text-sm text-muted-foreground text-center">
                    {t('noOutputs')}
                  </p>
                  <Button size="sm" onClick={() => { setSelectedTemplateId(null); setGenerateModalOpen(true) }}>
                    {t('generateOutput')}
                  </Button>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="text-sm font-semibold text-foreground">{t('outputs')}</h3>
                    <Button size="sm" variant="outline" onClick={() => { setSelectedTemplateId(null); setGenerateModalOpen(true) }}>
                      <LayoutTemplate className="h-3.5 w-3.5 mr-1.5" />
                      {t('generateOutput')}
                    </Button>
                  </div>
                  {outputs.map((output) => {
                    const outputDisplayName = getOutputDisplayName(output.templateName)
                    return (
                    <div key={output.id} className="p-4 border border-border rounded-lg hover:border-muted-foreground/50 transition-colors group">
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex-1 min-w-0">
                          <h4 className="text-sm font-medium break-words line-clamp-2">{outputDisplayName}</h4>
                          <p className="text-xs text-muted-foreground flex items-center gap-2">
                            <span>
                              {new Date(output.createdAt).toLocaleDateString(locale, { 
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
                            title={tCommon('save')}
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
                                toast.success(tOutputs('copySuccess'))
                              } catch (err) {
                                toast.error(tOutputs('copyFailed'))
                              }
                            }}
                            title={tCommon('copy')}
                          >
                            <Copy className="h-3.5 w-3.5" />
                          </Button>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-7 w-7" title={tCommon('download')}>
                                <Download className="h-3.5 w-3.5" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => { exportOutput(output.content, outputDisplayName, 'md').then(() => toast.success(tCommon('download'))); }}>
                                MD
                              </DropdownMenuItem>
                              {isPdfExportSupportedLanguage(output.language) && (
                                <DropdownMenuItem onClick={() => { exportOutput(output.content, outputDisplayName, 'pdf').then(() => toast.success(tCommon('download'))); }}>
                                  PDF
                                </DropdownMenuItem>
                              )}
                              <DropdownMenuItem onClick={() => { exportOutput(output.content, outputDisplayName, 'docx').then(() => toast.success(tCommon('download'))); }}>
                                DOCX
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            asChild
                            title={tOutputs('open')}
                          >
                            <Link href={`/outputs/${output.id}?from=${encodeURIComponent(`/sessions/${sessionId}`)}`}>
                              <ExternalLink className="h-3.5 w-3.5" />
                            </Link>
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-destructive hover:text-destructive hover:bg-destructive/10"
                            onClick={() => handleDeleteOutput(output.id, outputDisplayName || 'Output')}
                            disabled={deletingOutputId === output.id}
                            title={tCommon('delete')}
                          >
                            {deletingOutputId === output.id ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <Trash2 className="h-3.5 w-3.5" />
                            )}
                          </Button>
                        </div>
                      </div>
                      <p className="text-xs text-muted-foreground line-clamp-2">{output.content.substring(0, 150)}...</p>
                    </div>
                  )})}
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
              fileName={sessionFiles[0]?.storage_path?.split('/').pop()}
              onTimeUpdate={setCurrentAudioTime}
              onPlayStateChange={setIsAudioPlaying}
              showDownload={isAdmin}
            />
          )}
          
          {/* First-time session onboarding guide */}
          <SessionProgressGuide
            hasTranscript={Boolean(session?.transcript?.length)}
            hasAnalysis={Boolean(session?.recordingType)}
            hasOutputs={outputs.length > 0}
            activeTab={activeTab}
            onSwitchTab={setActiveTab}
          />

          {/* Tab Content */}
          {activeTab === "transcript" && (
            <div className="flex-1 min-h-0 flex flex-col">
              <SessionGuidanceBanner
                activeTab={activeTab}
                sessionStatus={session?.status}
                hasAnalysis={Boolean(session?.recordingType)}
                analyzing={analyzing}
                hasOutputs={outputs.length > 0}
                onSwitchTab={setActiveTab}
              />
              {renderCleanupPanel()}
              {canShowTranscriptReparseControls && (
                <div className="mb-2 flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setReparseModeIndex((i) => (i + 1) % reparseModes.length)}
                    disabled={reparsingTranscript}
                  >
                    <Shuffle className="h-3.5 w-3.5 mr-1.5" />
                    {tPastePreview('tryNextParse')}: {reparseModeLabel[reparseModes[reparseModeIndex]]}
                  </Button>
                  <Button size="sm" onClick={handleReparseTranscript} disabled={reparsingTranscript}>
                    {reparsingTranscript ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : null}
                    Apply
                  </Button>
                </div>
              )}
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
            </div>
          )}

          {activeTab === "context" && (
            <div className="flex-1 rounded-lg border border-border bg-card overflow-auto p-6">
              <div className="space-y-6">
                <SessionGuidanceBanner
                  activeTab={activeTab}
                  sessionStatus={session?.status}
                  hasAnalysis={Boolean(session?.recordingType)}
                  analyzing={analyzing}
                  hasOutputs={outputs.length > 0}
                  onSwitchTab={setActiveTab}
                />
                {/* In-context AI analysis indicator */}
                {analyzing && (
                  <div className="flex items-center gap-2 p-4 rounded-lg bg-primary/10 border border-primary/20">
                    <Loader2 className="h-5 w-5 animate-spin text-primary shrink-0" />
                    {/* TODO: i18n - "Analyzing transcript..." / "Extracting participants, purpose, and context" need new keys */}
                    <p className="text-sm font-medium text-foreground">Analyzing transcript...</p>
                    <p className="text-xs text-muted-foreground">Extracting participants, purpose, and context</p>
                  </div>
                )}
                {/* Recording date/time from audio metadata */}
                {session?.recordedAt && (
                  <div className="space-y-3">
                    <h3 className="text-sm font-semibold text-foreground">{t('recordedAt')}</h3>
                    <div className="p-3 rounded-lg bg-secondary/50">
                      <p className="text-sm text-foreground">{formatDetailDate(session.recordedAt)}</p>
                      {/* TODO: i18n - "From audio file metadata" needs a new key */}
                      <p className="text-xs text-muted-foreground mt-0.5">From audio file metadata</p>
                    </div>
                  </div>
                )}
                {/* Speechmatics Summary */}
                {session?.speechmaticsSummary && (
                  <div className="space-y-3">
                    <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                      <Sparkles className="h-4 w-4" />
                      {t('summary')}
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
                    {/* TODO: i18n - "Recording Classification" needs a new key */}
                    Recording Classification
                  </h3>
                  <div className="space-y-2">
                    {session?.recordingType && (
                      <div className="flex items-center p-3 rounded-lg bg-secondary/50">
                        <Badge variant="outline" className="capitalize">
                          {session.recordingType.replace(/_/g, ' ')}
                        </Badge>
                      </div>
                    )}
                    {session?.domains && session.domains.length > 0 && (
                      <div className="space-y-2">
                        {/* TODO: i18n - "Domains" needs a new key */}
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
                    <h3 className="text-sm font-semibold text-foreground">{t('context')}</h3>
                    
                    {session.extractedContext.participants?.length > 0 && (
                      <div className="space-y-2">
                        <p className="text-xs font-medium text-muted-foreground">{t('speakers')}</p>
                        <div className="text-sm p-3 rounded-lg bg-secondary/50 space-y-1.5">
                          {(session.extractedContext.participants || []).map((participant: any, idx: number) => {
                            const name = typeof participant === 'string' ? participant : participant.name
                            const role = typeof participant === 'object' && participant.role ? participant.role : null
                            const isUser = isParticipantYou(participant, session?.extractedContext?.participants || [])
                            
                            return (
                              <div key={idx} className="flex items-center gap-2 flex-wrap">
                                <span className="text-foreground font-medium">{name}</span>
                                {/* TODO: i18n - "You" badge needs common.you key */}
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
                        <p className="text-xs font-medium text-muted-foreground">{t('purpose')}</p>
                        <p className="text-sm text-foreground p-3 rounded-lg bg-secondary/50">
                          {session.extractedContext.purpose}
                        </p>
                      </div>
                    )}

                    {session.extractedContext.agenda?.length > 0 && (
                      <div className="space-y-2">
                        {/* TODO: i18n - "Agenda" needs a new key */}
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
                        {/* TODO: i18n - "Venue" needs a new key */}
                        <p className="text-xs font-medium text-muted-foreground">Venue</p>
                        <p className="text-sm text-foreground p-3 rounded-lg bg-secondary/50">
                          {session.extractedContext.venue}
                        </p>
                      </div>
                    )}

                    {session.extractedContext.consent && session.extractedContext.consent.discussed && (
                      <div className="space-y-2">
                        <p className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                          <ShieldCheck className="h-3.5 w-3.5" />
                          {t('consent')}
                        </p>
                        <div className="text-sm p-3 rounded-lg bg-secondary/50 space-y-1.5">
                          {session.extractedContext.consent.summary && (
                            <p className="text-foreground">{session.extractedContext.consent.summary}</p>
                          )}
                          {session.extractedContext.consent.participantsConsented && session.extractedContext.consent.participantsConsented.length > 0 && (
                            <p className="text-xs text-muted-foreground">
                              {/* TODO: i18n - "Consented:" needs a new key */}
                              Consented: {session.extractedContext.consent.participantsConsented.join(", ")}
                            </p>
                          )}
                        </div>
                      </div>
                    )}

                    {session.extractedContext.spokenCommands && session.extractedContext.spokenCommands.length > 0 && (
                      <div className="space-y-2">
                        <p className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                          <MessageSquare className="h-3.5 w-3.5" />
                          {/* TODO: i18n - "Spoken Commands" needs a new key */}
                          Spoken Commands
                        </p>
                        <div className="text-sm p-3 rounded-lg bg-secondary/50 space-y-2">
                          {session.extractedContext.spokenCommands.map((cmd: any, idx: number) => (
                            <div key={idx} className="space-y-0.5">
                              <p className="text-foreground">&ldquo;{cmd.phrase}&rdquo;</p>
                              <div className="flex items-center gap-2">
                                <span className="text-xs text-muted-foreground">{cmd.speaker}</span>
                                {cmd.intentSummary && <span className="text-xs text-muted-foreground">· {cmd.intentSummary}</span>}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* In-Call Consent Logs (from consent dialog button) */}
                {session?.consentLogs && session.consentLogs.length > 0 && (
                  <div className="space-y-3">
                    <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                      <ShieldCheck className="h-4 w-4" />
                      {t('consent')}
                    </h3>
                    <div className="text-sm p-3 rounded-lg bg-secondary/50 space-y-2">
                      {session.consentLogs.map((log: any, idx: number) => (
                        <div key={idx} className="flex items-center justify-between gap-2">
                          <div className="min-w-0">
                            {/* TODO: i18n - "Participant" fallback needs a new key */}
                            <span className="text-foreground">{log.participant_name || log.participant_identity || "Participant"}</span>
                            {log.created_at && (
                              <p className="text-[10px] text-muted-foreground">
                                {new Date(log.created_at).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                              </p>
                            )}
                          </div>
                          <Badge variant={log.granted ? "default" : "outline"} className={cn("shrink-0", log.granted ? "bg-success/20 text-success border-0" : "bg-destructive/20 text-destructive border-0")}>
                            {log.granted ? t('agreed') : t('declined')}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* No Context Available */}
                {!analyzing && !session?.recordingType && !session?.domain && !session?.extractedContext && !((session?.consentLogs ?? []).length > 0) && (
                  <div className="text-center py-8">
                    <Settings2 className="h-8 w-8 text-muted-foreground/50 mx-auto mb-3" />
                    {/* TODO: i18n - "No context extracted yet" / "Context will appear..." need new keys */}
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
            <div className="flex-1 rounded-lg border border-border bg-card overflow-y-auto overflow-x-hidden p-4 space-y-6">
              <SessionGuidanceBanner
                activeTab={activeTab}
                sessionStatus={session?.status}
                hasAnalysis={Boolean(session?.recordingType)}
                analyzing={analyzing}
                hasOutputs={outputs.length > 0}
                onSwitchTab={setActiveTab}
              />
              {/* Suggested for this session */}
              {session?.suggestedOutputFormats && session.suggestedOutputFormats.length > 0 && (
                <div className="space-y-3">
                  <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-primary" />
                    {t('suggestedFormats')}
                  </h3>
                  {/* TODO: i18n - "Based on this conversation's topic and domain" needs a new key */}
                  <p className="text-xs text-muted-foreground">Based on this conversation&apos;s topic and domain</p>
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {session.suggestedOutputFormats.map((suggestion, idx) => (
                      <div
                        key={idx}
                        className="p-4 rounded-lg border border-border bg-secondary/30 hover:border-primary/30 transition-colors flex flex-col gap-2 overflow-hidden min-w-0"
                      >
                        <h4 className="text-sm font-medium text-foreground break-words line-clamp-2">{suggestion.title}</h4>
                        <div>
                          <Badge variant="secondary" className="text-[10px]">
                            {getSuggestionAudienceLabel(suggestion.audience)}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground flex-1 break-words line-clamp-3">
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
                              {/* TODO: i18n - "Generating..." needs a new key */}
                              Generating...
                            </>
                          ) : (
                            t('generateOutput')
                          )}
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {/* Your outputs */}
              {outputsLoading ? (
                <p className="text-sm text-muted-foreground">{tOutputs('loadingOutputs')}</p>
              ) : outputs.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 gap-4">
                  <p className="text-sm text-muted-foreground text-center">
                    {t('noOutputs')}
                  </p>
                  <Button size="sm" onClick={() => { setSelectedTemplateId(null); setGenerateModalOpen(true) }}>
                    {t('generateOutput')}
                  </Button>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="text-sm font-semibold text-foreground">{t('outputs')}</h3>
                    <Button size="sm" variant="outline" onClick={() => { setSelectedTemplateId(null); setGenerateModalOpen(true) }}>
                      <LayoutTemplate className="h-3.5 w-3.5 mr-1.5" />
                      {t('generateOutput')}
                    </Button>
                  </div>
                  {outputs.map((output) => {
                    const outputDisplayName = getOutputDisplayName(output.templateName)
                    return (
                    <div key={output.id} className="p-4 border border-border rounded-lg hover:border-muted-foreground/50 transition-colors group">
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex-1 min-w-0">
                          <h4 className="text-sm font-medium break-words line-clamp-2">{outputDisplayName}</h4>
                          <p className="text-xs text-muted-foreground flex items-center gap-2">
                            <span>
                              {new Date(output.createdAt).toLocaleDateString(locale, { 
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
                            title={tCommon('save')}
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
                                toast.success(tOutputs('copySuccess'))
                              } catch (err) {
                                toast.error(tOutputs('copyFailed'))
                              }
                            }}
                            title={tCommon('copy')}
                          >
                            <Copy className="h-3.5 w-3.5" />
                          </Button>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-7 w-7" title={tCommon('download')}>
                                <Download className="h-3.5 w-3.5" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => { exportOutput(output.content, outputDisplayName, 'md').then(() => toast.success(tCommon('download'))); }}>
                                MD
                              </DropdownMenuItem>
                              {isPdfExportSupportedLanguage(output.language) && (
                                <DropdownMenuItem onClick={() => { exportOutput(output.content, outputDisplayName, 'pdf').then(() => toast.success(tCommon('download'))); }}>
                                  PDF
                                </DropdownMenuItem>
                              )}
                              <DropdownMenuItem onClick={() => { exportOutput(output.content, outputDisplayName, 'docx').then(() => toast.success(tCommon('download'))); }}>
                                DOCX
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            asChild
                            title={tOutputs('open')}
                          >
                            <Link href={`/outputs/${output.id}?from=${encodeURIComponent(`/sessions/${sessionId}`)}`}>
                              <ExternalLink className="h-3.5 w-3.5" />
                            </Link>
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-destructive hover:text-destructive hover:bg-destructive/10"
                            onClick={() => handleDeleteOutput(output.id, outputDisplayName || 'Output')}
                            disabled={deletingOutputId === output.id}
                            title={tCommon('delete')}
                          >
                            {deletingOutputId === output.id ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <Trash2 className="h-3.5 w-3.5" />
                            )}
                          </Button>
                        </div>
                      </div>
                      <p className="text-xs text-muted-foreground line-clamp-2">{output.content.substring(0, 150)}...</p>
                    </div>
                  )})}
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
