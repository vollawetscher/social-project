'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { GespraechsberichtViewer } from '@/components/report/GespraechsberichtViewer'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import { Session, Report } from '@/lib/types/database'
import { Loader2, ArrowLeft, Download } from 'lucide-react'

export default function ReportPage() {
  const params = useParams()
  const router = useRouter()
  const sessionId = params.id as string

  const [session, setSession] = useState<Session | null>(null)
  const [report, setReport] = useState<Report | null>(null)
  const [loading, setLoading] = useState(true)
  const [downloading, setDownloading] = useState(false)

  useEffect(() => {
    loadData()
  }, [sessionId])

  const loadData = async () => {
    try {
      const [sessionRes, reportRes] = await Promise.all([
        fetch(`/api/sessions/${sessionId}`),
        fetch(`/api/sessions/${sessionId}/report`),
      ])

      if (sessionRes.ok) {
        const sessionData = await sessionRes.json()
        setSession(sessionData)
      }

      if (reportRes.ok) {
        const reportData = await reportRes.json()
        setReport(reportData)
      } else {
        toast.error('Bericht nicht gefunden')
        router.push(`/sessions/${sessionId}`)
      }
    } catch (error) {
      toast.error('Fehler beim Laden der Daten')
    } finally {
      setLoading(false)
    }
  }

  const handleDownloadPDF = async () => {
    setDownloading(true)
    try {
      const response = await fetch(`/api/sessions/${sessionId}/export-pdf`)

      if (!response.ok) {
        throw new Error('PDF export failed')
      }

      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `gespraechsbericht-${session?.internal_case_id || sessionId}.pdf`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)

      toast.success('PDF heruntergeladen')
    } catch (error) {
      toast.error('Fehler beim PDF-Export')
    } finally {
      setDownloading(false)
    }
  }

  if (loading || !session || !report) {
    return (
      <DashboardLayout>
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-slate-600" />
        </div>
      </DashboardLayout>
    )
  }

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
              <h1 className="text-3xl font-bold text-slate-900">Gesprächsbericht</h1>
              <p className="text-slate-600 mt-1">
                {session.internal_case_id || `Sitzung ${session.id.slice(0, 8)}`}
              </p>
            </div>
          </div>

          <Button onClick={handleDownloadPDF} disabled={downloading}>
            {downloading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Wird erstellt...
              </>
            ) : (
              <>
                <Download className="mr-2 h-4 w-4" />
                Als PDF exportieren
              </>
            )}
          </Button>
        </div>

        <GespraechsberichtViewer gespraechsbericht={report.claude_json} />

        <div className="flex justify-center gap-4">
          <Button
            variant="outline"
            onClick={() => router.push(`/sessions/${sessionId}/transcript`)}
          >
            Zum Transkript
          </Button>
          <Button
            variant="outline"
            onClick={() => router.push(`/sessions/${sessionId}`)}
          >
            Zurück zur Sitzung
          </Button>
        </div>
      </div>
    </DashboardLayout>
  )
}
