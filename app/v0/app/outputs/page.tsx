"use client"

import { useState } from "react"
import {
  FileText,
  Filter,
  Calendar,
  User,
  Users,
  LayoutTemplate,
  ChevronRight,
  ExternalLink,
  Copy,
  Download,
  Eye,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"
import { cn } from "@/lib/utils"
import { mockOutputs, mockTemplates, participantRoleLabels, audienceLabels } from "@/lib/mock/data"
import type { Output } from "@/lib/types-v0"

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

function OutputDetailSheet({ output }: { output: Output }) {
  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="ghost" size="sm" className="gap-1.5">
          <Eye className="h-4 w-4" />
          View
        </Button>
      </SheetTrigger>
      <SheetContent className="w-[500px] sm:w-[600px] overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{output.templateName}</SheetTitle>
          <SheetDescription>
            Generated from {output.sessionFilename}
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-6">
          {/* Metadata Accordion */}
          <Accordion type="single" collapsible defaultValue="metadata">
            <AccordionItem value="metadata" className="border-border">
              <AccordionTrigger className="text-sm font-medium">
                Output Metadata
              </AccordionTrigger>
              <AccordionContent>
                <div className="space-y-3 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Template</span>
                    <span className="font-medium">{output.templateName}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Perspective</span>
                    <span className="font-medium">{participantRoleLabels[output.perspective]}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Audience</span>
                    <Badge variant={output.audience === "internal" ? "secondary" : "outline"}>
                      {audienceLabels[output.audience]}
                    </Badge>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Language</span>
                    <span className="font-medium">{output.language}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Tone</span>
                    <span className="font-medium capitalize">{output.tone}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Format</span>
                    <span className="font-mono text-xs">{output.format.toUpperCase()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Transcript Version</span>
                    <span className="font-mono text-xs">{output.transcriptVersionHash}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Timestamps Cited</span>
                    <span className="font-medium">{output.citeTimestamps ? "Yes" : "No"}</span>
                  </div>
                </div>
              </AccordionContent>
            </AccordionItem>
          </Accordion>

          {/* Content */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-medium">Content</h3>
              <div className="flex gap-1">
                <Button variant="ghost" size="sm" className="h-8">
                  <Copy className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="sm" className="h-8">
                  <Download className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <div className="p-4 rounded-lg bg-secondary/50 border border-border">
              <pre className="text-sm whitespace-pre-wrap font-sans leading-relaxed">
                {output.content}
              </pre>
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}

export default function OutputsPage() {
  const [templateFilter, setTemplateFilter] = useState<string>("all")
  const [audienceFilter, setAudienceFilter] = useState<string>("all")
  const [perspectiveFilter, setPerspectiveFilter] = useState<string>("all")
  const [roleFilter, setRoleFilter] = useState<string>("all")

  const filteredOutputs = mockOutputs.filter((output) => {
    if (templateFilter !== "all" && output.templateId !== templateFilter) return false
    if (audienceFilter !== "all" && output.audience !== audienceFilter) return false
    if (perspectiveFilter !== "all" && output.perspective !== perspectiveFilter) return false
    if (roleFilter !== "all" && output.role !== roleFilter) return false
    return true
  })

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Outputs</h1>
          <p className="text-sm text-muted-foreground mt-1">
            View and manage generated outputs across all sessions
          </p>
        </div>
      </div>

      {/* Filters */}
      <Card className="border-border">
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row sm:flex-wrap items-start sm:items-center gap-3 sm:gap-4">
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium text-foreground">Filters:</span>
            </div>
            
            <div className="flex flex-wrap gap-2 w-full sm:w-auto">
              <Select value={templateFilter} onValueChange={setTemplateFilter}>
                <SelectTrigger className="w-full sm:w-[180px] bg-secondary border-border">
                  <LayoutTemplate className="h-4 w-4 mr-2 text-muted-foreground" />
                  <SelectValue placeholder="Template" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Templates</SelectItem>
                  {mockTemplates.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={audienceFilter} onValueChange={setAudienceFilter}>
                <SelectTrigger className="w-[calc(50%-4px)] sm:w-[160px] bg-secondary border-border">
                  <Users className="h-4 w-4 mr-2 text-muted-foreground" />
                  <SelectValue placeholder="Audience" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Audiences</SelectItem>
                  <SelectItem value="internal">Internal</SelectItem>
                  <SelectItem value="external">External</SelectItem>
                </SelectContent>
              </Select>

              <Select value={perspectiveFilter} onValueChange={setPerspectiveFilter}>
                <SelectTrigger className="w-[calc(50%-4px)] sm:w-[180px] bg-secondary border-border">
                  <User className="h-4 w-4 mr-2 text-muted-foreground" />
                  <SelectValue placeholder="Perspective" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Perspectives</SelectItem>
                  {Object.entries(participantRoleLabels).map(([key, label]) => (
                    <SelectItem key={key} value={key}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Outputs List */}
      <div className="space-y-3">
        {filteredOutputs.length === 0 ? (
          <Card className="border-border">
            <CardContent className="flex flex-col items-center justify-center py-12">
              <FileText className="h-12 w-12 text-muted-foreground/50 mb-4" />
              <h3 className="font-medium text-foreground mb-1">No outputs found</h3>
              <p className="text-sm text-muted-foreground">
                {mockOutputs.length === 0
                  ? "Generate your first output from a session"
                  : "Try adjusting your filters"}
              </p>
            </CardContent>
          </Card>
        ) : (
          filteredOutputs.map((output) => (
            <Card key={output.id} className="border-border group hover:border-muted-foreground/50 transition-colors">
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-medium text-foreground truncate">
                        {output.templateName}
                      </h3>
                      <Badge
                        variant={output.audience === "internal" ? "secondary" : "outline"}
                        className="shrink-0"
                      >
                        {output.audience === "internal" ? "Internal" : "External"}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground flex items-center gap-1 mb-2">
                      <FileText className="h-3.5 w-3.5" />
                      {output.sessionFilename}
                    </p>
                    <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <User className="h-3 w-3" />
                        {participantRoleLabels[output.perspective]}
                      </span>
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {formatDate(output.createdAt)}
                      </span>
                      <span className="capitalize">{output.tone} tone</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <OutputDetailSheet output={output} />
                    <Button variant="ghost" size="sm" className="gap-1.5">
                      <ExternalLink className="h-4 w-4" />
                      <span className="hidden sm:inline">Open</span>
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  )
}
