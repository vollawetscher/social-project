# User-Controlled Workflow Settings

## 🎯 Philosophy Change

### **Before: System Decides**
```
Upload audio → Transcribe → System auto-generates report
                            (User has no control)
```

### **After: User Decides** ✅
```
Upload audio → Transcribe → ✅ Transcription complete!
                            ↓
                    User chooses:
                    1. Click "Report neu erstellen" (manual)
                    2. OR enable auto-reports in Settings
```

---

## 🚀 What Changed

### **1. No More Automatic Reports (Default)**

**OLD Behavior:**
- System automatically generated reports after transcription
- User had no control
- Happened for all "meeting" recordings 30+ seconds
- No way to disable

**NEW Behavior:**
- Reports are **NOT** generated automatically by default
- User must explicitly:
  - **Option A:** Click "Report neu erstellen" button manually
  - **Option B:** Enable auto-generation in Profile Settings
- Full user control over when reports are created

---

## ⚙️ Settings Location

### **Where to Find It:**
```
Profile → Workflow Settings → Auto-generate Reports
```

### **How to Enable Auto-Reports:**
1. Click your profile (top right)
2. Scroll to "Workflow Settings" card
3. Toggle "Auto-generate Reports" switch
4. Click "Save Settings"

### **UI Preview:**
```
┌──────────────────────────────────────────────────┐
│ ⚙️ Workflow Settings                             │
│ Control what happens after audio transcription  │
│                                                  │
│ ┌──────────────────────────────────────────┐    │
│ │ ⚡ Auto-generate Reports          [OFF] │    │
│ │                                           │    │
│ │ Automatically create reports after        │    │
│ │ transcribing meeting recordings (30+ sec).│    │
│ │ When disabled, you'll need to manually   │    │
│ │ click "Report neu erstellen" after        │    │
│ │ transcription.                            │    │
│ │                                           │    │
│ │ 💡 Recommended: Leave OFF to review       │    │
│ │ transcripts before generating reports.    │    │
│ └──────────────────────────────────────────┘    │
│                                                  │
│                        [Save Settings]           │
└──────────────────────────────────────────────────┘
```

---

## 📊 Workflow Comparison

### **Scenario 1: Manual Mode (Default)**
```
1. Upload 5-minute meeting recording
   Status: ⬆️ Uploading...

2. Transcription starts automatically
   Status: 🎙️ Transcribing...

3. Transcription completes
   Status: ✅ Fertig
   Message: "✅ Transkription abgeschlossen! 
            Sie können jetzt einen Report erstellen.
            Klicken Sie auf 'Report neu erstellen' unten."

4. User reviews transcript

5. User clicks "Report neu erstellen"
   Status: 📝 Wird zusammengefasst...

6. Report ready
   Status: ✅ Fertig
```

**Benefits:**
- ✅ Review transcript before generating report
- ✅ Decide if report is needed
- ✅ Save API costs for recordings that don't need reports
- ✅ Full control

---

### **Scenario 2: Auto Mode (Opt-In)**
```
1. User enables "Auto-generate Reports" in Profile

2. Upload 5-minute meeting recording
   Status: ⬆️ Uploading...

3. Transcription starts automatically
   Status: 🎙️ Transcribing...

4. Transcription completes → Report generation starts automatically
   Status: 📝 Wird zusammengefasst...

5. Report ready
   Status: ✅ Fertig
```

**Benefits:**
- ✅ Faster for routine recordings
- ✅ No manual intervention needed
- ✅ Good for high-volume workflows

**Conditions for Auto-Generation:**
- ✅ User has enabled setting
- ✅ Recording type is "meeting"
- ✅ Duration is 30+ seconds
- ❌ Otherwise: transcribe only

---

## 🎯 Default Behavior

### **New Users:**
- `auto_generate_reports` = `false`
- Must opt-in to enable
- Safe, predictable default

### **Existing Users:**
- Migration sets `auto_generate_reports` = `false`
- No behavior change on deploy
- Can enable in Profile if desired

---

## 💡 When to Use Each Mode

### **Use Manual Mode (Default) When:**
- ❓ You want to review transcripts first
- 💰 Cost-conscious (only generate needed reports)
- 🎯 Quality-focused (check before generating)
- 📊 Mixed content (not all recordings need reports)
- 🧪 Testing/experimenting

**Recommended for:** Most users, quality-focused workflows

---

### **Use Auto Mode (Opt-In) When:**
- ⚡ High volume (many recordings daily)
- 🔄 Consistent workflow (all recordings → reports)
- ⏰ Time-sensitive (need reports ASAP)
- 🤖 Automated pipelines
- 📈 Established process

**Recommended for:** Power users, high-volume workflows

---

## 🔧 Technical Implementation

### **Database Schema:**
```sql
-- profiles table
ALTER TABLE profiles 
ADD COLUMN auto_generate_reports boolean DEFAULT false,
ADD COLUMN preferences jsonb DEFAULT '{}'::jsonb;
```

### **Transcription Logic:**
```typescript
// After transcription completes...

// 1. Get user preference
const { data: userProfile } = await supabase
  .from('profiles')
  .select('auto_generate_reports')
  .eq('id', userId)
  .single()

// 2. Check conditions
const shouldGenerateReport = 
  userProfile?.auto_generate_reports &&  // User enabled
  hasMeetingRecording &&                 // Is meeting
  sessionDuration >= 30                  // Long enough

// 3. Act accordingly
if (shouldGenerateReport) {
  await generateReport(sessionId, supabase)
} else {
  // Just mark as done, user generates manually
}
```

### **Settings UI:**
```typescript
// Profile page state
const [autoGenerateReports, setAutoGenerateReports] = useState(false)

// Load from profile
useEffect(() => {
  if (profile?.auto_generate_reports !== undefined) {
    setAutoGenerateReports(profile.auto_generate_reports)
  }
}, [profile])

// Save to database
const handleSettingsSave = async () => {
  await supabase
    .from('profiles')
    .update({ auto_generate_reports: autoGenerateReports })
    .eq('id', user.id)
}
```

---

## 📈 Expected Impact

### **User Experience:**
| Metric | Before | After |
|--------|--------|-------|
| **Control** | None | Full |
| **Predictability** | Automatic | User decides |
| **Cost** | Higher | Lower (manual mode) |
| **Flexibility** | None | High |
| **Review** | After generation | Before (manual) |

### **API Cost Savings (Manual Mode):**
- Users review transcripts first
- Only generate reports when needed
- Estimated savings: **30-50%** on report generation

### **User Satisfaction:**
- ✅ More control
- ✅ No surprises
- ✅ Can review first
- ✅ Flexible workflow

---

## 🧪 Testing

### **Test Case 1: Manual Mode (Default)**
```
1. Upload audio (30+ sec, type: meeting)
2. Wait for transcription
3. ✅ Expect: Status = "done", no report
4. ✅ Expect: Green info card: "Transcription complete"
5. Click "Report neu erstellen"
6. ✅ Expect: Report generated
```

### **Test Case 2: Auto Mode (Enabled)**
```
1. Go to Profile → Enable "Auto-generate Reports"
2. Upload audio (30+ sec, type: meeting)
3. Wait for transcription
4. ✅ Expect: Report auto-generates
5. ✅ Expect: Status goes to "summarizing" then "done"
```

### **Test Case 3: Short Recording (Manual)**
```
1. Upload 15-second audio
2. Wait for transcription
3. ✅ Expect: Status = "done", no report
4. ✅ Expect: Info card: "Transcription complete"
5. ✅ Expect: Can still manually generate report
```

### **Test Case 4: Settings Persistence**
```
1. Enable auto-reports in Profile
2. Save settings
3. Refresh page
4. ✅ Expect: Setting still enabled
5. Disable and save
6. ✅ Expect: Setting disabled
```

---

## 🔒 Security & Privacy

### **RLS Policies:**
- Users can only update their own `auto_generate_reports` setting
- Existing profile RLS policies apply:
  ```sql
  -- Users can update own profile
  CREATE POLICY "Users can update own profile"
    ON profiles FOR UPDATE
    TO authenticated
    USING (auth.uid() = id)
    WITH CHECK (auth.uid() = id);
  ```

### **Data Privacy:**
- Setting stored in user's profile (private)
- Not visible to other users
- Not included in reports or exports

---

## 🚀 Migration Guide

### **For Users:**
1. After deploy, go to Profile
2. Notice new "Workflow Settings" section
3. Default = OFF (reports not auto-generated)
4. Enable if you want automatic reports
5. Otherwise, click "Report neu erstellen" manually

### **For Developers:**
1. Migration runs automatically on deploy
2. Adds columns to `profiles` table
3. Sets default values (false) for all users
4. No manual intervention needed
5. Verify with:
   ```sql
   SELECT auto_generate_reports FROM profiles WHERE id = 'user-id';
   ```

### **Rollback (if needed):**
```sql
-- Remove columns
ALTER TABLE profiles 
DROP COLUMN auto_generate_reports,
DROP COLUMN preferences;

-- Revert transcription logic (re-enable auto for all)
```

---

## 📚 Related Documentation

- **AI Classification:** `docs/AI_FIRST_PHILOSOPHY.md`
- **Recording Workflow:** `docs/RECORDING_WORKFLOW.md`
- **Profile Settings:** `app/profile/page.tsx`
- **Transcription Logic:** `app/api/sessions/[id]/transcribe/route.ts`

---

## 💬 FAQ

### **Q: Why did you remove automatic reports?**
**A:** User control and flexibility. Not every recording needs a report. Review first, generate when needed.

### **Q: Can I still get automatic reports?**
**A:** Yes! Enable "Auto-generate Reports" in Profile → Workflow Settings.

### **Q: What happens to my existing sessions?**
**A:** No change. Existing reports stay. New recordings follow your setting.

### **Q: Will short recordings still transcribe?**
**A:** Yes! Transcription always happens. Reports are optional.

### **Q: Can I generate reports manually?**
**A:** Yes! Click "Report neu erstellen" button on any session.

### **Q: Does this save API costs?**
**A:** Yes (manual mode). Only generate reports when needed.

### **Q: What's the recommended setting?**
**A:** **Manual (OFF)** for most users. Review transcript first, then generate.

---

**Created:** January 31, 2026  
**Status:** ✅ Production  
**Default:** Manual (auto_generate_reports = false)  
**Commit:** `791e138`

