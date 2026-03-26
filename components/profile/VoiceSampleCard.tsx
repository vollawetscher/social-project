"use client"

import { useState, useRef, useCallback, useEffect } from "react"
import { useTranslations } from "next-intl"
import { Mic, Square, Play, Trash2, RotateCcw, Loader2, CheckCircle2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

interface VoiceSampleCardProps {
  displayName: string
  voiceSamplePath: string | null | undefined
  voiceSampleDurationMs: number | null | undefined
  onSaved: (path: string, durationMs: number) => void
  onDeleted: () => void
}

export function VoiceSampleCard({
  displayName,
  voiceSamplePath,
  voiceSampleDurationMs,
  onSaved,
  onDeleted,
}: VoiceSampleCardProps) {
  const t = useTranslations("profile")

  const [recording, setRecording] = useState(false)
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null)
  const [recordedDurationMs, setRecordedDurationMs] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [elapsed, setElapsed] = useState(0)

  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const streamRef = useRef<MediaStream | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const startTimeRef = useRef(0)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const hasExisting = Boolean(voiceSamplePath)
  const hasRecording = Boolean(recordedBlob)

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
      streamRef.current?.getTracks().forEach((t) => t.stop())
    }
  }, [])

  const startRecording = useCallback(async () => {
    setError(null)
    setSuccess(null)
    setRecordedBlob(null)
    setRecordedDurationMs(0)
    setElapsed(0)
    chunksRef.current = []

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: 48000,
          channelCount: 1,
        },
      })
      streamRef.current = stream

      const mimeType = MediaRecorder.isTypeSupported("audio/ogg;codecs=opus")
        ? "audio/ogg;codecs=opus"
        : MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
          ? "audio/webm;codecs=opus"
          : "audio/webm"

      const recorder = new MediaRecorder(stream, { mimeType })
      mediaRecorderRef.current = recorder

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data)
      }

      recorder.onstop = () => {
        const duration = Date.now() - startTimeRef.current
        const blob = new Blob(chunksRef.current, { type: mimeType })
        setRecordedBlob(blob)
        setRecordedDurationMs(duration)
        stream.getTracks().forEach((t) => t.stop())
        streamRef.current = null
        if (timerRef.current) {
          clearInterval(timerRef.current)
          timerRef.current = null
        }
      }

      startTimeRef.current = Date.now()
      recorder.start(250)
      setRecording(true)
      timerRef.current = setInterval(() => {
        setElapsed(Math.floor((Date.now() - startTimeRef.current) / 1000))
      }, 500)
    } catch {
      setError(t("voiceSampleMicError"))
    }
  }, [t])

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current?.state === "recording") {
      mediaRecorderRef.current.stop()
    }
    setRecording(false)
  }, [])

  const playRecording = useCallback(() => {
    if (!recordedBlob) return
    const url = URL.createObjectURL(recordedBlob)
    const audio = new Audio(url)
    audioRef.current = audio
    audio.onended = () => {
      setPlaying(false)
      URL.revokeObjectURL(url)
    }
    audio.play()
    setPlaying(true)
  }, [recordedBlob])

  const stopPlayback = useCallback(() => {
    audioRef.current?.pause()
    setPlaying(false)
  }, [])

  const saveRecording = useCallback(async () => {
    if (!recordedBlob) return
    if (recordedDurationMs < 2000) {
      setError(t("voiceSampleTooShort"))
      return
    }
    setError(null)
    setSuccess(null)
    setSaving(true)

    try {
      const formData = new FormData()
      const ext = recordedBlob.type.includes("ogg") ? "ogg" : "webm"
      formData.append("audio", recordedBlob, `voice-sample.${ext}`)
      formData.append("durationMs", String(recordedDurationMs))

      const res = await fetch("/api/profile/voice-sample", {
        method: "POST",
        body: formData,
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body?.error || "Upload failed")
      }
      const data = await res.json()
      onSaved(data.voice_sample_path, data.voice_sample_duration_ms)
      setRecordedBlob(null)
      setSuccess(t("voiceSampleSaved"))
    } catch (err: any) {
      setError(err?.message || "Failed to save voice sample")
    } finally {
      setSaving(false)
    }
  }, [recordedBlob, recordedDurationMs, onSaved, t])

  const deleteRecording = useCallback(async () => {
    setError(null)
    setSuccess(null)
    setDeleting(true)
    try {
      const res = await fetch("/api/profile/voice-sample", { method: "DELETE" })
      if (!res.ok) throw new Error("Delete failed")
      onDeleted()
      setSuccess(t("voiceSampleDeleted"))
    } catch (err: any) {
      setError(err?.message || "Failed to delete voice sample")
    } finally {
      setDeleting(false)
    }
  }, [onDeleted, t])

  const promptText = t("voiceSamplePrompt", { name: displayName || "..." })

  return (
    <Card className="border-border">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Mic className="h-5 w-5" />
          {t("voiceSample")}
        </CardTitle>
        <CardDescription>{t("voiceSampleDesc")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Prompt text */}
        <div className="space-y-2">
          <p className="text-sm font-medium text-muted-foreground">
            {t("voiceSampleReadAloud")}
          </p>
          <blockquote className="border-l-2 border-primary/40 pl-4 py-2 text-sm text-foreground italic bg-secondary/30 rounded-r-md">
            {promptText}
          </blockquote>
        </div>

        {/* Status: existing sample */}
        {hasExisting && !hasRecording && !recording && (
          <div className="flex items-center gap-2 p-3 rounded-lg bg-success/10 border border-success/20">
            <CheckCircle2 className="h-4 w-4 text-success shrink-0" />
            <span className="text-sm text-foreground">
              {t("voiceSampleRecorded")}
              {voiceSampleDurationMs ? ` — ${t("voiceSampleDuration", { seconds: (voiceSampleDurationMs / 1000).toFixed(1) })}` : ""}
            </span>
          </div>
        )}

        {/* Recording indicator */}
        {recording && (
          <div className="flex items-center gap-3 p-3 rounded-lg bg-destructive/10 border border-destructive/20">
            <span className="h-3 w-3 rounded-full bg-destructive animate-pulse" />
            <span className="text-sm font-medium text-foreground tabular-nums">{elapsed}s</span>
          </div>
        )}

        {/* New recording preview */}
        {hasRecording && !recording && (
          <div className="flex items-center gap-2 p-3 rounded-lg bg-secondary/50 border border-border">
            <span className="text-sm text-foreground">
              {t("voiceSampleDuration", { seconds: (recordedDurationMs / 1000).toFixed(1) })}
            </span>
          </div>
        )}

        {/* Controls */}
        <div className="flex flex-wrap gap-2">
          {!recording && !hasRecording && (
            <Button variant={hasExisting ? "outline" : "default"} size="sm" onClick={startRecording}>
              <Mic className="h-4 w-4 mr-2" />
              {hasExisting ? t("voiceSampleReRecord") : t("voiceSampleRecord")}
            </Button>
          )}

          {recording && (
            <Button variant="destructive" size="sm" onClick={stopRecording}>
              <Square className="h-4 w-4 mr-2" />
              {t("voiceSampleStop")}
            </Button>
          )}

          {hasRecording && !recording && (
            <>
              <Button variant="outline" size="sm" onClick={playing ? stopPlayback : playRecording}>
                <Play className="h-4 w-4 mr-2" />
                {playing ? t("voiceSampleStopPlayback") : t("voiceSamplePlayback")}
              </Button>
              <Button size="sm" onClick={saveRecording} disabled={saving}>
                {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <CheckCircle2 className="h-4 w-4 mr-2" />}
                {saving ? t("voiceSampleSaving") : t("voiceSampleRecorded")}
              </Button>
              <Button variant="ghost" size="sm" onClick={() => { setRecordedBlob(null); setRecordedDurationMs(0) }}>
                <RotateCcw className="h-4 w-4 mr-2" />
                {t("voiceSampleReRecord")}
              </Button>
            </>
          )}

          {hasExisting && !recording && !hasRecording && (
            <Button variant="ghost" size="sm" onClick={deleteRecording} disabled={deleting} className="text-destructive hover:text-destructive">
              {deleting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Trash2 className="h-4 w-4 mr-2" />}
              {deleting ? t("voiceSampleDeleting") : t("voiceSampleDelete")}
            </Button>
          )}
        </div>

        {error && <p className="text-xs text-destructive">{error}</p>}
        {success && <p className="text-xs text-success">{success}</p>}
      </CardContent>
    </Card>
  )
}
