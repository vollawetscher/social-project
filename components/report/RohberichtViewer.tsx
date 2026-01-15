'use client'

import { RohberichtJSON } from '@/lib/types/database'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Copy, Check } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'

interface RohberichtViewerProps {
  rohbericht: RohberichtJSON
}

export function RohberichtViewer({ rohbericht }: RohberichtViewerProps) {
  const [copiedSections, setCopiedSections] = useState<Set<string>>(new Set())

  const copyToClipboard = async (text: string, sectionName: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopiedSections(new Set(copiedSections).add(sectionName))
      toast.success(`${sectionName} kopiert`)
      setTimeout(() => {
        setCopiedSections((prev) => {
          const next = new Set(prev)
          next.delete(sectionName)
          return next
        })
      }, 2000)
    } catch (error) {
      toast.error('Fehler beim Kopieren')
    }
  }

  const CopyButton = ({ text, section }: { text: string; section: string }) => (
    <Button
      variant="ghost"
      size="sm"
      onClick={() => copyToClipboard(text, section)}
    >
      {copiedSections.has(section) ? (
        <Check className="h-4 w-4 text-green-600" />
      ) : (
        <Copy className="h-4 w-4" />
      )}
    </Button>
  )

  const { rohbericht: report, summary_short, quality_notes } = rohbericht

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Zusammenfassung</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-start justify-between gap-4">
            <p className="text-slate-700 leading-relaxed">{summary_short}</p>
            <CopyButton text={summary_short} section="Zusammenfassung" />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Metadaten</CardTitle>
        </CardHeader>
        <CardContent className="grid md:grid-cols-2 gap-4">
          <div>
            <p className="text-sm font-medium text-slate-600">Datum</p>
            <p className="text-slate-900">{report.metadaten.datum}</p>
          </div>
          <div>
            <p className="text-sm font-medium text-slate-600">Dauer</p>
            <p className="text-slate-900">{report.metadaten.dauer}</p>
          </div>
          <div>
            <p className="text-sm font-medium text-slate-600">Setting</p>
            <p className="text-slate-900">{report.metadaten.setting}</p>
          </div>
          <div>
            <p className="text-sm font-medium text-slate-600">Beteiligte</p>
            <div className="flex flex-wrap gap-1 mt-1">
              {report.metadaten.beteiligte_rollen.map((rolle, idx) => (
                <Badge key={idx} variant="secondary">
                  {rolle}
                </Badge>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-start justify-between">
          <div>
            <CardTitle>Gesprächsverlauf</CardTitle>
            <CardDescription>Chronologischer Ablauf des Gesprächs</CardDescription>
          </div>
          <CopyButton
            text={report.gespraechsverlauf_kurz.map((p, i) => `${i + 1}. ${p}`).join('\n')}
            section="Gesprächsverlauf"
          />
        </CardHeader>
        <CardContent>
          <ul className="space-y-2 list-disc list-inside">
            {report.gespraechsverlauf_kurz.map((punkt, idx) => (
              <li key={idx} className="text-slate-700">{punkt}</li>
            ))}
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-start justify-between">
          <div>
            <CardTitle>Kernaussagen & Zitate</CardTitle>
            <CardDescription>Wichtige Aussagen mit Zeitstempel</CardDescription>
          </div>
          <CopyButton
            text={report.kernaussagen_zitate.map((z) => `[${z.timecode}] ${z.speaker}: "${z.quote}"`).join('\n\n')}
            section="Kernaussagen"
          />
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {report.kernaussagen_zitate.map((zitat, idx) => (
              <div key={idx} className="border-l-4 border-blue-500 pl-4 py-2 bg-slate-50 rounded-r">
                <div className="flex items-center gap-2 mb-2">
                  <Badge variant="outline">{zitat.timecode}</Badge>
                  <Badge variant="secondary">{zitat.speaker}</Badge>
                </div>
                <p className="text-slate-700 italic">"{zitat.quote}"</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-start justify-between">
          <div>
            <CardTitle>Beobachtungen</CardTitle>
            <CardDescription>Sachliche Feststellungen</CardDescription>
          </div>
          <CopyButton
            text={report.beobachtungen.map((b, i) => `${i + 1}. ${b}`).join('\n')}
            section="Beobachtungen"
          />
        </CardHeader>
        <CardContent>
          <ul className="space-y-2 list-disc list-inside">
            {report.beobachtungen.map((beobachtung, idx) => (
              <li key={idx} className="text-slate-700">{beobachtung}</li>
            ))}
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-start justify-between">
          <div>
            <CardTitle>Themen</CardTitle>
            <CardDescription>Hauptthemen des Gesprächs</CardDescription>
          </div>
          <CopyButton
            text={report.themen.join(', ')}
            section="Themen"
          />
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {report.themen.map((thema, idx) => (
              <Badge key={idx} variant="outline" className="text-sm">
                {thema}
              </Badge>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card className="border-green-200 bg-green-50">
        <CardHeader className="flex flex-row items-start justify-between">
          <div>
            <CardTitle className="text-green-900">Ressourcen & Schutzfaktoren</CardTitle>
            <CardDescription>Stärken und unterstützende Faktoren</CardDescription>
          </div>
          <CopyButton
            text={report.ressourcen_und_schutzfaktoren.map((r, i) => `${i + 1}. ${r}`).join('\n')}
            section="Ressourcen"
          />
        </CardHeader>
        <CardContent>
          <ul className="space-y-2 list-disc list-inside">
            {report.ressourcen_und_schutzfaktoren.map((ressource, idx) => (
              <li key={idx} className="text-green-900">{ressource}</li>
            ))}
          </ul>
        </CardContent>
      </Card>

      <Card className="border-orange-200 bg-orange-50">
        <CardHeader className="flex flex-row items-start justify-between">
          <div>
            <CardTitle className="text-orange-900">Belastungen & Risikoindikatoren</CardTitle>
            <CardDescription>Als Beobachtungen formuliert, nicht diagnostisch</CardDescription>
          </div>
          <CopyButton
            text={report.belastungen_und_risikoindikatoren.map((b, i) => `${i + 1}. ${b}`).join('\n')}
            section="Belastungen"
          />
        </CardHeader>
        <CardContent>
          <ul className="space-y-2 list-disc list-inside">
            {report.belastungen_und_risikoindikatoren.map((belastung, idx) => (
              <li key={idx} className="text-orange-900">{belastung}</li>
            ))}
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-start justify-between">
          <div>
            <CardTitle>Offene Punkte</CardTitle>
            <CardDescription>Klärungsbedarf und offene Fragen</CardDescription>
          </div>
          <CopyButton
            text={report.offene_punkte.map((p, i) => `${i + 1}. ${p}`).join('\n')}
            section="Offene Punkte"
          />
        </CardHeader>
        <CardContent>
          <ul className="space-y-2 list-disc list-inside">
            {report.offene_punkte.map((punkt, idx) => (
              <li key={idx} className="text-slate-700">{punkt}</li>
            ))}
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-start justify-between">
          <div>
            <CardTitle>Nächste Schritte (Vorschlag)</CardTitle>
            <CardDescription>Empfohlene Maßnahmen und Folgeaktionen</CardDescription>
          </div>
          <CopyButton
            text={report.naechste_schritte_vorschlag.map((s, i) => `${i + 1}. ${s}`).join('\n')}
            section="Nächste Schritte"
          />
        </CardHeader>
        <CardContent>
          <ul className="space-y-2 list-disc list-inside">
            {report.naechste_schritte_vorschlag.map((schritt, idx) => (
              <li key={idx} className="text-slate-700">{schritt}</li>
            ))}
          </ul>
        </CardContent>
      </Card>

      <Card className="border-slate-200 bg-slate-50">
        <CardHeader>
          <CardTitle className="text-sm">Qualitätshinweise</CardTitle>
        </CardHeader>
        <CardContent className="grid md:grid-cols-3 gap-4 text-sm">
          <div>
            <p className="font-medium text-slate-600">Audioqualität</p>
            <p className="text-slate-900">{quality_notes.audio_quality}</p>
          </div>
          <div>
            <p className="font-medium text-slate-600">Transkript-Konfidenz</p>
            <p className="text-slate-900">{quality_notes.transcript_confidence}</p>
          </div>
          <div>
            <p className="font-medium text-slate-600">PII-Redaktion</p>
            <p className="text-slate-900">
              {quality_notes.pii_redaction_applied ? 'Angewendet' : 'Nicht angewendet'}
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
