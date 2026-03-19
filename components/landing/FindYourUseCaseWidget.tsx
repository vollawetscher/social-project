'use client'

import { useState, useEffect, useRef } from 'react'
import { Link } from '@/i18n/navigation'
import { ArrowRight, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'

const THINKING_STEPS = [
  { label: 'Reading your role description…',        ms: 0 },
  { label: 'Identifying your professional context…', ms: 1800 },
  { label: 'Mapping relevant use cases…',            ms: 3800 },
  { label: 'Selecting documentation outputs…',       ms: 6000 },
  { label: 'Checking compliance & security fit…',    ms: 8500 },
  { label: 'Preparing your personalised result…',    ms: 11000 },
]

function ThinkingIndicator() {
  const [stepIndex, setStepIndex] = useState(0)
  const [dots, setDots] = useState('')
  const startRef = useRef(Date.now())

  useEffect(() => {
    startRef.current = Date.now()
    const interval = setInterval(() => {
      const elapsed = Date.now() - startRef.current
      const next = THINKING_STEPS.findLastIndex((s) => elapsed >= s.ms)
      setStepIndex(Math.max(0, next))
      setDots((d) => (d.length >= 3 ? '' : d + '.'))
    }, 400)
    return () => clearInterval(interval)
  }, [])

  return (
    <div className="space-y-3 py-2">
      {THINKING_STEPS.map((s, i) => {
        const done = i < stepIndex
        const active = i === stepIndex
        return (
          <div key={s.label} className={`flex items-center gap-2.5 text-sm transition-opacity duration-500 ${i > stepIndex ? 'opacity-20' : 'opacity-100'}`}>
            <span className={`h-2 w-2 rounded-full shrink-0 transition-colors duration-300 ${done ? 'bg-teal-400' : active ? 'bg-teal-300 animate-pulse' : 'bg-slate-600'}`} />
            <span className={`${done ? 'text-teal-400 line-through decoration-teal-600' : active ? 'text-white' : 'text-slate-500'}`}>
              {s.label}{active ? dots : ''}
            </span>
            {done && <span className="text-teal-500 text-xs ml-auto">✓</span>}
          </div>
        )
      })}
    </div>
  )
}

type Step = 1 | 2 | 'not-relevant'

type UseCaseResult = {
  classification: {
    domain: string
    industry: string
    role: string
    context: string
  }
  useCases: Array<{ id: string; label: string }>
  documents: Array<{ documentType: string; sourceConversation: string }>
  affirmationsByUseCase: Array<{
    useCaseId: string
    complianceAffirmation: string
    securityAffirmation: string
  }>
  valueProp: string
  correctionPlaceholder?: string
}

interface FindYourUseCaseWidgetProps {
  /** When true, hides the step-1 title/description (used when embedded inside the hero) */
  compact?: boolean
}

export default function FindYourUseCaseWidget({ compact = false }: FindYourUseCaseWidgetProps) {
  const [step, setStep] = useState<Step>(1)
  const [transitioning, setTransitioning] = useState(false)
  const [selfDescription, setSelfDescription] = useState('')
  const [correction, setCorrection] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<UseCaseResult | null>(null)
  const [notRelevantMessage, setNotRelevantMessage] = useState<string | null>(null)

  const switchStep = (next: Step) => {
    setTransitioning(true)
    window.setTimeout(() => {
      setStep(next)
      setTransitioning(false)
    }, 180)
  }

  const runUseCase = async (nextCorrection?: string) => {
    const text = selfDescription.trim()
    if (!text) return

    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/landing/use-case', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          selfDescription: text,
          ...(nextCorrection?.trim() ? { correction: nextCorrection.trim() } : {}),
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data?.error || 'Failed to generate use case output')

      if (data.notRelevant) {
        setNotRelevantMessage(data.notRelevantMessage || 'Notissima is designed for professionals who manage calls, meetings, and client communication.')
        switchStep('not-relevant')
        return
      }

      setResult(data.result as UseCaseResult)
      switchStep(2)
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } catch (e) {
      console.error('Use case generation failed:', e)
      setError('Could not generate your use-case output right now. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="w-full max-w-4xl mx-auto rounded-2xl border border-white/20 bg-black/75 backdrop-blur-md p-4 sm:p-6 text-slate-100 shadow-2xl">
      <div className={`transition-opacity duration-300 ${transitioning ? 'opacity-0' : 'opacity-100'}`}>
        {step === 1 && (
          <div className="space-y-3">
            {!compact && (
              <div>
                <h3 className="text-xl sm:text-2xl font-semibold">Find out what it can do for you</h3>
              </div>
            )}

            {/* Plain-text guidance */}
            <p className="text-sm text-slate-300 leading-relaxed">
              For the best result, include your <span className="text-white font-medium">role</span>,{' '}
              <span className="text-white font-medium">company or organisation type</span>,{' '}
              <span className="text-white font-medium">domain or industry</span>, and{' '}
              <span className="text-white font-medium">location</span>.
            </p>

            {/* Input + button */}
            <div className="flex flex-col sm:flex-row gap-2">
              <Input
                value={selfDescription}
                onChange={(e) => setSelfDescription(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && !loading && selfDescription.trim() && runUseCase()}
                placeholder='e.g. "Senior project manager at a mid-sized engineering firm in Germany"'
                className="bg-white/90 border-transparent text-slate-900 placeholder:text-slate-400 focus:border-teal-400 focus:bg-white h-11"
              />
              <Button
                onClick={() => runUseCase()}
                disabled={!selfDescription.trim() || loading}
                className="sm:w-auto w-full h-11 bg-teal-500 hover:bg-teal-400 text-white font-semibold shrink-0"
              >
                {loading ? <><Loader2 className="h-4 w-4 animate-spin mr-1.5" />Working…</> : 'Explain'}
              </Button>
            </div>

            {/* Example chips */}
            <div className="space-y-1.5">
              <p className="text-xs text-slate-500">Examples — click to try:</p>
              <div className="flex flex-wrap gap-2">
                {[
                  'Managing partner at a boutique law firm in London',
                  'Sales director at a B2B SaaS company in the US',
                  'Head of HR at a 500-person manufacturing company in Germany',
                  'Independent management consultant working with mid-market clients across Europe',
                ].map((example) => (
                  <button
                    key={example}
                    type="button"
                    onClick={() => setSelfDescription(example)}
                    className="text-xs px-3 py-1.5 rounded-full border border-white/15 bg-white/8 text-slate-300 hover:bg-white/15 hover:text-white hover:border-white/30 transition-colors text-left"
                  >
                    {example}
                  </button>
                ))}
              </div>
            </div>

            {loading && (
              <div className="rounded-xl border border-white/10 bg-black/40 px-4 py-3 mt-1">
                <ThinkingIndicator />
              </div>
            )}

            {error && <p className="text-xs text-rose-300">{error}</p>}
          </div>
        )}

        {step === 'not-relevant' && (
          <div className="space-y-4 text-center py-2">
            <p className="text-slate-200 leading-relaxed">{notRelevantMessage}</p>
            <Button
              type="button"
              variant="outline"
              onClick={() => { setNotRelevantMessage(null); setSelfDescription(''); switchStep(1) }}
              className="border-white/30 bg-transparent text-slate-200 hover:bg-white/10"
            >
              Try again
            </Button>
          </div>
        )}

        {step === 2 && result && (
          <div className="space-y-4">
            <div>
              <h3 className="text-xl sm:text-2xl font-semibold">Your personalised output</h3>
              <p className="text-sm text-slate-300 mt-1">Based on your role description</p>
            </div>

            <div className="flex flex-wrap gap-2">
              <Badge variant="secondary" className="bg-slate-800 text-slate-100 border-slate-700">{result.classification.domain}</Badge>
              <Badge variant="secondary" className="bg-slate-800 text-slate-100 border-slate-700">{result.classification.industry}</Badge>
              <Badge variant="secondary" className="bg-slate-800 text-slate-100 border-slate-700">{result.classification.role}</Badge>
              <Badge variant="secondary" className="bg-slate-800 text-slate-100 border-slate-700">{result.classification.context}</Badge>
            </div>

            <div className="overflow-x-auto rounded-lg border border-slate-800">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-900">
                  <tr className="text-slate-200">
                    <th className="px-3 py-2 font-medium">Document type</th>
                    <th className="px-3 py-2 font-medium">Source conversation</th>
                  </tr>
                </thead>
                <tbody>
                  {result.documents.map((row) => (
                    <tr key={`${row.documentType}-${row.sourceConversation}`} className="border-t border-slate-800">
                      <td className="px-3 py-2 text-slate-100">{row.documentType}</td>
                      <td className="px-3 py-2 text-slate-300">{row.sourceConversation}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <p className="text-sm sm:text-base text-slate-200 leading-relaxed">{result.valueProp}</p>

            <div className="rounded-lg border border-slate-800 bg-slate-900/70 p-3 space-y-3">
              <p className="text-sm font-medium text-slate-100">Use-case specific compliance and security affirmations</p>
              <div className="space-y-2">
                {result.useCases.map((useCase) => {
                  const affirmations = result.affirmationsByUseCase.find((item) => item.useCaseId === useCase.id)
                  if (!affirmations) return null
                  return (
                    <div key={useCase.id} className="rounded-md border border-slate-800 bg-slate-950/70 p-3 space-y-1">
                      <p className="text-sm font-medium text-slate-100">{useCase.label}</p>
                      <p className="text-xs text-slate-300">
                        <span className="text-slate-200">Compliance:</span> {affirmations.complianceAffirmation}
                      </p>
                      <p className="text-xs text-slate-300">
                        <span className="text-slate-200">Security:</span> {affirmations.securityAffirmation}
                      </p>
                    </div>
                  )
                })}
              </div>
            </div>

            <div className="rounded-lg border border-slate-800 bg-slate-900/70 p-3 space-y-2">
              <p className="text-sm font-medium text-slate-100">Optional correction</p>
              <div className="flex flex-col sm:flex-row gap-2">
                <Input
                  value={correction}
                  onChange={(e) => setCorrection(e.target.value)}
                  placeholder={result.correctionPlaceholder ? `e.g. "${result.correctionPlaceholder}"` : 'e.g. "Focus more on client-facing work, less on internal reporting"'}
                  className="bg-slate-900 border-slate-700 text-slate-100 placeholder:text-slate-500"
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => runUseCase(correction)}
                  disabled={!correction.trim() || loading}
                  className="border-slate-700 bg-transparent text-slate-200 hover:bg-slate-900"
                >
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Apply correction'}
                </Button>
              </div>
            </div>

            <div className="rounded-lg border border-slate-800 bg-slate-900/70 p-3 space-y-2">
              <p className="text-sm font-medium text-slate-100">You can also tailor this your way:</p>
              <ul className="text-sm text-slate-300 space-y-1">
                <li>• Create templates from scratch for your exact workflow and terminology.</li>
                <li>• Reuse existing report formats and adapt them per team, client, or project.</li>
                <li>• Export and share in Markdown, PDF, DOCX, JSON, or plain-text email-ready format.</li>
              </ul>
            </div>

            <div className="flex flex-col sm:flex-row gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => { setSelfDescription(''); switchStep(1) }}
                className="border-slate-700 bg-transparent text-slate-200 hover:bg-slate-900"
              >
                Back
              </Button>
              <Button asChild className="bg-white text-slate-900 hover:bg-slate-100 font-semibold">
                <Link href="/signup" className="inline-flex items-center gap-2">
                  Start free — no credit card needed
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

