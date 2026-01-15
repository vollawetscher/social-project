# Rohbericht MVP

A production-ready web application for social workers to record, transcribe, and generate structured reports from client conversations using AI.

## Features

### Core Functionality
- **Magic Link Authentication**: Passwordless email-based login via Supabase Auth
- **Audio Recording**: In-browser recording using MediaRecorder API (mobile + desktop)
- **File Upload**: Support for MP3, WAV, M4A, MP4, WebM (max 100MB)
- **Automatic Transcription**: Integration with Speechmatics API for accurate German transcription with speaker diarization
- **PII Protection**: Automatic detection and redaction of personal data (names, emails, phones, addresses, dates)
- **AI Report Generation**: Structured "Rohbericht" (raw report) generation using Anthropic Claude
- **PDF Export**: Download professional PDF reports
- **Role-Based Access**: Admin users can view raw transcripts, regular users see redacted versions only

### Security & Compliance
- GDPR-compliant data handling
- Application-level PII redaction before AI processing
- Encrypted storage via Supabase
- Secure file storage in Supabase Storage buckets
- Row Level Security (RLS) on all database tables
- 90-day data retention policy (configurable)

## Tech Stack

- **Frontend**: Next.js 13 (App Router), React, TypeScript, Tailwind CSS
- **Backend**: Next.js API Routes
- **Database**: PostgreSQL via Supabase
- **Storage**: Supabase Storage (S3-compatible)
- **Authentication**: Supabase Auth (Magic Links)
- **Transcription**: Speechmatics API
- **AI**: Anthropic Claude (Sonnet 3.5)
- **PDF Generation**: jsPDF

## Prerequisites

Before you begin, ensure you have:
- Node.js 18+ installed
- A Supabase account and project
- A Speechmatics API key
- An Anthropic API key

## Environment Variables

Create or update your `.env` file with the following variables:

```bash
# Supabase Configuration (auto-configured)
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key

# External API Keys (REQUIRED)
SPEECHMATICS_API_KEY=your_speechmatics_api_key_here
ANTHROPIC_API_KEY=your_anthropic_api_key_here

# App Configuration
NEXT_PUBLIC_APP_URL=http://localhost:3000  # Change in production
```

### Getting API Keys

#### Speechmatics
1. Sign up at [https://www.speechmatics.com/](https://www.speechmatics.com/)
2. Navigate to your account settings
3. Generate an API key
4. Copy the key to `SPEECHMATICS_API_KEY` in `.env`

#### Anthropic Claude
1. Sign up at [https://console.anthropic.com/](https://console.anthropic.com/)
2. Navigate to API Keys section
3. Create a new API key
4. Copy the key to `ANTHROPIC_API_KEY` in `.env`

## Installation

1. **Install Dependencies**

```bash
npm install
```

2. **Database Setup**

The database schema has already been applied via Supabase migrations. The following tables are created:
- `profiles` - User profiles extending Supabase Auth
- `sessions` - Recording sessions with metadata
- `files` - Audio file metadata
- `transcripts` - Transcription results (raw + redacted)
- `pii_hits` - PII redaction audit trail
- `reports` - AI-generated Rohberichte

Storage bucket `rohbericht-audio` is also configured automatically.

3. **Create Initial Admin User**

After first login via Magic Link, update your user role in Supabase:

```sql
-- Run this in Supabase SQL Editor
UPDATE profiles
SET role = 'admin'
WHERE email = 'your-email@example.com';
```

## Development

Run the development server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Production Build

Build the application for production:

```bash
npm run build
```

Start the production server:

```bash
npm run start
```

## User Guide

### Login
1. Visit the application
2. Enter your email address
3. Check your email for the Magic Link
4. Click the link to log in

### Create a New Session
1. Click "Neue Sitzung" on the dashboard
2. (Optional) Enter case ID and context notes
3. Click "Erstellen"

### Record or Upload Audio
- **Recording**: Use the "Aufnehmen" tab to record directly in your browser
- **Upload**: Use the "Hochladen" tab to upload an existing audio file

### Processing Pipeline
1. **Upload**: Audio is stored securely in Supabase Storage
2. **Transcription**: Sent to Speechmatics for transcription with speaker diarization
3. **PII Redaction**: Personal data is automatically detected and redacted
4. **Report Generation**: Claude AI creates a structured Rohbericht in German
5. **Done**: View transcript and report, export as PDF

### View Results
- **Transcript**: View timestamped conversation with speaker labels
- **Report**: Structured sections including summary, observations, resources, risks, next steps
- **PDF Export**: Download professional PDF for documentation

### Admin Features
- Admins can toggle between raw and redacted transcripts
- Access to PII mapping table (via database)
- View all users' sessions

## Database Schema

### Profiles
- Links to Supabase Auth users
- Stores user role (user/admin)

### Sessions
- Metadata: date, context, case ID
- Status tracking: created → uploading → transcribing → summarizing → done
- Error logging

### Files
- Audio file metadata
- Storage path references

### Transcripts
- Raw JSON (speaker segments with timestamps)
- Redacted JSON (PII replaced)
- Full text versions
- Language detection

### PII Hits
- Type: name, phone, email, address, date
- Placeholder mapping
- Hashed original values
- Timestamp in audio

### Reports
- Full Rohbericht JSON structure
- Generated by Claude AI
- Creation timestamp

## Rohbericht Structure

The AI-generated report includes:

- **Metadaten**: Date, duration, setting, participants
- **Gesprächsverlauf**: Chronological conversation flow
- **Kernaussagen**: Key quotes with timestamps
- **Beobachtungen**: Factual observations
- **Themen**: Main topics discussed
- **Ressourcen**: Strengths and protective factors
- **Belastungen**: Risk indicators (phrased as observations, non-diagnostic)
- **Offene Punkte**: Open questions
- **Nächste Schritte**: Suggested next steps

## Security Best Practices

1. **Never commit API keys** to version control
2. **Use environment variables** for all sensitive configuration
3. **Enable MFA** on Supabase and API provider accounts
4. **Regularly rotate API keys**
5. **Monitor API usage** for unusual activity
6. **Back up database** regularly
7. **Review RLS policies** before modifying database structure
8. **Keep dependencies updated** (`npm audit`)

## Troubleshooting

### Transcription Fails
- Check `SPEECHMATICS_API_KEY` is correct
- Verify audio file format is supported
- Check Speechmatics account quota/credits

### Report Generation Fails
- Check `ANTHROPIC_API_KEY` is correct
- Verify Claude API quota/credits
- Check transcript was created successfully

### Upload Fails
- File size must be under 100MB
- Supported formats: MP3, WAV, M4A, MP4, WebM
- Check Supabase Storage bucket permissions

### Magic Link Not Received
- Check spam folder
- Verify email settings in Supabase Auth
- Ensure `NEXT_PUBLIC_APP_URL` is correct

## Data Retention

Default retention period: 90 days (configurable)

To delete old sessions:
```sql
-- Run periodically via cron or manually
DELETE FROM sessions
WHERE created_at < NOW() - INTERVAL '90 days';
```

This will cascade delete all related records (files, transcripts, reports) due to foreign key constraints.

## Support

For issues or questions:
1. Check the troubleshooting section above
2. Review database logs in Supabase
3. Check browser console for frontend errors
4. Review API response errors in Network tab

## License

MIT

## Acknowledgments

- Supabase for database and authentication
- Speechmatics for transcription services
- Anthropic for Claude AI
- Next.js team for the excellent framework
