# Phase 1 Implementation Plan

## Date: 2026-02-07
## Goal: Core Usability Improvements

---

## ✅ SCOPE

### 1. Save AI Suggestions & User Overrides
- ✅ Add DB columns for user overrides
- ⏳ Create API endpoint to save user selections
- ⏳ Update UI with "Save Context" button
- ⏳ Display logic: Show user selection OR AI suggestion

### 2. Enhanced AI Context Extraction
- ✅ Add DB column for rich context
- ⏳ Enhance AI prompt to extract:
  - Participants (names + roles)
  - Meeting purpose
  - Agenda/topics discussed
  - Venue/location
  - Key decisions
  - Action items with owners/deadlines
  - Important dates
- ⏳ Auto-populate context panel fields

### 3. Output Count in Sessions List
- ✅ Add DB index and view
- ⏳ Modify sessions API to include count
- ⏳ Update adapter to pass count to UI
- ⏳ Add badge to sessions list

### 4. Auto-Generation Workflow
- ⏳ Check user's `after_transcript_action` setting
- ⏳ Auto-generate output if not 'nothing'
- ⏳ Use same AI call for efficiency (extract context + generate if needed)
- ⏳ Show notification when complete

### 5. Templates Page Verification
- ⏳ Ensure fetches real data from `/api/templates`
- ⏳ User has 3 templates, confirm they display

---

## 🗂️ FILES TO MODIFY

### Database
- ✅ `supabase/migrations/20260207_phase1_improvements.sql` (created)

### API Routes
- ⏳ `app/api/sessions/[id]/analyze/route.ts` - Enhanced AI extraction + auto-gen
- ⏳ `app/api/sessions/[id]/context/route.ts` - NEW: Save user overrides
- ⏳ `app/api/sessions/route.ts` - Add output count to GET

### Adapters
- ⏳ `lib/adapters/session-adapter.ts` - Add output count field

### Components
- ⏳ `components/session-setup-panel.tsx` - Add Save button, update state logic
- ⏳ `app/(app)/sessions/page.tsx` - Add output count badge

### Types
- ⏳ `lib/types-v0.ts` - Add `outputCount` to Session interface

---

## 📝 IMPLEMENTATION STEPS

### Step 1: Database Migration ✅
```bash
# User needs to run in Supabase SQL Editor
# File: supabase/migrations/20260207_phase1_improvements.sql
```

### Step 2: Enhance AI Analysis API
**Goal**: Single AI call extracts context AND triggers auto-generation

**Changes to `/app/api/sessions/[id]/analyze/route.ts`:**
1. Expand prompt to extract rich context
2. Store in `ai_extracted_context` column
3. Check `context_locked` - skip if user overrode
4. Fetch user's `after_transcript_action` preference
5. If not 'nothing', trigger auto-generation
6. Return full context to UI

### Step 3: Create User Override API
**New file: `/app/api/sessions/[id]/context/route.ts`**
- `PATCH` endpoint
- Accepts: `recording_type`, `domains`, `extracted_context`
- Sets `context_locked = true`
- Updates session

### Step 4: Update Sessions List
**Changes to `/app/api/sessions/route.ts`:**
- JOIN with outputs table
- Add `COUNT(outputs.id) as output_count`
- Return in response

**Changes to `lib/adapters/session-adapter.ts`:**
- Map `output_count` field

**Changes to `app/(app)/sessions/page.tsx`:**
- Display output count badge if > 0

### Step 5: Update Context Panel
**Changes to `components/session-setup-panel.tsx`:**
1. Add state for tracking changes
2. Add "Save Context" button (visible when changes made)
3. Call `/api/sessions/[id]/context` on save
4. Show "AI Suggested" vs "User Selected" badges
5. Pre-populate fields from `ai_extracted_context`

### Step 6: Test Auto-Generation
1. User sets `after_transcript_action` in settings
2. Upload new recording
3. AI analysis completes
4. Auto-generation kicks in (if enabled)
5. User sees notification

---

## 🧪 TESTING CHECKLIST

- [ ] Run migration in Supabase
- [ ] Upload new recording
- [ ] AI analysis extracts rich context
- [ ] Context panel fields auto-populate
- [ ] Override recording type/domain → save works
- [ ] Refresh page → user overrides persist
- [ ] Sessions list shows output count badge
- [ ] Set auto-generation → upload recording → output auto-creates
- [ ] Re-run analysis doesn't overwrite locked context

---

## 🚀 DEPLOYMENT ORDER

1. ✅ Create migration SQL
2. User runs migration in Supabase
3. Deploy backend changes (API routes)
4. Deploy frontend changes (UI components)
5. Test end-to-end

---

**Ready to implement Step 2? (Enhance AI Analysis)**
