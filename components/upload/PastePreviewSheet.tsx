'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
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
import { FileText, Loader2, Shuffle, Upload, Replace } from 'lucide-react'
import { detectTranscriptType, type TranscriptIngestionSource } from '@/lib/utils/transcript-type-detection'
import { parseTranscriptFile, type ParseResult, type TranscriptParseStrategy } from '@/lib/utils/transcript-parser'

type EditSuggestion = { find: string; replace: string; count: number }

function detectEditPropagation(oldText: string, newText: string): EditSuggestion | null {
  if (oldText === newText) return null

  let i = 0
  while (i < oldText.length && i < newText.length && oldText[i] === newText[i]) i++

  let j = 0
  while (
    j < oldText.length - i &&
    j < newText.length - i &&
    oldText[oldText.length - 1 - j] === newText[newText.length - 1 - j]
  ) j++

  const removed = oldText.slice(i, oldText.length - j)
  const added = newText.slice(i, newText.length - j)

  if (removed.length > 40 || added.length > 40) return null
  if (!removed && !added) return null

  // Expand to word boundaries around the changed region
  let ls = i
  while (ls > 0 && !/[\s\n]/.test(oldText[ls - 1])) ls--
  let re = oldText.length - j
  while (re < oldText.length && !/[\s\n]/.test(oldText[re])) re++

  let lsNew = i
  while (lsNew > 0 && !/[\s\n]/.test(newText[lsNew - 1])) lsNew--
  let reNew = newText.length - j
  while (reNew < newText.length && !/[\s\n]/.test(newText[reNew])) reNew++

  const find = oldText.slice(ls, re).trim()
  const replace = newText.slice(lsNew, reNew).trim()

  if (!find || find.length < 2 || find === replace) return null

  let count = 0
  let pos = 0
  while ((pos = newText.indexOf(find, pos)) !== -1) {
    count++
    pos += find.length
  }

  if (count < 1) return null
  return { find, replace, count }
}

interface PastePreviewSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  initialText: string
  ingestionSource?: TranscriptIngestionSource
  fileName?: string | null
  templates?: Array<{ id: string; name: string }>
  onConfirm: (text: string, strategy: TranscriptParseStrategy, templateId?: string) => void
  loading?: boolean
}

export function PastePreviewSheet({
  open,
  onOpenChange,
  initialText,
  ingestionSource = 'unknown',
  fileName = null,
  templates = [],
  onConfirm,
  loading = false,
}: PastePreviewSheetProps) {
  const t = useTranslations('pastePreview')
  const [text, setText] = useState(initialText)
  const [modeIndex, setModeIndex] = useState(0)
  const [selectedTemplateId, setSelectedTemplateId] = useState('')
  const [editSuggestion, setEditSuggestion] = useState<EditSuggestion | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const prevTextRef = useRef(initialText)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const parseModes: TranscriptParseStrategy[] = ['auto', 'sprecher_zeit', 'timestamped_speaker_lines', 'plain_txt', 'raw_text']

  useEffect(() => {
    if (open) {
      setText(initialText)
      setModeIndex(0)
      setSelectedTemplateId('')
      setEditSuggestion(null)
      prevTextRef.current = initialText
    }
  }, [open, initialText])

  const handleTextChange = useCallback((newText: string) => {
    setText(newText)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      const suggestion = detectEditPropagation(prevTextRef.current, newText)
      setEditSuggestion(suggestion)
    }, 600)
  }, [])

  const applyEditToAll = useCallback(() => {
    if (!editSuggestion) return
    const updated = text.split(editSuggestion.find).join(editSuggestion.replace)
    setText(updated)
    prevTextRef.current = updated
    setEditSuggestion(null)
  }, [editSuggestion, text])

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
    speaker_timestamp_lines: t('parseModes.speakerTimestampLines'),
    plain_txt: t('parseModes.plainText'),
    raw_text: t('parseModes.rawText'),
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
    setEditSuggestion(null)
    if (nextMode === 'raw_text') {
      setText(initialText)
      prevTextRef.current = initialText
      setModeIndex(next)
      return
    }
    const parsed = parseTranscriptFile(initialText, fileName || 'pasted.txt', { strategy: nextMode })
    const newText = toPreviewText(parsed) || initialText
    setText(newText)
    prevTextRef.current = newText
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
          {editSuggestion && (
            <div className="mb-2 flex items-center gap-2 rounded-md border border-primary/30 bg-primary/5 px-3 py-2">
              <Replace className="h-4 w-4 shrink-0 text-primary" />
              <span className="flex-1 text-xs text-foreground">
                <span className="font-mono line-through opacity-60">{editSuggestion.find}</span>
                {' → '}
                <span className="font-mono font-medium">{editSuggestion.replace || t('editPropagate.empty')}</span>
                {' · '}
                {t('editPropagate.remaining', { count: editSuggestion.count })}
              </span>
              <Button
                size="sm"
                variant="outline"
                className="h-7 text-xs"
                onClick={applyEditToAll}
              >
                {t('editPropagate.applyAll')}
              </Button>
              <button
                className="text-muted-foreground hover:text-foreground text-xs"
                onClick={() => { setEditSuggestion(null); prevTextRef.current = text }}
              >
                ✕
              </button>
            </div>
          )}
          <Textarea
            ref={textareaRef}
            value={text}
            onChange={(e) => handleTextChange(e.target.value)}
            className="h-full min-h-[200px] resize-none font-mono text-sm"
            disabled={loading}
          />
        </div>
        <div className="text-xs text-muted-foreground pb-2">
          {t('stats', { words: wordCount.toLocaleString(), characters: charCount.toLocaleString() })}
        </div>
        <div className="pb-3">
          <label htmlFor="preview-template-select" className="mb-1 block text-xs font-medium text-foreground">
            {t('templateLabel')}
          </label>
          <select
            id="preview-template-select"
            value={selectedTemplateId}
            onChange={(e) => setSelectedTemplateId(e.target.value)}
            disabled={loading}
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
          >
            <option value="">{t('templateNone')}</option>
            {templates.map((template) => (
              <option key={template.id} value={template.id}>
                {template.name}
              </option>
            ))}
          </select>
        </div>
        <SheetFooter className="border-t pt-4">
          <Button
            variant="secondary"
            onClick={handleTryNextParse}
            disabled={loading || !!selectedTemplateId}
            title={`${t('tryNextParse')} (${modeLabelMap[parseModes[modeIndex]]})`}
            className="max-w-[180px] text-foreground bg-muted hover:bg-muted/80 border border-border whitespace-nowrap overflow-hidden text-ellipsis"
          >
            <Shuffle className="h-4 w-4 mr-2" />
            {t('tryNextParse')}
          </Button>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            {t('cancel')}
          </Button>
          <Button
            onClick={() => onConfirm(trimmed, parseModes[modeIndex], selectedTemplateId || undefined)}
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
                {selectedTemplateId ? t('importAndGenerate') : t('import')}
              </>
            )}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
