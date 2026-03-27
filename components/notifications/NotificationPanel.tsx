"use client"

import { useRouter } from "@/i18n/navigation"
import { useTranslations } from "next-intl"
import { Mic, Info, AlertTriangle, Clock, ChevronRight, CheckCircle, FileText, CheckCheck } from "lucide-react"
import { Button } from "@/components/ui/button"
import type { NotificationItem } from "@/lib/hooks/useNotifications"

const iconMap = {
  mic: Mic,
  info: Info,
  alert: AlertTriangle,
  check: CheckCircle,
  file: FileText,
} as const

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
        <p className="text-sm text-muted-foreground">{t("empty")}</p>
      </div>
    )
  }

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between px-1 pb-2">
        <p className="text-sm font-medium text-foreground">{t("title")}</p>
        {hasUnreadDb && (
          <Button
            variant="ghost"
            size="sm"
            className="h-6 text-xs gap-1 text-muted-foreground hover:text-foreground"
            onClick={onMarkAllRead}
          >
            <CheckCheck className="h-3 w-3" />
            {t("markAllRead")}
          </Button>
        )}
      </div>
      {items.map((item) => {
        const Icon = iconMap[item.icon]
        // DB notifications have literal title/description; condition-based use i18n keys
        const titleText = item.dbKey === false ? t(item.title as any, { defaultValue: item.title }) : t(item.title as any)
        const descText = item.dbKey === false ? item.description : t(item.description as any)

        return (
          <div
            key={item.id}
            className="rounded-lg border border-border bg-secondary/30 p-3 space-y-2"
          >
            <div className="flex items-start gap-3">
              <div className="mt-0.5 shrink-0 rounded-full bg-primary/10 p-1.5">
                <Icon className="h-3.5 w-3.5 text-primary" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-foreground">{titleText}</p>
                {descText && (
                  <p className="text-xs text-muted-foreground mt-0.5">{descText}</p>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2 pl-9">
              <Button
                size="sm"
                variant="default"
                className="h-7 text-xs gap-1"
                onClick={() => {
                  if (item.dbId) onMarkRead([item.dbId])
                  router.push(item.actionHref)
                  onClose()
                }}
              >
                {t(item.actionLabel as any)}
                <ChevronRight className="h-3 w-3" />
              </Button>
              {item.snoozable && (
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 text-xs gap-1 text-muted-foreground"
                  onClick={() => onSnooze(item.id)}
                >
                  <Clock className="h-3 w-3" />
                  {t("remindLater")}
                </Button>
              )}
              {item.dbId && (
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 text-xs gap-1 text-muted-foreground"
                  onClick={() => onMarkRead([item.dbId!])}
                >
                  {t("dismiss")}
                </Button>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
