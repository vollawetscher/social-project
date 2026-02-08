"use client"

export const dynamic = 'force-dynamic'

import React, { useState, useEffect } from "react"
import { useParams, useRouter } from "next/navigation"
import Link from "next/link"
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
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { cn } from "@/lib/utils"
import type { Output } from "@/lib/types-v0"
import { participantRoleLabels, audienceLabels } from "@/lib/mock/data"

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

export default function OutputDetailPage() {
  const params = useParams()
  const router = useRouter()
  const outputId = params.id as string

  const [output, setOutput] = useState<Output | null>(null)
  const [loading, setLoading] = useState(true)
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
      toast.error('Failed to load output')
      router.push('/outputs')
    } finally {
      setLoading(false)
    }
  }

  async function handleShare() {
    if (!output) return
    
    setIsSharing(true)
    try {
      console.log('[Share] Calling API for output:', outputId)
      const response = await fetch(`/api/outputs/${outputId}/share`, {
        method: 'POST',
      })
      
      console.log('[Share] API response status:', response.status)
      
      if (!response.ok) {
        const errorData = await response.json()
        console.error('[Share] API error:', errorData)
        throw new Error(errorData.error || 'Failed to enable sharing')
      }
      
      const data = await response.json()
      console.log('[Share] API response data:', data)
      console.log('[Share] Share URL:', data.shareUrl)
      console.log('[Share] Share Token:', data.shareToken)
      
      setShareUrl(data.shareUrl)
      setIsPublic(true)
      
      // Auto-copy link
      await navigator.clipboard.writeText(data.shareUrl)
      setCopiedShareLink(true)
      setTimeout(() => setCopiedShareLink(false), 2000)
      
      toast.success('Share link copied to clipboard!')
    } catch (error) {
      console.error('[Share] Error enabling sharing:', error)
      toast.error('Failed to enable sharing: ' + (error instanceof Error ? error.message : 'Unknown error'))
    } finally {
      setIsSharing(false)
    }
  }

  async function handleCopyShareLink() {
    if (!shareUrl) return
    
    try {
      await navigator.clipboard.writeText(shareUrl)
      setCopiedShareLink(true)
      setTimeout(() => setCopiedShareLink(false), 2000)
      toast.success('Share link copied!')
    } catch (error) {
      toast.error('Failed to copy link')
    }
  }

  async function handleDisableSharing() {
    if (!output) return
    
    try {
      const response = await fetch(`/api/outputs/${outputId}/share`, {
        method: 'DELETE',
      })
      
      if (!response.ok) throw new Error('Failed to disable sharing')
      
      setIsPublic(false)
      toast.success('Sharing disabled')
    } catch (error) {
      console.error('Error disabling sharing:', error)
      toast.error('Failed to disable sharing')
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
      toast.success('Section copied to clipboard')
      
      // Reset after 2 seconds
      setTimeout(() => {
        setSections(prev => 
          prev.map(s => 
            s.id === sectionId ? { ...s, copied: false } : s
          )
        )
      }, 2000)
    } catch (error) {
      toast.error('Failed to copy to clipboard')
    }
  }

  async function handleCopyAll() {
    if (!output) return

    try {
      await navigator.clipboard.writeText(output.content)
      setCopiedAll(true)
      toast.success('Entire output copied to clipboard')
      setTimeout(() => setCopiedAll(false), 2000)
    } catch (error) {
      toast.error('Failed to copy to clipboard')
    }
  }

  function handleDownload() {
    if (!output) return

    const blob = new Blob([output.content], { type: 'text/markdown' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${output.templateName.replace(/\s+/g, '-').toLowerCase()}-${new Date(output.createdAt).getTime()}.md`
    document.body.appendChild(a)
    a.click()
    window.URL.revokeObjectURL(url)
    document.body.removeChild(a)
    toast.success('Downloaded output')
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-current border-r-transparent"></div>
          <p className="mt-2 text-sm text-muted-foreground">Loading output...</p>
        </div>
      </div>
    )
  }

  if (!output) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <FileText className="h-12 w-12 text-muted-foreground/50 mx-auto mb-4" />
          <h3 className="font-medium text-foreground mb-1">Output not found</h3>
          <p className="text-sm text-muted-foreground mb-4">
            This output may have been deleted
          </p>
          <Button asChild>
            <Link href="/outputs">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Outputs
            </Link>
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6 pb-12">
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
              Back to Outputs
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
            Generated from {output.sessionFilename}
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
          >
            {isSharing ? (
              <>
                <div className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-solid border-current border-r-transparent"></div>
                Sharing...
              </>
            ) : copiedShareLink ? (
              <>
                <Check className="h-4 w-4 text-success" />
                Copied!
              </>
            ) : isPublic ? (
              <>
                <LinkIcon className="h-4 w-4" />
                Share
              </>
            ) : (
              <>
                <Share2 className="h-4 w-4" />
                Share
              </>
            )}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleCopyAll}
            className="gap-2"
          >
            <Copy className="h-4 w-4" />
            Copy
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleDownload}
            className="h-8 w-8 p-0"
            title="Download"
          >
            <Download className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            asChild
            className="gap-2"
          >
            <Link href={`/sessions/${output.sessionId}`}>
              <ExternalLink className="h-4 w-4" />
              Session
            </Link>
          </Button>
        </div>
      </div>

      {/* Share Status Banner */}
      {isPublic && shareUrl && (
        <Card className="border-info/50 bg-info/5">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-sm text-info">
              <Eye className="h-4 w-4" />
              <span className="font-medium">Publicly shared • Expires in 3 days</span>
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
                <p className="text-xs text-muted-foreground">Perspective</p>
                <p className="font-medium">{participantRoleLabels[output.perspective]}</p>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <Users className="h-4 w-4 text-muted-foreground mt-0.5" />
              <div>
                <p className="text-xs text-muted-foreground">Audience</p>
                <p className="font-medium capitalize">{output.audience}</p>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <MessageSquare className="h-4 w-4 text-muted-foreground mt-0.5" />
              <div>
                <p className="text-xs text-muted-foreground">Tone</p>
                <p className="font-medium capitalize">{output.tone}</p>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <Calendar className="h-4 w-4 text-muted-foreground mt-0.5" />
              <div>
                <p className="text-xs text-muted-foreground">Generated</p>
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
              <article className="prose prose-sm max-w-none dark:prose-invert prose-headings:font-semibold prose-headings:text-foreground prose-p:text-foreground prose-strong:text-foreground prose-li:text-foreground prose-a:text-primary">
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
            Generated with {output.format.toUpperCase()} format
            {output.citeTimestamps && " • Includes timestamp citations"}
          </span>
        </CardContent>
      </Card>
    </div>
  )
}
