'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { HelpCircle, Loader2, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import type { PendingClarification, ClarificationOption, OwnerContext } from '@/lib/types-v0'
import { createClient } from '@/lib/supabase/client'

type Props = {
  sessionId: string
  clarification: PendingClarification
  onResolved: (ownerContext: OwnerContext | null) => void
  onDismiss: () => void
}

/**
 * Inline card shown on the session detail Outputs tab when the analyzer
 * needs the user to clarify their role in the conversation before
 * suggestions can be tailored to them. Appears only when the LLM itself
 * says so (ownerAssessment.needsClarification === true).
 */
export function OwnerContextClarification({
  sessionId,
  clarification,
  onResolved,
  onDismiss,
}: Props) {
  const t = useTranslations('ownerClarification')
  const [submitting, setSubmitting] = useState<string | null>(null)
  const [freeText, setFreeText] = useState('')
  const [error, setError] = useState<string | null>(null)

  const submit = async (
    ctx: Partial<OwnerContext> & { role: string },
    key: string
  ) => {
    setError(null)
    setSubmitting(key)
    try {
      const supabase = createClient()
      const { data } = await supabase.auth.getSession()
      const token = data.session?.access_token
      const res = await fetch(`/api/sessions/${sessionId}/owner-context`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ context: ctx }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error || `Request failed (${res.status})`)
      }
      const body = await res.json()
      onResolved(body.ownerContext || null)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to save'
      setError(message)
    } finally {
      setSubmitting(null)
    }
  }

  const dismiss = async () => {
    setError(null)
    setSubmitting('__dismiss__')
    try {
      const supabase = createClient()
      const { data } = await supabase.auth.getSession()
      const token = data.session?.access_token
      await fetch(`/api/sessions/${sessionId}/owner-context`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ dismiss: true }),
      })
      onDismiss()
    } catch {
      // swallow — dismiss is best-effort
      onDismiss()
    } finally {
      setSubmitting(null)
    }
  }

  const onOptionClick = (option: ClarificationOption) => {
    const base = option.suggestedContext || {}
    const role = String(base.role || option.label).trim()
    void submit(
      {
        role,
        speakerId: base.speakerId ?? null,
        goal: base.goal ?? null,
        counterpartyRole: base.counterpartyRole ?? null,
      },
      option.id
    )
  }

  const onFreeTextSubmit = () => {
    const trimmed = freeText.trim()
    if (!trimmed) return
    void submit({ role: trimmed, speakerId: null }, '__free__')
  }

  const busy = submitting !== null

  return (
    <div className="rounded-lg border border-primary/40 bg-primary/5 p-4 space-y-3 relative">
      <button
        type="button"
        onClick={dismiss}
        disabled={busy}
        className="absolute right-2 top-2 p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/60 disabled:opacity-50"
        aria-label={t('dismiss')}
        title={t('dismiss')}
      >
        <X className="h-4 w-4" />
      </button>
      <div className="flex items-start gap-2 pr-6">
        <HelpCircle className="h-4 w-4 text-primary mt-0.5 shrink-0" />
        <div className="space-y-1">
          <h3 className="text-sm font-semibold text-foreground">{t('heading')}</h3>
          <p className="text-sm text-foreground/90">{clarification.question}</p>
          <p className="text-xs text-muted-foreground">{t('subheading')}</p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {clarification.options.map((option) => (
          <Button
            key={option.id}
            size="sm"
            variant="outline"
            onClick={() => onOptionClick(option)}
            disabled={busy}
          >
            {submitting === option.id ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
            ) : null}
            {option.label}
          </Button>
        ))}
      </div>

      {clarification.allowFreeText ? (
        <div className="flex gap-2 pt-1">
          <Input
            value={freeText}
            onChange={(e) => setFreeText(e.target.value)}
            placeholder={t('freeTextPlaceholder')}
            disabled={busy}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && freeText.trim()) {
                e.preventDefault()
                onFreeTextSubmit()
              }
            }}
            className="h-8 text-sm"
          />
          <Button
            size="sm"
            variant="secondary"
            onClick={onFreeTextSubmit}
            disabled={busy || !freeText.trim()}
          >
            {submitting === '__free__' ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              t('save')
            )}
          </Button>
        </div>
      ) : null}

      {error ? (
        <p className="text-xs text-destructive">{error}</p>
      ) : null}
    </div>
  )
}
