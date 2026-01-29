'use client'

import { useState, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Mic, Square, Loader2, Save, Sparkles } from 'lucide-react'
import { toast } from 'sonner'

interface TranscribableTextFieldProps {
  title: string
  description: string
  icon: React.ReactNode
  value: string
  placeholder: string
  sessionId: string
  fieldName: 'context_text' | 'private_comments' | 'instructions'
  onSave: (value: string) => Promise<void>
  onAnalyze?: () => Promise<void>
  showAnalyzeButton?: boolean
  analyzing?: boolean
}

export function TranscribableTextField({
  title,
  description,
  icon,
  value,
  placeholder,
  sessionId,
  fieldName,
  onSave,
  onAnalyze,
  showAnalyzeButton = false,
  analyzing = false,
}: TranscribableTextFieldProps) {
  const [text, setText] = useState(value)
  const [recording, setRecording] = useState(false)
  const [transcribing, setTranscribing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [hasChanges, setHasChanges] = useState(false)
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mediaRecorder = new MediaRecorder(stream)
      mediaRecorderRef.current = mediaRecorder
      chunksRef.current = []

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data)
        }
      }

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(chunksRef.current, { type: 'audio/webm' })
        stream.getTracks().forEach((track) => track.stop())
        await transcribeAudio(audioBlob)
      }

      mediaRecorder.start()
      setRecording(true)
      toast.success('Aufnahme gestartet')
    } catch (error) {
      console.error('Recording error:', error)
      toast.error('Fehler beim Starten der Aufnahme')
    }
  }

  const stopRecording = () => {
    if (mediaRecorderRef.current && recording) {
      mediaRecorderRef.current.stop()
      setRecording(false)
      toast.success('Aufnahme gestoppt - transkribiere...')
    }
  }

  const transcribeAudio = async (audioBlob: Blob) => {
    setTranscribing(true)
    console.log('[Transcribe] Starting, blob size:', audioBlob.size)
    
    try {
      const formData = new FormData()
      formData.append('file', audioBlob, 'recording.webm')
      formData.append('purpose', 'context') // Use 'context' as placeholder

      console.log('[Transcribe] Sending to API...')
      const response = await fetch(`/api/sessions/${sessionId}/transcribe`, {
        method: 'POST',
        body: formData,
      })

      if (!response.ok) {
        const error = await response.json()
        console.error('[Transcribe] API Error:', error)
        throw new Error('Transcription failed: ' + (error.error || response.statusText))
      }

      const data = await response.json()
      console.log('[Transcribe] Response:', data)
      
      const transcriptText = data.transcript?.results?.map((r: any) => r.alternatives[0].content).join(' ') || ''
      console.log('[Transcribe] Extracted text length:', transcriptText.length)
      
      if (!transcriptText) {
        toast.error('Keine Sprache erkannt - versuche es nochmal')
        return
      }
      
      // Append to existing text
      const newText = text ? `${text}\n\n${transcriptText}` : transcriptText
      setText(newText)
      setHasChanges(true)
      toast.success(`✅ Transkription hinzugefügt (${transcriptText.length} Zeichen)`)
    } catch (error: any) {
      console.error('Transcription error:', error)
      toast.error(error.message || 'Fehler bei der Transkription')
    } finally {
      setTranscribing(false)
    }
  }

  const handleTextChange = (newText: string) => {
    setText(newText)
    setHasChanges(newText !== value)
  }

  const handleSave = async () => {
    setSaving(true)
    console.log('[TranscribableField] Saving:', fieldName, 'Length:', text.length)
    
    try {
      await onSave(text)
      setHasChanges(false)
      toast.success('✅ Gespeichert!')
    } catch (error: any) {
      console.error('[TranscribableField] Save error:', error)
      toast.error('❌ Fehler beim Speichern: ' + (error.message || 'Unbekannt'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {icon}
            <CardTitle>{title}</CardTitle>
          </div>
          <div className="flex items-center gap-2">
            {recording ? (
              <Button onClick={stopRecording} variant="destructive" size="sm">
                <Square className="mr-2 h-4 w-4" />
                Stop
              </Button>
            ) : (
              <Button 
                onClick={startRecording} 
                variant="outline" 
                size="sm"
                disabled={transcribing}
              >
                <Mic className="mr-2 h-4 w-4" />
                Diktieren
              </Button>
            )}
            {showAnalyzeButton && onAnalyze && text && (
              <Button
                onClick={onAnalyze}
                disabled={analyzing || hasChanges}
                size="sm"
                variant={hasChanges ? "ghost" : "default"}
              >
                {analyzing ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Sparkles className="mr-2 h-4 w-4" />
                )}
                {analyzing ? 'Analysiert...' : '🪄 Strukturieren'}
              </Button>
            )}
          </div>
        </div>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {transcribing && (
          <div className="flex items-center gap-2 text-sm text-blue-600">
            <Loader2 className="h-4 w-4 animate-spin" />
            Transkribiere Audio...
          </div>
        )}
        
        <Textarea
          value={text}
          onChange={(e) => handleTextChange(e.target.value)}
          placeholder={placeholder}
          className="min-h-[120px] font-mono text-sm"
          disabled={recording || transcribing}
        />

        {hasChanges && (
          <Button onClick={handleSave} disabled={saving} size="sm">
            {saving ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Save className="mr-2 h-4 w-4" />
            )}
            Speichern
          </Button>
        )}
      </CardContent>
    </Card>
  )
}
