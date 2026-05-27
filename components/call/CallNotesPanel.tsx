"use client"

import { Loader2, Plus, X } from "lucide-react"
import { useTranslations } from "next-intl"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import type { TimedCallNote } from "@/lib/services/merge-call-notes"

function formatNoteTime(startMs: number): string {
  const totalSec = Math.max(0, Math.floor(startMs / 1000))
  const min = Math.floor(totalSec / 60)
  const sec = totalSec % 60
  return `${min}:${String(sec).padStart(2, "0")}`
}

interface CallNotesPanelProps {
  open: boolean
  onClose: () => void
  draftNote: string
  onDraftChange: (value: string) => void
  notes: TimedCallNote[]
  onAddNote: () => void
  adding?: boolean
  canAdd?: boolean
  dark?: boolean
  className?: string
}

export function CallNotesPanel({
  open,
  onClose,
  draftNote,
  onDraftChange,
  notes,
  onAddNote,
  adding = false,
  canAdd = true,
  dark = false,
  className,
}: CallNotesPanelProps) {
  const t = useTranslations("callRoom")

  if (!open) return null

  return (
    <div
      className={cn(
        "flex flex-col shrink-0 border-t",
        dark ? "border-white/10 bg-[#111]" : "border-border bg-card",
        className
      )}
    >
      <div className="flex items-center justify-between px-4 pt-3 pb-2">
        <span className={cn("text-xs font-medium", dark ? "text-white/60" : "text-muted-foreground")}>
          {t("notes")}
        </span>
        <button onClick={onClose} aria-label={t("closeNotes")}>
          <X className={cn("h-4 w-4", dark ? "text-white/50" : "text-muted-foreground")} />
        </button>
      </div>

      {notes.length > 0 && (
        <div className="max-h-36 overflow-y-auto px-4 pb-2 space-y-2">
          {notes.map((note) => (
            <div
              key={note.id}
              className={cn(
                "rounded-lg px-3 py-2 text-sm",
                dark ? "bg-white/5 text-white/90" : "bg-secondary text-foreground"
              )}
            >
              <div className={cn("text-[10px] font-medium mb-1", dark ? "text-white/45" : "text-muted-foreground")}>
                {formatNoteTime(note.start_ms)}
              </div>
              <p className="whitespace-pre-wrap">{note.text}</p>
            </div>
          ))}
        </div>
      )}

      {canAdd && (
        <div className="px-4 pb-4 space-y-2">
          <textarea
            value={draftNote}
            onChange={(e) => onDraftChange(e.target.value)}
            placeholder={t("addCallNotes")}
            className={cn(
              "w-full h-20 text-sm rounded-lg p-2 resize-none focus:outline-none focus:ring-1",
              dark
                ? "bg-white/10 text-white placeholder:text-white/40 focus:ring-white/30"
                : "bg-secondary text-foreground placeholder:text-muted-foreground focus:ring-primary"
            )}
          />
          <Button
            type="button"
            size="sm"
            className="w-full"
            disabled={!draftNote.trim() || adding}
            onClick={onAddNote}
          >
            {adding ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                {t("addingNote")}
              </>
            ) : (
              <>
                <Plus className="h-4 w-4 mr-2" />
                {t("addNote")}
              </>
            )}
          </Button>
        </div>
      )}
    </div>
  )
}
