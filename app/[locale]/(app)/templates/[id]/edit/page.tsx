"use client"

export const dynamic = 'force-dynamic'

import { useState, useEffect } from "react"
import { useTranslations } from "next-intl"
import { useParams, useRouter } from "next/navigation"
import Link from "next/link"
import { toast } from "sonner"
import {
  ArrowLeft,
  Save,
  Loader2,
  Sparkles,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import { Badge } from "@/components/ui/badge"
import type { Template, ParticipantRole, Audience, Domain } from "@/lib/types-v0"
import { participantRoleLabels } from "@/lib/mock/data"

const availablePerspectives: ParticipantRole[] = ["party_a", "party_b", "observer"]
const availableAudiences: Audience[] = ["internal", "external"]
const availableDomains: Domain[] = ["legal", "sales", "hr", "medical", "education", "consulting", "general"]

export default function EditTemplatePage() {
  const params = useParams()
  const router = useRouter()
  const templateId = params.id as string

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [enhancingDescription, setEnhancingDescription] = useState(false)
  const [template, setTemplate] = useState<Template | null>(null)
  
  // Form state
  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [selectedPerspectives, setSelectedPerspectives] = useState<ParticipantRole[]>([])
  const [selectedAudiences, setSelectedAudiences] = useState<Audience[]>([])
  const [selectedDomains, setSelectedDomains] = useState<Domain[]>([])
  const [styleRules, setStyleRules] = useState("")
  const [defaultDoInstructions, setDefaultDoInstructions] = useState("")
  const [defaultDontInstructions, setDefaultDontInstructions] = useState("")

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
      setDescription(data.description)
      setSelectedPerspectives(data.intended_perspectives || data.intendedPerspectives || [])
      setSelectedAudiences(data.allowed_audience || data.allowedAudience || [])
      setSelectedDomains(data.domain_tags || data.domainTags || [])
      setStyleRules((data.style_rules || data.styleRules || []).join('\n'))
      setDefaultDoInstructions(data.default_do_instructions || data.defaultDoInstructions || '')
      setDefaultDontInstructions(data.default_dont_instructions || data.defaultDontInstructions || '')
    } catch (error) {
      console.error('Error fetching template:', error)
      toast.error('Failed to load template')
    } finally {
      setLoading(false)
    }
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

  const handleSave = async () => {
    if (!name.trim()) {
      toast.error('Please enter a template name')
      return
    }

    if (selectedPerspectives.length === 0) {
      toast.error('Please select at least one perspective')
      return
    }

    if (selectedAudiences.length === 0) {
      toast.error('Please select at least one audience')
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
          intendedPerspectives: selectedPerspectives,
          allowedAudience: selectedAudiences,
          domainTags: selectedDomains,
          styleRules: styleRules.split('\n').filter(r => r.trim()),
          defaultDoInstructions: defaultDoInstructions.trim(),
          defaultDontInstructions: defaultDontInstructions.trim(),
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to update template')
      }

      toast.success(`Template "${name}" updated`)
      router.push('/templates')
    } catch (error) {
      console.error('Error updating template:', error)
      const errorMessage = error instanceof Error ? error.message : 'Failed to update template'
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
          <p className="mt-2 text-sm text-muted-foreground">Loading template...</p>
        </div>
      </div>
    )
  }

  if (!template) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <p className="text-muted-foreground">Template not found</p>
          <Link href="/templates">
            <Button variant="outline" className="mt-4">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Templates
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
            <h1 className="text-2xl font-semibold text-foreground">Edit Template</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Modify template settings and constraints
            </p>
          </div>
        </div>
        <Button onClick={handleSave} disabled={saving}>
          {saving ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Saving...
            </>
          ) : (
            <>
              <Save className="mr-2 h-4 w-4" />
              Save Changes
            </>
          )}
        </Button>
      </div>

      {/* Basic Information */}
      <Card>
        <CardHeader>
          <CardTitle>Basic Information</CardTitle>
          <CardDescription>Template name and description</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Template Name</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Client Meeting Summary"
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
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="e.g. A structured protocol for client consultations, organized by topics discussed, with action items and follow-ups..."
              rows={3}
            />
            <p className="text-xs text-muted-foreground">
              This is the most important field — it tells the AI exactly what kind of document to generate and how to structure it.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Perspectives */}
      <Card>
        <CardHeader>
          <CardTitle>Intended Perspectives</CardTitle>
          <CardDescription>Select which perspectives this template is designed for</CardDescription>
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
          <CardTitle>Allowed Audience</CardTitle>
          <CardDescription>Who can receive outputs from this template</CardDescription>
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
          <CardTitle>Domain Tags</CardTitle>
          <CardDescription>Categorize this template by domain</CardDescription>
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
          <CardTitle>Style Rules</CardTitle>
          <CardDescription>Enter each rule on a new line</CardDescription>
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

      {/* Default Generation Instructions */}
      <Card>
        <CardHeader>
          <CardTitle>Default Generation Instructions</CardTitle>
          <CardDescription>
            Pre-fill the &quot;Do include&quot; and &quot;Do not include&quot; fields when this template is selected for generation
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="defaultDo">Do include...</Label>
            <Textarea
              id="defaultDo"
              value={defaultDoInstructions}
              onChange={(e) => setDefaultDoInstructions(e.target.value)}
              placeholder={"e.g., Focus on action items and deadlines\nInclude exact quotes for key decisions\nHighlight areas of disagreement"}
              rows={4}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="defaultDont">Do not include...</Label>
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
            Cancel
          </Button>
        </Link>
        <Button onClick={handleSave} disabled={saving}>
          {saving ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Saving...
            </>
          ) : (
            <>
              <Save className="mr-2 h-4 w-4" />
              Save Changes
            </>
          )}
        </Button>
      </div>
    </div>
  )
}
