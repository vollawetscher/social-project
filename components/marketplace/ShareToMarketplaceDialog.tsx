'use client'

import { useState, useEffect, useMemo } from 'react'
import { useTranslations, useLocale } from 'next-intl'
import { toast } from 'sonner'
import { Store, Tag, Loader2, AlertTriangle, Mail } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { createClient } from '@/lib/supabase/client'
import type { Template } from '@/lib/types-v0'
import type { MarketplaceCategory } from '@/lib/types/marketplace'

interface ShareToMarketplaceDialogProps {
  template: Template | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess?: (marketplaceId: string) => void
}

export function ShareToMarketplaceDialog({
  template,
  open,
  onOpenChange,
  onSuccess,
}: ShareToMarketplaceDialogProps) {
  const t = useTranslations('marketplace')
  const tt = useTranslations('templates')
  const locale = useLocale()
  const supabase = createClient()

  const [categories, setCategories] = useState<MarketplaceCategory[]>([])
  const [categoryId, setCategoryId] = useState<string>('')
  const [description, setDescription] = useState('')
  const [tagInput, setTagInput] = useState('')
  const [tags, setTags] = useState<string[]>([])
  const [publishing, setPublishing] = useState(false)
  const [leadCaptureEnabled, setLeadCaptureEnabled] = useState(false)

  useEffect(() => {
    if (open) {
      supabase
        .from('marketplace_categories')
        .select('*')
        .order('sort_order')
        .then(({ data }: { data: any }) => {
          if (data) setCategories(data)
        })
    }
  }, [open, supabase])

  useEffect(() => {
    if (template && open) {
      setDescription(template.description || '')
      setTags(template.domainTags?.slice() || [])
      setCategoryId('')
      setTagInput('')
      setLeadCaptureEnabled(false)
    }
  }, [template, open])

  function handleAddTag(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault()
      const tag = tagInput.trim().toLowerCase()
      if (tag && !tags.includes(tag)) {
        setTags([...tags, tag])
      }
      setTagInput('')
    }
  }

  function removeTag(tag: string) {
    setTags(tags.filter((t) => t !== tag))
  }

  async function handlePublish() {
    if (!template) return

    if ((template as any).marketplace_source_id) {
      toast.error(t('upload.cannotRepublish'))
      return
    }

    setPublishing(true)

    try {
      const res = await fetch(`/api/templates/${template.id}/publish-to-marketplace`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          category_id: categoryId || null,
          tags,
          description_override: description !== template.description ? description : undefined,
          language: template.language || locale,
          lead_capture_enabled: leadCaptureEnabled,
        }),
      })

      const data = await res.json()

      if (res.status === 409) {
        toast.info(tt('alreadyPublished'))
        onOpenChange(false)
        return
      }

      if (!res.ok) {
        throw new Error(data.error || 'Failed to publish')
      }

      toast.success(tt('publishSuccess'))
      onOpenChange(false)
      onSuccess?.(data.marketplace_id)
    } catch (err: any) {
      toast.error(err.message || tt('publishFailed'))
    } finally {
      setPublishing(false)
    }
  }

  const looksLikePrompt = useMemo(() => {
    const lower = description.toLowerCase()
    const promptKeywords = ['you are', 'generate a', 'create a', 'your task', 'your role', 'role:', 'task:', 'rules:']
    return description.length > 300 || promptKeywords.some(kw => lower.includes(kw))
  }, [description])

  if (!template) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Store className="h-5 w-5" />
            {tt('shareToMarketplace')}
          </DialogTitle>
          <DialogDescription>
            {tt('shareToMarketplaceDesc')}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="rounded-lg border border-border bg-secondary/30 p-3">
            <p className="font-medium text-sm">{template.name}</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {template.sections?.length || 0} {tt('sections').toLowerCase()} &middot;{' '}
              {template.domainTags?.join(', ') || 'general'}
            </p>
          </div>

          <div className="space-y-2">
            <Label>{t('upload.form.marketplaceDescription')}</Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value.slice(0, 250))}
              maxLength={250}
              placeholder={t('upload.form.marketplaceDescriptionPlaceholder')}
              rows={3}
              className="resize-none"
            />
            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground">{t('upload.form.marketplaceDescriptionHint')}</p>
              <span className={`text-xs ${description.length > 230 ? 'text-orange-500' : 'text-muted-foreground'}`}>
                {description.length}/250
              </span>
            </div>
            {looksLikePrompt && (
              <div className="flex items-start gap-2 rounded-md bg-yellow-50 dark:bg-yellow-950/30 border border-yellow-200 dark:border-yellow-800 p-2.5">
                <AlertTriangle className="h-4 w-4 text-yellow-600 dark:text-yellow-400 mt-0.5 shrink-0" />
                <p className="text-xs text-yellow-700 dark:text-yellow-300">{t('upload.form.promptWarning')}</p>
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Label>{t('upload.form.category')}</Label>
            <Select value={categoryId} onValueChange={setCategoryId}>
              <SelectTrigger>
                <SelectValue placeholder={t('upload.form.categoryPlaceholder')} />
              </SelectTrigger>
              <SelectContent>
                {categories.map((cat) => (
                  <SelectItem key={cat.id} value={cat.id}>
                    {cat.icon} {t.has(`categories.${cat.slug}` as any) ? t(`categories.${cat.slug}` as any) : cat.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label className="flex items-center gap-1.5">
              <Tag className="h-3.5 w-3.5" />
              {t('upload.form.tags')}
            </Label>
            <Input
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              onKeyDown={handleAddTag}
              placeholder={t('upload.form.tagsPlaceholder')}
            />
            {tags.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {tags.map((tag) => (
                  <Badge
                    key={tag}
                    variant="secondary"
                    className="cursor-pointer"
                    onClick={() => removeTag(tag)}
                  >
                    {tag} &times;
                  </Badge>
                ))}
              </div>
            )}
          </div>
          <div className="rounded-lg border border-border bg-secondary/30 p-3 space-y-2">
            <label className="flex items-start gap-3 cursor-pointer select-none">
              <Checkbox
                checked={leadCaptureEnabled}
                onCheckedChange={(checked) => setLeadCaptureEnabled(checked === true)}
                className="mt-0.5"
              />
              <div className="space-y-1">
                <span className="text-sm font-medium flex items-center gap-1.5">
                  <Mail className="h-3.5 w-3.5 text-muted-foreground" />
                  {t('upload.form.leadCapture')}
                </span>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  {t('upload.form.leadCaptureHint')}
                </p>
              </div>
            </label>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={publishing}>
            {t('common.cancel')}
          </Button>
          <Button onClick={handlePublish} disabled={publishing}>
            {publishing && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {t('upload.publishButton')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
