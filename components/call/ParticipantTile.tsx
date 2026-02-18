"use client"

import { MicOff, MonitorUp } from "lucide-react"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { cn } from "@/lib/utils"
import type { VideoParticipant } from "@/lib/types/call"

interface ParticipantTileProps {
  participant: VideoParticipant
  large?: boolean
  small?: boolean
  onClick?: () => void
}

export function ParticipantTile({ participant, large, small, onClick }: ParticipantTileProps) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "relative rounded-xl overflow-hidden w-full h-full flex items-center justify-center transition-all",
        participant.hasVideo ? "bg-[#222]" : "bg-[#1a1a1a]",
        participant.isSpeaking && "ring-2 ring-primary",
        !small && "hover:ring-2 hover:ring-white/20"
      )}
    >
      {participant.hasVideo ? (
        <div className="absolute inset-0 flex items-center justify-center bg-[#222]">
          <span className={cn("text-white/20", large ? "text-lg" : small ? "text-[10px]" : "text-sm")}>
            {participant.isLocal ? "Camera" : "Video"}
          </span>
        </div>
      ) : (
        <Avatar className={cn(large ? "h-20 w-20" : small ? "h-8 w-8" : "h-14 w-14")}>
          <AvatarFallback className={cn(
            "bg-white/10 text-white",
            large ? "text-2xl" : small ? "text-[10px]" : "text-lg"
          )}>
            {participant.initials}
          </AvatarFallback>
        </Avatar>
      )}

      <div className="absolute bottom-0 left-0 right-0 p-1.5 bg-gradient-to-t from-black/60 to-transparent">
        <div className="flex items-center justify-between">
          <span className={cn("text-white font-medium truncate", small ? "text-[8px]" : "text-xs")}>
            {participant.isLocal ? "You" : participant.name.split(" ")[0]}
          </span>
          <div className="flex items-center gap-0.5">
            {!participant.hasAudio && (
              <MicOff className={cn("text-destructive", small ? "h-2 w-2" : "h-3 w-3")} />
            )}
            {participant.isScreenSharing && (
              <MonitorUp className={cn("text-info", small ? "h-2 w-2" : "h-3 w-3")} />
            )}
          </div>
        </div>
      </div>

      {participant.isSpeaking && (
        <div className="absolute inset-0 rounded-xl ring-2 ring-primary ring-inset pointer-events-none" />
      )}
    </button>
  )
}
