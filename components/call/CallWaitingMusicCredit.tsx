"use client"

import { useTranslations } from "next-intl"
import { CALL_WAITING_MUSIC } from "@/lib/constants/call-waiting-music"
import { cn } from "@/lib/utils"

type CallWaitingMusicCreditProps = {
  className?: string
  /** Light text for dark video waiting screens */
  variant?: "default" | "onDark"
}

export function CallWaitingMusicCredit({ className, variant = "default" }: CallWaitingMusicCreditProps) {
  const t = useTranslations("callRoom")
  const linkClass =
    variant === "onDark"
      ? "text-white/55 underline underline-offset-2 hover:text-white/75"
      : "text-muted-foreground underline underline-offset-2 hover:text-foreground"

  return (
    <p
      className={cn(
        "text-[10px] leading-relaxed max-w-xs text-center px-2",
        variant === "onDark" ? "text-white/45" : "text-muted-foreground/80",
        className,
      )}
    >
      {t("waitingMusicCredit", {
        track: CALL_WAITING_MUSIC.track,
        artist: CALL_WAITING_MUSIC.artist,
      })}{" "}
      (
      <a href={CALL_WAITING_MUSIC.sourceUrl} target="_blank" rel="noopener noreferrer" className={linkClass}>
        {CALL_WAITING_MUSIC.sourceName}
      </a>
      {" · "}
      <a href={CALL_WAITING_MUSIC.artistUrl} target="_blank" rel="noopener noreferrer" className={linkClass}>
        {CALL_WAITING_MUSIC.artist}
      </a>
      )
    </p>
  )
}
