import { buildPulsePrompt } from '@/lib/services/pulse/buildPulsePrompt'
import { mapSessionToPulseInput, sanitizePulseJson } from '@/lib/services/pulse/pulse-service'
import { shouldEnqueuePulseForCaseChange } from '@/lib/services/pulse/enqueue-pulse-update'

describe('Project Pulse trigger rules', () => {
  it('enqueues on create with case (null -> value)', () => {
    expect(shouldEnqueuePulseForCaseChange(null, 'case-1')).toBe(true)
  })

  it('enqueues on case reassignment (A -> B)', () => {
    expect(shouldEnqueuePulseForCaseChange('case-a', 'case-b')).toBe(true)
  })

  it('does not enqueue on metadata-only updates (A -> A)', () => {
    expect(shouldEnqueuePulseForCaseChange('case-a', 'case-a')).toBe(false)
  })

  it('does not enqueue when case removed (A -> null)', () => {
    expect(shouldEnqueuePulseForCaseChange('case-a', null)).toBe(false)
  })
})

describe('Project Pulse worker invariants', () => {
  it('preserves original_intent and increments pulse_version', () => {
    const current = {
      original_intent: 'Land enterprise healthcare clients in Q2',
      current_direction: 'Current',
      drift_score: 'green' as const,
      drift_rationale: 'Aligned',
      open_loops: [],
      decision_log: [],
      momentum: 'stable' as const,
      momentum_rationale: 'Stable',
      participant_map: [],
      session_count: 2,
      narrative: 'Narrative',
      updated_at: '2026-03-17T00:00:00.000Z',
      pulse_version: 3,
    }

    const next = sanitizePulseJson(
      {
        original_intent: 'Overwritten by model',
        current_direction: 'Now targeting implementation velocity',
        drift_score: 'yellow',
        drift_rationale: 'Slight scope drift',
        momentum: 'accelerating',
        momentum_rationale: 'More decisions',
      },
      current,
      4,
      'Fallback intent'
    )

    expect(next.original_intent).toBe(current.original_intent)
    expect(next.pulse_version).toBe(4)
    expect(next.session_count).toBe(4)
  })

  it('normalizes session analysis mapping from session row', () => {
    const mapped = mapSessionToPulseInput({
      ai_extracted_context: {
        purpose: 'Define rollout milestones',
        agenda: ['Timeline', 'Owners'],
        participants: [{ name: 'Alice' }, { name: 'Bob' }],
      },
      speechmatics_summary: '- Kickoff complete\n- Risks identified',
      suggested_domains: [{ primary: 'operations', specialty: 'rollout' }],
      recording_type: 'meeting',
      recorded_at: '2026-03-17T10:00:00.000Z',
    })

    expect(mapped.purpose).toBe('Define rollout milestones')
    expect(mapped.summary).toEqual(['Kickoff complete', 'Risks identified'])
    expect(mapped.speakers).toEqual(['Alice', 'Bob'])
    expect(mapped.domains[0]).toContain('operations')
    expect(mapped.recording_type).toBe('meeting')
  })
})

describe('Project Pulse prompt contract', () => {
  it('mentions worker-owned updated_at placeholder', () => {
    const prompt = buildPulsePrompt({
      currentPulse: null,
      sessionIndex: 1,
      userLanguage: 'en',
      session: {
        summary: ['Intro'],
        purpose: 'Kickoff',
        agenda: ['Scope'],
        domains: ['general'],
        speakers: ['A'],
        recording_type: 'meeting',
        recorded_at: '2026-03-17T10:00:00.000Z',
      },
    })

    expect(prompt.system).toContain('WORKER_SETS_THIS')
    expect(prompt.user).toContain('CURRENT PULSE')
    expect(prompt.user).toContain('NEW SESSION ANALYSIS')
  })
})

