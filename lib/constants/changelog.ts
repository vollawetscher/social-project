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
    version: '1.23.2',
    date: 'March 17, 2026',
    entries: [
      {
        version: '1.23.2',
        date: 'March 17, 2026',
        category: 'improvement',
        title: 'Projects View Is Cleaner and Easier to Return To',
        description: 'Projects mode now has a cleaner focus without Record and Upload blocks, and returning from a project detail page keeps you in the Projects list context.',
      },
      {
        version: '1.23.2',
        date: 'March 17, 2026',
        category: 'improvement',
        title: 'Project Sessions Open as Expandable Detail Items',
        description: 'Project session lists now start compact and can be expanded inline to reveal communication details like participants, purpose, highlights, and notes before opening the full session.',
      },
      {
        version: '1.23.2',
        date: 'March 17, 2026',
        category: 'improvement',
        title: 'Smoother Session Expand Animations in Projects',
        description: 'Expanding a session in Projects now feels more fluid, with a smoother chevron turn and a subtle visual twinkle when details open.',
      },
      {
        version: '1.23.2',
        date: 'March 17, 2026',
        category: 'fix',
        title: 'Low-Speech Audio No Longer Flags Queue Health as Critical',
        description: 'Audio files with too little usable speech are now handled as expected no-content transcriptions instead of hard queue failures, so queue health alerts better reflect real system issues.',
      },
      {
        version: '1.23.2',
        date: 'March 17, 2026',
        category: 'improvement',
        title: 'Smarter Reachability Checks for App-to-App Calls',
        description: 'Before placing an in-app invite call, Notissima now checks recent app heartbeat signals to estimate whether the callee is likely reachable, offline, or unknown so fallback actions can be chosen faster.',
      },
      {
        version: '1.23.2',
        date: 'March 17, 2026',
        category: 'improvement',
        title: 'Planned Video Call Invite Selection Is More Visible',
        description: 'Selected email contacts in the Plan Video Call dialog now use a stronger highlight color and clearer text contrast so selected recipients are easier to confirm at a glance.',
      },
      {
        version: '1.23.2',
        date: 'March 17, 2026',
        category: 'security',
        title: 'Database Views Now Enforce Caller Permissions',
        description: 'Security-sensitive reporting views now run with caller-level permissions and tighter access grants, reducing the risk of unintended cross-user data exposure.',
      },
      {
        version: '1.23.2',
        date: 'March 17, 2026',
        category: 'improvement',
        title: 'Admin Dashboard Shows Per-User Cost Estimates',
        description: 'Admins can now see estimated usage costs per user (transcription, AI token usage, and email spend) with period filters to better monitor billable activity.',
      },
      {
        version: '1.23.2',
        date: 'March 17, 2026',
        category: 'improvement',
        title: 'Project Pulse Corrections and Overrides',
        description: 'Project owners can now directly correct Pulse intent, direction, and narrative when AI interpretation is off, so project trajectory stays trustworthy.',
      },
      {
        version: '1.23.2',
        date: 'March 17, 2026',
        category: 'improvement',
        title: 'Projects View Cards Show Track Health and Context',
        description: 'Project cards now include compact started-date and health indicators plus richer context snippets, and the search input now filters projects directly in Projects view.',
      },
      {
        version: '1.23.2',
        date: 'March 17, 2026',
        category: 'improvement',
        title: 'Project Cards Show Pulse Wave Activity',
        description: 'Projects now include a tiny pulse-wave sparkline to visualize hotness at a glance, with quieter flatline behavior for inactive workstreams.',
      },
      {
        version: '1.23.2',
        date: 'March 17, 2026',
        category: 'improvement',
        title: 'Project Pulse Wave Uses Real ECG-Style Beats',
        description: 'The mini pulse graph now uses a heartbeat-style spike pattern instead of a smooth wave, making project activity feel more intuitive at a glance.',
      },
      {
        version: '1.23.2',
        date: 'March 17, 2026',
        category: 'fix',
        title: 'Admin Cost Totals Now Match Selected Time Window',
        description: 'Cost estimates now come from a reliable aggregated data view, so all-time, 30-day, and 7-day totals are consistent and no longer undercount on larger datasets.',
      },
      {
        version: '1.23.2',
        date: 'March 17, 2026',
        category: 'improvement',
        title: 'Session Summaries Now Come from First AI Analysis',
        description: 'Notissima now creates and stores the session summary during the first AI analysis pass, reducing duplicate summarization costs while keeping project-ready context in one step.',
      },
      {
        version: '1.23.2',
        date: 'March 17, 2026',
        category: 'fix',
        title: 'All-Time Usage Totals No Longer Drop Below 30-Day Values',
        description: 'Admin usage reporting now enforces monotonic totals so all-time minutes, tokens, and cost never appear lower than the last 30 days for the same metrics.',
      },
    ],
  },
  {
    version: '1.23.1',
    date: 'March 17, 2026',
    entries: [
      {
        version: '1.23.1',
        date: 'March 17, 2026',
        category: 'fix',
        title: 'Project Pulse Health Tooltips Are Always Visible',
        description: 'Drift and momentum badges in Project Pulse now include fallback hover text, so rationale remains visible even when rich tooltip behavior is unavailable.',
      },
      {
        version: '1.23.1',
        date: 'March 17, 2026',
        category: 'improvement',
        title: 'Project Pulse Uses Stronger Project Context Anchors',
        description: 'Pulse updates now include project title, description, and reference context to improve first-intent grounding and reduce misclassification in early sessions.',
      },
    ],
  },
  {
    version: '1.23.0',
    date: 'March 17, 2026',
    entries: [
      {
        version: '1.23.0',
        date: 'March 17, 2026',
        category: 'feature',
        title: 'Project Pulse for Ongoing Project Trajectory',
        description: 'Projects now include a live Pulse panel that updates automatically as new sessions are added, so you can track direction, open loops, decisions, momentum, participants, and stakeholder-ready narrative in one place.',
      },
    ],
  },
  {
    version: '1.22.2',
    date: 'March 19, 2026',
    entries: [
      {
        version: '1.22.2',
        date: 'March 19, 2026',
        category: 'improvement',
        title: 'Sitemap and Robots.txt',
        description: 'Notissima now publishes a full sitemap covering all language variants of every public page, and a robots.txt that guides search engines away from private app routes.',
      },
      {
        version: '1.22.2',
        date: 'March 19, 2026',
        category: 'improvement',
        title: 'Hreflang and Locale-Specific Metadata',
        description: 'Each language version of the site now has its own title, description, and Open Graph locale. Search engines correctly identify language variants and serve the right version by country.',
      },
      {
        version: '1.22.2',
        date: 'March 19, 2026',
        category: 'improvement',
        title: 'Structured Data Schemas',
        description: 'The landing page now includes SoftwareApplication, Organization, WebSite, VideoObject, and FAQPage JSON-LD schemas, improving how Notissima appears in rich search results and AI-powered search engines.',
      },
    ],
  },
  {
    version: '1.22.1',
    date: 'March 19, 2026',
    entries: [
      {
        version: '1.22.1',
        date: 'March 19, 2026',
        category: 'feature',
        title: 'Landing Page in German and Spanish',
        description: 'The full landing page — navigation, hero copy, use-case widget, example chips, thinking steps, FAQ, and footer — is now available in German and Spanish. Language is detected automatically from your browser setting.',
      },
      {
        version: '1.22.1',
        date: 'March 19, 2026',
        category: 'improvement',
        title: 'Jurisdiction-Aware Terminology from Browser Locale',
        description: 'When no location is mentioned in your role description, the use-case widget now infers your jurisdiction from your browser language (e.g. de-DE → German civil law). Explicit mentions in the input always take precedence.',
      },
      {
        version: '1.22.1',
        date: 'March 19, 2026',
        category: 'feature',
        title: 'Widget Lead Capture and Conversion Tracking',
        description: 'Role descriptions, AI classifications, corrections, and use-case widget CTA clicks are now tracked anonymously. When a visitor signs up, their widget session is linked to their account — enabling role-description to actual-usage correlation for future output improvements.',
      },
      {
        version: '1.22.1',
        date: 'March 19, 2026',
        category: 'improvement',
        title: 'Locale-Specific Example Chips',
        description: 'Example role chips on the landing page now reflect the visitor\'s locale — German visitors see DACH-relevant examples, Spanish visitors see Iberian and LatAm examples, and English visitors see UK/US/EU examples.',
      },
    ],
  },
  {
    version: '1.22.0',
    date: 'March 19, 2026',
    entries: [
      {
        version: '1.22.0',
        date: 'March 19, 2026',
        category: 'feature',
        title: 'Voice Call: WebCall or Phone Network',
        description: 'Audio Call is now Voice Call. When starting a voice call you can choose between a browser-based WebCall or a Phone Network (PSTN) call. For phone calls, you can enter a number and create a contact in a single workflow.',
      },
      {
        version: '1.22.0',
        date: 'March 19, 2026',
        category: 'improvement',
        title: 'Hold and Mute Visibility',
        description: 'Both call participants can now see when the other side is on hold or muted. Hold state is shown as a badge, banner, and avatar tint — only the call initiator can place a call on hold.',
      },
      {
        version: '1.22.0',
        date: 'March 19, 2026',
        category: 'feature',
        title: 'Raw Text Import Mode',
        description: 'The upload preview parser now supports a Raw Text mode that preserves text as-is without forcing a transcript format. Content is split into readable paragraphs — useful for importing knowledge dumps, email threads, or any unstructured text for AI analysis.',
      },
      {
        version: '1.22.0',
        date: 'March 19, 2026',
        category: 'improvement',
        title: 'Google Docs Download Format',
        description: 'Outputs can now be downloaded in Google Docs format from both the session view and shared output pages.',
      },
      {
        version: '1.22.0',
        date: 'March 19, 2026',
        category: 'improvement',
        title: 'Consent Pending Race Condition Fixed',
        description: 'Fixed a race condition in web voice calls where the initiator would briefly see "Consent Pending" even after the guest had already granted consent through the consent gate.',
      },
    ],
  },
  {
    version: '1.21.5',
    date: 'March 17, 2026',
    entries: [
      {
        version: '1.21.5',
        date: 'March 17, 2026',
        category: 'improvement',
        title: 'Clearer Icon Tooltips Across Core Screens',
        description: 'Added more hover tooltips to icon-only controls in key areas like sessions, templates, calls, and audio handling, so actions are easier to understand at a glance.',
      },
      {
        version: '1.21.5',
        date: 'March 17, 2026',
        category: 'improvement',
        title: 'Clearer Audio and Video Call Labels',
        description: 'Call options now use simpler, user-focused wording so it is easier to choose between a quick voice call and a face-to-face video call.',
      },
      {
        version: '1.21.5',
        date: 'March 17, 2026',
        category: 'improvement',
        title: 'Web vs PSTN Call Paths Made Clearer',
        description: 'Call labels now better distinguish browser-based web calls from phone-network (PSTN) calls, helping you pick the right option faster.',
      },
      {
        version: '1.21.5',
        date: 'March 17, 2026',
        category: 'fix',
        title: 'Email Output Type Added to Sample Wizard',
        description: 'Templates created from sample files can now be set to email-only output, so they no longer default to Markdown when you intend plain-text emails.',
      },
      {
        version: '1.21.5',
        date: 'March 17, 2026',
        category: 'fix',
        title: 'Mobile Landing Menu Restores Log In Access',
        description: 'The mobile landing menu now includes a direct Log in option, so returning users can sign in without switching to desktop.',
      },
      {
        version: '1.21.5',
        date: 'March 17, 2026',
        category: 'fix',
        title: 'Scheduled Call Banner Fits Mobile Screens',
        description: 'Upcoming scheduled call actions now use a mobile-friendly layout so all buttons stay visible and easy to tap on smaller screens.',
      },
      {
        version: '1.21.5',
        date: 'March 17, 2026',
        category: 'improvement',
        title: 'Scheduled Call Actions Are Compact on Mobile',
        description: 'Scheduled call cards now use icon actions (with tooltips) for delete, copy invite, and WhatsApp share, keeping more room for your contacts list on small screens.',
      },
      {
        version: '1.21.5',
        date: 'March 17, 2026',
        category: 'improvement',
        title: 'Video Call Option Is More Visually Clear',
        description: 'The Video Call option now uses a clearer light-blue background and stronger contrast so it looks active and easier to recognize.',
      },
      {
        version: '1.21.5',
        date: 'March 17, 2026',
        category: 'improvement',
        title: 'Dialpad Tab Label Simplified',
        description: 'The Calls tab label is now simply “Dialpad” for a cleaner, less cluttered navigation label.',
      },
      {
        version: '1.21.5',
        date: 'March 17, 2026',
        category: 'improvement',
        title: 'Country-Based PSTN Caller ID Routing',
        description: 'Outbound PSTN calls can now route caller ID by destination country code, including support for a dedicated US number for +1 calls.',
      },
      {
        version: '1.21.5',
        date: 'March 17, 2026',
        category: 'improvement',
        title: 'US Invite SMS Now Uses Twilio Route',
        description: 'Invite SMS messages to +1 numbers now route through Twilio with country-aware sender selection, improving consistency for US call invites.',
      },
      {
        version: '1.21.5',
        date: 'March 17, 2026',
        category: 'improvement',
        title: 'Automatic Marketplace Language Matching',
        description: 'The marketplace now automatically shows templates in your selected language — no manual language filter needed. Switch your app language and the marketplace adapts instantly.',
      },
      {
        version: '1.21.5',
        date: 'March 17, 2026',
        category: 'fix',
        title: 'Session-Language Suggestions Follow Transcript Language',
        description: 'When report language is set to “session language,” suggested outputs now use the detected transcript language instead of stale session defaults.',
      },
      {
        version: '1.21.5',
        date: 'March 17, 2026',
        category: 'fix',
        title: 'PSTN Speaker Mapping Is More Reliable',
        description: 'PSTN calls now use call metadata and self-introduction cues to map caller/callee names more robustly, reducing unresolved S1/S2/S3 speaker labels.',
      },
      {
        version: '1.21.5',
        date: 'March 17, 2026',
        category: 'fix',
        title: 'Context Edits No Longer Override AI Domain Detection',
        description: 'Editing context fields now preserves AI-detected recording type and domain unless you explicitly change those classification controls.',
      },
      {
        version: '1.21.5',
        date: 'March 17, 2026',
        category: 'improvement',
        title: 'Classification Overrides Require Low AI Confidence',
        description: 'Recording type and domain overrides are now available only when AI confidence is below the threshold, reducing accidental replacement of high-confidence classifications.',
      },
      {
        version: '1.21.5',
        date: 'March 17, 2026',
        category: 'improvement',
        title: 'Participant Identity Auto-Detects from User Name',
        description: 'Context editing now auto-detects which participant is you by comparing participant names with your profile name, reducing manual role-selection steps.',
      },
      {
        version: '1.21.5',
        date: 'March 17, 2026',
        category: 'improvement',
        title: 'Richer Speechmatics Session Summaries',
        description: 'Session-level Speechmatics summaries now use a more detailed mode to preserve more context for project history and follow-up workflows.',
      },
      {
        version: '1.21.5',
        date: 'March 17, 2026',
        category: 'improvement',
        title: 'Dynamic Speechmatics Dictionary from Session Context',
        description: 'Transcription now sends a richer vocabulary built from participants, context, corrections, and call contact names to improve recognition accuracy and summary quality.',
      },
      {
        version: '1.21.5',
        date: 'March 17, 2026',
        category: 'improvement',
        title: 'Cleaner Recording Classification Badge',
        description: 'The recording classification badge now appears left-aligned without the extra “Type” label, making the context panel cleaner and easier to scan.',
      },
      {
        version: '1.21.5',
        date: 'March 17, 2026',
        category: 'improvement',
        title: 'Suggested Outputs Now Show Target Audience',
        description: 'AI suggestions now include the intended audience (such as internal, client-facing, or executive), so one-click generation better matches who the output is meant for.',
      },
      {
        version: '1.21.5',
        date: 'March 17, 2026',
        category: 'improvement',
        title: 'Speechmatics Summaries Are Now Compact and Structured',
        description: 'Session summaries are now generated in a shorter format and normalized into clear bullet points, making them easier to scan without losing key points.',
      },
      {
        version: '1.21.5',
        date: 'March 17, 2026',
        category: 'fix',
        title: 'Uploaded Audio Outputs Use Recording Date/Time',
        description: 'Outputs generated from uploaded audio now use the recording session date and time instead of the current time, so report timing matches the actual conversation.',
      },
      {
        version: '1.21.5',
        date: 'March 17, 2026',
        category: 'improvement',
        title: 'Text Imports Now Include Session Summaries',
        description: 'Sessions created from pasted or uploaded transcript content now include an automatic concise summary, so key points are visible immediately even without audio transcription.',
      },
      {
        version: '1.21.5',
        date: 'March 17, 2026',
        category: 'improvement',
        title: 'Infrastructure Card Adds Compliance Matrix',
        description: 'Settings now include a searchable compliance matrix with provider DPA, security, and subprocessor links, making legal and security checks faster and easier.',
      },
      {
        version: '1.21.5',
        date: 'March 17, 2026',
        category: 'improvement',
        title: 'seven.io Added to Infrastructure Compliance View',
        description: 'The Infrastructure and Security section now includes seven.io in both provider cards and the compliance matrix, so SMS routing documentation is visible alongside the rest of the stack.',
      },
      {
        version: '1.21.5',
        date: 'March 17, 2026',
        category: 'improvement',
        title: 'Compliance Links Updated for LiveKit, Railway, and seven.io',
        description: 'Provider documentation links and verification status were updated with current DPA, security, and subprocessor sources to make compliance checks more accurate.',
      },
      {
        version: '1.21.5',
        date: 'March 17, 2026',
        category: 'improvement',
        title: 'Compliance Matrix Adds Missing-Items Checklist',
        description: 'The compliance matrix now highlights missing documentation fields per provider and includes a one-click filter to review unresolved items faster.',
      },
      {
        version: '1.21.5',
        date: 'March 17, 2026',
        category: 'feature',
        title: 'Landing Page Adds Interactive Use-Case Finder',
        description: 'A new 3-step inline widget helps you map your role to practical Notissima outputs and conversation sources before starting your free trial.',
      },
      {
        version: '1.21.5',
        date: 'March 17, 2026',
        category: 'improvement',
        title: 'Use-Case Finder Adds Multi-Select and Deeper Personalization',
        description: 'The landing use-case flow now supports multiple selected use cases, includes work-mode profiling (owner vs in-house), adds stronger role-specific suggestions such as HR interview summaries, and better highlights templates and output formats.',
      },
      {
        version: '1.21.5',
        date: 'March 17, 2026',
        category: 'fix',
        title: 'Use-Case Finder Adds Journalism-Specific Suggestions',
        description: 'Journalist and editor profiles now get newsroom-relevant use cases and output mappings such as quote extraction, editorial recaps, and fact-check logs instead of generic documentation suggestions.',
      },
      {
        version: '1.21.5',
        date: 'March 17, 2026',
        category: 'improvement',
        title: 'Use-Case Finder Now Generates Recommendations for Any Role',
        description: 'The landing widget now uses AI to generate role-specific use cases and documentation outputs dynamically for any job title instead of relying on fixed profession profiles.',
      },
      {
        version: '1.21.5',
        date: 'March 17, 2026',
        category: 'improvement',
        title: 'Use-Case Finder Improves Domain-Aware Self-Descriptions',
        description: 'Step 1 now supports richer role descriptions (not just job titles), extracts a clearer domain signal, and feeds it into recommendations for better fit across diverse profiles.',
      },
      {
        version: '1.21.5',
        date: 'March 17, 2026',
        category: 'improvement',
        title: 'Use-Case Finder Streamlines to One AI Call',
        description: 'The landing flow now turns your self-description into immediate personalized output in one step, with an optional correction path for quick refinements.',
      },
      {
        version: '1.21.5',
        date: 'March 17, 2026',
        category: 'improvement',
        title: 'Use-Case Finder Adds Compliance and Security Affirmations',
        description: 'Use-case results now include dedicated compliance and security affirmations per recommendation so trust and governance expectations are clear from the first output.',
      },
      {
        version: '1.21.5',
        date: 'March 17, 2026',
        category: 'improvement',
        title: 'Use-Case Finder Uses Clearer Explain Action',
        description: 'The role input action now uses “Explain” instead of “Generate” to better reflect that Notissima interprets your self-description and returns tailored recommendations.',
      },
      {
        version: '1.21.5',
        date: 'March 17, 2026',
        category: 'fix',
        title: 'One-Click Suggestions Now Respect Session Language',
        description: 'Generating output from suggested formats now follows your session/transcript language logic instead of falling back to profile defaults, preventing cross-language mismatches.',
      },
      {
        version: '1.21.5',
        date: 'March 17, 2026',
        category: 'fix',
        title: 'Auto-Language Outputs Detect Pasted Transcript Language',
        description: 'When pasted-content sessions use Auto language and transcript metadata is missing, output generation now infers language from transcript text so Japanese (and other languages) no longer fall back to German.',
      },
      {
        version: '1.21.5',
        date: 'March 17, 2026',
        category: 'improvement',
        title: 'Project Detail View Is Cleaner on Desktop',
        description: 'The project detail page now uses a wider desktop layout and removes the New Session shortcut, keeping project management focused on existing sessions.',
      },
      {
        version: '1.21.5',
        date: 'March 17, 2026',
        category: 'improvement',
        title: 'Output Generation Now Runs Through Async Jobs',
        description: 'Output creation requests now run through a background job pipeline with progress polling, improving reliability for long-running AI generations.',
      },
      {
        version: '1.21.5',
        date: 'March 17, 2026',
        category: 'improvement',
        title: 'Transcription Follow-Up Uses Durable Job Queue',
        description: 'Post-transcription analyze and generation follow-up now runs through queued background jobs, reducing dropped processing during long-running AI workflows.',
      },
      {
        version: '1.21.5',
        date: 'March 17, 2026',
        category: 'improvement',
        title: 'Queue Failures Now Appear in Bug Reporting',
        description: 'Async job worker failures are now logged with job context into the central error log, making queue issues visible in Bug Reporting and easier to debug.',
      },
      {
        version: '1.21.5',
        date: 'March 17, 2026',
        category: 'improvement',
        title: 'Settings Adds Live Queue Health for Admins',
        description: 'Infrastructure settings now include a live queue health panel for admins with backlog, retries, and failure-rate indicators to speed up operational checks.',
      },
      {
        version: '1.21.5',
        date: 'March 17, 2026',
        category: 'improvement',
        title: 'Heavy Text-Import Structuring Now Runs in Queue',
        description: 'Large or messy transcript imports now queue AI structuring in the background and return quickly, improving reliability under concurrent imports.',
      },
    ],
  },
  {
    version: '1.21.4',
    date: 'March 17, 2026',
    entries: [
      {
        version: '1.21.4',
        date: 'March 17, 2026',
        category: 'improvement',
        title: 'Email-Only Templates with Plain-Text Output',
        description: 'You can now create templates that generate email-only output as plain text, so content is ready to copy and paste without Markdown formatting.',
      },
    ],
  },
  {
    version: '1.21.3',
    date: 'March 17, 2026',
    entries: [
      {
        version: '1.21.3',
        date: 'March 17, 2026',
        category: 'improvement',
        title: 'Unified Domain Tags',
        description: 'All 13 domain categories are now available everywhere — when editing templates, creating new ones, and browsing the marketplace. Previously some areas only showed 7 of the 13 domains.',
      },
    ],
  },
  {
    version: '1.21.2',
    date: 'March 16, 2026',
    entries: [
      {
        version: '1.21.2',
        date: 'March 16, 2026',
        category: 'fix',
        title: 'Marketplace Install & Rating Fixes',
        description: 'Fixed several issues with the marketplace: templates can now be reinstalled after deletion, ratings work correctly for all installed templates, and the install/rate status is always in sync.',
      },
    ],
  },
  {
    version: '1.21.1',
    date: 'March 16, 2026',
    entries: [
      {
        version: '1.21.1',
        date: 'March 16, 2026',
        category: 'improvement',
        title: 'Install-to-Rate',
        description: 'Ratings are now only available to users who have actually installed a template, ensuring more meaningful and trustworthy reviews.',
      },
    ],
  },
  {
    version: '1.21.0',
    date: 'March 11, 2026',
    entries: [
      {
        version: '1.21.0',
        date: 'March 11, 2026',
        category: 'feature',
        title: 'Creator Lead Capture',
        description: 'Template creators can now choose to receive email notifications when users install their templates. Users consent to share their email before installing, connecting creators directly with their audience.',
      },
    ],
  },
  {
    version: '1.20.43',
    date: 'March 16, 2026',
    entries: [
      {
        version: '1.20.43',
        date: 'March 16, 2026',
        category: 'fix',
        title: 'Incoming Call Actions Work More Reliably Across Devices',
        description: 'Accept and decline actions now use a more robust auth path so cross-device incoming call handling works even when browser auth cookies are temporarily out of sync.',
      },
    ],
  },
  {
    version: '1.20.42',
    date: 'March 16, 2026',
    entries: [
      {
        version: '1.20.42',
        date: 'March 16, 2026',
        category: 'fix',
        title: 'Incoming Call Accept/Decline Handles Expired Login',
        description: 'When your login has expired, incoming call accept or decline now redirects you to sign in and returns you to the call flow instead of showing a blocking authentication error.',
      },
    ],
  },
  {
    version: '1.20.41',
    date: 'March 16, 2026',
    entries: [
      {
        version: '1.20.41',
        date: 'March 16, 2026',
        category: 'fix',
        title: 'Call Session Duration No Longer Inflates',
        description: 'Call session duration now aligns with actual call window timing, preventing occasional inflated durations from appearing in session views.',
      },
    ],
  },
  {
    version: '1.20.40',
    date: 'March 13, 2026',
    entries: [
      {
        version: '1.20.40',
        date: 'March 13, 2026',
        category: 'improvement',
        title: 'Clearer Host Remove List and Smoother Background Look',
        description: 'Host controls now show clearer participant roles and readable IDs before removal, and video background processing is tuned for a smoother on-call visual result.',
      },
    ],
  },
  {
    version: '1.20.39',
    date: 'March 13, 2026',
    entries: [
      {
        version: '1.20.39',
        date: 'March 13, 2026',
        category: 'feature',
        title: 'Initiator Host Controls for Live Calls',
        description: 'Call initiators can now open host controls to lock/unlock room joins and remove participants directly during a live video call.',
      },
    ],
  },
  {
    version: '1.20.38',
    date: 'March 13, 2026',
    entries: [
      {
        version: '1.20.38',
        date: 'March 13, 2026',
        category: 'improvement',
        title: 'Video Call Layout Toggle Now Works',
        description: 'The resize button in video calls now switches between gallery and focus layouts, so you can quickly choose the view that fits your conversation.',
      },
    ],
  },
  {
    version: '1.20.37',
    date: 'March 13, 2026',
    entries: [
      {
        version: '1.20.37',
        date: 'March 13, 2026',
        category: 'fix',
        title: 'ICS Attachments Sent Reliably via Comm Hub',
        description: 'Scheduled call invites now use the latest Comm Hub attachment format for ICS files, with compatibility fallback, so calendar attachments are delivered more reliably.',
      },
    ],
  },
  {
    version: '1.20.36',
    date: 'March 13, 2026',
    entries: [
      {
        version: '1.20.36',
        date: 'March 13, 2026',
        category: 'fix',
        title: 'SPRECHER/ZEIT Parser Handles Inline Marker Variants',
        description: 'Transcript parsing now correctly reads SPRECHER and ZEIT blocks even when extra inline markers (like [00:01] or separator snippets) are present between fields.',
      },
    ],
  },
  {
    version: '1.20.35',
    date: 'March 13, 2026',
    entries: [
      {
        version: '1.20.35',
        date: 'March 13, 2026',
        category: 'improvement',
        title: 'Re-Parse Now Uses Detected Participant Hints',
        description: 'When re-parsing transcripts, detected participant names from context are now used as speaker hints to better split S1-style blocks into real speaker turns.',
      },
    ],
  },
  {
    version: '1.20.34',
    date: 'March 13, 2026',
    entries: [
      {
        version: '1.20.34',
        date: 'March 13, 2026',
        category: 'fix',
        title: 'More Reliable Transcript Parsing and Re-Parse',
        description: 'Speaker-label parsing is now stricter to avoid false speaker names, and transcript storage/re-parse handling is hardened to prevent JSON format issues in existing sessions.',
      },
    ],
  },
  {
    version: '1.20.33',
    date: 'March 13, 2026',
    entries: [
      {
        version: '1.20.33',
        date: 'March 13, 2026',
        category: 'fix',
        title: 'Pasted Transcript Cleanup Removes Stray S1/S2 Headers',
        description: 'When pasting transcript text, standalone legacy speaker-ID lines like “S1” are now removed if named speaker labels are present, preventing misleading speaker tags at the top of preview.',
      },
    ],
  },
  {
    version: '1.20.32',
    date: 'March 13, 2026',
    entries: [
      {
        version: '1.20.32',
        date: 'March 13, 2026',
        category: 'fix',
        title: 'External Speaker Labels Parse Correctly',
        description: 'Transcript parsing now handles labels like “EXTERNAL Name (Org/Team): …”, so external speakers keep their names and turns instead of collapsing into one speaker.',
      },
    ],
  },
  {
    version: '1.20.31',
    date: 'March 13, 2026',
    entries: [
      {
        version: '1.20.31',
        date: 'March 13, 2026',
        category: 'fix',
        title: 'Plain-Text Parse Now Keeps Inline Speaker Turns',
        description: 'When transcript text contains inline labels like “Name: ... Name: ...”, parsing now preserves speaker turns even if Plain text mode is selected.',
      },
    ],
  },
  {
    version: '1.20.30',
    date: 'March 13, 2026',
    entries: [
      {
        version: '1.20.30',
        date: 'March 13, 2026',
        category: 'improvement',
        title: 'All Users View Now Persists',
        description: 'The “All users” switch on Sessions now remembers your last state and keeps it across navigation and reloads for admins.',
      },
    ],
  },
  {
    version: '1.20.29',
    date: 'March 13, 2026',
    entries: [
      {
        version: '1.20.29',
        date: 'March 13, 2026',
        category: 'fix',
        title: 'Cleaner Parsing Controls in Transcript Flows',
        description: 'Re-parse controls are now hidden for audio-origin sessions, and the preview parse button is compact and disabled after selecting a template to support a clearer parse-first workflow.',
      },
    ],
  },
  {
    version: '1.20.28',
    date: 'March 13, 2026',
    entries: [
      {
        version: '1.20.28',
        date: 'March 13, 2026',
        category: 'fix',
        title: 'Better Parsing for Dense Inline Speaker Text',
        description: 'Transcript imports now better detect long single-block conversations with inline speaker names (e.g., “Name: ... Name: ...”), preserving speaker turns instead of collapsing into one speaker.',
      },
    ],
  },
  {
    version: '1.20.27',
    date: 'March 13, 2026',
    entries: [
      {
        version: '1.20.27',
        date: 'March 13, 2026',
        category: 'improvement',
        title: 'Back Navigation Keeps Your Original Context',
        description: 'When opening an output from a session, the Back action now returns you to that same session view instead of sending you to the generic outputs list.',
      },
    ],
  },
  {
    version: '1.20.26',
    date: 'March 13, 2026',
    entries: [
      {
        version: '1.20.26',
        date: 'March 13, 2026',
        category: 'improvement',
        title: 'Template Pick During Transcript Import',
        description: 'In transcript preview, you can now choose a template and generate an output immediately after import, giving you a faster text-to-report workflow.',
      },
    ],
  },
  {
    version: '1.20.25',
    date: 'March 13, 2026',
    entries: [
      {
        version: '1.20.25',
        date: 'March 13, 2026',
        category: 'improvement',
        title: 'Re-Parse Controls in Session Transcript View',
        description: 'You can now cycle parse modes and re-apply parsing directly from the Session Transcript tab, so imported transcripts can be corrected after import without re-uploading.',
      },
    ],
  },
  {
    version: '1.20.24',
    date: 'March 13, 2026',
    entries: [
      {
        version: '1.20.24',
        date: 'March 13, 2026',
        category: 'improvement',
        title: 'AI Structuring Now Returns Type Detection',
        description: 'When transcript AI structuring runs, it now returns both cleaned speaker segments and transcript type classification in one pass, improving consistency while reducing duplicate detection work.',
      },
    ],
  },
  {
    version: '1.20.23',
    date: 'March 13, 2026',
    entries: [
      {
        version: '1.20.23',
        date: 'March 13, 2026',
        category: 'fix',
        title: 'Improved Parse Button Readability',
        description: 'The parse-mode button in text import preview now uses stronger contrast so the label is easier to read.',
      },
    ],
  },
  {
    version: '1.20.22',
    date: 'March 13, 2026',
    entries: [
      {
        version: '1.20.22',
        date: 'March 13, 2026',
        category: 'fix',
        title: 'Imported Speaker Timestamps Preserved More Accurately',
        description: 'When transcript text includes explicit timeline markers (like 1:26 or 1:30), imports now treat them as timing data instead of transcript content, reducing synthetic timing drift in parsed sessions.',
      },
    ],
  },
  {
    version: '1.20.21',
    date: 'March 13, 2026',
    entries: [
      {
        version: '1.20.21',
        date: 'March 13, 2026',
        category: 'fix',
        title: 'Speaker Names Preserved After Preview Import',
        description: 'When importing from the text preview, selected parse mode is now applied during import so detected speaker names and existing timestamp structure are preserved instead of collapsing into unknown speaker labels.',
      },
    ],
  },
  {
    version: '1.20.20',
    date: 'March 13, 2026',
    entries: [
      {
        version: '1.20.20',
        date: 'March 13, 2026',
        category: 'improvement',
        title: 'Preview Parse Mode Switcher for Imports',
        description: 'In the text import preview, you can now cycle through different parsing modes before importing, helping you choose the format that best preserves speaker and timestamp structure.',
      },
    ],
  },
  {
    version: '1.20.19',
    date: 'March 13, 2026',
    entries: [
      {
        version: '1.20.19',
        date: 'March 13, 2026',
        category: 'improvement',
        title: 'Smarter Transcript Type Detection on Import',
        description: 'The paste preview now shows transcript-type detection before import, and transcript uploads better detect speaker-labeled and timestamped formats across drag-and-drop, file picker, and clipboard paste flows.',
      },
    ],
  },
  {
    version: '1.20.18',
    date: 'March 13, 2026',
    entries: [
      {
        version: '1.20.18',
        date: 'March 13, 2026',
        category: 'fix',
        title: 'Clearer Pasted vs Audio Session Labels',
        description: 'Session source badges now better distinguish pasted text from audio uploads, including audio files with generic MIME types that were previously mislabeled as pasted text.',
      },
    ],
  },
  {
    version: '1.20.17',
    date: 'March 13, 2026',
    entries: [
      {
        version: '1.20.17',
        date: 'March 13, 2026',
        category: 'improvement',
        title: 'Localized Quick Record Experience',
        description: 'Quick Record and its upload flow now show localized labels, actions, status messages, and guidance text so the full experience matches your selected app language.',
      },
    ],
  },
  {
    version: '1.20.16',
    date: 'March 13, 2026',
    entries: [
      {
        version: '1.20.16',
        date: 'March 13, 2026',
        category: 'fix',
        title: 'Improved Stereo Capture with External Mics',
        description: 'Recorder now requests strict 2-channel input when available and preserves stereo channels more reliably for supported USB/lapel microphones.',
      },
    ],
  },
  {
    version: '1.20.15',
    date: 'March 13, 2026',
    entries: [
      {
        version: '1.20.15',
        date: 'March 13, 2026',
        category: 'fix',
        title: 'Recorder Meter Pauses with Recording',
        description: 'When you pause a recording, the live audio level meter now pauses too, then resumes correctly when recording continues.',
      },
    ],
  },
  {
    version: '1.20.14',
    date: 'March 13, 2026',
    entries: [
      {
        version: '1.20.14',
        date: 'March 13, 2026',
        category: 'fix',
        title: 'Quick Record Works Without Login Again',
        description: 'Quick Record can now be opened without signing in, so you can capture audio instantly and upload it after creating an account.',
      },
      {
        version: '1.20.14',
        date: 'March 13, 2026',
        category: 'improvement',
        title: 'Input Device Selection for Better Stereo Capture',
        description: 'The recorder now lets you select your microphone input and checks channel support, making it easier to use external/lapel mics with stereo recording when available.',
      },
    ],
  },
  {
    version: '1.20.13',
    date: 'March 13, 2026',
    entries: [
      {
        version: '1.20.13',
        date: 'March 13, 2026',
        category: 'fix',
        title: 'PDF Download Restored in Outputs',
        description: 'The PDF option is visible again in output download menus, so you can export any generated output as PDF without it disappearing based on language.',
      },
    ],
  },
  {
    version: '1.20.12',
    date: 'March 13, 2026',
    entries: [
      {
        version: '1.20.12',
        date: 'March 13, 2026',
        category: 'fix',
        title: 'Restored Direct PSTN Dial-Out',
        description: 'Phone dial-out now connects directly again without an intermediate consent IVR step, restoring the previous outbound call flow and reliability.',
      },
    ],
  },
  {
    version: '1.20.11',
    date: 'March 13, 2026',
    entries: [
      {
        version: '1.20.11',
        date: 'March 13, 2026',
        category: 'fix',
        title: 'PSTN Consent Prompt Stability',
        description: 'Improved reliability of phone-call consent prompts by simplifying Twilio voice handling and strengthening webhook diagnostics for faster issue resolution.',
      },
    ],
  },
  {
    version: '1.20.10',
    date: 'March 13, 2026',
    entries: [
      {
        version: '1.20.10',
        date: 'March 13, 2026',
        category: 'fix',
        title: 'More Reliable PSTN Consent Calls',
        description: 'Fixed a reliability issue in phone-call consent prompts by making Twilio webhook handling more tolerant and adding stronger public URL checks for consent routing.',
      },
    ],
  },
  {
    version: '1.20.9',
    date: 'March 13, 2026',
    entries: [
      {
        version: '1.20.9',
        date: 'March 13, 2026',
        category: 'improvement',
        title: 'Calendar Attachments in Invite Emails',
        description: 'Scheduled call invite emails now include an attached ICS calendar file, making it easier for recipients to add calls directly to their calendar apps.',
      },
    ],
  },
  {
    version: '1.20.8',
    date: 'March 13, 2026',
    entries: [
      {
        version: '1.20.8',
        date: 'March 13, 2026',
        category: 'improvement',
        title: 'Custom Duration for Scheduled Calls',
        description: 'You can now choose a planned duration when scheduling video calls, and invitations include that duration so attendees get clearer calendar context.',
      },
    ],
  },
  {
    version: '1.20.7',
    date: 'March 13, 2026',
    entries: [
      {
        version: '1.20.7',
        date: 'March 13, 2026',
        category: 'improvement',
        title: 'WhatsApp Sharing for Scheduled Calls',
        description: 'Scheduled call cards now include a WhatsApp share button, so you can send join links directly in one tap while still keeping copy-link options.',
      },
    ],
  },
  {
    version: '1.20.6',
    date: 'March 13, 2026',
    entries: [
      {
        version: '1.20.6',
        date: 'March 13, 2026',
        category: 'improvement',
        title: 'Multi-Contact Scheduled Invites',
        description: 'When scheduling a video call, you can now select multiple contacts and add extra email addresses at once, so everyone receives the invite in one step.',
      },
    ],
  },
  {
    version: '1.20.5',
    date: 'March 13, 2026',
    entries: [
      {
        version: '1.20.5',
        date: 'March 13, 2026',
        category: 'improvement',
        title: 'Editable Contacts for Faster Invites',
        description: 'You can now edit saved contacts directly in the Calls screen, including phone number and email, making it easier to keep invite details up to date.',
      },
    ],
  },
  {
    version: '1.20.4',
    date: 'March 13, 2026',
    entries: [
      {
        version: '1.20.4',
        date: 'March 13, 2026',
        category: 'improvement',
        title: 'Smarter Imported Email Detection',
        description: 'When you paste or import email text, Notissima now detects external inquiries more reliably and avoids misclassifying them as dictation. This helps preserve the correct sender perspective for better analysis.',
      },
    ],
  },
  {
    version: '1.20.3',
    date: 'March 13, 2026',
    entries: [
      {
        version: '1.20.3',
        date: 'March 13, 2026',
        category: 'security',
        title: 'Phone Call Consent Before Connection',
        description: 'For outbound phone calls, consent is now captured by voice before connection is finalized. If consent is declined, the call can continue with caller-only recording so the callee is connected but their side is not recorded.',
      },
    ],
  },
  {
    version: '1.20.2',
    date: 'March 13, 2026',
    entries: [
      {
        version: '1.20.2',
        date: 'March 13, 2026',
        category: 'fix',
        title: 'Consent Prompt Before Joining Calls',
        description: 'Participants now see a consent prompt before joining both audio and video browser calls, so recording consent is explicitly confirmed up front.',
      },
    ],
  },
  {
    version: '1.20.1',
    date: 'March 13, 2026',
    entries: [
      {
        version: '1.20.1',
        date: 'March 13, 2026',
        category: 'improvement',
        title: 'Smarter AI Enhancement',
        description: 'The "Enhance with AI" button now optimizes both your generation instructions and creates a user-friendly description in one click. Descriptions are limited to 250 characters for a clean, consistent look across the Marketplace.',
      },
    ],
  },
  {
    version: '1.20.0',
    date: 'March 13, 2026',
    entries: [
      {
        version: '1.20.0',
        date: 'March 13, 2026',
        category: 'security',
        title: 'Template IP Protection',
        description: 'Your generation instructions (AI prompts) are now stored separately from the template description. Prompts are never shown publicly in the Marketplace, protecting your intellectual property when sharing templates.',
      },
      {
        version: '1.20.0',
        date: 'March 13, 2026',
        category: 'improvement',
        title: 'Clearer Template Editor',
        description: 'The template editor now has separate fields for "Description" (visible to others) and "Generation Instructions" (your AI prompt). This makes it clear what is shared publicly and what stays private.',
      },
    ],
  },
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
