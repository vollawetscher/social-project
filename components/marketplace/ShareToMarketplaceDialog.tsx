'use client'

import { useState, useEffect } from 'react'
import { useTranslations, useLocale } from 'next-intl'
import { toast } from 'sonner'
import { Store, Tag, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
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
            <Label>{t('upload.form.description')}</Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="resize-none"
            />
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
                    {cat.icon} {cat.name}
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
