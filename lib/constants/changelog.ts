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
    version: '1.5.0',
    date: 'February 11, 2026',
    entries: [
      {
        version: '1.5.0',
        date: 'February 11, 2026',
        category: 'feature',
        title: 'Upload Transcript Files',
        description: 'Import existing transcripts from TXT, SRT, or VTT files. Upload in the same area as audio—your transcript becomes a session instantly, with AI analysis and output generation available right away.',
      },
      {
        version: '1.5.0',
        date: 'February 11, 2026',
        category: 'feature',
        title: 'AI Structuring for Messy Transcripts',
        description: 'When you upload a file that mixes chat logs, summaries, and call excerpts, the app detects it and uses AI to reorganize it into a proper conversation transcript before analysis—cleaner results without running AI on every file.',
      },
      {
        version: '1.5.0',
        date: 'February 11, 2026',
        category: 'improvement',
        title: 'Email-Only Sign In',
        description: 'Phone/OTP sign-in is no longer available. Please use email (magic link or password) to sign in.',
      },
      {
        version: '1.5.0',
        date: 'February 11, 2026',
        category: 'fix',
        title: 'Re-upload Recordings Saved as MP4',
        description: 'Audio recorded in the app (iOS) or downloaded from a session can now be re-uploaded even when the file is detected as MP4/video—the app now accepts both audio/mp4 and video/mp4 formats.',
      },
      {
        version: '1.5.0',
        date: 'February 11, 2026',
        category: 'improvement',
        title: 'Generate Output Without Suggestions',
        description: 'A Generate Output button now appears next to Your outputs so you can choose any template and generate—even when AI suggestions are available or you already have outputs.',
      },
      {
        version: '1.5.0',
        date: 'February 11, 2026',
        category: 'improvement',
        title: 'Floating Context Panel',
        description: 'The Context & corrections panel now floats over the transcript instead of narrowing it. Scroll long transcripts while keeping the panel open—the overlay is subtle so you can interact with both.',
      },
      {
        version: '1.5.0',
        date: 'February 11, 2026',
        category: 'fix',
        title: 'Correct Speaker Names in Output Modal',
        description: 'The output perspective dropdown now shows real names (e.g. Christian, Azat) instead of S1/S2 when you\'ve added participant names or name corrections in the Context panel.',
      },
      {
        version: '1.5.0',
        date: 'February 11, 2026',
        category: 'feature',
        title: 'Word Corrections for Transcripts',
        description: 'Fix misheard words in transcripts (e.g. SPQR → speaker, Maître Spet → Mattress Bed). Add corrections in the Context panel—they apply to the transcript view and to all AI-generated outputs.',
      },
      {
        version: '1.5.0',
        date: 'February 11, 2026',
        category: 'feature',
        title: 'Template-Based Auto-Generation',
        description: 'After Transcript Completes now lets you choose any template for automatic output generation. Create a template from samples and use it exclusively for your first post-transcription output.',
      },
      {
        version: '1.5.0',
        date: 'February 11, 2026',
        category: 'feature',
        title: 'Domain-Aware Output Suggestions',
        description: 'After analyzing your transcript, the AI suggests 3 output formats that fit the conversation. A sales call might suggest minutes, internal analysis, and a team update. One click to generate.',
      },
      {
        version: '1.5.0',
        date: 'February 11, 2026',
        category: 'improvement',
        title: 'Save as Template After Seeing the Result',
        description: 'Save any output you like as a reusable template—only after you\'ve seen the result. A "Save as template" button now appears on each generated output. The first output\'s structure (headings, bullets) becomes the template\'s preview sample so you know exactly what format you\'re saving.',
      },
      {
        version: '1.5.0',
        date: 'February 11, 2026',
        category: 'feature',
        title: 'Duplicate & Translate Outputs',
        description: 'Create a translated copy of any output in another language. Use the "Translate" button on an output to duplicate it into English, German, French, Spanish, Italian, Portuguese, Dutch, Polish, or Thai - perfect for multilingual teams.',
      },
      {
        version: '1.5.0',
        date: 'February 11, 2026',
        category: 'improvement',
        title: 'AI Analysis Progress Indicator',
        description: 'While the AI analyzes your transcript, a clear indicator now shows in the Context panel so you know analysis is in progress. No more wondering if something is loading.',
      },
      {
        version: '1.5.0',
        date: 'February 11, 2026',
        category: 'feature',
        title: 'Upload Preview & Group Files',
        description: 'Before uploading, see file size and audio length for each file so you can decide what to include. Group multiple files into one session when recordings were interrupted (e.g. phone call)—they\'ll be transcribed as a single combined transcript.',
      },
      {
        version: '1.5.0',
        date: 'February 11, 2026',
        category: 'fix',
        title: 'Outputs Tab Updates Immediately',
        description: 'After generating an output (e.g. meeting minutes), the Outputs tab now refreshes automatically and switches to show your new output - no page refresh needed.',
      },
      {
        version: '1.5.0',
        date: 'February 11, 2026',
        category: 'fix',
        title: 'Output Language (Polish, French, etc.)',
        description: 'Fixed output generation for all selected languages. Polish, French, Spanish, Italian, Portuguese, and Dutch now generate correctly instead of defaulting to German.',
      },
      {
        version: '1.5.0',
        date: 'February 11, 2026',
        category: 'fix',
        title: 'Session Language Matches Transcript',
        description: 'If you upload English audio but had German selected, the session now automatically updates to show the detected language (English) after transcription. No more wrong language shown in the sessions list.',
      },
    ],
  },
  {
    version: '1.4.0',
    date: 'January 24, 2026',
    entries: [
      {
        version: '1.4.0',
        date: 'January 24, 2026',
        category: 'feature',
        title: 'Project Management (formerly Cases)',
        description: 'Organize your recordings by project or client. Track multiple sessions for the same project, manage project status, and keep all related conversations together. Note: Previously called "Cases" - now renamed to "Projects" for better clarity.',
      },
      {
        version: '1.4.0',
        date: 'January 24, 2026',
        category: 'feature',
        title: 'Bug Reporter',
        description: 'Report issues or problems directly from within the app. The system automatically captures context to help us diagnose and fix issues faster. Look for the "Problem melden" button on session pages.',
      },
      {
        version: '1.4.0',
        date: 'January 23, 2026',
        category: 'feature',
        title: 'Recording Categories',
        description: 'Classify your recordings by type: pre-meeting context, main conversation, post-meeting notes, instructions, or additional information. Better organization for different stages of your workflow.',
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
        category: 'security',
        title: 'Enhanced Security',
        description: 'Made your account and data more secure with improved authentication and access controls.',
      },
      {
        version: '1.3.0',
        date: 'January 19, 2026',
        category: 'fix',
        title: 'Reliability Improvements',
        description: 'Fixed issues to make the app more stable and reliable when accessing your sessions and profile.',
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
        category: 'improvement',
        title: 'Faster Audio Access',
        description: 'Made audio files load faster and more reliably throughout the app.',
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
        title: 'Audio Upload & Transcription',
        description: 'Upload your audio recordings and get automatic, accurate transcriptions. Supports multiple audio formats.',
      },
      {
        version: '1.1.0',
        date: 'January 15, 2026',
        category: 'feature',
        title: 'AI-Powered Reports',
        description: 'Generate professional German conversation reports (Gesprächsberichte) automatically from your transcripts using AI.',
      },
      {
        version: '1.1.0',
        date: 'January 15, 2026',
        category: 'feature',
        title: 'Privacy Protection',
        description: 'Sensitive information like names, addresses, and phone numbers are automatically detected and can be hidden with one click to protect privacy.',
      },
      {
        version: '1.1.0',
        date: 'January 15, 2026',
        category: 'feature',
        title: 'Personal Profile',
        description: 'Manage your account settings and display name in your personal profile.',
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
        title: 'Welcome to Gesprächsbericht',
        description: 'Create an account and sign in securely to start managing your conversation recordings and reports.',
      },
    ],
  },
];
