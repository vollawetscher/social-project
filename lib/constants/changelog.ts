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
    version: '1.19.0',
    date: 'March 12, 2026',
    entries: [
      {
        version: '1.19.0',
        date: 'March 12, 2026',
        category: 'improvement',
        title: 'Smarter Session Labels',
        description: 'Sessions now show accurate origin badges: "Call", "Notissima Rec", "Uploaded audio", or "Pasted" — no more everything showing as "Upload". Badges are based on how the session was created, not guessed from AI analysis.',
      },
      {
        version: '1.19.0',
        date: 'March 12, 2026',
        category: 'fix',
        title: 'Accurate Duration for Audio Uploads',
        description: 'Fixed an issue where audio files that couldn\'t be read by the browser would silently count as 1-second recordings, making durations and combine suggestions wrong. Now shows "—" when duration is genuinely unknown.',
      },
      {
        version: '1.19.0',
        date: 'March 12, 2026',
        category: 'improvement',
        title: 'Word Count for Pasted Transcripts',
        description: 'Pasted or imported text sessions now show word count (e.g. "1,240 words") instead of file size in bytes, which gives you a more meaningful sense of how much content is there.',
      },
    ],
  },
  {
    version: '1.18.0',
    date: 'March 11, 2026',
    entries: [
      {
        version: '1.18.0',
        date: 'March 11, 2026',
        category: 'improvement',
        title: 'Restructured Marketplace Categories',
        description: 'New category structure with Business and Technical categories. Categories are now displayed in your language.',
      },
      {
        version: '1.18.0',
        date: 'March 11, 2026',
        category: 'feature',
        title: 'Date in Generated Reports',
        description: 'Optionally include today\'s date at the beginning of generated outputs. The date format adapts to your selected language.',
      },
      {
        version: '1.18.0',
        date: 'March 11, 2026',
        category: 'improvement',
        title: 'Session Name in Output Titles',
        description: 'Output titles and exported filenames now include the session name for easier identification.',
      },
      {
        version: '1.18.0',
        date: 'March 11, 2026',
        category: 'improvement',
        title: 'File Size for Uploads',
        description: 'The session list now shows file size instead of duration for uploaded files, which is more meaningful.',
      },
      {
        version: '1.18.0',
        date: 'March 11, 2026',
        category: 'improvement',
        title: 'Cleaner Template Detail Page',
        description: 'Simplified the marketplace template page — technical buttons are now only visible for creators, and the mobile view is more compact.',
      },
      {
        version: '1.18.0',
        date: 'March 11, 2026',
        category: 'security',
        title: 'Anti-Republishing Protection',
        description: 'Templates installed from the marketplace can no longer be republished, protecting the intellectual property of original creators.',
      },
    ],
  },
  {
    version: '1.17.0',
    date: 'March 5, 2026',
    entries: [
      {
        version: '1.17.0',
        date: 'March 5, 2026',
        category: 'feature',
        title: 'Community Filters & Sorting',
        description: 'Find the perfect template faster — sort by popularity, rating, or newest. Filter by language (defaults to your language) and click on a creator name to see all their templates. Creator links are shareable!',
      },
    ],
  },
  {
    version: '1.16.0',
    date: 'March 10, 2026',
    entries: [
      {
        version: '1.16.0',
        date: 'March 10, 2026',
        category: 'feature',
        title: 'Remove Your Community Templates',
        description: 'Creators can now unpublish their own templates from the community hub directly from the template detail page.',
      },
      {
        version: '1.16.0',
        date: 'March 10, 2026',
        category: 'improvement',
        title: 'Cleaner Community Overview',
        description: 'Template cards in the community overview now show only essential info. Download and JSON actions are available on the detail page.',
      },
    ],
  },
  {
    version: '1.15.0',
    date: 'March 10, 2026',
    entries: [
      {
        version: '1.15.0',
        date: 'March 10, 2026',
        category: 'feature',
        title: 'Creator Prompt Protection',
        description: 'Templates installed from the community hub now protect the creator\'s original prompt. Your know-how stays yours — users can add their own instructions on top without seeing the core recipe.',
      },
      {
        version: '1.15.0',
        date: 'March 10, 2026',
        category: 'improvement',
        title: 'Language Switcher on Landing Page',
        description: 'Switch between German, English, and Spanish directly from the landing page before logging in.',
      },
      {
        version: '1.15.0',
        date: 'March 10, 2026',
        category: 'fix',
        title: 'Localized Sample Previews',
        description: 'Template sample previews now display in your selected language instead of mixing English with your locale.',
      },
      {
        version: '1.15.0',
        date: 'March 10, 2026',
        category: 'fix',
        title: 'Faster Toast Notifications',
        description: 'Success messages now dismiss after 3 seconds instead of lingering on screen.',
      },
    ],
  },
  {
    version: '1.14.0',
    date: 'March 9, 2026',
    entries: [
      {
        version: '1.14.0',
        date: 'March 9, 2026',
        category: 'feature',
        title: 'Share Templates to Marketplace',
        description: 'Publish your personal templates directly to the marketplace with one click. Import templates from the marketplace into your collection. The marketplace and community are now browsable by anyone — no account required.',
      },
    ],
  },
  {
    version: '1.13.0',
    date: 'March 9, 2026',
    entries: [
      {
        version: '1.13.0',
        date: 'March 9, 2026',
        category: 'feature',
        title: 'Template Marketplace',
        description: 'Discover, share, and download AI transcription templates created by the community. Browse templates by category, customize them before export, and publish your own. Includes a community section with articles, Q&A, and tips.',
      },
      {
        version: '1.13.0',
        date: 'March 9, 2026',
        category: 'feature',
        title: 'Admin Dashboard',
        description: 'Administrators can now monitor all sessions across users and review bug reports in a dedicated dashboard. Filter by status, severity, or type — and resolve issues directly from the interface.',
      },
    ],
  },
  {
    version: '1.12.0',
    date: 'March 5, 2026',
    entries: [
      {
        version: '1.12.0',
        date: 'March 5, 2026',
        category: 'improvement',
        title: 'Complete Spanish & German Translations',
        description: 'The entire app is now fully translated into Spanish and German. All buttons, labels, menus, call screens, and settings now appear in your selected language — no more mixed English text.',
      },
    ],
  },
  {
    version: '1.11.0',
    date: 'February 26, 2026',
    entries: [
      {
        version: '1.11.0',
        date: 'February 26, 2026',
        category: 'improvement',
        title: 'Automatic Language Detection',
        description: 'Recording language is now auto-detected by default. No more manual language selection needed — just record and the correct language is identified automatically. You can still override per session or in Settings.',
      },
    ],
  },
  {
    version: '1.10.1',
    date: 'February 23, 2026',
    entries: [
      {
        version: '1.10.1',
        date: 'February 23, 2026',
        category: 'fix',
        title: 'Shared Call Sessions',
        description: 'Fixed an issue where sessions shared with new users after a video call could get stuck in "Transcribing" status. Shared sessions now stay functional even if the original caller removes their copy.',
      },
    ],
  },
  {
    version: '1.10.0',
    date: 'February 21, 2026',
    entries: [
      {
        version: '1.10.0',
        date: 'February 21, 2026',
        category: 'feature',
        title: 'Transcription Consent',
        description: 'Call participants now see a consent dialog before their audio is recorded. Three choices: agree to full recording, continue without being recorded (only the caller\'s side is transcribed), or leave the call. Consent is logged for compliance.',
      },
    ],
  },
  {
    version: '1.9.0',
    date: 'February 20, 2026',
    entries: [
      {
        version: '1.9.0',
        date: 'February 20, 2026',
        category: 'feature',
        title: 'Ring + SMS Video Call Invites',
        description: 'Invite someone to a video call by entering their phone number or picking a contact. Their phone rings with a short voice message and they receive an SMS with the join link — so they know to check their messages immediately.',
      },
    ],
  },
  {
    version: '1.8.0',
    date: 'February 19, 2026',
    entries: [
      {
        version: '1.8.0',
        date: 'February 19, 2026',
        category: 'feature',
        title: 'Call Guest Onboarding',
        description: 'When someone joins your video call as a guest, they can now create a free 5-day trial account after the call ends. Their account automatically includes the call recording as a session — with the full transcript and AI analysis — so they can explore Notissima with real content from your conversation.',
      },
    ],
  },
  {
    version: '1.7.0',
    date: 'February 18, 2026',
    entries: [
      {
        version: '1.7.0',
        date: 'February 18, 2026',
        category: 'feature',
        title: 'Video & Phone Calls',
        description: 'Make video calls directly in the browser or dial phone numbers from the app. Each call is automatically recorded and transcribed per speaker, then fed into your existing session pipeline for analysis and report generation.',
      },
    ],
  },
  {
    version: '1.6.0',
    date: 'February 17, 2026',
    entries: [
      {
        version: '1.6.0',
        date: 'February 17, 2026',
        category: 'feature',
        title: 'Richer Output Configuration',
        description: 'More control over generated outputs: choose from new audience types (Client-Facing, Legal, Executive), additional tones (Casual, Funny, Technical), and first-person speaker perspectives so reports can read as "I said…" from a participant\'s viewpoint. The Do/Don\'t instruction fields now suggest common options like skipping smalltalk or focusing on action items.',
      },
      {
        version: '1.6.0',
        date: 'February 17, 2026',
        category: 'improvement',
        title: 'Bug Reporter',
        description: 'Report problems directly from any session using the bug icon in the header. Your report automatically includes session context so we can diagnose issues faster.',
      },
      {
        version: '1.6.0',
        date: 'February 17, 2026',
        category: 'fix',
        title: 'Complete Reports',
        description: 'Fixed an issue where generated reports could be cut off mid-section, resulting in incomplete content. Reports now have enough room to generate fully, even for longer conversations.',
      },
      {
        version: '1.6.0',
        date: 'February 17, 2026',
        category: 'fix',
        title: 'Reliable Transcript Import',
        description: 'Pasting long conversations no longer hangs silently. You\'ll now see clear error messages if something goes wrong, and a timeout prevents indefinite waiting. All errors are tracked so we can fix root causes.',
      },
    ],
  },
  {
    version: '1.5.8',
    date: 'February 17, 2026',
    entries: [
      {
        version: '1.5.8',
        date: 'February 17, 2026',
        category: 'improvement',
        title: 'Enhanced Audio Recorder',
        description: 'The recorder now shows live audio level meters so you can see sound being captured in real time. Stereo recording is supported when you connect an external microphone, with a clear Mono/Stereo indicator. A new Audio Processing toggle lets you disable echo cancellation, noise suppression, and auto-gain for better quality with external mics.',
      },
    ],
  },
  {
    version: '1.5.7',
    date: 'February 18, 2026',
    entries: [
      {
        version: '1.5.7',
        date: 'February 18, 2026',
        category: 'feature',
        title: 'Consent & Spoken Commands in Context',
        description: 'The AI now detects transcription consent at the start of conversations and extracts voice commands (e.g. "Notissima: Create sales analysis"). Both appear in the Context panel for review—command execution logic will follow.',
      },
    ],
  },
  {
    version: '1.5.6',
    date: 'February 18, 2026',
    entries: [
      {
        version: '1.5.6',
        date: 'February 18, 2026',
        category: 'feature',
        title: 'Session Hand-Off',
        description: 'Transfer ownership of your sessions to a colleague. Click "Hand off" on any session you own, enter their email, and they get full access—useful when passing work to another team member.',
      },
    ],
  },
  {
    version: '1.5.5',
    date: 'February 18, 2026',
    entries: [
      {
        version: '1.5.5',
        date: 'February 18, 2026',
        category: 'feature',
        title: 'Content Type Hint Before Upload',
        description: 'Before uploading audio, you can now say what kind of content it is—meeting, presentation, trade show talk, or voice note. The system uses this to improve summaries and analysis.',
      },
    ],
  },
  {
    version: '1.5.4',
    date: 'February 16, 2026',
    entries: [
      {
        version: '1.5.4',
        date: 'February 16, 2026',
        category: 'feature',
        title: 'Automatic Session Summary',
        description: 'When a recording is transcribed, Speechmatics now generates a brief summary automatically. You see it right above the transcript on each session—great for quickly understanding what was discussed.',
      },
    ],
  },
  {
    version: '1.5.3',
    date: 'February 11, 2026',
    entries: [
      {
        version: '1.5.3',
        date: 'February 11, 2026',
        category: 'fix',
        title: 'Output Language Follows Your Profile',
        description: 'When generating outputs, the app now respects your preferred report language from settings. If automatic detection is wrong, your profile setting ensures reports are generated in the language you chose.',
      },
    ],
  },
  {
    version: '1.5.2',
    date: 'February 15, 2026',
    entries: [
      {
        version: '1.5.2',
        date: 'February 15, 2026',
        category: 'improvement',
        title: 'Chat Exports Preserve Both Sides',
        description: 'When you paste a chat from ChatGPT, Claude, or similar (You said / ChatGPT said format), both your messages and the AI replies are now imported—not just your prompts.',
      },
      {
        version: '1.5.2',
        date: 'February 15, 2026',
        category: 'fix',
        title: 'Share Link Extends When You Copy Again',
        description: 'If you shared an output days ago and the link expired, clicking Share and copying the link again now extends it for 3 more days. Same link, fresh expiration—recipients can open it.',
      },
    ],
  },
  {
    version: '1.5.1',
    date: 'February 15, 2026',
    entries: [
      {
        version: '1.5.1',
        date: 'February 15, 2026',
        category: 'improvement',
        title: 'Speaker Labels in Imported Transcripts',
        description: 'When you import TXT, SRT, or VTT files with speaker labels (S1, S2, Speaker 1, etc.), they are now detected and preserved—your transcript shows who said what.',
      },
      {
        version: '1.5.1',
        date: 'February 15, 2026',
        category: 'improvement',
        title: 'Better Domain & Topic Detection',
        description: 'Domain and topic analysis now samples from the start, middle, and end of long transcripts instead of only the beginning—more accurate for meetings where the main subject appears later.',
      },
      {
        version: '1.5.1',
        date: 'February 15, 2026',
        category: 'fix',
        title: 'Failed Uploads No Longer Stuck',
        description: 'When an upload fails (e.g. file too large), the session now shows as failed with an error message instead of staying in "uploading" indefinitely.',
      },
      {
        version: '1.5.1',
        date: 'February 15, 2026',
        category: 'fix',
        title: 'Share Links Load Correctly',
        description: 'Share links now load reliably. The share page also shows the correct expiration (3 days) instead of 30.',
      },
    ],
  },
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
        category: 'improvement',
        title: 'Back from Recording Without Saving',
        description: 'A Back button lets you return to the previous screen when you open recording from the app—no need to record or cancel to leave.',
      },
      {
        version: '1.5.0',
        date: 'February 11, 2026',
        category: 'feature',
        title: 'Paste Transcript from Clipboard',
        description: 'Copy a chat or transcript from anywhere, then paste (⌘V) into the transcript upload area—or click "Paste from clipboard." Chat-style content is structured automatically.',
      },
      {
        version: '1.5.0',
        date: 'February 11, 2026',
        category: 'improvement',
        title: 'Smarter Template Suggestions',
        description: 'Your custom templates are now suggested based on the session—domain, transcript content, and recording type. Legal, medical, sales, and other templates appear when they match the conversation instead of defaulting to General.',
      },
      {
        version: '1.5.0',
        date: 'February 11, 2026',
        category: 'improvement',
        title: 'Download Output as MD, PDF, or DOCX',
        description: 'When downloading an output, you can choose the format: Markdown (.md), PDF, or Word (.docx). Headings, bold, italic, lists, and blockquotes are properly converted—no more raw markdown syntax in PDF or Word.',
      },
      {
        version: '1.5.0',
        date: 'February 11, 2026',
        category: 'improvement',
        title: 'Sessions: Transcript Action Label',
        description: "The session actions menu now says 'Transcript' instead of 'Download' for clearer intent.",
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
