"use client"

import React, { useState, useEffect } from "react"
import { useParams } from "next/navigation"
import Link from "next/link"
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import {
  Copy,
  Check,
  Download,
  FileText,
  Eye,
  Sparkles,
  ArrowRight,
  ExternalLink,
  Clock,
  AlertTriangle,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Logo } from "@/components/ui/logo"
import { cn } from "@/lib/utils"
import { toast } from "sonner"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { exportOutput } from "@/lib/utils/output-export"

interface SharedOutput {
  id: string
  sessionId: string
  sessionFilename: string
  templateId: string
  templateName: string
  perspective: string
  audience: string
  language: string
  tone: string
  format: string
  content: string
  createdAt: string
  sharedBy: string
  viewCount: number
  sharedAt: string
}

interface CopyableSection {
  id: string
  content: string
  copied: boolean
}

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  })
}

function calculateDaysUntilExpiration(sharedAt: string): number {
  const EXPIRATION_DAYS = 30
  const sharedDate = new Date(sharedAt)
  const expirationDate = new Date(sharedDate.getTime() + EXPIRATION_DAYS * 24 * 60 * 60 * 1000)
  const now = new Date()
  const daysLeft = Math.ceil((expirationDate.getTime() - now.getTime()) / (24 * 60 * 60 * 1000))
  return daysLeft
}

function getExpirationDate(sharedAt: string): string {
  const EXPIRATION_DAYS = 30
  const sharedDate = new Date(sharedAt)
  const expirationDate = new Date(sharedDate.getTime() + EXPIRATION_DAYS * 24 * 60 * 60 * 1000)
  return formatDate(expirationDate.toISOString())
}

export default function SharedOutputPage() {
  const params = useParams()
  const token = params.token as string

  const [output, setOutput] = useState<SharedOutput | null>(null)
  const [loading, setLoading] = useState(true)
  const [sections, setSections] = useState<CopyableSection[]>([])
  const [copiedAll, setCopiedAll] = useState(false)
  const [daysUntilExpiration, setDaysUntilExpiration] = useState<number | null>(null)

  useEffect(() => {
    fetchSharedOutput()
  }, [token])

  useEffect(() => {
    if (output) {
      parseContentIntoSections(output.content)
      if (output.sharedAt) {
        setDaysUntilExpiration(calculateDaysUntilExpiration(output.sharedAt))
      }
    }
  }, [output])

  async function fetchSharedOutput() {
    try {
      const response = await fetch(`/api/share/${token}`)
      if (!response.ok) throw new Error('Failed to fetch shared output')
      const data = await response.json()
      setOutput(data)
    } catch (error) {
      console.error('Error fetching shared output:', error)
      toast.error('This shared link is no longer available')
    } finally {
      setLoading(false)
    }
  }

  function parseContentIntoSections(content: string) {
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

  async function handleDownload(format: 'md' | 'pdf' | 'docx') {
    if (!output) return
    await exportOutput(output.content, output.templateName, format)
    toast.success('Downloaded output')
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        {/* Header */}
        <header className="border-b border-border bg-card">
          <div className="container mx-auto px-4 py-4 flex items-center justify-between">
            <Logo />
          </div>
        </header>

        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-current border-r-transparent"></div>
            <p className="mt-2 text-sm text-muted-foreground">Loading shared output...</p>
          </div>
        </div>
      </div>
    )
  }

  if (!output) {
    return (
      <div className="min-h-screen bg-background">
        {/* Header */}
        <header className="border-b border-border bg-card">
          <div className="container mx-auto px-4 py-4 flex items-center justify-between">
            <Logo />
            <Button asChild>
              <Link href="/signup">
                Sign Up Free
              </Link>
            </Button>
          </div>
        </header>

        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center max-w-md mx-auto px-4">
            <FileText className="h-16 w-16 text-muted-foreground/50 mx-auto mb-4" />
            <h2 className="text-2xl font-semibold text-foreground mb-2">Link Not Available</h2>
            <p className="text-muted-foreground mb-6">
              This shared output is no longer available or the link has expired.
            </p>
            <Button asChild size="lg">
              <Link href="/signup">
                <Sparkles className="h-4 w-4 mr-2" />
                Create Your Own Outputs
              </Link>
            </Button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header with Branding & CTA */}
      <header className="border-b border-border bg-card sticky top-0 z-50">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between">
          <Logo />
          <Button asChild>
            <Link href="/signup">
              Sign Up Free
            </Link>
          </Button>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8 max-w-4xl">
        {/* Expiration Warning */}
        {daysUntilExpiration !== null && (
          <Alert 
            className={cn(
              "mb-6",
              daysUntilExpiration <= 7 ? "border-destructive/50 bg-destructive/10" : 
              daysUntilExpiration <= 14 ? "border-orange-500/50 bg-orange-500/10" : 
              "border-muted bg-muted/50"
            )}
          >
            {daysUntilExpiration <= 7 ? (
              <AlertTriangle className="h-4 w-4 text-destructive" />
            ) : (
              <Clock className="h-4 w-4 text-muted-foreground" />
            )}
            <AlertDescription className={cn(
              daysUntilExpiration <= 7 ? "text-destructive" : "text-muted-foreground"
            )}>
              {daysUntilExpiration <= 0 ? (
                "This shared link has expired"
              ) : daysUntilExpiration <= 7 ? (
                <span>
                  <strong>Link expires soon:</strong> This shared output will expire in {daysUntilExpiration} {daysUntilExpiration === 1 ? 'day' : 'days'} ({getExpirationDate(output!.sharedAt)})
                </span>
              ) : (
                <span>
                  This shared link expires on {getExpirationDate(output!.sharedAt)} ({daysUntilExpiration} days remaining)
                </span>
              )}
            </AlertDescription>
          </Alert>
        )}

        {/* Output Header */}
        <div className="space-y-4 mb-8">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <h1 className="text-3xl font-bold text-foreground mb-2">
                {output.templateName}
              </h1>
              <p className="text-sm text-muted-foreground flex items-center gap-1.5">
                <FileText className="h-3.5 w-3.5" />
                From {output.sessionFilename}
              </p>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleCopyAll}
                className="gap-2"
              >
                {copiedAll ? (
                  <Check className="h-4 w-4 text-success" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
                Copy All
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-2"
                  >
                    <Download className="h-4 w-4" />
                    Download
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => handleDownload('md')}>MD</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleDownload('pdf')}>PDF</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleDownload('docx')}>DOCX</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>

          {/* Shared By Info */}
          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            <span>Shared by <strong className="text-foreground">{output.sharedBy}</strong></span>
            <span>•</span>
            <span>{formatDate(output.sharedAt || output.createdAt)}</span>
            <span>•</span>
            <span className="flex items-center gap-1">
              <Eye className="h-3.5 w-3.5" />
              {output.viewCount} {output.viewCount === 1 ? 'view' : 'views'}
            </span>
          </div>
        </div>

        <Separator className="mb-8" />

        {/* Content Sections */}
        <div className="space-y-4 mb-12">
          {sections.map((section) => (
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

        {/* CTA Section */}
        <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-primary/10">
          <CardContent className="p-8 text-center">
            <Sparkles className="h-12 w-12 text-primary mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-foreground mb-2">
              Want to create professional outputs like this?
            </h2>
            <p className="text-muted-foreground mb-6 max-w-2xl mx-auto">
              Notissima turns your conversations into polished documents automatically. 
              Record, transcribe, and generate custom outputs in minutes.
            </p>
            <div className="flex items-center justify-center gap-3">
              <Button asChild size="lg">
                <Link href="/signup">
                  Start Free Trial
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Link>
              </Button>
              <Button asChild variant="outline" size="lg">
                <Link href="/login">
                  <ExternalLink className="h-4 w-4 mr-2" />
                  Log In
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Footer */}
        <footer className="mt-12 pt-8 border-t border-border text-center text-sm text-muted-foreground">
          <p>Created with <strong>Notissima</strong> • Professional AI-powered transcription & documentation</p>
        </footer>
      </main>
    </div>
  )
}
