# Implementation: Display Unredacted Transcripts (Option 4)

**Date:** 2026-01-23  
**Status:** ✅ Complete

## Overview

The system now displays **unredacted (raw) transcripts** by default while keeping the PII redaction system running in the background. This eliminates false-positive issues in the user interface while collecting PII detection data for future ML improvements.

---

## Implementation Summary

### What Changed

1. **Transcript Viewer** - Shows raw transcript by default
2. **Report Generator** - Claude receives raw (unredacted) text for better context
3. **Toggle Feature** - Users can optionally view the redacted version for comparison
4. **Quality Notes** - Updated to reflect that PII redaction is not applied to reports

### What Stayed the Same

- ✅ PII redaction **still runs** during transcription
- ✅ Both raw and redacted versions **still stored** in database
- ✅ PII hits **still tracked** in `pii_hits` table
- ✅ Data collection continues for future ML model training

---

## Files Modified

### 1. **Transcript Page** (`app/sessions/[id]/transcript/page.tsx`)

**Changes:**
- Default view changed from redacted to raw (`showRaw: true`)
- Removed admin-only restriction for toggle
- Inverted toggle button labels (now shows "PII-redaktierte Version" when viewing raw)
- Updated warning banner (now warns about redacted version being beta, not raw being sensitive)

**Result:** All users now see accurate transcripts by default with option to view redacted version for debugging.

---

### 2. **Transcript Viewer Component** (`components/transcript/TranscriptViewer.tsx`)

**Changes:**
- Removed "Rohversion (PII sichtbar)" warning badge
- Added "PII-redaktiert (Beta)" badge when viewing redacted version

**Result:** UI reflects that raw is the standard view, not a special "sensitive" mode.

---

### 3. **Report Generator** (`lib/services/report-generator.ts`)

**Changes:**
- Claude now receives `transcript.raw_json` instead of `transcript.redacted_json`
- Claude now receives `transcript.raw_text` instead of `transcript.redacted_text`
- Updated console log to indicate "RAW transcript (unredacted)"

**Result:** Reports are generated from complete context without false positives like [NAME_6] for "das".

---

### 4. **Claude Service** (`lib/services/claude.ts`)

**Changes:**
- Removed "Transkript (PII-redaktiert)" heading → now just "Transkript"
- Removed mention of PII placeholders from prompt
- Changed `"pii_redaction_applied": true` → `false` in quality notes template

**Result:** Claude generates reports knowing it has the full unredacted context.

---

## User Experience

### Before Implementation

**Transcript View:**
```
"Wir wieder wenn wir bereit sind für [NAME_1] Test mit [NAME_2]..."
"Mit [NAME_3] Urlaub Wir haben sie..."
"aber ein [NAME_4] war nicht nicht drin..."
```
- ❌ Many false positives ("Test", "Erkenntnissen", "das")
- ❌ Confusing placeholders
- ❌ Loss of context

**Report Quality:**
- ❌ Claude received broken context with [NAME_X] everywhere
- ❌ Lower quality summaries

---

### After Implementation

**Transcript View:**
```
"Wir wieder wenn wir bereit sind für einen frischeren Test mit neuen Erkenntnissen..."
"Mit Anna im Urlaub Wir haben sie..."
"aber ein Firstsupport Irgendwie war nicht nicht drin..."
```
- ✅ Complete, accurate text
- ✅ Only actual name "Anna" is relevant (but shown in raw view)
- ✅ Full context preserved

**Report Quality:**
- ✅ Claude sees complete conversation
- ✅ Better understanding and analysis
- ✅ No confusion from placeholders

**Toggle Feature:**
- Users can click "PII-redaktierte Version" to see what the redaction system detected
- Useful for debugging and understanding system behavior
- Warning shown that redacted version is in beta

---

## Database Schema (Unchanged)

The database continues to store both versions:

```sql
-- transcripts table
- raw_json          (original segments) ✅ Now used for display
- raw_text          (original full text) ✅ Now used for reports
- redacted_json     (PII-redacted segments) 📊 Stored for future use
- redacted_text     (PII-redacted text) 📊 Stored for future use

-- pii_hits table
- type              (name, phone, email, address, date)
- placeholder       ([NAME_1], [PHONE_1], etc.)
- original_hash     (SHA-256 hash of original value)
- start_ms / end_ms (timestamp in transcript)
📊 Still populated for future ML training
```

---

## Privacy Considerations

### ✅ Acceptable for Current Use Case

Based on user confirmation:
1. **Users only see their own sessions** - No cross-user data access
2. **No privacy concerns** - Users viewing their own conversations
3. **Future ML improvements** - PII data collection enables better models later

### 🔐 Data Flow

```
Audio File
  ↓
Speechmatics API (STT)
  ↓
Raw Transcript
  ├─→ PII Redaction Service (runs in background)
  │     ├─→ Stores PII hits in database 📊
  │     └─→ Stores redacted version in database 📊
  │
  ├─→ Display to User (Raw) ✅
  └─→ Send to Claude (Raw) ✅
        ↓
      Report Generation (with full context) ✅
```

---

## Benefits of This Approach

### Immediate Benefits
- ✅ Eliminates all false-positive UX issues
- ✅ Better report quality (Claude has full context)
- ✅ Users see accurate transcripts
- ✅ No confusion from [NAME_X] placeholders

### Future Benefits
- ✅ PII detection data continues to accumulate
- ✅ Database ready for future ML-based PII model
- ✅ Can switch back to redacted view when accuracy improves
- ✅ Toggle feature allows A/B comparison during development

---

## Next Steps (Future Improvements)

When ready to improve PII detection accuracy:

### Option A: ML-Based German NER (Recommended)
- Deploy spaCy with German language model
- Train on collected PII hits data
- Achieve 90-95% accuracy
- Cost: ~$5-8/month on Railway

### Option B: Enhanced Regex Patterns
- Add case-insensitive stopword matching
- Expand business terminology dictionary
- Improve context detection patterns
- Achieve ~88-92% accuracy

### Option C: Hybrid Approach
- Use regex for structured PII (phone, email, address, date)
- Use ML for name detection (hardest problem)
- Achieve 92-95% accuracy

---

## Testing Recommendations

### Manual Testing
1. Create new session with audio containing names
2. Verify transcript shows raw version by default
3. Click toggle to view redacted version
4. Confirm redacted version shows [NAME_X] placeholders (may be inaccurate)
5. Generate report and verify full context is used
6. Check that `pii_hits` table is still being populated

### Verification Queries
```sql
-- Check that both versions are stored
SELECT 
  session_id,
  length(raw_text) as raw_length,
  length(redacted_text) as redacted_length,
  (SELECT count(*) FROM pii_hits WHERE session_id = transcripts.session_id) as pii_count
FROM transcripts
WHERE session_id = 'YOUR_SESSION_ID';

-- Verify PII hits are still being recorded
SELECT type, count(*) as count
FROM pii_hits
GROUP BY type;
```

---

## Rollback Instructions

If you need to revert to showing redacted transcripts:

1. Change `showRaw` default back to `false` in `app/sessions/[id]/transcript/page.tsx`
2. Revert `lib/services/report-generator.ts` to use `redacted_json` and `redacted_text`
3. Revert `lib/services/claude.ts` prompt and quality notes

The database already has both versions, so no data migration needed.

---

## Summary

✅ **Implementation Complete**  
✅ **Users see accurate transcripts**  
✅ **Claude generates better reports**  
✅ **PII system continues learning in background**  
✅ **Future ML improvements enabled**

This implementation provides the best user experience now while maintaining the infrastructure for improved PII detection in the future.
