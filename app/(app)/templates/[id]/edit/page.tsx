"use client"

export const dynamic = 'force-dynamic'

import { useState, useEffect } from "react"
import { useParams, useRouter } from "next/navigation"
import Link from "next/link"
import {
  ArrowLeft,
  Save,
  Loader2,
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
  const [template, setTemplate] = useState<Template | null>(null)
  
  // Form state
  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [selectedPerspectives, setSelectedPerspectives] = useState<ParticipantRole[]>([])
  const [selectedAudiences, setSelectedAudiences] = useState<Audience[]>([])
  const [selectedDomains, setSelectedDomains] = useState<Domain[]>([])
  const [styleRules, setStyleRules] = useState("")
  const [requiredInputs, setRequiredInputs] = useState("")

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
      setSelectedPerspectives(data.intendedPerspectives)
      setSelectedAudiences(data.allowedAudience)
      setSelectedDomains(data.domainTags)
      setStyleRules(data.styleRules.join('\n'))
      setRequiredInputs(data.requiredInputs.join('\n'))
    } catch (error) {
      console.error('Error fetching template:', error)
      alert('Failed to load template')
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async () => {
    if (!name.trim()) {
      alert('Please enter a template name')
      return
    }

    if (selectedPerspectives.length === 0) {
      alert('Please select at least one perspective')
      return
    }

    if (selectedAudiences.length === 0) {
      alert('Please select at least one audience')
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
          requiredInputs: requiredInputs.split('\n').filter(i => i.trim()),
        }),
      })

      if (!response.ok) throw new Error('Failed to update template')

      router.push('/templates')
    } catch (error) {
      console.error('Error updating template:', error)
      alert('Failed to update template')
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
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe what this template is for..."
              rows={3}
            />
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

      {/* Required Inputs */}
      <Card>
        <CardHeader>
          <CardTitle>Required Inputs</CardTitle>
          <CardDescription>Enter each required input on a new line</CardDescription>
        </CardHeader>
        <CardContent>
          <Textarea
            value={requiredInputs}
            onChange={(e) => setRequiredInputs(e.target.value)}
            placeholder="e.g., Full transcript&#10;Speaker roles&#10;Key topics discussed"
            rows={4}
          />
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
