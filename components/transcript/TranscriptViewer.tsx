'use client'

import { TranscriptSegment } from '@/lib/types/database'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'

interface TranscriptViewerProps {
  segments: TranscriptSegment[]
  showRaw?: boolean
}

export function TranscriptViewer({ segments, showRaw = false }: TranscriptViewerProps) {
  const formatTimecode = (ms: number): string => {
    const totalSeconds = Math.floor(ms / 1000)
    const minutes = Math.floor(totalSeconds / 60)
    const seconds = totalSeconds % 60
    const hours = Math.floor(minutes / 60)
    const mins = minutes % 60

    if (hours > 0) {
      return `${hours}:${mins.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
    }
    return `${mins}:${seconds.toString().padStart(2, '0')}`
  }

  const getSpeakerColor = (speaker: string): string => {
    const colors: Record<string, string> = {
      S1: 'bg-blue-100 text-blue-800',
      S2: 'bg-green-100 text-green-800',
      S3: 'bg-purple-100 text-purple-800',
      S4: 'bg-orange-100 text-orange-800',
    }
    return colors[speaker] || 'bg-gray-100 text-gray-800'
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>Transkript</span>
          {!showRaw && (
            <Badge variant="secondary">PII-redaktiert (Beta)</Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[600px] pr-4">
          <div className="space-y-4">
            {segments.map((segment, index) => (
              <div key={index} className="flex gap-3">
                <div className="flex-shrink-0 w-16 text-sm text-slate-500 font-mono pt-1">
                  {formatTimecode(segment.start_ms)}
                </div>
                <div className="flex-shrink-0">
                  <Badge className={getSpeakerColor(segment.speaker)}>
                    {segment.speaker}
                  </Badge>
                </div>
                <div className="flex-1">
                  <p className="text-slate-900 leading-relaxed">
                    {segment.text}
                  </p>
                  {segment.confidence !== undefined && (
                    <p className="text-xs text-slate-400 mt-1">
                      Konfidenz: {(segment.confidence * 100).toFixed(0)}%
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  )
}
