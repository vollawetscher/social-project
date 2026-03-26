"use client"

import { useRouter } from "@/i18n/navigation"
import { useTranslations } from "next-intl"
import { Mic, Clock } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"

interface VoiceSampleOnboardingModalProps {
  open: boolean
  onSetupNow: () => void
  onSnooze: () => void
}

export function VoiceSampleOnboardingModal({
  open,
  onSetupNow,
  onSnooze,
}: VoiceSampleOnboardingModalProps) {
  const t = useTranslations("notifications")
  const router = useRouter()

  return (
    <Dialog open={open} onOpenChange={(isOpen) => { if (!isOpen) onSnooze() }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
            <Mic className="h-6 w-6 text-primary" />
          </div>
          <DialogTitle className="text-center">{t("onboardingTitle")}</DialogTitle>
          <DialogDescription className="text-center">
            {t("onboardingDesc")}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-2">
          <div className="rounded-lg bg-secondary/50 p-3 space-y-1.5">
            <p className="text-sm font-medium text-foreground">{t("onboardingBenefit1Title")}</p>
            <p className="text-xs text-muted-foreground">{t("onboardingBenefit1Desc")}</p>
          </div>
          <div className="rounded-lg bg-secondary/50 p-3 space-y-1.5">
            <p className="text-sm font-medium text-foreground">{t("onboardingBenefit2Title")}</p>
            <p className="text-xs text-muted-foreground">{t("onboardingBenefit2Desc")}</p>
          </div>
        </div>

        <DialogFooter className="flex-col gap-2 sm:flex-col">
          <Button
            className="w-full gap-2"
            onClick={() => {
              onSetupNow()
              router.push("/profile")
            }}
          >
            <Mic className="h-4 w-4" />
            {t("onboardingSetupNow")}
          </Button>
          <Button
            variant="ghost"
            className="w-full gap-2 text-muted-foreground"
            onClick={onSnooze}
          >
            <Clock className="h-4 w-4" />
            {t("onboardingRemindLater")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
