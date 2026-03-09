'use client'

import { useState, useEffect, type KeyboardEvent } from 'react'
import { Link, useRouter } from '@/i18n/navigation'
import {
  Eye, Users, MessageSquare, FileText, Globe, Send, Save, X,
  LogIn, ClipboardPaste, CheckCircle2, AlertCircle, Briefcase,
  Sparkles, ShieldAlert, Loader2,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'
import { Separator } from '@/components/ui/separator'
import { useAuth } from '@/lib/auth/AuthProvider'
import { createClient } from '@/lib/supabase/client'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import type {
  Perspective, Audience, Tone, OutputFormat, OutputLanguage, MarketplaceDomain, NotissimaExportJSON,
} from '@/lib/types/marketplace'

const CATEGORIES = [
  { value: 'psychology', label: 'Psychology' },
  { value: 'medical', label: 'Medical' },
  { value: 'sales', label: 'Sales' },
  { value: 'legal', label: 'Legal' },
  { value: 'education', label: 'Education' },
  { value: 'it', label: 'IT' },
  { value: 'consulting', label: 'Consulting' },
  { value: 'hr', label: 'HR' },
  { value: 'general', label: 'General' },
]

const PERSPECTIVE_OPTIONS: Perspective[] = ['party_a', 'party_b', 'observer']
const AUDIENCE_OPTIONS: Audience[] = ['internal', 'external', 'client_facing', 'legal', 'executive']
const TONE_OPTIONS: Tone[] = ['direct', 'neutral', 'formal', 'casual', 'funny', 'technical']
const FORMAT_OPTIONS: OutputFormat[] = ['markdown', 'json']
const LANGUAGE_OPTIONS: OutputLanguage[] = ['en', 'de', 'fr', 'es', 'it', 'pt', 'nl', 'pl']
const DOMAIN_OPTIONS: MarketplaceDomain[] = ['psychology', 'medical', 'sales', 'legal', 'education', 'it', 'consulting', 'hr', 'general', 'meetings', 'business', 'support', 'technical']

function isValidExport(data: unknown): data is NotissimaExportJSON {
  if (!data || typeof data !== 'object') return false
  const d = data as Record<string, unknown>
  return d.v === 1 && typeof d.name === 'string'
}

export default function UploadTemplatePage() {
  const t = useTranslations('marketplace')
  const { user } = useAuth()
  const router = useRouter()
  const supabase = createClient()

  const [jsonInput, setJsonInput] = useState('')
  const [importStatus, setImportStatus] = useState<'idle' | 'success' | 'error'>('idle')

  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [categorySlug, setCategorySlug] = useState('')
  const [categoryMap, setCategoryMap] = useState<Record<string, string>>({})
  const [tags, setTags] = useState<string[]>([])
  const [tagInput, setTagInput] = useState('')

  const [perspectives, setPerspectives] = useState<Perspective[]>(['observer'])
  const [audiences, setAudiences] = useState<Audience[]>(['internal'])
  const [tone, setTone] = useState<Tone>('neutral')
  const [outputFormat, setOutputFormat] = useState<OutputFormat>('markdown')
  const [languages, setLanguages] = useState<OutputLanguage[]>(['en'])
  const [domains, setDomains] = useState<MarketplaceDomain[]>([])

  const [generationPrompt, setGenerationPrompt] = useState('')
  const [doInclude, setDoInclude] = useState('')
  const [doNotInclude, setDoNotInclude] = useState('')

  const [submitting, setSubmitting] = useState(false)
  const [checking, setChecking] = useState(false)

  useEffect(() => {
    supabase
      .from('marketplace_categories')
      .select('id, slug')
      .then(({ data }: { data: any }) => {
        if (data) {
          const map: Record<string, string> = {}
          data.forEach((c: { id: string; slug: string }) => { map[c.slug] = c.id })
          setCategoryMap(map)
        }
      })
  }, [supabase])

  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 mb-4">
          <LogIn className="h-8 w-8 text-primary" />
        </div>
        <h2 className="text-lg font-medium text-foreground mb-2">
          {t('upload.form.loginRequired')}
        </h2>
        <Button asChild className="mt-4">
          <Link href="/login">{t('upload.form.signIn')}</Link>
        </Button>
      </div>
    )
  }

  function handleImportJson() {
    try {
      const data = JSON.parse(jsonInput.trim())
      if (!isValidExport(data)) {
        setImportStatus('error')
        return
      }

      setTitle(data.name)
      setDescription(data.description || '')
      setPerspectives(data.perspectives?.length ? data.perspectives : ['observer'])
      setAudiences(data.audiences?.length ? data.audiences : ['internal'])
      setTone(data.tone || 'neutral')
      setOutputFormat(data.output_format || 'markdown')
      setLanguages(data.languages?.length ? data.languages : ['en'])
      setDomains(data.domains || [])
      setGenerationPrompt(data.generation_prompt || '')
      setDoInclude(data.do_include || '')
      setDoNotInclude(data.do_not_include || '')

      if (data.domains?.length) {
        const mapped = data.domains.find((d: string) =>
          CATEGORIES.some((c) => c.value === d)
        )
        if (mapped) setCategorySlug(mapped)
      }

      setImportStatus('success')
      toast.success(t('upload.import.success'))
    } catch {
      setImportStatus('error')
    }
  }

  function handleTagKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault()
      const value = tagInput.trim().toLowerCase().replace(/,/g, '')
      if (value && !tags.includes(value) && tags.length < 8) {
        setTags([...tags, value])
        setTagInput('')
      }
    }
  }

  function removeTag(tag: string) {
    setTags(tags.filter((t) => t !== tag))
  }

  function toggleItem<T>(list: T[], item: T, setter: (v: T[]) => void) {
    setter(list.includes(item) ? list.filter((x) => x !== item) : [...list, item])
  }

  async function runSafetyCheck(): Promise<boolean> {
    setChecking(true)
    try {
      const response = await fetch('/api/marketplace/safety-check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: user!.id,
          fields: {
            generation_prompt: generationPrompt.trim(),
            do_include: doInclude.trim(),
            do_not_include: doNotInclude.trim(),
          },
        }),
      })

      if (response.status === 403) {
        const body = await response.json()
        toast.error(t('upload.safety.accountBlocked'), {
          description: body.details || t('upload.safety.contactSupport'),
        })
        return false
      }

      if (!response.ok) return true

      const data = await response.json()

      if (data.blocked) {
        const strikeMsg = data.strike_count >= 3
          ? t('upload.safety.permanentBlock')
          : t('upload.safety.strikeWarning', {
              count: data.strike_count,
              hours: data.strike_count === 1 ? '1' : '24',
            })

        toast.error(t('upload.safety.blocked'), { description: strikeMsg })
        return false
      }

      if (data.level === 'fail') {
        toast.error(t('upload.safety.blocked'), { description: data.details })
        return false
      }

      if (data.level === 'warn') {
        toast.warning(t('upload.safety.warning'), { description: data.details })
      }

      return true
    } catch {
      return true
    } finally {
      setChecking(false)
    }
  }

  async function handleSubmit(publish: boolean) {
    if (!title.trim()) {
      toast.error(t('upload.form.requiredField'))
      return
    }

    if (publish) {
      const safe = await runSafetyCheck()
      if (!safe) return
    }

    setSubmitting(true)

    const templateData = {
      author_id: user!.id,
      title: title.trim(),
      description: description.trim(),
      instructions: generationPrompt.trim(),
      template_config: {
        perspectives, audiences, tone,
        output_format: outputFormat,
        languages, domains,
        generation_prompt: generationPrompt.trim(),
        do_include: doInclude.trim(),
        do_not_include: doNotInclude.trim(),
      },
      category_id: (categorySlug && categoryMap[categorySlug]) || null,
      tags,
      is_published: publish,
    }

    const { error } = await supabase.from('marketplace_templates').insert(templateData)

    setSubmitting(false)

    if (error) {
      toast.error(error.message)
    } else {
      toast.success(publish ? t('upload.published') : t('upload.draftSaved'))
      router.push('/marketplace')
    }
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">{t('upload.title')}</h1>
        <p className="text-sm text-muted-foreground mt-1">{t('upload.subtitle')}</p>
      </div>

      <Card className="border-primary/30 bg-primary/5">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <ClipboardPaste className="h-5 w-5 text-primary" />
            {t('upload.import.title')}
          </CardTitle>
          <CardDescription>{t('upload.import.description')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Textarea
            value={jsonInput}
            onChange={(e) => { setJsonInput(e.target.value); setImportStatus('idle') }}
            placeholder={t('upload.import.placeholder')}
            className="bg-background border-border min-h-[100px] font-mono text-xs"
          />
          <div className="flex items-center gap-3">
            <Button onClick={handleImportJson} disabled={!jsonInput.trim()} size="sm">
              <ClipboardPaste className="h-4 w-4 mr-2" />
              {t('upload.import.button')}
            </Button>
            {importStatus === 'success' && (
              <span className="flex items-center gap-1 text-sm text-green-600">
                <CheckCircle2 className="h-4 w-4" />{t('upload.import.success')}
              </span>
            )}
            {importStatus === 'error' && (
              <span className="flex items-center gap-1 text-sm text-destructive">
                <AlertCircle className="h-4 w-4" />{t('upload.import.error')}
              </span>
            )}
          </div>
        </CardContent>
      </Card>

      <div className="relative">
        <Separator />
        <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-background px-3 text-xs text-muted-foreground uppercase tracking-wider">
          {t('upload.import.orManual')}
        </span>
      </div>

      <Card className="border-border">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" />{t('upload.sectionMarketplace')}
          </CardTitle>
          <CardDescription>{t('upload.sectionMarketplaceDesc')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="title">{t('upload.form.title')} *</Label>
            <Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder={t('upload.form.titlePlaceholder')} className="bg-secondary border-border" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="description">{t('upload.form.description')}</Label>
            <Textarea id="description" value={description} onChange={(e) => setDescription(e.target.value)} placeholder={t('upload.form.descriptionPlaceholder')} className="bg-secondary border-border min-h-[100px]" />
          </div>
          <div className="space-y-2">
            <Label>{t('upload.form.category')}</Label>
            <Select value={categorySlug} onValueChange={setCategorySlug}>
              <SelectTrigger className="bg-secondary border-border"><SelectValue placeholder={t('upload.form.categoryPlaceholder')} /></SelectTrigger>
              <SelectContent>
                {CATEGORIES.map((cat) => (
                  <SelectItem key={cat.value} value={cat.value}>{cat.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>{t('upload.form.tags')}</Label>
            <div className="flex flex-wrap gap-2 mb-2">
              {tags.map((tag) => (
                <Badge key={tag} variant="secondary" className="gap-1 cursor-pointer hover:bg-destructive/20" onClick={() => removeTag(tag)}>
                  {tag}<X className="h-3 w-3" />
                </Badge>
              ))}
            </div>
            <Input value={tagInput} onChange={(e) => setTagInput(e.target.value)} onKeyDown={handleTagKeyDown} placeholder={t('upload.form.tagsPlaceholder')} className="bg-secondary border-border" disabled={tags.length >= 8} />
          </div>
        </CardContent>
      </Card>

      <Card className="border-border">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Eye className="h-5 w-5 text-primary" />{t('upload.sectionConfig')}
          </CardTitle>
          <CardDescription>{t('upload.sectionConfigDesc')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="space-y-3">
            <Label className="flex items-center gap-1.5"><Eye className="h-3.5 w-3.5 text-muted-foreground" />{t('upload.form.perspective')}</Label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {PERSPECTIVE_OPTIONS.map((opt) => (
                <label key={opt} className="flex items-center gap-2 cursor-pointer select-none">
                  <Checkbox checked={perspectives.includes(opt)} onCheckedChange={() => toggleItem(perspectives, opt, setPerspectives)} />
                  <span className="text-sm text-foreground">{t(`upload.form.perspectiveOptions.${opt}`)}</span>
                </label>
              ))}
            </div>
          </div>
          <Separator />
          <div className="space-y-3">
            <Label className="flex items-center gap-1.5"><Users className="h-3.5 w-3.5 text-muted-foreground" />{t('upload.form.audience')}</Label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {AUDIENCE_OPTIONS.map((opt) => (
                <label key={opt} className="flex items-center gap-2 cursor-pointer select-none">
                  <Checkbox checked={audiences.includes(opt)} onCheckedChange={() => toggleItem(audiences, opt, setAudiences)} />
                  <span className="text-sm text-foreground">{t(`upload.form.audienceOptions.${opt}`)}</span>
                </label>
              ))}
            </div>
          </div>
          <Separator />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="flex items-center gap-1.5"><MessageSquare className="h-3.5 w-3.5 text-muted-foreground" />{t('upload.form.tone')}</Label>
              <Select value={tone} onValueChange={(v) => setTone(v as Tone)}>
                <SelectTrigger className="bg-secondary border-border"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TONE_OPTIONS.map((opt) => (<SelectItem key={opt} value={opt}>{t(`upload.form.toneOptions.${opt}`)}</SelectItem>))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="flex items-center gap-1.5"><FileText className="h-3.5 w-3.5 text-muted-foreground" />{t('upload.form.outputFormat')}</Label>
              <Select value={outputFormat} onValueChange={(v) => setOutputFormat(v as OutputFormat)}>
                <SelectTrigger className="bg-secondary border-border"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {FORMAT_OPTIONS.map((opt) => (<SelectItem key={opt} value={opt}>{t(`upload.form.formatOptions.${opt}`)}</SelectItem>))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <Separator />
          <div className="space-y-3">
            <Label className="flex items-center gap-1.5"><Briefcase className="h-3.5 w-3.5 text-muted-foreground" />{t('upload.form.domains')}</Label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {DOMAIN_OPTIONS.map((dom) => (
                <label key={dom} className="flex items-center gap-2 cursor-pointer select-none">
                  <Checkbox checked={domains.includes(dom)} onCheckedChange={() => toggleItem(domains, dom, setDomains)} />
                  <span className="text-sm text-foreground capitalize">{dom.replace('_', ' ')}</span>
                </label>
              ))}
            </div>
          </div>
          <Separator />
          <div className="space-y-3">
            <Label className="flex items-center gap-1.5"><Globe className="h-3.5 w-3.5 text-muted-foreground" />{t('upload.form.languages')}</Label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {LANGUAGE_OPTIONS.map((lang) => (
                <label key={lang} className="flex items-center gap-2 cursor-pointer select-none">
                  <Checkbox checked={languages.includes(lang)} onCheckedChange={() => toggleItem(languages, lang, setLanguages)} />
                  <span className="text-sm text-foreground">{t(`upload.form.languageOptions.${lang}`)}</span>
                </label>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="border-border">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />{t('upload.sectionInstructions')}
          </CardTitle>
          <CardDescription>{t('upload.sectionInstructionsDesc')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="generationPrompt" className="flex items-center gap-1.5">
              <Sparkles className="h-3.5 w-3.5 text-primary" />{t('upload.form.generationPrompt')}
            </Label>
            <Textarea id="generationPrompt" value={generationPrompt} onChange={(e) => setGenerationPrompt(e.target.value)} placeholder={t('upload.form.generationPromptPlaceholder')} className="bg-secondary border-border min-h-[120px] border-l-2 border-l-primary/40" />
            <p className="text-xs text-muted-foreground">{t('upload.form.generationPromptHint')}</p>
          </div>
          <Separator />
          <div className="space-y-2">
            <Label htmlFor="doInclude" className="text-green-600 dark:text-green-400">{t('upload.form.doInclude')}</Label>
            <Textarea id="doInclude" value={doInclude} onChange={(e) => setDoInclude(e.target.value)} placeholder={t('upload.form.doIncludePlaceholder')} className="bg-secondary border-border min-h-[100px] border-l-2 border-l-green-500/40" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="doNotInclude" className="text-red-600 dark:text-red-400">{t('upload.form.doNotInclude')}</Label>
            <Textarea id="doNotInclude" value={doNotInclude} onChange={(e) => setDoNotInclude(e.target.value)} placeholder={t('upload.form.doNotIncludePlaceholder')} className="bg-secondary border-border min-h-[100px] border-l-2 border-l-red-500/40" />
          </div>
        </CardContent>
      </Card>

      <div className="flex flex-col sm:flex-row gap-3 pb-8">
        <Button onClick={() => handleSubmit(true)} disabled={submitting || checking || !title.trim()} className="flex-1">
          {checking ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Send className="h-4 w-4 mr-2" />}
          {checking ? t('upload.safety.checking') : submitting ? t('common.loading') : t('upload.form.publish')}
        </Button>
        <Button variant="outline" onClick={() => handleSubmit(false)} disabled={submitting || !title.trim()} className="flex-1 bg-transparent">
          <Save className="h-4 w-4 mr-2" />{t('upload.form.saveDraft')}
        </Button>
      </div>
    </div>
  )
}
