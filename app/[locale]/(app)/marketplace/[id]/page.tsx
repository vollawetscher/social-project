'use client'

import { useState, useEffect, useCallback } from 'react'
import { Link } from '@/i18n/navigation'
import {
  ArrowLeft, Star, Download, User, Copy, FileDown,
  Eye, Users, MessageSquare, Globe, Briefcase, FileText,
  Sparkles, Loader2, CheckCircle2, XCircle,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { copyExportJSON, downloadExportJSON } from '@/lib/utils/marketplace-export'
import type {
  MarketplaceTemplate, MarketplaceProfile, MarketplaceCategory,
  Perspective, Audience, Tone, OutputFormat, OutputLanguage, MarketplaceDomain,
} from '@/lib/types/marketplace'

const PERSPECTIVE_OPTIONS: Perspective[] = ['party_a', 'party_b', 'observer']
const AUDIENCE_OPTIONS: Audience[] = ['internal', 'external', 'client_facing', 'legal', 'executive']
const TONE_OPTIONS: Tone[] = ['direct', 'neutral', 'formal', 'casual', 'funny', 'technical']
const FORMAT_OPTIONS: OutputFormat[] = ['markdown', 'json']
const LANGUAGE_OPTIONS: OutputLanguage[] = ['en', 'de', 'fr', 'es', 'it', 'pt', 'nl', 'pl']
const DOMAIN_OPTIONS: MarketplaceDomain[] = ['psychology', 'medical', 'sales', 'legal', 'education', 'it', 'consulting', 'hr', 'general', 'meetings', 'business', 'support', 'technical']

const categoryColors: Record<string, string> = {
  psychology: 'bg-purple-500/20 text-purple-600 border-purple-500/30',
  sales: 'bg-green-500/20 text-green-600 border-green-500/30',
  medical: 'bg-red-500/20 text-red-600 border-red-500/30',
  'it-support': 'bg-blue-500/20 text-blue-600 border-blue-500/30',
  legal: 'bg-orange-500/20 text-orange-600 border-orange-500/30',
  education: 'bg-yellow-500/20 text-yellow-600 border-yellow-500/30',
  consulting: 'bg-teal-500/20 text-teal-600 border-teal-500/30',
  hr: 'bg-pink-500/20 text-pink-600 border-pink-500/30',
  general: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
}

export default function TemplateDetailPage({ params }: { params: { id: string } }) {
  const { id } = params
  const t = useTranslations('marketplace')
  const supabase = createClient()
  const [template, setTemplate] = useState<MarketplaceTemplate | null>(null)
  const [loading, setLoading] = useState(true)
  const [customizing, setCustomizing] = useState(false)

  const [perspectives, setPerspectives] = useState<Perspective[]>([])
  const [audiences, setAudiences] = useState<Audience[]>([])
  const [tone, setTone] = useState<Tone>('neutral')
  const [outputFormat, setOutputFormat] = useState<OutputFormat>('markdown')
  const [languages, setLanguages] = useState<OutputLanguage[]>([])
  const [domains, setDomains] = useState<MarketplaceDomain[]>([])
  const [generationPrompt, setGenerationPrompt] = useState('')
  const [doInclude, setDoInclude] = useState('')
  const [doNotInclude, setDoNotInclude] = useState('')

  const fetchTemplate = useCallback(async () => {
    if (!id) return
    setLoading(true)

    const { data: tpl } = await supabase
      .from('marketplace_templates')
      .select('*')
      .eq('id', id)
      .maybeSingle()

    if (!tpl) {
      setLoading(false)
      return
    }

    const [profileRes, categoryRes] = await Promise.all([
      supabase.from('profiles').select('id, display_name, marketplace_username, marketplace_avatar_url, marketplace_bio').eq('id', tpl.author_id).maybeSingle(),
      tpl.category_id
        ? supabase.from('marketplace_categories').select('*').eq('id', tpl.category_id).maybeSingle()
        : Promise.resolve({ data: null }),
    ])

    const enriched: MarketplaceTemplate = {
      ...tpl,
      author: (profileRes.data as MarketplaceProfile) ?? undefined,
      category: (categoryRes.data as MarketplaceCategory) ?? undefined,
    }
    setTemplate(enriched)

    const cfg = tpl.template_config
    if (cfg) {
      setPerspectives(cfg.perspectives ?? [])
      setAudiences(cfg.audiences ?? [])
      setTone(cfg.tone ?? 'neutral')
      setOutputFormat(cfg.output_format ?? 'markdown')
      setLanguages(cfg.languages ?? [])
      setDomains(cfg.domains ?? [])
      setGenerationPrompt(cfg.generation_prompt ?? '')
      setDoInclude(cfg.do_include ?? '')
      setDoNotInclude(cfg.do_not_include ?? '')
    }

    setLoading(false)
  }, [id, supabase])

  useEffect(() => {
    fetchTemplate()
  }, [fetchTemplate])

  function toggleItem<T>(list: T[], item: T, setter: (v: T[]) => void) {
    setter(list.includes(item) ? list.filter((x) => x !== item) : [...list, item])
  }

  function buildCustomTemplate(): MarketplaceTemplate {
    return {
      ...template!,
      template_config: {
        perspectives, audiences, tone,
        output_format: outputFormat,
        languages, domains,
        generation_prompt: generationPrompt,
        do_include: doInclude,
        do_not_include: doNotInclude,
      },
    }
  }

  async function handleCopyJSON() {
    const tpl = customizing ? buildCustomTemplate() : template!
    await copyExportJSON(tpl)
    toast.success(t('explore.copiedJSON'))
  }

  function handleDownloadJSON() {
    const tpl = customizing ? buildCustomTemplate() : template!
    downloadExportJSON(tpl)
    toast.success(t('explore.downloadedJSON'))
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!template) {
    return (
      <div className="text-center py-20 text-muted-foreground">
        <p>{t('template.notFound')}</p>
        <Button asChild variant="link" className="mt-2">
          <Link href="/marketplace">{t('template.backToExplore')}</Link>
        </Button>
      </div>
    )
  }

  const cfg = template.template_config

  return (
    <TooltipProvider delayDuration={0}>
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-start gap-4">
          <Button asChild variant="ghost" size="icon" className="mt-1 shrink-0">
            <Link href="/marketplace">
              <ArrowLeft className="h-5 w-5" />
            </Link>
          </Button>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-2 flex-wrap">
              {template.category && (
                <Badge variant="outline" className={categoryColors[template.category.slug] || ''}>
                  {template.category.name}
                </Badge>
              )}
              {template.tags.map((tag) => (
                <Badge key={tag} variant="secondary" className="text-xs">{tag}</Badge>
              ))}
            </div>
            <h1 className="text-2xl font-semibold text-foreground">{template.title}</h1>
            <p className="text-sm text-muted-foreground mt-1">{template.description}</p>

            <div className="flex items-center gap-4 mt-3 text-sm text-muted-foreground">
              <span className="flex items-center gap-1">
                <User className="h-3.5 w-3.5" />
                {template.author?.display_name ?? t('template.unknown')}
              </span>
              <span className="flex items-center gap-1">
                <Star className="h-3.5 w-3.5 fill-warning text-warning" />
                {Number(template.avg_rating).toFixed(1)}
              </span>
              <span className="flex items-center gap-1">
                <Download className="h-3.5 w-3.5" />
                {template.download_count}
              </span>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-3">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button onClick={handleCopyJSON}>
                <Copy className="h-4 w-4 mr-2" />
                {t('explore.copyJSON')}
              </Button>
            </TooltipTrigger>
            <TooltipContent>{t('explore.copyJSONTooltip')}</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="outline" className="bg-transparent" onClick={handleDownloadJSON}>
                <FileDown className="h-4 w-4 mr-2" />
                {t('explore.downloadJSON')}
              </Button>
            </TooltipTrigger>
            <TooltipContent>{t('explore.downloadJSONTooltip')}</TooltipContent>
          </Tooltip>
          <Button
            variant={customizing ? 'secondary' : 'outline'}
            className={customizing ? '' : 'bg-transparent'}
            onClick={() => setCustomizing(!customizing)}
          >
            <Sparkles className="h-4 w-4 mr-2" />
            {customizing ? t('template.closeCustomizer') : t('template.customizeExport')}
          </Button>
        </div>

        <Card className="border-border">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              {t('template.generationPrompt')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {customizing ? (
              <Textarea
                value={generationPrompt}
                onChange={(e) => setGenerationPrompt(e.target.value)}
                className="bg-secondary border-border min-h-[200px] font-mono text-sm border-l-2 border-l-primary/40"
              />
            ) : (
              <pre className="whitespace-pre-wrap text-sm text-foreground bg-secondary/50 rounded-lg p-4 border border-border font-mono leading-relaxed">
                {cfg.generation_prompt || template.instructions}
              </pre>
            )}
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card className="border-border">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2 text-green-600 dark:text-green-400">
                <CheckCircle2 className="h-4 w-4" />
                {t('template.doInclude')}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {customizing ? (
                <Textarea value={doInclude} onChange={(e) => setDoInclude(e.target.value)} className="bg-secondary border-border min-h-[120px] border-l-2 border-l-green-500/40" />
              ) : cfg.do_include ? (
                <ul className="space-y-1.5">
                  {cfg.do_include.split('\n').filter(Boolean).map((line: string, i: number) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-foreground">
                      <CheckCircle2 className="h-3.5 w-3.5 mt-0.5 text-green-500 shrink-0" />
                      {line}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted-foreground italic">{t('template.noInstructions')}</p>
              )}
            </CardContent>
          </Card>

          <Card className="border-border">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2 text-red-600 dark:text-red-400">
                <XCircle className="h-4 w-4" />
                {t('template.doNotInclude')}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {customizing ? (
                <Textarea value={doNotInclude} onChange={(e) => setDoNotInclude(e.target.value)} className="bg-secondary border-border min-h-[120px] border-l-2 border-l-red-500/40" />
              ) : cfg.do_not_include ? (
                <ul className="space-y-1.5">
                  {cfg.do_not_include.split('\n').filter(Boolean).map((line: string, i: number) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-foreground">
                      <XCircle className="h-3.5 w-3.5 mt-0.5 text-red-500 shrink-0" />
                      {line}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted-foreground italic">{t('template.noExclusions')}</p>
              )}
            </CardContent>
          </Card>
        </div>

        <Card className="border-border">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Eye className="h-5 w-5 text-primary" />
              {t('template.notissimaConfig')}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="space-y-2">
              <Label className="flex items-center gap-1.5 text-sm font-medium">
                <Eye className="h-3.5 w-3.5 text-muted-foreground" />
                {t('upload.form.perspective')}
              </Label>
              {customizing ? (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {PERSPECTIVE_OPTIONS.map((opt) => (
                    <label key={opt} className="flex items-center gap-2 cursor-pointer select-none">
                      <Checkbox checked={perspectives.includes(opt)} onCheckedChange={() => toggleItem(perspectives, opt, setPerspectives)} />
                      <span className="text-sm">{t(`upload.form.perspectiveOptions.${opt}`)}</span>
                    </label>
                  ))}
                </div>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {(cfg.perspectives ?? []).map((p: string) => (
                    <Badge key={p} variant="secondary">{t(`upload.form.perspectiveOptions.${p}`)}</Badge>
                  ))}
                </div>
              )}
            </div>

            <Separator />

            <div className="space-y-2">
              <Label className="flex items-center gap-1.5 text-sm font-medium">
                <Users className="h-3.5 w-3.5 text-muted-foreground" />
                {t('upload.form.audience')}
              </Label>
              {customizing ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {AUDIENCE_OPTIONS.map((opt) => (
                    <label key={opt} className="flex items-center gap-2 cursor-pointer select-none">
                      <Checkbox checked={audiences.includes(opt)} onCheckedChange={() => toggleItem(audiences, opt, setAudiences)} />
                      <span className="text-sm">{t(`upload.form.audienceOptions.${opt}`)}</span>
                    </label>
                  ))}
                </div>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {(cfg.audiences ?? []).map((a: string) => (
                    <Badge key={a} variant="secondary">{t(`upload.form.audienceOptions.${a}`)}</Badge>
                  ))}
                </div>
              )}
            </div>

            <Separator />

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="flex items-center gap-1.5 text-sm font-medium">
                  <MessageSquare className="h-3.5 w-3.5 text-muted-foreground" />
                  {t('upload.form.tone')}
                </Label>
                {customizing ? (
                  <Select value={tone} onValueChange={(v) => setTone(v as Tone)}>
                    <SelectTrigger className="bg-secondary border-border"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {TONE_OPTIONS.map((opt) => (
                        <SelectItem key={opt} value={opt}>{t(`upload.form.toneOptions.${opt}`)}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <Badge variant="secondary">{t(`upload.form.toneOptions.${cfg.tone}`)}</Badge>
                )}
              </div>
              <div className="space-y-2">
                <Label className="flex items-center gap-1.5 text-sm font-medium">
                  <FileText className="h-3.5 w-3.5 text-muted-foreground" />
                  {t('upload.form.outputFormat')}
                </Label>
                {customizing ? (
                  <Select value={outputFormat} onValueChange={(v) => setOutputFormat(v as OutputFormat)}>
                    <SelectTrigger className="bg-secondary border-border"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {FORMAT_OPTIONS.map((opt) => (
                        <SelectItem key={opt} value={opt}>{t(`upload.form.formatOptions.${opt}`)}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <Badge variant="secondary">{t(`upload.form.formatOptions.${cfg.output_format}`)}</Badge>
                )}
              </div>
            </div>

            <Separator />

            <div className="space-y-2">
              <Label className="flex items-center gap-1.5 text-sm font-medium">
                <Briefcase className="h-3.5 w-3.5 text-muted-foreground" />
                {t('upload.form.domains')}
              </Label>
              {customizing ? (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {DOMAIN_OPTIONS.map((dom) => (
                    <label key={dom} className="flex items-center gap-2 cursor-pointer select-none">
                      <Checkbox checked={domains.includes(dom)} onCheckedChange={() => toggleItem(domains, dom, setDomains)} />
                      <span className="text-sm capitalize">{dom.replace('_', ' ')}</span>
                    </label>
                  ))}
                </div>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {(cfg.domains ?? []).map((d: string) => (
                    <Badge key={d} variant="secondary" className="capitalize">{d.replace('_', ' ')}</Badge>
                  ))}
                </div>
              )}
            </div>

            <Separator />

            <div className="space-y-2">
              <Label className="flex items-center gap-1.5 text-sm font-medium">
                <Globe className="h-3.5 w-3.5 text-muted-foreground" />
                {t('upload.form.languages')}
              </Label>
              {customizing ? (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {LANGUAGE_OPTIONS.map((lang) => (
                    <label key={lang} className="flex items-center gap-2 cursor-pointer select-none">
                      <Checkbox checked={languages.includes(lang)} onCheckedChange={() => toggleItem(languages, lang, setLanguages)} />
                      <span className="text-sm">{t(`upload.form.languageOptions.${lang}`)}</span>
                    </label>
                  ))}
                </div>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {(cfg.languages ?? []).map((l: string) => (
                    <Badge key={l} variant="secondary">{t(`upload.form.languageOptions.${l}`)}</Badge>
                  ))}
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {customizing && (
          <Card className="border-primary/30 bg-primary/5">
            <CardContent className="p-4">
              <div className="flex flex-col sm:flex-row items-center gap-3">
                <p className="text-sm text-foreground flex-1">{t('template.exportReady')}</p>
                <div className="flex gap-2">
                  <Button size="sm" onClick={handleCopyJSON}>
                    <Copy className="h-4 w-4 mr-2" />
                    {t('explore.copyJSON')}
                  </Button>
                  <Button size="sm" variant="outline" className="bg-transparent" onClick={handleDownloadJSON}>
                    <FileDown className="h-4 w-4 mr-2" />
                    {t('explore.downloadJSON')}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        <div className="h-8" />
      </div>
    </TooltipProvider>
  )
}
