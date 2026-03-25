'use client'

import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { applyTranscriptCorrections } from '@/lib/utils/transcript-corrections'
import type { TranscriptSegment, TranscriptCorrections } from '@/lib/types-v0'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'

interface TranscriptViewerProps {
  segments: TranscriptSegment[]
  currentTime?: number // Current audio playback time for highlighting
  onSeek?: (time: number) => void // Callback when user clicks on a timestamp
  corrections?: TranscriptCorrections // Alias system for name corrections and PII redaction
  onTogglePlayback?: () => void // Callback to toggle play/pause
  isPlaying?: boolean // Current playback state
}

// Speaker colors for visual distinction
const SPEAKER_COLORS = [
  'bg-blue-500/20 text-blue-700 border-blue-500/30 dark:bg-blue-500/20 dark:text-blue-300 dark:border-blue-500/30',
  'bg-green-500/20 text-green-700 border-green-500/30 dark:bg-green-500/20 dark:text-green-300 dark:border-green-500/30',
  'bg-purple-500/20 text-purple-700 border-purple-500/30 dark:bg-purple-500/20 dark:text-purple-300 dark:border-purple-500/30',
  'bg-orange-500/20 text-orange-700 border-orange-500/30 dark:bg-orange-500/20 dark:text-orange-300 dark:border-orange-500/30',
  'bg-pink-500/20 text-pink-700 border-pink-500/30 dark:bg-pink-500/20 dark:text-pink-300 dark:border-pink-500/30',
  'bg-cyan-500/20 text-cyan-700 border-cyan-500/30 dark:bg-cyan-500/20 dark:text-cyan-300 dark:border-cyan-500/30',
]

export function TranscriptViewer({ segments, currentTime = 0, onSeek, corrections, onTogglePlayback, isPlaying = false }: TranscriptViewerProps) {
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

  // Combine all corrections (name corrections + PII redactions + word corrections)
  const allCorrections: Record<string, string> = {
    ...speakerNameMap,
    ...(corrections?.pii_redactions || {}),
    ...(corrections?.word_corrections || {})
  }

  // Apply corrections to text (uses utility for correct ordering: longer phrases first)
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

  // Group speakers for consistent coloring (apply corrections to speaker names)
  const speakers = Array.from(
    new Set(
      segments.map((s) => {
        const merged = resolveMergedSpeakerId(s.speakerId || s.speakerName)
        return speakerNameMap[merged] || allCorrections[s.speakerName] || merged || s.speakerName
      })
    )
  )
  const getSpeakerColor = (speaker: string) => {
    const index = speakers.indexOf(speaker)
    return SPEAKER_COLORS[index % SPEAKER_COLORS.length]
  }

  // Count total corrections
  const correctionCount = Object.keys(allCorrections).length
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
                    {corrections?.pii_redactions && Object.keys(corrections.pii_redactions).length > 0 && (
                      <p><strong>PII redactions:</strong> {Object.keys(corrections.pii_redactions).length}</p>
                    )}
                    {corrections?.word_corrections && Object.keys(corrections.word_corrections).length > 0 && (
                      <p><strong>Word corrections:</strong> {Object.keys(corrections.word_corrections).length}</p>
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
            
            // Apply corrections to speaker name and text
            const mergedSpeakerId = resolveMergedSpeakerId(segment.speakerId || segment.speakerName)
            const correctedSpeaker = speakerNameMap[mergedSpeakerId] || allCorrections[segment.speakerName] || mergedSpeakerId || segment.speakerName
            const { text: correctedText, hasCorrections, original } = applyCorrections(segment.text)
            
            return (
              <div 
                key={index} 
                className={cn(
                  "flex gap-3 group hover:bg-muted/50 -mx-2 px-2 py-2 rounded-md transition-colors",
                  isActive && "bg-primary/10 border-l-2 border-primary",
                  onSeek && "cursor-pointer"
                )}
                onClick={() => {
                  // If clicking the currently active segment and audio is playing, pause
                  if (isActive && isPlaying && onTogglePlayback) {
                    onTogglePlayback()
                  } else if (onSeek) {
                    // Otherwise, seek to this segment
                    onSeek(segment.startTime)
                  }
                }}
                role={onSeek ? "button" : undefined}
                tabIndex={onSeek ? 0 : undefined}
              >
                {/* Timestamp */}
                <div className={cn(
                  "text-xs text-muted-foreground font-mono pt-1 min-w-[60px] shrink-0 tabular-nums",
                  onSeek && "group-hover:text-primary transition-colors"
                )}>
                  {formatTimestamp(segment.startTime)}
                </div>
                
                {/* Content */}
                <div className="flex-1 min-w-0 space-y-1.5">
                  {/* Speaker Badge */}
                  {(speakerNameMap[mergedSpeakerId] || allCorrections[segment.speakerName]) ? (
                    <Tooltip>
                      <TooltipTrigger>
                        <Badge 
                          variant="outline" 
                          className={cn("text-xs font-medium", getSpeakerColor(correctedSpeaker))}
                        >
                          {correctedSpeaker} <span className="ml-1 text-[10px]">✏️</span>
                        </Badge>
                      </TooltipTrigger>
                      <TooltipContent>
                          <p className="text-xs">Original: {segment.speakerName}</p>
                      </TooltipContent>
                    </Tooltip>
                  ) : (
                    <Badge 
                      variant="outline" 
                      className={cn("text-xs font-medium", getSpeakerColor(segment.speakerName))}
                    >
                      {segment.speakerName}
                    </Badge>
                  )}
                  
                  {/* Text */}
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
