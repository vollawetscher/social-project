export interface ChangelogEntry {
  version: string;
  date: string;
  category: 'feature' | 'improvement' | 'fix' | 'security';
  title: string;
  description: string;
}

export interface ChangelogVersion {
  version: string;
  date: string;
  entries: ChangelogEntry[];
}

export const changelog: ChangelogVersion[] = [
  {
    version: '1.4.0',
    date: 'January 24, 2026',
    entries: [
      {
        version: '1.4.0',
        date: 'January 24, 2026',
        category: 'feature',
        title: 'Changelog & What\'s New',
        description: 'Added a beautiful changelog feature accessible from the profile and dashboard to showcase development progress and new features.',
      },
      {
        version: '1.4.0',
        date: 'January 24, 2026',
        category: 'feature',
        title: 'Case Management System',
        description: 'Introduced a complete case management system to organize sessions by case, with client tracking, status management (active, closed, archived), and session linking.',
      },
      {
        version: '1.4.0',
        date: 'January 23, 2026',
        category: 'feature',
        title: 'Recording Type Classification',
        description: 'Added ability to classify recordings by purpose: Context (pre-meeting prep), Meeting (main conversation), Dictation (post-meeting notes), Instruction (directives for client), and Addition (supplementary info).',
      },
    ],
  },
  {
    version: '1.3.0',
    date: 'January 19, 2026',
    entries: [
      {
        version: '1.3.0',
        date: 'January 19, 2026',
        category: 'feature',
        title: 'Phone Authentication (Infrastructure)',
        description: 'Implemented complete phone authentication system with OTP verification via seven.io SMS gateway. Currently maintained but not actively enabled in production.',
      },
      {
        version: '1.3.0',
        date: 'January 19, 2026',
        category: 'security',
        title: 'Email Verification',
        description: 'Added email verification column to improve account security and verification workflows.',
      },
      {
        version: '1.3.0',
        date: 'January 19, 2026',
        category: 'fix',
        title: 'Row-Level Security Improvements',
        description: 'Fixed recursive policy issues and implemented proper RLS policies for profiles and sessions.',
      },
    ],
  },
  {
    version: '1.2.0',
    date: 'January 16, 2026',
    entries: [
      {
        version: '1.2.0',
        date: 'January 16, 2026',
        category: 'feature',
        title: 'MVP Public Access',
        description: 'Made user_id nullable and added public policies to enable MVP testing without authentication.',
      },
      {
        version: '1.2.0',
        date: 'January 16, 2026',
        category: 'improvement',
        title: 'Public Storage Bucket',
        description: 'Made storage bucket public for easier audio file access during development.',
      },
    ],
  },
  {
    version: '1.1.0',
    date: 'January 15, 2026',
    entries: [
      {
        version: '1.1.0',
        date: 'January 15, 2026',
        category: 'feature',
        title: 'Audio Recording & Transcription',
        description: 'Core feature: Upload audio files, automatic transcription via Speechmatics, and AI-powered report generation.',
      },
      {
        version: '1.1.0',
        date: 'January 15, 2026',
        category: 'feature',
        title: 'PII Redaction System',
        description: 'Automatic detection and redaction of personally identifiable information (PII) in transcripts and reports with toggleable display.',
      },
      {
        version: '1.1.0',
        date: 'January 15, 2026',
        category: 'feature',
        title: 'Gesprächsbericht Generation',
        description: 'AI-powered German conversation report (Gesprächsbericht) generation from transcripts using Claude AI.',
      },
      {
        version: '1.1.0',
        date: 'January 15, 2026',
        category: 'feature',
        title: 'Audio Storage Bucket',
        description: 'Created secure storage bucket for audio files with proper access policies.',
      },
      {
        version: '1.1.0',
        date: 'January 15, 2026',
        category: 'feature',
        title: 'Profile Management',
        description: 'Automatic profile creation via trigger, with editable display names and secure RLS policies.',
      },
    ],
  },
  {
    version: '1.0.0',
    date: 'January 15, 2026',
    entries: [
      {
        version: '1.0.0',
        date: 'January 15, 2026',
        category: 'feature',
        title: 'Initial Release',
        description: 'Project foundation with Next.js, Supabase, authentication, and Rohbericht database schema.',
      },
      {
        version: '1.0.0',
        date: 'January 15, 2026',
        category: 'feature',
        title: 'Dashboard Interface',
        description: 'Created responsive dashboard layout with navigation, session list, and profile management.',
      },
      {
        version: '1.0.0',
        date: 'January 15, 2026',
        category: 'feature',
        title: 'Email & Password Authentication',
        description: 'Implemented secure user authentication with email/password via Supabase Auth.',
      },
    ],
  },
];
