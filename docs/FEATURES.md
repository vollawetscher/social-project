# Feature List

One-liner features grouped by area.

## Authentication

- Email sign-in (magic link or password)
- Personal profile with display name and settings

## Audio & Recording

- In-browser recording with screen-off support
- File upload (MP3, WAV, M4A, MP4, OGG, AAC, FLAC)
- Separate upload areas for audio vs transcript files
- Transcript file upload: TXT, SRT, VTT (skips transcription, session ready for outputs)
- Multi-file sessions: combine context, meeting, dictation, instruction, and addition recordings
- Upload preview: see file size and audio length before uploading
- Recording categories: pre-meeting context, main conversation, post-meeting notes, instructions, additions

## Transcription

- Speechmatics transcription with automatic language detection (30+ languages)
- Speaker diarization (S1, S2, etc.)
- Automatic punctuation in transcripts
- Multi-file sessions transcribed as a single combined transcript

## Transcript & Context

- Word corrections: fix misheard words (e.g. SPQR → speaker); applies to transcript and all outputs
- Name corrections / participant names: assign real names (replaces S1/S2 in outputs)
- Floating context panel: overlay over transcript so you can scroll while corrections stay visible
- Session language auto-updates to detected language after transcription

## Output Generation

- Generate Output button: choose any template even when AI suggestions exist
- Domain-aware suggestions: AI suggests 3 output formats that fit the conversation
- Template-based auto-generation: run a chosen template automatically when transcript completes
- Output perspective: select speaker by real name (from name corrections) for first-person vs third-person
- Outputs tab refreshes immediately after generation
- Output language matches session language (Polish, French, Spanish, German, etc.)

## Templates

- Save as template: after seeing a result, save its structure as a reusable template
- Template preview sample from first output’s structure
- Templates from samples with consistent format

## Translation

- Duplicate & translate: create translated copy in English, German, French, Spanish, Italian, Portuguese, Dutch, Polish, or Thai

## Projects

- Project management: organize sessions by project/client (formerly Cases)
- Project status tracking
- Multiple sessions per project

## Security & Privacy

- Row Level Security (RLS) on all tables
- Role-based access: user vs admin
- PII detection (displays unredacted for accuracy)
- GDPR-ready: data retention, audit trails
- Bug reporter: report issues from the app with auto-captured context

## AI

- Automatic domain detection (social work, healthcare, business, education, legal, customer service, general)
- Adaptive report structure and terminology per domain
- AI analysis progress indicator in the Context panel

## UI/UX

- Mobile-first PWA with offline recording support
- Large tap targets, thumb-friendly zones
- Collapsible sections, single-column on mobile
- What’s New changelog (dashboard and profile)
