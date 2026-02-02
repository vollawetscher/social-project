'use client'

import { GenericReportJSON } from '@/lib/types/database'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Copy, Check, Globe } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { translations } from './reportTranslations'

export function GenericReportViewer({ report }: { report: GenericReportJSON }) {
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
