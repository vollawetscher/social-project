# Quick Record Feature - No-Auth Recording

## Overview

Social workers can now **record audio without logging in**. Recordings are stored locally on their device and can be uploaded later when authenticated.

## User Flow

### 1. **Recording (No Auth Required)**
```
User visits /record → Tap "Neue Aufnahme starten" → Record → Save locally
```

**No login needed!** Audio stays on device in IndexedDB.

### 2. **Upload (Auth Required)**
```
User taps "Alle hochladen" → Login (if needed) → Select case → Upload
```

Only upload and transcription require authentication.

## Features

### ✅ No-Auth Recording
- Visit `/record` directly (bookmark or PWA icon)
- Record unlimited audio
- Stored in browser IndexedDB
- Works offline
- No server communication until upload

### ✅ Local Storage
- IndexedDB for large audio files
- Survives browser restarts
- Shows storage usage
- Play/delete recordings locally

### ✅ PWA Support
- Add to home screen (iOS/Android)
- Install prompt on first visit
- Manifest with shortcuts
- Feels like native app

### ✅ Batch Upload
- Upload multiple recordings at once
- Select which recordings to upload
- Associate with existing case
- Auto-creates sessions
- Triggers transcription

## Technical Implementation

### Files Created

1. **`lib/services/local-storage.ts`**
   - IndexedDB wrapper
   - CRUD operations for recordings
   - Storage management

2. **`app/record/page.tsx`**
   - Public recording page (no auth)
   - List local recordings
   - Play/delete recordings
   - Quick upload button

3. **`app/record/upload/page.tsx`**
   - Auth required
   - Bulk upload interface
   - Case selection
   - Progress tracking

4. **`public/manifest.json`**
   - PWA manifest
   - Home screen icon
   - App shortcuts

5. **`components/pwa/InstallPrompt.tsx`**
   - Install prompt UI
   - Dismissible banner
   - localStorage persistence

### Data Flow

```
┌─────────────┐
│   /record   │  No Auth
│  (Public)   │
└──────┬──────┘
       │
       ├─ Record Audio
       │  └─ MediaRecorder API
       │
       ├─ Save Locally
       │  └─ IndexedDB
       │
       └─ User wants to upload
          │
          ├─ Check auth
          │  ├─ Not logged in → Redirect to /login
          │  └─ Logged in → Continue
          │
          └─ /record/upload
             │
             ├─ Select case
             ├─ Upload files
             │  └─ Supabase Storage
             │
             ├─ Create sessions
             │  └─ Database records
             │
             └─ Delete from IndexedDB
```

## Security

### What's Public
- ✅ Recording page (`/record`)
- ✅ Local audio storage (IndexedDB)
- ✅ Play/delete local recordings

### What Requires Auth
- ❌ Upload to server
- ❌ Transcription
- ❌ Viewing sessions
- ❌ Case management
- ❌ Reports

### Privacy Considerations
- Audio never leaves device until upload
- IndexedDB is sandboxed per browser
- No tracking without auth
- GDPR compliant (data stays on device)

## Usage

### For Social Workers

**Quick Recording:**
1. Bookmark `yourapp.com/record`
2. Or install PWA to home screen
3. Tap icon → Record immediately
4. Upload later when convenient

**Best Practice:**
- Record during/after session
- Upload at end of day (WiFi)
- Batch multiple recordings
- Delete after successful upload

### Installation Instructions

**iOS Safari:**
1. Visit `/record`
2. Tap Share button
3. "Add to Home Screen"
4. Icon appears on home screen

**Android Chrome:**
1. Visit `/record`
2. Tap "Install app" banner
3. Or Menu → "Install app"
4. Icon appears on home screen

## API Endpoints

### No Auth Required
- `GET /record` - Recording page
- None (all client-side)

### Auth Required
- `GET /record/upload` - Upload page
- Uses existing APIs:
  - `POST /api/sessions` - Create session
  - `POST /api/files` - Upload files
  - Supabase Storage API

## IndexedDB Schema

```typescript
Database: gespraechsbericht-recordings
Store: recordings

{
  id: string          // Unique ID
  blob: Blob         // Audio data
  duration: number   // Seconds
  timestamp: number  // Unix timestamp
  mimeType: string   // e.g. "audio/webm"
  size: number       // Bytes
}
```

## Browser Compatibility

| Browser | Recording | IndexedDB | PWA |
|---------|-----------|-----------|-----|
| iOS Safari 14+ | ✅ | ✅ | ✅ |
| Android Chrome | ✅ | ✅ | ✅ |
| Desktop Chrome | ✅ | ✅ | ✅ |
| Desktop Safari | ✅ | ✅ | ❌ |
| Firefox | ✅ | ✅ | ✅ |

## Storage Limits

- **IndexedDB:** ~50MB-1GB per origin (varies by browser)
- **Monitoring:** Shows total size in UI
- **Warning:** If storage fills, show error

### Estimated Capacity
- 1 minute audio ≈ 1-2 MB
- 50 MB = ~25-50 minutes
- Typical session = 10-30 minutes

## Testing Checklist

- [ ] Record without login
- [ ] Recording saves to IndexedDB
- [ ] Play recording locally
- [ ] Delete recording
- [ ] Storage size displays correctly
- [ ] Upload redirects to login if not authenticated
- [ ] Upload works with existing cases
- [ ] Multiple recordings upload correctly
- [ ] Recordings deleted after successful upload
- [ ] PWA install prompt appears
- [ ] Add to home screen works (iOS)
- [ ] Install app works (Android)
- [ ] Offline recording works
- [ ] Browser restart preserves recordings

## Future Enhancements

1. **Background Sync**
   - Auto-upload when online
   - Service worker sync

2. **Voice Memos Integration**
   - Import from iOS Voice Memos
   - File picker integration

3. **Quick Notes**
   - Text notes with recordings
   - Context metadata

4. **Smart Upload**
   - Auto-detect case from context
   - Suggest related cases

5. **Compression**
   - Compress before upload
   - Save bandwidth

6. **Encryption**
   - Encrypt IndexedDB storage
   - Extra security layer

## Troubleshooting

**Recording doesn't work:**
- Check microphone permission
- Try different browser
- Clear cache and retry

**Upload fails:**
- Check auth status
- Verify case selection
- Check network connection
- Check file size limits

**Storage full:**
- Delete old recordings
- Upload and clear
- Check browser storage settings

**PWA won't install:**
- Must be HTTPS
- Manifest must be valid
- Icons must exist
- Try different browser

---

**Created:** January 31, 2026
**Feature:** No-auth recording with local storage
**Impact:** Removes biggest friction point for field workers
