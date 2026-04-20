"use client"

import { useCallback, useEffect, useState } from "react"
import { useTranslations } from "next-intl"
import { Loader2, Users, X, Plus, Check } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

interface Collaborator {
  userId: string
  email: string | null
  displayName: string | null
  role: string
  addedAt: string
  source: string | null
}

interface SessionAccessDialogProps {
  sessionId: string
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function SessionAccessDialog({ sessionId, open, onOpenChange }: SessionAccessDialogProps) {
  const t = useTranslations('sessionAccess')
  const tCommon = useTranslations('common')
  const [loading, setLoading] = useState(false)
  const [collaborators, setCollaborators] = useState<Collaborator[]>([])
  const [newEmail, setNewEmail] = useState('')
  const [adding, setAdding] = useState(false)
  const [removingId, setRemovingId] = useState<string | null>(null)

  const loadCollaborators = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/sessions/${sessionId}/collaborators`, { cache: 'no-store' })
      if (!res.ok) throw new Error('Failed to load')
      const data = await res.json()
      setCollaborators(Array.isArray(data?.collaborators) ? data.collaborators : [])
    } catch (error) {
      console.error('[SessionAccess] load failed:', error)
      toast.error(t('loadFailed'))
    } finally {
      setLoading(false)
    }
  }, [sessionId, t])

  useEffect(() => {
    if (open) void loadCollaborators()
  }, [open, loadCollaborators])

  const handleAdd = useCallback(async () => {
    const email = newEmail.trim()
    if (!email) return
    setAdding(true)
    try {
      const res = await fetch(`/api/sessions/${sessionId}/collaborators`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data?.error || t('addFailed'))
      setNewEmail('')
      toast.success(t('addedSuccess', { email }))
      await loadCollaborators()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t('addFailed'))
    } finally {
      setAdding(false)
    }
  }, [newEmail, sessionId, t, loadCollaborators])

  const handleRemove = useCallback(
    async (userId: string, label: string) => {
      if (!confirm(t('removeConfirm', { name: label }))) return
      setRemovingId(userId)
      try {
        const res = await fetch(
          `/api/sessions/${sessionId}/collaborators?userId=${encodeURIComponent(userId)}`,
          { method: 'DELETE' }
        )
        if (!res.ok) {
          const data = await res.json().catch(() => ({}))
          throw new Error(data?.error || t('removeFailed'))
        }
        toast.success(t('removedSuccess'))
        await loadCollaborators()
      } catch (error) {
        toast.error(error instanceof Error ? error.message : t('removeFailed'))
      } finally {
        setRemovingId(null)
      }
    },
    [sessionId, t, loadCollaborators]
  )

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            {t('title')}
          </DialogTitle>
          <DialogDescription>{t('description')}</DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-2">
          <div className="flex gap-2">
            <Input
              type="email"
              placeholder={t('emailPlaceholder')}
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !adding) {
                  e.preventDefault()
                  void handleAdd()
                }
              }}
              disabled={adding}
            />
            <Button onClick={() => void handleAdd()} disabled={!newEmail.trim() || adding}>
              {adding ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              <span className="ml-1.5 hidden sm:inline">{t('add')}</span>
            </Button>
          </div>

          <div className="rounded-md border border-border divide-y divide-border">
            {loading ? (
              <div className="flex items-center justify-center p-6 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                {tCommon('loading')}
              </div>
            ) : collaborators.length === 0 ? (
              <p className="p-4 text-sm text-muted-foreground text-center">{t('empty')}</p>
            ) : (
              collaborators.map((c) => {
                const label = c.displayName || c.email || c.userId.slice(0, 8)
                return (
                  <div key={c.userId} className="flex items-center justify-between gap-3 px-3 py-2">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate">{label}</p>
                      {c.email && c.email !== label && (
                        <p className="text-xs text-muted-foreground truncate">{c.email}</p>
                      )}
                      {c.source === 'trial' && (
                        <span className="inline-flex items-center text-[10px] rounded bg-info/10 text-info px-1.5 py-0.5 mt-0.5">
                          <Check className="h-2.5 w-2.5 mr-0.5" />
                          {t('trialBadge')}
                        </span>
                      )}
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
                      onClick={() => void handleRemove(c.userId, label)}
                      disabled={removingId === c.userId}
                      title={t('revoke')}
                    >
                      {removingId === c.userId ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <X className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                )
              })
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {tCommon('close')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
