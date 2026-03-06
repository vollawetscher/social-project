"use client"

export const dynamic = 'force-dynamic'

import { useState, useEffect } from "react"
import { Link } from "@/i18n/navigation"
import { toast } from "sonner"
import { useTranslations } from "next-intl"
import {
  LayoutTemplate,
  Plus,
  FileText,
  Users,
  User,
  BarChart3,
  ChevronRight,
  Pencil,
  Copy,
  Trash2,
  MoreHorizontal,
  FileOutput,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import type { Template } from "@/lib/types-v0"

const domainColors: Record<string, string> = {
  legal: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  sales: "bg-green-500/20 text-green-400 border-green-500/30",
  hr: "bg-purple-500/20 text-purple-400 border-purple-500/30",
  medical: "bg-red-500/20 text-red-400 border-red-500/30",
  education: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
  consulting: "bg-orange-500/20 text-orange-400 border-orange-500/30",
  general: "bg-gray-500/20 text-gray-400 border-gray-500/30",
}

// Generate sample content for template preview
function getTemplateSample(template: Template): string {
  if (template.sampleContent && template.sampleContent.trim()) {
    return template.sampleContent
  }
  const sections = template.sections?.length
    ? template.sections
    : [
        { name: "Overview", description: "Summary" },
        { name: "Key Points", description: "Main findings" },
        { name: "Action Items", description: "Next steps" },
      ]
  const now = new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })
  let md = `# ${template.name}\n\n`
  md += `*Sample output · ${now} · Generated from template structure*\n\n---\n\n`
  sections.forEach((s: any) => {
    md += `## ${s.name}\n\n`
    md += `*${typeof s.description === "string" ? s.description : "Content section"}*\n\n`
    if (s.name.toLowerCase().includes("action") || s.name.toLowerCase().includes("next")) {
      md += `- [ ] Task 1 — Owner: TBD\n`
      md += `- [ ] Task 2 — Owner: TBD\n`
      md += `- [ ] Task 3 — Owner: TBD\n\n`
    } else if (s.name.toLowerCase().includes("overview") || s.name.toLowerCase().includes("summary")) {
      md += `This section would contain a brief overview of the conversation or meeting outcomes.\n\n`
    } else {
      md += `Lorem ipsum placeholder for ${s.name}. In a real output, this would be filled with AI-generated content based on the transcript.\n\n`
    }
  })
  return md
}

function TemplateSampleSheet({ template, open, onOpenChange }: { template: Template; open: boolean; onOpenChange: (open: boolean) => void }) {
  const t = useTranslations('templates')
  const sample = getTemplateSample(template)
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <FileOutput className="h-5 w-5" />
            {t('viewSample')}: {template.name}
          </SheetTitle>
          <SheetDescription>
            {template.sampleContent
              ? t('samplePreview')
              : t('mockPreview')}
          </SheetDescription>
        </SheetHeader>
        <div className="mt-6 prose prose-sm max-w-none dark:prose-invert prose-headings:text-foreground prose-p:text-foreground prose-li:text-foreground">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{sample}</ReactMarkdown>
        </div>
      </SheetContent>
    </Sheet>
  )
}

function TemplateDetailSheet({ template }: { template: Template }) {
  const t = useTranslations('templates')
  const tc = useTranslations('common')
  const tl = useTranslations('labels')
  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="ghost" size="sm">
          <ChevronRight className="h-4 w-4" />
        </Button>
      </SheetTrigger>
      <SheetContent className="w-[400px] sm:w-[500px] overflow-y-auto border-l-4 border-l-primary/20 p-6">
        <SheetHeader>
          <SheetTitle>{template.name}</SheetTitle>
          <SheetDescription>{template.description}</SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-6">
          {/* Sections */}
          <div className="space-y-3">
            <h3 className="text-sm font-medium text-foreground flex items-center gap-2">
              <FileText className="h-4 w-4 text-muted-foreground" />
              {t('sections')}
            </h3>
            <div className="space-y-2">
              {template.sections.map((section: any) => (
                <div
                  key={section.id}
                  className="p-3 rounded-lg border border-border bg-secondary/30"
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium text-foreground">
                      {section.name}
                    </span>
                    {section.isRequired && (
                      <Badge variant="outline" className="text-[10px]">
                        {tc('required')}
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {section.description}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* Style Rules */}
          <div className="space-y-3">
            <h3 className="text-sm font-medium text-foreground">{t('styleRules')}</h3>
            <ul className="space-y-1">
              {template.styleRules.map((rule: string, i: number) => (
                <li key={i} className="text-sm text-muted-foreground flex items-start gap-2">
                  <span className="text-foreground">•</span>
                  {rule}
                </li>
              ))}
            </ul>
          </div>

          {/* Suggestion Triggers */}
          <div className="space-y-3">
            <h3 className="text-sm font-medium text-foreground">{t('suggestionTriggers')}</h3>
            <p className="text-xs text-muted-foreground mb-2">
              {t('suggestionTriggersHint')}
            </p>
            <div className="flex flex-wrap gap-1.5">
              {template.suggestionTriggers.map((trigger: string) => (
                <Badge key={trigger} variant="outline" className="text-xs">
                  {trigger}
                </Badge>
              ))}
            </div>
          </div>

          {/* Intended Perspectives */}
          <div className="space-y-3">
            <h3 className="text-sm font-medium text-foreground flex items-center gap-2">
              <User className="h-4 w-4 text-muted-foreground" />
              {t('perspectives')}
            </h3>
            <div className="flex flex-wrap gap-1.5">
              {template.intendedPerspectives.map((perspective: any) => (
                <Badge key={perspective} variant="secondary">
                  {tl('perspectives.' + perspective)}
                </Badge>
              ))}
            </div>
          </div>

          {/* Allowed Audience */}
          <div className="space-y-3">
            <h3 className="text-sm font-medium text-foreground flex items-center gap-2">
              <Users className="h-4 w-4 text-muted-foreground" />
              {t('audience')}
            </h3>
            <div className="flex flex-wrap gap-1.5">
              {template.allowedAudience.map((audience) => (
                <Badge key={audience} variant="outline" className="capitalize">
                  {tl('audiences.' + audience)}
                </Badge>
              ))}
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}

export default function TemplatesPage() {
  const t = useTranslations('templates')
  const tc = useTranslations('common')
  const tl = useTranslations('labels')
  const [templates, setTemplates] = useState<Template[]>([])
  const [loading, setLoading] = useState(true)
  const [sampleTemplate, setSampleTemplate] = useState<Template | null>(null)

  useEffect(() => {
    fetchTemplates()
  }, [])

  async function fetchTemplates() {
    try {
      const response = await fetch('/api/templates')
      if (!response.ok) throw new Error('Failed to fetch templates')
      const data = await response.json()
      setTemplates(data)
    } catch (error) {
      console.error('Error fetching templates:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (templateId: string, templateName: string) => {
    if (!confirm(t('deleteConfirm', { name: templateName }))) {
      return
    }

    try {
      const response = await fetch(`/api/templates/${templateId}`, {
        method: 'DELETE',
      })
      
      if (!response.ok) throw new Error('Failed to delete template')
      
      // Refresh templates list
      await fetchTemplates()
      toast.success(t('deleteSuccess', { name: templateName }))
    } catch (error) {
      console.error('Error deleting template:', error)
      toast.error(t('deleteFailed'))
    }
  }

  const handleDuplicate = async (templateId: string, templateName: string) => {
    try {
      const response = await fetch(`/api/templates/${templateId}/duplicate`, {
        method: 'POST',
      })
      
      if (!response.ok) throw new Error('Failed to duplicate template')
      
      const data = await response.json()
      
      // Refresh templates list
      await fetchTemplates()
      
      // Show success message
      toast.success(t('duplicateSuccess', { name: data.name }))
    } catch (error) {
      console.error('Error duplicating template:', error)
      toast.error(t('duplicateFailed'))
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-current border-r-transparent"></div>
          <p className="mt-2 text-sm text-muted-foreground">{t('loadingTemplates')}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1 min-h-0 overflow-y-auto pb-[max(1rem,env(safe-area-inset-bottom))]">
    <div className="space-y-6">
      {sampleTemplate && (
        <TemplateSampleSheet
          template={sampleTemplate}
          open={!!sampleTemplate}
          onOpenChange={(open) => !open && setSampleTemplate(null)}
        />
      )}
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">{t('title')}</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {t('subtitle')}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" asChild className="flex-1 sm:flex-initial bg-transparent">
            <Link href="/templates/new/from-samples">
              <FileText className="h-4 w-4 mr-2" />
              <span className="hidden xs:inline">{t('createFrom')}</span> {t('fromSamples')}
            </Link>
          </Button>
          <Button asChild className="flex-1 sm:flex-initial">
            <Link href="/templates/new/scratch">
              <Plus className="h-4 w-4 mr-2" />
              <span className="hidden xs:inline">{t('createFrom')}</span> {t('newTemplate')}
            </Link>
          </Button>
        </div>
      </div>

      {/* Mobile: Template Cards */}
      <div className="md:hidden space-y-3">
        {templates.map((template) => (
          <Card key={template.id} className="border-border">
            <CardContent className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <h3 className="font-medium text-foreground">
                    {template.name}
                  </h3>
                  <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                    {template.description}
                  </p>
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {template.domainTags.map((domain: string) => (
                      <Badge
                        key={domain}
                        variant="outline"
                        className={`text-[10px] capitalize ${domainColors[domain as keyof typeof domainColors] || ""}`}
                      >
                        {domain in domainColors ? tl('domains.' + domain) : domain}
                      </Badge>
                    ))}
                  </div>
                  <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <User className="h-3 w-3" />
                      {t('perspectiveCount', { count: template.intendedPerspectives.length })}
                    </span>
                    <span className="flex items-center gap-1">
                      <BarChart3 className="h-3 w-3" />
                      {t('usedCount', { count: template.usedCount })}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <TemplateDetailSheet template={template} />
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                        <MoreHorizontal className="h-4 w-4" />
                        <span className="sr-only">{t('openMenu')}</span>
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem
                        onClick={() => setSampleTemplate(template)}
                        className="cursor-pointer"
                      >
                        <FileOutput className="mr-2 h-4 w-4" />
                        {t('viewSample')}
                      </DropdownMenuItem>
                      <DropdownMenuItem asChild>
                        <Link href={`/templates/${template.id}/edit`} className="cursor-pointer">
                          <Pencil className="mr-2 h-4 w-4" />
                          {tc('edit')}
                        </Link>
                      </DropdownMenuItem>
                      <DropdownMenuItem 
                        onClick={() => handleDuplicate(template.id, template.name)}
                        className="cursor-pointer"
                      >
                        <Copy className="mr-2 h-4 w-4" />
                        {tc('duplicate')}
                      </DropdownMenuItem>
                      <DropdownMenuItem 
                        className="text-destructive cursor-pointer"
                        onClick={() => handleDelete(template.id, template.name)}
                      >
                        <Trash2 className="mr-2 h-4 w-4" />
                        {tc('delete')}
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Desktop: Templates Table */}
      <Card className="border-border hidden md:block">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="text-muted-foreground">{t('tableName')}</TableHead>
              <TableHead className="text-muted-foreground">{t('perspectives')}</TableHead>
              <TableHead className="text-muted-foreground">{t('audience')}</TableHead>
              <TableHead className="text-muted-foreground">{t('domains')}</TableHead>
              <TableHead className="text-muted-foreground text-center">{t('used')}</TableHead>
              <TableHead className="text-muted-foreground text-right">{t('actions')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {templates.map((template) => (
              <TableRow key={template.id} className="group">
                <TableCell>
                  <div>
                    <span className="font-medium text-foreground">
                      {template.name}
                    </span>
                    <p className="text-xs text-muted-foreground mt-0.5 max-w-[250px] truncate">
                      {template.description}
                    </p>
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex flex-wrap gap-1 max-w-[150px]">
                    {template.intendedPerspectives.slice(0, 2).map((perspective: any) => (
                      <Badge key={perspective} variant="secondary" className="text-[10px]">
                        {tl('perspectivesShort.' + perspective)}
                      </Badge>
                    ))}
                    {template.intendedPerspectives.length > 2 && (
                      <Badge variant="secondary" className="text-[10px]">
                        +{template.intendedPerspectives.length - 2}
                      </Badge>
                    )}
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    {template.allowedAudience.map((audience: string) => (
                      <Badge key={audience} variant="outline" className="text-[10px] capitalize">
                        {tl('audiences.' + audience)}
                      </Badge>
                    ))}
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex flex-wrap gap-1">
                    {template.domainTags.map((domain: string) => (
                      <Badge
                        key={domain}
                        variant="outline"
                        className={`text-[10px] capitalize ${domainColors[domain as keyof typeof domainColors] || ""}`}
                      >
                        {domain in domainColors ? tl('domains.' + domain) : domain}
                      </Badge>
                    ))}
                  </div>
                </TableCell>
                <TableCell className="text-center">
                  <div className="flex items-center justify-center gap-1 text-muted-foreground">
                    <BarChart3 className="h-3.5 w-3.5" />
                    <span className="text-sm">{template.usedCount}</span>
                  </div>
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-1">
                    <TemplateDetailSheet template={template} />
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <MoreHorizontal className="h-4 w-4" />
                          <span className="sr-only">{t('openMenu')}</span>
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          onClick={() => setSampleTemplate(template)}
                          className="cursor-pointer"
                        >
                          <FileOutput className="mr-2 h-4 w-4" />
                          {t('viewSample')}
                        </DropdownMenuItem>
                        <DropdownMenuItem asChild>
                          <Link href={`/templates/${template.id}/edit`} className="cursor-pointer">
                            <Pencil className="mr-2 h-4 w-4" />
                            {tc('edit')}
                          </Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem 
                          onClick={() => handleDuplicate(template.id, template.name)}
                          className="cursor-pointer"
                        >
                          <Copy className="mr-2 h-4 w-4" />
                          {tc('duplicate')}
                        </DropdownMenuItem>
                        <DropdownMenuItem 
                          className="text-destructive cursor-pointer"
                          onClick={() => handleDelete(template.id, template.name)}
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          {tc('delete')}
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
    </div>
  )
}
