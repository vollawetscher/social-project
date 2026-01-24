# Generic Meeting & Conversation Transcription System

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
- **Authentication**: Phone OTP + Email (Magic Link & Password)
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
