'use client'

import { GespraechsberichtJSON, GenericReportJSON } from '@/lib/types/database'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Copy, Check, Globe } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'

interface GespraechsberichtViewerProps {
  gespraechsbericht: GespraechsberichtJSON | GenericReportJSON
}

// Type guard to check if report is GenericReportJSON
function isGenericReport(report: any): report is GenericReportJSON {
  return 'detected_domain' in report && 'report' in report
}

// Generic Report Viewer Component
function GenericReportViewer({ report }: { report: GenericReportJSON }) {
  const [copiedSections, setCopiedSections] = useState<Set<string>>(new Set())

  const copyToClipboard = async (text: string, sectionName: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopiedSections(new Set(copiedSections).add(sectionName))
      toast.success(`${sectionName} copied`)
      setTimeout(() => {
        setCopiedSections((prev) => {
          const next = new Set(prev)
          next.delete(sectionName)
          return next
        })
      }, 2000)
    } catch (error) {
      toast.error('Failed to copy')
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

  const domainLabels: Record<string, string> = {
    social_work: 'Social Work',
    healthcare: 'Healthcare',
    business: 'Business',
    education: 'Education',
    legal: 'Legal',
    customer_service: 'Customer Service',
    general: 'General',
  }

  const { report: reportData, summary_short, quality_notes, detected_domain, detected_language } = report

  return (
    <div className="space-y-6">
      {/* Domain indicator */}
      <Card className="border-blue-200 bg-blue-50">
        <CardContent className="pt-6">
          <div className="flex items-center gap-3">
            <Globe className="h-5 w-5 text-blue-600" />
            <div>
              <p className="text-sm font-medium text-blue-900">
                Detected Domain: {domainLabels[detected_domain] || detected_domain}
              </p>
              <p className="text-xs text-blue-700">Language: {detected_language.toUpperCase()}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Summary */}
      <Card>
        <CardHeader>
          <CardTitle>Summary</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-start justify-between gap-4">
            <p className="text-slate-700 leading-relaxed">{summary_short}</p>
            <CopyButton text={summary_short} section="Summary" />
          </div>
        </CardContent>
      </Card>

      {/* Metadata */}
      <Card>
        <CardHeader>
          <CardTitle>Metadata</CardTitle>
        </CardHeader>
        <CardContent className="grid md:grid-cols-2 gap-4">
          <div>
            <p className="text-sm font-medium text-slate-600">Date</p>
            <p className="text-slate-900">{reportData.metadata.date}</p>
          </div>
          <div>
            <p className="text-sm font-medium text-slate-600">Duration</p>
            <p className="text-slate-900">{reportData.metadata.duration}</p>
          </div>
          <div>
            <p className="text-sm font-medium text-slate-600">Setting</p>
            <p className="text-slate-900">{reportData.metadata.setting}</p>
          </div>
          <div>
            <p className="text-sm font-medium text-slate-600">Participants</p>
            <div className="flex flex-wrap gap-1 mt-1">
              {reportData.metadata.participants.map((participant, idx) => (
                <Badge key={idx} variant="secondary">
                  {participant}
                </Badge>
              ))}
            </div>
          </div>
          {reportData.metadata.topic && (
            <div className="md:col-span-2">
              <p className="text-sm font-medium text-slate-600">Topic</p>
              <p className="text-slate-900">{reportData.metadata.topic}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Summary Points */}
      <Card>
        <CardHeader className="flex flex-row items-start justify-between">
          <div>
            <CardTitle>Key Points</CardTitle>
            <CardDescription>Main takeaways from the conversation</CardDescription>
          </div>
          <CopyButton
            text={reportData.summary_points.map((p, i) => `${i + 1}. ${p}`).join('\n')}
            section="Key Points"
          />
        </CardHeader>
        <CardContent>
          <ul className="space-y-2 list-disc list-inside">
            {reportData.summary_points.map((point, idx) => (
              <li key={idx} className="text-slate-700">{point}</li>
            ))}
          </ul>
        </CardContent>
      </Card>

      {/* Key Quotes */}
      {reportData.key_quotes && reportData.key_quotes.length > 0 && (
        <Card>
          <CardHeader className="flex flex-row items-start justify-between">
            <div>
              <CardTitle>Key Quotes</CardTitle>
              <CardDescription>Important statements with timestamps</CardDescription>
            </div>
            <CopyButton
              text={reportData.key_quotes.map((q) => `[${q.timecode}] ${q.speaker}: "${q.quote}"`).join('\n\n')}
              section="Key Quotes"
            />
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {reportData.key_quotes.map((quote, idx) => (
                <div key={idx} className="border-l-4 border-blue-500 pl-4 py-2 bg-slate-50 rounded-r">
                  <div className="flex items-center gap-2 mb-2">
                    <Badge variant="outline">{quote.timecode}</Badge>
                    <Badge variant="secondary">{quote.speaker}</Badge>
                  </div>
                  <p className="text-slate-700 italic">"{quote.quote}"</p>
                  {quote.context && (
                    <p className="text-sm text-slate-500 mt-2">Context: {quote.context}</p>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Observations */}
      {reportData.observations && reportData.observations.length > 0 && (
        <Card>
          <CardHeader className="flex flex-row items-start justify-between">
            <div>
              <CardTitle>Observations</CardTitle>
              <CardDescription>Factual observations</CardDescription>
            </div>
            <CopyButton
              text={reportData.observations.map((o, i) => `${i + 1}. ${o}`).join('\n')}
              section="Observations"
            />
          </CardHeader>
          <CardContent>
            <ul className="space-y-2 list-disc list-inside">
              {reportData.observations.map((observation, idx) => (
                <li key={idx} className="text-slate-700">{observation}</li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* Topics */}
      {reportData.topics && reportData.topics.length > 0 && (
        <Card>
          <CardHeader className="flex flex-row items-start justify-between">
            <div>
              <CardTitle>Topics</CardTitle>
              <CardDescription>Main topics discussed</CardDescription>
            </div>
            <CopyButton
              text={reportData.topics.join(', ')}
              section="Topics"
            />
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {reportData.topics.map((topic, idx) => (
                <Badge key={idx} variant="outline" className="text-sm">
                  {topic}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Positive Aspects */}
      {reportData.positive_aspects && reportData.positive_aspects.length > 0 && (
        <Card className="border-green-200 bg-green-50">
          <CardHeader className="flex flex-row items-start justify-between">
            <div>
              <CardTitle className="text-green-900">Positive Aspects</CardTitle>
              <CardDescription>Strengths and supporting factors</CardDescription>
            </div>
            <CopyButton
              text={reportData.positive_aspects.map((p, i) => `${i + 1}. ${p}`).join('\n')}
              section="Positive Aspects"
            />
          </CardHeader>
          <CardContent>
            <ul className="space-y-2 list-disc list-inside">
              {reportData.positive_aspects.map((aspect, idx) => (
                <li key={idx} className="text-green-900">{aspect}</li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* Concerns or Challenges */}
      {reportData.concerns_or_challenges && reportData.concerns_or_challenges.length > 0 && (
        <Card className="border-orange-200 bg-orange-50">
          <CardHeader className="flex flex-row items-start justify-between">
            <div>
              <CardTitle className="text-orange-900">Concerns & Challenges</CardTitle>
              <CardDescription>Observed challenges and concerns</CardDescription>
            </div>
            <CopyButton
              text={reportData.concerns_or_challenges.map((c, i) => `${i + 1}. ${c}`).join('\n')}
              section="Concerns"
            />
          </CardHeader>
          <CardContent>
            <ul className="space-y-2 list-disc list-inside">
              {reportData.concerns_or_challenges.map((concern, idx) => (
                <li key={idx} className="text-orange-900">{concern}</li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* Open Questions */}
      {reportData.open_questions && reportData.open_questions.length > 0 && (
        <Card>
          <CardHeader className="flex flex-row items-start justify-between">
            <div>
              <CardTitle>Open Questions</CardTitle>
              <CardDescription>Items requiring clarification</CardDescription>
            </div>
            <CopyButton
              text={reportData.open_questions.map((q, i) => `${i + 1}. ${q}`).join('\n')}
              section="Open Questions"
            />
          </CardHeader>
          <CardContent>
            <ul className="space-y-2 list-disc list-inside">
              {reportData.open_questions.map((question, idx) => (
                <li key={idx} className="text-slate-700">{question}</li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* Next Steps */}
      {reportData.suggested_next_steps && reportData.suggested_next_steps.length > 0 && (
        <Card>
          <CardHeader className="flex flex-row items-start justify-between">
            <div>
              <CardTitle>Suggested Next Steps</CardTitle>
              <CardDescription>Recommended actions and follow-ups</CardDescription>
            </div>
            <CopyButton
              text={reportData.suggested_next_steps.map((s, i) => `${i + 1}. ${s}`).join('\n')}
              section="Next Steps"
            />
          </CardHeader>
          <CardContent>
            <ul className="space-y-2 list-disc list-inside">
              {reportData.suggested_next_steps.map((step, idx) => (
                <li key={idx} className="text-slate-700">{step}</li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* Quality Notes */}
      <Card className="border-slate-200 bg-slate-50">
        <CardHeader>
          <CardTitle className="text-sm">Quality Notes</CardTitle>
        </CardHeader>
        <CardContent className="grid md:grid-cols-3 gap-4 text-sm">
          <div>
            <p className="font-medium text-slate-600">Audio Quality</p>
            <p className="text-slate-900">{quality_notes.audio_quality}</p>
          </div>
          <div>
            <p className="font-medium text-slate-600">Transcript Confidence</p>
            <p className="text-slate-900">{quality_notes.transcript_confidence}</p>
          </div>
          <div>
            <p className="font-medium text-slate-600">PII Redaction</p>
            <p className="text-slate-900">
              {quality_notes.pii_redaction_applied ? 'Applied' : 'Not applied'}
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

// Legacy Social Work Report Viewer (kept for backward compatibility)
function LegacyGespraechsberichtViewer({ gespraechsbericht }: { gespraechsbericht: GespraechsberichtJSON }) {
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

  const { gespraechsbericht: report, summary_short, quality_notes } = gespraechsbericht

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

// Main viewer component that determines which viewer to use
export function GespraechsberichtViewer({ gespraechsbericht }: GespraechsberichtViewerProps) {
  if (isGenericReport(gespraechsbericht)) {
    return <GenericReportViewer report={gespraechsbericht} />
  }
  
  return <LegacyGespraechsberichtViewer gespraechsbericht={gespraechsbericht} />
}
