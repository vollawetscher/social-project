'use client'

import { useState } from 'react'
import { Link } from '@/i18n/navigation'
import { ArrowRight, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'

type Step = 1 | 2

type UseCaseResult = {
  classification: {
    domain: string
    industry: string
    role: string
    context: string
  }
  useCases: Array<{ id: string; label: string }>
  documents: Array<{ documentType: string; sourceConversation: string }>
  valueProp: string
}

export default function FindYourUseCaseWidget() {
  const [step, setStep] = useState<Step>(1)
  const [transitioning, setTransitioning] = useState(false)
  const [selfDescription, setSelfDescription] = useState('')
  const [correction, setCorrection] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<UseCaseResult | null>(null)

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

      setResult(data.result as UseCaseResult)
      switchStep(2)
    } catch (e) {
      console.error('Use case generation failed:', e)
      setError('Could not generate your use-case output right now. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="w-full max-w-4xl mx-auto rounded-2xl border border-slate-800 bg-slate-950/95 p-4 sm:p-6 text-slate-100 shadow-2xl">
      <div className={`transition-opacity duration-300 ${transitioning ? 'opacity-0' : 'opacity-100'}`}>
        {step === 1 && (
          <div className="space-y-4">
            <div>
              <h3 className="text-xl sm:text-2xl font-semibold">Find out what it can do for you</h3>
              <p className="text-sm text-slate-300 mt-1">Describe your role in one sentence.</p>
            </div>

            <div className="space-y-2">
              <label className="text-sm text-slate-300">Role self-description</label>
              <div className="flex flex-col sm:flex-row gap-2">
                <Input
                  value={selfDescription}
                  onChange={(e) => setSelfDescription(e.target.value)}
                  placeholder='e.g. "I am the CEO of an innovative SaaS Healthcare Solution"'
                  className="bg-slate-900 border-slate-700 text-slate-100 placeholder:text-slate-500"
                />
                <Button onClick={() => runUseCase()} disabled={!selfDescription.trim() || loading} className="sm:w-auto w-full">
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Generate'}
                </Button>
              </div>
            </div>
            {error && <p className="text-xs text-rose-300">{error}</p>}
          </div>
        )}

        {step === 2 && result && (
          <div className="space-y-4">
            <div>
              <h3 className="text-xl sm:text-2xl font-semibold">Sofort: personalisierter Output</h3>
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

            <div className="rounded-lg border border-slate-800 bg-slate-900/70 p-3 space-y-2">
              <p className="text-sm font-medium text-slate-100">Optional correction</p>
              <div className="flex flex-col sm:flex-row gap-2">
                <Input
                  value={correction}
                  onChange={(e) => setCorrection(e.target.value)}
                  placeholder='e.g. "Not clinic context — mostly owner support and renewals"'
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
                onClick={() => switchStep(1)}
                className="border-slate-700 bg-transparent text-slate-200 hover:bg-slate-900"
              >
                Back
              </Button>
              <Button asChild className="bg-white text-slate-900 hover:bg-slate-100 font-semibold">
                <Link href="/signup" className="inline-flex items-center gap-2">
                  Jetzt kostenlos testen
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

