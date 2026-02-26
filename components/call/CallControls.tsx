"use client"

import { useTranslations } from "next-intl"
import {
  Mic,
  MicOff,
  Video,
  VideoOff,
  MonitorUp,
  Volume2,
  Pause,
  Play,
  StickyNote,
  PhoneOff,
  LogOut,
  MessageSquareText,
  Phone,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import type { CallMode } from "@/lib/types/call"

interface CallControlsProps {
  mode: CallMode
  isMuted: boolean
  isCameraOn: boolean
  isSpeaker: boolean
  isOnHold: boolean
  isScreenSharing: boolean
  canScreenShare?: boolean
  showNotes: boolean
  showTranscript: boolean
  onToggleMute: () => void
  onToggleCamera: () => void
  onToggleSpeaker: () => void
  onToggleHold: () => void
  onToggleScreenShare: () => void
  onToggleNotes: () => void
  onToggleTranscript: () => void
  onEndCall: () => void
  onDialPad?: () => void
  dark?: boolean
  variant?: "call" | "room"
}

export function CallControls({
  mode,
  isMuted,
  isCameraOn,
  isSpeaker,
  isOnHold,
  isScreenSharing,
  canScreenShare = true,
  showNotes,
  showTranscript,
  onToggleMute,
  onToggleCamera,
  onToggleSpeaker,
  onToggleHold,
  onToggleScreenShare,
  onToggleNotes,
  onToggleTranscript,
  onEndCall,
  onDialPad,
  dark = false,
  variant = "call",
}: CallControlsProps) {
  if (variant === "room") {
    return (
      <div className="flex items-center justify-center gap-4 px-4 py-4 shrink-0">
        <ControlButton
          icon={isMuted ? MicOff : Mic}
          label={isMuted ? "Unmute" : "Mute"}
          active={isMuted}
          onClick={onToggleMute}
          dark
        />
        <ControlButton
          icon={isCameraOn ? Video : VideoOff}
          label={isCameraOn ? "Cam On" : "Cam Off"}
          active={!isCameraOn}
          onClick={onToggleCamera}
          dark
        />
        {canScreenShare && (
          <ControlButton
            icon={MonitorUp}
            label="Share"
            active={isScreenSharing}
            accent
            onClick={onToggleScreenShare}
            dark
          />
        )}
        <ControlButton
          icon={MessageSquareText}
          label="Transcript"
          active={showTranscript}
          onClick={onToggleTranscript}
          dark
        />
        <button onClick={onEndCall} className="flex flex-col items-center gap-1">
          <div className="h-12 w-12 rounded-full flex items-center justify-center bg-destructive hover:bg-destructive/90 transition-colors">
            <PhoneOff className="h-5 w-5 text-destructive-foreground" />
          </div>
          <span className="text-[10px] text-white/50">End</span>
        </button>
      </div>
    )
  }

  return (
    <div className={cn(
      "px-4 pb-6 pt-3 border-t shrink-0",
      dark ? "border-white/10 bg-[#111]" : "border-border bg-card"
    )}>
      <div className="flex items-center justify-center gap-4 mb-4 flex-wrap">
        <ControlButton icon={isMuted ? MicOff : Mic} label={isMuted ? "Unmute" : "Mute"} active={isMuted} onClick={onToggleMute} dark={dark} />
        {mode === "video" && (
          <ControlButton icon={isCameraOn ? Video : VideoOff} label={isCameraOn ? "Cam On" : "Cam Off"} active={!isCameraOn} onClick={onToggleCamera} dark={dark} />
        )}
        <ControlButton icon={Volume2} label="Speaker" active={isSpeaker} onClick={onToggleSpeaker} dark={dark} />
        {mode === "video" && canScreenShare && (
          <ControlButton icon={MonitorUp} label="Share" active={isScreenSharing} onClick={onToggleScreenShare} dark={dark} accent />
        )}
        <ControlButton icon={isOnHold ? Play : Pause} label={isOnHold ? "Resume" : "Hold"} active={isOnHold} onClick={onToggleHold} dark={dark} />
        <ControlButton icon={StickyNote} label="Notes" active={showNotes} onClick={onToggleNotes} dark={dark} />
        {onDialPad && (
          <ControlButton icon={Phone} label="Dialpad" active={false} onClick={onDialPad} dark={dark} />
        )}
      </div>
      <Button onClick={onEndCall} className="w-full h-12 rounded-full bg-destructive hover:bg-destructive/90 text-destructive-foreground">
        <PhoneOff className="h-5 w-5 mr-2" />
        End Call
      </Button>
    </div>
  )
}

function ControlButton({ icon: Icon, label, active, onClick, dark, accent }: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  active: boolean
  onClick: () => void
  dark?: boolean
  accent?: boolean
}) {
  return (
    <button onClick={onClick} className="flex flex-col items-center gap-1">
      <div className={cn(
        "h-12 w-12 rounded-full flex items-center justify-center transition-colors",
        active
          ? accent ? "bg-info text-info-foreground" : dark ? "bg-white/25 text-white" : "bg-foreground/10 text-foreground"
          : dark ? "bg-white/10 text-white/60 hover:bg-white/15" : "bg-secondary text-muted-foreground hover:bg-secondary/80"
      )}>
        <Icon className="h-5 w-5" />
      </div>
      <span className={cn("text-[10px]", dark ? "text-white/50" : "text-muted-foreground")}>{label}</span>
    </button>
  )
}
