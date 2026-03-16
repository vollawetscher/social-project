"use client"

export const dynamic = 'force-dynamic'

import React from "react"
import { useState, useCallback, useRef, useEffect, useMemo } from "react"
import { useSearchParams } from "next/navigation"
import { Link, usePathname, useRouter } from "@/i18n/navigation"
import { useTranslations } from "next-intl"
import { toast } from "sonner"
import { createClient } from "@/lib/supabase/client"
import { useAuth } from "@/lib/auth/AuthProvider"
import {
  Upload,
  Mic,
  ChevronDown,
  ChevronRight,
  Clock,
  Globe,
  Shield,
  WifiOff,
  MoreHorizontal,
  Trash2,
  Download,
  Eye,
  Search,
  Check,
  X,
  Pencil,
  FileText,
  FileAudio,
  Video,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { UploadPreviewSheet } from "@/components/upload/UploadPreviewSheet"
import { PastePreviewSheet } from "@/components/upload/PastePreviewSheet"
import { getStorageMimeType } from "@/lib/utils/audio-format-detector"
import { uploadToStorage } from "@/lib/utils/resumable-upload"
import { parseTranscriptFile, cleanPastedContent } from "@/lib/utils/transcript-parser"
import { formatDuration } from "@/lib/utils/date-formatters"
import type { SessionStatus, Session } from "@/lib/types-v0"
import { cn } from "@/lib/utils"

type StatusDisplay = { labelKey: string; variant: "default" | "secondary" | "destructive" | "outline"; className?: string; animated?: boolean }
type CombineSuggestion = {
  sessionIds: string[]
  baseName: string
  count: number
  totalDuration: number | null
  sessionNames: string[]
  signature: string
}

const statusConfig: Record<SessionStatus, StatusDisplay> = {
  recording: { labelKey: "recording", variant: "secondary", className: "bg-primary/20 text-primary border-primary/30 animate-pulse", animated: true },
  uploading: { labelKey: "uploading", variant: "secondary", className: "bg-info/20 text-info border-info/30 animate-pulse", animated: true },
  transcribing: { labelKey: "transcribing", variant: "secondary", className: "bg-warning/20 text-warning border-warning/30 animate-pulse", animated: true },
  ready: { labelKey: "ready", variant: "default", className: "bg-success/20 text-success border-success/30" },
  failed: { labelKey: "failed", variant: "destructive" },
}

function getStatusDisplay(session: Session): StatusDisplay {
  return statusConfig[session.status as SessionStatus]
}

function isProcessing(session: Session): boolean {
  return session.status === 'recording' || session.status === 'uploading' || session.status === 'transcribing'
}

function formatFileSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`
}

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

type SessionOriginKind = "call" | "quick_record" | "audio_upload" | "text_import"

function getSessionOriginKind(session: Session): SessionOriginKind {
  if (session.isFromCall) return "call"

  const hint = session.inputHint
  if (hint === 'phone_call' || hint === 'video_call') return "call"
  if (hint === 'quick_record' || hint === 'voice_note') return "quick_record"
  if (hint === 'meeting' || hint === 'presentation' || hint === 'trade_show') return "audio_upload"

  // Fallback for sessions without input_hint (AI-detected recording type)
  if (session.recordingType === 'call_inbound' || session.recordingType === 'call_outbound'
      || session.recordingType === 'sales_call') return "call"
  if (session.recordingType === 'dictation') return "quick_record"

  // Last resort: inspect whether any audio/video file is attached
  if (session.hasAudioFile) return "audio_upload"
  return "text_import"
}

function getSessionTopicSnippet(session: Session): string {
  const purpose = session.extractedContext?.purpose?.trim()
  if (purpose) return purpose
  const firstAgenda = session.extractedContext?.agenda?.[0]?.trim()
  if (firstAgenda) return firstAgenda
  const firstTranscript = session.transcript?.[0]?.text?.trim()
  if (firstTranscript) return firstTranscript
  return session.filename
}

function truncateSummary(text: string, maxLength = 58): string {
  const normalized = text.replace(/\s+/g, " ").trim()
  if (normalized.length <= maxLength) return normalized
  return `${normalized.slice(0, Math.max(0, maxLength - 1)).trimEnd()}…`
}

function getOriginSummary(session: Session, t: (key: string) => string): string {
  const origin = getSessionOriginKind(session)
  return `${getOriginBadgeLabel(origin, t)}: ${truncateSummary(getSessionTopicSnippet(session))}`
}

function getOriginBadgeLabel(origin: SessionOriginKind, t: (key: string) => string): string {
  if (origin === "call") return t('source.call')
  if (origin === "quick_record") return t('source.quickRecord')
  if (origin === "audio_upload") return t('source.audioUpload')
  return t('source.textImport')
}

function getOriginBadgeClass(origin: SessionOriginKind): string {
  if (origin === "call") return "bg-primary/10 text-primary border-primary/30"
  if (origin === "quick_record") return "bg-success/10 text-success border-success/30"
  if (origin === "audio_upload") return "bg-warning/10 text-warning border-warning/30"
  return "bg-muted text-muted-foreground border-border"
}

// Inline editable session name component
function EditableSessionName({ 
  session, 
  onSave 
}: { 
  session: Session
  onSave: (id: string, newName: string) => void 
}) {
  const [isEditing, setIsEditing] = useState(false)
  const [editValue, setEditValue] = useState(session.filename)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus()
      inputRef.current.select()
    }
  }, [isEditing])

  const handleSave = () => {
    if (editValue.trim()) {
      onSave(session.id, editValue.trim())
    } else {
      setEditValue(session.filename)
    }
    setIsEditing(false)
  }

  const handleCancel = () => {
    setEditValue(session.filename)
    setIsEditing(false)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleSave()
    } else if (e.key === "Escape") {
      handleCancel()
    }
  }

  if (isEditing) {
    return (
      <div className="flex items-center gap-1">
        <Input
          ref={inputRef}
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={handleSave}
          className="h-7 text-sm py-0 px-2 w-[180px]"
        />
        <Button
          variant="ghost"
          size="sm"
          className="h-6 w-6 p-0"
          onClick={handleSave}
        >
          <Check className="h-3 w-3 text-success" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="h-6 w-6 p-0"
          onClick={handleCancel}
        >
          <X className="h-3 w-3 text-muted-foreground" />
        </Button>
      </div>
    )
  }

  return (
    <div className="flex items-center gap-1 group/name">
      <button
        onClick={() => setIsEditing(true)}
        className="font-medium text-foreground truncate max-w-[180px] hover:underline text-left"
      >
        {session.filename}
      </button>
      <button
        onClick={() => setIsEditing(true)}
        className="h-5 w-5 p-0 opacity-0 group-hover/name:opacity-100 transition-opacity inline-flex items-center justify-center hover:bg-secondary rounded"
      >
        <Pencil className="h-3 w-3 text-muted-foreground" />
      </button>
    </div>
  )
}

export default function SessionsPage() {
  const { user } = useAuth()
  const searchParams = useSearchParams()
  const pathname = usePathname()
  const router = useRouter()
  const t = useTranslations('sessions')
  const tu = useTranslations('uploadSheet')
  const tp = useTranslations('pasteSheet')
  const tc = useTranslations('common')
  const tl = useTranslations('languages')
  const [isUploadOpen, setIsUploadOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState(searchParams.get("q") || "")

  useEffect(() => {
    const q = searchParams.get("q") || ""
    if (q) setSearchQuery(q)
  }, [searchParams])
  const [sessions, setSessions] = useState<Session[]>([])
  const [loading, setLoading] = useState(true)
  const [isRecording, setIsRecording] = useState(false)
  const [recordingTime, setRecordingTime] = useState(0)
  const [uploadingFiles, setUploadingFiles] = useState(false)
  const [language, setLanguage] = useState<string>('auto')
  const [inputHint, setInputHint] = useState<string>('') // meeting, presentation, trade_show, voice_note, '' = auto
  const [previewFiles, setPreviewFiles] = useState<File[]>([])
  const [previewOpen, setPreviewOpen] = useState(false)
  const [uploadingTranscript, setUploadingTranscript] = useState(false)
  const [pastePreviewText, setPastePreviewText] = useState('')
  const [pastePreviewOpen, setPastePreviewOpen] = useState(false)
  const [pastePreviewSource, setPastePreviewSource] = useState<'clipboard' | 'file'>('clipboard')
  const [pastePreviewFileName, setPastePreviewFileName] = useState<string | null>(null)
  const recordingIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const transcriptInputRef = useRef<HTMLInputElement>(null)
  const [isDraggingAudio, setIsDraggingAudio] = useState(false)
  const [isDraggingFile, setIsDraggingFile] = useState(false)
  const [isDraggingHeader, setIsDraggingHeader] = useState(false)
  const [isAdmin, setIsAdmin] = useState(false)
  const [adminView, setAdminView] = useState(false)
  const [combiningSuggestion, setCombiningSuggestion] = useState(false)
  const [dismissedCombineSignatures, setDismissedCombineSignatures] = useState<string[]>([])
  const [locallyHiddenSessionIds, setLocallyHiddenSessionIds] = useState<string[]>([])
  const [newlyCreatedSessionIds, setNewlyCreatedSessionIds] = useState<string[]>([])
  const knownSessionIdsRef = useRef<Set<string>>(new Set())
  const initializedKnownSessionsRef = useRef(false)
  const supabase = createClient()
  const selectedSessionId = useMemo(() => {
    const match = pathname.match(/\/sessions\/([^/]+)/)
    return match?.[1] ?? null
  }, [pathname])

  const isTranscriptFile = (f: File) =>
    /\.(txt|srt|vtt)$/i.test(f.name) ||
    f.type === 'text/plain' ||
    f.type === 'text/vtt' ||
    f.type === 'application/x-subrip'

  // Fetch user profile to get default language and admin status
  const fetchUserPreferences = async () => {
    if (!user) return
    
    try {
      const response = await fetch('/api/profile')
      if (response.ok) {
        const profile = await response.json()
        setLanguage(profile.default_recording_language || 'auto')
        setIsAdmin(profile.role === 'admin')
      }
    } catch (error) {
      console.error('Error fetching user preferences:', error)
    }
  }

  // Fetch real sessions from API
  const fetchSessions = useCallback(async () => {
    try {
      const url = adminView ? '/api/sessions?format=v0&adminView=true' : '/api/sessions?format=v0'
      const response = await fetch(url)
      if (!response.ok) throw new Error('Failed to fetch sessions')
      const data = await response.json()
      setSessions(data)
    } catch (error) {
      console.error('Error fetching sessions:', error)
    } finally {
      setLoading(false)
    }
  }, [adminView])

  useEffect(() => {
    fetchUserPreferences()
  }, [user])

  useEffect(() => {
    if (user) fetchSessions()
  }, [user, adminView, fetchSessions])


  // Poll when any session is in progress so badges update when ready
  const hasInProgress = sessions.some(s =>
    s.status === 'recording' || s.status === 'transcribing' || s.status === 'uploading'
  )
  useEffect(() => {
    if (!hasInProgress) return
    const interval = setInterval(fetchSessions, 5000)
    return () => clearInterval(interval)
  }, [hasInProgress, fetchSessions])

  // Recording timer effect
  useEffect(() => {
    if (isRecording) {
      recordingIntervalRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1)
      }, 1000)
    } else {
      if (recordingIntervalRef.current) {
        clearInterval(recordingIntervalRef.current)
        recordingIntervalRef.current = null
      }
      setRecordingTime(0)
    }
    return () => {
      if (recordingIntervalRef.current) {
        clearInterval(recordingIntervalRef.current)
      }
    }
  }, [isRecording])

  const startRecording = async (mode: 'batch' | 'realtime') => {
    // TODO: Implement real recording
    // For now, redirect to the recording page
    router.push('/record')
  }

  const stopRecording = () => {
    setIsRecording(false)
  }

  const handleAudioDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDraggingAudio(true)
  }, [])

  const handleAudioDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDraggingAudio(false)
  }, [])

  const handleFileDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDraggingFile(true)
  }, [])

  const handleFileDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDraggingFile(false)
  }, [])

  const openAudioPicker = useCallback(() => {
    if (uploadingFiles) return
    fileInputRef.current?.click()
  }, [uploadingFiles])

  const openTranscriptPicker = useCallback(() => {
    if (uploadingTranscript) return
    transcriptInputRef.current?.click()
  }, [uploadingTranscript])

  const importTranscriptContent = useCallback(async (
    rawFileContent: string,
    fileName: string,
    ingestionSource: 'drag_drop' | 'file_select' | 'clipboard_paste' = 'file_select'
  ): Promise<boolean> => {
    const { segments, rawText } = parseTranscriptFile(rawFileContent, fileName)
    if (segments.length === 0) {
      toast.error(t('uploadMessages.noContent', { fileName }))
      return false
    }
    const sessionName = fileName.replace(/\.[^/.]+$/, '') || fileName
    const uniqueSpeakers = new Set(segments.map(s => s.speaker))
    const parserProducedGoodSegments = segments.length >= 2 && uniqueSpeakers.size >= 1

    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 120_000)

    try {
      const res = await fetch('/api/sessions/import-transcript', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          language,
          sessionName,
          segments,
          rawText,
          ...(!parserProducedGoodSegments ? { rawFileContent } : {}),
          filename: fileName,
          ingestionSource,
        }),
        signal: controller.signal,
      })
      clearTimeout(timeoutId)
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || t('uploadMessages.importFailed'))
      }
      return true
    } catch (err: any) {
      clearTimeout(timeoutId)
      if (err.name === 'AbortError') {
        throw new Error(t('uploadMessages.importTimeout'))
      }
      throw err
    }
  }, [language, t])

  const processTranscriptFile = useCallback(async (
    file: File,
    source: 'drag_drop' | 'file_select' = 'file_select'
  ): Promise<boolean> => {
    const rawFileContent = await file.text()
    return importTranscriptContent(rawFileContent, file.name, source)
  }, [importTranscriptContent])

  const processPastedTranscript = useCallback(async (
    rawContent: string,
    source: 'clipboard_paste' | 'file_select' = 'clipboard_paste'
  ): Promise<boolean> => {
    const trimmed = rawContent.trim()
    if (!trimmed || trimmed.length < 10) {
      toast.error(t('uploadMessages.emptyContent'))
      return false
    }
    const timestamp = new Date().toLocaleString('en-US', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }).replace(/[/,]/g, '-')
    const sessionName = `Pasted ${timestamp}`

    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 120_000)

    try {
      const res = await fetch('/api/sessions/import-transcript', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          language,
          sessionName,
          segments: [{ start_ms: 0, end_ms: 0, speaker: '', text: trimmed }],
          rawText: trimmed,
          rawFileContent: trimmed,
          filename: 'pasted.txt',
          ingestionSource: source,
        }),
        signal: controller.signal,
      })
      clearTimeout(timeoutId)
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || t('uploadMessages.importFailed'))
      }
      return true
    } catch (err: any) {
      clearTimeout(timeoutId)
      if (err?.name === 'AbortError') {
        // Log timeout to error service
        fetch('/api/error-logs', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            errorType: 'client_error',
            severity: 'error',
            message: `Transcript import timed out after 120s (content length: ${trimmed.length} chars)`,
            metadata: {
              step: 'client_fetch_timeout',
              contentLength: trimmed.length,
              url: window.location.href,
            },
          }),
        }).catch(() => {})
        throw new Error(t('uploadMessages.importTimeout'))
      }
      throw err
    }
  }, [language])

  const handleTranscriptFileSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = e.target.files ? Array.from(e.target.files) : []
    e.target.value = ''
    if (selectedFiles.length === 0) return
    const transcriptFiles = selectedFiles.filter(isTranscriptFile)
    const skipped = selectedFiles.length - transcriptFiles.length
    if (transcriptFiles.length === 0) {
      toast.error(t('uploadMessages.selectTranscript'))
      return
    }
    if (skipped > 0) {
      toast.info(t('uploadMessages.skippedFiles', { count: skipped }))
    }

    if (transcriptFiles.length === 1) {
      try {
        const file = transcriptFiles[0]
        const rawFileContent = await file.text()
        const cleaned = cleanPastedContent(rawFileContent)
        if (!cleaned || cleaned.length < 10) {
          toast.error(t('uploadMessages.noContent', { fileName: file.name }))
          return
        }
        setPastePreviewSource('file')
        setPastePreviewFileName(file.name)
        setPastePreviewText(cleaned)
        setPastePreviewOpen(true)
        return
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : t('uploadMessages.importFailed')
        toast.error(msg)
        return
      }
    }

    setUploadingTranscript(true)
    let success = 0
    for (const file of transcriptFiles) {
      try {
        if (await processTranscriptFile(file, 'file_select')) success++
      } catch (err: any) {
        toast.error(`${file.name}: ${err.message}`)
      }
    }
    setUploadingTranscript(false)
    if (success > 0) {
      toast.success(t('uploadMessages.importSuccess', { count: success }))
      setIsUploadOpen(false)
      await fetchSessions()
    }
  }, [processTranscriptFile, fetchSessions, t])

  const openPastePreview = useCallback((raw: string, source: 'clipboard' | 'file' = 'clipboard', fileName: string | null = null) => {
    const cleaned = cleanPastedContent(raw)
    if (!cleaned || cleaned.length < 10) {
      toast.error(t('uploadMessages.emptyContent'))
      return
    }
    setPastePreviewSource(source)
    setPastePreviewFileName(fileName)
    setPastePreviewText(cleaned)
    setPastePreviewOpen(true)
  }, [])

  const handlePastePreviewConfirm = useCallback(async (text: string) => {
    setUploadingTranscript(true)
    try {
      const imported = pastePreviewSource === 'file' && pastePreviewFileName
        ? await importTranscriptContent(text, pastePreviewFileName, 'file_select')
        : await processPastedTranscript(text, 'clipboard_paste')

      if (imported) {
        toast.success(
          pastePreviewSource === 'file'
            ? t('uploadMessages.importSuccess', { count: 1 })
            : t('uploadMessages.pasteImported')
        )
        setPastePreviewOpen(false)
        setPastePreviewFileName(null)
        setPastePreviewSource('clipboard')
        setIsUploadOpen(false)
        await fetchSessions()
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : t('uploadMessages.importFailed')
      toast.error(msg)
    } finally {
      setUploadingTranscript(false)
    }
  }, [processPastedTranscript, importTranscriptContent, fetchSessions, pastePreviewSource, pastePreviewFileName, t])

  const handlePasteTranscript = useCallback(async () => {
    try {
      const text = await navigator.clipboard.readText()
      if (!text?.trim()) {
        toast.error(t('uploadMessages.clipboardEmpty'))
        return
      }
      openPastePreview(text)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : t('uploadMessages.clipboardFailed')
      toast.error(msg)
    }
  }, [openPastePreview])

  const handleTranscriptPaste = useCallback((e: React.ClipboardEvent) => {
    if (uploadingTranscript) return
    const text = e.clipboardData?.getData('text/plain')
    if (!text?.trim()) return
    e.preventDefault()
    openPastePreview(text)
  }, [openPastePreview, uploadingTranscript])

  const handleFileDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDraggingFile(false)
    const files = Array.from(e.dataTransfer.files).filter(isTranscriptFile)
    if (files.length === 0) {
      toast.error(t('uploadMessages.dropTranscript'))
      return
    }
    setUploadingTranscript(true)
    ;(async () => {
      let success = 0
      for (const file of files) {
        try {
          if (await processTranscriptFile(file, 'drag_drop')) success++
        } catch (err: any) {
          toast.error(`${file.name}: ${err.message}`)
        }
      }
      setUploadingTranscript(false)
      if (success > 0) {
      toast.success(t('uploadMessages.importSuccess', { count: success }))
        setIsUploadOpen(false)
        await fetchSessions()
      }
    })()
  }, [processTranscriptFile, fetchSessions])

  const handleHeaderDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.dataTransfer.types.includes('Files')) setIsDraggingHeader(true)
  }, [])

  const handleHeaderDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDraggingHeader(false)
  }, [])

  const handleHeaderDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDraggingHeader(false)
    const files = Array.from(e.dataTransfer.files)
    const transcriptFiles = files.filter(isTranscriptFile)
    const isWebm = (f: File) =>
      f.type === 'audio/webm' || f.type?.startsWith('audio/webm') || /\.(webm|weba)$/i.test(f.name)
    const audioFiles = files.filter(f => {
      if (isWebm(f)) return false
      return f.type.startsWith('audio/') || f.type === 'video/mp4' || /\.(mp3|wav|m4a|m4v|mp4|ogg|aac|flac)$/i.test(f.name)
    })
    if (files.some(isWebm)) {
      toast.error(t('uploadMessages.webmError'))
    }
    if (transcriptFiles.length > 0) {
      setIsUploadOpen(true)
      setUploadingTranscript(true)
      ;(async () => {
        let success = 0
        for (const file of transcriptFiles) {
          try {
            if (await processTranscriptFile(file, 'drag_drop')) success++
          } catch (err: any) {
            toast.error(`${file.name}: ${err?.message || t('uploadMessages.importFailed')}`)
          }
        }
        setUploadingTranscript(false)
        if (success > 0) {
          toast.success(t('uploadMessages.importSuccess', { count: success }))
          await fetchSessions()
        }
      })()
    } else if (audioFiles.length > 0) {
      setIsUploadOpen(true)
      setPreviewFiles(audioFiles)
      setPreviewOpen(true)
    } else {
      toast.error(t('uploadMessages.dropTranscript'))
    }
  }, [processTranscriptFile, fetchSessions])

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (files) {
      const isWebm = (f: File) =>
        f.type === 'audio/webm' || f.type?.startsWith('audio/webm') || /\.(webm|weba)$/i.test(f.name)
      const audioFiles = Array.from(files).filter(
        file => !isWebm(file) && (file.type.startsWith('audio/') || file.type === 'video/mp4' || /\.(mp3|wav|m4a|m4v|mp4|ogg|aac|flac)$/i.test(file.name))
      )
      if (audioFiles.length === 0) {
        toast.error(files.length > 0 && Array.from(files).some(isWebm)
          ? t('uploadMessages.webmError')
          : t('uploadMessages.selectAudio'))
        return
      }
      if (Array.from(files).some(isWebm)) {
        toast.error(t('uploadMessages.webmExcluded'))
      }
      setPreviewFiles(audioFiles)
      setPreviewOpen(true)
      e.target.value = ''
    }
  }

  const handleUploadConfirm = async (groups: File[][]) => {
    setUploadingFiles(true)
    let successCount = 0
    let errorCount = 0
    for (const group of groups) {
      try {
        await uploadGroup(group)
        successCount++
      } catch (error: any) {
        console.error('Upload failed for group:', error)
        toast.error(t('uploadMessages.uploadItemFailed', { error: error.message || t('uploadMessages.unknownError') }))
        errorCount++
      }
    }
    setUploadingFiles(false)
    setPreviewOpen(false)
    setPreviewFiles([])
    if (successCount > 0) {
      toast.success(t('uploadMessages.uploadSuccess', { count: successCount }))
      setIsUploadOpen(false)
      await fetchSessions()
    }
    if (errorCount > 0 && successCount === 0) {
      toast.error(t('uploadMessages.allFailed'))
    }
  }

  // Speechmatics does NOT support WebM/Opus - supported: wav, mp3, aac, ogg, mpeg, amr, m4a, mp4, flac
  const isWebM = (f: File) =>
    f.type === 'audio/webm' ||
    f.type?.startsWith('audio/webm') ||
    /\.(webm|weba)$/i.test(f.name)

  const uploadGroup = async (files: File[]) => {
    if (!user?.id) throw new Error(t('uploadMessages.loginRequired'))
    if (files.length === 0) return

    const webmFiles = files.filter(isWebM)
    if (webmFiles.length > 0) {
      throw new Error(t('uploadMessages.webmError'))
    }

    const timestamp = new Date().toLocaleString('en-US', {
      month: '2-digit',
      day: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
    const sessionName = files.length === 1
      ? (files[0].name.replace(/\.[^/.]+$/, '') || `Upload ${timestamp}`)
      : `Session ${timestamp} (${files.length} files)`

    const { data: session, error: sessionError } = await supabase
      .from('sessions')
      .insert({
        internal_case_id: sessionName,
        user_id: user.id,
        status: 'uploading',
        language: language,
        ...(inputHint && { input_hint: inputHint }),
      })
      .select()
      .single()

    if (sessionError) {
      throw new Error(`Failed to create session: ${sessionError.message}`)
    }

    try {
      let totalDuration = 0
      let anyDurationRead = false
      let firstPublicUrl = ''

      for (let i = 0; i < files.length; i++) {
        const file = files[i]
        const extension = (file.name.split('.').pop() || 'mp3').toLowerCase()
        const fileName = `${session.id}_${Date.now()}_${i}.${extension}`
        // Use extension-based MIME for phone recordings (browser often reports wrong/empty)
        const storageContentType = getStorageMimeType(file)

        try {
          await uploadToStorage(supabase, 'rohbericht-audio', fileName, file, {
            contentType: storageContentType,
          })
        } catch (uploadError: any) {
          const errMsg = `Failed to upload ${file.name}: ${uploadError.message}`
          await supabase
            .from('sessions')
            .update({ status: 'error', last_error: errMsg })
            .eq('id', session.id)
          throw new Error(errMsg)
        }

        const { data: { publicUrl } } = supabase.storage
          .from('rohbericht-audio')
          .getPublicUrl(fileName)

        if (i === 0) firstPublicUrl = publicUrl

        const audioDuration = await getAudioDuration(file)
        if (audioDuration !== null) {
          totalDuration += audioDuration
          anyDurationRead = true
        }

        const { error: fileError } = await supabase
          .from('files')
          .insert({
            session_id: session.id,
            storage_path: fileName,
            original_filename: file.name,
            mime_type: storageContentType,
            size_bytes: file.size,
            file_purpose: 'meeting',
            upload_status: 'completed',
          })

        if (fileError) throw new Error(`Failed to create file record: ${fileError.message}`)
      }

      // Use earliest file lastModified as recorded_at when available
      const recordedAtMs = Math.min(...files.map((f) => f.lastModified))
      const recordedAt = Number.isFinite(recordedAtMs) ? new Date(recordedAtMs).toISOString() : null

      const { error: updateError } = await supabase
        .from('sessions')
        .update({
          audio_url: firstPublicUrl,
          duration_sec: anyDurationRead ? totalDuration : null,
          ...(recordedAt && { recorded_at: recordedAt }),
        })
        .eq('id', session.id)

      if (updateError) throw new Error(`Failed to update session: ${updateError.message}`)

      const transcribeRes = await fetch(`/api/sessions/${session.id}/transcribe`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ language: language }),
      })
      if (!transcribeRes.ok) {
        console.error('Transcription trigger failed:', await transcribeRes.text())
      }
    } catch (err: any) {
      // Ensure session is marked error on any failure (upload/storage/DB)
      await supabase
        .from('sessions')
        .update({ status: 'error', last_error: err?.message || 'Upload failed' })
        .eq('id', session.id)
      throw err
    }
  }

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDraggingAudio(false)
    const isWebm = (f: File) =>
      f.type === 'audio/webm' || f.type?.startsWith('audio/webm') || /\.(webm|weba)$/i.test(f.name)
    const files = Array.from(e.dataTransfer.files).filter(
      file => !isWebm(file) && (file.type.startsWith('audio/') || file.type === 'video/mp4' || /\.(mp3|wav|m4a|m4v|mp4|ogg|aac|flac)$/i.test(file.name))
    )
    if (files.length === 0) {
      toast.error(Array.from(e.dataTransfer.files).some(isWebm)
        ? t('uploadMessages.webmError')
        : t('uploadMessages.dropAudio'))
      return
    }
    if (Array.from(e.dataTransfer.files).some(isWebm)) {
      toast.error(t('uploadMessages.webmExcluded'))
    }
    setPreviewFiles(files)
    setPreviewOpen(true)
  }, [])

  const handleRenameSession = async (id: string, newName: string) => {
    try {
      // Optimistic update
      setSessions(prev => prev.map(s => 
        s.id === id ? { ...s, filename: newName } : s
      ))

      // Persist to database
      const response = await fetch(`/api/sessions/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ internal_case_id: newName }),
      })

      if (!response.ok) {
        throw new Error('Failed to rename session')
      }
    } catch (error) {
      console.error('Error renaming session:', error)
      // Revert optimistic update on error (preserve adminView)
      const url = adminView ? '/api/sessions?format=v0&adminView=true' : '/api/sessions?format=v0'
      const response = await fetch(url)
      if (response.ok) {
        const data = await response.json()
        setSessions(data)
      }
    }
  }

  const handleDeleteSession = async (id: string) => {
    if (!confirm(t('deleteConfirm'))) {
      return
    }

    try {
      // Optimistic update
      setSessions(prev => prev.filter(s => s.id !== id))

      const response = await fetch(`/api/sessions/${id}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}))
        throw new Error(payload?.error || t('deleteFailed'))
      }
      toast.success(t('deleteSuccess'))
    } catch (error) {
      console.error('Error deleting session:', error)
      toast.error(t('deleteFailed'))
      // Revert optimistic update on error (preserve adminView)
      const url = adminView ? '/api/sessions?format=v0&adminView=true' : '/api/sessions?format=v0'
      const response = await fetch(url)
      if (response.ok) {
        const data = await response.json()
        setSessions(data)
      }
    }
  }

  const handleDownloadTranscript = async (session: Session) => {
    try {
      const response = await fetch(`/api/sessions/${session.id}/transcript`)
      if (!response.ok) throw new Error('Failed to fetch transcript')
      
      const data = await response.json()
      
      // Format transcript as text
      const formattedText = data.raw_json
        .map((seg: any) => {
          const timestamp = formatTimestamp((seg.start_ms || 0) / 1000)
          return `[${timestamp}] ${seg.speaker || 'Unknown'}: ${seg.text || ''}`
        })
        .join('\n\n')

      // Create and download file
      const blob = new Blob([formattedText], { type: 'text/plain' })
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${session.filename}-transcript.txt`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
    } catch (error) {
      console.error('Error downloading transcript:', error)
      toast.error(t('downloadFailed'))
    }
  }

  // Helper function for transcript formatting
  function formatTimestamp(seconds: number): string {
    const hrs = Math.floor(seconds / 3600)
    const mins = Math.floor((seconds % 3600) / 60)
    const secs = Math.floor(seconds % 60)
    if (hrs > 0) {
      return `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
    }
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  // Helper to get audio duration. Tries <audio> first, falls back to <video> for
  // fragmented/HLS-style MP4s that fail on the audio element.
  const getAudioDuration = (file: File): Promise<number | null> => {
    const tryElement = (tag: 'audio' | 'video'): Promise<number | null> =>
      new Promise((resolve) => {
        const el = document.createElement(tag)
        el.preload = 'metadata'
        const objectUrl = URL.createObjectURL(file)
        el.onloadedmetadata = () => {
          URL.revokeObjectURL(objectUrl)
          const d = Math.floor(el.duration)
          resolve(Number.isFinite(d) && d > 0 ? d : null)
        }
        el.onerror = () => {
          URL.revokeObjectURL(objectUrl)
          resolve(null)
        }
        el.src = objectUrl
      })

    return tryElement('audio').then((d) => (d !== null ? d : tryElement('video')))
  }

  const visibleSessions = useMemo(
    () => sessions.filter((s) => !locallyHiddenSessionIds.includes(s.id)),
    [sessions, locallyHiddenSessionIds]
  )

  useEffect(() => {
    if (adminView) return
    const currentIds = new Set(visibleSessions.map((s) => s.id))

    if (!initializedKnownSessionsRef.current) {
      knownSessionIdsRef.current = currentIds
      initializedKnownSessionsRef.current = true
      return
    }

    const detectedNewIds = Array.from(currentIds).filter((id) => !knownSessionIdsRef.current.has(id))
    knownSessionIdsRef.current = currentIds

    if (detectedNewIds.length === 0) {
      setNewlyCreatedSessionIds((prev) => prev.filter((id) => currentIds.has(id)))
      return
    }

    setNewlyCreatedSessionIds((prev) => {
      const merged = [...prev.filter((id) => currentIds.has(id)), ...detectedNewIds]
      return Array.from(new Set(merged))
    })
  }, [visibleSessions, adminView])

  const filteredSessions = visibleSessions.filter(session => {
    if (searchQuery === "") return true
    const q = searchQuery.toLowerCase()
    return (
      session.filename.toLowerCase().includes(q) ||
      session.language.toLowerCase().includes(q) ||
      session.speechmaticsSummary?.toLowerCase().includes(q) ||
      session.extractedContext?.purpose?.toLowerCase().includes(q) ||
      session.extractedContext?.agenda?.some(t => t.toLowerCase().includes(q)) ||
      session.extractedContext?.participants?.some(p =>
        (typeof p === 'string' ? p : p.name)?.toLowerCase().includes(q)
      ) ||
      (adminView && session.ownerEmail?.toLowerCase().includes(q))
    )
  })

  const combineSuggestion = useMemo<CombineSuggestion | null>(() => {
    if (adminView) return null

    const candidates = visibleSessions
      .filter((s) => s.status === 'ready')
      .filter((s) => {
        const name = s.filename.toLowerCase()
        return s.isFromCall || name.includes('call') || name.includes('quick record')
      })
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())

    if (candidates.length < 2) return null

    const normalizeName = (name: string) =>
      name
        .toLowerCase()
        .replace(/\(.*?\)/g, '')
        .replace(/\d{1,2}[:._-]\d{2}(\s?(am|pm))?/gi, '')
        .replace(/\d{1,2}[-/]\d{1,2}([-/]\d{2,4})?/g, '')
        .replace(/\s+/g, ' ')
        .trim()

    const newlyCreatedReady = candidates
      .filter((s) => newlyCreatedSessionIds.includes(s.id))
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())

    if (newlyCreatedReady.length === 0) return null

    const newest = newlyCreatedReady[newlyCreatedReady.length - 1]
    const newestCreatedMs = new Date(newest.createdAt).getTime()
    const newestKey = normalizeName(newest.filename)
    const maxGapMs = 20 * 60 * 1000

    const previousMatch = [...candidates]
      .reverse()
      .find((s) => {
        if (s.id === newest.id) return false
        const createdMs = new Date(s.createdAt).getTime()
        if (createdMs >= newestCreatedMs) return false
        if (newestCreatedMs - createdMs > maxGapMs) return false
        return normalizeName(s.filename) === newestKey
      })

    if (!previousMatch) return null

    const pair = [previousMatch, newest].sort(
      (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    )

    return {
      sessionIds: pair.map((s) => s.id),
      baseName: pair[0].filename,
      count: pair.length,
      totalDuration: pair.every(s => s.duration != null)
        ? pair.reduce((acc, s) => acc + s.duration!, 0)
        : null,
      sessionNames: pair.map((s) => s.filename),
      signature: pair.map((s) => s.id).join('|'),
    }
  }, [visibleSessions, adminView, newlyCreatedSessionIds])

  const handleCombineSuggestedCalls = useCallback(async () => {
    if (!combineSuggestion || combiningSuggestion) return
    setCombiningSuggestion(true)
    try {
      const response = await fetch('/api/sessions/combine', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionIds: combineSuggestion.sessionIds,
          name: `${combineSuggestion.baseName} (${t('combineSuggested.defaultCombinedSuffix')})`,
        }),
      })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) {
        throw new Error(payload?.error || t('combineSuggested.error'))
      }
      setDismissedCombineSignatures((prev) =>
        prev.includes(combineSuggestion.signature) ? prev : [...prev, combineSuggestion.signature]
      )
      setLocallyHiddenSessionIds((prev) =>
        Array.from(new Set([...prev, ...combineSuggestion.sessionIds]))
      )
      setNewlyCreatedSessionIds((prev) =>
        prev.filter((id) => !combineSuggestion.sessionIds.includes(id))
      )
      toast.success(t('combineSuggested.success'))
      await fetchSessions()
    } catch (err: any) {
      toast.error(err?.message || t('combineSuggested.error'))
    } finally {
      setCombiningSuggestion(false)
    }
  }, [combineSuggestion, combiningSuggestion, fetchSessions, t])

  const visibleCombineSuggestion = useMemo(() => {
    if (!combineSuggestion) return null
    if (dismissedCombineSignatures.includes(combineSuggestion.signature)) return null
    return combineSuggestion
  }, [combineSuggestion, dismissedCombineSignatures])

  return (
    <div className="flex-1 min-h-0 flex flex-col overflow-y-auto gap-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 shrink-0">
        <div>
          <h1 className="text-xl font-semibold text-foreground">{t('title')}</h1>
          <p className="text-sm text-muted-foreground">
            {t('subtitle')}
          </p>
        </div>
      </div>

      {/* Record Bar + Upload Section - Same Height */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 shrink-0">
        {/* Record Bar */}
        <div
          className={cn(
            "flex items-center justify-between gap-3 px-4 py-3 rounded-lg border transition-all",
            isRecording 
              ? "bg-destructive/50 border-destructive" 
              : "bg-card border-border hover:border-muted-foreground"
          )}
        >
          <div className="flex items-center gap-3">
            <div className={cn(
              "h-10 w-10 rounded-full flex items-center justify-center transition-colors",
              isRecording ? "bg-destructive" : "bg-primary"
            )}>
              <Mic className={cn(
                "h-5 w-5",
                isRecording ? "text-destructive-foreground animate-pulse" : "text-primary-foreground"
              )} />
            </div>
            <div>
              {isRecording ? (
                <>
                  <p className="text-sm font-medium text-foreground">{t('recordingActive')}</p>
                  <p className="text-lg font-mono font-semibold text-destructive">
                    {formatDuration(recordingTime)}
                  </p>
                </>
              ) : (
                <>
                  <p className="text-sm font-medium text-foreground">{t('record')}</p>
                  <p className="text-xs text-muted-foreground">{t('recordSubtitle')}</p>
                </>
              )}
            </div>
          </div>
          
          <Button 
            size="sm" 
            className="shrink-0"
            onClick={() => router.push('/record')}
          >
            <Mic className="h-4 w-4 mr-2" />
            {t('record')}
          </Button>
        </div>

        {/* Upload Section - Same Height */}
        <Collapsible open={isUploadOpen} onOpenChange={setIsUploadOpen}>
          <CollapsibleTrigger asChild>
            <div
              className={cn(
                "flex items-center justify-between gap-3 px-4 py-3 rounded-lg border cursor-pointer transition-colors",
                isUploadOpen 
                  ? "bg-secondary border-primary" 
                  : "bg-card border-border hover:border-muted-foreground",
                isDraggingHeader && "border-primary bg-primary/5"
              )}
              onDragOver={handleHeaderDragOver}
              onDragLeave={handleHeaderDragLeave}
              onDrop={handleHeaderDrop}
            >
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-secondary flex items-center justify-center">
                  <Upload className="h-5 w-5 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground">{t('upload')}</p>
                  <p className="text-xs text-muted-foreground">{t('uploadSubtitle')}</p>
                </div>
              </div>
              <ChevronRight className={cn(
                "h-5 w-5 text-muted-foreground transition-transform",
                isUploadOpen && "rotate-90"
              )} />
            </div>
          </CollapsibleTrigger>
          <CollapsibleContent className="mt-3">
            <div className="space-y-3">
              {/* Content Hint */}
              <div>
                <label htmlFor="upload-hint" className="text-xs font-medium text-muted-foreground mb-1.5 block">
                  {t('contentType.label')}
                </label>
                <select
                  id="upload-hint"
                  value={inputHint}
                  onChange={(e) => setInputHint(e.target.value)}
                  disabled={uploadingFiles}
                  className="w-full p-2 border rounded-md text-sm bg-background"
                >
                  <option value="">{t('contentType.auto')}</option>
                  <option value="meeting">{t('contentType.meeting')}</option>
                  <option value="presentation">{t('contentType.presentation')}</option>
                  <option value="trade_show">{t('contentType.tradeShow')}</option>
                  <option value="voice_note">{t('contentType.voiceNote')}</option>
                </select>
              </div>

              {/* Language Selection */}
              <div>
                <label htmlFor="upload-language" className="text-xs font-medium text-muted-foreground mb-1.5 block">
                  {t('recordingLanguage')}
                </label>
                <select
                  id="upload-language"
                  value={language}
                  onChange={(e) => setLanguage(e.target.value)}
                  disabled={uploadingFiles}
                  className="w-full p-2 border rounded-md text-sm bg-background"
                >
                  <option value="auto">{tl('auto')}</option>
                  <option value="en">{tl('en')}</option>
                  <option value="de">{tl('de')}</option>
                  <option value="es">{tl('es')}</option>
                  <option value="fr">{tl('fr')}</option>
                  <option value="it">{tl('it')}</option>
                  <option value="pt">{tl('pt')}</option>
                  <option value="nl">{tl('nl')}</option>
                  <option value="pl">{tl('pl')}</option>
                </select>
              </div>

              {/* Upload Areas - Split */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Upload Audio - label makes tap work on mobile without drag-drop */}
                <div
                  role="button"
                  tabIndex={0}
                  className={cn(
                    "border-2 border-dashed rounded-lg p-4 min-h-[88px] flex flex-col items-center justify-center transition-colors cursor-pointer touch-manipulation block",
                    isDraggingAudio
                      ? "border-primary bg-primary/5"
                      : "border-border hover:border-muted-foreground active:bg-muted/50",
                    uploadingFiles && "opacity-50 pointer-events-none"
                  )}
                  onDragOver={handleAudioDragOver}
                  onDragLeave={handleAudioDragLeave}
                  onDrop={handleDrop}
                  onClick={openAudioPicker}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      openAudioPicker()
                    }
                  }}
                >
                  <input
                    ref={fileInputRef}
                    id="audio-file-input"
                    type="file"
                    accept="audio/*,.mp3,.wav,.m4a,.mp4,.ogg,.aac,.flac,video/mp4"
                    multiple
                    onChange={handleFileSelect}
                    className="sr-only"
                  />
                  <div className="flex flex-col items-center text-center">
                    {uploadingFiles ? (
                      <>
                        <div className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-solid border-current border-r-transparent mb-2"></div>
                        <p className="text-xs font-medium text-foreground">{tu('uploading')}</p>
                      </>
                    ) : (
                      <>
                        <FileAudio className="h-7 w-7 text-muted-foreground mb-2" />
                        <p className="text-sm font-medium text-foreground">{tu('audioCardTitle')}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {tu('audioFormatsShort')}
                        </p>
                        <p className="text-xs text-primary font-medium mt-1">
                          {tu('tapToChoose')}
                        </p>
                      </>
                    )}
                  </div>
                </div>

                {/* Upload Transcript - label for tap; paste button separate for mobile */}
                <div
                  className={cn(
                    "border-2 border-dashed rounded-lg p-4 min-h-[88px] flex flex-col items-center justify-center gap-2 transition-colors touch-manipulation",
                    isDraggingFile
                      ? "border-primary bg-primary/5"
                      : "border-border hover:border-muted-foreground",
                    uploadingTranscript && "opacity-50 pointer-events-none"
                  )}
                  onDragOver={handleFileDragOver}
                  onDragLeave={handleFileDragLeave}
                  onDrop={handleFileDrop}
                  onPaste={handleTranscriptPaste}
                >
                  <div
                    role="button"
                    tabIndex={0}
                    className="flex flex-col items-center justify-center cursor-pointer touch-manipulation flex-1 min-h-0"
                    onClick={openTranscriptPicker}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault()
                        openTranscriptPicker()
                      }
                    }}
                  >
                    <input
                      ref={transcriptInputRef}
                      id="transcript-file-input"
                      type="file"
                      accept=".txt,.srt,.vtt,text/plain"
                      multiple
                      onChange={handleTranscriptFileSelect}
                      className="sr-only"
                    />
                    {uploadingTranscript ? (
                      <>
                        <div className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-solid border-current border-r-transparent mb-2"></div>
                        <p className="text-xs font-medium text-foreground">{tu('processing')}</p>
                      </>
                    ) : (
                      <>
                        <FileText className="h-7 w-7 text-muted-foreground mb-2" />
                        <p className="text-sm font-medium text-foreground">{tu('transcriptCardTitle')}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {tu('transcriptFormatsShort')}
                        </p>
                        <p className="text-xs text-primary font-medium mt-1">
                          {tu('tapToChooseOrPaste')}
                        </p>
                      </>
                    )}
                  </div>
                  {!uploadingTranscript && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation()
                        handlePasteTranscript()
                      }}
                    >
                      {tp('pasteFromClipboard')}
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </CollapsibleContent>
        </Collapsible>
      </div>

      {/* Sessions List */}
      <Card className="border-border flex-1 min-h-0 flex flex-col overflow-hidden">
        {visibleCombineSuggestion && (
          <div className="mx-4 mt-3 mb-0 rounded-lg border border-primary/30 bg-primary/5 p-3 flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm font-medium text-foreground">
                {t('combineSuggested.title', { count: visibleCombineSuggestion.count })}
              </p>
              <p className="text-xs text-muted-foreground">
                {t('combineSuggested.subtitle', { duration: visibleCombineSuggestion.totalDuration != null ? formatDuration(visibleCombineSuggestion.totalDuration) : '—' })}
              </p>
              <p className="text-xs text-muted-foreground truncate mt-0.5">
                {visibleCombineSuggestion.sessionNames.join(' + ')}
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Button
                variant="ghost"
                size="sm"
                onClick={() =>
                  {
                    setDismissedCombineSignatures((prev) =>
                      prev.includes(visibleCombineSuggestion.signature)
                        ? prev
                        : [...prev, visibleCombineSuggestion.signature]
                    )
                    setNewlyCreatedSessionIds((prev) =>
                      prev.filter((id) => !visibleCombineSuggestion.sessionIds.includes(id))
                    )
                  }
                }
                aria-label={t('combineSuggested.dismiss')}
              >
                <X className="h-4 w-4" />
              </Button>
              <Button
                size="sm"
                onClick={handleCombineSuggestedCalls}
                disabled={combiningSuggestion}
              >
                {combiningSuggestion ? t('combineSuggested.combining') : t('combineSuggested.action')}
              </Button>
            </div>
          </div>
        )}

        {/* Compact Header with Search + Admin Toggle */}
        <div className="flex items-center justify-between gap-3 px-4 py-2 border-b border-border shrink-0">
          <div className="flex items-center gap-4">
            <h2 className="text-sm font-medium text-foreground whitespace-nowrap">
              {t('recentSessions')}
            </h2>
            {isAdmin && (
              <div className="flex items-center gap-2">
                <Switch
                  id="admin-view"
                  checked={adminView}
                  onCheckedChange={(checked) => {
                    setAdminView(checked)
                  }}
                />
                <Label htmlFor="admin-view" className="text-xs text-muted-foreground cursor-pointer whitespace-nowrap">
                  {t('allUsers')}
                </Label>
              </div>
            )}
          </div>
          <div className="relative flex-1 max-w-xs">
            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="search"
              placeholder={t('searchPlaceholder')}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-8 pl-8 text-sm bg-secondary border-0"
            />
          </div>
        </div>
        
        {/* Mobile: Card List */}
        <div className="md:hidden divide-y divide-border flex-1 overflow-y-auto min-h-0">
          {loading ? (
            <div className="p-8 text-center">
              <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-current border-r-transparent"></div>
              <p className="mt-2 text-sm text-muted-foreground">{t('loadingSessions')}</p>
            </div>
          ) : filteredSessions.length === 0 ? (
            <div className="p-8 text-center text-sm text-muted-foreground">
              {t('noSessionsFound')}
            </div>
          ) : (
            filteredSessions.map((session: Session) => {
              const status = getStatusDisplay(session)
              const origin = getSessionOriginKind(session)
              const originSummary = getOriginSummary(session, t)
              const showWordCount = !session.duration
              return (
                <div
                  key={session.id}
                  className={cn(
                    "p-3 transition-colors",
                    selectedSessionId === session.id && "bg-teal-500/50",
                    isProcessing(session)
                      ? "cursor-not-allowed opacity-70"
                      : "hover:bg-teal-500/50 active:bg-teal-500/50 cursor-pointer"
                  )}
                  onClick={(e) => {
                    if (isProcessing(session)) return
                    const target = e.target as HTMLElement
                    if (
                      !target.closest('button') && 
                      !target.closest('input') &&
                      !target.closest('[role="menu"]') &&
                      !target.closest('[role="menuitem"]')
                    ) {
                      router.push(`/sessions/${session.id}`)
                    }
                  }}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <EditableSessionName 
                        session={session} 
                        onSave={handleRenameSession} 
                      />
                      <p className="mt-1 text-xs text-foreground/80 truncate">
                        {originSummary}
                      </p>
                      <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                        <Badge variant="outline" className={cn("text-[10px] px-1.5 py-0 h-5", getOriginBadgeClass(origin))}>
                          {getOriginBadgeLabel(origin, t)}
                        </Badge>
                        <span className="flex items-center gap-1">
                          {showWordCount ? (
                            <>
                              <FileText className="h-3 w-3" />
                              {session.wordCount ? `${session.wordCount.toLocaleString()} words` : '—'}
                            </>
                          ) : (
                            <>
                              <Clock className="h-3 w-3" />
                              {formatDuration(session.duration)}
                            </>
                          )}
                        </span>
                        <span className="flex items-center gap-1">
                          <Globe className="h-3 w-3" />
                          {session.language}
                        </span>
                        <span>{formatDate(session.createdAt)}</span>
                      </div>
                      {adminView && session.ownerEmail && (
                        <p className="text-[10px] text-muted-foreground mt-0.5 truncate">
                          {session.ownerEmail}
                        </p>
                      )}
                      <div className="flex items-center gap-2 mt-2 flex-wrap">
                        <Badge 
                          variant={status.variant}
                          className={cn("text-[10px]", status.className)}
                        >
                          {status.animated && <span className="inline-block w-1.5 h-1.5 rounded-full bg-current mr-1 animate-ping" />}
                          {t(`status.${status.labelKey}`)}
                        </Badge>
                        {session.isFromCall && (
                          <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-5 bg-primary/10 text-primary border-primary/30">
                            <Video className="h-3 w-3 mr-1" />
                            {t('fromCall')}
                          </Badge>
                        )}
                        {session.piiRedactionEnabled && (
                          <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-5">
                            <Shield className="h-3 w-3 mr-1" />
                            {t('pii')}
                          </Badge>
                        )}
                        {(session.outputCount ?? 0) > 0 && (
                          <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-5 bg-info/20 text-info border-info/30">
                            <FileText className="h-3 w-3 mr-1" />
                            {session.outputCount}
                          </Badge>
                        )}
                      </div>
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0 shrink-0"
                        >
                          <MoreHorizontal className="h-4 w-4" />
                          <span className="hidden">{t('actionsMenu')}</span>
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem asChild disabled={isProcessing(session)}>
                          <Link href={isProcessing(session) ? "#" : `/sessions/${session.id}`}>
                            <Eye className="mr-2 h-4 w-4" />
                            {t('details')}
                          </Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          disabled={isProcessing(session)}
                          onClick={() => !isProcessing(session) && handleDownloadTranscript(session)}
                        >
                          <Download className="mr-2 h-4 w-4" />
                          {t('downloadTranscript')}
                        </DropdownMenuItem>
                        <DropdownMenuItem 
                          className="text-destructive"
                          onClick={() => handleDeleteSession(session.id)}
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          {tc('delete')}
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              )
            })
          )}
        </div>
        
        {/* Desktop: Table */}
        <div className="hidden md:flex md:flex-col md:flex-1 md:min-h-0 md:overflow-y-auto">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="text-muted-foreground">{t('table.name')}</TableHead>
                {adminView && (
                  <TableHead className="text-muted-foreground">{t('table.owner')}</TableHead>
                )}
                <TableHead className="text-muted-foreground">{t('table.duration')}</TableHead>
                <TableHead className="text-muted-foreground">{t('table.language')}</TableHead>
                <TableHead className="text-muted-foreground">{t('table.status')}</TableHead>
                <TableHead className="text-muted-foreground">{t('table.created')}</TableHead>
                <TableHead className="text-muted-foreground text-right">{t('table.actions')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={adminView ? 7 : 6} className="text-center py-8">
                    <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-current border-r-transparent"></div>
                    <p className="mt-2 text-sm text-muted-foreground">{t('loadingSessions')}</p>
                  </TableCell>
                </TableRow>
              ) : filteredSessions.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={adminView ? 7 : 6} className="text-center text-sm text-muted-foreground py-8">
                    {t('noSessionsFound')}
                  </TableCell>
                </TableRow>
              ) : (
                filteredSessions.map((session: Session) => {
                  const status = getStatusDisplay(session)
                  const origin = getSessionOriginKind(session)
                  const originSummary = getOriginSummary(session, t)
                  const showWordCount = !session.duration
                  return (
                    <TableRow 
                      key={session.id} 
                      data-state={selectedSessionId === session.id ? "selected" : undefined}
                      className={cn(
                        "group",
                        selectedSessionId === session.id && "data-[state=selected]:bg-teal-500/50 data-[state=selected]:hover:bg-teal-500/50",
                        isProcessing(session)
                          ? "cursor-not-allowed opacity-70"
                          : "cursor-pointer hover:bg-teal-500/50 active:bg-teal-500/50"
                      )}
                      onClick={(e) => {
                        if (isProcessing(session)) return
                        const target = e.target as HTMLElement
                        if (
                          !target.closest('button') && 
                          !target.closest('input') &&
                          !target.closest('[role="menu"]') &&
                          !target.closest('[role="menuitem"]')
                        ) {
                          router.push(`/sessions/${session.id}`)
                        }
                      }}
                    >
                      <TableCell>
                        <div className="flex flex-col">
                          <EditableSessionName 
                            session={session} 
                            onSave={handleRenameSession} 
                          />
                          <p className="mt-1 text-xs text-foreground/80 truncate max-w-[34rem]">
                            {originSummary}
                          </p>
                          <div className="flex items-center gap-2 mt-1 flex-wrap">
                            <Badge variant="outline" className={cn("text-[10px] px-1.5 py-0 h-5", getOriginBadgeClass(origin))}>
                              {getOriginBadgeLabel(origin, t)}
                            </Badge>
                            {session.isFromCall && (
                              <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-5 bg-primary/10 text-primary border-primary/30">
                                <Video className="h-3 w-3 mr-1" />
                                {t('fromCall')}
                              </Badge>
                            )}
                            {session.piiRedactionEnabled && (
                              <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-5">
                                <Shield className="h-3 w-3 mr-1" />
                                {t('piiRedacted')}
                              </Badge>
                            )}
                            {session.isOfflineCached && (
                              <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-5">
                                <WifiOff className="h-3 w-3 mr-1" />
                                {t('cached')}
                              </Badge>
                            )}
                            {(session.outputCount ?? 0) > 0 && (
                              <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-5 bg-info/20 text-info border-info/30">
                                <FileText className="h-3 w-3 mr-1" />
                                {t('outputCount', { count: session.outputCount ?? 0 })}
                              </Badge>
                            )}
                          </div>
                        </div>
                      </TableCell>
                      {adminView && (
                        <TableCell className="text-sm text-muted-foreground">
                          {session.ownerEmail || '—'}
                        </TableCell>
                      )}
                      <TableCell>
                        <div className="flex items-center gap-1.5 text-muted-foreground">
                          {showWordCount ? (
                            <>
                              <FileText className="h-3.5 w-3.5" />
                              <span className="text-sm">{session.wordCount ? `${session.wordCount.toLocaleString()} words` : '—'}</span>
                            </>
                          ) : (
                            <>
                              <Clock className="h-3.5 w-3.5" />
                              <span className="text-sm">{formatDuration(session.duration)}</span>
                            </>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1.5 text-muted-foreground">
                          <Globe className="h-3.5 w-3.5" />
                          <span className="text-sm">{session.language}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-1">
                          <Badge
                            variant={status.variant}
                            className={cn("w-fit", status.className)}
                          >
                            {status.animated && <span className="inline-block w-1.5 h-1.5 rounded-full bg-current mr-1.5 animate-ping" />}
                            {t(`status.${status.labelKey}`)}
                          </Badge>
                        </div>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {formatDate(session.createdAt)}
                      </TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 w-8 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                              <MoreHorizontal className="h-4 w-4" />
                              <span className="hidden">{t('actionsMenu')}</span>
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem asChild disabled={isProcessing(session)}>
                              <Link href={isProcessing(session) ? "#" : `/sessions/${session.id}`}>
                                <Eye className="mr-2 h-4 w-4" />
                                {t('details')}
                              </Link>
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              disabled={isProcessing(session)}
                              onClick={() => !isProcessing(session) && handleDownloadTranscript(session)}
                            >
                              <Download className="mr-2 h-4 w-4" />
                              {t('downloadTranscript')}
                            </DropdownMenuItem>
                            <DropdownMenuItem 
                              className="text-destructive"
                              onClick={() => handleDeleteSession(session.id)}
                            >
                              <Trash2 className="mr-2 h-4 w-4" />
                              {tc('delete')}
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  )
                })
              )}
            </TableBody>
          </Table>
        </div>
      </Card>

      <UploadPreviewSheet
        open={previewOpen}
        onOpenChange={setPreviewOpen}
        files={previewFiles}
        onConfirm={handleUploadConfirm}
        loading={uploadingFiles}
      />

      <PastePreviewSheet
        open={pastePreviewOpen}
      onOpenChange={(open) => {
        setPastePreviewOpen(open)
        if (!open) {
          setPastePreviewFileName(null)
          setPastePreviewSource('clipboard')
        }
      }}
        initialText={pastePreviewText}
        ingestionSource={pastePreviewSource === 'file' ? 'file_select' : 'clipboard_paste'}
        fileName={pastePreviewFileName}
        onConfirm={handlePastePreviewConfirm}
        loading={uploadingTranscript}
      />
    </div>
  )
}
