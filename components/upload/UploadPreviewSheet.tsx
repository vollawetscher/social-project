'use client'

import { useState, useEffect } from 'react'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from '@/components/ui/sheet'
import { Upload, Loader2, GripVertical, FileAudio } from 'lucide-react'

export interface FileWithMeta {
  file: File
  id: string
  size: number
  duration: number | null
  durationError?: boolean
  groupId: string | null // same id = same group/session
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
}

function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  if (mins >= 60) {
    const hrs = Math.floor(mins / 60)
    const m = mins % 60
    return `${hrs}:${m.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }
  return `${mins}:${secs.toString().padStart(2, '0')}`
}

function getAudioDuration(file: File): Promise<number> {
  return new Promise((resolve) => {
    const audio = document.createElement('audio')
    audio.preload = 'metadata'
    audio.onloadedmetadata = () => {
      URL.revokeObjectURL(audio.src)
      resolve(Math.floor(audio.duration))
    }
    audio.onerror = () => resolve(0)
    audio.src = URL.createObjectURL(file)
  })
}

interface UploadPreviewSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  files: File[]
  onConfirm: (groups: File[][]) => void
  onCancel?: () => void
  loading?: boolean
}

export function UploadPreviewSheet({
  open,
  onOpenChange,
  files,
  onConfirm,
  onCancel,
  loading = false,
}: UploadPreviewSheetProps) {
  const [items, setItems] = useState<FileWithMeta[]>([])
  const [loadingMeta, setLoadingMeta] = useState(true)

  useEffect(() => {
    if (!open || files.length === 0) return
    let cancelled = false
    setLoadingMeta(true)
    Promise.all(
      files.map(async (file, idx) => {
        if (cancelled) return null
        const duration = await getAudioDuration(file).catch(() => 0)
        return {
          file,
          id: `${file.name}-${file.size}-${idx}`,
          size: file.size,
          duration: Number.isFinite(duration) && duration > 0 ? duration : null,
          durationError: !Number.isFinite(duration) || duration <= 0,
          groupId: null as string | null,
        }
      })
    ).then((results) => {
      if (!cancelled && results.every(Boolean)) {
        setItems(results as FileWithMeta[])
      }
      setLoadingMeta(false)
    })
    return () => {
      cancelled = true
    }
  }, [open, files])

  const selected = items.filter((i) => i.groupId !== 'excluded')
  const grouped = new Map<string, FileWithMeta[]>()
  selected.forEach((item) => {
    const gid = item.groupId || item.id
    if (!grouped.has(gid)) grouped.set(gid, [])
    grouped.get(gid)!.push(item)
  })
  const groups = Array.from(grouped.values())

  const toggleExcluded = (id: string) => {
    setItems((prev) =>
      prev.map((i) =>
        i.id === id
          ? { ...i, groupId: i.groupId === 'excluded' ? null : 'excluded' }
          : i
      )
    )
  }

  const handleGroupAllSelected = () => {
    const sel = items.filter((i) => i.groupId !== 'excluded')
    if (sel.length < 2) return
    const leadId = sel[0].id
    setItems((prev) =>
      prev.map((i) =>
        sel.some((s) => s.id === i.id) ? { ...i, groupId: leadId } : i
      )
    )
  }

  const handleUngroup = (id: string) => {
    const gid = items.find((i) => i.id === id)?.groupId
    if (!gid || gid === id) return
    setItems((prev) =>
      prev.map((i) => (i.groupId === gid ? { ...i, groupId: i.id } : i))
    )
  }

  const handleConfirm = () => {
    const result: File[][] = groups.map((g) => g.map((i) => i.file))
    onConfirm(result)
    onOpenChange(false)
  }

  const selectedCount = selected.length
  const groupCount = groups.length

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex flex-col w-full sm:max-w-lg">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <FileAudio className="h-5 w-5" />
            Upload audio
          </SheetTitle>
          <SheetDescription>
            Check size and duration, then choose what to upload. Group files to combine into one session (e.g. recording interruptions).
          </SheetDescription>
        </SheetHeader>
        <div className="flex-1 overflow-y-auto py-4">
          {loadingMeta ? (
            <div className="flex items-center justify-center py-12 gap-2">
              <Loader2 className="h-5 w-5 animate-spin" />
              <span className="text-sm text-muted-foreground">Loading file info...</span>
            </div>
          ) : (
            <div className="space-y-2">
              {items.map((item) => (
                <div
                  key={item.id}
                  className={cn(
                    'flex items-center gap-3 p-3 rounded-lg border',
                    item.groupId === 'excluded'
                      ? 'bg-muted/50 opacity-60'
                      : 'bg-card border-border'
                  )}
                >
                  <Checkbox
                    checked={item.groupId !== 'excluded'}
                    onCheckedChange={() => toggleExcluded(item.id)}
                  />
                  <GripVertical className="h-4 w-4 text-muted-foreground shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{item.file.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatSize(item.size)}
                      {item.duration != null && (
                        <> • {formatDuration(item.duration)}</>
                      )}
                      {item.durationError && item.duration === null && (
                        <span className="text-amber-600"> • Duration unavailable</span>
                      )}
                    </p>
                  </div>
                  {item.groupId !== 'excluded' && item.groupId !== item.id && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-xs shrink-0"
                      onClick={() => handleUngroup(item.id)}
                    >
                      Ungroup
                    </Button>
                  )}
                </div>
              ))}
            </div>
          )}
          {!loadingMeta && selectedCount >= 2 && (
            <div className="mt-4 pt-4 border-t">
              <Button
                variant="outline"
                size="sm"
                className="w-full"
                onClick={handleGroupAllSelected}
              >
                Group all as one session
              </Button>
              <p className="text-xs text-muted-foreground mt-2">
                Use when recordings were interrupted (e.g. phone call) and you want one combined transcript.
              </p>
            </div>
          )}
        </div>
        <SheetFooter className="border-t pt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={loading || loadingMeta || selectedCount === 0}
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Uploading...
              </>
            ) : (
              <>
                <Upload className="h-4 w-4 mr-2" />
                Upload {groupCount} session{groupCount !== 1 ? 's' : ''}
              </>
            )}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
