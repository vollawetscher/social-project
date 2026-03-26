"use client"

import { useState, useRef, useCallback, useEffect } from "react"
import { useTranslations } from "next-intl"
import { Mic, Square, Play, Trash2, Loader2, CheckCircle2, Plus, ChevronDown } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { VOICE_SAMPLE_LANGUAGES, getVoiceSamplePrompt, type VoiceSampleLanguage } from "@/lib/constants/voice-sample-languages"

interface VoiceSample {
  id: string
  language: string
  storage_path: string
  duration_ms: number
  created_at: string
}

interface VoiceSampleCardProps {
  displayName: string
}

export function VoiceSampleCard({ displayName }: VoiceSampleCardProps) {
  const t = useTranslations("profile")

  const [samples, setSamples] = useState<VoiceSample[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedLanguage, setSelectedLanguage] = useState<string | null>(null)
  const [showLanguagePicker, setShowLanguagePicker] = useState(false)
  const [languageSearch, setLanguageSearch] = useState("")
  const [recording, setRecording] = useState(false)
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null)
  const [recordedDurationMs, setRecordedDurationMs] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [saving, setSaving] = useState(false)
  const [deletingLang, setDeletingLang] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [elapsed, setElapsed] = useState(0)

  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const streamRef = useRef<MediaStream | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const startTimeRef = useRef(0)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const pickerRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    fetch("/api/profile/voice-sample")
      .then((r) => r.json())
      .then((d) => setSamples(d.samples || []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
      streamRef.current?.getTracks().forEach((t) => t.stop())
    }
  }, [])

  useEffect(() => {
    if (!showLanguagePicker) return
    const handler = (e: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        setShowLanguagePicker(false)
      }
    }
    document.addEventListener("mousedown", handler)
    return () => document.removeEventListener("mousedown", handler)
  }, [showLanguagePicker])

  const recordedLanguages = new Set(samples.map((s) => s.language))

  const filteredLanguages = VOICE_SAMPLE_LANGUAGES.filter((lang) => {
    if (recordedLanguages.has(lang.code)) return false
    if (!languageSearch) return true
    const q = languageSearch.toLowerCase()
    return lang.name.toLowerCase().includes(q) || lang.nativeName.toLowerCase().includes(q) || lang.code.includes(q)
  })

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
    if (!recordedBlob || !selectedLanguage) return
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
      formData.append("language", selectedLanguage)

      const res = await fetch("/api/profile/voice-sample", { method: "POST", body: formData })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body?.error || "Upload failed")
      }
      const data = await res.json()
      setSamples((prev) => {
        const filtered = prev.filter((s) => s.language !== selectedLanguage)
        return [...filtered, data.sample].sort((a, b) => a.language.localeCompare(b.language))
      })
      setRecordedBlob(null)
      setSelectedLanguage(null)
      setSuccess(t("voiceSampleSaved"))
    } catch (err: any) {
      setError(err?.message || "Failed to save voice sample")
    } finally {
      setSaving(false)
    }
  }, [recordedBlob, recordedDurationMs, selectedLanguage, t])

  const deleteSample = useCallback(async (language: string) => {
    setError(null)
    setSuccess(null)
    setDeletingLang(language)
    try {
      const res = await fetch("/api/profile/voice-sample", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ language }),
      })
      if (!res.ok) throw new Error("Delete failed")
      setSamples((prev) => prev.filter((s) => s.language !== language))
      setSuccess(t("voiceSampleDeleted"))
    } catch (err: any) {
      setError(err?.message || "Failed to delete voice sample")
    } finally {
      setDeletingLang(null)
    }
  }, [t])

  const cancelRecording = useCallback(() => {
    setRecordedBlob(null)
    setRecordedDurationMs(0)
    setSelectedLanguage(null)
    setRecording(false)
    if (mediaRecorderRef.current?.state === "recording") {
      mediaRecorderRef.current.stop()
    }
  }, [])

  const getLangInfo = (code: string): VoiceSampleLanguage | undefined =>
    VOICE_SAMPLE_LANGUAGES.find((l) => l.code === code)

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
        {loading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading...
          </div>
        ) : (
          <>
            {/* Existing samples */}
            {samples.length > 0 && (
              <div className="space-y-2">
                {samples.map((sample) => {
                  const langInfo = getLangInfo(sample.language)
                  return (
                    <div key={sample.id} className="flex items-center justify-between gap-3 p-3 rounded-lg bg-secondary/30 border border-border">
                      <div className="flex items-center gap-3 min-w-0">
                        <CheckCircle2 className="h-4 w-4 text-success shrink-0" />
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-foreground truncate">
                            {langInfo?.nativeName || sample.language.toUpperCase()}
                            {langInfo && langInfo.nativeName !== langInfo.name && (
                              <span className="text-muted-foreground font-normal ml-1">({langInfo.name})</span>
                            )}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {(sample.duration_ms / 1000).toFixed(1)}s
                          </p>
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => deleteSample(sample.language)}
                        disabled={deletingLang === sample.language}
                        className="text-destructive hover:text-destructive shrink-0"
                      >
                        {deletingLang === sample.language ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Trash2 className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  )
                })}
              </div>
            )}

            {/* Recording panel */}
            {selectedLanguage && (
              <div className="space-y-3 p-4 rounded-lg border border-primary/20 bg-primary/5">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium text-foreground">
                    {getLangInfo(selectedLanguage)?.nativeName || selectedLanguage.toUpperCase()}
                  </p>
                  <Button variant="ghost" size="sm" onClick={cancelRecording} className="text-xs h-7">
                    {t("voiceSampleCancel")}
                  </Button>
                </div>

                <div className="space-y-2">
                  <p className="text-xs font-medium text-muted-foreground">{t("voiceSampleReadAloud")}</p>
                  <blockquote className="border-l-2 border-primary/40 pl-3 py-1.5 text-sm text-foreground italic bg-background/50 rounded-r-md">
                    {getVoiceSamplePrompt(selectedLanguage, displayName || "...")}
                  </blockquote>
                </div>

                {recording && (
                  <div className="flex items-center gap-3 p-2 rounded-md bg-destructive/10">
                    <span className="h-3 w-3 rounded-full bg-destructive animate-pulse" />
                    <span className="text-sm font-medium tabular-nums">{elapsed}s</span>
                  </div>
                )}

                {recordedBlob && !recording && (
                  <div className="flex items-center gap-2 p-2 rounded-md bg-secondary/50">
                    <span className="text-sm">{t("voiceSampleDuration", { seconds: (recordedDurationMs / 1000).toFixed(1) })}</span>
                  </div>
                )}

                <div className="flex flex-wrap gap-2">
                  {!recording && !recordedBlob && (
                    <Button size="sm" onClick={startRecording}>
                      <Mic className="h-4 w-4 mr-2" />
                      {t("voiceSampleRecord")}
                    </Button>
                  )}
                  {recording && (
                    <Button variant="destructive" size="sm" onClick={stopRecording}>
                      <Square className="h-4 w-4 mr-2" />
                      {t("voiceSampleStop")}
                    </Button>
                  )}
                  {recordedBlob && !recording && (
                    <>
                      <Button variant="outline" size="sm" onClick={playing ? stopPlayback : playRecording}>
                        <Play className="h-4 w-4 mr-2" />
                        {playing ? t("voiceSampleStopPlayback") : t("voiceSamplePlayback")}
                      </Button>
                      <Button size="sm" onClick={saveRecording} disabled={saving}>
                        {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <CheckCircle2 className="h-4 w-4 mr-2" />}
                        {saving ? t("voiceSampleSaving") : t("voiceSampleSave")}
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => { setRecordedBlob(null); setRecordedDurationMs(0) }}>
                        {t("voiceSampleReRecord")}
                      </Button>
                    </>
                  )}
                </div>
              </div>
            )}

            {/* Add language button + picker */}
            {!selectedLanguage && (
              <div className="relative" ref={pickerRef}>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowLanguagePicker(!showLanguagePicker)}
                  className="gap-2"
                >
                  <Plus className="h-4 w-4" />
                  {t("voiceSampleAddLanguage")}
                  <ChevronDown className="h-3 w-3 ml-1" />
                </Button>
                {showLanguagePicker && (
                  <div className="absolute z-50 mt-1 w-72 max-h-64 overflow-hidden rounded-md border border-border bg-popover shadow-md">
                    <div className="p-2 border-b border-border">
                      <input
                        type="text"
                        placeholder={t("voiceSampleSearchLanguage")}
                        value={languageSearch}
                        onChange={(e) => setLanguageSearch(e.target.value)}
                        className="w-full text-sm px-2 py-1.5 rounded-md bg-background border border-input focus:outline-none focus:ring-1 focus:ring-ring"
                        autoFocus
                      />
                    </div>
                    <div className="overflow-y-auto max-h-48">
                      {filteredLanguages.length === 0 ? (
                        <p className="text-sm text-muted-foreground p-3 text-center">
                          {t("voiceSampleNoLanguages")}
                        </p>
                      ) : (
                        filteredLanguages.map((lang) => (
                          <button
                            key={lang.code}
                            className="w-full text-left px-3 py-2 text-sm hover:bg-accent transition-colors flex items-center justify-between"
                            onClick={() => {
                              setSelectedLanguage(lang.code)
                              setShowLanguagePicker(false)
                              setLanguageSearch("")
                            }}
                          >
                            <span className="font-medium">{lang.nativeName}</span>
                            <span className="text-muted-foreground text-xs">{lang.name}</span>
                          </button>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}
          </>
        )}

        {error && <p className="text-xs text-destructive">{error}</p>}
        {success && <p className="text-xs text-success">{success}</p>}
      </CardContent>
    </Card>
  )
}
