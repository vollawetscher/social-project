'use client'

import { useState, useEffect, useRef } from 'react'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from '@/components/ui/sheet'
import { FileText, Loader2, Upload } from 'lucide-react'
import { detectTranscriptType, type TranscriptIngestionSource } from '@/lib/utils/transcript-type-detection'

interface PastePreviewSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  initialText: string
  ingestionSource?: TranscriptIngestionSource
  fileName?: string | null
  onConfirm: (text: string) => void
  loading?: boolean
}

export function PastePreviewSheet({
  open,
  onOpenChange,
  initialText,
  ingestionSource = 'unknown',
  fileName = null,
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
  const signals = detectTranscriptType({
    text: trimmed,
    filename: fileName || undefined,
    ingestionSource,
  })

  const typeLabelMap: Record<string, string> = {
    speaker_turns: t('detection.types.speakerTurns'),
    timestamped_speaker_turns: t('detection.types.timestampedSpeakerTurns'),
    subtitle_like: t('detection.types.subtitleLike'),
    chat_export: t('detection.types.chatExport'),
    non_transcript_note: t('detection.types.nonTranscriptNote'),
    mixed_or_unknown: t('detection.types.mixedOrUnknown'),
  }

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
          <div className="mb-3 rounded-md border bg-muted/30 p-3">
            <div className="mb-1 flex items-center gap-2">
              <Badge variant={signals.contentKind === 'transcript' ? 'default' : signals.contentKind === 'non_transcript' ? 'destructive' : 'secondary'}>
                {signals.contentKind === 'transcript'
                  ? t('detection.kindTranscript')
                  : signals.contentKind === 'non_transcript'
                    ? t('detection.kindNonTranscript')
                    : t('detection.kindMixed')}
              </Badge>
              <span className="text-xs text-muted-foreground">
                {t('detection.confidence', { percent: Math.round(signals.confidence * 100) })}
              </span>
            </div>
            <p className="text-xs text-foreground">
              {t('detection.detectedType')}: {typeLabelMap[signals.detectedType] || signals.detectedType}
            </p>
          </div>
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
