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
import type { ParticipantRole, Audience, Domain } from "@/lib/types-v0"
import { participantRoleLabels } from "@/lib/mock/data"

const availablePerspectives: ParticipantRole[] = ["party_a", "party_b", "observer"]
const availableAudiences: Audience[] = ["internal", "external"]
const availableDomains: Domain[] = ["legal", "sales", "hr", "medical", "education", "consulting", "general"]

export default function CreateTemplateFromScratchPage() {
  const router = useRouter()
  const [saving, setSaving] = useState(false)
  const [enhancingDescription, setEnhancingDescription] = useState(false)
  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [selectedPerspectives, setSelectedPerspectives] = useState<ParticipantRole[]>(["party_a", "party_b", "observer"])
  const [selectedAudiences, setSelectedAudiences] = useState<Audience[]>(["internal"])
  const [selectedDomains, setSelectedDomains] = useState<Domain[]>([])
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
      toast.error("Enter a template name or rough description first")
      return
    }
    setEnhancingDescription(true)
    try {
      const res = await fetch("/api/templates/enhance-description", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), description: description.trim() }),
      })
      if (!res.ok) throw new Error((await res.json()).error || "Failed to enhance")
      const { enhanced } = await res.json()
      if (enhanced) setDescription(enhanced)
    } catch (err: any) {
      toast.error(err.message || "Failed to enhance description")
    } finally {
      setEnhancingDescription(false)
    }
  }

  const handleCreate = async () => {
    if (!name.trim()) {
      toast.error("Please enter a template name")
      return
    }
    if (selectedPerspectives.length === 0) {
      toast.error("Please select at least one perspective")
      return
    }
    if (selectedAudiences.length === 0) {
      toast.error("Please select at least one audience")
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
        }),
      })

      const data = await response.json()
      if (!response.ok) throw new Error(data.error || data.details || "Failed to create")

      toast.success("Template created")
      router.push(`/templates/${data.id}/edit`)
    } catch (error) {
      console.error("Create template error:", error)
      toast.error(error instanceof Error ? error.message : "Failed to create template")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/templates">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-xl font-semibold text-foreground">Create Template from Scratch</h1>
          <p className="text-sm text-muted-foreground">
            Define a new template manually without sample documents
          </p>
        </div>
      </div>

      <Card className="border-border">
        <CardHeader>
          <CardTitle>Basic Info</CardTitle>
          <CardDescription>Name and description for your template</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Template name *</Label>
            <Input
              id="name"
              placeholder="e.g. Meeting Minutes"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="description">Description</Label>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 gap-1.5 text-xs text-muted-foreground hover:text-primary"
                onClick={handleEnhanceDescription}
                disabled={enhancingDescription || (!name.trim() && !description.trim())}
              >
                {enhancingDescription ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
                Enhance with AI
              </Button>
            </div>
            <Textarea
              id="description"
              placeholder="e.g. A structured protocol for client consultations, organized by topics discussed, with action items and follow-ups..."
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
          <CardTitle>Constraints</CardTitle>
          <CardDescription>Who can use this template and for whom</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Perspectives *</Label>
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
            <Label>Audience *</Label>
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
            <Label>Domain (optional)</Label>
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
              If none selected, template will use &quot;general&quot;
            </p>
          </div>
        </CardContent>
      </Card>

      <Card className="border-border">
        <CardHeader>
          <CardTitle>Generation instructions (optional)</CardTitle>
          <CardDescription>Instructions for the AI when generating outputs with this template</CardDescription>
        </CardHeader>
        <CardContent>
          <Textarea
            placeholder="e.g. Use bullet points for key findings. Include a summary at the top..."
            value={instructions}
            onChange={(e) => setInstructions(e.target.value)}
            rows={4}
            className="resize-none"
          />
        </CardContent>
      </Card>

      <div className="flex justify-between">
        <Button variant="outline" asChild>
          <Link href="/templates">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Cancel
          </Link>
        </Button>
        <Button onClick={handleCreate} disabled={saving}>
          {saving ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Creating...
            </>
          ) : (
            <>
              <Save className="h-4 w-4 mr-2" />
              Create template
            </>
          )}
        </Button>
      </div>
    </div>
  )
}
