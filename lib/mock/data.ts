import type { 
  Session, 
  Template, 
  Output, 
  AiSuggestion, 
  RecordingType, 
  Domain 
} from '@/lib/types-v0'

export const mockSessions: Session[] = [
  {
    id: '1',
    filename: 'client_consultation_2024.mp3',
    duration: 3420,
    language: 'English',
    createdAt: '2024-01-15T10:30:00Z',
    status: 'ready',
    piiRedactionEnabled: true,
    isOfflineCached: true,
    recordingType: 'consultation',
    recordingTypeConfidence: 0.92,
    domain: 'legal',
    domainConfidence: 0.88,
    speakers: [
      { id: 's1', name: 'Attorney Williams', participantRole: 'party_a', semanticRole: 'lawyer' },
      { id: 's2', name: 'John Smith', participantRole: 'party_b', semanticRole: 'client' },
    ],
    transcript: [
      {
        id: 't1',
        speakerId: 's1',
        speakerName: 'Attorney Williams',
        startTime: 0,
        endTime: 15,
        text: 'Good morning, Mr. Smith. Thank you for coming in today. I wanted to discuss the details of your case and go over some important documents.',
      },
      {
        id: 't2',
        speakerId: 's2',
        speakerName: 'John Smith',
        startTime: 16,
        endTime: 28,
        text: 'Thank you for seeing me on such short notice. I have been quite concerned about the timeline and wanted to understand my options better.',
      },
      {
        id: 't3',
        speakerId: 's1',
        speakerName: 'Attorney Williams',
        startTime: 29,
        endTime: 45,
        text: 'Of course, I completely understand. Let me walk you through the process step by step. First, we need to file the initial motion by the end of this month.',
      },
      {
        id: 't4',
        speakerId: 's2',
        speakerName: 'John Smith',
        startTime: 46,
        endTime: 58,
        text: 'That sounds tight. What documents will I need to provide for that? I want to make sure everything is in order.',
        isPiiRedacted: true,
      },
      {
        id: 't5',
        speakerId: 's1',
        speakerName: 'Attorney Williams',
        startTime: 59,
        endTime: 75,
        text: 'You will need your financial statements from the last three years, any correspondence related to the matter, and the original contract documents we discussed previously.',
      },
    ],
    extractedContext: {
      participants: ['Attorney Williams', 'John Smith'],
      purpose: 'Initial client consultation regarding civil litigation matter',
      agenda: ['Case overview', 'Document requirements', 'Timeline discussion', 'Fee structure'],
      venue: 'Williams & Associates Law Office',
    },
  },
  {
    id: '2',
    filename: 'sales_demo_acme_corp.wav',
    duration: 1845,
    language: 'English',
    createdAt: '2024-01-14T14:00:00Z',
    status: 'ready',
    piiRedactionEnabled: false,
    isOfflineCached: false,
    recordingType: 'sales_call',
    recordingTypeConfidence: 0.95,
    domain: 'sales',
    domainConfidence: 0.91,
    speakers: [
      { id: 's1', name: 'Sarah Chen', participantRole: 'party_a', semanticRole: 'sales_rep' },
      { id: 's2', name: 'Mike Johnson', participantRole: 'party_b', semanticRole: 'prospect' },
    ],
    transcript: [],
    extractedContext: {
      participants: ['Sarah Chen', 'Mike Johnson'],
      purpose: 'Product demonstration for Acme Corp procurement team',
      agenda: ['Product overview', 'Feature demonstration', 'Pricing discussion'],
      venue: 'Virtual Meeting',
    },
  },
  {
    id: '3',
    filename: 'interview_candidate_2024.mp3',
    duration: 2700,
    language: 'English',
    createdAt: '2024-01-13T09:00:00Z',
    status: 'transcribing',
    piiRedactionEnabled: true,
    isOfflineCached: true,
    recordingType: 'interview',
    recordingTypeConfidence: 0.89,
    domain: 'hr',
    domainConfidence: 0.85,
    speakers: [],
    transcript: [],
  },
  {
    id: '4',
    filename: 'team_standup_jan12.webm',
    duration: 890,
    language: 'English',
    createdAt: '2024-01-12T10:00:00Z',
    status: 'uploading',
    piiRedactionEnabled: false,
    isOfflineCached: false,
    speakers: [],
    transcript: [],
  },
  {
    id: '5',
    filename: 'medical_consultation_patient.mp3',
    duration: 1200,
    language: 'German',
    createdAt: '2024-01-11T15:30:00Z',
    status: 'failed',
    piiRedactionEnabled: true,
    isOfflineCached: false,
    recordingType: 'consultation',
    recordingTypeConfidence: 0.78,
    domain: 'medical',
    domainConfidence: 0.82,
    speakers: [],
    transcript: [],
  },
]

export const mockTemplates: Template[] = [
  {
    id: 'tmpl_1',
    name: 'Legal Client Summary',
    description: 'Comprehensive summary for legal consultations with actionable next steps',
    intendedPerspectives: ['party_a', 'party_b'],
    allowedAudience: ['internal', 'external'],
    domainTags: ['legal'],
    usedCount: 142,
    sections: [
      { id: 's1', name: 'Executive Summary', description: 'High-level overview of the consultation', isRequired: true },
      { id: 's2', name: 'Key Points Discussed', description: 'Main topics and decisions', isRequired: true },
      { id: 's3', name: 'Action Items', description: 'Next steps with owners and deadlines', isRequired: true },
      { id: 's4', name: 'Legal Recommendations', description: 'Professional legal advice summary', isRequired: false },
    ],
    requiredInputs: ['participants', 'purpose'],
    styleRules: ['Formal tone', 'Use legal terminology appropriately', 'Include disclaimer'],
    suggestionTriggers: ['legal', 'lawyer', 'attorney', 'court', 'litigation'],
  },
  {
    id: 'tmpl_2',
    name: 'Sales Call Report',
    description: 'Structured report for sales calls with opportunity tracking',
    intendedPerspectives: ['party_a'],
    allowedAudience: ['internal'],
    domainTags: ['sales'],
    usedCount: 287,
    sections: [
      { id: 's1', name: 'Call Summary', description: 'Overview of the sales conversation', isRequired: true },
      { id: 's2', name: 'Customer Pain Points', description: 'Identified challenges and needs', isRequired: true },
      { id: 's3', name: 'Product Interest', description: 'Features and products discussed', isRequired: true },
      { id: 's4', name: 'Next Steps', description: 'Follow-up actions and timeline', isRequired: true },
      { id: 's5', name: 'Deal Assessment', description: 'Opportunity score and notes', isRequired: false },
    ],
    requiredInputs: ['participants', 'purpose'],
    styleRules: ['Concise bullet points', 'Include metrics where possible'],
    suggestionTriggers: ['sales', 'demo', 'pricing', 'proposal', 'deal'],
  },
  {
    id: 'tmpl_3',
    name: 'Interview Assessment',
    description: 'Structured candidate evaluation for hiring decisions',
    intendedPerspectives: ['party_a'],
    allowedAudience: ['internal'],
    domainTags: ['hr'],
    usedCount: 89,
    sections: [
      { id: 's1', name: 'Candidate Overview', description: 'Background and qualifications summary', isRequired: true },
      { id: 's2', name: 'Technical Assessment', description: 'Skills evaluation', isRequired: true },
      { id: 's3', name: 'Cultural Fit', description: 'Team and company alignment', isRequired: true },
      { id: 's4', name: 'Recommendation', description: 'Hire/No-hire recommendation with reasoning', isRequired: true },
    ],
    requiredInputs: ['participants', 'purpose'],
    styleRules: ['Objective language', 'Evidence-based assessments'],
    suggestionTriggers: ['interview', 'candidate', 'hiring', 'recruitment'],
  },
  {
    id: 'tmpl_4',
    name: 'Meeting Minutes',
    description: 'Standard meeting documentation with decisions and action items',
    intendedPerspectives: ['party_a', 'party_b', 'observer'],
    allowedAudience: ['internal', 'external'],
    domainTags: ['general'],
    usedCount: 534,
    sections: [
      { id: 's1', name: 'Attendees', description: 'List of participants', isRequired: true },
      { id: 's2', name: 'Agenda Items', description: 'Topics discussed', isRequired: true },
      { id: 's3', name: 'Decisions Made', description: 'Key decisions and outcomes', isRequired: true },
      { id: 's4', name: 'Action Items', description: 'Tasks with owners and deadlines', isRequired: true },
    ],
    requiredInputs: ['participants', 'agenda'],
    styleRules: ['Clear and concise', 'Use bullet points'],
    suggestionTriggers: ['meeting', 'standup', 'sync', 'review'],
  },
  {
    id: 'tmpl_5',
    name: 'Expert Medical Opinion',
    description: 'Professional medical consultation summary with clinical findings',
    intendedPerspectives: ['party_a', 'party_b'],
    allowedAudience: ['internal', 'external'],
    domainTags: ['medical'],
    usedCount: 56,
    sections: [
      { id: 's1', name: 'Patient Information', description: 'Relevant patient details (redacted)', isRequired: true },
      { id: 's2', name: 'Clinical Findings', description: 'Examination results and observations', isRequired: true },
      { id: 's3', name: 'Diagnosis', description: 'Clinical assessment', isRequired: true },
      { id: 's4', name: 'Treatment Plan', description: 'Recommended course of action', isRequired: true },
    ],
    requiredInputs: ['participants', 'purpose'],
    styleRules: ['Medical terminology', 'HIPAA compliant', 'Include disclaimers'],
    suggestionTriggers: ['medical', 'patient', 'diagnosis', 'treatment', 'clinical'],
  },
]

export const mockOutputs: Output[] = [
  {
    id: 'out_1',
    sessionId: '1',
    sessionFilename: 'client_consultation_2024.mp3',
    templateId: 'tmpl_1',
    templateName: 'Legal Client Summary',
    perspective: 'party_a', // From lawyer's perspective
    audience: 'external',
    language: 'English',
    tone: 'formal',
    format: 'markdown',
    content: `# Legal Consultation Summary

## Executive Summary
This document summarizes the initial consultation between Attorney Williams and client John Smith regarding ongoing civil litigation matters.

## Key Points Discussed
- Timeline for initial motion filing (end of month deadline)
- Required documentation for case preparation
- Overview of litigation process and expectations

## Action Items
| Item | Owner | Deadline |
|------|-------|----------|
| Gather financial statements (3 years) | John Smith | Jan 20, 2024 |
| Compile correspondence | John Smith | Jan 20, 2024 |
| Locate original contract | John Smith | Jan 20, 2024 |
| Draft initial motion | Attorney Williams | Jan 28, 2024 |

## Legal Recommendations
Based on the information provided, we recommend proceeding with the proposed timeline while ensuring all documentation is complete and properly organized.

---
*This summary is for informational purposes only and does not constitute legal advice.*`,
    createdAt: '2024-01-15T11:00:00Z',
    transcriptVersionHash: 'abc123',
    citeTimestamps: true,
  },
  {
    id: 'out_2',
    sessionId: '2',
    sessionFilename: 'sales_demo_acme_corp.wav',
    templateId: 'tmpl_2',
    templateName: 'Sales Call Report',
    perspective: 'party_a', // From sales rep's perspective
    audience: 'internal',
    language: 'English',
    tone: 'direct',
    format: 'markdown',
    content: `# Sales Call Report - Acme Corp

## Call Summary
30-minute product demonstration with Mike Johnson from Acme Corp procurement team. Strong interest in enterprise features.

## Customer Pain Points
- Current solution lacks real-time collaboration
- Integration with existing tools is limited
- Scaling issues with current vendor

## Product Interest
- Enterprise collaboration suite
- API integrations
- Custom reporting dashboard

## Next Steps
- [ ] Send pricing proposal (Sarah - Jan 16)
- [ ] Schedule technical deep-dive (Mike - Jan 18)
- [ ] Connect with IT team for integration review

## Deal Assessment
**Opportunity Score: 8/10**
High likelihood of conversion. Decision expected within 2 weeks.`,
    createdAt: '2024-01-14T15:30:00Z',
    transcriptVersionHash: 'def456',
    citeTimestamps: false,
  },
]

export const getRecordingTypeSuggestions = (sessionId: string): AiSuggestion<RecordingType>[] => {
  const suggestions: Record<string, AiSuggestion<RecordingType>[]> = {
    '1': [
      { value: 'consultation', confidence: 0.92, label: 'Consultation' },
      { value: 'meeting', confidence: 0.65, label: 'Meeting' },
      { value: 'legal_deposition', confidence: 0.45, label: 'Legal Deposition' },
    ],
    '2': [
      { value: 'sales_call', confidence: 0.95, label: 'Sales Call' },
      { value: 'meeting', confidence: 0.72, label: 'Meeting' },
    ],
  }
  return suggestions[sessionId] || [{ value: 'other', confidence: 0.5, label: 'Other' }]
}

export const getDomainSuggestions = (sessionId: string): AiSuggestion<Domain>[] => {
  const suggestions: Record<string, AiSuggestion<Domain>[]> = {
    '1': [
      { value: 'legal', confidence: 0.88, label: 'Legal' },
      { value: 'consulting', confidence: 0.52, label: 'Consulting' },
    ],
    '2': [
      { value: 'sales', confidence: 0.91, label: 'Sales' },
      { value: 'consulting', confidence: 0.48, label: 'Consulting' },
    ],
  }
  return suggestions[sessionId] || [{ value: 'general', confidence: 0.5, label: 'General' }]
}

export const getSuggestedTemplates = (domain?: Domain): Template[] => {
  if (!domain) return mockTemplates.slice(0, 3)
  return mockTemplates
    .filter(t => t.domainTags.includes(domain) || t.domainTags.includes('general'))
    .slice(0, 3)
}

export const languages = [
  'English',
  'German',
  'French',
  'Spanish',
  'Italian',
  'Portuguese',
  'Dutch',
  'Polish',
]

// Participant role labels (transcription-level)
export const participantRoleLabels: Record<string, string> = {
  party_a: 'You / Your Side',
  party_b: 'Other Party',
  observer: 'Neutral Observer',
}

export const participantRoleLabelsShort: Record<string, string> = {
  party_a: 'You',
  party_b: 'Other',
  observer: 'Observer',
}

// Semantic role labels for context display
export const semanticRoleLabels: Record<string, string> = {
  lawyer: 'Lawyer / Attorney',
  client: 'Client',
  sales_rep: 'Sales Representative',
  prospect: 'Prospect / Customer',
  interviewer: 'Interviewer',
  candidate: 'Candidate',
  doctor: 'Doctor / Physician',
  patient: 'Patient',
  consultant: 'Consultant',
  teacher: 'Teacher / Instructor',
  student: 'Student',
  moderator: 'Moderator / Facilitator',
  participant: 'Participant',
}

export const audienceLabels: Record<string, string> = {
  internal: 'Internal (Team / Organization)',
  external: 'External (Third Parties)',
  client: 'Client-Facing',
  legal: 'Legal',
  executive: 'Executive',
}
