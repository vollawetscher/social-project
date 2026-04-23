"use client"

export const dynamic = 'force-dynamic'

import React, { useState, useEffect, useCallback } from "react"
import { Link } from "@/i18n/navigation"
import { useTranslations, useLocale } from "next-intl"
import {
  FileText,
  Filter,
  Calendar,
  User,
  Users,
  LayoutTemplate,
  ExternalLink,
  Search,
  X,
  Globe,
  Trash2,
  Loader2,
  Download,
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
import { useRouter } from "@/i18n/navigation"
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { toast } from "sonner"
import type { Output } from "@/lib/types-v0"
import {
  buildOutputDownloadBasename,
  exportOutput,
  isPdfExportSupportedLanguage,
} from "@/lib/utils/output-export"

function formatDate(dateString: string, locale: string): string {
  return new Date(dateString).toLocaleDateString(locale, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

function normalizeOutputLanguageCode(raw?: string | null): string | null {
  const value = String(raw || '').trim().toLowerCase()
  if (!value) return null

  const alias: Record<string, string> = {
    auto: 'auto',
    session: 'auto',
    en: 'en',
    english: 'en',
    de: 'de',
    german: 'de',
    deutsch: 'de',
    es: 'es',
    spanish: 'es',
    espanol: 'es',
    'español': 'es',
    fr: 'fr',
    french: 'fr',
    it: 'it',
    italian: 'it',
    pt: 'pt',
    portuguese: 'pt',
    nl: 'nl',
    dutch: 'nl',
    pl: 'pl',
    polish: 'pl',
    sv: 'sv',
    swedish: 'sv',
    no: 'no',
    norwegian: 'no',
    da: 'da',
    danish: 'da',
    cs: 'cs',
    czech: 'cs',
    ru: 'ru',
    russian: 'ru',
    th: 'th',
    thai: 'th',
    ja: 'ja',
    japanese: 'ja',
    ko: 'ko',
    korean: 'ko',
    zh: 'zh',
    chinese: 'zh',
    ar: 'ar',
    arabic: 'ar',
    tr: 'tr',
    turkish: 'tr',
    vi: 'vi',
    vietnamese: 'vi',
    hi: 'hi',
    hindi: 'hi',
  }
  if (alias[value]) return alias[value]

  const localePrefix = value.split(/[-_]/)[0]
  if (alias[localePrefix]) return alias[localePrefix]
  if (/^[a-z]{2}$/.test(localePrefix)) return localePrefix
  return null
}

function getOutputLanguageBadge(language?: string | null): string {
  const code = normalizeOutputLanguageCode(language)
  if (!code || code === 'auto') return 'AUTO'
  return code.toUpperCase()
}

export default function OutputsPage() {
  const t = useTranslations('outputs')
  const tc = useTranslations('common')
  const tl = useTranslations('labels')
  const locale = useLocale()
  const router = useRouter()
  const [outputs, setOutputs] = useState<Output[]>([])
  const [loading, setLoading] = useState(true)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [savingTemplateId, setSavingTemplateId] = useState<string | null>(null)
  const [templates, setTemplates] = useState<any[]>([])
  const [templateFilter, setTemplateFilter] = useState<string>("all")
  const [audienceFilter, setAudienceFilter] = useState<string>("all")
  const [perspectiveFilter, setPerspectiveFilter] = useState<string>("all")
  const [searchQuery, setSearchQuery] = useState<string>("")

  const fetchOutputs = useCallback(async () => {
    try {
      const response = await fetch('/api/outputs', { cache: 'no-store' })
      if (!response.ok) throw new Error('Failed to fetch outputs')
      const data = await response.json()
      setOutputs(data)
    } catch (error) {
      console.error('Error fetching outputs:', error)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
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
    fetchOutputs()
    fetchTemplates()
  }, [fetchOutputs])

  useEffect(() => {
    const handleOutputsUpdated = () => {
      fetchOutputs()
    }
    window.addEventListener('notissima:outputs-updated', handleOutputsUpdated)
    return () => window.removeEventListener('notissima:outputs-updated', handleOutputsUpdated)
  }, [fetchOutputs])

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

  const handleDownload = async (
    output: Output,
    format: 'md' | 'pdf' | 'docx' | 'gdoc'
  ) => {
    if (format === 'pdf' && !isPdfExportSupportedLanguage(output.language)) {
      toast.error('PDF export is not available for this output language. Use DOCX instead.')
      return
    }
    try {
      const name = buildOutputDownloadBasename(output.templateName, output.createdAt)
      await exportOutput(output.content, name, format)
      toast.success(tc('download'))
    } catch (error) {
      console.error('Download failed:', error)
      toast.error(error instanceof Error ? error.message : 'Download failed')
    }
  }

  const handleSaveAsTemplate = async (outputId: string) => {
    setSavingTemplateId(outputId)
    try {
      const response = await fetch('/api/templates/from-output', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ outputId }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Failed to save template')
      toast.success(t('savedAsTemplate', { name: data.name }), {
        action: {
          label: t('openTemplate'),
          onClick: () => router.push(`/templates/${data.id}/edit`),
        },
      })
    } catch (error) {
      console.error('Save as template error:', error)
      toast.error(error instanceof Error ? error.message : t('saveTemplateFailed'))
    } finally {
      setSavingTemplateId(null)
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
                  {['party_a', 'party_b', 'observer'].map((key) => (
                    <SelectItem key={key} value={key}>
                      {tl('perspectives.' + key)}
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
                        <span className="hidden sm:inline">{tl('perspectives.' + output.perspective)}</span>
                        <span className="sm:hidden">{tl('perspectivesShort.' + output.perspective)}</span>
                      </span>
                      <span className="flex items-center gap-1 whitespace-nowrap">
                        <Calendar className="h-3 w-3 shrink-0" />
                        <span className="hidden sm:inline">{formatDate(output.createdAt, locale)}</span>
                        <span className="sm:hidden">{new Date(output.createdAt).toLocaleDateString(locale, { month: "short", day: "numeric" })}</span>
                      </span>
                      <span className="flex items-center gap-1 whitespace-nowrap">
                        <Globe className="h-3 w-3 shrink-0" />
                        {getOutputLanguageBadge(output.language)}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 sm:gap-2 self-end sm:self-start">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="gap-1.5"
                      onClick={() => handleSaveAsTemplate(output.id)}
                      disabled={savingTemplateId === output.id}
                      title={t('addToTemplates')}
                    >
                      {savingTemplateId === output.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <LayoutTemplate className="h-4 w-4" />
                      )}
                      <span className="hidden sm:inline">{t('addToTemplates')}</span>
                    </Button>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="gap-1.5"
                          title={tc('download')}
                        >
                          <Download className="h-4 w-4" />
                          <span className="hidden sm:inline">{tc('download')}</span>
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => handleDownload(output, 'md')}>MD</DropdownMenuItem>
                        {isPdfExportSupportedLanguage(output.language) && (
                          <DropdownMenuItem onClick={() => handleDownload(output, 'pdf')}>PDF</DropdownMenuItem>
                        )}
                        <DropdownMenuItem onClick={() => handleDownload(output, 'docx')}>DOCX</DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleDownload(output, 'gdoc')}>Google Docs</DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                    <Button variant="ghost" size="sm" className="gap-1.5" asChild title={t('open')}>
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
                          title={tc('delete')}
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
