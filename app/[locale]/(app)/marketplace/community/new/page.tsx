'use client'

import { useState, type KeyboardEvent } from 'react'
import { Link, useRouter } from '@/i18n/navigation'
import { FileText, HelpCircle, Lightbulb, Send, LogIn, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { MarkdownEditor } from '@/components/marketplace/MarkdownEditor'
import { useAuth } from '@/lib/auth/AuthProvider'
import { createClient } from '@/lib/supabase/client'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import type { PostType } from '@/lib/types/marketplace'

const POST_TYPES: { value: PostType; icon: typeof FileText; color: string }[] = [
  { value: 'article', icon: FileText, color: 'border-blue-500 bg-blue-500/10 text-blue-600' },
  { value: 'question', icon: HelpCircle, color: 'border-orange-500 bg-orange-500/10 text-orange-600' },
  { value: 'tip', icon: Lightbulb, color: 'border-green-500 bg-green-500/10 text-green-600' },
]

const CATEGORIES = [
  'psychology', 'medical', 'sales', 'legal', 'education', 'it', 'consulting', 'hr', 'general',
]

export default function NewPostPage() {
  const t = useTranslations('marketplace')
  const { user } = useAuth()
  const router = useRouter()
  const supabase = createClient()

  const [postType, setPostType] = useState<PostType>('article')
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [category, setCategory] = useState('')
  const [tags, setTags] = useState<string[]>([])
  const [tagInput, setTagInput] = useState('')
  const [submitting, setSubmitting] = useState(false)

  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 mb-4">
          <LogIn className="h-8 w-8 text-primary" />
        </div>
        <h2 className="text-lg font-medium text-foreground mb-2">
          {t('community.newPostPage.loginRequired')}
        </h2>
        <Button asChild className="mt-4">
          <Link href="/login">{t('upload.form.signIn')}</Link>
        </Button>
      </div>
    )
  }

  function handleTagKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault()
      const value = tagInput.trim().toLowerCase().replace(/,/g, '')
      if (value && !tags.includes(value) && tags.length < 6) {
        setTags([...tags, value])
        setTagInput('')
      }
    }
  }

  async function handleSubmit() {
    if (!title.trim() || !content.trim()) {
      toast.error(t('community.newPostPage.requiredFields'))
      return
    }

    setSubmitting(true)

    const { error } = await supabase.from('community_posts').insert({
      author_id: user!.id,
      type: postType,
      title: title.trim(),
      content: content.trim(),
      category: category || null,
      tags,
    })

    setSubmitting(false)

    if (error) {
      toast.error(error.message)
    } else {
      toast.success(t('community.newPostPage.published'))
      router.push('/marketplace/community')
    }
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">{t('community.newPostPage.title')}</h1>
        <p className="text-sm text-muted-foreground mt-1">{t('community.newPostPage.subtitle')}</p>
      </div>

      <div className="space-y-2">
        <Label>{t('community.newPostPage.typeLabel')}</Label>
        <div className="grid grid-cols-3 gap-3">
          {POST_TYPES.map(({ value, icon: Icon, color }) => (
            <button
              key={value}
              type="button"
              onClick={() => setPostType(value)}
              className={cn(
                'flex items-center gap-2 rounded-lg border-2 p-3 transition-all',
                postType === value ? color : 'border-border hover:border-muted-foreground/30'
              )}
            >
              <Icon className="h-5 w-5" />
              <span className="text-sm font-medium">
                {t(`community.postTypes.${value}`)}
              </span>
            </button>
          ))}
        </div>
      </div>

      <Card className="border-border">
        <CardHeader>
          <CardTitle className="text-lg">{t(`community.postTypes.${postType}`)}</CardTitle>
          <CardDescription>{t(`community.postTypeDesc.${postType}`)}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="title">{t('community.newPostPage.titleLabel')} *</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={t('community.newPostPage.titlePlaceholder')}
              className="bg-secondary border-border"
            />
          </div>

          <div className="space-y-2">
            <Label>{t('community.newPostPage.contentLabel')} *</Label>
            <MarkdownEditor
              value={content}
              onChange={setContent}
              placeholder={t('community.newPostPage.contentPlaceholder')}
              minHeight="250px"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>{t('community.newPostPage.categoryLabel')}</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger className="bg-secondary border-border">
                  <SelectValue placeholder={t('community.newPostPage.categoryPlaceholder')} />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((cat) => (
                    <SelectItem key={cat} value={cat}>
                      <span className="capitalize">{cat}</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>{t('community.newPostPage.tagsLabel')}</Label>
              <Input
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={handleTagKeyDown}
                placeholder={t('community.newPostPage.tagsPlaceholder')}
                className="bg-secondary border-border"
                disabled={tags.length >= 6}
              />
            </div>
          </div>

          {tags.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {tags.map((tag) => (
                <Badge
                  key={tag}
                  variant="secondary"
                  className="gap-1 cursor-pointer hover:bg-destructive/20"
                  onClick={() => setTags(tags.filter((t) => t !== tag))}
                >
                  {tag}
                  <X className="h-3 w-3" />
                </Badge>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex justify-end pb-8">
        <Button
          onClick={handleSubmit}
          disabled={submitting || !title.trim() || !content.trim()}
          size="lg"
        >
          <Send className="h-4 w-4 mr-2" />
          {submitting ? t('common.loading') : t('community.newPostPage.publish')}
        </Button>
      </div>
    </div>
  )
}
