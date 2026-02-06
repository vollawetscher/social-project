# User Language Preferences System

## ✅ What's Been Implemented

### 1. **User Profile Preferences**
Your users now have personalized language and workflow settings stored in their profile:

| Setting | Default | Purpose |
|---------|---------|---------|
| **Default Recording Language** | German (de) | Language used for audio transcription |
| **Preferred Report Language** | German (de) | Language for AI-generated reports |
| **Timezone** | Europe/Berlin | Timezone for timestamp display |
| **After Transcript Action** | Do Nothing | What happens after transcription completes |

---

### 2. **Functional Settings Page**
The Settings page (`/settings`) is now fully functional:

- ✅ **Language Preferences Section**
  - Default Recording Language dropdown (8 languages)
  - Preferred Report Language dropdown (8 languages)
  - Timezone selector (12 major timezones)

- ✅ **Workflow Automation Section**
  - After Transcript Completes:
    - **Do Nothing** - Manual report generation only
    - **Short Summary** - Quick overview (1-2 paragraphs)
    - **Long Summary** - Detailed summary with key points
    - **Full Report** - Complete analysis with all sections

- ✅ **Save Button**
  - Updates user profile in database
  - Shows loading state while saving
  - Toast notifications for success/error

- ❌ **Removed**
  - PII Redaction toggle (not fully functional yet)
  - Offline/PWA section (not implemented yet)

---

### 3. **Upload Workflows Integration**
Both upload pages now use user preferences:

#### **Sessions Page (`/sessions`)**
- Fetches user's `default_recording_language` on page load
- Pre-populates language selector with user preference
- User can override per session if needed

#### **Upload Page (`/record/upload`)**
- Same behavior as sessions page
- Consistent experience across app

---

### 4. **Database Schema**

New columns added to `profiles` table:

```sql
default_recording_language TEXT DEFAULT 'de'
preferred_report_language TEXT DEFAULT 'de'
timezone TEXT DEFAULT 'Europe/Berlin'
after_transcript_action TEXT DEFAULT 'nothing'
```

With check constraints ensuring valid values.

---

### 5. **New API Endpoint**

**GET `/api/profile`** - Fetch authenticated user's profile
**PATCH `/api/profile`** - Update user preferences

Whitelisted fields:
- `default_recording_language`
- `preferred_report_language`
- `timezone`
- `after_transcript_action`
- `auto_generate_reports`

---

## 🚀 Next Steps: Run Migration

### **Run this in Supabase Dashboard → SQL Editor:**

```sql
-- Add user language preferences
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS default_recording_language TEXT DEFAULT 'de',
ADD COLUMN IF NOT EXISTS timezone TEXT DEFAULT 'Europe/Berlin';

-- Update existing preferred_report_language if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'preferred_report_language'
  ) THEN
    ALTER TABLE profiles ADD COLUMN preferred_report_language TEXT DEFAULT 'de';
  END IF;
END $$;

-- Add after_transcript_action preference
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS after_transcript_action TEXT DEFAULT 'nothing';

-- Add comments
COMMENT ON COLUMN profiles.default_recording_language IS 'Default language for audio transcription (de, en, es, fr, etc.)';
COMMENT ON COLUMN profiles.preferred_report_language IS 'Default language for AI-generated reports';
COMMENT ON COLUMN profiles.timezone IS 'User timezone for timestamp display (IANA timezone format)';
COMMENT ON COLUMN profiles.after_transcript_action IS 'Action to take after transcription completes: nothing, short_summary, long_summary, full_report';

-- Add check constraints
ALTER TABLE profiles
ADD CONSTRAINT profiles_default_recording_language_check
CHECK (default_recording_language IN ('de', 'en', 'es', 'fr', 'it', 'pt', 'nl', 'pl', 'cs', 'da', 'fi', 'no', 'sv', 'ru', 'ja', 'zh', 'ko', 'ar', 'hi'));

ALTER TABLE profiles
ADD CONSTRAINT profiles_preferred_report_language_check
CHECK (preferred_report_language IN ('de', 'en', 'es', 'fr', 'it', 'pt', 'nl', 'pl', 'cs', 'da', 'fi', 'no', 'sv', 'ru', 'ja', 'zh', 'ko', 'ar', 'hi'));

ALTER TABLE profiles
ADD CONSTRAINT profiles_after_transcript_action_check
CHECK (after_transcript_action IN ('nothing', 'short_summary', 'long_summary', 'full_report'));

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_profiles_default_recording_language ON profiles(default_recording_language);
CREATE INDEX IF NOT EXISTS idx_profiles_after_transcript_action ON profiles(after_transcript_action);

-- Update existing users to German defaults
UPDATE profiles 
SET 
  default_recording_language = 'de',
  preferred_report_language = COALESCE(preferred_report_language, 'de'),
  timezone = COALESCE(timezone, 'Europe/Berlin'),
  after_transcript_action = COALESCE(after_transcript_action, 'nothing')
WHERE default_recording_language IS NULL OR preferred_report_language IS NULL;
```

---

## 🎯 User Experience Flow

### **First Time User:**
1. User signs up → Profile created with German defaults
2. User goes to `/settings` → Sees German as default language
3. User can change preferences and save
4. User uploads a recording → Language selector pre-filled with their preference
5. User can override language for that specific session if needed

### **Existing User:**
1. Migration runs → All profiles updated to German defaults
2. Existing sessions keep their original language
3. New sessions use user's preferred language

---

## 🔧 Supported Languages

| Code | Language |
|------|----------|
| de | German (Deutsch) |
| en | English |
| es | Spanish (Español) |
| fr | French (Français) |
| it | Italian (Italiano) |
| pt | Portuguese (Português) |
| nl | Dutch (Nederlands) |
| pl | Polish (Polski) |

---

## 🌍 Supported Timezones

- Europe/Berlin (CET/CEST) ← **Default**
- Europe/London (GMT/BST)
- Europe/Paris (CET/CEST)
- Europe/Vienna (CET/CEST)
- Europe/Zurich (CET/CEST)
- America/New_York (EST/EDT)
- America/Los_Angeles (PST/PDT)
- America/Chicago (CST/CDT)
- Asia/Tokyo (JST)
- Asia/Shanghai (CST)
- Asia/Dubai (GST)
- Australia/Sydney (AEDT/AEST)

---

## 📋 Summary of All Migrations Needed

Run these in order in Supabase:

1. ✅ **Language column** (from previous session)
2. ✅ **Missing files columns** (from previous session)
3. ✅ **Fix RLS policies** (from previous session)
4. 🆕 **User language preferences** (NEW - see above)
5. 🆕 **Update existing sessions language** (if needed):
   ```sql
   UPDATE sessions SET language = 'de' WHERE language = 'en' OR language IS NULL;
   ```

---

## 🎉 What This Solves

✅ **Your Original Issue**: All recordings showing English instead of German  
✅ **Per-user defaults**: Each user can set their own language preferences  
✅ **Flexibility**: Users can override per session  
✅ **Workflow automation**: Ready for automatic report generation  
✅ **Timezone support**: Proper timestamp display  
✅ **Scalability**: Easy to add more languages/preferences  

---

**All changes have been deployed to dev branch and will auto-deploy to Railway!** 🚀
