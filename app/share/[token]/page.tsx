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
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { cn } from "@/lib/utils"
import { toast } from "sonner"

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

export default function SharedOutputPage() {
  const params = useParams()
  const token = params.token as string

  const [output, setOutput] = useState<SharedOutput | null>(null)
  const [loading, setLoading] = useState(true)
  const [sections, setSections] = useState<CopyableSection[]>([])
  const [copiedAll, setCopiedAll] = useState(false)

  useEffect(() => {
    fetchSharedOutput()
  }, [token])

  useEffect(() => {
    if (output) {
      parseContentIntoSections(output.content)
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

  function handleDownload() {
    if (!output) return

    const blob = new Blob([output.content], { type: 'text/markdown' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${output.templateName.replace(/\s+/g, '-').toLowerCase()}.md`
    document.body.appendChild(a)
    a.click()
    window.URL.revokeObjectURL(url)
    document.body.removeChild(a)
    toast.success('Downloaded output')
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        {/* Header */}
        <header className="border-b border-border bg-card">
          <div className="container mx-auto px-4 py-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="h-6 w-6 text-primary" />
              <span className="text-xl font-semibold">Notissima</span>
            </div>
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
            <div className="flex items-center gap-2">
              <Sparkles className="h-6 w-6 text-primary" />
              <span className="text-xl font-semibold">Notissima</span>
            </div>
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
          <div className="flex items-center gap-2">
            <Sparkles className="h-6 w-6 text-primary" />
            <span className="text-xl font-semibold">Notissima</span>
          </div>
          <Button asChild>
            <Link href="/signup">
              Sign Up Free
            </Link>
          </Button>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8 max-w-4xl">
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
              <Button
                variant="outline"
                size="sm"
                onClick={handleDownload}
                className="gap-2"
              >
                <Download className="h-4 w-4" />
                Download
              </Button>
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
