"use client"

export const dynamic = 'force-dynamic'

import { useState, useRef } from "react"
import { useTranslations } from "next-intl"
import { Link, useRouter } from "@/i18n/navigation"
import { toast } from "sonner"
import {
  ArrowLeft,
  ArrowRight,
  Upload,
  FileText,
  Check,
  Sparkles,
  Users,
  User,
  ListChecks,
  Save,
  X,
  File,
  Loader2,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import { Progress } from "@/components/ui/progress"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { cn } from "@/lib/utils"
import { participantRoleLabels } from "@/lib/mock/data"
import type { TemplateOutputFormat } from "@/lib/types-v0"

interface UploadedFile {
  name: string
  size: string
  type: string
}

export default function TemplateWizardPage() {
  const t = useTranslations('templateFromSamples')
  const tt = useTranslations('templates')
  const tc = useTranslations('common')
  const steps = [
    { id: 1, name: t('uploadSamples'), description: t('uploadHint') },
    { id: 2, name: t('analysisResults'), description: t('analysisReview') },
    { id: 3, name: t('confirmConstraints'), description: t('constraintsHint') },
    { id: 4, name: t('saveTemplate'), description: t('saveHint') },
  ]
  const router = useRouter()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [currentStep, setCurrentStep] = useState(1)
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([])
  const [uploadedFileData, setUploadedFileData] = useState<File[]>([])
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [analysisComplete, setAnalysisComplete] = useState(false)
  const [isSaving, setIsSaving] = useState(false)

  // Analysis results (from AI)
  const [analysisResults, setAnalysisResults] = useState({
    sections: [
      { name: "Executive Summary", detected: true },
      { name: "Key Findings", detected: true },
      { name: "Detailed Analysis", detected: true },
      { name: "Recommendations", detected: true },
      { name: "Appendix", detected: false },
    ],
    tone: "Professional / Formal",
    perspective: "Third Person",
    language: "English",
    suggestedInstructions: "",
  })

  // Constraints
  const [selectedPerspectives, setSelectedPerspectives] = useState<string[]>(["party_a", "party_b"])
  const [selectedAudience, setSelectedAudience] = useState<string[]>(["external"])
  const [outputFormat, setOutputFormat] = useState<TemplateOutputFormat>('markdown')

  // Template details
  const [templateName, setTemplateName] = useState("")
  const [templateDescription, setTemplateDescription] = useState("")
  const [templateTags, setTemplateTags] = useState("")

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files) return

    const fileArray = Array.from(files)
    const fileInfoArray = fileArray.map(file => ({
      name: file.name,
      size: `${(file.size / 1024).toFixed(0)} KB`,
      type: file.name.split('.').pop()?.toUpperCase() || 'FILE',
    }))

    setUploadedFiles(prev => [...prev, ...fileInfoArray])
    setUploadedFileData(prev => [...prev, ...fileArray])
  }

  const handleAnalyze = async () => {
    if (uploadedFileData.length === 0) {
      toast.error(t('uploadAtLeastOne'))
      return
    }

    setIsAnalyzing(true)
    try {
      // Create FormData with files
      const formData = new FormData()
      uploadedFileData.forEach(file => {
        formData.append('files', file)
      })

      // Call AI analysis API
      const response = await fetch('/api/templates/analyze-samples', {
        method: 'POST',
        body: formData,
      })

      if (!response.ok) {
        throw new Error(t('analyzeFailed'))
      }

      const data = await response.json()
      
      // Update analysis results with AI response
      setAnalysisResults({
        sections: data.analysis.sections || [],
        tone: data.analysis.tone || 'Professional / Formal',
        perspective: data.analysis.perspective || 'Third Person',
        language: data.analysis.language || 'English',
        suggestedInstructions: data.analysis.suggestedInstructions || '',
      })

      setIsAnalyzing(false)
      setAnalysisComplete(true)
      toast.success(t('analysisComplete', { count: data.filesAnalyzed }))
    } catch (error) {
      console.error('Analysis failed:', error)
      toast.error(t('analyzeFailed'))
      setIsAnalyzing(false)
    }
  }

  const handleRemoveFile = (fileName: string) => {
    const index = uploadedFiles.findIndex(f => f.name === fileName)
    setUploadedFiles(uploadedFiles.filter((f) => f.name !== fileName))
    if (index !== -1) {
      setUploadedFileData(prev => prev.filter((_, i) => i !== index))
    }
  }

  const handleSaveTemplate = async () => {
    if (!templateName.trim()) {
      toast.error(t('nameRequired'))
      return
    }

    setIsSaving(true)
    try {
      const response = await fetch('/api/templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: templateName.trim(),
          description: templateDescription.trim(),
          intended_perspectives: selectedPerspectives,
          allowed_audience: selectedAudience,
          domain_tags: templateTags.split(',').map(t => t.trim()).filter(t => t),
          sections: analysisResults.sections
            .filter(s => s.detected)
            .map((s, i) => ({
              id: `section_${i}`,
              name: s.name,
              description: (s as any).description || `${s.name} section`,
              isRequired: true,
            })),
          required_inputs: [],
          style_rules: [
            `Tone: ${analysisResults.tone}`,
            `Perspective: ${analysisResults.perspective}`,
            `Language: ${analysisResults.language}`,
          ],
          suggestion_triggers: [],
          instructions: analysisResults.suggestedInstructions || `Generate a ${templateName} following the detected structure and style.`,
          outputFormat,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        console.error('Error creating template:', errorData)
        throw new Error(errorData.details || errorData.error || 'Failed to create template')
      }

      const data = await response.json()
      toast.success(t('templateCreated', { name: templateName }))
      router.push('/templates')
    } catch (error) {
      console.error('Error creating template:', error)
      const errorMessage = error instanceof Error ? error.message : t('createFailed')
      toast.error(errorMessage)
    } finally {
      setIsSaving(false)
    }
  }

  const togglePerspective = (perspective: string) => {
    setSelectedPerspectives((prev) =>
      prev.includes(perspective) ? prev.filter((p) => p !== perspective) : [...prev, perspective]
    )
  }

  const toggleAudience = (audience: string) => {
    setSelectedAudience((prev) =>
      prev.includes(audience) ? prev.filter((a) => a !== audience) : [...prev, audience]
    )
  }


  const canProceed = () => {
    switch (currentStep) {
      case 1:
        return uploadedFiles.length > 0
      case 2:
        return analysisComplete
      case 3:
        return selectedPerspectives.length > 0 && selectedAudience.length > 0
      case 4:
        return templateName.trim().length > 0
      default:
        return true
    }
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href="/templates">
          <Button variant="ghost" size="sm" title={tc('back')}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-xl font-semibold text-foreground">{t('title')}</h1>
          <p className="text-sm text-muted-foreground">
            {t('subtitle')}
          </p>
        </div>
      </div>

      {/* Progress Steps */}
      <div className="flex items-center justify-between">
        {steps.map((step, index) => (
          <div key={step.id} className="flex items-center flex-1">
            <div className="flex flex-col items-center flex-1">
              <div
                className={cn(
                  "flex h-10 w-10 items-center justify-center rounded-full border-2 transition-colors",
                  currentStep > step.id
                    ? "bg-success border-success text-success-foreground"
                    : currentStep === step.id
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-secondary text-muted-foreground"
                )}
              >
                {currentStep > step.id ? (
                  <Check className="h-5 w-5" />
                ) : (
                  <span className="text-sm font-medium">{step.id}</span>
                )}
              </div>
              <div className="mt-2 text-center">
                <p
                  className={cn(
                    "text-xs font-medium",
                    currentStep >= step.id ? "text-foreground" : "text-muted-foreground"
                  )}
                >
                  {step.name}
                </p>
              </div>
            </div>
            {index < steps.length - 1 && (
              <div
                className={cn(
                  "h-0.5 flex-1 mx-2",
                  currentStep > step.id ? "bg-success" : "bg-border"
                )}
              />
            )}
          </div>
        ))}
      </div>

      {/* Step Content */}
      <Card className="border-border">
        {/* Step 1: Upload Samples */}
        {currentStep === 1 && (
          <>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Upload className="h-5 w-5" />
                {t('uploadSamples')}
              </CardTitle>
              <CardDescription>
                {t('uploadHint')}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Upload Area */}
              <div 
                className="border-2 border-dashed border-border rounded-lg p-8 text-center hover:border-muted-foreground transition-colors cursor-pointer"
                onClick={() => fileInputRef.current?.click()}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,.docx,.txt,.doc"
                  multiple
                  onChange={handleFileSelect}
                  className="hidden"
                />
                <Upload className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
                <p className="text-sm text-foreground font-medium mb-1">
                  {t('dragDrop')}
                </p>
                <p className="text-xs text-muted-foreground">
                  {t('browseHint')}
                </p>
              </div>

              {/* Uploaded Files */}
              {uploadedFiles.length > 0 && (
                <div className="space-y-2">
                  <Label className="text-sm">{t('uploadedFiles')}</Label>
                  {uploadedFiles.map((file) => (
                    <div
                      key={file.name}
                      className="flex items-center justify-between p-3 rounded-lg bg-secondary/50 border border-border"
                    >
                      <div className="flex items-center gap-3">
                        <File className="h-5 w-5 text-muted-foreground" />
                        <div>
                          <p className="text-sm font-medium text-foreground">{file.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {file.type} · {file.size}
                          </p>
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRemoveFile(file.name)}
                        title={tc('delete')}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </>
        )}

        {/* Step 2: Analysis */}
        {currentStep === 2 && (
          <>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="h-5 w-5" />
                {t('analysisResults')}
              </CardTitle>
              <CardDescription>
                {t('analysisReview')}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {!analysisComplete && !isAnalyzing && (
                <div className="text-center py-8">
                  <Button onClick={handleAnalyze} size="lg">
                    <Sparkles className="h-4 w-4 mr-2" />
                    {t('analyzeSamples')}
                  </Button>
                </div>
              )}

              {isAnalyzing && (
                <div className="text-center py-8 space-y-4">
                  <div className="flex justify-center">
                    <div className="h-12 w-12 rounded-full border-2 border-primary border-t-transparent animate-spin" />
                  </div>
                  <p className="text-sm text-muted-foreground">{t('analyzing')}</p>
                  <Progress value={65} className="w-48 mx-auto" />
                </div>
              )}

              {analysisComplete && (
                <>
                  {/* Inferred Sections */}
                  <div className="space-y-3">
                    <Label>{t('inferredSections')}</Label>
                    <div className="grid gap-2">
                      {analysisResults.sections.map((section) => (
                        <div
                          key={section.name}
                          className="flex items-center justify-between p-3 rounded-lg bg-secondary/50 border border-border"
                        >
                          <span className="text-sm font-medium text-foreground">
                            {section.name}
                          </span>
                          <Badge variant={section.detected ? "default" : "secondary"}>
                            {section.detected ? t('detected') : t('optional')}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Style Analysis */}
                  <div className="grid gap-4 md:grid-cols-3">
                    <div className="p-4 rounded-lg bg-secondary/50 border border-border">
                      <p className="text-xs text-muted-foreground mb-1">{t('tone')}</p>
                      <p className="text-sm font-medium text-foreground">
                        {analysisResults.tone}
                      </p>
                    </div>
                    <div className="p-4 rounded-lg bg-secondary/50 border border-border">
                      <p className="text-xs text-muted-foreground mb-1">{t('perspective')}</p>
                      <p className="text-sm font-medium text-foreground">
                        {analysisResults.perspective}
                      </p>
                    </div>
                    <div className="p-4 rounded-lg bg-secondary/50 border border-border">
                      <p className="text-xs text-muted-foreground mb-1">{t('language')}</p>
                      <p className="text-sm font-medium text-foreground">
                        {analysisResults.language}
                      </p>
                    </div>
                  </div>
                </>
              )}
            </CardContent>
          </>
        )}

        {/* Step 3: Constraints */}
        {currentStep === 3 && (
          <>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ListChecks className="h-5 w-5" />
                {t('confirmConstraints')}
              </CardTitle>
              <CardDescription>
                {t('constraintsHint')}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Intended Perspectives */}
              <div className="space-y-3">
                <Label className="flex items-center gap-2">
                  <User className="h-4 w-4" />
                  {t('intendedPerspectives')}
                </Label>
                <p className="text-xs text-muted-foreground">
                  {t('intendedPerspectivesHint')}
                </p>
                <div className="flex flex-wrap gap-2">
                  {Object.entries(participantRoleLabels).map(([key, label]) => (
                    <button
                      key={key}
                      onClick={() => togglePerspective(key)}
                      className={cn(
                        "px-3 py-1.5 rounded-md text-sm transition-colors",
                        selectedPerspectives.includes(key)
                          ? "bg-primary text-primary-foreground"
                          : "bg-secondary hover:bg-accent text-foreground"
                      )}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Intended Audience */}
              <div className="space-y-3">
                <Label className="flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  {t('intendedAudience')}
                </Label>
                <div className="flex gap-2">
                  {["internal", "external"].map((audience) => (
                    <button
                      key={audience}
                      onClick={() => toggleAudience(audience)}
                      className={cn(
                        "px-4 py-2 rounded-md text-sm font-medium transition-colors flex-1",
                        selectedAudience.includes(audience)
                          ? "bg-primary text-primary-foreground"
                          : "bg-secondary hover:bg-accent text-foreground"
                      )}
                    >
                      {audience === "internal" ? t('internalTeam') : t('externalThirdParties')}
                    </button>
                  ))}
                </div>
              </div>

              {/* Output Type */}
              <div className="space-y-3">
                <Label>{tt('outputType')}</Label>
                <Select value={outputFormat} onValueChange={(v) => setOutputFormat(v as TemplateOutputFormat)}>
                  <SelectTrigger className="bg-secondary border-border">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="markdown">{tt('outputTypeMarkdown')}</SelectItem>
                    <SelectItem value="email_text">{tt('outputTypeEmailText')}</SelectItem>
                  </SelectContent>
                </Select>
                {outputFormat === 'email_text' && (
                  <p className="text-xs text-muted-foreground">{tt('outputTypeEmailHint')}</p>
                )}
              </div>

            </CardContent>
          </>
        )}

        {/* Step 4: Save */}
        {currentStep === 4 && (
          <>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Save className="h-5 w-5" />
                {t('saveTemplate')}
              </CardTitle>
              <CardDescription>
                {t('saveHint')}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">{t('templateName')} *</Label>
                <Input
                  id="name"
                  value={templateName}
                  onChange={(e) => setTemplateName(e.target.value)}
                  placeholder={t('templateNamePlaceholder')}
                  className="bg-secondary border-border"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="description">{t('description')}</Label>
                <Textarea
                  id="description"
                  value={templateDescription}
                  onChange={(e) => setTemplateDescription(e.target.value)}
                  placeholder={t('descriptionPlaceholder')}
                  className="bg-secondary border-border min-h-[100px]"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="tags">{t('tags')}</Label>
                <Input
                  id="tags"
                  value={templateTags}
                  onChange={(e) => setTemplateTags(e.target.value)}
                  placeholder={t('tagsPlaceholder')}
                  className="bg-secondary border-border"
                />
              </div>

              {/* Summary */}
              <div className="p-4 rounded-lg bg-secondary/30 border border-border mt-6">
                <h4 className="text-sm font-medium text-foreground mb-3">{t('summary')}</h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">{t('sections')}</span>
                    <span className="font-medium">{analysisResults.sections.filter((s) => s.detected).length}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">{t('intendedPerspectives')}</span>
                    <span className="font-medium">{selectedPerspectives.length}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">{t('audience')}</span>
                    <span className="font-medium capitalize">{selectedAudience.join(", ")}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">{tt('outputType')}</span>
                    <span className="font-medium">
                      {outputFormat === 'email_text' ? tt('outputTypeEmailText') : tt('outputTypeMarkdown')}
                    </span>
                  </div>
                </div>
              </div>
            </CardContent>
          </>
        )}
      </Card>

      {/* Navigation */}
      <div className="flex justify-between">
        <Button
          variant="outline"
          onClick={() => setCurrentStep((s) => s - 1)}
          disabled={currentStep === 1}
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          {tc('back')}
        </Button>
        {currentStep < 4 ? (
          <Button onClick={() => setCurrentStep((s) => s + 1)} disabled={!canProceed()}>
            {tc('next')}
            <ArrowRight className="h-4 w-4 ml-2" />
          </Button>
        ) : (
          <Button 
            disabled={!canProceed() || isSaving} 
            onClick={handleSaveTemplate}
          >
            {isSaving ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                {t('saving')}
              </>
            ) : (
              <>
                <Save className="h-4 w-4 mr-2" />
                {t('saveTemplate')}
              </>
            )}
          </Button>
        )}
      </div>
    </div>
  )
}
