'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { applyTranscriptCorrections } from '@/lib/utils/transcript-corrections'
import type { TranscriptSegment, TranscriptCorrections } from '@/lib/types-v0'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Input } from '@/components/ui/input'
import { Check, Pencil, StickyNote } from 'lucide-react'
import { useTranslations } from 'next-intl'

interface TranscriptViewerProps {
  segments: TranscriptSegment[]
  currentTime?: number
  onSeek?: (time: number) => void
  corrections?: TranscriptCorrections
  onTogglePlayback?: () => void
  isPlaying?: boolean
  onSpeakerChange?: (segmentIndex: number, newSpeaker: string) => void
}

const SPEAKER_COLORS = [
  'bg-blue-500/20 text-blue-700 border-blue-500/30 dark:bg-blue-500/20 dark:text-blue-300 dark:border-blue-500/30',
  'bg-green-500/20 text-green-700 border-green-500/30 dark:bg-green-500/20 dark:text-green-300 dark:border-green-500/30',
  'bg-purple-500/20 text-purple-700 border-purple-500/30 dark:bg-purple-500/20 dark:text-purple-300 dark:border-purple-500/30',
  'bg-orange-500/20 text-orange-700 border-orange-500/30 dark:bg-orange-500/20 dark:text-orange-300 dark:border-orange-500/30',
  'bg-pink-500/20 text-pink-700 border-pink-500/30 dark:bg-pink-500/20 dark:text-pink-300 dark:border-pink-500/30',
  'bg-cyan-500/20 text-cyan-700 border-cyan-500/30 dark:bg-cyan-500/20 dark:text-cyan-300 dark:border-cyan-500/30',
]

function SpeakerBadge({
  displayName,
  originalName,
  isOverridden,
  colorClass,
  allSpeakers,
  editable,
  onSelect,
}: {
  displayName: string
  originalName: string
  isOverridden: boolean
  colorClass: string
  allSpeakers: string[]
  editable: boolean
  onSelect: (name: string) => void
}) {
  const [open, setOpen] = useState(false)
  const [customName, setCustomName] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (open) {
      setCustomName('')
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }, [open])

  const handleSelect = useCallback((name: string) => {
    onSelect(name)
    setOpen(false)
  }, [onSelect])

  const handleCustomSubmit = useCallback(() => {
    const trimmed = customName.trim()
    if (trimmed) {
      onSelect(trimmed)
      setOpen(false)
    }
  }, [customName, onSelect])

  if (!editable) {
    if (isOverridden) {
      return (
        <Tooltip>
          <TooltipTrigger>
            <Badge variant="outline" className={cn("text-xs font-medium", colorClass)}>
              {displayName} <Pencil className="ml-1 h-2.5 w-2.5 inline" />
            </Badge>
          </TooltipTrigger>
          <TooltipContent>
            <p className="text-xs">Original: {originalName}</p>
          </TooltipContent>
        </Tooltip>
      )
    }
    return (
      <Badge variant="outline" className={cn("text-xs font-medium", colorClass)}>
        {displayName}
      </Badge>
    )
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        className="inline-flex border-0 bg-transparent p-0 outline-none"
        title={isOverridden ? `Original: ${originalName}` : undefined}
      >
        <Badge
          variant="outline"
          className={cn(
            "text-xs font-medium cursor-pointer hover:ring-1 hover:ring-primary/50 transition-shadow",
            colorClass,
          )}
        >
          {displayName}
          {isOverridden && <Pencil className="ml-1 h-2.5 w-2.5 inline" />}
        </Badge>
      </PopoverTrigger>
      <PopoverContent
        className="w-52 p-2"
        align="start"
      >
        <div className="space-y-1">
          <p className="text-[11px] font-medium text-muted-foreground px-1 pb-1">Assign speaker</p>
          {allSpeakers.map((speaker) => (
            <button
              key={speaker}
              type="button"
              className={cn(
                "flex items-center gap-2 w-full rounded-md px-2 py-1.5 text-sm text-left hover:bg-accent transition-colors",
                speaker === displayName && "bg-accent font-medium",
              )}
              onClick={() => handleSelect(speaker)}
            >
              <span className="flex-1 truncate">{speaker}</span>
              {speaker === displayName && <Check className="h-3.5 w-3.5 text-primary shrink-0" />}
            </button>
          ))}
          <div className="border-t border-border pt-1.5 mt-1.5">
            <form
              onSubmit={(e) => { e.preventDefault(); handleCustomSubmit() }}
              className="flex gap-1"
            >
              <Input
                ref={inputRef}
                value={customName}
                onChange={(e) => setCustomName(e.target.value)}
                placeholder="New name…"
                className="h-7 text-xs"
              />
              <button
                type="submit"
                disabled={!customName.trim()}
                className="shrink-0 rounded-md px-2 h-7 text-xs bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
              >
                OK
              </button>
            </form>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}

export function TranscriptViewer({ segments, currentTime = 0, onSeek, corrections, onTogglePlayback, isPlaying = false, onSpeakerChange }: TranscriptViewerProps) {
  const t = useTranslations('sessionDetail')

  if (!segments || segments.length === 0) {
    return (
      <div className="flex items-center justify-center h-full p-8">
        <p className="text-sm text-muted-foreground">No transcript available</p>
      </div>
    )
  }

  const speakerNameMap: Record<string, string> = {
    ...(corrections?.speaker_name_map || {}),
    ...(corrections?.name_corrections || {}),
  }
  const speakerMergeMap = corrections?.speaker_merge_map || {}
  const segmentSpeakerOverrides = corrections?.segment_speaker_overrides || {}

  const resolveMergedSpeakerId = (speakerId: string): string => {
    let current = String(speakerId || '').trim()
    const visited = new Set<string>()
    while (current && speakerMergeMap[current] && !visited.has(current)) {
      visited.add(current)
      const next = String(speakerMergeMap[current] || '').trim()
      if (!next || next === current) break
      current = next
    }
    return current || String(speakerId || '').trim()
  }

  const normalizedWordCorrections: Record<string, string> = (() => {
    const raw = corrections?.word_corrections
    if (Array.isArray(raw)) {
      const map: Record<string, string> = {}
      for (const item of raw) {
        if (item && typeof item === 'object' && 'original' in item && 'corrected' in item) {
          map[String((item as Record<string, unknown>).original)] = String((item as Record<string, unknown>).corrected)
        }
      }
      return map
    }
    if (raw && typeof raw === 'object') {
      const map: Record<string, string> = {}
      for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
        if (typeof v === 'string') map[k] = v
      }
      return map
    }
    return {}
  })()

  const allCorrections: Record<string, string> = {
    ...speakerNameMap,
    ...(corrections?.pii_redactions || {}),
    ...normalizedWordCorrections,
  }

  const applyCorrections = (text: string): { text: string; hasCorrections: boolean; original: string[] } => {
    const originalTerms: string[] = []
    Object.keys(allCorrections).forEach((original) => {
      if (text.includes(original)) originalTerms.push(original)
    })
    const correctedText = applyTranscriptCorrections(text, allCorrections)
    return {
      text: correctedText,
      hasCorrections: originalTerms.length > 0,
      original: originalTerms
    }
  }

  // Resolve display name for each segment, respecting per-segment overrides first
  const resolveSegmentSpeaker = (segment: TranscriptSegment, index: number): { display: string; original: string; isOverridden: boolean } => {
    const override = segmentSpeakerOverrides[String(index)]
    if (override) {
      return { display: override, original: segment.speakerName, isOverridden: true }
    }
    const mergedSpeakerId = resolveMergedSpeakerId(segment.speakerId || segment.speakerName)
    const display = speakerNameMap[mergedSpeakerId] || allCorrections[segment.speakerName] || mergedSpeakerId || segment.speakerName
    const isOverridden = display !== segment.speakerName
    return { display, original: segment.speakerName, isOverridden }
  }

  // Build unique speaker list from resolved names (speech only — not in-call notes)
  const speechSegments = segments.filter((segment) => !segment.isCallNote)
  const speakers = Array.from(
    new Set(speechSegments.map((s, i) => {
      const originalIndex = segments.indexOf(s)
      return resolveSegmentSpeaker(s, originalIndex).display
    }))
  )
  const getSpeakerColor = (speaker: string) => {
    const index = speakers.indexOf(speaker)
    return SPEAKER_COLORS[index % SPEAKER_COLORS.length]
  }

  const correctionCount = Object.keys(allCorrections).length + Object.keys(segmentSpeakerOverrides).length
  const hasPiiRedactions = corrections?.pii_redactions && Object.keys(corrections.pii_redactions).length > 0

  return (
    <TooltipProvider>
      <div className="h-full overflow-auto flex flex-col">
        {/* Header with Speaker Legend */}
        <div className="sticky top-0 bg-card border-b border-border px-4 py-3 z-10">
          <div className="flex items-center gap-2 flex-wrap justify-between">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-medium text-muted-foreground">Speakers:</span>
              {speakers.map((speaker) => (
                <Badge 
                  key={speaker} 
                  variant="outline" 
                  className={cn("text-xs font-medium", getSpeakerColor(speaker))}
                >
                  {speaker}
                </Badge>
              ))}
            </div>
            {correctionCount > 0 && (
              <Tooltip>
                <TooltipTrigger>
                  <Badge variant="secondary" className="text-xs">
                    ✏️ {correctionCount} correction{correctionCount > 1 ? 's' : ''}
                    {hasPiiRedactions && ' + PII'}
                  </Badge>
                </TooltipTrigger>
                <TooltipContent>
                  <div className="text-xs space-y-1">
                    {corrections?.name_corrections && Object.keys(corrections.name_corrections).length > 0 && (
                      <p><strong>Name corrections:</strong> {Object.keys(corrections.name_corrections).length}</p>
                    )}
                    {Object.keys(segmentSpeakerOverrides).length > 0 && (
                      <p><strong>Speaker overrides:</strong> {Object.keys(segmentSpeakerOverrides).length} segments</p>
                    )}
                    {corrections?.pii_redactions && Object.keys(corrections.pii_redactions).length > 0 && (
                      <p><strong>PII redactions:</strong> {Object.keys(corrections.pii_redactions).length}</p>
                    )}
                    {Object.keys(normalizedWordCorrections).length > 0 && (
                      <p><strong>Word corrections:</strong> {Object.keys(normalizedWordCorrections).length}</p>
                    )}
                  </div>
                </TooltipContent>
              </Tooltip>
            )}
          </div>
        </div>

        {/* Transcript Content */}
        <div className="flex-1 p-4 space-y-4">
          {segments.map((segment, index) => {
            const isActive = currentTime >= segment.startTime && 
                            (index === segments.length - 1 || currentTime < segments[index + 1].startTime)
            
            const { display: correctedSpeaker, original: originalSpeaker, isOverridden: speakerOverridden } = resolveSegmentSpeaker(segment, index)
            const { text: correctedText, hasCorrections, original } = applyCorrections(segment.text)
            
            const handleSeekOrToggle = onSeek ? () => {
              if (isActive && isPlaying && onTogglePlayback) {
                onTogglePlayback()
              } else {
                onSeek(segment.startTime)
              }
            } : undefined

            if (segment.isCallNote) {
              const author = segment.noteAuthorName || correctedSpeaker || t('sessionOwner')
              return (
                <div
                  key={index}
                  className={cn(
                    "flex gap-3 -mx-2 px-3 py-3 rounded-lg border border-dashed border-amber-500/35 bg-amber-500/5",
                    isActive && "ring-1 ring-amber-500/40",
                  )}
                >
                  <div
                    className={cn(
                      "text-xs text-muted-foreground font-mono pt-0.5 min-w-[60px] shrink-0 tabular-nums",
                      onSeek && "cursor-pointer hover:text-primary transition-colors"
                    )}
                    onClick={handleSeekOrToggle}
                    role={onSeek ? "button" : undefined}
                    tabIndex={onSeek ? 0 : undefined}
                  >
                    {formatTimestamp(segment.startTime)}
                  </div>
                  <div className="flex-1 min-w-0 space-y-1.5">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge
                        variant="outline"
                        className="text-xs font-medium bg-amber-500/10 text-amber-800 border-amber-500/30 dark:text-amber-200"
                      >
                        <StickyNote className="h-3 w-3 mr-1" />
                        {t('inCallNote')}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {t('inCallNoteTypedBy', { author })}
                      </span>
                    </div>
                    <p className="text-sm leading-relaxed text-foreground whitespace-pre-wrap">
                      {hasCorrections ? correctedText : segment.text}
                    </p>
                  </div>
                </div>
              )
            }

            return (
              <div 
                key={index} 
                className={cn(
                  "flex gap-3 group hover:bg-muted/50 -mx-2 px-2 py-2 rounded-md transition-colors",
                  isActive && "bg-primary/10 border-l-2 border-primary",
                )}
              >
                {/* Timestamp */}
                <div
                  className={cn(
                    "text-xs text-muted-foreground font-mono pt-1 min-w-[60px] shrink-0 tabular-nums",
                    onSeek && "cursor-pointer group-hover:text-primary transition-colors"
                  )}
                  onClick={handleSeekOrToggle}
                  role={onSeek ? "button" : undefined}
                  tabIndex={onSeek ? 0 : undefined}
                >
                  {formatTimestamp(segment.startTime)}
                </div>
                
                {/* Content */}
                <div className="flex-1 min-w-0 space-y-1.5">
                  <SpeakerBadge
                    displayName={correctedSpeaker}
                    originalName={originalSpeaker}
                    isOverridden={speakerOverridden}
                    colorClass={getSpeakerColor(correctedSpeaker)}
                    allSpeakers={speakers}
                    editable={!!onSpeakerChange}
                    onSelect={(name) => onSpeakerChange?.(index, name)}
                  />
                  
                  {/* Text — click to seek/toggle audio */}
                  <div
                    className={cn(onSeek && "cursor-pointer")}
                    onClick={handleSeekOrToggle}
                    role={onSeek ? "button" : undefined}
                    tabIndex={onSeek ? -1 : undefined}
                  >
                    {hasCorrections ? (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <p className="text-sm leading-relaxed text-foreground cursor-help">
                            {correctedText}
                          </p>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p className="text-xs">
                            <strong>Corrections applied:</strong>
                            {original.map((term, i) => (
                              <span key={i} className="block">
                                {term} → {allCorrections[term]}
                              </span>
                            ))}
                          </p>
                        </TooltipContent>
                      </Tooltip>
                    ) : (
                      <p className="text-sm leading-relaxed text-foreground">
                        {segment.text}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </TooltipProvider>
  )
}

function formatTimestamp(seconds: number): string {
  const hrs = Math.floor(seconds / 3600)
  const mins = Math.floor((seconds % 3600) / 60)
  const secs = Math.floor(seconds % 60)
  
  if (hrs > 0) {
    return `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }
  return `${mins}:${secs.toString().padStart(2, '0')}`
}
