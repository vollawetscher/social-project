# Generic Meeting & Conversation Transcription System...

Multi-domain, multi-language transcription and report generation system with automatic domain detection and AI-powered structured reporting.

## Core Capabilities

### Multi-Domain Support
- **Automatic Domain Detection**: Social work, healthcare, business, education, legal, customer service, or general
- **Adaptive Reporting**: Report structure and terminology adapt to detected domain
- **Multi-Language**: Automatic language detection (30+ languages via Speechmatics)
- **Consistent Output**: Reports generated in the same language as the audio

### Audio Processing
- **Recording Methods**: In-browser recording + file upload (MP3, WAV, M4A, MP4, OGG, AAC, FLAC)
- **Multi-File Sessions**: Context recordings, meeting recordings, dictations, instructions, additions
- **Case Management**: Organize recordings into cases with metadata
- **Speaker Diarization**: Automatic speaker identification (S1, S2, etc.)
- **Automatic Punctuation**: Full punctuation in transcripts

### AI Features
- **Transcription**: Speechmatics API with automatic language detection
- **Report Generation**: Claude AI with domain-aware prompting
- **PII Detection**: Regex-based detection (currently displays unredacted for accuracy)
- **Structured Output**: Consistent JSON format with metadata, quotes, observations, next steps

### Security
- **Authentication**: Email (Magic Link & Password)
- **Row Level Security**: PostgreSQL RLS on all tables
- **GDPR Ready**: Data retention policies, audit trails
- **Role-Based Access**: User vs Admin permissions

## Tech Stack

- **Frontend**: Next.js 14 App Router, TypeScript, Tailwind CSS, shadcn/ui
- **Backend**: Next.js API Routes (serverless)
- **Database**: PostgreSQL + Supabase (RLS, Storage, Auth)
- **Transcription**: Speechmatics API v2 (auto language detection, diarization, punctuation)
- **AI**: Anthropic Claude Sonnet 4.5 (domain detection, report generation)
- **PDF**: jsPDF

## Landing Page (Notissima) - Implementation Playbook

This section documents everything relevant to create and maintain a public Notissima landing page in this codebase.

### Current Behavior (Important)

- `app/[locale]/page.tsx` currently redirects to `/sessions`.
- `/sessions` is protected by auth in `middleware.ts`, so unauthenticated users end up on `/login`.
- Result: there is no standalone public marketing/landing page yet.

### File Map You Need

- **Landing route**: `app/[locale]/page.tsx`
- **Global metadata/OG/Twitter/manifest**: `app/layout.tsx`
- **Locale layout and provider**: `app/[locale]/layout.tsx`
- **Locale routing config**: `i18n/routing.ts`
- **Locale-aware navigation helpers**: `i18n/navigation.ts`
- **Route protection + public asset handling**: `middleware.ts`
- **Translations**: `messages/en.json`, `messages/de.json`, `messages/es.json`
- **Brand assets**: `public/` (for example `og-image.png`, `logo.svg`, `icon-192.png`, `icon-512.png`)

### How To Create the Landing Page

1. Replace the redirect in `app/[locale]/page.tsx` with actual page content (hero, value props, CTA, trust section, etc.).
2. Use `next-intl` strings (for example `useTranslations('landing')`) instead of hardcoded copy.
3. Use locale-aware links from `@/i18n/navigation` (`Link`, `useRouter`) for CTA buttons (`/signup`, `/login`).
4. Keep the landing page public (do not add `/` to protected patterns in `middleware.ts`).
5. Ensure responsive behavior on mobile first (`sm/md/lg` breakpoints, safe spacing, readable heading line lengths).

### Localization Rules for Landing Updates

- Add/update landing copy in:
  - `messages/en.json`
  - `messages/de.json`
  - `messages/es.json`
- Keep key structure identical across all locales.
- Use explicit namespaces (recommended: `landing`) and avoid reusing app-internal keys to prevent coupling.
- For buttons and shared labels, prefer existing `common` keys when appropriate.

### SEO and Social Preview

- Base metadata is defined in `app/layout.tsx`:
  - `metadataBase`
  - `openGraph`
  - `twitter`
  - `manifest`
- If landing-specific SEO is needed (for example per locale title/description), add metadata in `app/[locale]/page.tsx` via Next.js metadata APIs.
- Keep `public/og-image.png` up to date with current landing messaging and visual identity.
- Confirm icon and manifest references in `public/manifest.json` remain valid after brand updates.

### Branding and Content Update Checklist

- Update logo/icon assets in `public/` when branding changes.
- Verify tagline consistency across:
  - landing page copy
  - login/signup pages (`app/[locale]/login/page.tsx`, `app/[locale]/signup/page.tsx`)
  - global metadata in `app/layout.tsx`
- Confirm CTA targets are correct (`/signup`, `/login`, optionally `/record` if publicly intended).

### Environment Variables Relevant to Landing

- `NEXT_PUBLIC_APP_URL`: used for metadata base URL and multiple backend-generated links.
- `NEXT_PUBLIC_SITE_URL`: used by some auth flows (for example signup redirect logic).

For production, keep both aligned to the same canonical domain to avoid inconsistent callback and preview URLs.

### Safe Update Workflow (Recommended)

1. Edit landing markup/styles in `app/[locale]/page.tsx`.
2. Update copy in all three locale files.
3. Validate:
   - `npm run lint`
   - `npm run typecheck`
   - `npm run build`
4. Manual checks:
   - `/`, `/de`, `/es` render correct localized content
   - CTA navigation works and preserves locale
   - OG image, title, and description render correctly when sharing
   - Mobile layout has no clipping/overflow

### Common Pitfalls

- Hardcoded English strings in JSX (breaks i18n consistency).
- Using `next/navigation` links for localized routes instead of `@/i18n/navigation`.
- Updating only `en` messages and forgetting `de`/`es`.
- Mismatch between `NEXT_PUBLIC_APP_URL` and `NEXT_PUBLIC_SITE_URL`.
- Accidentally making landing page auth-protected by changing `middleware.ts` patterns.

## Architecture

### Processing Pipeline
```
1. Audio Upload → Supabase Storage
2. Transcription → Speechmatics (language auto-detected, speakers identified)
3. Database → Store transcript with detected language
4. Domain Detection → Claude analyzes transcript for domain/topic
5. Report Generation → Claude generates structured report in detected language
6. PDF Export → Download formatted report
```

### Key Design Decisions
- **Stateless Transcription**: No participant names in transcripts (Sie/ich addressing)
- **Language Flow**: Speechmatics detects → Claude uses same language for report
- **Domain Agnostic**: System adapts prompts and structure based on detected domain
- **Multi-File Sessions**: Support context + meeting + dictation recordings per session
- **Unredacted Display**: PII detection runs but displays raw transcripts (low re-identification risk)

## Quick Start

### Prerequisites
- Node.js 18+
- Supabase project (database + storage + auth)
- Speechmatics API key
- Anthropic API key

### Environment Variables
```bash
# Supabase (from your Supabase project settings)
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...

# API Keys
SPEECHMATICS_API_KEY=xxx  # speechmatics.com
ANTHROPIC_API_KEY=sk-ant-xxx  # console.anthropic.com

# App URL
NEXT_PUBLIC_APP_URL=http://localhost:3000

# Optional: For auto-generation after transcription (when user has "After transcript" template set)
INTERNAL_API_SECRET=your-random-secret  # Used by transcribe job to trigger analyze + auto-generate
```

### Installation

```bash
npm install
npm run dev  # Starts on http://localhost:3000
```

### Database Schema

Migrations in `supabase/migrations/` create:

**Core Tables:**
- `profiles` - User accounts (phone/email auth, role)
- `cases` - Case management (client identifiers, status)
- `sessions` - Recording sessions (context notes, status tracking)
- `files` - Audio files (mime type, purpose: context/meeting/dictation/instruction/addition)
- `transcripts` - Speechmatics output (raw/redacted segments, detected language)
- `reports` - Claude-generated reports (detected domain + language, structured JSON)
- `pii_hits` - PII detection audit trail

**Storage:**
- `rohbericht-audio` bucket for audio files

### First Login

Create admin user after signup:
```sql
UPDATE profiles SET role = 'admin' WHERE email = 'your@email.com';
```

## Usage Flow

1. **Create Case** (optional) - Organize multiple sessions under a case
2. **Create Session** - Add context notes, internal reference
3. **Upload Audio** - Record or upload files (specify purpose: context/meeting/dictation)
4. **Automatic Processing**:
   - Transcription with language detection
   - Speaker diarization
   - Domain detection
   - Report generation in detected language
5. **Review** - View transcript, report, export PDF

## Report Structure

Generated reports include:
- **Metadata**: Date, duration, participants, detected domain/language
- **Summary**: 2-3 sentence overview
- **Key Quotes**: Timestamped important statements with speaker
- **Observations**: Factual observations from conversation
- **Topics**: Main themes discussed
- **Positive Aspects**: Strengths, resources (domain-dependent)
- **Concerns/Challenges**: Issues, risks (domain-dependent)
- **Open Questions**: Unresolved items
- **Next Steps**: Suggested actions

Structure adapts based on detected domain (e.g., social work includes resources/risks, business includes action items/decisions).

## Key Configuration

### Speechmatics Config
```typescript
{
  language: 'auto',              // Automatic language detection
  operating_point: 'enhanced',   // Best accuracy
  diarization: 'speaker',        // Speaker identification
  enable_entities: true          // Punctuation marks
}
```

### Supported Languages (Auto-Detected)
English, German, Spanish, French, Italian, Portuguese, Dutch, Swedish, Norwegian, Danish, Finnish, Polish, Czech, Russian, Ukrainian, Mandarin, Cantonese, Japanese, Korean, Arabic, Turkish, Hindi, and more (30+ total)

### Supported Domains (Auto-Detected)
- `social_work` - Client support, case management
- `healthcare` - Patient care, medical consultations
- `business` - Meetings, sales, project discussions
- `education` - Teaching, tutoring, assessments
- `legal` - Legal consultations, advice
- `customer_service` - Support calls, inquiries
- `general` - Other conversations

## Common Issues

**Transcription fails:**
- Check Speechmatics API key and credits
- Audio format must be: MP3, WAV, M4A, MP4, OGG, AAC, or FLAC (max 100MB)
- WebM NOT supported by Speechmatics

**Diarization not working:**
- Works best with raw, unedited recordings
- Fails on heavily produced audio (podcasts, YouTube videos with music/ads)
- Professional audio mixing removes acoustic cues needed for speaker separation

**Wrong language detected:**
- First few seconds matter most for detection
- Mixed-language audio may be detected as primary language
- Very short audio (<10 sec) may misdetect

**Report generation fails:**
- Check Anthropic API key and credits
- Ensure transcript exists and has content

## Production Deployment

```bash
npm run build
npm start
```

Set environment variables on your hosting platform (Vercel, Railway, etc.).

## Notes for AI Context

**This is a generic, multi-domain transcription system, NOT limited to German social work:**
- Language: Auto-detected (30+ languages)
- Domain: Auto-detected (social_work, healthcare, business, education, legal, customer_service, general)
- Report output: Same language as detected audio
- Diarization: Speaker identification (works on raw recordings, not edited content)
- Multi-file sessions: context + meeting + dictation + instruction + addition recordings
- PII: Currently displays unredacted (practical re-identification risk is low for meeting transcripts)

**Planning notes:**
- Email ingress design note: `docs/EMAIL_INGRESS_NOTE.md`
