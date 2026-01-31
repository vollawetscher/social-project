'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { Upload, Loader2, Clock, Check, AlertCircle } from 'lucide-react'
import { toast } from 'sonner'
import { localStorageService, LocalRecording } from '@/lib/services/local-storage'
import { useAuth } from '@/lib/auth/AuthProvider'
import { createClient } from '@/lib/supabase/client'

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
  const [cases, setCases] = useState<any[]>([])
  const [selectedCaseId, setSelectedCaseId] = useState<string>('')
  const router = useRouter()
  const { user, loading } = useAuth()
  const supabase = createClient()

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login?redirect=/record/upload')
      return
    }

    if (user) {
      loadRecordings()
      loadCases()
    }
  }, [user, loading])

  const loadRecordings = async () => {
    try {
      const recs = await localStorageService.getAllRecordings()
      recs.sort((a, b) => b.timestamp - a.timestamp)
      setRecordings(recs)
      
      // Select all by default
      setSelectedIds(new Set(recs.map(r => r.id)))
    } catch (error) {
      console.error('Failed to load recordings:', error)
      toast.error('Fehler beim Laden der Aufnahmen')
    }
  }

  const loadCases = async () => {
    try {
      const { data, error } = await supabase
        .from('cases')
        .select('id, title, client_name')
        .eq('user_id', user?.id)
        .order('created_at', { ascending: false })
        .limit(20)

      if (error) throw error
      setCases(data || [])
    } catch (error) {
      console.error('Failed to load cases:', error)
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

  const uploadRecording = async (recording: LocalRecording, caseId: string): Promise<string> => {
    // Create session
    const { data: session, error: sessionError } = await supabase
      .from('sessions')
      .insert({
        case_id: caseId,
        user_id: user?.id,
        duration_sec: recording.duration,
        status: 'pending',
      })
      .select()
      .single()

    if (sessionError) throw sessionError

    // Upload audio file
    const fileName = `${session.id}-meeting-${Date.now()}.${recording.mimeType.split('/')[1]}`
    const { error: uploadError } = await supabase.storage
      .from('rohbericht-audio')
      .upload(fileName, recording.blob, {
        contentType: recording.mimeType,
      })

    if (uploadError) throw uploadError

    // Create file record
    const { error: fileError } = await supabase
      .from('files')
      .insert({
        session_id: session.id,
        storage_path: fileName,
        mime_type: recording.mimeType,
        file_size: recording.size,
        file_purpose: 'meeting',
      })

    if (fileError) throw fileError

    return session.id
  }

  const handleUpload = async () => {
    if (selectedIds.size === 0) {
      toast.error('Keine Aufnahmen ausgewählt')
      return
    }

    if (!selectedCaseId) {
      toast.error('Bitte wähle einen Fall aus')
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

    for (let i = 0; i < selectedIdsArray.length; i++) {
      const id = selectedIdsArray[i]
      try {
        statuses.set(id, { id, status: 'uploading' })
        setUploadStatuses(new Map(statuses))

        const recording = await localStorageService.getRecording(id)
        if (!recording) throw new Error('Recording not found')

        const sessionId = await uploadRecording(recording, selectedCaseId)

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
      toast.success(`${successCount} Aufnahme(n) hochgeladen`)
      
      // Reload recordings list
      await loadRecordings()
      
      // Navigate to case after short delay
      setTimeout(() => {
        router.push(`/cases/${selectedCaseId}`)
      }, 2000)
    }

    if (errorCount > 0) {
      toast.error(`${errorCount} Aufnahme(n) fehlgeschlagen`)
    }
  }

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp)
    return date.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
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
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Aufnahmen hochladen</h1>
          <p className="text-sm text-slate-600">
            Wähle Aufnahmen aus und lade sie zu einem Fall hoch
          </p>
        </div>

        {/* Case Selection */}
        <Card className="p-4">
          <Label htmlFor="case-select" className="text-sm font-semibold mb-2 block">
            Fall auswählen
          </Label>
          <select
            id="case-select"
            className="w-full p-2 border rounded-md"
            value={selectedCaseId}
            onChange={(e) => setSelectedCaseId(e.target.value)}
            disabled={uploading}
          >
            <option value="">-- Fall wählen --</option>
            {cases.map((c) => (
              <option key={c.id} value={c.id}>
                {c.client_name || c.title}
              </option>
            ))}
          </select>
          {cases.length === 0 && (
            <p className="text-xs text-slate-500 mt-2">
              Keine Fälle gefunden. <Button variant="link" size="sm" onClick={() => router.push('/cases/new')}>Neuen Fall erstellen</Button>
            </p>
          )}
        </Card>

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
                    {status && (
                      <div className="flex items-center gap-2">
                        {status.status === 'uploading' && (
                          <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
                        )}
                        {status.status === 'success' && (
                          <Check className="h-5 w-5 text-green-500" />
                        )}
                        {status.status === 'error' && (
                          <AlertCircle className="h-5 w-5 text-red-500" />
                        )}
                      </div>
                    )}
                  </div>
                </Card>
              )
            })}
          </div>
        ) : (
          <Card className="p-8 text-center">
            <p className="text-slate-600">Keine Aufnahmen zum Hochladen</p>
            <Button variant="link" onClick={() => router.push('/record')}>
              Zurück zur Aufnahme
            </Button>
          </Card>
        )}

        {/* Upload Button */}
        {recordings.length > 0 && (
          <Button
            size="lg"
            className="w-full"
            onClick={handleUpload}
            disabled={uploading || selectedIds.size === 0 || !selectedCaseId}
          >
            {uploading ? (
              <>
                <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                Wird hochgeladen...
              </>
            ) : (
              <>
                <Upload className="h-5 w-5 mr-2" />
                {selectedIds.size} Aufnahme(n) hochladen
              </>
            )}
          </Button>
        )}
      </div>
    </div>
  )
}
