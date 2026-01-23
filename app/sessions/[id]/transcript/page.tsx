'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { TranscriptViewer } from '@/components/transcript/TranscriptViewer'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import { Session, Transcript } from '@/lib/types/database'
import { Loader2, ArrowLeft, Eye, EyeOff } from 'lucide-react'
import { useAuth } from '@/lib/auth/AuthProvider'
import { Card, CardContent } from '@/components/ui/card'

export default function TranscriptPage() {
  const params = useParams()
  const router = useRouter()
  const sessionId = params.id as string
  const { profile } = useAuth()

  const [session, setSession] = useState<Session | null>(null)
  const [transcript, setTranscript] = useState<Transcript | null>(null)
  const [loading, setLoading] = useState(true)
  const [showRaw, setShowRaw] = useState(true) // Changed: Now shows raw by default

  useEffect(() => {
    loadData()
  }, [sessionId])

  const loadData = async () => {
    try {
      const [sessionRes, transcriptRes] = await Promise.all([
        fetch(`/api/sessions/${sessionId}`),
        fetch(`/api/sessions/${sessionId}/transcript`),
      ])

      if (sessionRes.ok) {
        const sessionData = await sessionRes.json()
        setSession(sessionData)
      }

      if (transcriptRes.ok) {
        const transcriptData = await transcriptRes.json()
        setTranscript(transcriptData)
      } else {
        toast.error('Transkript nicht gefunden')
        router.push(`/sessions/${sessionId}`)
      }
    } catch (error) {
      toast.error('Fehler beim Laden der Daten')
    } finally {
      setLoading(false)
    }
  }

  if (loading || !session || !transcript) {
    return (
      <DashboardLayout>
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-slate-600" />
        </div>
      </DashboardLayout>
    )
  }

  const segments = showRaw ? transcript.raw_json : transcript.redacted_json

  return (
    <DashboardLayout>
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => router.push(`/sessions/${sessionId}`)}
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <h1 className="text-3xl font-bold text-slate-900">Transkript</h1>
              <p className="text-slate-600 mt-1">
                {session.internal_case_id || `Sitzung ${session.id.slice(0, 8)}`}
              </p>
            </div>
          </div>

          <Button
            variant={showRaw ? 'outline' : 'secondary'}
            onClick={() => setShowRaw(!showRaw)}
          >
            {showRaw ? (
              <>
                <EyeOff className="mr-2 h-4 w-4" />
                PII-redaktierte Version
              </>
            ) : (
              <>
                <Eye className="mr-2 h-4 w-4" />
                Vollständige Version
              </>
            )}
          </Button>
        </div>

        {!showRaw && (
          <Card className="border-amber-200 bg-amber-50">
            <CardContent className="pt-6">
              <p className="text-sm text-amber-800">
                <strong>Hinweis:</strong> Sie sehen eine PII-redaktierte Version mit automatischen 
                Platzhaltern ([NAME_X], etc.). Diese Funktion befindet sich in der Entwicklung und 
                kann falsch-positive Treffer enthalten. Verwenden Sie die vollständige Version für 
                genaue Informationen.
              </p>
            </CardContent>
          </Card>
        )}

        <TranscriptViewer segments={segments} showRaw={showRaw} />

        <div className="flex justify-center gap-4">
          <Button
            variant="outline"
            onClick={() => router.push(`/sessions/${sessionId}`)}
          >
            Zurück zur Sitzung
          </Button>
          <Button onClick={() => router.push(`/sessions/${sessionId}/report`)}>
            Zum Bericht
          </Button>
        </div>
      </div>
    </DashboardLayout>
  )
}
