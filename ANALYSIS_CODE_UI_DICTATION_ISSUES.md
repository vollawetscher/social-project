# Code, UI & Dictation Issues Analysis

**Date:** February 3, 2026  
**Purpose:** Identify and document code inconsistencies, UI problems, and live transcription failures

---

## 🔴 Critical: Live Dictation Not Working

### Root Cause Analysis

#### 1. **Speechmatics Real-Time Service Issues**

**Location:** `lib/services/speechmatics-realtime.ts`, `components/session/CompactTranscribableField.tsx`

**Problems Identified:**

```typescript
// CompactTranscribableField.tsx line 133
const token = await getSpeechmaticsRealtimeToken()
```

**Issue:** Token generation requires authentication, but:
- No error handling for 401 responses visible to user
- Token might expire during long dictation sessions (TTL: 3600s)
- WebSocket connection failures aren't properly surfaced

**WebSocket Connection Issues:**
```typescript
// speechmatics-realtime.ts line 38
const wsUrl = `wss://eu2.rt.speechmatics.com/v2?jwt=${this.tempToken}`
this.ws = new WebSocket(wsUrl)
```

**Problems:**
1. No retry logic for failed connections
2. Connection state not preserved across component re-renders
3. Network errors swallowed by generic error handler
4. WebSocket close events (line 98) don't trigger user-visible alerts

#### 2. **Audio Processing Conflicts**

**Dual Recording Systems:**
- `AudioRecorder.tsx`: Full recording with MediaRecorder (for file upload)
- `CompactTranscribableField.tsx`: Live transcription with Speechmatics

**Problem:** Both use `navigator.mediaDevices.getUserMedia()` - can't run simultaneously!

```typescript
// AudioRecorder.tsx line 171
const stream = await navigator.mediaDevices.getUserMedia({ audio: true })

// CompactTranscribableField.tsx line 127
const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
```

**Impact:** If user tries to dictate while a recording tab is open, microphone access conflict causes silent failure.

#### 3. **Audio Context Issues**

```typescript
// speechmatics-realtime.ts line 108
this.audioContext = new AudioContext({ sampleRate: 16000 })
```

**Problems:**
1. AudioContext creation can fail on iOS Safari (autoplay policy)
2. No AudioContext.resume() after user gesture
3. Sample rate mismatch with device (most devices: 44100Hz → 16000Hz requires resampling)
4. AudioWorklet blob URL creation (line 157) may be blocked by CSP

#### 4. **Error Handling Gaps**

```typescript
// CompactTranscribableField.tsx line 157-162
onError: (error) => {
  console.error('[Speechmatics RT] Error:', error)
  const errorMsg = error.message || 'Unbekannter Fehler'
  const displayMsg = errorMsg.length > 100 ? errorMsg.substring(0, 100) + '...' : errorMsg
  toast.error('Transkriptionsfehler: ' + displayMsg)
}
```

**Problems:**
- Error messages truncated too aggressively
- Network errors vs API errors not differentiated
- No diagnostic info for troubleshooting
- Connection drops during dictation silently fail to reconnect

---

## 🎨 UI/Layout Inconsistencies

### 1. **Dashboard Page (`app/dashboard/page.tsx`)**

**Issues:**

#### Sticky Header Gradient (line 174)
```typescript
<div className="sticky top-16 z-40 bg-gradient-to-br from-blue-50 via-purple-50 to-blue-100 pb-4">
```

**Problems:**
- `top-16` assumes 64px navbar height (not verified)
- Gradient background clashes with card gradients below
- Not responsive: breaks on mobile when navbar changes height

#### Inconsistent Card Styling (line 247)
```typescript
className="hover:shadow-lg hover:shadow-primary/20 transition-all border-primary/20 hover:border-primary/40 bg-gradient-to-br from-white to-primary/5"
```

**Problems:**
- Too many hover states (border + shadow + scale)
- `active:scale-[0.98]` feels sluggish on mobile
- Gradient from white to primary/5 barely visible

#### Filter Buttons (line 188-213)
```typescript
<Button variant={filterStatus === 'all' ? 'default' : 'outline'}>
  Alle ({conversations.length})
</Button>
```

**Problem:** Count updates cause layout shift when numbers change

#### Floating Action Button (line 337)
```typescript
<div className="fixed bottom-6 right-6 z-50">
```

**Problems:**
- Conflicts with mobile bottom navigation
- Should be `bottom-20` on mobile to avoid thumb zone
- No label on mobile (accessibility issue)

---

### 2. **Session Detail Page (`app/sessions/[id]/page.tsx`)**

**Critical Issues:**

#### Polling Abuse (line 68-71)
```typescript
useEffect(() => {
  loadSession()
  const interval = setInterval(loadSession, 3000)
  return () => clearInterval(interval)
}, [sessionId])
```

**Problems:**
- Polls every 3 seconds indefinitely
- No polling stop when status === 'done'
- Hammers API even when page is backgrounded
- **Memory leak:** Multiple intervals stack if sessionId changes rapidly

**Fix Needed:**
```typescript
// Poll only when status is processing
useEffect(() => {
  if (!session) return
  
  if (session.status === 'transcribing' || session.status === 'uploading' || session.status === 'summarizing') {
    const interval = setInterval(loadSession, 5000)
    return () => clearInterval(interval)
  }
}, [session?.status])
```

#### 953 Lines in One Component
**Problems:**
- Too much state (15+ useState hooks)
- Mixed concerns: file management, transcription, UI, metadata
- Hard to debug
- Poor performance on re-renders

**Should be split into:**
- `SessionHeader.tsx`
- `SessionMetadata.tsx`
- `SessionRecordings.tsx`
- `SessionFields.tsx`
- `SessionActions.tsx`

#### Collapsible Sections Overuse (line 519, 646)
```typescript
<Collapsible defaultOpen={false}>
```

**Problems:**
- Important context hidden by default
- User must manually expand every time
- No "Expand All" option
- Mobile: too much tapping required

#### Metadata Grid (line 542)
```typescript
<div className="grid grid-cols-2 gap-2">
```

**Problem:** Grid breaks on narrow screens (<320px) - should be `grid-cols-1 sm:grid-cols-2`

---

### 3. **CompactTranscribableField Component**

**UI Problems:**

#### Icon-Only Dictate Button (line 288-305)
```typescript
<Button variant="ghost" size="icon" className="h-7 w-7">
  {recording ? <Square /> : <Mic />}
</Button>
```

**Problems:**
- Too small (7x7 = 28px) for mobile tap target (should be 44px minimum)
- No visual feedback when recording starts
- Red color only appears on hover (doesn't work on mobile)
- Conflates "recording" state with "transcribing" state

#### Live Transcript Display (line 373-381)
```typescript
{recording && liveTranscript && (
  <div className="border-l-2 border-primary pl-2 py-1.5">
    <p className="text-foreground">{liveTranscript}</p>
  </div>
)}
```

**Problems:**
- Only shows if BOTH `recording` AND `liveTranscript` are truthy
- Live transcript can be empty for 2-3 seconds after start (user thinks nothing is happening)
- No "listening..." indicator
- Partial transcripts overwrite each other (no history)

#### Lock Feature Confusion (line 308-322)
```typescript
<Button 
  disabled={hasChanges}
  title={isLocked ? 'Gesperrt...' : hasChanges ? 'Speichere zuerst...' : 'Entsperrt...'}
>
```

**Problems:**
- Lock icon only appears when field has content
- Disabled state when hasChanges is confusing
- No clear indication of what "lock" means
- Tooltip text too long for mobile

---

### 4. **Color Scheme Inconsistency**

**Throughout the app:**

```typescript
// Dashboard: primary = blue
className="text-primary"

// Session detail: purple, blue, amber, green for different sections
colors = {
  blue: 'border-blue-200 bg-blue-50',
  amber: 'border-amber-200 bg-amber-50',
  green: 'border-green-200 bg-green-50'
}

// Reports: red for errors, green for success
className="border-red-200 bg-red-50"
```

**Problems:**
- No design system
- Semantic colors mixed with decorative colors
- Purple vs blue for primary actions inconsistent
- Gradients (dashboard) vs solid (components) inconsistent

---

## 🧩 Logic Issues

### 1. **State Management Chaos**

**Session Detail Page State:**
```typescript
const [session, setSession] = useState<Session | null>(null)
const [files, setFiles] = useState<FileType[]>([])
const [loading, setLoading] = useState(true)
const [uploading, setUploading] = useState(false)
const [viewingTranscript, setViewingTranscript] = useState<...>(null)
const [deletingFile, setDeletingFile] = useState<FileType | null>(null)
const [deleting, setDeleting] = useState(false)
const [analyzingContext, setAnalyzingContext] = useState(false)
const [analyzingPrivateNotes, setAnalyzingPrivateNotes] = useState(false)
const [analyzingInstructions, setAnalyzingInstructions] = useState(false)
const [showAudioUpload, setShowAudioUpload] = useState(false)
```

**Problems:**
- 11+ boolean flags for loading states
- No reducer pattern → prone to race conditions
- Multiple async operations can conflict (e.g., saving + analyzing simultaneously)
- `analyzing*` states should be a Map or object

**Better approach:**
```typescript
type LoadingState = 'idle' | 'loading' | 'saving' | 'analyzing' | 'uploading'
const [loadingStates, setLoadingStates] = useState<Record<string, LoadingState>>({})
```

---

### 2. **Audio Format Detection**

**AudioRecorder.tsx (line 187):**
```typescript
const audioFormat = detectSupportedAudioFormat()
```

**Problem:** Detection happens BEFORE getUserMedia, but:
- Supported formats depend on getUserMedia constraints
- No fallback if detected format fails
- Mobile Safari detection is hardcoded (line 190) - brittle

---

### 3. **Duplicate Logic**

**Purpose Labels:**
```typescript
// session/[id]/page.tsx line 394-409
const getPurposeLabel = (purpose: FilePurpose) => {
  const labels: Record<FilePurpose, ...> = {
    context: { icon: <FileText />, text: 'Kontext' },
    meeting: { icon: <MessageSquare />, text: 'Besprechung' },
    // ...
  }
}

// Should be in a shared constants file
```

**Status Badges:**
- Defined in `dashboard/page.tsx` (line 127)
- Defined again in `sessions/[id]/page.tsx` (line 375)
- Different icons and text!

**Date Formatting:**
- `formatDateTime` in dashboard (line 147)
- `formatDate` in session detail (line 424)
- Different formats for same data

---

### 4. **File Upload Flow**

**session/[id]/page.tsx lines 92-143:**

```typescript
const handleFileSelected = async (file: File) => {
  // Detect audio duration before upload
  const audio = document.createElement('audio')
  audio.src = URL.createObjectURL(file)
  
  // Complex timeout logic
  audioLoadTimeout = setTimeout(async () => {
    if (!durationDetected) {
      // ... upload with 0 duration
    }
  }, 5000)
}
```

**Problems:**
- Creating hidden audio elements for duration detection is fragile
- 5-second timeout is arbitrary
- Multiple upload paths: with duration, without duration, on timeout, on error
- `URL.createObjectURL` memory leaks if error occurs before revoke
- Duration detection doesn't work for some formats (FLAC, OGG)

---

## 📋 Specific Bugs Found

### Bug 1: Memory Leak in Session Detail
**File:** `app/sessions/[id]/page.tsx`  
**Lines:** 68-71

```typescript
useEffect(() => {
  loadSession()
  const interval = setInterval(loadSession, 3000)
  return () => clearInterval(interval)
}, [sessionId])
```

**Issue:** `loadSession` is not memoized, so `useEffect` dependency is always stale. If `sessionId` changes while interval is running, old interval isn't cleaned up.

**Fix:**
```typescript
const loadSession = useCallback(async () => {
  // ... existing logic
}, [sessionId])

useEffect(() => {
  loadSession()
  if (session?.status && ['transcribing', 'uploading', 'summarizing'].includes(session.status)) {
    const interval = setInterval(loadSession, 5000)
    return () => clearInterval(interval)
  }
}, [sessionId, session?.status, loadSession])
```

---

### Bug 2: CompactTranscribableField - Text Not Updating
**File:** `components/session/CompactTranscribableField.tsx`  
**Lines:** 144-150

```typescript
if (result.isFinal) {
  const start = cursorPositionRef.current
  const before = text.substring(0, start)
  const after = text.substring(start)
  const newText = before + transcript + ' ' + after
  setText(newText)
  setHasChanges(true)
  cursorPositionRef.current = start + transcript.length + 1
  setLiveTranscript('') // Clear partial
}
```

**Issue:** If user manually changes `text` state during dictation, cursor position becomes invalid:
- `cursorPositionRef.current` points to old position
- Text insertion happens at wrong location
- Space added even if transcript ends with punctuation

**Also:** Lines 62-64 sync with parent `value`, but this overwrites user's dictation in progress!

```typescript
useEffect(() => {
  setText(value)
}, [value])
```

**This is a race condition:**
1. User dictates → `setText(newText)` → `setHasChanges(true)`
2. Parent re-renders (polling) → passes updated `value`
3. useEffect fires → overwrites dictated text!

---

### Bug 3: AudioRecorder Health Check False Alarms
**File:** `components/audio/AudioRecorder.tsx`  
**Lines:** 144-159

```typescript
healthCheckRef.current = setInterval(() => {
  const currentChunkCount = chunksRef.current.length
  // If we're recording and haven't received any chunks in 5+ seconds, alert
  if (currentChunkCount === lastChunkCountRef.current && timeSinceLastCheck > 5000 && !isPaused) {
    console.error('[AudioRecorder] HEALTH CHECK FAILED')
    playErrorAlert()
    toast.error('⚠️ WARNUNG: Aufnahme empfängt keine Daten!')
  }
}, 5000)
```

**Problem:** 
- Timeslice is set to 1000ms (line 265), but health check expects chunks every 5s
- On mobile, MediaRecorder can buffer for 2-3 seconds during power saving
- False positives on quiet audio (speaker pauses)
- Alert continues even after user dismisses toast

---

### Bug 4: Lock Toggle Race Condition
**File:** `components/session/CompactTranscribableField.tsx`  
**Lines:** 247-262

```typescript
const toggleLock = async () => {
  if (!isLocked && hasChanges) {
    toast.error('Speichere zuerst!')
    return
  }
  
  const newLockState = !isLocked
  try {
    await onLockToggle(newLockState)
    setIsLocked(newLockState)
    toast.success(newLockState ? 'Gesperrt' : 'Entsperrt')
  } catch (error) {
    toast.error('Fehler beim Ändern des Sperrstatus')
  }
}
```

**Issue:** If `onLockToggle` fails, `isLocked` state is already updated (line 256). User sees "Gesperrt" but server wasn't updated.

**Fix:** Only update local state after successful server response:
```typescript
try {
  await onLockToggle(newLockState)
  setIsLocked(newLockState) // Move this AFTER await
  toast.success(...)
}
```

---

### Bug 5: Textarea Cursor Position Lost
**File:** `components/session/CompactTranscribableField.tsx`  
**Lines:** 219-221

```typescript
const handleCursorChange = (e: React.SyntheticEvent<HTMLTextAreaElement>) => {
  cursorPositionRef.current = e.currentTarget.selectionStart || 0
}
```

**Attached to:** `onSelect`, `onClick`, `onKeyUp` (line 394-396)

**Problem:** Not attached to `onChange`! If user types text, cursor position ref doesn't update.

Then when dictation starts, inserted text goes to old cursor position.

---

## 🎯 Priority Fixes

### **🔴 P0 - Critical (Breaks Core Functionality)**

1. **Fix Live Dictation Token & WebSocket Issues**
   - Add retry logic for WebSocket connections
   - Show connection status to user
   - Add token refresh before expiry
   - Handle iOS AudioContext autoplay policy

2. **Fix Microphone Access Conflicts**
   - Only allow one microphone user at a time
   - Show clear error when microphone busy
   - Add "Release Microphone" button

3. **Fix Session Polling Memory Leak**
   - Memoize `loadSession`
   - Stop polling when status is 'done' or 'error'

4. **Fix Text Sync Race Condition in CompactTranscribableField**
   - Don't sync parent value while user is editing
   - Track "dirty" state separately

---

### **🟠 P1 - High (Degrades UX)**

5. **Split Session Detail Page**
   - Break 953-line component into smaller pieces
   - Extract state management into custom hooks

6. **Fix Mobile Tap Targets**
   - Make dictate button 44x44px minimum
   - Move FAB away from thumb zone
   - Add labels to icon-only buttons

7. **Improve Live Transcript Feedback**
   - Show "Listening..." when recording starts
   - Show connection status
   - Keep history of partial transcripts

8. **Standardize Date/Time/Status Formatting**
   - Create shared utility functions
   - Use consistent formatting across all pages

---

### **🟡 P2 - Medium (Code Quality)**

9. **Refactor State Management**
   - Use reducer for complex loading states
   - Consolidate analyzing states

10. **Fix Audio Format Detection**
    - Detect formats AFTER getUserMedia
    - Add fallback chain

11. **Create Design System**
    - Define color palette
    - Standardize spacing
    - Document component variants

12. **Fix Responsive Issues**
    - Test on 320px width screens
    - Fix grid breakpoints
    - Remove horizontal scrolling

---

## 🔧 Recommended Refactoring

### Short Term (This Week)

1. **Extract shared constants:**
   ```typescript
   // lib/constants/file-types.ts
   export const FILE_PURPOSE_LABELS = { ... }
   export const STATUS_VARIANTS = { ... }
   
   // lib/utils/date-formatters.ts
   export const formatSessionDate = (date: string) => { ... }
   ```

2. **Fix critical bugs:**
   - Memory leak (session polling)
   - Race condition (text sync)
   - Microphone conflicts

3. **Improve error messages:**
   - Add diagnostic info for dictation failures
   - Differentiate network vs API errors
   - Log to error reporting service

### Medium Term (Next Sprint)

4. **Component refactoring:**
   - Split SessionDetailPage
   - Extract custom hooks (`useSessionPolling`, `useAudioRecorder`, `useLiveDictation`)
   - Create compound components for repeated patterns

5. **Mobile UX improvements:**
   - Increase tap targets
   - Add connection status indicators
   - Improve feedback for async actions

6. **Testing:**
   - Add unit tests for live transcription logic
   - Add E2E tests for recording workflow
   - Test on real iOS/Android devices

### Long Term (Next Month)

7. **Architecture improvements:**
   - Consider Zustand/Jotai for global state
   - Add WebSocket connection pooling
   - Implement offline queue for failed uploads

8. **Design system:**
   - Create component library documentation
   - Standardize colors, spacing, typography
   - Add Storybook for component development

---

## 📊 Technical Debt Summary

| Category | Issues | Priority |
|----------|--------|----------|
| Live Dictation | 6 | 🔴 P0 |
| UI/Layout | 12 | 🟠 P1 |
| State Management | 4 | 🟡 P2 |
| Code Organization | 8 | 🟡 P2 |
| **Total** | **30** | |

---

## 🧪 Testing Recommendations

### Manual Testing Checklist (Live Dictation)

- [ ] Start dictation → verify "Listening..." appears
- [ ] Speak for 30s → verify text appears in real-time
- [ ] Stop dictation → verify final text is correct
- [ ] Start dictation → close tab → reopen → verify state recovery
- [ ] Start dictation → lock phone → unlock → verify still recording
- [ ] Start dictation on field 1 → switch to field 2 → verify microphone released
- [ ] Start recording → try dictation → verify clear error message

### Automated Test Ideas

```typescript
describe('CompactTranscribableField', () => {
  it('should not overwrite text during dictation when parent re-renders', async () => {
    // Simulate parent re-render with new value while dictating
  })
  
  it('should handle WebSocket disconnection gracefully', async () => {
    // Mock WebSocket close event during dictation
  })
  
  it('should release microphone when component unmounts', async () => {
    // Verify getUserMedia stream stopped
  })
})
```

---

## 🎓 Lessons Learned

1. **Don't poll if you can subscribe:** Consider WebSockets for real-time status updates instead of polling
2. **Microphone access is exclusive:** Need global state to track which component owns mic
3. **Mobile Safari is special:** AudioContext, MediaRecorder, WebSocket all have quirks
4. **State sync is hard:** Parent-child value sync + local edits = race conditions
5. **Error messages matter:** Generic errors hide root cause from user AND developer

---

## 📚 References

- [Speechmatics Real-Time API Docs](https://docs.speechmatics.com/rt-api-ref)
- [MediaDevices.getUserMedia()](https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getUserMedia)
- [WebSocket API](https://developer.mozilla.org/en-US/docs/Web/API/WebSocket)
- [React useEffect Hook Pitfalls](https://react.dev/learn/synchronizing-with-effects)
- [Mobile Touch Target Size](https://www.w3.org/WAI/WCAG21/Understanding/target-size.html)

---

**Next Steps:** Review this analysis and prioritize fixes. I recommend starting with P0 issues (dictation + polling) before tackling UI improvements.
