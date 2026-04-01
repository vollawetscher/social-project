"use client"

import { useTranslations } from "next-intl"
import {
  Mic,
  MicOff,
  Video,
  VideoOff,
  RefreshCcw,
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
  isInitiator?: boolean
  onToggleScreenShare: () => void
  onToggleNotes: () => void
  onToggleTranscript: () => void
  onEndCall: () => void
  onSwitchCamera?: () => void
  canSwitchCamera?: boolean
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
  isInitiator = false,
  onToggleScreenShare,
  onToggleNotes,
  onToggleTranscript,
  onEndCall,
  onSwitchCamera,
  canSwitchCamera = false,
  onDialPad,
  dark = false,
  variant = "call",
}: CallControlsProps) {
  const t = useTranslations('callRoom')

  if (variant === "room") {
    return (
      <div className="flex items-center justify-center gap-4 px-4 py-4 shrink-0">
        <ControlButton
          icon={isMuted ? MicOff : Mic}
          label={isMuted ? t('unmute') : t('mute')}
          active={isMuted}
          onClick={onToggleMute}
          dark
        />
        <ControlButton
          icon={isCameraOn ? Video : VideoOff}
          label={isCameraOn ? t('camOn') : t('camOff')}
          active={!isCameraOn}
          onClick={onToggleCamera}
          dark
        />
        {mode === "video" && canSwitchCamera && onSwitchCamera && (
          <ControlButton
            icon={RefreshCcw}
            label={t('flip')}
            active={false}
            onClick={onSwitchCamera}
            dark
          />
        )}
        {canScreenShare && (
          <ControlButton
            icon={MonitorUp}
            label={t('shareScreen')}
            title={t('shareScreenHint')}
            active={isScreenSharing}
            accent
            onClick={onToggleScreenShare}
            dark
          />
        )}
        <ControlButton
          icon={MessageSquareText}
          label={t('transcript')}
          active={showTranscript}
          onClick={onToggleTranscript}
          dark
        />
        <button onClick={onEndCall} className="flex flex-col items-center gap-1">
          <div className="h-12 w-12 rounded-full flex items-center justify-center bg-destructive hover:bg-destructive/90 transition-colors">
            <PhoneOff className="h-5 w-5 text-destructive-foreground" />
          </div>
          <span className="text-[10px] text-white/50">{t('end')}</span>
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
        <ControlButton icon={isMuted ? MicOff : Mic} label={isMuted ? t('unmute') : t('mute')} active={isMuted} onClick={onToggleMute} dark={dark} />
        {mode === "video" && (
          <ControlButton icon={isCameraOn ? Video : VideoOff} label={isCameraOn ? t('camOn') : t('camOff')} active={!isCameraOn} onClick={onToggleCamera} dark={dark} />
        )}
        {mode === "video" && canSwitchCamera && onSwitchCamera && (
          <ControlButton icon={RefreshCcw} label={t('flip')} active={false} onClick={onSwitchCamera} dark={dark} />
        )}
        <ControlButton icon={Volume2} label={t('speaker')} active={isSpeaker} onClick={onToggleSpeaker} dark={dark} />
        {mode === "video" && canScreenShare && (
          <ControlButton icon={MonitorUp} label={t('shareScreen')} title={t('shareScreenHint')} active={isScreenSharing} onClick={onToggleScreenShare} dark={dark} accent />
        )}
        {isInitiator && <ControlButton icon={isOnHold ? Play : Pause} label={isOnHold ? t('resume') : t('hold')} active={isOnHold} onClick={onToggleHold} dark={dark} />}
        <ControlButton icon={StickyNote} label={t('notes')} active={showNotes} onClick={onToggleNotes} dark={dark} />
        {onDialPad && (
          <ControlButton icon={Phone} label={t('dialpad')} active={false} onClick={onDialPad} dark={dark} />
        )}
      </div>
      <Button onClick={onEndCall} className="w-full h-12 rounded-full bg-destructive hover:bg-destructive/90 text-destructive-foreground">
        <PhoneOff className="h-5 w-5 mr-2" />
        {t('endCall')}
      </Button>
    </div>
  )
}

function ControlButton({ icon: Icon, label, active, onClick, dark, accent, title }: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  active: boolean
  onClick: () => void
  dark?: boolean
  accent?: boolean
  title?: string
}) {
  return (
    <button onClick={onClick} title={title} className="flex flex-col items-center gap-1">
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
