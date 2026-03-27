"use client"

import { X, ArrowRight, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useTranslations } from "next-intl"
import { useState } from "react"

interface SessionGuidanceBannerProps {
  activeTab: string
  sessionStatus: string | undefined
  hasAnalysis: boolean
  analyzing: boolean
  hasOutputs: boolean
  onSwitchTab: (tab: string) => void
}

type GuidanceVariant = "info" | "success" | "subtle"

interface GuidanceConfig {
  key: string
  variant: GuidanceVariant
  targetTab?: string
  loading?: boolean
}

function resolveGuidance(
  activeTab: string,
  sessionStatus: string | undefined,
  hasAnalysis: boolean,
  analyzing: boolean,
  hasOutputs: boolean
): GuidanceConfig | null {
  if (activeTab === "transcript") {
    if (sessionStatus === "transcribing" || sessionStatus === "uploading" || sessionStatus === "recording") {
      return { key: "transcriptInProgress", variant: "subtle", loading: true }
    }
    if (sessionStatus === "ready" && analyzing) {
      return { key: "analysisRunning", variant: "subtle", loading: true }
    }
    if (sessionStatus === "ready" && hasAnalysis && !hasOutputs) {
      return { key: "analysisReadyGoOutputs", variant: "success", targetTab: "outputs" }
    }
    if (sessionStatus === "ready" && !hasAnalysis && !analyzing) {
      return { key: "transcriptReadyGoContext", variant: "info", targetTab: "context" }
    }
  }

  if (activeTab === "context") {
    if (analyzing) {
      return { key: "analysisRunning", variant: "subtle", loading: true }
    }
    if (hasAnalysis && !hasOutputs) {
      return { key: "contextReadyGoOutputs", variant: "success", targetTab: "outputs" }
    }
  }

  if (activeTab === "outputs") {
    if (!hasOutputs && hasAnalysis) {
      return { key: "noOutputsYet", variant: "info" }
    }
  }

  return null
}

const variantStyles: Record<GuidanceVariant, string> = {
  info: "bg-blue-500/10 border-blue-500/20 text-blue-700 dark:text-blue-300",
  success: "bg-emerald-500/10 border-emerald-500/20 text-emerald-700 dark:text-emerald-300",
  subtle: "bg-muted/60 border-border text-muted-foreground",
}

export function SessionGuidanceBanner({
  activeTab,
  sessionStatus,
  hasAnalysis,
  analyzing,
  hasOutputs,
  onSwitchTab,
}: SessionGuidanceBannerProps) {
  const t = useTranslations("sessionGuidance")
  const [dismissed, setDismissed] = useState<string | null>(null)

  const guidance = resolveGuidance(activeTab, sessionStatus, hasAnalysis, analyzing, hasOutputs)

  if (!guidance || dismissed === guidance.key) return null

  const style = variantStyles[guidance.variant]

  return (
    <div className={`flex items-center gap-2 rounded-md border px-2.5 py-1.5 mb-2 text-xs ${style}`}>
      {guidance.loading && <Loader2 className="h-3 w-3 shrink-0 animate-spin" />}
      <span className="flex-1 leading-snug">{t(guidance.key as any)}</span>
      <div className="flex items-center gap-1 shrink-0">
        {guidance.targetTab && (
          <Button
            size="sm"
            variant="ghost"
            className="h-5 text-[11px] gap-0.5 px-1.5 hover:bg-current/10"
            onClick={() => {
              onSwitchTab(guidance.targetTab!)
              setDismissed(guidance.key)
            }}
          >
            {t("goTo" as any, { tab: t(guidance.targetTab as any) })}
            <ArrowRight className="h-3 w-3" />
          </Button>
        )}
        {!guidance.loading && (
          <Button
            size="sm"
            variant="ghost"
            className="h-5 w-5 p-0 hover:bg-current/10"
            onClick={() => setDismissed(guidance.key)}
          >
            <X className="h-3 w-3" />
          </Button>
        )}
      </div>
    </div>
  )
}
