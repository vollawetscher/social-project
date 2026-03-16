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
import { FileText, Loader2, Shuffle, Upload } from 'lucide-react'
import { detectTranscriptType, type TranscriptIngestionSource } from '@/lib/utils/transcript-type-detection'
import { parseTranscriptFile, type ParseResult, type TranscriptParseStrategy } from '@/lib/utils/transcript-parser'

interface PastePreviewSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  initialText: string
  ingestionSource?: TranscriptIngestionSource
  fileName?: string | null
  onConfirm: (text: string, strategy: TranscriptParseStrategy) => void
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
  const [modeIndex, setModeIndex] = useState(0)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const parseModes: TranscriptParseStrategy[] = ['auto', 'sprecher_zeit', 'timestamped_speaker_lines', 'plain_txt']

  useEffect(() => {
    if (open) {
      setText(initialText)
      setModeIndex(0)
    }
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

  const modeLabelMap: Record<TranscriptParseStrategy, string> = {
    auto: t('parseModes.auto'),
    sprecher_zeit: t('parseModes.sprecherZeit'),
    timestamped_speaker_lines: t('parseModes.timestampedSpeakerLines'),
    plain_txt: t('parseModes.plainText'),
  }

  const toPreviewText = (result: ParseResult) => {
    const formatMs = (ms: number) => {
      const totalSec = Math.max(0, Math.floor(ms / 1000))
      const min = Math.floor(totalSec / 60)
      const sec = totalSec % 60
      return `${String(min).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
    }
    return result.segments
      .map((seg) => `[${formatMs(seg.start_ms)}] ${seg.speaker}: ${seg.text}`)
      .join('\n')
      .trim()
  }

  const handleTryNextParse = () => {
    const next = (modeIndex + 1) % parseModes.length
    const nextMode = parseModes[next]
    const parsed = parseTranscriptFile(initialText, fileName || 'pasted.txt', { strategy: nextMode })
    setText(toPreviewText(parsed) || initialText)
    setModeIndex(next)
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
          <Button variant="secondary" onClick={handleTryNextParse} disabled={loading}>
            <Shuffle className="h-4 w-4 mr-2" />
            {t('tryNextParse')} ({modeLabelMap[parseModes[modeIndex]]})
          </Button>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            {t('cancel')}
          </Button>
          <Button
            onClick={() => onConfirm(trimmed, parseModes[modeIndex])}
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
