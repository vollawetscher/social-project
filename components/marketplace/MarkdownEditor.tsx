'use client'

import { useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { useTranslations } from 'next-intl'

interface MarkdownEditorProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  minHeight?: string
}

export function MarkdownEditor({ value, onChange, placeholder, minHeight = '200px' }: MarkdownEditorProps) {
  const [tab, setTab] = useState<'write' | 'preview'>('write')
  const t = useTranslations('marketplace')

  return (
    <div className="space-y-2">
      <div className="flex gap-1 border-b border-border">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => setTab('write')}
          className={cn(
            'rounded-none border-b-2 border-transparent',
            tab === 'write' && 'border-primary text-foreground'
          )}
        >
          {t('community.newPostPage.write')}
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => setTab('preview')}
          className={cn(
            'rounded-none border-b-2 border-transparent',
            tab === 'preview' && 'border-primary text-foreground'
          )}
        >
          {t('community.newPostPage.preview')}
        </Button>
      </div>

      {tab === 'write' ? (
        <Textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="bg-secondary border-border font-mono text-sm"
          style={{ minHeight }}
        />
      ) : (
        <div
          className="prose prose-sm dark:prose-invert max-w-none p-3 rounded-md border border-border bg-secondary"
          style={{ minHeight }}
        >
          {value ? (
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{value}</ReactMarkdown>
          ) : (
            <p className="text-muted-foreground italic">Nothing to preview</p>
          )}
        </div>
      )}
    </div>
  )
}
