"use client"

import { useRouter } from "@/i18n/navigation"
import { useTranslations } from "next-intl"
import { Mic, Info, AlertTriangle, Clock, ChevronRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import type { NotificationItem } from "@/lib/hooks/useNotifications"

const iconMap = {
  mic: Mic,
  info: Info,
  alert: AlertTriangle,
} as const

interface NotificationPanelProps {
  items: NotificationItem[]
  onSnooze: (id: string) => void
  onClose: () => void
}

export function NotificationPanel({ items, onSnooze, onClose }: NotificationPanelProps) {
  const t = useTranslations("notifications")
  const router = useRouter()

  if (items.length === 0) {
    return (
      <div className="py-6 text-center">
        <p className="text-sm text-muted-foreground">{t("empty")}</p>
      </div>
    )
  }

  return (
    <div className="space-y-1">
      <p className="text-sm font-medium text-foreground px-1 pb-2">{t("title")}</p>
      {items.map((item) => {
        const Icon = iconMap[item.icon]
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
                <p className="text-sm font-medium text-foreground">{t(item.title)}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{t(item.description)}</p>
              </div>
            </div>
            <div className="flex items-center gap-2 pl-9">
              <Button
                size="sm"
                variant="default"
                className="h-7 text-xs gap-1"
                onClick={() => {
                  router.push(item.actionHref)
                  onClose()
                }}
              >
                {t(item.actionLabel)}
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
            </div>
          </div>
        )
      })}
    </div>
  )
}
