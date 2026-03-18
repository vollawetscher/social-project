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

function buildUseCaseOptions(classification: Classification, jobTitle: string): UseCaseOption[] {
  const industry = classification.industry.toLowerCase()
  const role = classification.role.toLowerCase()
  const title = jobTitle.toLowerCase()
  const hrLike = /(hr|human resources|talent|recruit|people ops|people operations)/.test(`${role} ${title}`)

  if (hrLike) {
    return [
      { id: 'interview-summaries', label: 'Interview summaries and candidate evaluations' },
      { id: 'documentation', label: 'Hiring meeting documentation' },
      { id: 'reporting', label: 'Hiring pipeline and team reporting' },
      { id: 'client-communication', label: 'Candidate and hiring-manager communication drafts' },
      { id: 'compliance', label: 'Compliance-ready hiring records' },
      { id: 'internal', label: 'Internal handoff notes between recruiters and hiring teams' },
    ]
  }

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

function buildOutputRowsForUseCase(classification: Classification, useCaseId: string): OutputRow[] {
  const context = classification.context
  switch (useCaseId) {
    case 'interview-summaries':
      return [
        { documentType: 'Interview summary by candidate', sourceConversation: 'Recruiter and panel interviews' },
        { documentType: 'Scorecard-aligned candidate evaluation', sourceConversation: 'Structured interview debriefs' },
        { documentType: 'Hiring recommendation brief', sourceConversation: 'Decision and calibration meetings' },
      ]
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

function buildValueProp(classification: Classification, useCaseLabels: string[], workMode: string): string {
  const joinedUseCases = useCaseLabels.length > 1
    ? `${useCaseLabels.slice(0, -1).join(', ')}, and ${useCaseLabels[useCaseLabels.length - 1]}`
    : (useCaseLabels[0] || 'your workflow')
  const workContext =
    workMode === 'owner'
      ? 'as an owner'
      : workMode === 'employer'
        ? 'as part of a larger organization'
        : 'across both independent and team settings'
  return `For ${classification.role.toLowerCase()} workflows in ${classification.industry}, Notissima turns conversations into reliable outputs for ${joinedUseCases.toLowerCase()}. It helps you standardize quality ${workContext}, reduce manual documentation work, and convert every meeting or call into decisions, follow-ups, and client-ready communication. You move faster with less admin overhead and clearer execution across your workday.`
}

export default function FindYourUseCaseWidget() {
  const [step, setStep] = useState<Step>(1)
  const [transitioning, setTransitioning] = useState(false)
  const [jobTitle, setJobTitle] = useState('')
  const [classifying, setClassifying] = useState(false)
  const [classification, setClassification] = useState<Classification | null>(null)
  const [selectedContext, setSelectedContext] = useState('')
  const [workMode, setWorkMode] = useState<'owner' | 'employer' | 'both' | ''>('')
  const [selectedUseCases, setSelectedUseCases] = useState<string[]>([])
  const [classificationError, setClassificationError] = useState<string | null>(null)

  const useCaseOptions = useMemo(
    () => (classification ? buildUseCaseOptions(classification, jobTitle) : []),
    [classification, jobTitle]
  )

  const selectedUseCaseLabels = useMemo(
    () => useCaseOptions.filter((x) => selectedUseCases.includes(x.id)).map((x) => x.label),
    [useCaseOptions, selectedUseCases]
  )

  const outputRows = useMemo(() => {
    if (!classification || selectedUseCases.length === 0) return []
    const rows = selectedUseCases.flatMap((id) =>
      buildOutputRowsForUseCase({ ...classification, context: selectedContext || classification.context }, id)
    )
    const deduped = Array.from(
      new Map(rows.map((row) => [`${row.documentType}|${row.sourceConversation}`, row])).values()
    )
    return deduped.slice(0, 8)
  }, [classification, selectedUseCases, selectedContext])

  const valueProp = useMemo(() => {
    if (!classification || selectedUseCaseLabels.length === 0 || !workMode) return ''
    return buildValueProp(classification, selectedUseCaseLabels, workMode)
  }, [classification, selectedUseCaseLabels, workMode])

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
    setClassificationError(null)
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
      setSelectedUseCases([])
    } catch (error) {
      console.error('Classification failed:', error)
      setClassificationError('Could not classify right now. Please try again.')
    } finally {
      setClassifying(false)
    }
  }

  const canProceedStep1 = !!classification && !!selectedContext && !!workMode
  const canProceedStep2 = selectedUseCases.length > 0

  const toggleUseCase = (useCaseId: string) => {
    setSelectedUseCases((prev) =>
      prev.includes(useCaseId)
        ? prev.filter((x) => x !== useCaseId)
        : [...prev, useCaseId]
    )
  }

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
            {classificationError && (
              <p className="text-xs text-rose-300">{classificationError}</p>
            )}

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

                <div className="space-y-2">
                  <p className="text-sm text-slate-300">How do you mostly work?</p>
                  <div className="flex flex-wrap gap-2">
                    {[
                      { id: 'owner', label: 'Owner / Self-employed' },
                      { id: 'employer', label: 'Employee / In-house' },
                      { id: 'both', label: 'Both' },
                    ].map((mode) => (
                      <button
                        key={mode.id}
                        type="button"
                        onClick={() => setWorkMode(mode.id as 'owner' | 'employer' | 'both')}
                        className={`rounded-full px-3 py-1.5 text-xs border transition ${
                          workMode === mode.id
                            ? 'border-teal-300 bg-teal-400/15 text-teal-100'
                            : 'border-slate-700 bg-slate-900 text-slate-200 hover:border-slate-500'
                        }`}
                      >
                        {mode.label}
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
              <p className="text-sm text-slate-300 mt-1">Step 2 of 3 — Select your key use cases</p>
            </div>

            <p className="text-sm text-slate-300">
              Which use cases matter most in <span className="text-slate-100">{selectedContext}</span>? (Select one or more)
            </p>
            <div className="grid gap-2 sm:grid-cols-2">
              {useCaseOptions.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => toggleUseCase(option.id)}
                  className={`text-left rounded-lg border px-3 py-2 text-sm transition ${
                    selectedUseCases.includes(option.id)
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

        {step === 3 && classification && selectedUseCases.length > 0 && (
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

