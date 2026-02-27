'use client'

import { useState, useEffect, useRef } from 'react'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from '@/components/ui/sheet'
import { FileText, Loader2, Upload } from 'lucide-react'

interface PastePreviewSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  initialText: string
  onConfirm: (text: string) => void
  loading?: boolean
}

export function PastePreviewSheet({
  open,
  onOpenChange,
  initialText,
  onConfirm,
  loading = false,
}: PastePreviewSheetProps) {
  const t = useTranslations('pastePreview')
  const [text, setText] = useState(initialText)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (open) setText(initialText)
  }, [open, initialText])

  useEffect(() => {
    if (open && textareaRef.current) {
      textareaRef.current.focus()
      textareaRef.current.scrollTop = 0
    }
  }, [open])

  const trimmed = text.trim()
  const wordCount = trimmed ? trimmed.split(/\s+/).length : 0
  const charCount = trimmed.length

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex flex-col w-full sm:max-w-lg">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            {t('title')}
          </SheetTitle>
          <SheetDescription>
            {t('description')}
          </SheetDescription>
        </SheetHeader>
        <div className="flex-1 overflow-hidden py-4">
          <Textarea
            ref={textareaRef}
            value={text}
            onChange={(e) => setText(e.target.value)}
            className="h-full min-h-[200px] resize-none font-mono text-sm"
            disabled={loading}
          />
        </div>
        <div className="text-xs text-muted-foreground pb-2">
          {t('stats', { words: wordCount.toLocaleString(), characters: charCount.toLocaleString() })}
        </div>
        <SheetFooter className="border-t pt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            {t('cancel')}
          </Button>
          <Button
            onClick={() => onConfirm(trimmed)}
            disabled={loading || charCount < 10}
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                {t('importing')}
              </>
            ) : (
              <>
                <Upload className="h-4 w-4 mr-2" />
                {t('import')}
              </>
            )}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
