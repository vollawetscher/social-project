"use client"

export const dynamic = 'force-dynamic'

import React from "react"
import { useState, useCallback, useRef, useEffect } from "react"
import Link from "next/link"
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
import { parseTranscriptFile } from "@/lib/utils/transcript-parser"
import type { SessionStatus, Session } from "@/lib/types-v0"
import { cn } from "@/lib/utils"

const statusConfig: Record<
  SessionStatus,
  { label: string; variant: "default" | "secondary" | "destructive" | "outline"; className?: string; animated?: boolean }
> = {
  uploading: { label: "Uploading", variant: "secondary", className: "bg-info/20 text-info border-info/30 animate-pulse", animated: true },
  transcribing: { label: "Transcribing", variant: "secondary", className: "bg-warning/20 text-warning border-warning/30 animate-pulse", animated: true },
  ready: { label: "Ready", variant: "default", className: "bg-success/20 text-success border-success/30" },
  failed: { label: "Failed", variant: "destructive" },
}

function formatDuration(seconds: number): string {
  const hrs = Math.floor(seconds / 3600)
  const mins = Math.floor((seconds % 3600) / 60)
  const secs = seconds % 60
  if (hrs > 0) {
    return `${hrs}:${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`
  }
  return `${mins}:${secs.toString().padStart(2, "0")}`
}

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
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
  const [isUploadOpen, setIsUploadOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [sessions, setSessions] = useState<Session[]>([])
  const [loading, setLoading] = useState(true)
  const [isRecording, setIsRecording] = useState(false)
  const [recordingTime, setRecordingTime] = useState(0)
  const [uploadingFiles, setUploadingFiles] = useState(false)
  const [language, setLanguage] = useState<string>('de') // Default to German
  const [previewFiles, setPreviewFiles] = useState<File[]>([])
  const [previewOpen, setPreviewOpen] = useState(false)
  const [uploadingTranscript, setUploadingTranscript] = useState(false)
  const recordingIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const transcriptInputRef = useRef<HTMLInputElement>(null)
  const [isDraggingAudio, setIsDraggingAudio] = useState(false)
  const [isDraggingFile, setIsDraggingFile] = useState(false)
  const [isDraggingHeader, setIsDraggingHeader] = useState(false)
  const [isAdmin, setIsAdmin] = useState(false)
  const [adminView, setAdminView] = useState(false)
  const supabase = createClient()

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
        setLanguage(profile.default_recording_language || 'de')
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


  // Poll when any session is transcribing so badges update when ready
  const hasInProgress = sessions.some(s =>
    s.status === 'transcribing' || s.status === 'uploading'
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
    window.location.href = '/record'
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

  const processTranscriptFile = useCallback(async (file: File): Promise<boolean> => {
    const rawFileContent = await file.text()
    const { segments, rawText } = parseTranscriptFile(rawFileContent, file.name)
    if (segments.length === 0) {
      toast.error(`No content in ${file.name}. Please add transcript text.`)
      return false
    }
    const sessionName = file.name.replace(/\.[^/.]+$/, '') || file.name
    const res = await fetch('/api/sessions/import-transcript', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        language,
        sessionName,
        segments,
        rawText,
        rawFileContent,
        filename: file.name,
      }),
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      throw new Error(err.error || 'Import failed')
    }
    return true
  }, [language])

  const processPastedTranscript = useCallback(async (rawContent: string): Promise<boolean> => {
    const trimmed = rawContent.trim()
    if (!trimmed || trimmed.length < 10) {
      toast.error('Pasted content is empty or too short')
      return false
    }
    const { segments, rawText } = parseTranscriptFile(trimmed, 'pasted.txt')
    const timestamp = new Date().toLocaleString('en-US', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }).replace(/[/,]/g, '-')
    const sessionName = `Pasted ${timestamp}`
    const res = await fetch('/api/sessions/import-transcript', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        language,
        sessionName,
        segments: segments.length > 0 ? segments : undefined,
        rawText: rawText || trimmed,
        rawFileContent: trimmed,
        filename: 'pasted.txt',
      }),
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      throw new Error(err.error || 'Import failed')
    }
    return true
  }, [language])

  const handleTranscriptFileSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    e.target.value = ''
    if (!files || files.length === 0) return
    const transcriptFiles = Array.from(files).filter(isTranscriptFile)
    const skipped = files.length - transcriptFiles.length
    if (transcriptFiles.length === 0) {
      toast.error('Please select TXT, SRT, or VTT files')
      return
    }
    if (skipped > 0) {
      toast.info(`Skipped ${skipped} non-transcript file(s)`)
    }
    setUploadingTranscript(true)
    let success = 0
    for (const file of transcriptFiles) {
      try {
        if (await processTranscriptFile(file)) success++
      } catch (err: any) {
        toast.error(`${file.name}: ${err.message}`)
      }
    }
    setUploadingTranscript(false)
    if (success > 0) {
      toast.success(`${success} transcript(s) imported`)
      await fetchSessions()
    }
  }, [processTranscriptFile, fetchSessions])

  const handlePasteTranscript = useCallback(async () => {
    try {
      const text = await navigator.clipboard.readText()
      if (!text?.trim()) {
        toast.error('Clipboard is empty')
        return
      }
      setUploadingTranscript(true)
      if (await processPastedTranscript(text)) {
        toast.success('Pasted transcript imported')
        await fetchSessions()
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to paste'
      toast.error(msg)
    } finally {
      setUploadingTranscript(false)
    }
  }, [processPastedTranscript, fetchSessions])

  const handleTranscriptPaste = useCallback((e: React.ClipboardEvent) => {
    if (uploadingTranscript) return
    const text = e.clipboardData?.getData('text/plain')
    if (!text?.trim()) return
    e.preventDefault()
    setUploadingTranscript(true)
    ;(async () => {
      try {
        if (await processPastedTranscript(text)) {
          toast.success('Pasted transcript imported')
          await fetchSessions()
        }
      } catch (err: unknown) {
        toast.error(err instanceof Error ? err.message : 'Paste failed')
      } finally {
        setUploadingTranscript(false)
      }
    })()
  }, [processPastedTranscript, fetchSessions, uploadingTranscript])

  const handleFileDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDraggingFile(false)
    const files = Array.from(e.dataTransfer.files).filter(isTranscriptFile)
    if (files.length === 0) {
      toast.error('Please drop TXT, SRT, or VTT files')
      return
    }
    setUploadingTranscript(true)
    ;(async () => {
      let success = 0
      for (const file of files) {
        try {
          if (await processTranscriptFile(file)) success++
        } catch (err: any) {
          toast.error(`${file.name}: ${err.message}`)
        }
      }
      setUploadingTranscript(false)
      if (success > 0) {
        toast.success(`${success} transcript(s) imported`)
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
      toast.error('WebM/WebA format cannot be transcribed. Convert to MP3 or MP4 first (e.g. cloudconvert.com).')
    }
    if (transcriptFiles.length > 0) {
      setIsUploadOpen(true)
      setUploadingTranscript(true)
      ;(async () => {
        let success = 0
        for (const file of transcriptFiles) {
          try {
            if (await processTranscriptFile(file)) success++
          } catch (err: any) {
            toast.error(`${file.name}: ${err?.message || 'Import failed'}`)
          }
        }
        setUploadingTranscript(false)
        if (success > 0) {
          toast.success(`${success} transcript(s) imported`)
          await fetchSessions()
        }
      })()
    } else if (audioFiles.length > 0) {
      setIsUploadOpen(true)
      setPreviewFiles(audioFiles)
      setPreviewOpen(true)
    } else {
      toast.error('Please drop transcript files (TXT, SRT, VTT) or audio files (MP3, WAV, MP4, M4A). WebM is not supported.')
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
          ? 'WebM/WebA format cannot be transcribed. Convert to MP3 or MP4 first (e.g. cloudconvert.com).'
          : 'Please select audio files (MP3, WAV, MP4, M4A)')
        return
      }
      if (Array.from(files).some(isWebm)) {
        toast.error('WebM/WebA files were excluded. Convert to MP3 or MP4 first.')
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
        toast.error(`Failed: ${error.message || 'Unknown error'}`)
        errorCount++
      }
    }
    setUploadingFiles(false)
    setPreviewOpen(false)
    setPreviewFiles([])
    if (successCount > 0) {
      toast.success(`${successCount} session(s) uploaded successfully`)
      await fetchSessions()
    }
    if (errorCount > 0 && successCount === 0) {
      toast.error('All uploads failed')
    }
  }

  // Speechmatics does NOT support WebM/Opus - supported: wav, mp3, aac, ogg, mpeg, amr, m4a, mp4, flac
  const isWebM = (f: File) =>
    f.type === 'audio/webm' ||
    f.type?.startsWith('audio/webm') ||
    /\.(webm|weba)$/i.test(f.name)

  const uploadGroup = async (files: File[]) => {
    if (!user?.id) throw new Error('You must be logged in to upload files')
    if (files.length === 0) return

    const webmFiles = files.filter(isWebM)
    if (webmFiles.length > 0) {
      throw new Error(
        `WebM format is not supported for transcription. Please convert to MP3 or MP4 first (e.g. cloudconvert.com). Or record on iPhone Safari which uses MP4.`
      )
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
      })
      .select()
      .single()

    if (sessionError) {
      throw new Error(`Failed to create session: ${sessionError.message}`)
    }

    try {
      let totalDuration = 0
      let firstPublicUrl = ''

      for (let i = 0; i < files.length; i++) {
        const file = files[i]
        const extension = file.name.split('.').pop() || 'mp3'
        const fileName = `${session.id}_${Date.now()}_${i}.${extension}`
        // Supabase bucket allows audio/mp4 but not video/mp4 - normalize for storage
        const storageContentType =
          file.type === 'video/mp4' ? 'audio/mp4' : (file.type || 'audio/mpeg')

        const { error: uploadError } = await supabase.storage
          .from('rohbericht-audio')
          .upload(fileName, file, {
            contentType: storageContentType,
            upsert: false
          })

        if (uploadError) {
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
        totalDuration += audioDuration

        const { error: fileError } = await supabase
          .from('files')
          .insert({
            session_id: session.id,
            storage_path: fileName,
            original_filename: file.name,
            mime_type: file.type || 'audio/mpeg',
            size_bytes: file.size,
            file_purpose: 'meeting',
            upload_status: 'completed',
          })

        if (fileError) throw new Error(`Failed to create file record: ${fileError.message}`)
      }

      const { error: updateError } = await supabase
        .from('sessions')
        .update({
          audio_url: firstPublicUrl,
          duration_sec: totalDuration
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
        ? 'WebM/WebA format cannot be transcribed. Convert to MP3 or MP4 first (e.g. cloudconvert.com).'
        : 'Please drop audio files (MP3, WAV, MP4, M4A)')
      return
    }
    if (Array.from(e.dataTransfer.files).some(isWebm)) {
      toast.error('WebM/WebA files were excluded. Convert to MP3 or MP4 first.')
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
    if (!confirm('Are you sure you want to delete this session? This action cannot be undone.')) {
      return
    }

    try {
      // Optimistic update
      setSessions(prev => prev.filter(s => s.id !== id))

      const response = await fetch(`/api/sessions/${id}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        throw new Error('Failed to delete session')
      }
      toast.success('Session deleted')
    } catch (error) {
      console.error('Error deleting session:', error)
      toast.error('Failed to delete session')
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
      alert('Failed to download transcript')
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

  // Helper to get audio duration
  const getAudioDuration = (file: File): Promise<number> => {
    return new Promise((resolve) => {
      const audio = document.createElement('audio')
      audio.preload = 'metadata'
      audio.onloadedmetadata = () => {
        URL.revokeObjectURL(audio.src)
        resolve(Math.floor(audio.duration))
      }
      audio.onerror = () => {
        resolve(0) // Default to 0 if can't read
      }
      audio.src = URL.createObjectURL(file)
    })
  }

  const filteredSessions = sessions.filter(session => 
    searchQuery === "" || 
    session.filename.toLowerCase().includes(searchQuery.toLowerCase()) ||
    session.language.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (adminView && session.ownerEmail?.toLowerCase().includes(searchQuery.toLowerCase()))
  )

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Sessions</h1>
          <p className="text-sm text-muted-foreground">
            Record or upload audio to transcribe
          </p>
        </div>
      </div>

      {/* Record Bar + Upload Section - Same Height */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
                  <p className="text-sm font-medium text-foreground">Recording...</p>
                  <p className="text-lg font-mono font-semibold text-destructive">
                    {formatDuration(recordingTime)}
                  </p>
                </>
              ) : (
                <>
                  <p className="text-sm font-medium text-foreground">Start Recording</p>
                  <p className="text-xs text-muted-foreground">Batch or real-time mode</p>
                </>
              )}
            </div>
          </div>
          
          <Button 
            size="sm" 
            className="shrink-0"
            onClick={() => window.location.href = '/record'}
          >
            <Mic className="h-4 w-4 mr-2" />
            Record
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
                  <p className="text-sm font-medium text-foreground">Upload</p>
                  <p className="text-xs text-muted-foreground">Audio or transcript files</p>
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
              {/* Language Selection */}
              <div>
                <label htmlFor="upload-language" className="text-xs font-medium text-muted-foreground mb-1.5 block">
                  Recording Language
                </label>
                <select
                  id="upload-language"
                  value={language}
                  onChange={(e) => setLanguage(e.target.value)}
                  disabled={uploadingFiles}
                  className="w-full p-2 border rounded-md text-sm bg-background"
                >
                  <option value="en">English</option>
                  <option value="de">German (Deutsch)</option>
                  <option value="es">Spanish (Español)</option>
                  <option value="fr">French (Français)</option>
                  <option value="it">Italian (Italiano)</option>
                  <option value="pt">Portuguese (Português)</option>
                  <option value="nl">Dutch (Nederlands)</option>
                  <option value="pl">Polish (Polski)</option>
                </select>
              </div>

              {/* Upload Areas - Split */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Upload Audio - label makes tap work on mobile without drag-drop */}
                <label
                  htmlFor="audio-file-input"
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
                        <p className="text-xs font-medium text-foreground">Uploading...</p>
                      </>
                    ) : (
                      <>
                        <FileAudio className="h-7 w-7 text-muted-foreground mb-2" />
                        <p className="text-sm font-medium text-foreground">Upload audio</p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          MP3, WAV, MP4, M4A
                        </p>
                        <p className="text-xs text-primary font-medium mt-1">
                          Tap to choose
                        </p>
                      </>
                    )}
                  </div>
                </label>

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
                  <label
                    htmlFor="transcript-file-input"
                    className="flex flex-col items-center justify-center cursor-pointer touch-manipulation flex-1 min-h-0"
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
                        <p className="text-xs font-medium text-foreground">Importing...</p>
                      </>
                    ) : (
                      <>
                        <FileText className="h-7 w-7 text-muted-foreground mb-2" />
                        <p className="text-sm font-medium text-foreground">Upload file</p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          TXT, SRT, VTT • or paste chat
                        </p>
                        <p className="text-xs text-primary font-medium mt-1">
                          Tap to choose • or paste (⌘V)
                        </p>
                      </>
                    )}
                  </label>
                  {!uploadingTranscript && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={handlePasteTranscript}
                    >
                      Paste from clipboard
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </CollapsibleContent>
        </Collapsible>
      </div>

      {/* Sessions List */}
      <Card className="border-border">
        {/* Compact Header with Search + Admin Toggle */}
        <div className="flex items-center justify-between gap-3 px-4 py-2 border-b border-border">
          <div className="flex items-center gap-4">
            <h2 className="text-sm font-medium text-foreground whitespace-nowrap">
              Recent Sessions
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
                  All users
                </Label>
              </div>
            )}
          </div>
          <div className="relative flex-1 max-w-xs">
            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Search sessions..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-8 pl-8 text-sm bg-secondary border-0"
            />
          </div>
        </div>
        
        {/* Mobile: Card List */}
        <div className="md:hidden divide-y divide-border">
          {loading ? (
            <div className="p-8 text-center">
              <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-current border-r-transparent"></div>
              <p className="mt-2 text-sm text-muted-foreground">Loading sessions...</p>
            </div>
          ) : filteredSessions.length === 0 ? (
            <div className="p-8 text-center text-sm text-muted-foreground">
              No sessions found
            </div>
          ) : (
            filteredSessions.map((session: Session) => {
              const status = statusConfig[session.status as SessionStatus]
              return (
                <div
                  key={session.id}
                  className="p-3 hover:bg-secondary/50 transition-colors cursor-pointer"
                  onClick={(e) => {
                    // Only navigate if clicking the card itself, not buttons/interactive elements
                    const target = e.target as HTMLElement
                    if (
                      !target.closest('button') && 
                      !target.closest('input') &&
                      !target.closest('[role="menu"]') &&
                      !target.closest('[role="menuitem"]')
                    ) {
                      window.location.href = `/sessions/${session.id}`
                    }
                  }}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <EditableSessionName 
                        session={session} 
                        onSave={handleRenameSession} 
                      />
                      <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {formatDuration(session.duration)}
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
                      <div className="flex items-center gap-2 mt-2">
                        <Badge 
                          variant={status.variant}
                          className={cn("text-[10px]", status.className)}
                        >
                          {status.animated && <span className="inline-block w-1.5 h-1.5 rounded-full bg-current mr-1 animate-ping" />}
                          {status.label}
                        </Badge>
                        {session.piiRedactionEnabled && (
                          <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-5">
                            <Shield className="h-3 w-3 mr-1" />
                            PII
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
                          <span className="hidden">Open menu</span>
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => handleDownloadTranscript(session)}>
                          <Download className="mr-2 h-4 w-4" />
                          Transcript
                        </DropdownMenuItem>
                        <DropdownMenuItem 
                          className="text-destructive"
                          onClick={() => handleDeleteSession(session.id)}
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          Delete
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
        <div className="hidden md:block">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="text-muted-foreground">Name</TableHead>
                {adminView && (
                  <TableHead className="text-muted-foreground">Owner</TableHead>
                )}
                <TableHead className="text-muted-foreground">Duration</TableHead>
                <TableHead className="text-muted-foreground">Language</TableHead>
                <TableHead className="text-muted-foreground">Status</TableHead>
                <TableHead className="text-muted-foreground">Created</TableHead>
                <TableHead className="text-muted-foreground text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={adminView ? 7 : 6} className="text-center py-8">
                    <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-current border-r-transparent"></div>
                    <p className="mt-2 text-sm text-muted-foreground">Loading sessions...</p>
                  </TableCell>
                </TableRow>
              ) : filteredSessions.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={adminView ? 7 : 6} className="text-center text-sm text-muted-foreground py-8">
                    No sessions found
                  </TableCell>
                </TableRow>
              ) : (
                filteredSessions.map((session: Session) => {
                  const status = statusConfig[session.status as SessionStatus]
                  return (
                    <TableRow 
                      key={session.id} 
                      className="group cursor-pointer"
                      onClick={(e) => {
                        // Only navigate if clicking the row itself, not buttons/interactive elements
                        const target = e.target as HTMLElement
                        if (
                          !target.closest('button') && 
                          !target.closest('input') &&
                          !target.closest('[role="menu"]') &&
                          !target.closest('[role="menuitem"]')
                        ) {
                          window.location.href = `/sessions/${session.id}`
                        }
                      }}
                    >
                      <TableCell>
                        <div className="flex flex-col">
                          <EditableSessionName 
                            session={session} 
                            onSave={handleRenameSession} 
                          />
                          <div className="flex items-center gap-2 mt-1">
                            {session.piiRedactionEnabled && (
                              <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-5">
                                <Shield className="h-3 w-3 mr-1" />
                                PII Redacted
                              </Badge>
                            )}
                            {session.isOfflineCached && (
                              <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-5">
                                <WifiOff className="h-3 w-3 mr-1" />
                                Cached
                              </Badge>
                            )}
                            {(session.outputCount ?? 0) > 0 && (
                              <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-5 bg-info/20 text-info border-info/30">
                                <FileText className="h-3 w-3 mr-1" />
                                {session.outputCount} {session.outputCount === 1 ? 'Output' : 'Outputs'}
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
                          <Clock className="h-3.5 w-3.5" />
                          <span className="text-sm">{formatDuration(session.duration)}</span>
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
                            {status.label}
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
                              <span className="hidden">Open menu</span>
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => handleDownloadTranscript(session)}>
                              <Download className="mr-2 h-4 w-4" />
                              Transcript
                            </DropdownMenuItem>
                            <DropdownMenuItem 
                              className="text-destructive"
                              onClick={() => handleDeleteSession(session.id)}
                            >
                              <Trash2 className="mr-2 h-4 w-4" />
                              Delete
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
    </div>
  )
}
