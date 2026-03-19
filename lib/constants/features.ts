// Canonical feature list for Notissima.
//
// Derived from changelog.ts but curated: deduplicated, grouped by capability,
// and written at a stable "product capability" level rather than per-release delta.
//
// Uses:
//   - Marketing copy / features page
//   - SoftwareApplication JSON-LD featureList (via FEATURE_STRINGS export)
//   - Widget "you can also tailor this" section
//   - SEO structured data

export type FeatureCategory =
  | 'transcription'
  | 'ai-outputs'
  | 'calling'
  | 'templates'
  | 'compliance'
  | 'collaboration'
  | 'platform'

export interface Feature {
  id: string
  category: FeatureCategory
  title: string
  description: string
  /** True for top-tier capabilities worth highlighting in hero / pricing sections */
  highlight?: boolean
  /** Changelog version this capability was first introduced */
  since?: string
}

export const FEATURE_CATEGORIES: Record<FeatureCategory, { label: string; description: string }> = {
  transcription: {
    label: 'Transcription & Import',
    description: 'Capture conversations from any source — audio, video, text, or live call — and turn them into structured, speaker-attributed transcripts.',
  },
  'ai-outputs': {
    label: 'AI Analysis & Outputs',
    description: 'Generate professional documentation from every conversation: decision logs, action plans, risk registers, client memos, and more.',
  },
  calling: {
    label: 'Calling',
    description: 'Start browser-based video or voice calls, or dial any phone number — all automatically recorded and processed.',
  },
  templates: {
    label: 'Templates & Marketplace',
    description: 'Build, share, and install output templates for every workflow. The community marketplace gives you a head start.',
  },
  compliance: {
    label: 'Compliance & Security',
    description: 'Built-in consent management, PII protection, and audit-ready controls for regulated industries.',
  },
  collaboration: {
    label: 'Collaboration & Organisation',
    description: 'Organise sessions by project, share outputs with clients, hand off work to colleagues.',
  },
  platform: {
    label: 'Platform & Internationalisation',
    description: 'Full multilingual support, jurisdiction-aware AI, and an open template ecosystem.',
  },
}

export const FEATURES: Feature[] = [

  // ── Transcription & Import ─────────────────────────────────────────────────

  {
    id: 'audio-upload-transcription',
    category: 'transcription',
    title: 'Audio Upload & Transcription',
    description: 'Upload recordings in any common audio or video format. Notissima transcribes them automatically with per-speaker attribution and timestamps.',
    highlight: true,
    since: '1.1.0',
  },
  {
    id: 'in-browser-recording',
    category: 'transcription',
    title: 'In-Browser Recording',
    description: 'Record directly in the app with live audio-level meters, stereo support for external microphones, and an audio-processing toggle for studio-quality capture.',
    since: '1.5.8',
  },
  {
    id: 'auto-language-detection',
    category: 'transcription',
    title: 'Automatic Language Detection',
    description: 'Recording language is detected automatically across 50+ languages — no manual selection needed. Override per session or globally in Settings.',
    highlight: true,
    since: '1.11.0',
  },
  {
    id: 'transcript-file-import',
    category: 'transcription',
    title: 'Transcript File Import',
    description: 'Import existing transcripts from TXT, SRT, or VTT files. Speaker labels and timestamps are detected and preserved automatically.',
    since: '1.5.0',
  },
  {
    id: 'paste-from-clipboard',
    category: 'transcription',
    title: 'Paste Transcript from Clipboard',
    description: 'Copy a chat, email thread, or transcript from any source and paste it directly into Notissima. Chat-style content (You said / AI said) is structured automatically.',
    since: '1.5.0',
  },
  {
    id: 'raw-text-import',
    category: 'transcription',
    title: 'Raw Text Import Mode',
    description: 'Import knowledge dumps, email threads, reports, or any unstructured text without forcing a transcript format. Content is split into readable paragraphs for AI analysis.',
    since: '1.22.0',
  },
  {
    id: 'ai-structuring',
    category: 'transcription',
    title: 'AI Structuring for Mixed Content',
    description: 'When imported text mixes chat logs, summaries, and call excerpts, Notissima detects it and uses AI to reorganise it into a clean conversation transcript before analysis.',
    since: '1.5.0',
  },
  {
    id: 'parse-mode-switcher',
    category: 'transcription',
    title: 'Parse Mode Switcher',
    description: 'Cycle through parsing modes in the import preview to choose the format that best preserves speaker turns and timestamps. Re-parse any session after import without re-uploading.',
    since: '1.20.20',
  },
  {
    id: 'word-corrections',
    category: 'transcription',
    title: 'Word Corrections',
    description: 'Fix misheard words in transcripts in the Context panel. Corrections apply to the transcript view and to all AI-generated outputs from that session.',
    since: '1.5.0',
  },
  {
    id: 'group-files',
    category: 'transcription',
    title: 'Group Multiple Files into One Session',
    description: 'Combine split recordings (e.g. interrupted phone calls) into one session before uploading. They are transcribed as a single continuous transcript.',
    since: '1.5.0',
  },
  {
    id: 'content-type-hint',
    category: 'transcription',
    title: 'Content Type Hint',
    description: 'Classify recordings before upload — meeting, presentation, trade show, voice note — so the AI uses the right analysis model and produces more accurate summaries.',
    since: '1.5.5',
  },
  {
    id: 'auto-session-summary',
    category: 'transcription',
    title: 'Automatic Session Summary',
    description: 'A concise summary is generated automatically after transcription and shown above the transcript — so key points are visible without reading the full text.',
    since: '1.5.4',
  },

  // ── AI Analysis & Outputs ──────────────────────────────────────────────────

  {
    id: 'domain-aware-suggestions',
    category: 'ai-outputs',
    title: 'Domain-Aware Output Suggestions',
    description: 'After analysing your transcript, the AI suggests the 3 most relevant output formats for that conversation type — legal, sales, medical, and more. One click to generate.',
    highlight: true,
    since: '1.5.0',
  },
  {
    id: 'auto-generation-after-transcription',
    category: 'ai-outputs',
    title: 'Auto-Generation After Transcription',
    description: 'Choose a template and Notissima automatically generates your preferred output as soon as transcription completes — no manual trigger needed.',
    since: '1.5.0',
  },
  {
    id: 'output-configuration',
    category: 'ai-outputs',
    title: 'Flexible Output Configuration',
    description: 'Control who the output is for (internal, client-facing, executive, legal), the tone (formal, casual, technical), and the speaker perspective (first-person, third-person) before generating.',
    since: '1.6.0',
  },
  {
    id: 'output-translation',
    category: 'ai-outputs',
    title: 'Output Translation',
    description: 'Translate any generated output into another language with one click — English, German, French, Spanish, Italian, Portuguese, Dutch, Polish, and more.',
    since: '1.5.0',
  },
  {
    id: 'download-formats',
    category: 'ai-outputs',
    title: 'Download in Multiple Formats',
    description: 'Export any output as Markdown, PDF, Word (DOCX), or Google Docs format. Headings, bold, lists, and tables are correctly converted in all formats.',
    since: '1.5.0',
  },
  {
    id: 'shareable-output-links',
    category: 'ai-outputs',
    title: 'Shareable Output Links',
    description: 'Share any output with a secure expiring link — no account required to view. Re-copying the link extends the expiry automatically.',
    since: '1.5.1',
  },
  {
    id: 'date-in-outputs',
    category: 'ai-outputs',
    title: 'Date and Time in Generated Reports',
    description: 'Optionally include the session date and time at the top of generated outputs. The format adapts to your selected language.',
    since: '1.18.0',
  },

  // ── Calling ───────────────────────────────────────────────────────────────

  {
    id: 'video-calls',
    category: 'calling',
    title: 'Browser-Based Video Calls',
    description: 'Start HD video calls directly in the browser with screen sharing, background blur or replacement, gallery and focus layouts, and host controls.',
    highlight: true,
    since: '1.7.0',
  },
  {
    id: 'voice-calls',
    category: 'calling',
    title: 'Voice Calls: WebCall or Phone Network',
    description: 'Choose between a browser WebCall or a standard phone network (PSTN) call. Dial any number from the app — PSTN calls route caller ID by destination country.',
    since: '1.22.0',
  },
  {
    id: 'per-speaker-call-transcription',
    category: 'calling',
    title: 'Per-Speaker Call Transcription',
    description: 'Every call — video, voice, or PSTN — is automatically recorded and transcribed with separate speaker tracks, then fed into the full session and output pipeline.',
    highlight: true,
    since: '1.7.0',
  },
  {
    id: 'ring-sms-invites',
    category: 'calling',
    title: 'Ring + SMS Video Call Invites',
    description: 'Invite someone by phone number or contact. Their phone rings with a short voice message and they receive an SMS with the join link — so they know to check immediately.',
    since: '1.9.0',
  },
  {
    id: 'scheduled-calls',
    category: 'calling',
    title: 'Scheduled Calls with Calendar Invites',
    description: 'Schedule video calls in advance. Contacts receive an email invite with an ICS calendar attachment. Multi-contact invites, custom duration, WhatsApp sharing, and initiator reminders are included.',
    since: '1.20.6',
  },
  {
    id: 'transcription-consent-gate',
    category: 'calling',
    title: 'In-Call Transcription Consent Gate',
    description: 'Participants see a consent dialog before their audio is recorded. Three options: full consent, continue without being recorded (caller-only transcription), or leave. Consent is logged.',
    since: '1.10.0',
  },
  {
    id: 'guest-onboarding',
    category: 'calling',
    title: 'Call Guest Onboarding',
    description: 'Guests who join your call can create a free 5-day trial account after the call ends. Their account is pre-loaded with the call session — transcript and AI analysis included.',
    since: '1.8.0',
  },
  {
    id: 'host-controls',
    category: 'calling',
    title: 'Host Controls',
    description: 'Lock or unlock room joins, remove participants, and view participant roles during live video calls. Only the initiator has host access.',
    since: '1.20.39',
  },
  {
    id: 'hold-mute-visibility',
    category: 'calling',
    title: 'Hold and Mute Visibility',
    description: 'Both parties can see when the other side is on hold or muted — shown as a badge, banner, and avatar tint. Only the call initiator can place a call on hold.',
    since: '1.22.0',
  },

  // ── Templates & Marketplace ───────────────────────────────────────────────

  {
    id: 'custom-templates',
    category: 'templates',
    title: 'Custom Output Templates',
    description: 'Build templates that define the structure, tone, and focus of generated outputs for your exact workflow. Save any output you like as a reusable template.',
    highlight: true,
    since: '1.5.0',
  },
  {
    id: 'domain-template-suggestions',
    category: 'templates',
    title: 'Domain-Aware Template Suggestions',
    description: 'Your templates are suggested based on session content — legal templates appear for legal conversations, sales templates for sales calls. No manual filtering needed.',
    since: '1.5.0',
  },
  {
    id: 'template-marketplace',
    category: 'templates',
    title: 'Template Marketplace',
    description: 'Browse, install, and publish templates created by the community. Filter by category, language, popularity, and rating. Publicly browsable — no account required.',
    highlight: true,
    since: '1.13.0',
  },
  {
    id: 'creator-prompt-protection',
    category: 'templates',
    title: 'Creator Prompt Protection',
    description: 'Generation instructions (AI prompts) are never exposed publicly in the Marketplace — only the template description is shown. Your know-how stays yours.',
    since: '1.15.0',
  },
  {
    id: 'anti-republishing',
    category: 'templates',
    title: 'Anti-Republishing Protection',
    description: 'Templates installed from the marketplace cannot be republished, protecting the intellectual property of original creators.',
    since: '1.18.0',
  },
  {
    id: 'install-to-rate',
    category: 'templates',
    title: 'Install-to-Rate',
    description: 'Only users who have installed a template can rate it, ensuring reviews reflect real usage.',
    since: '1.21.1',
  },
  {
    id: 'creator-lead-capture',
    category: 'templates',
    title: 'Creator Lead Capture',
    description: 'Template creators can receive email notifications when users install their templates. Users consent to share their email, connecting creators with their audience.',
    since: '1.21.0',
  },
  {
    id: 'ai-template-enhancement',
    category: 'templates',
    title: 'AI Template Enhancement',
    description: 'Optimise your template generation instructions and write a user-friendly description with one click using AI enhancement.',
    since: '1.20.1',
  },
  {
    id: 'email-only-templates',
    category: 'templates',
    title: 'Email-Only Plain-Text Templates',
    description: 'Create templates that output plain text, ready to copy and paste into an email without Markdown formatting.',
    since: '1.21.4',
  },

  // ── Compliance & Security ─────────────────────────────────────────────────

  {
    id: 'pii-detection-redaction',
    category: 'compliance',
    title: 'PII Detection and Redaction',
    description: 'Personally identifiable information — names, addresses, phone numbers — is automatically detected in transcripts and can be redacted with one click.',
    highlight: true,
    since: '1.1.0',
  },
  {
    id: 'consent-logging',
    category: 'compliance',
    title: 'Consent Logging',
    description: 'All transcription consent decisions — granted, declined, or caller-only — are logged with participant identity and timestamp for compliance and audit purposes.',
    since: '1.10.0',
  },
  {
    id: 'pstn-voice-consent',
    category: 'compliance',
    title: 'PSTN Voice Consent Before Recording',
    description: 'Outbound phone calls play a consent prompt to the recipient before recording begins. If consent is declined, the call continues with caller-only recording.',
    since: '1.20.3',
  },
  {
    id: 'no-training-data',
    category: 'compliance',
    title: 'Data Never Used for AI Training',
    description: 'Your recordings, transcripts, and outputs are never used to train AI models — by Notissima or any of its infrastructure providers.',
    highlight: true,
    since: '1.0.0',
  },
  {
    id: 'gdpr-eu-processing',
    category: 'compliance',
    title: 'GDPR-Compliant Processing',
    description: 'All data processing follows GDPR requirements with EU data residency options. Infrastructure providers are DPA-covered and listed in the in-app compliance matrix.',
    since: '1.0.0',
  },
  {
    id: 'compliance-matrix',
    category: 'compliance',
    title: 'In-App Compliance Matrix',
    description: 'A searchable compliance matrix in Settings lists every infrastructure provider with links to their DPA, security documentation, and subprocessor lists — plus a missing-items checklist.',
    since: '1.21.5',
  },

  // ── Collaboration & Organisation ──────────────────────────────────────────

  {
    id: 'project-management',
    category: 'collaboration',
    title: 'Project Management',
    description: 'Organise sessions by project or client. Track status, group multiple recordings, and keep all conversations related to one engagement together.',
    since: '1.4.0',
  },
  {
    id: 'session-handoff',
    category: 'collaboration',
    title: 'Session Hand-Off',
    description: 'Transfer full ownership of a session to a colleague by email. Useful when passing work between team members.',
    since: '1.5.6',
  },
  {
    id: 'contacts',
    category: 'collaboration',
    title: 'Contacts Management',
    description: 'Save and edit contacts with name, phone number, and email. Use them for call invites, PSTN dialling, and scheduled call distribution.',
    since: '1.20.5',
  },
  {
    id: 'admin-dashboard',
    category: 'collaboration',
    title: 'Admin Dashboard',
    description: 'Administrators can monitor all sessions across users and review bug reports filtered by status, severity, or type — and resolve issues directly from the interface.',
    since: '1.13.0',
  },

  // ── Platform & Internationalisation ──────────────────────────────────────

  {
    id: '50-language-transcription',
    category: 'platform',
    title: '50+ Language Transcription',
    description: 'Transcription with automatic language detection across more than 50 languages. Record or upload in one language and generate outputs in another.',
    highlight: true,
    since: '1.11.0',
  },
  {
    id: 'multilingual-app-ui',
    category: 'platform',
    title: 'App UI in English, German, and Spanish',
    description: 'The entire app — every button, label, error message, and call screen — is fully translated into English, German, and Spanish.',
    since: '1.12.0',
  },
  {
    id: 'localised-landing-page',
    category: 'platform',
    title: 'Localised Landing Page',
    description: 'The landing page adapts fully to the visitor\'s browser language — copy, FAQ, example chips, and thinking steps are all locale-specific for English, German, and Spanish.',
    since: '1.22.1',
  },
  {
    id: 'jurisdiction-aware-ai',
    category: 'platform',
    title: 'Jurisdiction-Aware AI Terminology',
    description: 'When a location or legal system is mentioned, AI outputs use locally correct terminology — German civil law terms for a lawyer in Germany, French healthcare terminology for a doctor in France, and so on.',
    since: '1.22.1',
  },
  {
    id: 'use-case-finder',
    category: 'platform',
    title: 'Interactive Use-Case Finder',
    description: 'Describe your role on the landing page and the AI generates a personalised map of the outputs, document types, and compliance affirmations most relevant to your work — with jurisdiction-aware terminology and a correction path.',
    since: '1.21.5',
  },
]

// ── Derived utilities ──────────────────────────────────────────────────────

/** All feature titles as a flat string array — suitable for JSON-LD featureList */
export const FEATURE_STRINGS: string[] = FEATURES.map((f) => f.title)

/** Highlighted features only — for hero sections and pricing cards */
export const HIGHLIGHTED_FEATURES: Feature[] = FEATURES.filter((f) => f.highlight)

/** Features grouped by category — for feature pages and docs */
export const FEATURES_BY_CATEGORY: Record<FeatureCategory, Feature[]> = {
  transcription: [],
  'ai-outputs': [],
  calling: [],
  templates: [],
  compliance: [],
  collaboration: [],
  platform: [],
}
for (const feature of FEATURES) {
  FEATURES_BY_CATEGORY[feature.category].push(feature)
}
