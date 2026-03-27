"use client"

import { Check, ScrollText, Settings2, FileText, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useTranslations } from "next-intl"
import { useAuth } from "@/lib/auth/AuthProvider"
import { useCallback, useMemo } from "react"

interface SessionProgressGuideProps {
  hasTranscript: boolean
  hasAnalysis: boolean
  hasOutputs: boolean
  activeTab: string
  onSwitchTab: (tab: string) => void
}

interface Step {
  key: string
  tab: string
  icon: React.ElementType
  done: boolean
  active: boolean
}

export function SessionProgressGuide({
  hasTranscript,
  hasAnalysis,
  hasOutputs,
  activeTab,
  onSwitchTab,
}: SessionProgressGuideProps) {
  const t = useTranslations("sessionProgressGuide")
  const { profile, refreshProfile } = useAuth()

  const prefs = (profile?.preferences ?? {}) as Record<string, unknown>
  const onboarding = (prefs.onboarding ?? {}) as Record<string, unknown>
  const tourDone = Boolean(onboarding.session_tour_done)

  const dismiss = useCallback(async () => {
    const nextPrefs = {
      ...prefs,
      onboarding: { ...onboarding, session_tour_done: true },
    }
    try {
      await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ preferences: nextPrefs }),
      })
      await refreshProfile()
    } catch {
      // silent
    }
  }, [prefs, onboarding, refreshProfile])

  const steps = useMemo<Step[]>(
    () => [
      {
        key: "transcript",
        tab: "transcript",
        icon: ScrollText,
        done: hasTranscript,
        active: activeTab === "transcript",
      },
      {
        key: "context",
        tab: "context",
        icon: Settings2,
        done: hasAnalysis,
        active: activeTab === "context",
      },
      {
        key: "outputs",
        tab: "outputs",
        icon: FileText,
        done: hasOutputs,
        active: activeTab === "outputs",
      },
    ],
    [hasTranscript, hasAnalysis, hasOutputs, activeTab]
  )

  // Show until all steps done OR user explicitly dismisses
  const allDone = steps.every((s) => s.done)
  if (tourDone || allDone) return null

  return (
    <div className="mb-4 rounded-xl border border-border bg-muted/40 px-4 py-3">
      <div className="flex items-start justify-between gap-2 mb-3">
        <p className="text-sm font-medium text-foreground">{t("title")}</p>
        <Button
          variant="ghost"
          size="sm"
          className="h-5 w-5 p-0 text-muted-foreground shrink-0 -mt-0.5"
          onClick={dismiss}
        >
          <X className="h-3 w-3" />
        </Button>
      </div>
      <div className="flex items-start gap-2 md:gap-4">
        {steps.map((step, idx) => {
          const Icon = step.icon
          const isNext = !step.done && steps.slice(0, idx).every((s) => s.done)
          return (
            <button
              key={step.key}
              className={`flex-1 flex flex-col items-center gap-1.5 rounded-lg p-2 transition-colors text-center cursor-pointer
                ${step.active ? "bg-primary/10" : "hover:bg-muted"}
              `}
              onClick={() => onSwitchTab(step.tab)}
            >
              <div
                className={`flex h-7 w-7 items-center justify-center rounded-full border-2 transition-colors
                  ${step.done
                    ? "border-emerald-500 bg-emerald-500 text-white"
                    : isNext
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border bg-background text-muted-foreground"
                  }`}
              >
                {step.done ? (
                  <Check className="h-3.5 w-3.5" />
                ) : (
                  <Icon className="h-3.5 w-3.5" />
                )}
              </div>
              <span
                className={`text-xs leading-tight
                  ${step.done ? "text-emerald-600 dark:text-emerald-400 line-through" : isNext ? "text-foreground font-medium" : "text-muted-foreground"}
                `}
              >
                {t(step.key as any)}
              </span>
              {isNext && (
                <span className="text-[10px] text-primary font-medium">{t("next")}</span>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}
