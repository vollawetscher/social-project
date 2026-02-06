# Complete Database Schema Reference

## Date: February 5, 2026
## Purpose: Comprehensive schema documentation to avoid field name mismatches

---

## TABLES & COLUMNS

### `profiles`
| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| id | uuid | NO | - | FK to auth.users |
| email | text | NO | - | User email |
| role | text | NO | 'user' | ENUM: 'user', 'admin' |
| created_at | timestamptz | NO | now() | |
| phone_number | text | YES | - | Added 20260119 |
| email_verified | boolean | NO | false | Added 20260119 |
| auto_generate_reports | boolean | NO | false | Added 20260131 |
| preferred_report_language | text | YES | - | Added 20260129 |

### `sessions`
| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| id | uuid | NO | gen_random_uuid() | PK |
| user_id | uuid | YES | - | FK to profiles (nullable for MVP) |
| created_at | timestamptz | NO | now() | |
| context_note | text | YES | '' | Optional context |
| internal_case_id | text | YES | '' | Session name/reference |
| status | text | NO | 'created' | ENUM: 'created', 'uploading', 'transcribing', 'summarizing', 'done', 'error' |
| duration_sec | integer | YES | 0 | Audio duration |
| last_error | text | YES | '' | Error message if failed |
| case_id | uuid | YES | - | FK to cases (added 20260123) |
| structured_context | jsonb | YES | - | Added 20260129 |
| audio_url | text | YES | - | **Added 20260205** |
| language | text | YES | 'en' | **Added 20260205** |
| recording_type | text | YES | - | **Added 20260205** |
| recording_type_confidence | decimal(3,2) | YES | - | **Added 20260205** |
| suggested_domains | jsonb | YES | - | **Added 20260205** |

### `files`
| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| id | uuid | NO | gen_random_uuid() | PK |
| session_id | uuid | NO | - | FK to sessions |
| storage_path | text | NO | - | Supabase Storage path |
| mime_type | text | NO | - | File MIME type |
| size_bytes | bigint | NO | 0 | **Note: NOT file_size!** |
| created_at | timestamptz | NO | now() | |
| file_purpose | file_purpose | NO | 'meeting' | **ENUM** (added 20260123) |
| file_id | uuid | YES | - | Added 20260123 |
| original_filename | text | YES | - | **Added 20260205** |
| upload_status | text | YES | 'pending' | **Added 20260205** |

### `transcripts`
| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| id | uuid | NO | gen_random_uuid() | PK |
| session_id | uuid | NO | - | FK to sessions |
| raw_json | jsonb | YES | - | Full transcript with timestamps |
| redacted_json | jsonb | YES | - | PII-redacted version |
| raw_text | text | YES | - | Plain text |
| redacted_text | text | YES | - | PII-redacted text |
| language | text | YES | - | Detected language |
| created_at | timestamptz | NO | now() | |
| file_id | uuid | YES | - | FK to files (added 20260123) |
| segments | jsonb | YES | - | Alias/additional field |

### `templates`
| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| id | uuid | NO | gen_random_uuid() | PK |
| name | text | NO | - | Template name |
| description | text | YES | - | Template description |
| intended_perspectives | text[] | YES | - | Array of perspectives |
| allowed_audience | text[] | YES | - | Array of audiences |
| domain_tags | text[] | YES | - | Array of domains |
| sections | jsonb | YES | - | Template sections structure |
| required_inputs | text[] | YES | - | Required input fields |
| style_rules | text[] | YES | - | Style guidelines |
| suggestion_triggers | text[] | YES | - | Keywords for suggestions |
| created_by | uuid | YES | - | FK to profiles |
| is_system | boolean | NO | false | System vs user template |
| used_count | integer | NO | 0 | Usage counter |
| created_at | timestamptz | NO | now() | |
| updated_at | timestamptz | NO | now() | |

### `outputs`
| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| id | uuid | NO | gen_random_uuid() | PK |
| session_id | uuid | NO | - | FK to sessions |
| template_id | uuid | YES | - | FK to templates |
| content | text | NO | - | Generated output |
| format | text | NO | 'text' | Output format |
| perspective | text | NO | - | Perspective used |
| audience | text | NO | - | Target audience |
| tone | text | YES | - | Tone/style |
| metadata | jsonb | YES | - | Additional metadata |
| created_by | uuid | YES | - | FK to profiles |
| created_at | timestamptz | NO | now() | |

### `cases`
| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| id | uuid | NO | gen_random_uuid() | PK |
| user_id | uuid | NO | - | FK to profiles |
| title | text | NO | - | Case title |
| status | text | NO | 'active' | Case status |
| created_at | timestamptz | NO | now() | |
| updated_at | timestamptz | NO | now() | |

---

## ENUMS

### `file_purpose`
**Values:** `'context'`, `'meeting'`, `'dictation'`, `'instruction'`, `'addition'`
- **Default:** `'meeting'`
- **DO NOT USE:** 'recording' ❌

---

## CRITICAL FIELD NAME MAPPINGS

### Common Mistakes:
| ❌ Wrong | ✅ Correct | Table |
|----------|------------|-------|
| file_size | size_bytes | files |
| filename | internal_case_id | sessions |
| recording | meeting | files.file_purpose enum |

---

## RLS POLICIES

### `sessions` - All operations allowed for own sessions
- ✅ SELECT: `user_id = auth.uid()`
- ✅ INSERT: `user_id = auth.uid()`
- ✅ UPDATE: `user_id = auth.uid()`
- ✅ DELETE: `user_id = auth.uid()`

### `files` - Access through session ownership
- ✅ SELECT: via session ownership
- ✅ INSERT: via session ownership

### `templates`
- ✅ SELECT: Public read
- ✅ INSERT: Authenticated users
- ✅ UPDATE: Owner only (`created_by = auth.uid()`)
- ✅ DELETE: Owner only (`created_by = auth.uid()`)

### `outputs`
- ✅ SELECT: via session ownership
- ✅ INSERT: via session ownership

---

## UPLOAD WORKFLOW (CORRECT)

### Step-by-Step:
1. **Create Session**
   ```typescript
   await supabase.from('sessions').insert({
     internal_case_id: 'Session Name',
     user_id: user.id, // REQUIRED for RLS
     status: 'uploading',
     language: 'en', // REQUIRED
     duration_sec: 120 // Optional but recommended
   })
   ```

2. **Upload to Storage**
   ```typescript
   await supabase.storage
     .from('rohbericht-audio')
     .upload(fileName, file)
   ```

3. **Get Public URL**
   ```typescript
   const { data: { publicUrl } } = supabase.storage
     .from('rohbericht-audio')
     .getPublicUrl(fileName)
   ```

4. **Update Session with Audio URL**
   ```typescript
   await supabase.from('sessions').update({
     audio_url: publicUrl,
     duration_sec: audioDuration
   }).eq('id', sessionId)
   ```

5. **Create File Record (CRITICAL)**
   ```typescript
   await supabase.from('files').insert({
     session_id: sessionId,
     storage_path: fileName,
     mime_type: file.type,
     size_bytes: file.size, // NOT file_size!
     file_purpose: 'meeting', // NOT 'recording'!
     original_filename: file.name,
     upload_status: 'completed'
   })
   ```

6. **Trigger Transcription**
   ```typescript
   await fetch(`/api/sessions/${sessionId}/transcribe`, {
     method: 'POST',
     body: JSON.stringify({
       storage_path: fileName,
       language: language
     })
   })
   ```

---

## MIGRATIONS TO RUN

**Run in Supabase Dashboard → SQL Editor in this order:**

### 1. Add Language Column
```sql
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS language TEXT DEFAULT 'en';
CREATE INDEX IF NOT EXISTS idx_sessions_language ON sessions(language);
```

### 2. Add Missing Files Columns
```sql
ALTER TABLE files ADD COLUMN IF NOT EXISTS original_filename TEXT;
ALTER TABLE files ADD COLUMN IF NOT EXISTS upload_status TEXT DEFAULT 'pending';
CREATE INDEX IF NOT EXISTS idx_files_upload_status ON files(upload_status);
```

### 3. Fix RLS Policies (if needed)
```sql
-- Only if INSERT still fails, drop conflicting public policy:
DROP POLICY IF EXISTS "Allow public access to sessions" ON sessions;
```

---

**END OF SCHEMA REFERENCE**
