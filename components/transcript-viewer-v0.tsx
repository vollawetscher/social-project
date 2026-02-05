'use client'

import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import type { TranscriptSegment } from '@/lib/types-v0'

interface TranscriptViewerProps {
  segments: TranscriptSegment[]
  currentTime?: number // Current audio playback time for highlighting
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

export function TranscriptViewer({ segments, currentTime = 0 }: TranscriptViewerProps) {
  if (!segments || segments.length === 0) {
    return (
      <div className="flex items-center justify-center h-full p-8">
        <p className="text-sm text-muted-foreground">No transcript available</p>
      </div>
    )
  }

  // Group speakers for consistent coloring
  const speakers = Array.from(new Set(segments.map(s => s.speakerName)))
  const getSpeakerColor = (speaker: string) => {
    const index = speakers.indexOf(speaker)
    return SPEAKER_COLORS[index % SPEAKER_COLORS.length]
  }

  return (
    <div className="h-full overflow-auto flex flex-col">
      {/* Header with Speaker Legend */}
      <div className="sticky top-0 bg-card border-b border-border px-4 py-3 z-10">
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
      </div>

      {/* Transcript Content */}
      <div className="flex-1 p-4 space-y-4">
        {segments.map((segment, index) => {
          const isActive = currentTime >= segment.startTime && 
                          (index === segments.length - 1 || currentTime < segments[index + 1].startTime)
          
          return (
            <div 
              key={index} 
              className={cn(
                "flex gap-3 group hover:bg-muted/50 -mx-2 px-2 py-2 rounded-md transition-colors",
                isActive && "bg-primary/10 border-l-2 border-primary"
              )}
            >
              {/* Timestamp */}
              <div className="text-xs text-muted-foreground font-mono pt-1 min-w-[60px] shrink-0 tabular-nums">
                {formatTimestamp(segment.startTime)}
              </div>
              
              {/* Content */}
              <div className="flex-1 min-w-0 space-y-1.5">
                {/* Speaker Badge */}
                <Badge 
                  variant="outline" 
                  className={cn("text-xs font-medium", getSpeakerColor(segment.speakerName))}
                >
                  {segment.speakerName}
                </Badge>
                
                {/* Text */}
                <p className="text-sm leading-relaxed text-foreground">
                  {segment.text}
                </p>
              </div>
            </div>
          )
        })}
        </div>
    </div>
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
