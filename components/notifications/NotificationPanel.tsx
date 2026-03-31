"use client"

import { useRouter } from "@/i18n/navigation"
import { useTranslations } from "next-intl"
import { Mic, Info, AlertTriangle, Clock, ChevronRight, CheckCircle, FileText, CheckCheck, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import type { NotificationItem } from "@/lib/hooks/useNotifications"

const iconMap = {
  mic: Mic,
  info: Info,
  alert: AlertTriangle,
  check: CheckCircle,
  file: FileText,
} as const

const typeBadgeMap: Record<string, { label: string; className: string }> = {
  analysis_complete: { label: "Analyzed", className: "bg-emerald-500/10 text-emerald-600" },
  output_generated: { label: "Output", className: "bg-blue-500/10 text-blue-600" },
  voice_sample_needed: { label: "Action", className: "bg-amber-500/10 text-amber-600" },
  system: { label: "System", className: "bg-muted text-muted-foreground" },
}

interface NotificationPanelProps {
  items: NotificationItem[]
  onSnooze: (id: string) => void
  onMarkRead: (ids: string[]) => void
  onMarkAllRead: () => void
  onClose: () => void
}

export function NotificationPanel({ items, onSnooze, onMarkRead, onMarkAllRead, onClose }: NotificationPanelProps) {
  const t = useTranslations("notifications")
  const router = useRouter()

  const dbItems = items.filter((i) => i.dbId)
  const hasUnreadDb = dbItems.length > 0

  if (items.length === 0) {
    return (
      <div className="py-6 text-center">
        <p className="text-xs text-muted-foreground">{t("empty")}</p>
      </div>
    )
  }

  return (
    <div className="space-y-0.5">
      <div className="flex items-center justify-between px-1 pb-1.5">
        <p className="text-xs font-medium text-foreground">{t("title")}</p>
        {hasUnreadDb && (
          <Button
            variant="ghost"
            size="sm"
            className="h-5 text-[11px] gap-1 text-muted-foreground hover:text-foreground px-1.5"
            onClick={onMarkAllRead}
          >
            <CheckCheck className="h-2.5 w-2.5" />
            {t("markAllRead")}
          </Button>
        )}
      </div>
      {items.map((item) => {
        const Icon = iconMap[item.icon]
        const titleText = item.dbKey === false ? item.title : t(item.title as any)
        const descText = item.dbKey === false ? item.description : t(item.description as any)
        const badge = item.notificationType ? typeBadgeMap[item.notificationType] : undefined

        const handleNavigate = () => {
          if (item.dbId) onMarkRead([item.dbId])
          router.push(item.actionHref)
          onClose()
        }

        return (
          <div
            key={item.id}
            className="rounded-md border border-border bg-secondary/30 px-2.5 py-1.5 group"
          >
            <div className="flex items-start gap-2">
              <div className="mt-0.5 shrink-0 rounded-full bg-primary/10 p-1">
                <Icon className="h-3 w-3 text-primary" />
              </div>
              <div
                className="min-w-0 flex-1 cursor-pointer"
                onClick={handleNavigate}
              >
                <div className="flex items-center gap-1.5">
                  {badge && (
                    <span className={`shrink-0 text-[9px] font-medium px-1.5 py-0.5 rounded-full ${badge.className}`}>
                      {badge.label}
                    </span>
                  )}
                  <p className="text-xs font-medium text-foreground truncate">{titleText}</p>
                  <ChevronRight className="h-3 w-3 shrink-0 text-muted-foreground" />
                </div>
                {descText && (
                  <p className="text-[11px] leading-tight text-muted-foreground mt-0.5 line-clamp-2">{descText}</p>
                )}
              </div>
              <div className="shrink-0 flex items-center gap-0.5">
                {item.snoozable && (
                  <button
                    className="p-0.5 text-muted-foreground hover:text-foreground rounded transition-colors"
                    onClick={() => onSnooze(item.id)}
                    title={t("remindLater")}
                  >
                    <Clock className="h-3 w-3" />
                  </button>
                )}
                {item.dbId && (
                  <button
                    className="p-0.5 text-muted-foreground hover:text-foreground rounded transition-colors"
                    onClick={() => onMarkRead([item.dbId!])}
                    title={t("dismiss")}
                  >
                    <X className="h-3 w-3" />
                  </button>
                )}
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
