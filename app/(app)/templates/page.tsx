"use client"

export const dynamic = 'force-dynamic'

import { useState, useEffect } from "react"
import Link from "next/link"
import { toast } from "sonner"
import {
  LayoutTemplate,
  Plus,
  FileText,
  Users,
  User,
  Tag,
  BarChart3,
  ChevronRight,
  Pencil,
  Copy,
  Trash2,
  MoreHorizontal,
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
import { participantRoleLabels } from "@/lib/mock/data"
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

const roleLabels = participantRoleLabels;

function TemplateDetailSheet({ template }: { template: Template }) {
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
              Sections
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
                        Required
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

          {/* Required Inputs */}
          <div className="space-y-3">
            <h3 className="text-sm font-medium text-foreground flex items-center gap-2">
              <Tag className="h-4 w-4 text-muted-foreground" />
              Required Inputs
            </h3>
            <div className="flex flex-wrap gap-1.5">
              {template.requiredInputs.map((input: string) => (
                <Badge key={input} variant="secondary" className="capitalize">
                  {input}
                </Badge>
              ))}
            </div>
          </div>

          {/* Style Rules */}
          <div className="space-y-3">
            <h3 className="text-sm font-medium text-foreground">Style Rules</h3>
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
            <h3 className="text-sm font-medium text-foreground">Suggestion Triggers</h3>
            <p className="text-xs text-muted-foreground mb-2">
              This template is suggested when these keywords are detected:
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
              Intended Perspectives
            </h3>
            <div className="flex flex-wrap gap-1.5">
              {template.intendedPerspectives.map((perspective: any) => (
                <Badge key={perspective} variant="secondary">
                  {participantRoleLabels[perspective]}
                </Badge>
              ))}
            </div>
          </div>

          {/* Allowed Audience */}
          <div className="space-y-3">
            <h3 className="text-sm font-medium text-foreground flex items-center gap-2">
              <Users className="h-4 w-4 text-muted-foreground" />
              Allowed Audience
            </h3>
            <div className="flex flex-wrap gap-1.5">
              {template.allowedAudience.map((audience) => (
                <Badge key={audience} variant="outline" className="capitalize">
                  {audience}
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
  const [templates, setTemplates] = useState<Template[]>([])
  const [loading, setLoading] = useState(true)

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
    if (!confirm(`Are you sure you want to delete "${templateName}"? This cannot be undone.`)) {
      return
    }

    try {
      const response = await fetch(`/api/templates/${templateId}`, {
        method: 'DELETE',
      })
      
      if (!response.ok) throw new Error('Failed to delete template')
      
      // Refresh templates list
      await fetchTemplates()
      toast.success(`Template "${templateName}" deleted`)
    } catch (error) {
      console.error('Error deleting template:', error)
      toast.error('Failed to delete template')
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
      toast.success(`Created "${data.name}"`)
    } catch (error) {
      console.error('Error duplicating template:', error)
      toast.error('Failed to duplicate template')
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-current border-r-transparent"></div>
          <p className="mt-2 text-sm text-muted-foreground">Loading templates...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Templates</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage generation recipes for your outputs
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" asChild className="flex-1 sm:flex-initial bg-transparent">
            <Link href="/templates/new/from-samples">
              <FileText className="h-4 w-4 mr-2" />
              <span className="hidden xs:inline">Create from</span> Samples
            </Link>
          </Button>
          <Button className="flex-1 sm:flex-initial">
            <Plus className="h-4 w-4 mr-2" />
            <span className="hidden xs:inline">Create from</span> Output
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
                        {domain}
                      </Badge>
                    ))}
                  </div>
                  <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <User className="h-3 w-3" />
                      {template.intendedPerspectives.length} perspectives
                    </span>
                    <span className="flex items-center gap-1">
                      <BarChart3 className="h-3 w-3" />
                      {template.usedCount} uses
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <TemplateDetailSheet template={template} />
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                        <MoreHorizontal className="h-4 w-4" />
                        <span className="sr-only">Open menu</span>
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem asChild>
                        <Link href={`/templates/${template.id}/edit`} className="cursor-pointer">
                          <Pencil className="mr-2 h-4 w-4" />
                          Edit
                        </Link>
                      </DropdownMenuItem>
                      <DropdownMenuItem 
                        onClick={() => handleDuplicate(template.id, template.name)}
                        className="cursor-pointer"
                      >
                        <Copy className="mr-2 h-4 w-4" />
                        Duplicate
                      </DropdownMenuItem>
                      <DropdownMenuItem 
                        className="text-destructive cursor-pointer"
                        onClick={() => handleDelete(template.id, template.name)}
                      >
                        <Trash2 className="mr-2 h-4 w-4" />
                        Delete
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
              <TableHead className="text-muted-foreground">Name</TableHead>
              <TableHead className="text-muted-foreground">Perspectives</TableHead>
              <TableHead className="text-muted-foreground">Audience</TableHead>
              <TableHead className="text-muted-foreground">Domains</TableHead>
              <TableHead className="text-muted-foreground text-center">Used</TableHead>
              <TableHead className="text-muted-foreground text-right">Actions</TableHead>
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
                        {participantRoleLabels[perspective].split(" ")[0]}
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
                        {audience}
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
                        {domain}
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
                          <span className="sr-only">Open menu</span>
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem asChild>
                          <Link href={`/templates/${template.id}/edit`} className="cursor-pointer">
                            <Pencil className="mr-2 h-4 w-4" />
                            Edit
                          </Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem 
                          onClick={() => handleDuplicate(template.id, template.name)}
                          className="cursor-pointer"
                        >
                          <Copy className="mr-2 h-4 w-4" />
                          Duplicate
                        </DropdownMenuItem>
                        <DropdownMenuItem 
                          className="text-destructive cursor-pointer"
                          onClick={() => handleDelete(template.id, template.name)}
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          Delete
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
  )
}
