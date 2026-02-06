# AI Suggestions Debugging Checklist

## Issue: No AI suggestions appearing in session detail

### Checklist to diagnose:

1. **Database Migrations** - Required columns must exist:
   - Run in Supabase SQL Editor:
   ```sql
   -- Check if AI analysis columns exist
   SELECT column_name, data_type, column_default 
   FROM information_schema.columns 
   WHERE table_name = 'sessions' 
   AND column_name IN ('recording_type', 'recording_type_confidence', 'suggested_domains');
   ```
   - Expected: 3 rows (if columns exist), 0 rows (if not)
   - If 0 rows, run: `20260205_add_session_analysis_fields.sql`

2. **Transcript Data** - Check if transcript has raw_json:
   ```sql
   -- Check your session's transcript
   SELECT id, session_id, 
          CASE WHEN raw_json IS NULL THEN 'NULL' ELSE 'EXISTS' END as raw_json_status,
          jsonb_array_length(raw_json) as segment_count
   FROM transcripts 
   ORDER BY created_at DESC 
   LIMIT 5;
   ```
   - Expected: raw_json_status = 'EXISTS', segment_count > 0

3. **Browser Console** - Check for errors:
   - Open DevTools (F12)
   - Go to Console tab
   - Look for:
     - "Error analyzing session"
     - "Transcript not ready for analysis yet"
     - 400/500 errors on `/api/sessions/[id]/analyze`

4. **API Response** - Manually test the endpoint:
   ```bash
   # Get your session ID from the URL (e.g., sessions/abc-123)
   # In browser console, run:
   fetch('/api/sessions/YOUR_SESSION_ID/analyze', {method: 'POST'})
     .then(r => r.json())
     .then(d => console.log('Analysis result:', d))
     .catch(e => console.error('Analysis error:', e))
   ```

5. **Check Analysis State** - Add debug logging:
   - In session detail page, check if `analysis` state has data
   - Look for "analyzing" state in UI

### Common Fixes:

**Fix 1: Migrations not run**
```sql
-- Run this in Supabase SQL Editor
ALTER TABLE sessions 
ADD COLUMN IF NOT EXISTS recording_type TEXT,
ADD COLUMN IF NOT EXISTS recording_type_confidence DECIMAL(3,2),
ADD COLUMN IF NOT EXISTS suggested_domains JSONB DEFAULT '[]'::jsonb;

CREATE INDEX IF NOT EXISTS idx_sessions_recording_type ON sessions(recording_type);
```

**Fix 2: No ANTHROPIC_API_KEY**
- Check Railway environment variables
- Add: ANTHROPIC_API_KEY=sk-ant-...

**Fix 3: Transcript not ready**
- Wait for transcription to complete (status = 'ready')
- AI analysis only runs on completed transcripts

**Fix 4: RLS Blocking**
- Check if sessions table has proper RLS policies
- User must own the session to analyze it
