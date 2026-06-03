'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from '@/i18n/navigation'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/ui/button'
import { CalendarDays, Loader2, Sparkles, X } from 'lucide-react'
import { toast } from 'sonner'

interface EventSuggestion {
  signature: string
  date: string
  count: number
  duplicateCount: number
  sessionIds: string[]
  sampleTitles: string[]
}

interface EventSuggestionBannerProps {
  // Called after sessions are grouped into a new Event project, so the parent
  // can refresh its session list.
  onGrouped?: () => void
}

export function EventSuggestionBanner({ onGrouped }: EventSuggestionBannerProps) {
  const router = useRouter()
  const t = useTranslations('sessions')
  const [suggestions, setSuggestions] = useState<EventSuggestion[]>([])
  const [busySignature, setBusySignature] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/events/suggestions', { cache: 'no-store' })
      if (!res.ok) return
      const data = await res.json()
      setSuggestions(Array.isArray(data?.suggestions) ? data.suggestions : [])
    } catch {
      // Best-effort, non-blocking.
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const formatDate = (iso: string) => {
    const d = new Date(`${iso}T00:00:00`)
    if (Number.isNaN(d.getTime())) return iso
    return d.toLocaleDateString(undefined, { day: '2-digit', month: 'long', year: 'numeric' })
  }

  const handleDismiss = async (s: EventSuggestion) => {
    setBusySignature(s.signature)
    try {
      await fetch('/api/events/suggestions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'dismiss', signature: s.signature }),
      })
      setSuggestions((prev) => prev.filter((x) => x.signature !== s.signature))
    } catch {
      toast.error(t('events.error'))
    } finally {
      setBusySignature(null)
    }
  }

  const handleAccept = async (s: EventSuggestion) => {
    setBusySignature(s.signature)
    try {
      const res = await fetch('/api/events/suggestions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'accept',
          signature: s.signature,
          sessionIds: s.sessionIds,
          date: s.date,
          title: t('events.defaultTitle', { date: formatDate(s.date) }),
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok || !data?.caseId) throw new Error(data?.error || t('events.error'))
      setSuggestions((prev) => prev.filter((x) => x.signature !== s.signature))
      onGrouped?.()
      toast.success(t('events.grouped'))
      router.push(`/projects/${data.caseId}`)
    } catch (error: any) {
      toast.error(error?.message || t('events.error'))
    } finally {
      setBusySignature(null)
    }
  }

  if (suggestions.length === 0) return null

  return (
    <div className="space-y-2 shrink-0">
      {suggestions.map((s) => {
        const busy = busySignature === s.signature
        return (
          <div
            key={s.signature}
            className="rounded-lg border border-primary/40 bg-primary/5 p-3 flex flex-wrap items-center gap-3"
          >
            <div className="flex items-start gap-2 flex-1 min-w-0">
              <Sparkles className="h-4 w-4 text-primary mt-0.5 shrink-0" />
              <div className="min-w-0">
                <p className="text-sm font-medium text-foreground flex items-center gap-1.5">
                  <CalendarDays className="h-3.5 w-3.5 text-muted-foreground" />
                  {t('events.bannerTitle', { count: s.count, date: formatDate(s.date) })}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {t('events.bannerBody')}
                  {s.duplicateCount > 0 && (
                    <span> {t('events.duplicatesSkipped', { count: s.duplicateCount })}</span>
                  )}
                </p>
                {s.sampleTitles.length > 0 && (
                  <p className="text-xs text-muted-foreground/80 mt-0.5 truncate">
                    {s.sampleTitles.join(' · ')}
                  </p>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Button size="sm" onClick={() => handleAccept(s)} disabled={busy}>
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                <span className="ml-1">{t('events.group')}</span>
              </Button>
              <Button size="sm" variant="ghost" onClick={() => handleDismiss(s)} disabled={busy}>
                <X className="h-4 w-4" />
                <span className="ml-1 hidden sm:inline">{t('events.dismiss')}</span>
              </Button>
            </div>
          </div>
        )
      })}
    </div>
  )
}
