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

describe('Project Pulse worker invariants (Phase 2)', () => {
  it('preserves project_type / user_role and increments pulse_version', () => {
    const next = sanitizePulseJson({
      parsed: {
        project_type: 'New Hire (employer side)',
        user_role: 'Hiring manager',
        current_status: 'Offer extended, awaiting acceptance',
        covered: ['Technical interview', 'Cultural fit'],
        missing: ['Reference checks'],
        next_actions: ['Confirm acceptance', 'Send onboarding plan'],
        open_loops: [],
        decision_log: [{ decision: 'Extended offer', session_index: 4, session_date: '2026-04-01' }],
        participants: [],
        narrative: 'Final-stage hiring; offer extended.',
        type_mismatch_suggestion: null,
        recent_window: [],
        history_chunks: [],
        permanent_ledger: [],
      },
      currentPulse: {
        project_type: 'New Hire (employer side)',
        user_role: 'Hiring manager',
        current_status: 'Late-stage interviews',
        covered: [],
        missing: [],
        next_actions: [],
        open_loops: [],
        decision_log: [],
        participants: [],
        narrative: 'Prior',
        type_mismatch_suggestion: null,
        recent_window: [],
        history_chunks: [],
        permanent_ledger: [],
        pulse_version: 3,
        updated_at: '2026-03-17T00:00:00.000Z',
        session_count: 3,
      },
      sessionIndex: 4,
      projectType: 'New Hire (employer side)',
      userRole: 'Hiring manager',
      triggeringSessionId: 'session-4',
    })

    expect(next.project_type).toBe('New Hire (employer side)')
    expect(next.user_role).toBe('Hiring manager')
    expect(next.pulse_version).toBe(4)
    expect(next.session_count).toBe(4)
    expect(next.current_status).toContain('Offer')
  })

  it('removes resolved loops from open_loops deterministically', () => {
    const next = sanitizePulseJson({
      parsed: {
        project_type: 'Marketing Campaign',
        user_role: 'Campaign owner',
        current_status: 'Launch prep',
        covered: [],
        missing: [],
        next_actions: [],
        open_loops: ['Finalize DPA wording', 'Schedule pilot review'],
        decision_log: [],
        participants: [],
        narrative: 'Steady',
        type_mismatch_suggestion: null,
        recent_window: [],
        history_chunks: [],
        permanent_ledger: [],
      },
      currentPulse: null,
      sessionIndex: 2,
      resolvedMarkers: ['Finalize DPA wording'],
      projectType: 'Marketing Campaign',
      userRole: 'Campaign owner',
      triggeringSessionId: 'session-2',
    })

    expect(next.open_loops).toEqual(['Schedule pilot review'])
  })

  it('drops type_mismatch_suggestion when it echoes the current type', () => {
    const next = sanitizePulseJson({
      parsed: {
        project_type: 'New Hire (employer side)',
        user_role: 'Hiring manager',
        current_status: 'Interviews',
        type_mismatch_suggestion: {
          suggested_type: 'New Hire (employer side)',
          suggested_role: 'Hiring manager',
          confidence: 0.4,
          rationale: 'Matches current',
        },
      },
      currentPulse: null,
      sessionIndex: 1,
      projectType: 'New Hire (employer side)',
      userRole: 'Hiring manager',
      triggeringSessionId: 'session-1',
    })

    expect(next.type_mismatch_suggestion).toBeNull()
  })

  it('keeps a real type_mismatch_suggestion', () => {
    const next = sanitizePulseJson({
      parsed: {
        project_type: 'New Hire (employer side)',
        user_role: 'Hiring manager',
        current_status: 'Vendor scoping',
        type_mismatch_suggestion: {
          suggested_type: 'SW Development project',
          suggested_role: 'Engineering lead',
          confidence: 0.85,
          rationale: 'New session is a sprint planning meeting, not a hiring step',
        },
      },
      currentPulse: null,
      sessionIndex: 5,
      projectType: 'New Hire (employer side)',
      userRole: 'Hiring manager',
      triggeringSessionId: 'session-5',
    })

    expect(next.type_mismatch_suggestion).not.toBeNull()
    expect(next.type_mismatch_suggestion?.suggested_type).toBe('SW Development project')
    expect(next.type_mismatch_suggestion?.confidence).toBeGreaterThan(0.5)
  })

  it('normalizes session analysis mapping from session row (carries session_id)', () => {
    const mapped = mapSessionToPulseInput({
      id: 'sess-123',
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

    expect(mapped.session_id).toBe('sess-123')
    expect(mapped.purpose).toBe('Define rollout milestones')
    expect(mapped.purpose_source).toBe('ai')
    expect(mapped.summary).toEqual(['Kickoff complete', 'Risks identified'])
    expect(mapped.speakers).toEqual(['Alice', 'Bob'])
    expect(mapped.domains[0]).toContain('operations')
    expect(mapped.recording_type).toBe('meeting')
  })

  it('prefers user-declared purpose over ai_extracted_context.purpose', () => {
    const mapped = mapSessionToPulseInput({
      id: 'sess-456',
      purpose: 'First Week 1 follow-up after voice agent go-live',
      purpose_source: 'user',
      ai_extracted_context: {
        purpose: 'CRM training session',
        participants: [{ name: 'Alice' }],
      },
      speechmatics_summary: '',
      suggested_domains: ['operations'],
      recording_type: 'call',
      recorded_at: '2026-03-17T10:00:00.000Z',
    })

    expect(mapped.purpose).toBe('First Week 1 follow-up after voice agent go-live')
    expect(mapped.purpose_source).toBe('user')
  })
})

describe('Project Pulse prompt contract (Phase 2)', () => {
  it('embeds project type/role and the worker placeholder', () => {
    const prompt = buildPulsePrompt({
      currentPulse: null,
      sessionIndex: 1,
      userLanguage: 'en',
      caseStatus: 'active',
      projectType: 'Trade Show Visit',
      userRole: 'Booth lead',
      session: {
        session_id: 'sess-1',
        summary: ['Intro'],
        purpose: 'Kickoff',
        purpose_source: 'user',
        agenda: ['Scope'],
        domains: ['general'],
        speakers: ['A'],
        recording_type: 'meeting',
        recorded_at: '2026-03-17T10:00:00.000Z',
      },
    })

    expect(prompt.system).toContain('Trade Show Visit')
    expect(prompt.system).toContain('Booth lead')
    expect(prompt.system).toContain('WORKER_SETS_THIS')
    expect(prompt.user).toContain('NEW SESSION')
  })

  it('switches to closing-mode instructions for archived/closed cases', () => {
    const prompt = buildPulsePrompt({
      currentPulse: null,
      sessionIndex: 6,
      userLanguage: 'en',
      caseStatus: 'closed',
      projectType: 'New Hire (employer side)',
      userRole: 'Hiring manager',
      session: {
        session_id: 'sess-final',
        summary: ['Closing'],
        purpose: 'Close out',
        purpose_source: null,
        agenda: [],
        domains: [],
        speakers: [],
        recording_type: 'meeting',
        recorded_at: '2026-04-30T10:00:00.000Z',
      },
    })

    expect(prompt.system).toContain('CLOSED')
    expect(prompt.system).toContain('terminal entry')
  })
})
