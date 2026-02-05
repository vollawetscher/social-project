# Sessions Screen Analysis - In-Depth Report

## Date: February 5, 2026
## Scope: `/sessions` page, `/sessions/[id]` page, recording & upload workflows

---

## 1. SESSIONS LIST PAGE (`/app/(app)/sessions/page.tsx`)

### ✅ WORKING FEATURES

1. **Data Fetching** - Successfully fetches real sessions from `/api/sessions?format=v0`
2. **Display** - Sessions displayed in responsive table (desktop) and card (mobile) views
3. **Search** - Full-text search filtering by filename and language
4. **Status Display** - Shows uploading/transcribing/ready/failed status with progress bars
5. **Inline Editing UI** - Click-to-edit session name interface with save/cancel buttons
6. **Navigation** - Links to session detail pages work correctly

### ❌ MISSING/BROKEN FEATURES

#### 1. **Delete Session** (High Priority)
- **Status**: UI exists (lines 467-470, 588-591), but not connected to backend
- **API Available**: ✅ `DELETE /api/sessions/[id]` exists and working
- **Fix Required**: Connect dropdown menu item to API call
- **Code Location**: Lines 467-470 (mobile), 588-591 (desktop)
```typescript
// Currently:
<DropdownMenuItem className="text-destructive">
  <Trash2 className="mr-2 h-4 w-4" />
  Delete
</DropdownMenuItem>

// Needs to call: DELETE /api/sessions/${session.id}
```

#### 2. **Rename Session** (High Priority)
- **Status**: Updates local state only, not persisted to database
- **API Available**: ✅ `PATCH /api/sessions/[id]` exists
- **Fix Required**: Call API in `handleRenameSession` function (line 248-252)
- **Code Location**: Lines 248-252
```typescript
// Currently:
const handleRenameSession = (id: string, newName: string) => {
  setSessions(prev => prev.map(s => 
    s.id === id ? { ...s, filename: newName } : s
  ))
}

// Needs: API call to PATCH /api/sessions/[id] with { internal_case_id: newName }
```

#### 3. **Download Transcript** (Medium Priority)
- **Status**: UI exists (lines 463-466, 584-587), but not functional
- **API Available**: ❌ No API route exists
- **Fix Required**: 
  - Create API route `/api/sessions/[id]/download` or use existing `/api/sessions/[id]/transcript`
  - Generate text file from transcript data
  - Trigger browser download
- **Code Location**: Lines 463-466 (mobile), 584-587 (desktop)

#### 4. **Upload Dropzone** (High Priority)
- **Status**: UI exists (lines 347-368), but `handleDrop` is empty (lines 242-246)
- **Current Behavior**: Drag & drop does nothing
- **Fix Required**: Implement file upload logic
  - Accept audio files (MP3, WAV, WebM, M4A)
  - Upload to Supabase Storage bucket `rohbericht-audio`
  - Create new session with audio_url
  - Optionally trigger transcription
- **Code Location**: Lines 242-246
```typescript
// Currently:
const handleDrop = useCallback((e: React.DragEvent) => {
  e.preventDefault()
  setIsDragging(false)
  // Mock file upload handling
}, [])

// Needs: Full file upload implementation
```

#### 5. **Recording Functionality** (Medium Priority)
- **Status**: Button redirects to `/record` page (line 225, 313)
- **Current Behavior**: Takes user to separate recording page
- **Issue**: Not integrated into sessions flow
- **Fix Required**: Consider inline recording modal or better integration
- **Code Location**: Lines 222-226, 310-317

---

## 2. SESSION DETAIL PAGE (`/app/(app)/sessions/[id]/page.tsx`)

### ✅ WORKING FEATURES

1. **Session Data** - Fetches session, transcript, and files correctly
2. **Transcript Display** - Shows segments with speaker badges and timestamps
3. **AI Analysis** - Automatic recording type and domain detection
4. **Audio Player** - Full audio playback with controls
5. **Audio-Transcript Sync** - Highlights active segment during playback
6. **Generate Output Modal** - Opens modal for AI output generation
7. **Outputs Display** - Shows generated outputs with copy/download actions
8. **Suggested Templates** - Shows relevant templates based on AI analysis

### ⚠️ POTENTIAL ISSUES

#### 1. **Timestamps in Transcript** (Investigation Required)
- **Status**: User reported "timestamps in transcript are wrong"
- **Code Location**: `/components/transcript-viewer-v0.tsx` lines 98-107
- **Function**: `formatTimestamp(seconds: number)`
```typescript
function formatTimestamp(seconds: number): string {
  const hrs = Math.floor(seconds / 3600)
  const mins = Math.floor((seconds % 3600) / 60)
  const secs = Math.floor(seconds % 60)
  
  if (hrs > 0) {
    return `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }
  return `${mins}:${secs.toString().padStart(2, '0')}`
}
```
- **Possible Root Causes**:
  1. ❓ `segment.startTime` contains incorrect data from Speechmatics API
  2. ❓ `segment.startTime` is in milliseconds instead of seconds
  3. ❓ Data adapter (`toV0Session`) not converting time format correctly
- **Investigation Needed**: 
  - Check actual transcript data from `/api/sessions/[id]/transcript`
  - Check Speechmatics API response format
  - Check session adapter conversion logic

---

## 3. RECORDING PAGE (`/app/record/page.tsx`)

### ✅ WORKING FEATURES

1. **Local Recording** - Records audio using AudioRecorder component
2. **Local Storage** - Saves recordings to IndexedDB
3. **Playback** - Play recordings before upload
4. **Delete Local** - Remove recordings from local storage
5. **Upload Navigation** - Redirects to `/record/upload` when logged in

### ⚠️ ISSUES

1. **Language** - All text is in German (should be English for consistency)
2. **Isolation** - Not integrated with main sessions workflow
3. **No Direct Transcription** - Records locally, requires separate upload step

---

## 4. UPLOAD PAGE (`/app/record/upload/page.tsx`)

### ✅ WORKING FEATURES

1. **Session Creation** - Creates new sessions with auto-generated names
2. **Audio Upload** - Uploads audio blobs to Supabase Storage
3. **Audio URL Storage** - Stores `audio_url` in sessions table
4. **Batch Upload** - Can upload multiple recordings at once
5. **Status Tracking** - Shows upload progress for each recording
6. **Cleanup** - Deletes local recordings after successful upload
7. **Navigation** - Redirects to session detail (single) or sessions list (multiple)

### ⚠️ ISSUES

1. **No Transcription Trigger** - Uploads audio but doesn't automatically start transcription
2. **Language Hardcoded** - Defaults to 'de' (German) instead of detecting language
3. **Status Field** - Sets status to 'pending' but should be 'uploading' or trigger transcription

---

## 5. PRIORITY FIXES

### 🔴 **CRITICAL (Must Fix)**

1. **Delete Session** - Connect UI to existing API
2. **Rename Session** - Persist changes to database
3. **Upload Dropzone** - Implement file upload functionality
4. **Timestamps Investigation** - Debug and fix timestamp display issues

### 🟡 **HIGH (Should Fix)**

5. **Download Transcript** - Create API route and implement download
6. **Transcription Trigger** - Auto-start transcription after upload
7. **Recording Integration** - Better integration with sessions workflow

### 🟢 **MEDIUM (Nice to Have)**

8. **Language Detection** - Detect audio language instead of hardcoding
9. **Language Consistency** - Translate German text to English
10. **Inline Recording** - Add recording modal directly in sessions page

---

## 6. IMPLEMENTATION PLAN

### Phase A: Critical Fixes (Delete, Rename, Upload, Timestamps)

**Estimated Changes**: 4 files
1. `/app/(app)/sessions/page.tsx` - Add delete + rename API calls + upload dropzone
2. `/api/sessions/[id]/download/route.ts` - NEW FILE for transcript download
3. Investigate timestamp issue (may require adapter or API changes)

### Phase B: Recording & Transcription Integration

**Estimated Changes**: 2-3 files
1. `/app/record/upload/page.tsx` - Add transcription trigger
2. Potentially create inline recording component
3. Add language detection

### Phase C: Polish & UX

**Estimated Changes**: 3-4 files
1. Translate German text to English
2. Improve error handling
3. Add loading states
4. Add success/error toasts

---

## 7. API ROUTES STATUS

| Route | Method | Status | Notes |
|-------|--------|--------|-------|
| `/api/sessions` | GET | ✅ Working | Fetches all sessions |
| `/api/sessions?format=v0` | GET | ✅ Working | Returns v0-formatted sessions |
| `/api/sessions/[id]` | GET | ✅ Working | Fetches single session |
| `/api/sessions/[id]` | PATCH | ✅ Working | Updates session (not used in UI) |
| `/api/sessions/[id]` | DELETE | ✅ Working | Deletes session (not connected to UI) |
| `/api/sessions/[id]/transcript` | GET | ✅ Working | Fetches transcript |
| `/api/sessions/[id]/analyze` | POST | ✅ Working | AI analysis |
| `/api/sessions/[id]/download` | GET | ❌ Missing | Need to create for transcript download |

---

## 8. NEXT STEPS

1. Start with Phase A (Critical Fixes)
2. User approval for implementation approach
3. Implement fixes in order of priority
4. Test each feature thoroughly
5. Move to Phase B after Phase A completion

---

**END OF ANALYSIS**
