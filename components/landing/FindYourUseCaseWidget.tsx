'use client'

import { useMemo, useState } from 'react'
import { Link } from '@/i18n/navigation'
import { ArrowRight, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'

type Step = 1 | 2 | 3

type Classification = {
  industry: string
  role: string
  context: string
  suggestedContexts: string[]
}

type UseCaseOption = {
  id: string
  label: string
}

type OutputRow = {
  documentType: string
  sourceConversation: string
}

function buildUseCaseOptions(classification: Classification): UseCaseOption[] {
  const industry = classification.industry.toLowerCase()
  if (industry.includes('health')) {
    return [
      { id: 'documentation', label: 'Session documentation' },
      { id: 'reporting', label: 'Progress and outcome reporting' },
      { id: 'client-communication', label: 'Patient or family communication' },
      { id: 'handover', label: 'Interdisciplinary handover notes' },
      { id: 'compliance', label: 'Compliance-ready records' },
    ]
  }
  if (industry.includes('legal')) {
    return [
      { id: 'documentation', label: 'Case documentation' },
      { id: 'reporting', label: 'Matter status reporting' },
      { id: 'client-communication', label: 'Client updates and next steps' },
      { id: 'internal', label: 'Internal legal strategy notes' },
      { id: 'compliance', label: 'Evidence and audit trail prep' },
    ]
  }
  if (industry.includes('sales')) {
    return [
      { id: 'documentation', label: 'Call notes and CRM-ready summaries' },
      { id: 'reporting', label: 'Pipeline and deal reporting' },
      { id: 'client-communication', label: 'Client follow-up drafts' },
      { id: 'internal', label: 'Internal handoff and enablement notes' },
      { id: 'insights', label: 'Signal/risk insights from calls' },
    ]
  }
  return [
    { id: 'documentation', label: 'Meeting documentation' },
    { id: 'reporting', label: 'Executive and team reporting' },
    { id: 'client-communication', label: 'Client communication drafts' },
    { id: 'internal', label: 'Internal alignment notes' },
    { id: 'compliance', label: 'Compliance and audit summaries' },
  ]
}

function buildOutputRows(classification: Classification, useCaseId: string): OutputRow[] {
  const context = classification.context
  switch (useCaseId) {
    case 'documentation':
      return [
        { documentType: 'Structured conversation notes', sourceConversation: `${context} meetings or calls` },
        { documentType: 'Action items with owners', sourceConversation: 'Team syncs and decision calls' },
        { documentType: 'Timeline-ready summary', sourceConversation: 'Weekly project conversations' },
      ]
    case 'reporting':
      return [
        { documentType: 'Weekly status report', sourceConversation: `${context} updates` },
        { documentType: 'Risk and blocker summary', sourceConversation: 'Escalation and planning calls' },
        { documentType: 'Decision log', sourceConversation: 'Leadership and stakeholder meetings' },
      ]
    case 'client-communication':
      return [
        { documentType: 'Client-facing follow-up email', sourceConversation: 'Client calls and meetings' },
        { documentType: 'Plain-language summary', sourceConversation: 'Complex review conversations' },
        { documentType: 'Next-step confirmation', sourceConversation: 'Commitment and deadline discussions' },
      ]
    case 'compliance':
      return [
        { documentType: 'Compliance-ready record', sourceConversation: `${context} consultations` },
        { documentType: 'Consent and commitments summary', sourceConversation: 'Regulated conversations' },
        { documentType: 'Audit trail brief', sourceConversation: 'Cross-team review calls' },
      ]
    default:
      return [
        { documentType: 'Internal briefing note', sourceConversation: `${context} coordination calls` },
        { documentType: 'Handover summary', sourceConversation: 'Cross-functional syncs' },
        { documentType: 'Priority action list', sourceConversation: 'Operations and planning meetings' },
      ]
  }
}

function buildValueProp(classification: Classification, useCaseLabel: string): string {
  return `For ${classification.role.toLowerCase()} workflows in ${classification.industry}, Notissima turns your conversations into ready-to-use documentation in minutes. You get consistent, high-quality outputs tailored to ${useCaseLabel.toLowerCase()} without manual rewriting. That means less admin work, faster follow-through, and better decisions from every conversation.`
}

export default function FindYourUseCaseWidget() {
  const [step, setStep] = useState<Step>(1)
  const [transitioning, setTransitioning] = useState(false)
  const [jobTitle, setJobTitle] = useState('')
  const [classifying, setClassifying] = useState(false)
  const [classification, setClassification] = useState<Classification | null>(null)
  const [selectedContext, setSelectedContext] = useState('')
  const [selectedUseCase, setSelectedUseCase] = useState<string>('')

  const useCaseOptions = useMemo(
    () => (classification ? buildUseCaseOptions(classification) : []),
    [classification]
  )

  const selectedUseCaseLabel = useMemo(
    () => useCaseOptions.find((x) => x.id === selectedUseCase)?.label || '',
    [useCaseOptions, selectedUseCase]
  )

  const outputRows = useMemo(() => {
    if (!classification || !selectedUseCase) return []
    return buildOutputRows({ ...classification, context: selectedContext || classification.context }, selectedUseCase)
  }, [classification, selectedUseCase, selectedContext])

  const valueProp = useMemo(() => {
    if (!classification || !selectedUseCaseLabel) return ''
    return buildValueProp(classification, selectedUseCaseLabel)
  }, [classification, selectedUseCaseLabel])

  const switchStep = (next: Step) => {
    setTransitioning(true)
    window.setTimeout(() => {
      setStep(next)
      setTransitioning(false)
    }, 180)
  }

  const classify = async () => {
    const title = jobTitle.trim()
    if (!title) return

    setClassifying(true)
    try {
      const res = await fetch('/api/landing/use-case-classify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobTitle: title }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || 'Failed to classify')
      const parsed = data.classification as Classification
      setClassification(parsed)
      setSelectedContext(parsed.context)
    } catch (error) {
      console.error('Classification failed:', error)
    } finally {
      setClassifying(false)
    }
  }

  const canProceedStep1 = !!classification && !!selectedContext
  const canProceedStep2 = !!selectedUseCase

  return (
    <div className="w-full max-w-4xl mx-auto rounded-2xl border border-slate-800 bg-slate-950/95 p-4 sm:p-6 text-slate-100 shadow-2xl">
      <div className={`transition-opacity duration-300 ${transitioning ? 'opacity-0' : 'opacity-100'}`}>
        {step === 1 && (
          <div className="space-y-4">
            <div>
              <h3 className="text-xl sm:text-2xl font-semibold">Find out what it can do for you</h3>
              <p className="text-sm text-slate-300 mt-1">Step 1 of 3 — Tell us your role</p>
            </div>

            <div className="space-y-2">
              <label className="text-sm text-slate-300">What is your job title?</label>
              <div className="flex flex-col sm:flex-row gap-2">
                <Input
                  value={jobTitle}
                  onChange={(e) => setJobTitle(e.target.value)}
                  placeholder='e.g. "Logopäde", "Sales Manager", "Attorney"'
                  className="bg-slate-900 border-slate-700 text-slate-100 placeholder:text-slate-500"
                />
                <Button onClick={classify} disabled={!jobTitle.trim() || classifying} className="sm:w-auto w-full">
                  {classifying ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Classify'}
                </Button>
              </div>
            </div>

            {classification && (
              <div className="space-y-3 rounded-lg border border-slate-800 bg-slate-900/70 p-3">
                <p className="text-sm text-slate-300">We classified this as:</p>
                <div className="flex flex-wrap gap-2">
                  <Badge variant="secondary" className="bg-slate-800 text-slate-100 border-slate-700">
                    {classification.industry}
                  </Badge>
                  <Badge variant="secondary" className="bg-slate-800 text-slate-100 border-slate-700">
                    {classification.role}
                  </Badge>
                  <Badge variant="secondary" className="bg-slate-800 text-slate-100 border-slate-700">
                    {selectedContext || classification.context}
                  </Badge>
                </div>

                <div className="space-y-2">
                  <p className="text-sm text-slate-300">Confirm your context:</p>
                  <div className="flex flex-wrap gap-2">
                    {classification.suggestedContexts.map((ctx) => (
                      <button
                        key={ctx}
                        type="button"
                        onClick={() => setSelectedContext(ctx)}
                        className={`rounded-full px-3 py-1.5 text-xs border transition ${
                          selectedContext === ctx
                            ? 'border-teal-300 bg-teal-400/15 text-teal-100'
                            : 'border-slate-700 bg-slate-900 text-slate-200 hover:border-slate-500'
                        }`}
                      >
                        {ctx}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            <div className="pt-1">
              <Button
                onClick={() => switchStep(2)}
                disabled={!canProceedStep1}
                className="w-full sm:w-auto bg-white text-slate-900 hover:bg-slate-100"
              >
                Continue
              </Button>
            </div>
          </div>
        )}

        {step === 2 && classification && (
          <div className="space-y-4">
            <div>
              <h3 className="text-xl sm:text-2xl font-semibold">Find out what it can do for you</h3>
              <p className="text-sm text-slate-300 mt-1">Step 2 of 3 — Primary use case</p>
            </div>

            <p className="text-sm text-slate-300">
              What is your primary use case in <span className="text-slate-100">{selectedContext}</span>?
            </p>
            <div className="grid gap-2 sm:grid-cols-2">
              {useCaseOptions.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => setSelectedUseCase(option.id)}
                  className={`text-left rounded-lg border px-3 py-2 text-sm transition ${
                    selectedUseCase === option.id
                      ? 'border-teal-300 bg-teal-400/15 text-teal-100'
                      : 'border-slate-700 bg-slate-900 text-slate-200 hover:border-slate-500'
                  }`}
                >
                  {option.label}
                </button>
              ))}
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
              <Button
                onClick={() => switchStep(3)}
                disabled={!canProceedStep2}
                className="bg-white text-slate-900 hover:bg-slate-100"
              >
                Continue
              </Button>
            </div>
          </div>
        )}

        {step === 3 && classification && selectedUseCase && (
          <div className="space-y-4">
            <div>
              <h3 className="text-xl sm:text-2xl font-semibold">Your personalized use-case map</h3>
              <p className="text-sm text-slate-300 mt-1">Step 3 of 3 — What Notissima can create for you</p>
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
                  {outputRows.map((row) => (
                    <tr key={`${row.documentType}-${row.sourceConversation}`} className="border-t border-slate-800">
                      <td className="px-3 py-2 text-slate-100">{row.documentType}</td>
                      <td className="px-3 py-2 text-slate-300">{row.sourceConversation}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <p className="text-sm sm:text-base text-slate-200 leading-relaxed">
              {valueProp}
            </p>

            <div className="flex flex-col sm:flex-row gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => switchStep(2)}
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

