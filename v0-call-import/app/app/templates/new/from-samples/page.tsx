"use client"

import { useState } from "react"
import Link from "next/link"
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
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import { Progress } from "@/components/ui/progress"
import { cn } from "@/lib/utils"
import { participantRoleLabels } from "@/lib/mock/data"

const steps = [
  { id: 1, name: "Upload Samples", description: "Upload sample reports" },
  { id: 2, name: "Analysis", description: "Review AI analysis" },
  { id: 3, name: "Constraints", description: "Set constraints" },
  { id: 4, name: "Save", description: "Name and save" },
]

interface UploadedFile {
  name: string
  size: string
  type: string
}

export default function TemplateWizardPage() {
  const [currentStep, setCurrentStep] = useState(1)
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([
    { name: "quarterly_report_template.pdf", size: "245 KB", type: "PDF" },
    { name: "client_summary_example.docx", size: "128 KB", type: "DOCX" },
  ])
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [analysisComplete, setAnalysisComplete] = useState(false)

  // Analysis results (mocked)
  const analysisResults = {
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
  }

  // Constraints
  const [selectedPerspectives, setSelectedPerspectives] = useState<string[]>(["party_a", "party_b"])
  const [selectedAudience, setSelectedAudience] = useState<string[]>(["external"])
  const [requiredInputs, setRequiredInputs] = useState<string[]>(["participants", "purpose"])

  // Template details
  const [templateName, setTemplateName] = useState("")
  const [templateDescription, setTemplateDescription] = useState("")
  const [templateTags, setTemplateTags] = useState("")

  const handleAnalyze = () => {
    setIsAnalyzing(true)
    setTimeout(() => {
      setIsAnalyzing(false)
      setAnalysisComplete(true)
    }, 2000)
  }

  const handleRemoveFile = (fileName: string) => {
    setUploadedFiles(uploadedFiles.filter((f) => f.name !== fileName))
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

  const toggleInput = (input: string) => {
    setRequiredInputs((prev) =>
      prev.includes(input) ? prev.filter((i) => i !== input) : [...prev, input]
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
        <Link href="/app/templates">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-xl font-semibold text-foreground">Create Template from Samples</h1>
          <p className="text-sm text-muted-foreground">
            Upload sample reports to create a new generation template
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
                Upload Sample Reports
              </CardTitle>
              <CardDescription>
                Upload PDF, DOCX, or TXT files that represent the output style you want
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Upload Area */}
              <div className="border-2 border-dashed border-border rounded-lg p-8 text-center hover:border-muted-foreground transition-colors cursor-pointer">
                <Upload className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
                <p className="text-sm text-foreground font-medium mb-1">
                  Drag and drop files here
                </p>
                <p className="text-xs text-muted-foreground">
                  or click to browse (PDF, DOCX, TXT)
                </p>
              </div>

              {/* Uploaded Files */}
              {uploadedFiles.length > 0 && (
                <div className="space-y-2">
                  <Label className="text-sm">Uploaded Files</Label>
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
                AI Analysis Results
              </CardTitle>
              <CardDescription>
                Review the detected structure, tone, and style from your samples
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {!analysisComplete && !isAnalyzing && (
                <div className="text-center py-8">
                  <Button onClick={handleAnalyze} size="lg">
                    <Sparkles className="h-4 w-4 mr-2" />
                    Analyze Samples
                  </Button>
                </div>
              )}

              {isAnalyzing && (
                <div className="text-center py-8 space-y-4">
                  <div className="flex justify-center">
                    <div className="h-12 w-12 rounded-full border-2 border-primary border-t-transparent animate-spin" />
                  </div>
                  <p className="text-sm text-muted-foreground">Analyzing your samples...</p>
                  <Progress value={65} className="w-48 mx-auto" />
                </div>
              )}

              {analysisComplete && (
                <>
                  {/* Inferred Sections */}
                  <div className="space-y-3">
                    <Label>Inferred Sections</Label>
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
                            {section.detected ? "Detected" : "Optional"}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Style Analysis */}
                  <div className="grid gap-4 md:grid-cols-3">
                    <div className="p-4 rounded-lg bg-secondary/50 border border-border">
                      <p className="text-xs text-muted-foreground mb-1">Tone</p>
                      <p className="text-sm font-medium text-foreground">
                        {analysisResults.tone}
                      </p>
                    </div>
                    <div className="p-4 rounded-lg bg-secondary/50 border border-border">
                      <p className="text-xs text-muted-foreground mb-1">Perspective</p>
                      <p className="text-sm font-medium text-foreground">
                        {analysisResults.perspective}
                      </p>
                    </div>
                    <div className="p-4 rounded-lg bg-secondary/50 border border-border">
                      <p className="text-xs text-muted-foreground mb-1">Language</p>
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
                Confirm Constraints
              </CardTitle>
              <CardDescription>
                Define who can use this template and what inputs are required
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Intended Perspectives */}
              <div className="space-y-3">
                <Label className="flex items-center gap-2">
                  <User className="h-4 w-4" />
                  Intended Perspectives
                </Label>
                <p className="text-xs text-muted-foreground">
                  Which participant viewpoints can this template generate outputs for?
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
                  Intended Audience
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
                      {audience === "internal" ? "Internal (Team)" : "External (Third Parties)"}
                    </button>
                  ))}
                </div>
              </div>

              {/* Required Inputs */}
              <div className="space-y-3">
                <Label>Required Inputs Checklist</Label>
                <div className="space-y-2">
                  {["participants", "purpose", "agenda", "venue", "date"].map((input) => (
                    <div
                      key={input}
                      className="flex items-center gap-3 p-3 rounded-lg bg-secondary/50 border border-border"
                    >
                      <Checkbox
                        id={input}
                        checked={requiredInputs.includes(input)}
                        onCheckedChange={() => toggleInput(input)}
                      />
                      <label
                        htmlFor={input}
                        className="text-sm font-medium capitalize cursor-pointer flex-1"
                      >
                        {input}
                      </label>
                    </div>
                  ))}
                </div>
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
                Save Template
              </CardTitle>
              <CardDescription>
                Give your template a name and optional tags for easy discovery
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Template Name *</Label>
                <Input
                  id="name"
                  value={templateName}
                  onChange={(e) => setTemplateName(e.target.value)}
                  placeholder="e.g., Client Consultation Summary"
                  className="bg-secondary border-border"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={templateDescription}
                  onChange={(e) => setTemplateDescription(e.target.value)}
                  placeholder="Describe when and how to use this template..."
                  className="bg-secondary border-border min-h-[100px]"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="tags">Tags (comma-separated)</Label>
                <Input
                  id="tags"
                  value={templateTags}
                  onChange={(e) => setTemplateTags(e.target.value)}
                  placeholder="e.g., legal, consultation, client"
                  className="bg-secondary border-border"
                />
              </div>

              {/* Summary */}
              <div className="p-4 rounded-lg bg-secondary/30 border border-border mt-6">
                <h4 className="text-sm font-medium text-foreground mb-3">Summary</h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Sections</span>
                    <span className="font-medium">{analysisResults.sections.filter((s) => s.detected).length}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Intended Perspectives</span>
                    <span className="font-medium">{selectedPerspectives.length}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Audience</span>
                    <span className="font-medium capitalize">{selectedAudience.join(", ")}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Required Inputs</span>
                    <span className="font-medium">{requiredInputs.length}</span>
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
          Back
        </Button>
        {currentStep < 4 ? (
          <Button onClick={() => setCurrentStep((s) => s + 1)} disabled={!canProceed()}>
            Next
            <ArrowRight className="h-4 w-4 ml-2" />
          </Button>
        ) : (
          <Button disabled={!canProceed()} asChild>
            <Link href="/app/templates">
              <Save className="h-4 w-4 mr-2" />
              Save Template
            </Link>
          </Button>
        )}
      </div>
    </div>
  )
}
