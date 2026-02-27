'use client'
export const dynamic = 'force-dynamic'

import { useState, useEffect } from 'react'
import { useRouter } from '@/i18n/navigation'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { Upload, Loader2, Clock, Check, AlertCircle, Download, ArrowLeft } from 'lucide-react'
import { toast } from 'sonner'
import { localStorageService, LocalRecording } from '@/lib/services/local-storage'
import { useAuth } from '@/lib/auth/AuthProvider'
import { createClient } from '@/lib/supabase/client'
import { getStorageMimeType } from '@/lib/utils/audio-format-detector'
import { uploadToStorage } from '@/lib/utils/resumable-upload'
interface UploadStatus {
  id: string
  status: 'pending' | 'uploading' | 'success' | 'error'
  sessionId?: string
  error?: string
}

export default function UploadRecordingsPage() {
  const [recordings, setRecordings] = useState<LocalRecording[]>([])
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [uploadStatuses, setUploadStatuses] = useState<Map<string, UploadStatus>>(new Map())
  const [uploading, setUploading] = useState(false)
  const [language, setLanguage] = useState<string>('auto')
  const router = useRouter()
  const { user, loading } = useAuth()

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login?redirect=/record/upload')
      return
    }

    if (user) {
      loadRecordings()
      fetchUserPreferences()
    }
  }, [user, loading])

  // Fetch user profile to get default language
  const fetchUserPreferences = async () => {
    if (!user) return
    
    try {
      const response = await fetch('/api/profile')
      if (response.ok) {
        const profile = await response.json()
        setLanguage(profile.default_recording_language || 'auto')
      }
    } catch (error) {
      console.error('Error fetching user preferences:', error)
      // Keep default 'de' if fetch fails
    }
  }

  const loadRecordings = async () => {
    try {
      const recs = await localStorageService.getAllRecordings()
      recs.sort((a, b) => b.timestamp - a.timestamp)
      setRecordings(recs)
      
      // Select all by default
      setSelectedIds(new Set(recs.map(r => r.id)))
    } catch (error) {
      console.error('Failed to load recordings:', error)
      toast.error('Failed to load recordings')
    }
  }

  const toggleSelection = (id: string) => {
    const newSet = new Set(selectedIds)
    if (newSet.has(id)) {
      newSet.delete(id)
    } else {
      newSet.add(id)
    }
    setSelectedIds(newSet)
  }

  const uploadRecording = async (recording: LocalRecording, language: string = 'auto'): Promise<string> => {
    const supabase = createClient()
    const timestamp = new Date(recording.timestamp).toLocaleString('en-US', {
      month: '2-digit',
      day: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
    const sessionName = `Recording ${timestamp}`
    const extension = recording.mimeType.split('/')[1] || 'webm'
    const filename = `recording_${timestamp.replace(/[/,]/g, '-')}.${extension}`

    // 1. Create session via API
    const createRes = await fetch('/api/sessions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        internal_case_id: sessionName,
        language: language,
      }),
    })
    if (!createRes.ok) {
      const err = await createRes.json().catch(() => ({}))
      throw new Error(err.error || 'Failed to create session')
    }
    const session = await createRes.json()

    try {
      // 2. Upload directly to Supabase Storage (bypasses API route body size limits)
      const file = new File([recording.blob], filename, { type: recording.mimeType, lastModified: recording.timestamp })
      const storagePath = `${session.id}_${Date.now()}_0.${extension}`
      const storageContentType = getStorageMimeType(file)

      try {
        await uploadToStorage(supabase, 'rohbericht-audio', storagePath, file, {
          contentType: storageContentType,
        })
      } catch (storageError: any) {
        const sizeMB = Math.round(file.size / 1024 / 1024)
        const msg = storageError.message?.includes('maximum allowed size')
          ? `File too large (${sizeMB} MB). Please try a shorter recording.`
          : `Upload failed: ${storageError.message}`
        throw new Error(msg)
      }

      const { data: { publicUrl } } = supabase.storage
        .from('rohbericht-audio')
        .getPublicUrl(storagePath)

      // 3. Create file record in DB
      const { error: fileError } = await supabase
        .from('files')
        .insert({
          session_id: session.id,
          storage_path: storagePath,
          original_filename: filename,
          mime_type: storageContentType,
          size_bytes: file.size,
          file_purpose: 'meeting',
          upload_status: 'completed',
        })

      if (fileError) throw new Error(`Failed to create file record: ${fileError.message}`)

      // 4. Update session with audio URL and duration
      const durationSec = Math.round(recording.duration)
      const recordedAt = new Date(recording.timestamp).toISOString()
      await supabase
        .from('sessions')
        .update({
          audio_url: publicUrl,
          duration_sec: durationSec,
          status: 'created',
          recorded_at: recordedAt,
        })
        .eq('id', session.id)

      // 5. Trigger transcription
      const transcribeRes = await fetch(`/api/sessions/${session.id}/transcribe`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ language }),
      })
      if (!transcribeRes.ok) {
        console.error('Transcription trigger failed:', await transcribeRes.text())
      }

      return session.id
    } catch (err) {
      // Mark session as error so it's visible to the user
      await supabase
        .from('sessions')
        .update({ status: 'error', last_error: err instanceof Error ? err.message : 'Upload failed' })
        .eq('id', session.id)
      throw err
    }
  }

  const handleUpload = async () => {
    if (selectedIds.size === 0) {
      toast.error('No recordings selected')
      return
    }

    setUploading(true)
    const statuses = new Map<string, UploadStatus>()

    // Convert Set to Array for iteration
    const selectedIdsArray = Array.from(selectedIds)

    selectedIdsArray.forEach(id => {
      statuses.set(id, { id, status: 'pending' })
    })
    setUploadStatuses(new Map(statuses))

    let successCount = 0
    let errorCount = 0
    let lastSessionId: string | undefined

    for (let i = 0; i < selectedIdsArray.length; i++) {
      const id = selectedIdsArray[i]
      try {
        statuses.set(id, { id, status: 'uploading' })
        setUploadStatuses(new Map(statuses))

        const recording = await localStorageService.getRecording(id)
        if (!recording) throw new Error('Recording not found')

        const sessionId = await uploadRecording(recording, language)
        lastSessionId = sessionId

        statuses.set(id, { id, status: 'success', sessionId })
        setUploadStatuses(new Map(statuses))

        // Delete from local storage after successful upload
        await localStorageService.deleteRecording(id)
        successCount++
      } catch (error: any) {
        console.error('Upload failed:', error)
        statuses.set(id, { id, status: 'error', error: error.message })
        setUploadStatuses(new Map(statuses))
        errorCount++
      }
    }

    setUploading(false)

    if (successCount > 0) {
      toast.success(`${successCount} recording(s) uploaded successfully`)
      
      // Reload recordings list
      await loadRecordings()
      
      // Navigate to sessions list after short delay
      setTimeout(() => {
        if (lastSessionId && successCount === 1) {
          router.push(`/sessions/${lastSessionId}`)
        } else {
          router.push('/sessions')
        }
      }, 2000)
    }

    if (errorCount > 0) {
      toast.error(`${errorCount} recording(s) failed to upload`)
    }
  }

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp)
    return date.toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
  }

  const handleSaveToDevice = async (rec: LocalRecording) => {
    try {
      // Use .weba for audio-only WebM so it shows as audio, not video
      const isAudio = rec.mimeType?.startsWith('audio/')
      const ext = isAudio && rec.mimeType?.includes('webm')
        ? 'weba'
        : rec.mimeType?.split('/')[1]?.replace(/;.*/, '') || 'webm'
      const date = new Date(rec.timestamp).toLocaleString('en-US', {
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      }).replace(/[/,]/g, '-')
      const filename = `Recording ${date}.${ext}`
      const file = new File([rec.blob], filename, { type: rec.mimeType })

      if (navigator.share && /iPhone|iPad|Android/i.test(navigator.userAgent)) {
        await navigator.share({
          files: [file],
          title: filename,
        })
        toast.success("Choose 'Save to Files' to pick a folder, or share to another app", { duration: 5000 })
      } else {
        const url = URL.createObjectURL(rec.blob)
        const a = document.createElement('a')
        a.href = url
        a.download = filename
        a.click()
        URL.revokeObjectURL(url)
        toast.success('Saved to your Downloads folder')
      }
    } catch (err) {
      if ((err as Error)?.name === 'AbortError') return
      toast.error('Failed to save file')
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50 p-4">
      <div className="max-w-2xl mx-auto space-y-4">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={() => router.back()} aria-label="Back">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Upload Recordings</h1>
            <p className="text-sm text-slate-600">
              Select recordings to upload and create new sessions
            </p>
          </div>
        </div>

        {/* Language Selection */}
        {recordings.length > 0 && (
          <Card className="p-4">
            <Label htmlFor="language" className="text-sm font-medium mb-2 block">
              Recording Language
            </Label>
            <select
              id="language"
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
              disabled={uploading}
              className="w-full p-2 border rounded-md text-sm"
            >
              <option value="auto">Auto-detect</option>
              <option value="en">English</option>
              <option value="de">German (Deutsch)</option>
              <option value="es">Spanish (Español)</option>
              <option value="fr">French (Français)</option>
              <option value="it">Italian (Italiano)</option>
              <option value="pt">Portuguese (Português)</option>
              <option value="nl">Dutch (Nederlands)</option>
              <option value="pl">Polish (Polski)</option>
            </select>
          </Card>
        )}

        {/* Recordings List */}
        {recordings.length > 0 ? (
          <div className="space-y-2">
            {recordings.map((rec) => {
              const status = uploadStatuses.get(rec.id)
              return (
                <Card key={rec.id} className="p-4">
                  <div className="flex items-center gap-3">
                    <Checkbox
                      checked={selectedIds.has(rec.id)}
                      onCheckedChange={() => toggleSelection(rec.id)}
                      disabled={uploading}
                    />
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <Clock className="h-4 w-4 text-slate-400" />
                        <span className="text-sm font-medium">{formatDuration(rec.duration)}</span>
                      </div>
                      <p className="text-xs text-slate-500">{formatDate(rec.timestamp)}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => handleSaveToDevice(rec)}
                        disabled={uploading}
                        className="h-8 w-8 shrink-0"
                        title="Save to device"
                        aria-label="Save to device"
                      >
                        <Download className="h-4 w-4" />
                      </Button>
                      {status && (
                        <>
                          {status.status === 'uploading' && (
                            <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
                          )}
                          {status.status === 'success' && (
                            <Check className="h-5 w-5 text-green-500" />
                          )}
                          {status.status === 'error' && (
                            <AlertCircle className="h-5 w-5 text-red-500" />
                          )}
                        </>
                      )}
                    </div>
                  </div>
                </Card>
              )
            })}
          </div>
        ) : (
          <Card className="p-8 text-center">
            <p className="text-slate-600">No recordings to upload</p>
            <Button variant="link" onClick={() => router.push('/record')}>
              Back to Recording
            </Button>
          </Card>
        )}

        {/* Upload Button */}
        {recordings.length > 0 && (
          <Button
            size="lg"
            className="w-full"
            onClick={handleUpload}
            disabled={uploading || selectedIds.size === 0}
          >
            {uploading ? (
              <>
                <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                Uploading...
              </>
            ) : (
              <>
                <Upload className="h-5 w-5 mr-2" />
                Upload {selectedIds.size} Recording{selectedIds.size !== 1 ? 's' : ''}
              </>
            )}
          </Button>
        )}
      </div>
    </div>
  )
}
