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
    version: '1.50.2',
    date: 'July 2, 2026',
    entries: [
      {
        version: '1.50.2',
        date: 'July 2, 2026',
        category: 'improvement',
        title: 'Neutral Identity for Unknown Inbound Callers',
        description:
          'Inbound callers who aren\'t recognized now hear a neutral "Notissima Agent" instead of a personal assistant name. Recognized callers whose owner has an active assistant still reach that assistant.',
      },
    ],
  },
  {
    version: '1.50.1',
    date: 'July 2, 2026',
    entries: [
      {
        version: '1.50.1',
        date: 'July 2, 2026',
        category: 'improvement',
        title: 'Waiting Music Stops When the Assistant Speaks',
        description:
          'The "waiting for participant" music now stops once the voice assistant becomes active, so it no longer plays over her.',
      },
    ],
  },
  {
    version: '1.50.0',
    date: 'July 2, 2026',
    entries: [
      {
        version: '1.50.0',
        date: 'July 2, 2026',
        category: 'feature',
        title: 'Voice Assistant Can Search the Web',
        description:
          'Ask the in-call assistant about current information and it can search the web and read specific pages to answer — no longer limited to what it was trained on. You can also ask it to research a topic in the background and it will save the findings to your account as a note.',
      },
    ],
  },
  {
    version: '1.49.0',
    date: 'July 2, 2026',
    entries: [
      {
        version: '1.49.0',
        date: 'July 2, 2026',
        category: 'fix',
        title: 'Reliable Document Attachments in Calls',
        description:
          'Attaching a document during a call now works reliably, and if something does go wrong the app shows the specific reason instead of a generic error.',
      },
      {
        version: '1.49.0',
        date: 'July 2, 2026',
        category: 'fix',
        title: 'Steadier Video on Mobile Rotation',
        description:
          'Rotating your phone during a video call no longer re-triggers the camera/microphone permission prompt or briefly drops a shared screen.',
      },
    ],
  },
  {
    version: '1.48.0',
    date: 'July 2, 2026',
    entries: [
      {
        version: '1.48.0',
        date: 'July 2, 2026',
        category: 'improvement',
        title: 'Cleaner Mobile Call Screen',
        description:
          'The Notes button is now hidden during calls on mobile, where it wasn\'t usable and only cluttered the screen.',
      },
      {
        version: '1.48.0',
        date: 'July 2, 2026',
        category: 'fix',
        title: 'Ringback Tone Stops When the Call Connects',
        description:
          'On outbound calls, the caller\'s ringing tone now stops as soon as the call is answered — including calls answered by the voice assistant — instead of continuing in the background.',
      },
    ],
  },
  {
    version: '1.47.2',
    date: 'July 2, 2026',
    entries: [
      {
        version: '1.47.2',
        date: 'July 2, 2026',
        category: 'fix',
        title: 'Correct Speaker Names in Call Transcripts',
        description:
          'Fixed an issue where a call transcript could show the name of someone who was not on the call (such as an administrator who opened the session) in place of the actual participant. Speaker names are now always taken from the call\'s real participants.',
      },
    ],
  },
  {
    version: '1.47.1',
    date: 'July 2, 2026',
    entries: [
      {
        version: '1.47.1',
        date: 'July 2, 2026',
        category: 'fix',
        title: 'Smoother Transcript Cleanup',
        description:
          'Fixed a session view issue where transcript cleanup could refresh repeatedly and discard your unsaved speaker and word edits while a call was still processing.',
      },
    ],
  },
  {
    version: '1.47.0',
    date: 'July 2, 2026',
    entries: [
      {
        version: '1.47.0',
        date: 'July 2, 2026',
        category: 'fix',
        title: 'Assistant Calls Get Analysis and Suggested Outputs',
        description:
          'Sessions from assistant-enabled calls are now automatically analyzed, so the call owner gets context, suggested outputs, and one-click report generation — the same as any other call.',
      },
    ],
  },
  {
    version: '1.46.0',
    date: 'July 2, 2026',
    entries: [
      {
        version: '1.46.0',
        date: 'July 2, 2026',
        category: 'fix',
        title: 'Shared Call Transcripts Complete for Both Participants',
        description:
          'When you join another Notissima user\'s assistant-enabled call, your copy of the session now finishes processing and shows the full transcript instead of staying stuck on "transcribing".',
      },
      {
        version: '1.46.0',
        date: 'July 2, 2026',
        category: 'improvement',
        title: 'Summarize the Current Call',
        description:
          'Ask the assistant to summarize this call and it now uses the live conversation you are in, rather than an earlier finished session.',
      },
      {
        version: '1.46.0',
        date: 'July 2, 2026',
        category: 'fix',
        title: 'Assistant Sees Documents Attached Mid-Call',
        description:
          'Documents attached during a call are now picked up by the assistant right away, so you can share a file and immediately ask about it.',
      },
    ],
  },
  {
    version: '1.45.0',
    date: 'July 1, 2026',
    entries: [
      {
        version: '1.45.0',
        date: 'July 1, 2026',
        category: 'improvement',
        title: 'Multilingual Call Transcription',
        description:
          'Calls are now transcribed with automatic language detection, so conversations that switch between languages (for example German with the assistant and English with another participant) are captured accurately.',
      },
      {
        version: '1.45.0',
        date: 'July 1, 2026',
        category: 'fix',
        title: 'Reliable Voice Notes',
        description:
          'Asking the assistant to take a note now reliably saves it to your account.',
      },
      {
        version: '1.45.0',
        date: 'July 1, 2026',
        category: 'fix',
        title: 'Attach Documents in Video Calls',
        description:
          'The document attach button is now available during video calls, not just audio calls, so you can share a document with the assistant mid-call.',
      },
    ],
  },
  {
    version: '1.44.0',
    date: 'July 1, 2026',
    entries: [
      {
        version: '1.44.0',
        date: 'July 1, 2026',
        category: 'feature',
        title: 'Discuss a Document with the Voice Assistant',
        description:
          'Attach a PDF or text document to a call and the voice assistant can reference and discuss it — ask it to summarize or look up details live.',
      },
    ],
  },
  {
    version: '1.43.1',
    date: 'July 1, 2026',
    entries: [
      {
        version: '1.43.1',
        date: 'July 1, 2026',
        category: 'improvement',
        title: 'Live Transcript During Voice Assistant Calls',
        description:
          'Open the transcript view during a call to watch the conversation and the assistant\'s responses appear live, including note confirmations.',
      },
    ],
  },
  {
    version: '1.43.0',
    date: 'July 1, 2026',
    entries: [
      {
        version: '1.43.0',
        date: 'July 1, 2026',
        category: 'feature',
        title: 'Voice Assistant Can Take Notes and Recall Sessions',
        description:
          'During a call you can ask the voice assistant to save a note or tell you about your recent sessions, and it acts on your Notissima account.',
      },
    ],
  },
  {
    version: '1.42.4',
    date: 'July 1, 2026',
    entries: [
      {
        version: '1.42.4',
        date: 'July 1, 2026',
        category: 'fix',
        title: 'Readable Voice Assistant Badge & Host Controls',
        description:
          'The in-call voice assistant badge and host controls now use consistent, high-contrast text so they are easy to read.',
      },
    ],
  },
  {
    version: '1.42.3',
    date: 'June 30, 2026',
    entries: [
      {
        version: '1.42.3',
        date: 'June 30, 2026',
        category: 'improvement',
        title: 'Inbound Calls Greeted by Name',
        description:
          'When an inbound caller is recognized — a known Notissima user or a contact you recently called — the voice assistant now greets and addresses them by name.',
      },
    ],
  },
  {
    version: '1.42.2',
    date: 'June 30, 2026',
    entries: [
      {
        version: '1.42.2',
        date: 'June 30, 2026',
        category: 'improvement',
        title: 'Adjustable Voice Assistant Speed & Voice Preview',
        description:
          'You can now set how fast the voice assistant speaks, and listen to a sample of the selected voice and speed before saving.',
      },
    ],
  },
  {
    version: '1.42.1',
    date: 'June 30, 2026',
    entries: [
      {
        version: '1.42.1',
        date: 'June 30, 2026',
        category: 'fix',
        title: 'Voice Assistant Transcript Ordering',
        description:
          'The voice assistant no longer appears to reply before you finish speaking. The wake phrase and your turns are now recorded in the correct order relative to the assistant\'s responses.',
      },
    ],
  },
  {
    version: '1.42.0',
    date: 'June 30, 2026',
    entries: [
      {
        version: '1.42.0',
        date: 'June 30, 2026',
        category: 'feature',
        title: 'Inbound Phone Calls to the Voice Assistant',
        description:
          'The voice assistant can now answer inbound phone calls. It recognizes the caller by number — a known Notissima user or a callback to a recent outbound call — and saves the conversation as a session and transcript.',
      },
    ],
  },
  {
    version: '1.41.5',
    date: 'June 30, 2026',
    entries: [
      {
        version: '1.41.5',
        date: 'June 30, 2026',
        category: 'fix',
        title: 'Voice Assistant Call Sessions No Longer Lost on Hang-Up',
        description:
          'Ending a voice-assistant call no longer deletes its session before the transcript is saved, so the session and full transcript reliably appear in Notissima.',
      },
    ],
  },
  {
    version: '1.41.4',
    date: 'June 30, 2026',
    entries: [
      {
        version: '1.41.4',
        date: 'June 30, 2026',
        category: 'fix',
        title: 'Voice Assistant Sessions Always Appear',
        description:
          'Calls with the voice assistant now create a Notissima session even if no live transcript text is captured before the call ends, and outbound phone-call transcripts include the SIP participant.',
      },
    ],
  },
  {
    version: '1.41.3',
    date: 'June 29, 2026',
    entries: [
      {
        version: '1.41.3',
        date: 'June 29, 2026',
        category: 'improvement',
        title: 'Full Call Transcript with Voice Assistant',
        description:
          'Calls with the voice assistant now keep a live transcript for all human participants, while the assistant still only responds to the owner.',
      },
    ],
  },
  {
    version: '1.41.2',
    date: 'June 29, 2026',
    entries: [
      {
        version: '1.41.2',
        date: 'June 29, 2026',
        category: 'improvement',
        title: 'Voice Assistant Polish',
        description:
          'The in-call voice assistant now joins only when needed, stays out of the main participant tiles, and lets you choose a curated German voice in Settings.',
      },
    ],
  },
  {
    version: '1.41.1',
    date: 'June 29, 2026',
    entries: [
      {
        version: '1.41.1',
        date: 'June 29, 2026',
        category: 'fix',
        title: 'Voice Assistant Conversations',
        description:
          'The in-call voice assistant now answers naturally instead of echoing your question, and saves the active assistant conversation as a transcript when the call ends.',
      },
    ],
  },
  {
    version: '1.41.0',
    date: 'June 27, 2026',
    entries: [
      {
        version: '1.41.0',
        date: 'June 27, 2026',
        category: 'feature',
        title: 'In-Call Voice Assistant',
        description:
          'Enable a voice assistant in Settings that joins your calls when you turn it on. Say your wake phrase to activate it — only you can control it. Other participants can hear it, but only your microphone triggers it.',
      },
    ],
  },
  {
    version: '1.40.6',
    date: 'June 24, 2026',
    entries: [
      {
        version: '1.40.6',
        date: 'June 24, 2026',
        category: 'improvement',
        title: 'Instant Call Link Copy',
        description: 'Tap Video Call to start instantly — the invite link is copied to your clipboard automatically, ready to paste into a message. Use the bell icon to ring someone by phone instead.',
      },
    ],
  },
  {
    version: '1.40.5',
    date: 'June 16, 2026',
    entries: [
      {
        version: '1.40.5',
        date: 'June 16, 2026',
        category: 'fix',
        title: 'Reports no longer generated multiple times',
        description: 'When generating a report or output took longer than expected, the system could retry the request while the original was still running — resulting in two or three identical reports for the same session. This is now fixed: each generation job produces exactly one output, even if the underlying request is retried.',
      },
    ],
  },
  {
    version: '1.40.4',
    date: 'June 5, 2026',
    entries: [
      {
        version: '1.40.4',
        date: 'June 5, 2026',
        category: 'fix',
        title: 'No more robotic voice on the call consent screen',
        description: 'When joining a video call from a meeting link, the recording-consent screen no longer reads the text aloud in a synthetic voice. You can simply read it and tap Agree or Decline. (Spoken consent still applies to outbound phone calls, where it is read over the line.)',
      },
    ],
  },
  {
    version: '1.40.3',
    date: 'June 5, 2026',
    entries: [
      {
        version: '1.40.3',
        date: 'June 5, 2026',
        category: 'improvement',
        title: 'Better calendar invites for scheduled calls',
        description: 'Calendar invites for scheduled calls now include a 5-minute reminder, so you and your guests get a heads-up notification right before the call starts. The "What is this call for?" purpose you enter now also shows up as the calendar event title and in the reminder, so invites are instantly recognizable.',
      },
    ],
  },
  {
    version: '1.40.2',
    date: 'June 4, 2026',
    entries: [
      {
        version: '1.40.2',
        date: 'June 4, 2026',
        category: 'improvement',
        title: 'Sharper "people" in event digests',
        description: 'The event digest now separates the people who presented on stage from the people you actually met in conversation, so a networking contact no longer gets buried among the speakers. It also picks up affiliations straight from the session titles you wrote (e.g. "Matt Golubovic - Omnius"), instead of leaving them blank.',
      },
    ],
  },
  {
    version: '1.40.1',
    date: 'June 4, 2026',
    entries: [
      {
        version: '1.40.1',
        date: 'June 4, 2026',
        category: 'improvement',
        title: 'More reliable event identification',
        description: 'Identifying an Event from the web is now much more accurate — we search using the exact recording date and your project name, so the right event surfaces instead of a generic miss. And if the web still comes up empty, you can simply type the event name, venue, and dates yourself and continue — no more dead ends.',
      },
    ],
  },
  {
    version: '1.40.0',
    date: 'June 3, 2026',
    entries: [
      {
        version: '1.40.0',
        date: 'June 3, 2026',
        category: 'feature',
        title: 'Event projects',
        description: 'Recorded a stack of talks at a conference or trade show? When several recordings from the same day look like one event, we now offer to group them into an Event project in one click — and we quietly skip duplicate uploads of the same recording. Inside the project you get a single digest that synthesizes everything across all the talks: key takeaways, people met, and follow-ups, in the right order regardless of how you uploaded them.',
      },
      {
        version: '1.40.0',
        date: 'June 3, 2026',
        category: 'feature',
        title: 'Identify the event from the web',
        description: 'For an Event project, we can look up the event from the public web using a speaker\'s name and the recording date — no location tracking needed. Confirm the match and we pull in the venue, dates, and official speaker list, then use them to sharpen the digest (for example, correcting a misheard speaker name against the official program).',
      },
    ],
  },
  {
    version: '1.39.0',
    date: 'May 29, 2026',
    entries: [
      {
        version: '1.39.0',
        date: 'May 29, 2026',
        category: 'feature',
        title: 'Tell us what your call is for',
        description: 'You can now declare a purpose for any session — when you import a transcript, schedule a video call, or attach a recording to a project. The AI treats your declaration as ground truth, so it stops mislabeling, say, a post-rollout follow-up as a "training session" just because the call happened to include a demo. Drift between what you declared and what was actually discussed is treated as normal — calls go off-script, that\'s not a bug.',
      },
      {
        version: '1.39.0',
        date: 'May 29, 2026',
        category: 'improvement',
        title: 'Quick-pick session purposes per project',
        description: 'When attaching a session to a project, the dialog now suggests up to five recently-used purposes from that project as one-click chips. Projects can also set a default purpose that auto-applies to new sessions when none is provided.',
      },
    ],
  },
  {
    version: '1.38.0',
    date: 'May 29, 2026',
    entries: [
      {
        version: '1.38.0',
        date: 'May 29, 2026',
        category: 'feature',
        title: 'Smarter, type-aware Project Pulse',
        description: 'Project Pulse now reads each project through the lens of its actual type — a hire, a customer rollout, a trade show visit, a fundraise — and tells you what stage it\'s in, what\'s been covered, what\'s missing, and what typically comes next. Long projects keep their full memory: recent sessions stay in detail, older ones roll up into AI-written phase chunks, and key decisions never compress. If a session looks like a different kind of project, Pulse asks if you want to switch the lens instead of silently re-typing it.',
      },
      {
        version: '1.38.0',
        date: 'May 29, 2026',
        category: 'improvement',
        title: 'Session analysis inherits project framing',
        description: 'When a session belongs to a project, post-call analysis is now told the project\'s type and current stage so it frames suggestions through that lens — instead of starting from a blank slate every time.',
      },
    ],
  },
  {
    version: '1.37.0',
    date: 'May 29, 2026',
    entries: [
      {
        version: '1.37.0',
        date: 'May 29, 2026',
        category: 'feature',
        title: 'AI-Suggested Project Type and Role',
        description: 'When you create a project from a session, the project type (e.g. "New Hire (employer side)", "Customer Rollout") and your role in it are now suggested by AI based on the conversation. Confirm with one click or edit before saving. Type and role appear as badges on the project page and can be changed any time.',
      },
    ],
  },
  {
    version: '1.36.15',
    date: 'May 29, 2026',
    entries: [
      {
        version: '1.36.15',
        date: 'May 29, 2026',
        category: 'fix',
        title: 'Cleaner Scheduled Calls',
        description: 'Scheduled video calls that end before recording starts no longer leave behind failed empty sessions in your session list.',
      },
    ],
  },
  {
    version: '1.36.14',
    date: 'May 29, 2026',
    entries: [
      {
        version: '1.36.14',
        date: 'May 29, 2026',
        category: 'fix',
        title: 'Better Speaker Names in Calls',
        description: 'Call transcripts now use greetings like "Hey, Christian" as evidence that the speaker is talking to Christian, not that the speaker is Christian, reducing swapped speaker names.',
      },
    ],
  },
  {
    version: '1.36.13',
    date: 'May 28, 2026',
    entries: [
      {
        version: '1.36.13',
        date: 'May 28, 2026',
        category: 'fix',
        title: 'Voice Messages Show the Right Names',
        description: 'Voice messages left on your meeting link now show the visitor\'s name instead of S1, and greetings that mishear your name (for example "Herr Gruber" instead of "Kruppa") are corrected automatically.',
      },
      {
        version: '1.36.13',
        date: 'May 28, 2026',
        category: 'improvement',
        title: 'Softer Waiting Music on Calls',
        description: 'While you wait for someone to join a video or voice call, you now hear gentle hold music instead of a repeating ring tone — whether you arrived first or second.',
      },
      {
        version: '1.36.13',
        date: 'May 28, 2026',
        category: 'fix',
        title: 'Scheduled Calls Wait for Both People',
        description: 'Recordings for scheduled and invited calls now start only once the host and guest are both in the room, so early arrivals no longer inflate session length.',
      },
    ],
  },
  {
    version: '1.36.12',
    date: 'May 28, 2026',
    entries: [
      {
        version: '1.36.12',
        date: 'May 28, 2026',
        category: 'fix',
        title: 'Calls Stay Connected When Switching Tabs',
        description: 'Switching browser tabs during a call no longer drops you back to the join screen. If the connection briefly drops, Notissima reconnects automatically instead of reloading the page.',
      },
    ],
  },
  {
    version: '1.36.11',
    date: 'May 27, 2026',
    entries: [
      {
        version: '1.36.11',
        date: 'May 27, 2026',
        category: 'improvement',
        title: 'In-Call Notes Look Like Notes',
        description: 'Notes you type during a call now appear clearly as written entries from you — not as spoken dialogue in the transcript.',
      },
    ],
  },
  {
    version: '1.36.10',
    date: 'May 27, 2026',
    entries: [
      {
        version: '1.36.10',
        date: 'May 27, 2026',
        category: 'fix',
        title: 'Consent Shown Correctly on Calls',
        description: 'On personal meeting link calls, your consent is recorded when you accept the call as a registered user. Guests still confirm explicitly. Sessions no longer show duplicate guest entries.',
      },
    ],
  },
  {
    version: '1.36.9',
    date: 'May 27, 2026',
    entries: [
      {
        version: '1.36.9',
        date: 'May 27, 2026',
        category: 'feature',
        title: 'Admin Re-analyze Sessions',
        description: 'Admins can re-run AI analysis on any session to refresh speaker labels, context, and suggestions — useful when analysis logic improves or speakers were misidentified.',
      },
    ],
  },
  {
    version: '1.36.8',
    date: 'May 27, 2026',
    entries: [
      {
        version: '1.36.8',
        date: 'May 27, 2026',
        category: 'fix',
        title: 'Correct Speaker Names on Meeting Link Calls',
        description: 'When someone calls you through your personal meeting link, transcripts now correctly identify you as the host and your caller as the guest — instead of swapping who said what based on who spoke first.',
      },
    ],
  },
  {
    version: '1.36.7',
    date: 'May 27, 2026',
    entries: [
      {
        version: '1.36.7',
        date: 'May 27, 2026',
        category: 'fix',
        title: 'Notes on Personal Meeting Link Calls',
        description: 'When someone calls you through your personal meeting link, you can now take timestamped in-call notes — the same as when you start a call yourself.',
      },
    ],
  },
  {
    version: '1.36.6',
    date: 'May 27, 2026',
    entries: [
      {
        version: '1.36.6',
        date: 'May 27, 2026',
        category: 'fix',
        title: 'Scheduled Call Times Fixed',
        description: 'Rescheduled and reminder emails now show the correct local time, past dates can no longer be selected, and expired scheduled calls disappear from your upcoming list when their planned duration ends.',
      },
    ],
  },
  {
    version: '1.36.5',
    date: 'May 27, 2026',
    entries: [
      {
        version: '1.36.5',
        date: 'May 27, 2026',
        category: 'improvement',
        title: 'Full-Width Video Calls on Desktop',
        description: 'Video calls now use the full browser window on desktop — participant tiles sit side by side, and shared screens expand to fill the available space with camera previews floating in the corner.',
      },
    ],
  },
  {
    version: '1.36.4',
    date: 'May 26, 2026',
    entries: [
      {
        version: '1.36.4',
        date: 'May 26, 2026',
        category: 'feature',
        title: 'Timestamped Notes During Video Calls',
        description: 'Take notes while on a video call — each note is stamped to the moment you add it and inserted into the post-call transcript in the right place. Tap Add note to save and start the next one.',
      },
    ],
  },
  {
    version: '1.36.3',
    date: 'May 26, 2026',
    entries: [
      {
        version: '1.36.3',
        date: 'May 26, 2026',
        category: 'improvement',
        title: 'Generate Output Runs in the Background',
        description: 'When you generate an output from the modal, the dialog closes right away and generation continues in the background — the same non-blocking experience as one-click suggested outputs.',
      },
    ],
  },
  {
    version: '1.36.2',
    date: 'May 26, 2026',
    entries: [
      {
        version: '1.36.2',
        date: 'May 26, 2026',
        category: 'fix',
        title: 'Transcript Import With Speaker Status Labels',
        description: 'Pasted or uploaded transcripts with speaker status tags — like "Chris (Unverified)" — are now recognized correctly, with timestamps and speaker names preserved instead of merged into garbled text.',
      },
    ],
  },
  {
    version: '1.36.1',
    date: 'May 7, 2026',
    entries: [
      {
        version: '1.36.1',
        date: 'May 7, 2026',
        category: 'fix',
        title: 'More Reliable Analysis for German Audio',
        description: 'Fixed an issue where some audio uploads — most often longer recordings in German — could fail at the analysis step with a generic "processing failed" error. Gave the AI more room to produce a complete analysis so these sessions now succeed on the first try.',
      },
    ],
  },
  {
    version: '1.36.0',
    date: 'April 30, 2026',
    entries: [
      {
        version: '1.36.0',
        date: 'April 30, 2026',
        category: 'fix',
        title: 'Calling Tone No Longer Plays For Callees',
        description: 'When you accept an incoming video call — whether from a personal meeting link, a sent invite, or a scheduled meeting — you no longer hear the German "calling…" tone. That tone was meant for the caller waiting for you to pick up, never for the person who just answered.',
      },
      {
        version: '1.36.0',
        date: 'April 30, 2026',
        category: 'improvement',
        title: 'Soft "Joined" Tone When the Other Person Picks Up',
        description: 'A short, gentle ping plays the moment both sides are connected in a video call. The caller knows the other person joined, and the callee gets a clear "you\'re in" cue.',
      },
      {
        version: '1.36.0',
        date: 'April 30, 2026',
        category: 'fix',
        title: 'Calling Tone Stops When the Call Is Declined Or Missed',
        description: 'If the person you\'re calling declines or misses the call, the calling tone now stops immediately instead of continuing while the system catches up.',
      },
    ],
  },
  {
    version: '1.35.0',
    date: 'April 29, 2026',
    entries: [
      {
        version: '1.35.0',
        date: 'April 29, 2026',
        category: 'fix',
        title: 'Speaker Names Corrected in Call Transcripts',
        description: 'Fixed an issue where speaker names could be swapped in call transcripts (e.g., your words attributed to the other person). The system now cross-checks the first few lines of conversation to verify names are assigned to the right speaker.',
      },
      {
        version: '1.35.0',
        date: 'April 29, 2026',
        category: 'fix',
        title: 'Faster Retries for Failed Transcriptions',
        description: 'When a transcription job needs to retry due to a temporary error, it no longer re-processes the entire audio from scratch. Previously completed work is preserved, making retries much faster and reducing unnecessary processing.',
      },
      {
        version: '1.35.0',
        date: 'April 29, 2026',
        category: 'fix',
        title: 'Transcript Cleanup Applied to Outputs',
        description: 'Speaker cleanup now carries through to generated outputs with clear speaker-by-speaker attribution, so reports reflect the corrected conversation instead of just listing corrected names.',
      },
    ],
  },
  {
    version: '1.34.11',
    date: 'April 26, 2026',
    entries: [
      {
        version: '1.34.11',
        date: 'April 26, 2026',
        category: 'fix',
        title: 'Failed Uploads No Longer Stuck on "Uploading"',
        description: 'Sessions whose upload never made it off the device used to sit in the list as "Uploading" indefinitely. They are now automatically marked as failed after 10 minutes so it is clear the upload did not succeed and the session can be retried or deleted.',
      },
    ],
  },
  {
    version: '1.34.10',
    date: 'March 17, 2026',
    entries: [
      {
        version: '1.34.10',
        date: 'March 17, 2026',
        category: 'fix',
        title: 'Accurate Duration for Quick Recordings',
        description: 'Recordings made in the browser now report the true length of the captured audio instead of the wall-clock time between Start and Stop. Previously, if the tab was suspended in the background (screen lock, another app, bluetooth mic disconnect), the timer kept ticking while no audio was being captured — so a 22-second clip could show up as 10 minutes in the sessions list. The app now reads the real duration from the saved audio file and warns you when the timer and the audio disagree.',
      },
    ],
  },
  {
    version: '1.34.9',
    date: 'March 17, 2026',
    entries: [
      {
        version: '1.34.9',
        date: 'March 17, 2026',
        category: 'improvement',
        title: 'Google Docs Download in the Session View',
        description: 'The download menu in the session\'s Outputs tab now offers Google Docs alongside MD, PDF, and DOCX — identical to the output detail page, the outputs list, and shared links. All four places now offer the exact same download options.',
      },
    ],
  },
  {
    version: '1.34.8',
    date: 'March 17, 2026',
    entries: [
      {
        version: '1.34.8',
        date: 'March 17, 2026',
        category: 'improvement',
        title: 'Session Name in Download Filenames',
        description: 'Downloaded outputs now carry the session name in the filename too (for example, loerrach-followup-internes-meeting-protokoll-2026-04-23.pdf). This keeps files from different sessions distinguishable in your Downloads folder, even when they share the same template. Audio extensions like .m4a or .mp3 are stripped so the name stays readable.',
      },
    ],
  },
  {
    version: '1.34.7',
    date: 'March 17, 2026',
    entries: [
      {
        version: '1.34.7',
        date: 'March 17, 2026',
        category: 'feature',
        title: 'Download Outputs Directly From the List',
        description: 'The Outputs page now has a download button on every row — no need to open an output first. You can pick MD, PDF, DOCX, or Google Docs just like on the detail view.',
      },
      {
        version: '1.34.7',
        date: 'March 17, 2026',
        category: 'fix',
        title: 'Save Shared Outputs as Templates',
        description: 'When someone shared a session with you or handed it over, saving one of its outputs as a template used to fail with "Output not found". Collaborators and new owners can now turn shared outputs into their own reusable templates.',
      },
    ],
  },
  {
    version: '1.34.6',
    date: 'March 17, 2026',
    entries: [
      {
        version: '1.34.6',
        date: 'March 17, 2026',
        category: 'improvement',
        title: 'Consistent Filenames for Downloaded Outputs',
        description: 'Downloads from the output page, the session page, and shared links now use the same filename format: the output name plus the date (for example, meeting-notes-2026-03-17.pdf). Umlauts and special characters are converted to safe ASCII, so filenames look clean and match no matter which browser or page you download from.',
      },
    ],
  },
  {
    version: '1.34.5',
    date: 'March 17, 2026',
    entries: [
      {
        version: '1.34.5',
        date: 'March 17, 2026',
        category: 'fix',
        title: 'Clean Hand‑Off When Transferring a Session',
        description: 'When you transfer a session to another user, its generated outputs and call records now move with it. The new owner can fully manage everything that belongs to the session — open, edit, share, or delete — without anything getting stuck with the previous owner.',
      },
    ],
  },
  {
    version: '1.34.4',
    date: 'March 17, 2026',
    entries: [
      {
        version: '1.34.4',
        date: 'March 17, 2026',
        category: 'fix',
        title: 'Collaborators Can Open Shared Outputs',
        description: 'When someone shared a session with you, opening one of its generated outputs used to fail with "Output not found". Shared outputs now open correctly for everyone who has access to the session.',
      },
    ],
  },
  {
    version: '1.34.3',
    date: 'March 17, 2026',
    entries: [
      {
        version: '1.34.3',
        date: 'March 17, 2026',
        category: 'fix',
        title: 'Re‑uploading the Same File After a Failure',
        description: 'If a large audio upload failed and you picked the same file again, the new session could get stuck on "Uploading" because the browser reused the old upload target. Re‑trying now always starts a clean upload tied to the new session.',
      },
    ],
  },
  {
    version: '1.34.2',
    date: 'March 17, 2026',
    entries: [
      {
        version: '1.34.2',
        date: 'March 17, 2026',
        category: 'fix',
        title: 'Large Audio Uploads Restored',
        description: 'A recent change accidentally broke uploads of audio files larger than about 40 MB for all users. Large uploads now work again, and benefit from the more resilient chunking, retry, and error‑reporting improvements added earlier.',
      },
    ],
  },
  {
    version: '1.34.1',
    date: 'March 17, 2026',
    entries: [
      {
        version: '1.34.1',
        date: 'March 17, 2026',
        category: 'fix',
        title: 'Incoming Ringtone Stops When Call Connects',
        description: 'The incoming-call ringtone now stops the moment you join the call, instead of occasionally continuing after the video has already connected.',
      },
      {
        version: '1.34.1',
        date: 'March 17, 2026',
        category: 'fix',
        title: 'Consistent Session Status',
        description: 'Fixed a rare case where the sessions list showed "Uploading" while the session was already being transcribed. The list, detail page, and notifications now stay in sync.',
      },
      {
        version: '1.34.1',
        date: 'March 17, 2026',
        category: 'fix',
        title: 'Correct Incoming / Outgoing Call Labels',
        description: 'Call sessions are now labeled using the actual call direction (inbound or outbound) instead of the AI\u2019s transcript guess. If you manually correct a session\u2019s type, that choice is always respected.',
      },
      {
        version: '1.34.1',
        date: 'March 17, 2026',
        category: 'improvement',
        title: 'More Resilient Large Audio Uploads',
        description: 'Large audio uploads now use smaller chunks, longer retries, refresh the session mid‑upload, and show clearer error messages when something does go wrong.',
      },
      {
        version: '1.34.1',
        date: 'March 17, 2026',
        category: 'fix',
        title: 'Correct Source Label for Audio Uploads',
        description: 'Audio uploads are now correctly labeled as "Uploaded audio" in the sessions list, even when the upload did not complete. Previously such sessions could show up as "Pasted text".',
      },
      {
        version: '1.34.1',
        date: 'March 17, 2026',
        category: 'fix',
        title: 'No Retry Button When There Is Nothing to Retry',
        description: 'On failed sessions where no audio was ever attached (for example when the upload itself failed), we no longer show a Retry button that would have nothing to transcribe.',
      },
    ],
  },
  {
    version: '1.34.0',
    date: 'March 17, 2026',
    entries: [
      {
        version: '1.34.0',
        date: 'March 17, 2026',
        category: 'improvement',
        title: 'Smarter Suggestions — AI Asks When Unsure About Your Role',
        description: 'Suggested outputs and reports are now tailored to serve you, not the other party. When it is not obvious from the transcript whether you are, say, the applicant or the interviewer, the app will ask a single quick question and then regenerate suggestions from your point of view. If your role is clear, nothing extra is asked.',
      },
    ],
  },
  {
    version: '1.33.0',
    date: 'March 17, 2026',
    entries: [
      {
        version: '1.33.0',
        date: 'March 17, 2026',
        category: 'feature',
        title: 'Shared Sessions',
        description: 'Share a session with a colleague or client while keeping ownership. Collaborators can read the transcript, generate outputs, and work on cleanup — and you can still see everything, help them when they get stuck, and revoke access at any time. Prepare Trial now uses this model instead of handing ownership away.',
      },
    ],
  },
  {
    version: '1.32.1',
    date: 'March 17, 2026',
    entries: [
      {
        version: '1.32.1',
        date: 'March 17, 2026',
        category: 'fix',
        title: 'Trial Magic Link Sign-In',
        description: 'Fixed the Prepare Trial magic link that was leaving invitees stuck on a "Signing you in…" screen. Verification now happens server-side so the session is established reliably before redirecting into the app.',
      },
    ],
  },
  {
    version: '1.32.0',
    date: 'March 17, 2026',
    entries: [
      {
        version: '1.32.0',
        date: 'March 17, 2026',
        category: 'fix',
        title: 'Reversible Transcript Cleanup',
        description: 'You can now undo transcript cleanup. Removing a speaker rename, un-merging speakers, or deleting a word correction now actually persists. A new "Reset cleanup" button clears all cleanup at once and restores the original transcript. The raw transcript is and was always preserved.',
      },
    ],
  },
  {
    version: '1.31.1',
    date: 'March 17, 2026',
    entries: [
      {
        version: '1.31.1',
        date: 'March 17, 2026',
        category: 'improvement',
        title: 'Output Cost Tracking',
        description: 'Each generated output now shows its AI cost, so you can see exactly what each document costs to produce. Existing outputs are backfilled automatically.',
      },
    ],
  },
  {
    version: '1.31.0',
    date: 'March 17, 2026',
    entries: [
      {
        version: '1.31.0',
        date: 'March 17, 2026',
        category: 'feature',
        title: 'Client Trial Onboarding',
        description: 'Prepare a hands-on trial for clients in one click. Select sessions, enter their email, and share a magic link — they log in instantly and explore your curated sessions with full AI output generation.',
      },
    ],
  },
  {
    version: '1.30.0',
    date: 'March 17, 2026',
    entries: [
      {
        version: '1.30.0',
        date: 'March 17, 2026',
        category: 'feature',
        title: 'Voice Messages on Meeting Link',
        description: 'When you\'re unavailable, visitors on your meeting link can now record a voice message for you. The message is automatically transcribed and analyzed, and appears in your sessions list.',
      },
    ],
  },
  {
    version: '1.29.0',
    date: 'March 17, 2026',
    entries: [
      {
        version: '1.29.0',
        date: 'March 17, 2026',
        category: 'feature',
        title: 'Inline Speaker Editing',
        description: 'Click any speaker label in the transcript to reassign it. Fix wrong speaker diarization on individual segments — pick from existing speakers or type a new name. Changes are saved instantly.',
      },
    ],
  },
  {
    version: '1.28.0',
    date: 'March 17, 2026',
    entries: [
      {
        version: '1.28.0',
        date: 'March 17, 2026',
        category: 'feature',
        title: 'Background Task Indicator',
        description: 'The notification icon now shows a spinner when tasks like transcription, analysis, or output generation are running in the background. Tap to see what\'s processing and jump to the session.',
      },
    ],
  },
  {
    version: '1.27.2',
    date: 'April 2, 2026',
    entries: [
      {
        version: '1.27.2',
        date: 'April 2, 2026',
        category: 'improvement',
        title: 'Better Language Detection',
        description: 'Session language is now detected by AI during analysis instead of heuristics. More accurate for multilingual content and imported transcripts.',
      },
      {
        version: '1.27.2',
        date: 'April 2, 2026',
        category: 'improvement',
        title: 'Proportionate Output Length',
        description: 'Generated outputs now match the substance and stakes of your conversation. A quick internal call produces a concise summary, not a 9-page report.',
      },
    ],
  },
  {
    version: '1.27.1',
    date: 'April 2, 2026',
    entries: [
      {
        version: '1.27.1',
        date: 'April 2, 2026',
        category: 'fix',
        title: 'Ringtone & Call Quality',
        description: 'Outbound ringtone now plays reliably even when the other party picks up instantly. Changed to the familiar German Freizeichen tone (425 Hz).',
      },
      {
        version: '1.27.1',
        date: 'April 2, 2026',
        category: 'improvement',
        title: 'Smarter Session Analysis',
        description: 'Video calls between users are no longer misclassified as AI conversations. Output suggestion cards now appear in the correct language matching your session.',
      },
    ],
  },
  {
    version: '1.27.0',
    date: 'March 17, 2026',
    entries: [
      {
        version: '1.27.0',
        date: 'March 17, 2026',
        category: 'feature',
        title: 'Personal Meeting Link',
        description: 'Get your own permanent meeting URL (e.g. notissima.app/meet/your-name) that you can paste into calendar invites, emails, or messages. One click in the top bar copies it to your clipboard. Visitors enter their name and join your video call instantly.',
      },
    ],
  },
  {
    version: '1.26.0',
    date: 'March 17, 2026',
    entries: [
      {
        version: '1.26.0',
        date: 'March 17, 2026',
        category: 'feature',
        title: 'Live Push Notifications',
        description: 'Analysis and output completion now push instant notifications to the bell icon — even if you\'ve navigated away from the session. No more wondering if your document is ready.',
      },
      {
        version: '1.26.0',
        date: 'March 17, 2026',
        category: 'improvement',
        title: 'Session Workflow Guide',
        description: 'A new step-by-step progress bar guides you through Transcript → Context → Outputs on each session. Context-aware hints tell you exactly what to do next at each stage.',
      },
    ],
  },
  {
    version: '1.25.0',
    date: 'March 17, 2026',
    entries: [
      {
        version: '1.25.0',
        date: 'March 17, 2026',
        category: 'improvement',
        title: 'Smarter Speaker & Context Recognition',
        description: 'Speaker identification now works across all call types — not just PSTN. Participants are resolved before AI analysis, so summaries correctly attribute who said what. AI also suggests transcript corrections for misspelled names and false speaker splits.',
      },
    ],
  },
  {
    version: '1.24.1',
    date: 'March 17, 2026',
    entries: [
      {
        version: '1.24.1',
        date: 'March 17, 2026',
        category: 'improvement',
        title: 'Setup Reminders & Notifications',
        description: 'A notification bell now shows pending setup actions. New users are guided to record their voice sample on first login, with a gentle reminder if they choose to do it later.',
      },
    ],
  },
  {
    version: '1.24.0',
    date: 'March 17, 2026',
    entries: [
      {
        version: '1.24.0',
        date: 'March 17, 2026',
        category: 'feature',
        title: 'Multi-Language Voice Samples',
        description: 'Record voice samples in any of 38 languages so Notissima identifies you in conversations from the very first second — no more misattributed speakers at the start of calls.',
      },
    ],
  },
  {
    version: '1.23.2',
    date: 'March 17, 2026',
    entries: [
      {
        version: '1.23.2',
        date: 'March 17, 2026',
        category: 'fix',
        title: 'PSTN Live Transcript Can Run Server-Side Relay',
        description: 'Live PSTN transcript can now be sourced from a server-side LiveKit-to-Speechmatics relay, reducing client-device dependency and improving stability for real-time transcript display.',
      },
      {
        version: '1.23.2',
        date: 'March 17, 2026',
        category: 'improvement',
        title: 'Live PSTN Transcript Is Easier to Read in Real Time',
        description: 'Live call transcript now uses slower high-quality realtime settings and phrase buffering, reducing fragmented word-by-word output so on-screen transcript lines are more readable during calls.',
      },
      {
        version: '1.23.2',
        date: 'March 17, 2026',
        category: 'improvement',
        title: 'PSTN Live Mode Uses Track-Based Transcript Merging',
        description: 'For PSTN live mode, Notissima now merges participant track transcripts using LiveKit timing metadata, improving chronological accuracy and speaker separation in the final transcript.',
      },
      {
        version: '1.23.2',
        date: 'March 17, 2026',
        category: 'fix',
        title: 'Live PSTN Transcript Now Forces Remote Audio Subscription',
        description: 'In-call live transcription now explicitly subscribes to remote microphone tracks so callee audio is more reliably available for realtime transcript capture.',
      },
      {
        version: '1.23.2',
        date: 'March 17, 2026',
        category: 'improvement',
        title: 'Live Transcript Starts Automatically When Opened',
        description: 'When you open the in-call Transcript view during PSTN live mode, live capture now auto-starts so you no longer need an extra start step in most desktop call flows.',
      },
      {
        version: '1.23.2',
        date: 'March 17, 2026',
        category: 'fix',
        title: 'Live PSTN Transcript Start Is More Reliable on Mobile',
        description: 'Live transcript in calls now includes an explicit start action, improving reliability on mobile browsers that require user interaction before realtime audio capture can begin.',
      },
      {
        version: '1.23.2',
        date: 'March 17, 2026',
        category: 'fix',
        title: 'Live PSTN Transcription Better Handles German and Both Speakers',
        description: 'Live transcript preview for PSTN calls now uses profile-aware language selection and improved remote audio track capture, making German recognition and callee-side live text more reliable.',
      },
      {
        version: '1.23.2',
        date: 'March 17, 2026',
        category: 'fix',
        title: 'PSTN Live Transcript Now Captures Both Participants',
        description: 'Live transcript mode for phone-network calls now captures both sides of the conversation in separate real-time streams, so in-call transcript preview appears reliably with clearer speaker labeling.',
      },
      {
        version: '1.23.2',
        date: 'March 17, 2026',
        category: 'improvement',
        title: 'PSTN Calls Add Live or Batch Transcript Mode',
        description: 'When placing a phone-network call, you can now choose Batch transcription for maximum post-call accuracy or Live preview mode to view transcript text during the call.',
      },
      {
        version: '1.23.2',
        date: 'March 17, 2026',
        category: 'improvement',
        title: 'Output Generator Adds Short, Medium, and Long Length Control',
        description: 'When generating outputs, you can now choose Short, Medium, or Long length so results better match your preferred detail level and writing time.',
      },
      {
        version: '1.23.2',
        date: 'March 17, 2026',
        category: 'fix',
        title: 'AI Analysis Handles JSON-Wrapped Responses More Reliably',
        description: 'Session analysis now robustly parses AI responses even when wrapped in markdown code fences or extra text, reducing intermittent analysis failures.',
      },
      {
        version: '1.23.2',
        date: 'March 17, 2026',
        category: 'improvement',
        title: 'AI Requests Now Use Adaptive Token Budgets',
        description: 'Session analysis and output generation now use dynamic token budgets based on prompt size and task type, improving cost efficiency while keeping output quality stable.',
      },
      {
        version: '1.23.2',
        date: 'March 17, 2026',
        category: 'fix',
        title: 'Cleanup Refresh No Longer Repeats Applied Suggestions',
        description: 'Transcript cleanup refresh now suppresses suggestions you already applied, so accepted speaker merges and word fixes don\'t keep reappearing.',
      },
      {
        version: '1.23.2',
        date: 'March 17, 2026',
        category: 'improvement',
        title: 'Upload Preview Lets You Force Transcription Language',
        description: 'When uploading audio, you can now choose Auto detection or a fixed transcription language directly in the upload preview, making side-by-side diarization testing more reliable.',
      },
      {
        version: '1.23.2',
        date: 'March 17, 2026',
        category: 'improvement',
        title: 'Transcript Cleanup Panel Is Collapsible and Localized',
        description: 'The transcript cleanup workspace can now be collapsed for a cleaner session view, and its labels and actions now follow your app language for a more consistent editing flow.',
      },
      {
        version: '1.23.2',
        date: 'March 17, 2026',
        category: 'improvement',
        title: 'Admin Pipeline Timeline Adds End-to-End Job Visibility',
        description: 'Admins can now inspect a per-session pipeline timeline that logs transcribe, analyze, and output stage events with metadata like provider job IDs to diagnose failures faster.',
      },
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
      {
        version: '1.23.2',
        date: 'March 17, 2026',
        category: 'improvement',
        title: 'Transcript Cleanup Now Combines Speaker and Word Corrections',
        description: 'Each session now offers a unified transcript cleanup step where you can map speakers, merge false one-off speakers, and apply correction suggestions before generating outputs.',
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
