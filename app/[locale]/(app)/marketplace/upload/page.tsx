'use client'

import { useState, useEffect } from 'react'
import { Link, useRouter } from '@/i18n/navigation'
import {
  LogIn, ClipboardPaste, CheckCircle2, AlertCircle,
  Sparkles, Loader2, LayoutTemplate, FileJson, Store,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { useAuth } from '@/lib/auth/AuthProvider'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import type { NotissimaExportJSON } from '@/lib/types/marketplace'
import type { Template } from '@/lib/types-v0'
import { MarketplaceNav } from '@/components/marketplace/MarketplaceNav'
import { ShareToMarketplaceDialog } from '@/components/marketplace/ShareToMarketplaceDialog'

function isValidExport(data: unknown): data is NotissimaExportJSON {
  if (!data || typeof data !== 'object') return false
  const d = data as Record<string, unknown>
  return d.v === 1 && typeof d.name === 'string'
}

export default function UploadTemplatePage() {
  const t = useTranslations('marketplace')
  const { user } = useAuth()
  const router = useRouter()

  const [templates, setTemplates] = useState<Template[]>([])
  const [loadingTemplates, setLoadingTemplates] = useState(false)
  const [shareTemplate, setShareTemplate] = useState<Template | null>(null)

  const [jsonInput, setJsonInput] = useState('')
  const [importStatus, setImportStatus] = useState<'idle' | 'success' | 'error'>('idle')
  const [importing, setImporting] = useState(false)

  useEffect(() => {
    if (user) {
      setLoadingTemplates(true)
      fetch('/api/templates')
        .then((r) => r.json())
        .then((data) => setTemplates(Array.isArray(data) ? data : []))
        .catch(() => {})
        .finally(() => setLoadingTemplates(false))
    }
  }, [user])

  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 mb-4">
          <LogIn className="h-8 w-8 text-primary" />
        </div>
        <h2 className="text-lg font-medium text-foreground mb-2">
          {t('upload.form.loginRequired')}
        </h2>
        <Button asChild className="mt-4">
          <Link href="/login">{t('upload.form.signIn')}</Link>
        </Button>
      </div>
    )
  }

  async function handleImportJson() {
    setImporting(true)
    try {
      const data = JSON.parse(jsonInput.trim())
      if (!isValidExport(data)) {
        setImportStatus('error')
        return
      }

      const res = await fetch('/api/templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: data.name,
          description: data.description || '',
          intendedPerspectives: data.perspectives || [],
          allowedAudience: data.audiences || [],
          domainTags: data.domains || [],
          sections: data.generation_prompt
            ? [{ id: 'generated-output', name: 'Generated Output', description: data.generation_prompt, isRequired: true }]
            : [],
          requiredInputs: [],
          styleRules: [],
          suggestionTriggers: [],
          defaultDoInstructions: data.do_include || '',
          defaultDontInstructions: data.do_not_include || '',
        }),
      })

      if (!res.ok) throw new Error('Failed to create template')

      const created = await res.json()
      setImportStatus('success')
      toast.success(t('upload.import.success'))

      setShareTemplate(created)
    } catch {
      setImportStatus('error')
      toast.error(t('upload.import.error'))
    } finally {
      setImporting(false)
    }
  }

  return (
    <div className="space-y-6">
      <MarketplaceNav />

      <div>
        <h1 className="text-2xl font-semibold text-foreground">{t('upload.title')}</h1>
        <p className="text-sm text-muted-foreground mt-1">{t('upload.subtitle')}</p>
      </div>

      {/* Path A: Share from My Templates */}
      <Card className="border-primary/30 bg-primary/5">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <LayoutTemplate className="h-5 w-5 text-primary" />
            {t('upload.shareFromTemplates')}
          </CardTitle>
          <CardDescription>{t('upload.shareFromTemplatesDesc')}</CardDescription>
        </CardHeader>
        <CardContent>
          {loadingTemplates ? (
            <div className="flex items-center justify-center py-6">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : templates.length === 0 ? (
            <div className="text-center py-6">
              <p className="text-sm text-muted-foreground">{t('upload.noTemplates')}</p>
              <Button asChild variant="outline" className="mt-3 bg-transparent">
                <Link href="/templates/new/scratch">
                  <Sparkles className="h-4 w-4 mr-2" />
                  {t('upload.createTemplate')}
                </Link>
              </Button>
            </div>
          ) : (
            <div className="space-y-2">
              {templates.map((tpl) => (
                <button
                  key={tpl.id}
                  onClick={() => setShareTemplate(tpl)}
                  className="w-full text-left p-3 rounded-lg border border-border bg-background hover:bg-secondary/50 transition-colors flex items-center gap-3"
                >
                  <Store className="h-4 w-4 text-muted-foreground shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{tpl.name}</p>
                    <p className="text-xs text-muted-foreground truncate">{tpl.description}</p>
                  </div>
                  <Sparkles className="h-4 w-4 text-primary shrink-0" />
                </button>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="relative">
        <Separator />
        <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-background px-3 text-xs text-muted-foreground uppercase tracking-wider">
          {t('upload.import.orManual')}
        </span>
      </div>

      {/* Path B: Import JSON */}
      <Card className="border-border">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <FileJson className="h-5 w-5 text-primary" />
            {t('upload.importJson')}
          </CardTitle>
          <CardDescription>{t('upload.importJsonDesc')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Textarea
            value={jsonInput}
            onChange={(e) => { setJsonInput(e.target.value); setImportStatus('idle') }}
            placeholder={t('upload.import.placeholder')}
            className="bg-secondary border-border min-h-[120px] font-mono text-xs"
          />
          <div className="flex items-center gap-3">
            <Button onClick={handleImportJson} disabled={!jsonInput.trim() || importing} size="sm">
              {importing ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <ClipboardPaste className="h-4 w-4 mr-2" />
              )}
              {t('upload.import.button')}
            </Button>
            {importStatus === 'success' && (
              <span className="flex items-center gap-1 text-sm text-green-600">
                <CheckCircle2 className="h-4 w-4" />{t('upload.import.success')}
              </span>
            )}
            {importStatus === 'error' && (
              <span className="flex items-center gap-1 text-sm text-destructive">
                <AlertCircle className="h-4 w-4" />{t('upload.import.error')}
              </span>
            )}
          </div>
        </CardContent>
      </Card>

      <div className="h-8" />

      <ShareToMarketplaceDialog
        template={shareTemplate}
        open={!!shareTemplate}
        onOpenChange={(open) => !open && setShareTemplate(null)}
        onSuccess={() => {
          router.push('/marketplace')
        }}
      />
    </div>
  )
}
