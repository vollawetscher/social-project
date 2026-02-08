# Share Link Debugging Guide

## Current Status
- Token in DB: `bac79752-b305-42cc-b49d-f65773d67655`
- is_public: `true`
- RLS policies: ✅ Created
- Latest code: Deployed to `dev` branch

## Test This in Supabase SQL Editor

### Test 1: Can Anonymous Users Read This Output?
```sql
-- Run this query WITHOUT auth (use anon key or service role)
SELECT 
  id,
  template_name,
  share_token,
  is_public
FROM outputs
WHERE share_token = 'bac79752-b305-42cc-b49d-f65773d67655';
```

**Expected:** Should return 1 row  
**If empty:** RLS is still blocking

### Test 2: Check All RLS Policies on Outputs
```sql
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual
FROM pg_policies 
WHERE tablename = 'outputs'
ORDER BY policyname;
```

**Expected:** Should show "Anyone can view publicly shared outputs"

### Test 3: Check Sessions RLS
```sql
SELECT 
  policyname,
  cmd,
  qual
FROM pg_policies 
WHERE tablename = 'sessions';
```

**Expected:** Should show "Anyone can view sessions with public outputs"

### Test 4: Test the Full Query (As Anonymous)
```sql
-- This is what the API is running
SELECT 
  o.*,
  s.id as session_id,
  s.internal_case_id,
  t.name as template_name
FROM outputs o
LEFT JOIN sessions s ON s.id = o.session_id
LEFT JOIN templates t ON t.id = o.template_id
WHERE o.share_token = 'bac79752-b305-42cc-b49d-f65773d67655'
  AND o.is_public = true;
```

**If this returns data:** API should work  
**If empty:** Something is wrong with the query or RLS

## If Nothing Works

Try bypassing RLS temporarily:
```sql
-- TEMPORARILY disable RLS on outputs (for testing only)
ALTER TABLE outputs DISABLE ROW LEVEL SECURITY;

-- Test the share link now

-- IMPORTANT: Re-enable after testing!
ALTER TABLE outputs ENABLE ROW LEVEL SECURITY;
```

## Railway Logs to Check

When accessing the share URL, look for:
```
[Share] Looking up token: bac79752...
[Share] Step 1: Checking if output exists...
[Share] Check result: { found: true/false, error: ... }
```

**If found: false** → RLS is blocking the SELECT  
**If found: true** → Continue to next step in logs
