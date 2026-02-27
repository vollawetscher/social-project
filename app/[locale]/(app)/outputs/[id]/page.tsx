"use client"

export const dynamic = 'force-dynamic'

import React, { useState, useEffect } from "react"
import { useTranslations } from "next-intl"
import { useParams } from "next/navigation"
import { Link, useRouter } from "@/i18n/navigation"
import { toast } from "sonner"
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import {
  ArrowLeft,
  Copy,
  Check,
  Download,
  ExternalLink,
  FileText,
  Calendar,
  User,
  Users,
  MessageSquare,
  Sparkles,
  Share2,
  Link as LinkIcon,
  Eye,
  EyeOff,
  Trash2,
  Loader2,
  Globe,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
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
import { cn } from "@/lib/utils"
import { exportOutput } from "@/lib/utils/output-export"
import type { Output } from "@/lib/types-v0"
import { participantRoleLabels, audienceLabels } from "@/lib/mock/data"

function extractOutputHeadline(content: string): string | undefined {
  if (!content?.trim()) return undefined
  const match = content.match(/^#+\s+(.+)$/m)
  return match ? match[1].trim() : undefined
}

function formatShareLinkForCopy(url: string, headline?: string, createdAt?: string): string {
  const title = headline || 'Shared output'
  const dateStr = createdAt
    ? new Date(createdAt).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' })
    : ''
  const prefix = dateStr ? `${title} ${dateStr}.` : title
  return `${prefix} ${url}`
}

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

interface CopyableSection {
  id: string
  content: string
  copied: boolean
}

const TRANSLATE_LANGUAGES: { code: string; label: string }[] = [
  { code: 'en', label: 'English' },
  { code: 'de', label: 'German' },
  { code: 'fr', label: 'French' },
  { code: 'es', label: 'Spanish' },
  { code: 'it', label: 'Italian' },
  { code: 'pt', label: 'Portuguese' },
  { code: 'nl', label: 'Dutch' },
  { code: 'pl', label: 'Polish' },
  { code: 'th', label: 'Thai' },
]

export default function OutputDetailPage() {
  const params = useParams()
  const router = useRouter()
  const outputId = params.id as string
  const t = useTranslations('outputDetail')
  const tc = useTranslations('common')

  const [output, setOutput] = useState<Output | null>(null)
  const [loading, setLoading] = useState(true)
  const [deleting, setDeleting] = useState(false)
  const [translating, setTranslating] = useState(false)
  const [sections, setSections] = useState<CopyableSection[]>([])
  const [copiedAll, setCopiedAll] = useState(false)
  const [isSharing, setIsSharing] = useState(false)
  const [shareUrl, setShareUrl] = useState<string | null>(null)
  const [isPublic, setIsPublic] = useState(false)
  const [copiedShareLink, setCopiedShareLink] = useState(false)

  useEffect(() => {
    fetchOutput()
  }, [outputId])

  useEffect(() => {
    if (output) {
      parseContentIntoSections(output.content)
    }
  }, [output])

  async function fetchOutput() {
    try {
      const response = await fetch(`/api/outputs/${outputId}`)
      if (!response.ok) throw new Error('Failed to fetch output')
      const data = await response.json()
      setOutput(data)
      
      // Check if already shared
      if (data.isPublic && data.shareToken) {
        setIsPublic(true)
        setShareUrl(`${window.location.origin}/share/${data.shareToken}`)
      }
    } catch (error) {
      console.error('Error fetching output:', error)
      toast.error(t('loadFailed'))
      router.push('/outputs')
    } finally {
      setLoading(false)
    }
  }

  function markCopied() {
    setCopiedShareLink(true)
    setTimeout(() => setCopiedShareLink(false), 2000)
    toast.success(t('shareLinkCopied'))
  }

  function buildShareText(url: string) {
    const headline = extractOutputHeadline(output!.content) || output!.templateName
    return formatShareLinkForCopy(url, headline, output!.createdAt)
  }

  // Fallback for when Clipboard API loses user activation after async work
  function execCopyFallback(text: string): boolean {
    const ta = document.createElement('textarea')
    ta.value = text
    ta.setAttribute('readonly', '')
    ta.style.cssText = 'position:absolute;left:-9999px'
    document.body.appendChild(ta)
    ta.select()
    let ok = false
    try { ok = document.execCommand('copy') } catch {}
    document.body.removeChild(ta)
    return ok
  }

  async function handleShare() {
    if (!output) return
    setIsSharing(true)

    const headline = extractOutputHeadline(output.content) || output.templateName

    // Try ClipboardItem with Promise: initiates clipboard write synchronously
    // (preserving user activation) while resolving content after the fetch.
    if (typeof ClipboardItem !== 'undefined') {
      try {
        const blobPromise = fetch(`/api/outputs/${outputId}/share`, { method: 'POST' })
          .then(res => { if (!res.ok) throw new Error(); return res.json() })
          .then(data => {
            setShareUrl(data.shareUrl)
            setIsPublic(true)
            return new Blob(
              [formatShareLinkForCopy(data.shareUrl, headline, output.createdAt)],
              { type: 'text/plain' }
            )
          })

        await navigator.clipboard.write([
          new ClipboardItem({ 'text/plain': blobPromise })
        ])
        markCopied()
        setIsSharing(false)
        return
      } catch {
        // ClipboardItem with Promise not supported — fall through
      }
    }

    // Fallback: fetch first, then copy via Clipboard API or execCommand
    try {
      const response = await fetch(`/api/outputs/${outputId}/share`, { method: 'POST' })
      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || t('shareFailed'))
      }
      const data = await response.json()
      setShareUrl(data.shareUrl)
      setIsPublic(true)

      const shareText = formatShareLinkForCopy(data.shareUrl, headline, output.createdAt)
      let copied = false
      try {
        await navigator.clipboard.writeText(shareText)
        copied = true
      } catch {
        copied = execCopyFallback(shareText)
      }

      if (copied) {
        markCopied()
      } else {
        toast.success(t('shareLinkCreated'))
      }
    } catch (error) {
      toast.error(`${t('shareFailed')}: ${error instanceof Error ? error.message : tc('unknown')}`)
    } finally {
      setIsSharing(false)
    }
  }

  async function handleCopyShareLink() {
    if (!output) return
    const urlToCopy = shareUrl || (output.shareToken ? `${window.location.origin}/share/${output.shareToken}` : null)
    if (!urlToCopy) return

    const shareText = buildShareText(urlToCopy)
    try {
      await navigator.clipboard.writeText(shareText)
      markCopied()
    } catch {
      if (execCopyFallback(shareText)) markCopied()
      else toast.error(t('copyLinkFailed'))
    }

    fetch(`/api/outputs/${outputId}/share`, { method: 'POST' }).then(res => {
      if (res.ok) res.json().then(data => {
        if (data.shareUrl) { setShareUrl(data.shareUrl); setIsPublic(true) }
      })
    }).catch(() => {})
  }

  async function handleDisableSharing() {
    if (!output) return
    
    try {
      const response = await fetch(`/api/outputs/${outputId}/share`, {
        method: 'DELETE',
      })
      
      if (!response.ok) throw new Error(t('shareFailed'))
      
      setIsPublic(false)
      toast.success(t('stoppedSharing'))
    } catch (error) {
      console.error('Error disabling sharing:', error)
      toast.error(t('shareFailed'))
    }
  }

  function parseContentIntoSections(content: string) {
    // Split content by double newlines or major headings
    const parts = content.split(/\n(?=#{1,2}\s)/g)
    
    const parsedSections: CopyableSection[] = parts
      .filter(part => part.trim().length > 0)
      .map((part, index) => ({
        id: `section-${index}`,
        content: part.trim(),
        copied: false,
      }))

    setSections(parsedSections)
  }

  async function handleCopySection(sectionId: string) {
    const section = sections.find(s => s.id === sectionId)
    if (!section) return

    try {
      await navigator.clipboard.writeText(section.content)
      setSections(prev => 
        prev.map(s => 
          s.id === sectionId ? { ...s, copied: true } : s
        )
      )
      toast.success(t('sectionCopied'))
      
      // Reset after 2 seconds
      setTimeout(() => {
        setSections(prev => 
          prev.map(s => 
            s.id === sectionId ? { ...s, copied: false } : s
          )
        )
      }, 2000)
    } catch (error) {
      toast.error(t('copyFailed'))
    }
  }

  async function handleCopyAll() {
    if (!output) return

    try {
      await navigator.clipboard.writeText(output.content)
      setCopiedAll(true)
      toast.success(t('contentCopied'))
      setTimeout(() => setCopiedAll(false), 2000)
    } catch (error) {
      toast.error(t('copyFailed'))
    }
  }

  async function handleDownload(format: 'md' | 'pdf' | 'docx') {
    if (!output) return
    const name = `${output.templateName.replace(/\s+/g, '-').toLowerCase()}-${new Date(output.createdAt).getTime()}`
    await exportOutput(output.content, name, format)
    toast.success(t('downloaded'))
  }

  async function handleDelete() {
    if (!output) return
    
    setDeleting(true)
    try {
      const response = await fetch(`/api/outputs/${outputId}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || t('deleteFailed'))
      }

      toast.success(t('deleteSuccess'))
      router.push('/outputs')
    } catch (error) {
      console.error('Error deleting output:', error)
      toast.error(error instanceof Error ? error.message : t('deleteFailed'))
      setDeleting(false)
    }
  }

  async function handleTranslate(targetLanguage: string) {
    if (!output) return
    setTranslating(true)
    try {
      const response = await fetch(`/api/outputs/${outputId}/translate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetLanguage }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || t('translateFailed'))
      toast.success(t('translatedTo', { language: TRANSLATE_LANGUAGES.find(l => l.code === targetLanguage)?.label || targetLanguage }))
      router.push(`/outputs/${data.id}`)
    } catch (error) {
      console.error('Translate error:', error)
      toast.error(error instanceof Error ? error.message : t('translateFailed'))
    } finally {
      setTranslating(false)
    }
  }

  const currentLangCode = output?.language || 'en'
  const otherLanguages = TRANSLATE_LANGUAGES.filter(l => l.code !== currentLangCode)

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-current border-r-transparent"></div>
          <p className="mt-2 text-sm text-muted-foreground">{t('loadingOutput')}</p>
        </div>
      </div>
    )
  }

  if (!output) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <FileText className="h-12 w-12 text-muted-foreground/50 mx-auto mb-4" />
          <h3 className="font-medium text-foreground mb-1">{t('notFound')}</h3>
          <p className="text-sm text-muted-foreground mb-4">
            {t('notFoundHint')}
          </p>
          <Button asChild>
            <Link href="/outputs">
              <ArrowLeft className="h-4 w-4 mr-2" />
              {tc('back')}
            </Link>
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-12">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <Button 
            variant="ghost" 
            size="sm" 
            asChild 
            className="mb-3 -ml-2"
          >
            <Link href="/outputs">
              <ArrowLeft className="h-4 w-4 mr-2" />
              {tc('back')}
            </Link>
          </Button>
          
          <div className="flex items-center gap-3 mb-2">
            <h1 className="text-2xl font-semibold text-foreground">
              {output.templateName}
            </h1>
            <Badge
              variant={output.audience === "internal" ? "secondary" : "outline"}
              className="shrink-0"
            >
              {audienceLabels[output.audience]}
            </Badge>
          </div>
          
          <p className="text-sm text-muted-foreground flex items-center gap-1.5">
            <FileText className="h-3.5 w-3.5" />
            {t('generatedFromSession', { name: output.sessionFilename })}
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2 flex-wrap">
          <Button
            variant={isPublic ? "outline" : "default"}
            size="sm"
            onClick={isPublic ? handleCopyShareLink : handleShare}
            disabled={isSharing}
            className="gap-2"
            title={tc('share')}
          >
            {isSharing ? (
              <>
                <div className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-solid border-current border-r-transparent"></div>
                <span className="hidden md:inline">{t('sharing')}</span>
              </>
            ) : copiedShareLink ? (
              <>
                <Check className="h-4 w-4 text-success" />
                <span className="hidden md:inline">{tc('copied')}</span>
              </>
            ) : (
              <>
                {isPublic ? <LinkIcon className="h-4 w-4" /> : <Share2 className="h-4 w-4" />}
                <span className="hidden md:inline">{tc('share')}</span>
              </>
            )}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleCopyAll}
            className="gap-2"
            title={tc('copy')}
          >
            <Copy className="h-4 w-4" />
            <span className="hidden md:inline">{tc('copy')}</span>
          </Button>
          <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-2"
                  title={tc('download')}
                >
                  <Download className="h-4 w-4" />
                  <span className="hidden md:inline">{tc('download')}</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => handleDownload('md')}>MD</DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleDownload('pdf')}>PDF</DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleDownload('docx')}>DOCX</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          <Button
            variant="outline"
            size="sm"
            asChild
            title={t('goToSession')}
          >
            <Link href={`/sessions/${output.sessionId}`} className="gap-2">
              <ExternalLink className="h-4 w-4" />
              <span className="hidden md:inline">{t('session')}</span>
            </Link>
          </Button>
          {otherLanguages.length > 0 && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={translating}
                  className="gap-2"
                  title={t('translateTooltip')}
                >
                  {translating ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Globe className="h-4 w-4" />
                  )}
                  <span className="hidden md:inline">{t('translate')}</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {otherLanguages.map(({ code, label }) => (
                  <DropdownMenuItem
                    key={code}
                    onClick={() => handleTranslate(code)}
                    disabled={translating}
                  >
                    {t('translateTo', { language: label })}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="gap-2 text-destructive hover:text-destructive hover:bg-destructive/10 border-destructive/20"
                disabled={deleting}
                title={tc('delete')}
              >
                {deleting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Trash2 className="h-4 w-4" />
                )}
                <span className="hidden md:inline">{tc('delete')}</span>
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>{t('deleteDialogTitle')}</AlertDialogTitle>
                <AlertDialogDescription>
                  {t('deleteDialogDescription', { name: output.templateName })}
                  {isPublic && (
                    <span className="block mt-2 text-destructive font-medium">
                      {t('deleteDialogSharedWarning')}
                    </span>
                  )}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>{tc('cancel')}</AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleDelete}
                  className="bg-destructive hover:bg-destructive/90"
                >
                  {tc('delete')}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>

      {/* Share Status Banner */}
      {isPublic && shareUrl && (
        <Card className="border-info/50 bg-info/5">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-sm text-info">
              <Eye className="h-4 w-4" />
              <span className="font-medium">{t('publiclyShared')}</span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Metadata */}
      <Card className="border-border">
        <CardContent className="p-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div className="flex items-start gap-2">
              <User className="h-4 w-4 text-muted-foreground mt-0.5" />
              <div>
                <p className="text-xs text-muted-foreground">{t('perspective')}</p>
                <p className="font-medium">{participantRoleLabels[output.perspective]}</p>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <Users className="h-4 w-4 text-muted-foreground mt-0.5" />
              <div>
                <p className="text-xs text-muted-foreground">{t('audience')}</p>
                <p className="font-medium capitalize">{output.audience}</p>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <MessageSquare className="h-4 w-4 text-muted-foreground mt-0.5" />
              <div>
                <p className="text-xs text-muted-foreground">{t('tone')}</p>
                <p className="font-medium capitalize">{output.tone}</p>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <Calendar className="h-4 w-4 text-muted-foreground mt-0.5" />
              <div>
                <p className="text-xs text-muted-foreground">{t('createdAt')}</p>
                <p className="font-medium">{formatDate(output.createdAt)}</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Separator />

      {/* Content Sections */}
      <div className="space-y-4">
        {sections.map((section, index) => (
          <Card 
            key={section.id} 
            className={cn(
              "border-border group hover:border-muted-foreground/30 transition-colors relative",
              section.copied && "border-success/50 bg-success/5"
            )}
          >
            <CardContent className="p-6">
              {/* Copy Button */}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleCopySection(section.id)}
                className={cn(
                  "absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity",
                  section.copied && "opacity-100"
                )}
              >
                {section.copied ? (
                  <Check className="h-4 w-4 text-success" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </Button>

              {/* Rendered Markdown */}
              <article className="prose prose-sm max-w-none dark:prose-invert prose-headings:font-semibold prose-headings:text-foreground prose-p:text-foreground prose-strong:text-foreground prose-li:text-foreground prose-a:text-primary break-words overflow-wrap-anywhere">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {section.content}
                </ReactMarkdown>
              </article>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Footer Info */}
      <Card className="border-border bg-secondary/30">
        <CardContent className="p-4 flex items-center gap-2 text-xs text-muted-foreground">
          <Sparkles className="h-3.5 w-3.5" />
          <span>
            {t('generatedWithFormat', { format: output.format.toUpperCase() })}
            {output.citeTimestamps && ` • ${t('includesTimestampCitations')}`}
          </span>
        </CardContent>
      </Card>
    </div>
  )
}
