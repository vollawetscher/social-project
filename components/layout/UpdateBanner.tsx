'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslations } from 'next-intl'
import { RefreshCw, X } from 'lucide-react'
import { Button } from '@/components/ui/button'

const POLL_INTERVAL_MS = 60_000

/**
 * Watches for new deployments and shows a dismissible banner prompting a manual
 * reload. It captures the deployment id served at load as its baseline, then
 * polls /api/version (and re-checks whenever the tab regains focus). When the
 * served version differs, the running client bundle is stale.
 *
 * Deliberately gentle: this app runs recordings, dictations and live calls in
 * the browser, so we NEVER auto-reload — an unexpected reload would destroy
 * in-progress work. The banner only invites a reload and warns the user not to
 * do it mid-session.
 */
export function UpdateBanner() {
  const t = useTranslations('updateBanner')
  const baselineRef = useRef<string | null>(null)
  const [newVersion, setNewVersion] = useState<string | null>(null)
  const [dismissedVersion, setDismissedVersion] = useState<string | null>(null)

  const checkVersion = useCallback(async () => {
    try {
      const res = await fetch('/api/version', { cache: 'no-store' })
      if (!res.ok) return
      const data = await res.json().catch(() => null)
      const version = data?.version ? String(data.version) : null
      if (!version || version === 'dev') return

      if (baselineRef.current === null) {
        baselineRef.current = version
        return
      }
      if (version !== baselineRef.current) {
        setNewVersion(version)
      }
    } catch {
      // Network hiccup — ignore, we'll try again on the next tick.
    }
  }, [])

  useEffect(() => {
    void checkVersion()
    const interval = setInterval(() => void checkVersion(), POLL_INTERVAL_MS)
    const onVisible = () => {
      if (document.visibilityState === 'visible') void checkVersion()
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      clearInterval(interval)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [checkVersion])

  const show = newVersion !== null && newVersion !== dismissedVersion
  if (!show) return null

  return (
    <div className="fixed inset-x-0 bottom-0 z-[100] px-3 pb-3 pointer-events-none sm:px-4 sm:pb-4">
      <div className="pointer-events-auto mx-auto max-w-2xl rounded-lg border border-blue-300/60 bg-white/95 shadow-lg backdrop-blur-md dark:border-blue-500/40 dark:bg-neutral-900/95">
        <div className="flex items-start gap-3 p-3 sm:p-4">
          <RefreshCw className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-foreground">{t('title')}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">{t('description')}</p>
            <p className="mt-1.5 text-xs font-medium text-amber-700 dark:text-amber-400">
              {t('warning')}
            </p>
            <div className="mt-2.5 flex items-center gap-2">
              <Button size="sm" onClick={() => window.location.reload()}>
                <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
                {t('reload')}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setDismissedVersion(newVersion)}
              >
                {t('later')}
              </Button>
            </div>
          </div>
          <button
            type="button"
            aria-label={t('later')}
            className="shrink-0 rounded p-1 text-muted-foreground hover:bg-muted"
            onClick={() => setDismissedVersion(newVersion)}
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  )
}
