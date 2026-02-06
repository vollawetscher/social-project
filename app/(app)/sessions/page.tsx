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
import { Progress } from "@/components/ui/progress"
import type { SessionStatus, Session } from "@/lib/types-v0"
import { cn } from "@/lib/utils"

const statusConfig: Record<
  SessionStatus,
  { label: string; variant: "default" | "secondary" | "destructive" | "outline"; className?: string }
> = {
  uploading: { label: "Uploading", variant: "secondary", className: "bg-info/20 text-info border-info/30" },
  transcribing: { label: "Transcribing", variant: "secondary", className: "bg-warning/20 text-warning border-warning/30" },
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
      <Link
        href={`/sessions/${session.id}`}
        className="font-medium text-foreground truncate max-w-[180px] hover:underline"
      >
        {session.filename}
      </Link>
      <button
        onClick={(e) => {
          e.preventDefault()
          setIsEditing(true)
        }}
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
  const [isDragging, setIsDragging] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [sessions, setSessions] = useState<Session[]>([])
  const [loading, setLoading] = useState(true)
  const [isRecording, setIsRecording] = useState(false)
  const [recordingTime, setRecordingTime] = useState(0)
  const [uploadingFiles, setUploadingFiles] = useState(false)
  const [language, setLanguage] = useState<string>('en')
  const recordingIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const supabase = createClient()

  // Fetch real sessions from API
  const fetchSessions = async () => {
    try {
      const response = await fetch('/api/sessions?format=v0')
      if (!response.ok) throw new Error('Failed to fetch sessions')
      const data = await response.json()
      setSessions(data)
    } catch (error) {
      console.error('Error fetching sessions:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchSessions()
  }, [])

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

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
  }, [])

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (files) {
      handleFiles(Array.from(files))
    }
  }

  const handleFiles = async (files: File[]) => {
    const audioFiles = files.filter(file => 
      file.type.startsWith('audio/') || 
      /\.(mp3|wav|webm|m4a)$/i.test(file.name)
    )

    if (audioFiles.length === 0) {
      toast.error('Please select audio files (MP3, WAV, WebM, M4A)')
      return
    }

    setUploadingFiles(true)
    let successCount = 0
    let errorCount = 0

    for (const file of audioFiles) {
      try {
        // Create session
        const timestamp = new Date().toLocaleString('en-US', {
          month: '2-digit',
          day: '2-digit',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        })
        const sessionName = file.name.replace(/\.[^/.]+$/, '') || `Upload ${timestamp}`
        
        // Check if user is authenticated
        if (!user?.id) {
          throw new Error('You must be logged in to upload files')
        }

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
          console.error('Session creation error:', sessionError)
          throw new Error(`Failed to create session: ${sessionError.message}`)
        }

        // Upload file to storage
        const extension = file.name.split('.').pop() || 'mp3'
        const fileName = `${session.id}_${Date.now()}.${extension}`
        
        const { error: uploadError } = await supabase.storage
          .from('rohbericht-audio')
          .upload(fileName, file, {
            contentType: file.type || 'audio/mpeg',
            upsert: false
          })

        if (uploadError) {
          console.error('Storage upload error:', uploadError)
          throw new Error(`Failed to upload file: ${uploadError.message}`)
        }

        // Get public URL
        const { data: { publicUrl } } = supabase.storage
          .from('rohbericht-audio')
          .getPublicUrl(fileName)

        // Update session with audio URL
        const { error: updateError } = await supabase
          .from('sessions')
          .update({ audio_url: publicUrl })
          .eq('id', session.id)

        if (updateError) {
          console.error('Session update error:', updateError)
          throw new Error(`Failed to update session: ${updateError.message}`)
        }

        // Trigger transcription
        try {
          const transcribeRes = await fetch(`/api/sessions/${session.id}/transcribe`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              storage_path: fileName,
              language: language,
            }),
          })
          if (!transcribeRes.ok) {
            console.error('Transcription trigger failed:', await transcribeRes.text())
          }
        } catch (error) {
          console.error('Failed to trigger transcription:', error)
          // Don't fail the upload if transcription trigger fails
        }

        successCount++
      } catch (error: any) {
        console.error('Upload failed for', file.name, ':', error)
        toast.error(`Failed to upload ${file.name}: ${error.message || 'Unknown error'}`)
        errorCount++
      }
    }

    setUploadingFiles(false)
    setIsUploadOpen(false)

    if (successCount > 0) {
      toast.success(`${successCount} file(s) uploaded successfully`)
      // Refresh sessions list
      await fetchSessions()
    }

    if (errorCount > 0 && successCount === 0) {
      toast.error(`All uploads failed. Please check console for details.`)
    }
  }

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    
    const files = Array.from(e.dataTransfer.files)
    handleFiles(files)
  }, [language])

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
      // Revert optimistic update on error
      const response = await fetch('/api/sessions?format=v0')
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
    } catch (error) {
      console.error('Error deleting session:', error)
      // Revert optimistic update on error
      const response = await fetch('/api/sessions?format=v0')
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

  const filteredSessions = sessions.filter(session => 
    searchQuery === "" || 
    session.filename.toLowerCase().includes(searchQuery.toLowerCase()) ||
    session.language.toLowerCase().includes(searchQuery.toLowerCase())
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
                  : "bg-card border-border hover:border-muted-foreground"
              )}
            >
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-secondary flex items-center justify-center">
                  <Upload className="h-5 w-5 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground">Upload File</p>
                  <p className="text-xs text-muted-foreground">MP3, WAV, WebM, M4A</p>
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

              {/* Upload Area */}
              <div
                className={cn(
                  "border-2 border-dashed rounded-lg p-6 transition-colors cursor-pointer",
                  isDragging
                    ? "border-primary bg-primary/5"
                    : "border-border hover:border-muted-foreground",
                  uploadingFiles && "opacity-50 pointer-events-none"
                )}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="audio/*,.mp3,.wav,.webm,.m4a"
                  multiple
                  onChange={handleFileSelect}
                  className="hidden"
                />
                <div className="flex flex-col items-center text-center">
                  {uploadingFiles ? (
                    <>
                      <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-current border-r-transparent mb-3"></div>
                      <p className="text-sm font-medium text-foreground">Uploading...</p>
                    </>
                  ) : (
                    <>
                      <Upload className="h-8 w-8 text-muted-foreground mb-3" />
                      <p className="text-sm font-medium text-foreground mb-1">
                        Drag and drop or click to browse
                      </p>
                      <p className="text-xs text-muted-foreground">
                        MP3, WAV, WebM, M4A • Max 500MB
                      </p>
                    </>
                  )}
                </div>
              </div>
            </div>
          </CollapsibleContent>
        </Collapsible>
      </div>

      {/* Sessions List */}
      <Card className="border-border">
        {/* Compact Header with Search */}
        <div className="flex items-center justify-between gap-3 px-4 py-2 border-b border-border">
          <h2 className="text-sm font-medium text-foreground whitespace-nowrap">
            Recent Sessions
          </h2>
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
                  className="p-3 hover:bg-secondary/50 transition-colors"
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
                      <div className="flex items-center gap-2 mt-2">
                        <Badge
                          variant={status.variant}
                          className={cn("text-[10px]", status.className)}
                        >
                          {status.label}
                        </Badge>
                        {session.piiRedactionEnabled && (
                          <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-5">
                            <Shield className="h-3 w-3 mr-1" />
                            PII
                          </Badge>
                        )}
                      </div>
                      {(session.status === "uploading" || session.status === "transcribing") && (
                        <Progress value={session.status === "uploading" ? 65 : 40} className="h-1 w-full mt-2" />
                      )}
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0 shrink-0"
                        >
                          <MoreHorizontal className="h-4 w-4" />
                          <span className="sr-only">Open menu</span>
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem asChild>
                          <Link href={`/sessions/${session.id}`}>
                            <Eye className="mr-2 h-4 w-4" />
                            View
                          </Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleDownloadTranscript(session)}>
                          <Download className="mr-2 h-4 w-4" />
                          Download
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
                  <TableCell colSpan={6} className="text-center py-8">
                    <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-current border-r-transparent"></div>
                    <p className="mt-2 text-sm text-muted-foreground">Loading sessions...</p>
                  </TableCell>
                </TableRow>
              ) : filteredSessions.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-sm text-muted-foreground py-8">
                    No sessions found
                  </TableCell>
                </TableRow>
              ) : (
                filteredSessions.map((session: Session) => {
                  const status = statusConfig[session.status as SessionStatus]
                  return (
                    <TableRow key={session.id} className="group">
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
                          </div>
                        </div>
                      </TableCell>
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
                            {status.label}
                          </Badge>
                          {session.status === "uploading" && (
                            <Progress value={65} className="h-1 w-20" />
                          )}
                          {session.status === "transcribing" && (
                            <Progress value={40} className="h-1 w-20" />
                          )}
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
                              <span className="sr-only">Open menu</span>
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem asChild>
                              <Link href={`/sessions/${session.id}`}>
                                <Eye className="mr-2 h-4 w-4" />
                                View
                              </Link>
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleDownloadTranscript(session)}>
                          <Download className="mr-2 h-4 w-4" />
                          Download
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
    </div>
  )
}
