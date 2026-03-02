"use client"

export const dynamic = 'force-dynamic'

import React, { useState, useEffect } from "react"
import { Link } from "@/i18n/navigation"
import { useTranslations, useLocale } from "next-intl"
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
  Search,
  X,
  Globe,
  Trash2,
  Loader2,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { cn } from "@/lib/utils"
import { participantRoleLabels, participantRoleLabelsShort, audienceLabels } from "@/lib/mock/data"
import { toast } from "sonner"
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
  const t = useTranslations('outputs')
  const td = useTranslations('outputDetail')
  const tc = useTranslations('common')
  const [copySuccess, setCopySuccess] = React.useState(false)

  const handleCopy = async (content: string) => {
    try {
      await navigator.clipboard.writeText(content)
      setCopySuccess(true)
      setTimeout(() => setCopySuccess(false), 2000)
    } catch (error) {
      console.error('Failed to copy:', error)
      alert(t('copyFailed'))
    }
  }

  const handleDownload = (output: Output) => {
    const blob = new Blob([output.content], { type: 'text/plain' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${output.templateName}-${output.perspective}-${output.audience}.txt`
    document.body.appendChild(a)
    a.click()
    window.URL.revokeObjectURL(url)
    document.body.removeChild(a)
  }

  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="ghost" size="sm" className="gap-1.5">
          <Eye className="h-4 w-4" />
          <span className="hidden sm:inline">{t('view')}</span>
        </Button>
      </SheetTrigger>
      <SheetContent className="w-full sm:w-[600px] overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{output.templateName}</SheetTitle>
          <SheetDescription>
            {t('generatedFrom', { session: output.sessionFilename })}
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-6">
          {/* Metadata Accordion */}
          <Accordion type="single" collapsible defaultValue="">
            <AccordionItem value="metadata" className="border-border">
              <AccordionTrigger className="text-sm font-medium">
                {t('outputMetadata')}
              </AccordionTrigger>
              <AccordionContent>
                <div className="space-y-3 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">{t('templateFilter')}</span>
                    <span className="font-medium">{output.templateName}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">{td('perspective')}</span>
                    <span className="font-medium">{participantRoleLabels[output.perspective]}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">{td('audience')}</span>
                    <Badge variant={output.audience === "internal" ? "secondary" : "outline"}>
                      {audienceLabels[output.audience]}
                    </Badge>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">{t('language')}</span>
                    <span className="font-medium">{output.language}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">{t('tone')}</span>
                    <span className="font-medium capitalize">{output.tone}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">{t('format')}</span>
                    <span className="font-mono text-xs">{output.format.toUpperCase()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">{t('transcriptVersion')}</span>
                    <span className="font-mono text-xs">{output.transcriptVersionHash}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">{td('timestamps')}</span>
                    <span className="font-medium">{output.citeTimestamps ? tc('yes') : tc('no')}</span>
                  </div>
                </div>
              </AccordionContent>
            </AccordionItem>
          </Accordion>

          {/* Content */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-medium">{t('content')}</h3>
              <div className="flex gap-1">
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="h-8" 
                  onClick={() => handleCopy(output.content)}
                  title={copySuccess ? tc('copied') : tc('copy')}
                >
                  <Copy className="h-4 w-4" />
                </Button>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="h-8"
                  onClick={() => handleDownload(output)}
                  title={tc('download')}
                >
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
  const t = useTranslations('outputs')
  const tc = useTranslations('common')
  const [outputs, setOutputs] = useState<Output[]>([])
  const [loading, setLoading] = useState(true)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [templates, setTemplates] = useState<any[]>([])
  const [templateFilter, setTemplateFilter] = useState<string>("all")
  const [audienceFilter, setAudienceFilter] = useState<string>("all")
  const [perspectiveFilter, setPerspectiveFilter] = useState<string>("all")
  const [searchQuery, setSearchQuery] = useState<string>("")

  useEffect(() => {
    async function fetchOutputs() {

    async function fetchTemplates() {
      try {
        const response = await fetch("/api/templates")
        if (response.ok) {
          const data = await response.json()
          setTemplates(data)
        }
      } catch (error) {
        console.error("Error fetching templates:", error)
      }
    }
    fetchTemplates()
      try {
        const response = await fetch('/api/outputs')
        if (!response.ok) throw new Error('Failed to fetch outputs')
        const data = await response.json()
        setOutputs(data)
      } catch (error) {
        console.error('Error fetching outputs:', error)
      } finally {
        setLoading(false)
      }
    }
    fetchOutputs()

    async function fetchTemplates() {
      try {
        const response = await fetch("/api/templates")
        if (response.ok) {
          const data = await response.json()
          setTemplates(data)
        }
      } catch (error) {
        console.error("Error fetching templates:", error)
      }
    }
    fetchTemplates()
  }, [])

  const filteredOutputs = outputs.filter((output: Output) => {
    // Template filter
    if (templateFilter !== "all" && output.templateId !== templateFilter) return false
    
    // Audience filter
    if (audienceFilter !== "all" && output.audience !== audienceFilter) return false
    
    // Perspective filter
    if (perspectiveFilter !== "all" && output.perspective !== perspectiveFilter) return false
    
    // Search filter (search in content, template name, and session filename)
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase()
      const matchesContent = output.content.toLowerCase().includes(query)
      const matchesTemplate = output.templateName.toLowerCase().includes(query)
      const matchesSession = output.sessionFilename.toLowerCase().includes(query)
      
      if (!matchesContent && !matchesTemplate && !matchesSession) return false
    }
    
    return true
  })

  const handleClearFilters = () => {
    setTemplateFilter("all")
    setAudienceFilter("all")
    setPerspectiveFilter("all")
    setSearchQuery("")
  }

  const hasActiveFilters = 
    templateFilter !== "all" || 
    audienceFilter !== "all" || 
    perspectiveFilter !== "all" || 
    searchQuery.trim() !== ""

  const handleDelete = async (outputId: string) => {
    setDeletingId(outputId)
    try {
      const response = await fetch(`/api/outputs/${outputId}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to delete output')
      }

      // Remove from local state
      setOutputs(prev => prev.filter(o => o.id !== outputId))
      toast.success(t('deleteSuccess'))
    } catch (error) {
      console.error('Error deleting output:', error)
      toast.error(error instanceof Error ? error.message : t('deleteFailed'))
    } finally {
      setDeletingId(null)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-current border-r-transparent"></div>
          <p className="mt-2 text-sm text-muted-foreground">{t('loadingOutputs')}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1 min-h-0 overflow-y-auto pb-[max(1rem,env(safe-area-inset-bottom))]">
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">{t('title')}</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {t('subtitle')}
          </p>
        </div>
      </div>

      {/* Filters */}
      <Card className="border-border">
        <CardContent className="p-4">
          <div className="flex flex-col gap-4">
            {/* Search Bar */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder={t('searchPlaceholder')}
                value={searchQuery}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchQuery(e.target.value)}
                className="pl-9 bg-secondary border-border"
              />
            </div>

            {/* Filter Dropdowns */}
            <div className="flex flex-col sm:flex-row sm:flex-wrap items-start sm:items-center gap-3 sm:gap-4">
              <div className="flex items-center gap-2">
                <Filter className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium text-foreground">{t('filtersLabel')}</span>
              </div>
              
                <div className="flex flex-wrap gap-2 w-full sm:w-auto">
                  <Select value={templateFilter} onValueChange={setTemplateFilter}>
                <SelectTrigger className="w-full sm:w-[180px] bg-secondary border-border">
                  <LayoutTemplate className="h-4 w-4 mr-2 text-muted-foreground" />
                  <SelectValue placeholder={t('templateFilter')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t('allTemplates')}</SelectItem>
                  {templates.map((t: any) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={audienceFilter} onValueChange={setAudienceFilter}>
                <SelectTrigger className="w-[calc(50%-4px)] sm:w-[160px] bg-secondary border-border">
                  <Users className="h-4 w-4 mr-2 text-muted-foreground" />
                  <SelectValue placeholder={t('audienceFilter')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t('allAudiences')}</SelectItem>
                  <SelectItem value="internal">{tc('internal')}</SelectItem>
                  <SelectItem value="external">{tc('external')}</SelectItem>
                </SelectContent>
              </Select>

              <Select value={perspectiveFilter} onValueChange={setPerspectiveFilter}>
                <SelectTrigger className="w-[calc(50%-4px)] sm:w-[180px] bg-secondary border-border">
                  <User className="h-4 w-4 mr-2 text-muted-foreground" />
                  <SelectValue placeholder={t('perspectiveFilter')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t('allPerspectives')}</SelectItem>
                  {Object.entries(participantRoleLabels).map(([key, label]) => (
                    <SelectItem key={key} value={key}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Clear Filters Button */}
              {hasActiveFilters && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleClearFilters}
                  className="self-start text-muted-foreground hover:text-foreground"
                >
                  <X className="h-4 w-4 mr-2" />
                  {t('clearFilters')}
                </Button>
              )}
            </div>
        </CardContent>
      </Card>

      {/* Outputs List */}
      <div className="space-y-3">
        {filteredOutputs.length === 0 ? (
          <Card className="border-border">
            <CardContent className="flex flex-col items-center justify-center py-12">
              <FileText className="h-12 w-12 text-muted-foreground/50 mb-4" />
              <h3 className="font-medium text-foreground mb-1">{t('noOutputsFound')}</h3>
              <p className="text-sm text-muted-foreground">
                {outputs.length === 0
                  ? t('noOutputsHint')
                  : t('noMatchingHint')}
              </p>
            </CardContent>
          </Card>
        ) : (
          filteredOutputs.map((output: Output) => (
            <Card key={output.id} className="border-border group hover:border-muted-foreground/50 transition-colors">
              <CardContent className="p-3 sm:p-4">
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 sm:gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start gap-2 mb-1.5">
                      <h3 className="font-medium text-foreground text-sm sm:text-base break-words line-clamp-2">
                        {output.templateName}
                      </h3>
                      <Badge
                        variant={output.audience === "internal" ? "secondary" : "outline"}
                        className="shrink-0 text-xs mt-0.5"
                      >
                        {output.audience === "internal" ? tc('internal') : tc('external')}
                      </Badge>
                    </div>
                    <p className="text-xs sm:text-sm text-foreground/80 flex items-center gap-1 mb-2">
                      <FileText className="h-3 w-3 sm:h-3.5 sm:w-3.5 shrink-0" />
                      <span className="truncate">{output.sessionFilename}</span>
                    </p>
                    <div className="flex flex-wrap items-center gap-2 sm:gap-3 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1 whitespace-nowrap">
                        <User className="h-3 w-3 shrink-0" />
                        <span className="hidden sm:inline">{participantRoleLabels[output.perspective]}</span>
                        <span className="sm:hidden">{participantRoleLabelsShort[output.perspective] || participantRoleLabels[output.perspective]}</span>
                      </span>
                      <span className="flex items-center gap-1 whitespace-nowrap">
                        <Calendar className="h-3 w-3 shrink-0" />
                        <span className="hidden sm:inline">{formatDate(output.createdAt)}</span>
                        <span className="sm:hidden">{new Date(output.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</span>
                      </span>
                      <span className="flex items-center gap-1 whitespace-nowrap">
                        <Globe className="h-3 w-3 shrink-0" />
                        {output.language === 'en' ? 'EN' : output.language === 'de' ? 'DE' : output.language.toUpperCase()}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 sm:gap-2 self-end sm:self-start">
                    <OutputDetailSheet output={output} />
                    <Button variant="ghost" size="sm" className="gap-1.5" asChild>
                      <Link href={`/outputs/${output.id}`}>
                        <ExternalLink className="h-4 w-4" />
                        <span className="hidden sm:inline">{t('open')}</span>
                      </Link>
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="gap-1.5 text-destructive hover:text-destructive hover:bg-destructive/10"
                          disabled={deletingId === output.id}
                        >
                          {deletingId === output.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Trash2 className="h-4 w-4" />
                          )}
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>{t('deleteDialog.title')}</AlertDialogTitle>
                          <AlertDialogDescription>
                            {t('deleteDialog.description', { name: output.templateName })}
                            {output.isPublic && (
                              <span className="block mt-2 text-destructive font-medium">
                                {t('deleteDialog.sharedWarning')}
                              </span>
                            )}
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>{tc('cancel')}</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => handleDelete(output.id)}
                            className="bg-destructive hover:bg-destructive/90"
                          >
                            {tc('delete')}
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
    </div>
  )
}
