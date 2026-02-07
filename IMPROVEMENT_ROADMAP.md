# Improvement Roadmap

## Date: February 7, 2026
## Status: Phase 1 COMPLETE ✅ | Phase 2 Pending

---

## ✅ PHASE 1 IMPLEMENTED (2026-02-07)

**Status:** Complete and pushed to dev branch  
**Commit:** `5f9f5b7` - feat: Phase 1 Core Usability Improvements

**What was implemented:**
1. ✅ **Save AI Suggestions & Manual Overrides** - Database columns, API endpoint, UI save button
2. ✅ **Show Output Count in Sessions List** - JOIN query, badges on sessions list
3. ✅ **Enhanced AI Context Extraction** - Participants, purpose, agenda, venue, decisions, action items

**Next Steps:**
- User must run migration: `supabase/migrations/20260207_phase1_improvements.sql`
- Test all features (checklist in `PHASE1_IMPLEMENTATION_COMPLETE.md`)
- Proceed to Phase 2 if Phase 1 tests pass

---

## 🎯 YOUR REQUESTED IMPROVEMENTS

### **1. Save AI Suggestions & Manual Overrides** ⭐⭐⭐ HIGH PRIORITY

**Current State:**
- AI detects recording type & domains → stores in `sessions` table
- User can override in UI → **but changes are lost** on page refresh
- Re-running analysis overwrites manual selections

**Proposed Solution:**

#### A. Add User Override Fields
```sql
ALTER TABLE sessions 
ADD COLUMN user_recording_type TEXT,
ADD COLUMN user_domains JSONB,
ADD COLUMN context_locked BOOLEAN DEFAULT false;
```

#### B. Display Logic
```
If user_recording_type exists:
  → Show user's choice (with "Manual" badge)
Else if recording_type exists:
  → Show AI suggestion (with confidence badge)
Else:
  → Show mock/default
```

#### C. Save Button in Setup Panel
- User clicks suggested type/domain OR overrides manually
- "Save Context" button appears
- Saves to `user_recording_type` and `user_domains`
- Sets `context_locked = true` (prevents AI from overwriting)

**Benefits:**
- ✅ User changes persist across sessions
- ✅ AI suggestions don't overwrite manual choices
- ✅ Clear visual distinction (AI vs Manual)
- ✅ No unnecessary re-analysis

---

### **2. Show Output Count in Sessions List** ⭐⭐⭐ HIGH PRIORITY

**Current State:**
- Sessions list shows: name, duration, language, status, date
- No indication if outputs exist
- User has to open each session to see

**Proposed Solution:**

#### A. Add Output Count to API Response
Modify `/api/sessions?format=v0` to include:
```sql
SELECT 
  sessions.*,
  COUNT(outputs.id) as output_count
FROM sessions
LEFT JOIN outputs ON outputs.session_id = sessions.id
GROUP BY sessions.id
```

#### B. Add Badge to Sessions List
```tsx
<Badge variant="outline" className="text-xs">
  <FileText className="h-3 w-3 mr-1" />
  {session.outputCount} {session.outputCount === 1 ? 'Output' : 'Outputs'}
</Badge>
```

#### C. Visual Indicator
- Show badge only if `outputCount > 0`
- Color-code: Green if has outputs, muted if none
- Hover tooltip: "3 reports generated"

**Benefits:**
- ✅ Quick visibility of processed sessions
- ✅ Saves time (don't open sessions without outputs)
- ✅ Encourages output generation

---

### **3. Enhanced AI Context Extraction** ⭐⭐ MEDIUM PRIORITY

**Current Analysis (Basic):**
- Recording Type (meeting, interview, etc.)
- Domains (legal, sales, medical, etc.)

**Proposed Enhancement:**

#### A. Extended Analysis Fields
```sql
ALTER TABLE sessions
ADD COLUMN ai_extracted_context JSONB DEFAULT '{}'::jsonb;
```

Store structured context:
```json
{
  "participants": [
    {"name": "Dr. Schmidt", "role": "consultant"},
    {"name": "Frau Meyer", "role": "client"}
  ],
  "purpose": "Initial consultation about tax planning",
  "topics": ["tax optimization", "retirement planning"],
  "decisions": ["Schedule follow-up", "Request documents"],
  "action_items": [
    {"task": "Send tax forms", "owner": "Dr. Schmidt", "deadline": "2026-02-15"}
  ],
  "key_dates": ["2026-03-01"],
  "mood": "professional, collaborative",
  "outcome": "positive"
}
```

#### B. Enhanced Prompt
Add to analysis API:
```
Also extract:
- Participant names and roles (if mentioned)
- Meeting purpose/objective
- Main topics discussed
- Key decisions made
- Action items with owners
- Important dates/deadlines
```

#### C. Auto-populate Context Panel
The extracted context automatically fills:
- Participants field
- Purpose field
- Agenda field
- (New) Action items section
- (New) Key dates section

**Benefits:**
- ✅ Saves manual data entry
- ✅ Richer context for report generation
- ✅ Better searchability
- ✅ Single AI call extracts everything

---

## 💡 ADDITIONAL IMPROVEMENTS I SEE

### **4. Template Management** ⭐⭐⭐ HIGH PRIORITY

**Issues:**
- Templates page exists but might show mock data
- No easy way to create templates from successful outputs
- Missing "Create from this output" button

**Solutions:**
- Ensure templates page uses real DB data
- Add "Save as Template" button on output view
- Template usage analytics (which templates generate best outputs)

---

### **5. Output Management** ⭐⭐ MEDIUM PRIORITY

**Issues:**
- Outputs page might not show session info
- No way to compare multiple outputs side-by-side
- Missing "Regenerate with different settings" option

**Solutions:**
- Add session name/date to output cards
- Add "Compare" mode for A/B testing different perspectives
- "Generate Similar" button (same template, different tone)

---

### **6. Workflow Automation** ⭐⭐⭐ HIGH PRIORITY

**Current State:**
- User can set "After Transcript" preference in settings
- Options: nothing, short_summary, long_summary, full_report
- **But it's not implemented yet!**

**Implementation Needed:**
- When transcription completes (status → 'done')
- Check `profiles.after_transcript_action`
- If not 'nothing', automatically generate output
- Use sensible defaults (observer perspective, internal audience)
- Notify user when auto-generation completes

---

### **7. Search & Filtering** ⭐⭐ MEDIUM PRIORITY

**Current:**
- Sessions: Basic text search only
- Outputs: Filters exist but could be enhanced
- Templates: No search

**Improvements:**
- **Sessions**: Filter by status, date range, language, domain, has-outputs
- **Outputs**: Search content (full-text), filter by template + date
- **Templates**: Search by domain, usage count, creator

---

### **8. Export & Sharing** ⭐⭐ MEDIUM PRIORITY

**Current:**
- Download transcript (✅ working)
- Download output (partial)
- Copy to clipboard (partial)

**Enhancements:**
- Export session + all outputs as ZIP
- Export to DOCX/PDF (not just TXT)
- Share link (read-only, time-limited)
- Email output directly from app

---

### **9. Audio & Transcript UX** ⭐ LOW PRIORITY

**Working But Could Improve:**
- ✅ Click-to-seek (just added!)
- Add: Playback speed presets (0.5x, 1x, 1.25x, 1.5x, 2x)
- Add: Skip silence detection
- Add: Search within transcript
- Add: Highlight keywords
- Add: Speaker labeling (rename "Speaker 1" to "Dr. Schmidt")

---

### **10. Mobile Optimization** ⭐ LOW PRIORITY

**Current:**
- Mobile nav exists
- Sheets work well
- Could improve: Swipe gestures, bottom sheets, touch-optimized controls

---

### **11. Performance & Caching** ⭐⭐ MEDIUM PRIORITY

**Issues:**
- Every page load fetches fresh data
- AI analysis re-runs on every visit
- No caching strategy

**Solutions:**
- Cache AI analysis results (don't re-analyze same session)
- Implement SWR or React Query for better data management
- Offline support for viewing cached sessions

---

### **12. Error Handling & Feedback** ⭐⭐ MEDIUM PRIORITY

**Good Progress:**
- Toast notifications added
- Loading states implemented

**Still Missing:**
- Retry failed transcriptions
- Resume interrupted uploads
- Better error messages (user-friendly, not technical)
- Status polling for long-running operations

---

## 📊 PRIORITY MATRIX

| Priority | Improvement | Impact | Effort |
|----------|------------|--------|--------|
| ⭐⭐⭐ | 1. Save AI overrides | High | Low |
| ⭐⭐⭐ | 2. Output count badges | High | Low |
| ⭐⭐⭐ | 4. Template management | High | Medium |
| ⭐⭐⭐ | 6. Workflow automation | High | Medium |
| ⭐⭐ | 3. Enhanced AI extraction | Medium | Medium |
| ⭐⭐ | 5. Output management | Medium | Low |
| ⭐⭐ | 7. Search & filtering | Medium | Medium |
| ⭐⭐ | 8. Export & sharing | Medium | Medium |
| ⭐⭐ | 11. Performance | Medium | High |
| ⭐⭐ | 12. Error handling | Medium | Low |
| ⭐ | 9. Audio UX | Low | Low |
| ⭐ | 10. Mobile optimization | Low | Medium |

---

## 🎯 RECOMMENDED IMPLEMENTATION ORDER

### **Phase 1: Core Usability** (Your 3 requests + templates)
1. Save AI overrides & manual changes
2. Show output count in sessions list  
3. Enhanced AI context extraction
4. Fix templates page to use real data

### **Phase 2: Automation & Polish**
5. Implement "After Transcript" workflow automation
6. Output management improvements
7. Better error handling & retry logic

### **Phase 3: Advanced Features**
8. Search & filtering enhancements
9. Export improvements (DOCX, PDF, sharing)
10. Performance optimizations

---

## 🔍 TECHNICAL CONSIDERATIONS

### **For #1 (Save AI Overrides):**
```typescript
// API endpoint needed
PATCH /api/sessions/[id]/context
Body: {
  recording_type: "meeting",
  domains: ["legal", "consulting"],
  extracted_context: {...},
  locked: true
}
```

### **For #2 (Output Count):**
```typescript
// Modify session adapter
interface Session {
  // ... existing fields
  outputCount?: number  // NEW
}

// Update API to join with outputs table
```

### **For #3 (Enhanced Extraction):**
```typescript
// Expanded analysis response
{
  recordingType: "meeting",
  domains: [...],
  extractedContext: {  // NEW
    participants: [...],
    purpose: "...",
    topics: [...],
    decisions: [...],
    actionItems: [...]
  }
}
```

---

## ❓ DISCUSSION QUESTIONS

1. **Priority**: Which phase should we start with? Phase 1?
2. **AI Extraction**: What context fields are most important?
   - Participants (names)?
   - Action items?
   - Key decisions?
   - Meeting outcome?
3. **Workflow Automation**: Should auto-generated outputs be:
   - Saved silently in background?
   - Show notification when ready?
   - Send email when complete?
4. **Templates**: Do you want to:
   - Import more default templates?
   - Create template marketplace?
   - Allow template sharing between users?

---

**What would you like to tackle first?** 🚀
