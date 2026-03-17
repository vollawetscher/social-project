"use client"

export const dynamic = 'force-dynamic'

import { useState, useEffect } from "react"
import { useTranslations, useLocale } from "next-intl"
import { useParams } from "next/navigation"
import { Link, useRouter } from "@/i18n/navigation"
import { toast } from "sonner"
import {
  ArrowLeft,
  Save,
  Loader2,
  Sparkles,
  Lock,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import { Badge } from "@/components/ui/badge"
import type { Template, ParticipantRole, Audience, Domain, TemplateOutputFormat } from "@/lib/types-v0"
import { participantRoleLabels } from "@/lib/mock/data"

const availablePerspectives: ParticipantRole[] = ["party_a", "party_b", "observer"]
const availableAudiences: Audience[] = ["internal", "external"]
const availableDomains: Domain[] = ["psychology", "medical", "sales", "legal", "education", "it", "consulting", "hr", "general", "meetings", "business", "support", "technical"]

export default function EditTemplatePage() {
  const t = useTranslations('templateEdit')
  const tc = useTranslations('common')
  const locale = useLocale()
  const params = useParams()
  const router = useRouter()
  const templateId = params.id as string

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [enhancingInstructions, setEnhancingInstructions] = useState(false)
  const [template, setTemplate] = useState<Template | null>(null)
  
  // Form state
  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [instructions, setInstructions] = useState("")
  const [selectedPerspectives, setSelectedPerspectives] = useState<ParticipantRole[]>([])
  const [selectedAudiences, setSelectedAudiences] = useState<Audience[]>([])
  const [selectedDomains, setSelectedDomains] = useState<Domain[]>([])
  const [styleRules, setStyleRules] = useState("")
  const [defaultDoInstructions, setDefaultDoInstructions] = useState("")
  const [defaultDontInstructions, setDefaultDontInstructions] = useState("")
  const [customInstructions, setCustomInstructions] = useState("")
  const [outputFormat, setOutputFormat] = useState<TemplateOutputFormat>('markdown')
  const [isInstalled, setIsInstalled] = useState(false)

  useEffect(() => {
    fetchTemplate()
  }, [templateId])

  async function fetchTemplate() {
    try {
      const response = await fetch(`/api/templates/${templateId}`)
      if (!response.ok) throw new Error('Failed to fetch template')
      const data = await response.json()
      setTemplate(data)
      
      // Populate form
      setName(data.name)
      setDescription(data.description || '')
      setInstructions(data.instructions || '')
      setSelectedPerspectives(data.intended_perspectives || data.intendedPerspectives || [])
      setSelectedAudiences(data.allowed_audience || data.allowedAudience || [])
      setSelectedDomains(data.domain_tags || data.domainTags || [])
      setStyleRules((data.style_rules || data.styleRules || []).join('\n'))
      setDefaultDoInstructions(data.default_do_instructions || data.defaultDoInstructions || '')
      setDefaultDontInstructions(data.default_dont_instructions || data.defaultDontInstructions || '')
      setCustomInstructions(data.custom_instructions || data.customInstructions || '')
      setOutputFormat(data.output_format || data.outputFormat || 'markdown')
      setIsInstalled(!!data.marketplaceSourceId)
    } catch (error) {
      console.error('Error fetching template:', error)
      toast.error(t('loadFailed'))
    } finally {
      setLoading(false)
    }
  }

  const handleEnhanceInstructions = async () => {
    if (!name.trim() && !instructions.trim()) {
      toast.error(t('enterNameOrDescription'))
      return
    }
    setEnhancingInstructions(true)
    try {
      const res = await fetch("/api/templates/enhance-description", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), description: instructions.trim() }),
      })
      if (!res.ok) throw new Error((await res.json()).error || t('enhanceFailed'))
      const { enhancedInstructions, generatedDescription } = await res.json()
      if (enhancedInstructions) setInstructions(enhancedInstructions)
      if (generatedDescription) setDescription(generatedDescription)
      toast.success(t('enhancedBoth'))
    } catch (err: any) {
      toast.error(err.message || t('enhanceFailed'))
    } finally {
      setEnhancingInstructions(false)
    }
  }

  const handleSave = async () => {
    if (!name.trim()) {
      toast.error(t('nameRequired'))
      return
    }

    if (selectedPerspectives.length === 0) {
      toast.error(t('perspectiveRequired'))
      return
    }

    if (selectedAudiences.length === 0) {
      toast.error(t('audienceRequired'))
      return
    }

    setSaving(true)
    try {
      const response = await fetch(`/api/templates/${templateId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim(),
          instructions: instructions.trim(),
          intendedPerspectives: selectedPerspectives,
          allowedAudience: selectedAudiences,
          domainTags: selectedDomains,
          styleRules: styleRules.split('\n').filter(r => r.trim()),
          defaultDoInstructions: defaultDoInstructions.trim(),
          defaultDontInstructions: defaultDontInstructions.trim(),
          customInstructions: customInstructions.trim(),
          language: locale,
          outputFormat,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || t('saveFailed'))
      }

      toast.success(t('saveSuccess'))
      router.push('/templates')
    } catch (error) {
      console.error('Error updating template:', error)
      const errorMessage = error instanceof Error ? error.message : t('saveFailed')
      toast.error(errorMessage)
    } finally {
      setSaving(false)
    }
  }

  const togglePerspective = (perspective: ParticipantRole) => {
    setSelectedPerspectives(prev =>
      prev.includes(perspective)
        ? prev.filter(p => p !== perspective)
        : [...prev, perspective]
    )
  }

  const toggleAudience = (audience: Audience) => {
    setSelectedAudiences(prev =>
      prev.includes(audience)
        ? prev.filter(a => a !== audience)
        : [...prev, audience]
    )
  }

  const toggleDomain = (domain: Domain) => {
    setSelectedDomains(prev =>
      prev.includes(domain)
        ? prev.filter(d => d !== domain)
        : [...prev, domain]
    )
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto" />
          <p className="mt-2 text-sm text-muted-foreground">{t('loadingTemplate')}</p>
        </div>
      </div>
    )
  }

  if (!template) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <p className="text-muted-foreground">{t('notFound')}</p>
          <Link href="/templates">
            <Button variant="outline" className="mt-4">
              <ArrowLeft className="mr-2 h-4 w-4" />
              {t('backToTemplates')}
            </Button>
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto pb-12">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/templates">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-semibold text-foreground">{t('editTitle')}</h1>
            <p className="text-sm text-muted-foreground mt-1">
              {t('editSubtitle')}
            </p>
          </div>
        </div>
        <Button onClick={handleSave} disabled={saving}>
          {saving ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              {t('saving')}
            </>
          ) : (
            <>
              <Save className="mr-2 h-4 w-4" />
              {t('saveChanges')}
            </>
          )}
        </Button>
      </div>

      {/* Basic Information */}
      <Card>
        <CardHeader>
          <CardTitle>{t('basicInfo')}</CardTitle>
          <CardDescription>{t('basicInfoDescription')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">{t('name')}</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t('namePlaceholder')}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="description">{t('description')}</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value.slice(0, 250))}
              maxLength={250}
              placeholder={t('shortDescriptionPlaceholder')}
              rows={2}
            />
            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground">
                {t('shortDescriptionHelp')}
              </p>
              <span className={`text-xs ${description.length > 230 ? 'text-orange-500' : 'text-muted-foreground'}`}>
                {description.length}/250
              </span>
            </div>
          </div>

          {isInstalled ? (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>{t('generationInstructions')}</Label>
                <div className="rounded-lg border border-border bg-muted/50 p-4 flex items-start gap-3">
                  <Lock className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                  <div>
                    <p className="text-sm font-medium text-foreground">{t('promptProtected')}</p>
                    <p className="text-xs text-muted-foreground mt-1">{t('promptProtectedDesc')}</p>
                  </div>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="customInstructions">{t('customInstructions')}</Label>
                <Textarea
                  id="customInstructions"
                  value={customInstructions}
                  onChange={(e) => setCustomInstructions(e.target.value)}
                  placeholder={t('customInstructionsPlaceholder')}
                  rows={4}
                />
                <p className="text-xs text-muted-foreground">
                  {t('customInstructionsHelp')}
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="instructions">{t('generationInstructions')}</Label>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 gap-1.5 text-xs text-muted-foreground hover:text-primary"
                  onClick={handleEnhanceInstructions}
                  disabled={enhancingInstructions || (!name.trim() && !instructions.trim())}
                >
                  {enhancingInstructions ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
                  {t('enhanceWithAI')}
                </Button>
              </div>
              <Textarea
                id="instructions"
                value={instructions}
                onChange={(e) => setInstructions(e.target.value)}
                placeholder={t('instructionsPlaceholder')}
                rows={4}
              />
              <p className="text-xs text-muted-foreground">
                {t('instructionsHelp')}
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Perspectives */}
      <Card>
        <CardHeader>
          <CardTitle>{t('perspectives')}</CardTitle>
          <CardDescription>{t('perspectivesDescription')}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {availablePerspectives.map((perspective) => (
              <div key={perspective} className="flex items-center space-x-2">
                <Checkbox
                  id={`perspective-${perspective}`}
                  checked={selectedPerspectives.includes(perspective)}
                  onCheckedChange={() => togglePerspective(perspective)}
                />
                <Label
                  htmlFor={`perspective-${perspective}`}
                  className="text-sm font-normal cursor-pointer"
                >
                  {participantRoleLabels[perspective]}
                </Label>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Audience */}
      <Card>
        <CardHeader>
          <CardTitle>{t('audience')}</CardTitle>
          <CardDescription>{t('audienceDescription')}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {availableAudiences.map((audience) => (
              <div key={audience} className="flex items-center space-x-2">
                <Checkbox
                  id={`audience-${audience}`}
                  checked={selectedAudiences.includes(audience)}
                  onCheckedChange={() => toggleAudience(audience)}
                />
                <Label
                  htmlFor={`audience-${audience}`}
                  className="text-sm font-normal cursor-pointer capitalize"
                >
                  {audience}
                </Label>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Domains */}
      <Card>
        <CardHeader>
          <CardTitle>{t('domainTags')}</CardTitle>
          <CardDescription>{t('domainTagsDescription')}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {availableDomains.map((domain) => (
              <Badge
                key={domain}
                variant={selectedDomains.includes(domain) ? "default" : "outline"}
                className="cursor-pointer capitalize"
                onClick={() => toggleDomain(domain)}
              >
                {domain}
              </Badge>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Style Rules */}
      <Card>
        <CardHeader>
          <CardTitle>{t('styleRules')}</CardTitle>
          <CardDescription>{t('styleRulesDescription')}</CardDescription>
        </CardHeader>
        <CardContent>
          <Textarea
            value={styleRules}
            onChange={(e) => setStyleRules(e.target.value)}
            placeholder="e.g., Use bullet points&#10;Keep paragraphs under 3 sentences&#10;Use active voice"
            rows={6}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t('outputType')}</CardTitle>
          <CardDescription>{t('outputTypeDescription')}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {[
              { code: 'markdown', label: t('outputTypeMarkdown') },
              { code: 'email_text', label: t('outputTypeEmailText') },
            ].map(({ code, label }) => (
              <Badge
                key={code}
                variant={outputFormat === code ? "default" : "outline"}
                className="cursor-pointer"
                onClick={() => setOutputFormat(code as TemplateOutputFormat)}
              >
                {label}
              </Badge>
            ))}
          </div>
          {outputFormat === 'email_text' && (
            <p className="text-xs text-muted-foreground mt-2">{t('outputTypeEmailHint')}</p>
          )}
        </CardContent>
      </Card>

      {/* Default Generation Instructions */}
      <Card>
        <CardHeader>
          <CardTitle>{t('defaultGenerationInstructions')}</CardTitle>
          <CardDescription>
            {t('defaultGenerationInstructionsDescription')}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="defaultDo">{t('defaultDoInstructions')}</Label>
            <Textarea
              id="defaultDo"
              value={defaultDoInstructions}
              onChange={(e) => setDefaultDoInstructions(e.target.value)}
              placeholder={"e.g., Focus on action items and deadlines\nInclude exact quotes for key decisions\nHighlight areas of disagreement"}
              rows={4}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="defaultDont">{t('defaultDontInstructions')}</Label>
            <Textarea
              id="defaultDont"
              value={defaultDontInstructions}
              onChange={(e) => setDefaultDontInstructions(e.target.value)}
              placeholder={"e.g., Skip smalltalk and greetings\nLeave out off-topic tangents\nDon't include personal anecdotes"}
              rows={4}
            />
          </div>
        </CardContent>
      </Card>

      {/* Footer Actions */}
      <div className="flex items-center justify-between pt-6 border-t">
        <Link href="/templates">
          <Button variant="outline">
            {tc('cancel')}
          </Button>
        </Link>
        <Button onClick={handleSave} disabled={saving}>
          {saving ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              {t('saving')}
            </>
          ) : (
            <>
              <Save className="mr-2 h-4 w-4" />
              {t('saveChanges')}
            </>
          )}
        </Button>
      </div>
    </div>
  )
}
