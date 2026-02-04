"use client"

import { useState } from "react"
import { Search, Radio, Clock, Shield } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"
import type { TranscriptSegment } from "@/lib/types-v0"

interface TranscriptViewerProps {
  segments: TranscriptSegment[]
  isLiveMode?: boolean
}

function formatTimestamp(seconds: number): string {
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  return `${mins}:${secs.toString().padStart(2, "0")}`
}

export function TranscriptViewer({ segments, isLiveMode = false }: TranscriptViewerProps) {
  const [searchQuery, setSearchQuery] = useState("")
  const [liveMode, setLiveMode] = useState(isLiveMode)
  const [highlightedSegment, setHighlightedSegment] = useState<string | null>(null)

  const filteredSegments = segments.filter((segment) =>
    segment.text.toLowerCase().includes(searchQuery.toLowerCase())
  )

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex items-center justify-between p-4 border-b border-border">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Search transcript..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 bg-secondary border-border"
          />
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Switch
              id="live-mode"
              checked={liveMode}
              onCheckedChange={setLiveMode}
            />
            <Label htmlFor="live-mode" className="text-sm flex items-center gap-1.5">
              <Radio className={cn("h-3.5 w-3.5", liveMode && "text-success animate-pulse")} />
              Live Mode
            </Label>
          </div>
        </div>
      </div>

      {/* Live Mode Indicator */}
      {liveMode && (
        <div className="flex items-center gap-2 px-4 py-2 bg-success/10 border-b border-success/20">
          <div className="h-2 w-2 rounded-full bg-success animate-pulse" />
          <span className="text-xs text-success font-medium">
            Live transcription active - streaming from Speechmatics
          </span>
        </div>
      )}

      {/* Transcript Content */}
      <div className="flex-1 overflow-auto p-4 space-y-4">
        {filteredSegments.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            {searchQuery ? "No matching segments found" : "No transcript available"}
          </div>
        ) : (
          filteredSegments.map((segment) => (
            <div
              key={segment.id}
              className={cn(
                "group flex gap-3 p-3 rounded-lg transition-colors cursor-pointer",
                highlightedSegment === segment.id
                  ? "bg-accent"
                  : "hover:bg-secondary/50"
              )}
              onClick={() => setHighlightedSegment(segment.id === highlightedSegment ? null : segment.id)}
            >
              {/* Timestamp */}
              <div className="flex flex-col items-center gap-1 min-w-[60px]">
                <button
                  className="text-xs font-mono text-muted-foreground hover:text-foreground flex items-center gap-1"
                  title="Jump to timestamp"
                >
                  <Clock className="h-3 w-3" />
                  {formatTimestamp(segment.startTime)}
                </button>
              </div>

              {/* Content */}
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-sm font-medium text-foreground">
                    {segment.speakerName}
                  </span>
                  {segment.isPiiRedacted && (
                    <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4">
                      <Shield className="h-2.5 w-2.5 mr-1" />
                      Redacted
                    </Badge>
                  )}
                </div>
                <p className="text-sm text-foreground/90 leading-relaxed">
                  {segment.text}
                </p>
              </div>
            </div>
          ))
        )}

        {/* Streaming indicator for live mode */}
        {liveMode && (
          <div className="flex gap-3 p-3">
            <div className="min-w-[60px]" />
            <div className="flex items-center gap-2 text-muted-foreground">
              <div className="flex gap-1">
                <div className="h-2 w-2 rounded-full bg-muted-foreground animate-bounce" style={{ animationDelay: "0ms" }} />
                <div className="h-2 w-2 rounded-full bg-muted-foreground animate-bounce" style={{ animationDelay: "150ms" }} />
                <div className="h-2 w-2 rounded-full bg-muted-foreground animate-bounce" style={{ animationDelay: "300ms" }} />
              </div>
              <span className="text-xs">Listening...</span>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
