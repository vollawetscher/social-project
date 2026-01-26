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

// Translations for report sections
const translations: Record<string, Record<string, string>> = {
  de: {
    'Detected Domain': 'Erkannte Domäne',
    'Language': 'Sprache',
    'Summary': 'Zusammenfassung',
    'Metadata': 'Metadaten',
    'Date': 'Datum',
    'Duration': 'Dauer',
    'Setting': 'Setting',
    'Participants': 'Beteiligte',
    'Topic': 'Thema',
    'Key Points': 'Kernpunkte',
    'Main takeaways from the conversation': 'Hauptpunkte des Gesprächs',
    'Key Quotes': 'Kernaussagen & Zitate',
    'Important statements with timestamps': 'Wichtige Aussagen mit Zeitstempel',
    'Observations': 'Beobachtungen',
    'Factual observations': 'Sachliche Feststellungen',
    'Topics': 'Themen',
    'Main topics discussed': 'Hauptthemen des Gesprächs',
    'Positive Aspects': 'Positive Aspekte',
    'Strengths and supporting factors': 'Stärken und unterstützende Faktoren',
    'Concerns & Challenges': 'Belastungen & Herausforderungen',
    'Observed challenges and concerns': 'Beobachtete Herausforderungen und Bedenken',
    'Open Questions': 'Offene Fragen',
    'Items requiring clarification': 'Klärungsbedarf',
    'Suggested Next Steps': 'Nächste Schritte (Vorschlag)',
    'Recommended actions and follow-ups': 'Empfohlene Maßnahmen und Folgeaktionen',
    'Quality Notes': 'Qualitätshinweise',
    'Audio Quality': 'Audioqualität',
    'Transcript Confidence': 'Transkript-Konfidenz',
    'PII Redaction': 'PII-Redaktion',
    'Applied': 'Angewendet',
    'Not applied': 'Nicht angewendet',
    'Context': 'Kontext',
    'copied': 'kopiert',
    'Failed to copy': 'Fehler beim Kopieren'
  },
  en: {
    'Detected Domain': 'Detected Domain',
    'Language': 'Language',
    'Summary': 'Summary',
    'Metadata': 'Metadata',
    'Date': 'Date',
    'Duration': 'Duration',
    'Setting': 'Setting',
    'Participants': 'Participants',
    'Topic': 'Topic',
    'Key Points': 'Key Points',
    'Main takeaways from the conversation': 'Main takeaways from the conversation',
    'Key Quotes': 'Key Quotes',
    'Important statements with timestamps': 'Important statements with timestamps',
    'Observations': 'Observations',
    'Factual observations': 'Factual observations',
    'Topics': 'Topics',
    'Main topics discussed': 'Main topics discussed',
    'Positive Aspects': 'Positive Aspects',
    'Strengths and supporting factors': 'Strengths and supporting factors',
    'Concerns & Challenges': 'Concerns & Challenges',
    'Observed challenges and concerns': 'Observed challenges and concerns',
    'Open Questions': 'Open Questions',
    'Items requiring clarification': 'Items requiring clarification',
    'Suggested Next Steps': 'Suggested Next Steps',
    'Recommended actions and follow-ups': 'Recommended actions and follow-ups',
    'Quality Notes': 'Quality Notes',
    'Audio Quality': 'Audio Quality',
    'Transcript Confidence': 'Transcript Confidence',
    'PII Redaction': 'PII Redaction',
    'Applied': 'Applied',
    'Not applied': 'Not applied',
    'Context': 'Context',
    'copied': 'copied',
    'Failed to copy': 'Failed to copy'
  }
}

// Generic Report Viewer Component
function GenericReportViewer({ report }: { report: GenericReportJSON }) {
  const [copiedSections, setCopiedSections] = useState<Set<string>>(new Set())
  
  // Get translations for detected language (fallback to English)
  const lang = report.detected_language || 'en'
  const t = (key: string) => translations[lang]?.[key] || translations['en'][key] || key

  const copyToClipboard = async (text: string, sectionName: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopiedSections(new Set(copiedSections).add(sectionName))
      toast.success(`${sectionName} ${t('copied')}`)
      setTimeout(() => {
        setCopiedSections((prev) => {
          const next = new Set(prev)
          next.delete(sectionName)
          return next
        })
      }, 2000)
    } catch (error) {
      toast.error(t('Failed to copy'))
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

  const domainLabelsEN: Record<string, string> = {
    social_work: 'Social Work',
    healthcare: 'Healthcare',
    mental_health: 'Mental Health',
    business: 'Business',
    finance: 'Finance',
    human_resources: 'Human Resources',
    public_services: 'Public Services',
    legal: 'Legal',
    education: 'Education',
    technology: 'Technology',
    customer_service: 'Customer Service',
    creative: 'Creative/Media',
    general: 'General',
  }

  const domainLabelsDE: Record<string, string> = {
    social_work: 'Sozialarbeit',
    healthcare: 'Gesundheitswesen',
    mental_health: 'Psychische Gesundheit',
    business: 'Business',
    finance: 'Finanzwesen',
    human_resources: 'Personalwesen',
    public_services: 'Öffentlicher Dienst',
    legal: 'Rechtswesen',
    education: 'Bildung',
    technology: 'Technologie',
    customer_service: 'Kundenservice',
    creative: 'Kreativ/Medien',
    general: 'Allgemein',
  }

  const { report: reportData, summary_short, quality_notes, detected_domain, detected_subdomain, domain_description, detected_language } = report

  const domainLabels = detected_language === 'de' ? domainLabelsDE : domainLabelsEN

  return (
    <div className="space-y-6">
      {/* Domain indicator */}
      <Card className="border-blue-200 bg-blue-50">
        <CardContent className="pt-6">
          <div className="flex items-center gap-3">
            <Globe className="h-5 w-5 text-blue-600" />
            <div className="flex-1">
              <p className="text-sm font-medium text-blue-900">
                {t('Detected Domain')}: {domainLabels[detected_domain] || detected_domain}
                {detected_subdomain && <span className="text-blue-700"> • {detected_subdomain}</span>}
              </p>
              {domain_description && (
                <p className="text-xs text-blue-700 mt-1 italic">{domain_description}</p>
              )}
              <p className="text-xs text-blue-700 mt-1">{t('Language')}: {detected_language.toUpperCase()}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Summary */}
      <Card>
        <CardHeader>
          <CardTitle>{t('Summary')}</CardTitle>
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
          <CardTitle>{t('Metadata')}</CardTitle>
        </CardHeader>
        <CardContent className="grid md:grid-cols-2 gap-4">
          <div>
            <p className="text-sm font-medium text-slate-600">{t('Date')}</p>
            <p className="text-slate-900">{reportData.metadata.date}</p>
          </div>
          <div>
            <p className="text-sm font-medium text-slate-600">{t('Duration')}</p>
            <p className="text-slate-900">{reportData.metadata.duration}</p>
          </div>
          <div>
            <p className="text-sm font-medium text-slate-600">{t('Setting')}</p>
            <p className="text-slate-900">{reportData.metadata.setting}</p>
          </div>
          <div>
            <p className="text-sm font-medium text-slate-600">{t('Participants')}</p>
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
              <p className="text-sm font-medium text-slate-600">{t('Topic')}</p>
              <p className="text-slate-900">{reportData.metadata.topic}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Summary Points */}
      <Card>
        <CardHeader className="flex flex-row items-start justify-between">
          <div>
            <CardTitle>{t('Key Points')}</CardTitle>
            <CardDescription>{t('Main takeaways from the conversation')}</CardDescription>
          </div>
          <CopyButton
            text={reportData.summary_points.map((p, i) => `${i + 1}. ${p}`).join('\n')}
            section={t('Key Points')}
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
              <CardTitle>{t('Key Quotes')}</CardTitle>
              <CardDescription>{t('Important statements with timestamps')}</CardDescription>
            </div>
            <CopyButton
              text={reportData.key_quotes.map((q) => `[${q.timecode}] ${q.speaker}: "${q.quote}"`).join('\n\n')}
              section={t('Key Quotes')}
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
                    <p className="text-sm text-slate-500 mt-2">{t('Context')}: {quote.context}</p>
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
              <CardTitle>{t('Observations')}</CardTitle>
              <CardDescription>{t('Factual observations')}</CardDescription>
            </div>
            <CopyButton
              text={reportData.observations.map((o, i) => `${i + 1}. ${o}`).join('\n')}
              section={t('Observations')}
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
              <CardTitle>{t('Topics')}</CardTitle>
              <CardDescription>{t('Main topics discussed')}</CardDescription>
            </div>
            <CopyButton
              text={reportData.topics.join(', ')}
              section={t('Topics')}
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
              <CardTitle className="text-green-900">{t('Positive Aspects')}</CardTitle>
              <CardDescription>{t('Strengths and supporting factors')}</CardDescription>
            </div>
            <CopyButton
              text={reportData.positive_aspects.map((p, i) => `${i + 1}. ${p}`).join('\n')}
              section={t('Positive Aspects')}
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
              <CardTitle className="text-orange-900">{t('Concerns & Challenges')}</CardTitle>
              <CardDescription>{t('Observed challenges and concerns')}</CardDescription>
            </div>
            <CopyButton
              text={reportData.concerns_or_challenges.map((c, i) => `${i + 1}. ${c}`).join('\n')}
              section={t('Concerns & Challenges')}
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
              <CardTitle>{t('Open Questions')}</CardTitle>
              <CardDescription>{t('Items requiring clarification')}</CardDescription>
            </div>
            <CopyButton
              text={reportData.open_questions.map((q, i) => `${i + 1}. ${q}`).join('\n')}
              section={t('Open Questions')}
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
              <CardTitle>{t('Suggested Next Steps')}</CardTitle>
              <CardDescription>{t('Recommended actions and follow-ups')}</CardDescription>
            </div>
            <CopyButton
              text={reportData.suggested_next_steps.map((s, i) => `${i + 1}. ${s}`).join('\n')}
              section={t('Suggested Next Steps')}
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
          <CardTitle className="text-sm">{t('Quality Notes')}</CardTitle>
        </CardHeader>
        <CardContent className="grid md:grid-cols-3 gap-4 text-sm">
          <div>
            <p className="font-medium text-slate-600">{t('Audio Quality')}</p>
            <p className="text-slate-900">{quality_notes.audio_quality}</p>
          </div>
          <div>
            <p className="font-medium text-slate-600">{t('Transcript Confidence')}</p>
            <p className="text-slate-900">{quality_notes.transcript_confidence}</p>
          </div>
          <div>
            <p className="font-medium text-slate-600">{t('PII Redaction')}</p>
            <p className="text-slate-900">
              {quality_notes.pii_redaction_applied ? t('Applied') : t('Not applied')}
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
