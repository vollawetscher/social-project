"use client"

export const dynamic = 'force-dynamic'

import { useState } from "react"
import { useTranslations } from "next-intl"
import { Link, useRouter } from "@/i18n/navigation"
import { toast } from "sonner"
import { ArrowLeft, Save, Loader2, Sparkles } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import { Badge } from "@/components/ui/badge"
import type { ParticipantRole, Audience, Domain } from "@/lib/types-v0"
import { participantRoleLabels } from "@/lib/mock/data"

const availablePerspectives: ParticipantRole[] = ["party_a", "party_b", "observer"]
const availableAudiences: Audience[] = ["internal", "external"]
const availableDomains: Domain[] = ["legal", "sales", "hr", "medical", "education", "consulting", "general"]

export default function CreateTemplateFromScratchPage() {
  const t = useTranslations('templateEdit')
  const tc = useTranslations('common')
  const router = useRouter()
  const [saving, setSaving] = useState(false)
  const [enhancingDescription, setEnhancingDescription] = useState(false)
  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [selectedPerspectives, setSelectedPerspectives] = useState<ParticipantRole[]>(["party_a", "party_b", "observer"])
  const [selectedAudiences, setSelectedAudiences] = useState<Audience[]>(["internal"])
  const [selectedDomains, setSelectedDomains] = useState<Domain[]>([])
  const [selectedLanguage, setSelectedLanguage] = useState<string | null>(null)
  const [instructions, setInstructions] = useState("")

  const togglePerspective = (p: ParticipantRole) => {
    setSelectedPerspectives((prev) =>
      prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p]
    )
  }

  const toggleAudience = (a: Audience) => {
    setSelectedAudiences((prev) =>
      prev.includes(a) ? prev.filter((x) => x !== a) : [...prev, a]
    )
  }

  const toggleDomain = (d: Domain) => {
    setSelectedDomains((prev) =>
      prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d]
    )
  }

  const handleEnhanceDescription = async () => {
    if (!name.trim() && !description.trim()) {
      toast.error(t('enterNameOrDescription'))
      return
    }
    setEnhancingDescription(true)
    try {
      const res = await fetch("/api/templates/enhance-description", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), description: description.trim() }),
      })
      if (!res.ok) throw new Error((await res.json()).error || t('enhanceFailed'))
      const { enhanced } = await res.json()
      if (enhanced) setDescription(enhanced)
    } catch (err: any) {
      toast.error(err.message || t('enhanceFailed'))
    } finally {
      setEnhancingDescription(false)
    }
  }

  const handleCreate = async () => {
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
      const response = await fetch("/api/templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim() || `Template for generating ${name.trim()}`,
          intendedPerspectives: selectedPerspectives,
          allowedAudience: selectedAudiences,
          domainTags: selectedDomains.length > 0 ? selectedDomains : ["general"],
          sections: [],
          requiredInputs: [],
          styleRules: [],
          suggestionTriggers: [],
          instructions: instructions.trim() || undefined,
          language: selectedLanguage,
        }),
      })

      const data = await response.json()
      if (!response.ok) throw new Error(data.error || data.details || t('createFailed'))

      toast.success(t('createSuccess'))
      router.push(`/templates/${data.id}/edit`)
    } catch (error) {
      console.error("Create template error:", error)
      toast.error(error instanceof Error ? error.message : t('createFailed'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6 pb-24">
      <div className="flex items-center gap-3">
        <Link href="/templates">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-xl font-semibold text-foreground">{t('createFromScratchTitle')}</h1>
          <p className="text-sm text-muted-foreground">
            {t('createFromScratchSubtitle')}
          </p>
        </div>
      </div>

      <Card className="border-border">
        <CardHeader>
          <CardTitle>{t('basicInfo')}</CardTitle>
          <CardDescription>{t('basicInfoDescription')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">{t('name')} *</Label>
            <Input
              id="name"
              placeholder={t('namePlaceholderShort')}
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="description">{t('description')}</Label>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 gap-1.5 text-xs text-muted-foreground hover:text-primary"
                onClick={handleEnhanceDescription}
                disabled={enhancingDescription || (!name.trim() && !description.trim())}
              >
                {enhancingDescription ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
                {t('enhanceWithAI')}
              </Button>
            </div>
            <Textarea
              id="description"
              placeholder={t('descriptionPlaceholder')}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
            />
            <p className="text-xs text-muted-foreground">
              This is the most important field — it tells the AI exactly what kind of document to generate and how to structure it.
            </p>
          </div>
        </CardContent>
      </Card>

      <Card className="border-border">
        <CardHeader>
          <CardTitle>{t('constraints')}</CardTitle>
          <CardDescription>{t('constraintsDescription')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>{t('perspectives')} *</Label>
            <div className="flex flex-wrap gap-2">
              {availablePerspectives.map((p) => (
                <label key={p} className="flex items-center gap-2 cursor-pointer">
                  <Checkbox
                    checked={selectedPerspectives.includes(p)}
                    onCheckedChange={() => togglePerspective(p)}
                  />
                  <span className="text-sm">{participantRoleLabels[p]}</span>
                </label>
              ))}
            </div>
          </div>
          <div className="space-y-2">
            <Label>{t('audience')} *</Label>
            <div className="flex flex-wrap gap-2">
              {availableAudiences.map((a) => (
                <label key={a} className="flex items-center gap-2 cursor-pointer">
                  <Checkbox
                    checked={selectedAudiences.includes(a)}
                    onCheckedChange={() => toggleAudience(a)}
                  />
                  <span className="text-sm capitalize">{a}</span>
                </label>
              ))}
            </div>
          </div>
          <div className="space-y-2">
            <Label>{t('domainOptional')}</Label>
            <div className="flex flex-wrap gap-2">
              {availableDomains.map((d) => (
                <label key={d} className="flex items-center gap-2 cursor-pointer">
                  <Checkbox
                    checked={selectedDomains.includes(d)}
                    onCheckedChange={() => toggleDomain(d)}
                  />
                  <span className="text-sm capitalize">{d}</span>
                </label>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">
              {t('domainDefaultHint')}
            </p>
          </div>
          <div className="space-y-2">
            <Label>{t('templateLanguage')}</Label>
            <div className="flex flex-wrap gap-2">
              {[
                { code: 'de', label: 'Deutsch' },
                { code: 'en', label: 'English' },
                { code: 'es', label: 'Español' },
              ].map(({ code, label }) => (
                <Badge
                  key={code}
                  variant={selectedLanguage === code ? "default" : "outline"}
                  className="cursor-pointer"
                  onClick={() => setSelectedLanguage(selectedLanguage === code ? null : code)}
                >
                  {label}
                </Badge>
              ))}
            </div>
            {!selectedLanguage && (
              <p className="text-xs text-muted-foreground">{t('templateLanguageHint')}</p>
            )}
          </div>
        </CardContent>
      </Card>

      <Card className="border-border">
        <CardHeader>
          <CardTitle>{t('generationInstructionsOptional')}</CardTitle>
          <CardDescription>{t('generationInstructionsDescription')}</CardDescription>
        </CardHeader>
        <CardContent>
          <Textarea
            placeholder={t('generationInstructionsPlaceholder')}
            value={instructions}
            onChange={(e) => setInstructions(e.target.value)}
            rows={4}
            className="resize-none"
          />
        </CardContent>
      </Card>

      <div className="sticky bottom-0 z-20 -mx-1 border-t bg-background/95 px-1 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur">
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-between">
        <Button variant="outline" asChild className="w-full sm:w-auto">
          <Link href="/templates">
            <ArrowLeft className="h-4 w-4 mr-2" />
            {tc('cancel')}
          </Link>
        </Button>
        <Button onClick={handleCreate} disabled={saving} className="w-full sm:w-auto">
          {saving ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              {t('creating')}
            </>
          ) : (
            <>
              <Save className="h-4 w-4 mr-2" />
              {t('createTemplate')}
            </>
          )}
        </Button>
        </div>
      </div>
    </div>
  )
}
