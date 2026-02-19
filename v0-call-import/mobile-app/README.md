# Notissima Mobile Caller App

A standalone mobile caller app for making transcribed calls via WebRTC/Twilio.

## Installation

1. Copy the entire `mobile-app` folder to your Next.js project root
2. Move contents to your app structure:
   - `mobile-app/app/mobile` → `app/mobile`
   - `mobile-app/components` → `components/mobile` (or merge with existing)
   - `mobile-app/lib` → `lib` (or merge with existing)
3. Install dependencies if not already present:
   ```bash
   npm install clsx tailwind-merge lucide-react
   ```
4. Add the CSS variables from `mobile-app/styles/mobile.css` to your `globals.css`

## File Structure

```
mobile-app/
├── app/mobile/
│   ├── layout.tsx       # Mobile-specific layout
│   ├── page.tsx         # Dialer screen (contacts, recent, dialpad)
│   └── call/
│       └── page.tsx     # Active call screen with live transcript
├── components/
│   └── ui/              # Self-contained UI components
├── lib/
│   ├── utils.ts         # Utility functions
│   ├── types.ts         # TypeScript types
│   └── mock-data.ts     # Sample data for testing
└── styles/
    └── mobile.css       # CSS variables and theme
```

## Features

- Contact search and recent calls
- Manual dialpad
- Live call screen with transcript toggle
- Call controls (mute, speaker, hold, notes)
- "Transcribed" badges for calls linked to sessions
