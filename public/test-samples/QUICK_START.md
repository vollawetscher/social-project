# Template Learning - Quick Start Guide

## 🎯 Goal
Create a custom template by uploading sample documents. AI learns your style and generates matching documents in the future.

---

## 📝 Step-by-Step

### 1. **Database Setup** (One-time)
Run this in **Supabase SQL Editor**:
```sql
ALTER TABLE public.templates
ADD COLUMN IF NOT EXISTS instructions TEXT;
```

### 2. **Navigate to Template Wizard**
- Go to `/templates`
- Click **"Create from Samples"** button
- You'll see a 4-step wizard

### 3. **Upload Your Samples** (Step 1)
**Option A - Use Test Samples:**
- Download files from this folder (`test-samples`)
- Upload 2-3 sample files
- Good for testing the feature

**Option B - Use Your Own:**
- Find 2-3 documents you've written (same type)
- Copy content into TXT files
- Upload them
- Better for production use

### 4. **Run AI Analysis** (Step 2)
- Click **"Analyze Samples"** button
- Wait 5-10 seconds
- AI will extract:
  - ✅ Section structure (headings)
  - ✅ Writing tone and style
  - ✅ Perspective (1st/3rd person)
  - ✅ Required inputs
  - ✅ Generation instructions

### 5. **Confirm Settings** (Step 3)
- Choose **perspectives** (who can use this template)
- Select **audience** (internal/external)
- Check/uncheck **required inputs**
- Click **"Next"**

### 6. **Name & Save** (Step 4)
- Template name: `My Meeting Minutes`
- Description: `Minutes format for team meetings`
- Tags: `meetings, team, internal`
- Click **"Save Template"**

### 7. **Use Your Template** 🎊
- Go to any session with transcript
- Click **"Generate Output"** 
- Your new template appears in the list
- Select it → Generate
- **Output matches your sample style!**

---

## 🧪 Test Samples Included

### **Meeting Minutes** (`sample-meeting-minutes.txt`)
- Sections: Summary, Decisions, Action Items
- Best for: Team meetings, project updates
- Tone: Professional/Formal

### **Consultation Notes** (`sample-consultation-notes.txt`)
- Sections: Client Info, Needs, Solution, Next Steps
- Best for: Client meetings, sales calls
- Tone: Professional/Business

### **Interview Summary** (`sample-interview-summary.txt`)
- Sections: Candidate Overview, Assessment, Recommendation
- Best for: Job interviews, evaluations
- Tone: Professional/Evaluative

---

## ⏱️ Total Time: ~5 minutes

1. Database setup: 30 seconds
2. Upload samples: 1 minute
3. AI analysis: 10 seconds
4. Confirm settings: 2 minutes
5. Save template: 1 minute

**And you have a personalized template forever!**

---

## 🎯 Pro Tips

### For Best Results:
1. **Upload 2-5 similar documents** (not just 1)
2. **Use consistent formatting** (same heading style)
3. **Include your best work** (AI learns from quality)
4. **Start with TXT files** (easiest to process)

### What to Upload:
- ✅ Meeting minutes you're proud of
- ✅ Client reports that got great feedback
- ✅ Summaries that your team uses as examples
- ✅ Documents with clear, consistent structure

### What NOT to Upload:
- ❌ Random, unrelated documents
- ❌ Poorly formatted or messy notes
- ❌ Documents with inconsistent styles
- ❌ Content you don't want to replicate

---

## 🚀 The Magic

**Traditional template creation:**
User describes → AI interprets → Result is generic

**Notissima's approach:**
User shows examples → AI learns patterns → Result matches user's style

**Outcome:** Documents that feel authentic and personal, not AI-generated.

---

## ❓ Troubleshooting

**"Analysis is taking too long"**
- Claude can take 10-15 seconds for complex documents
- Check browser console for errors
- Try with shorter/simpler samples first

**"No sections detected"**
- Samples might lack clear headings
- Try documents with more obvious structure
- Check that headings are on separate lines

**"Template not appearing in generation"**
- Refresh the page
- Check templates list to confirm it saved
- Verify you're logged in as the same user

**"Generated output doesn't match style"**
- Try uploading more samples (3-5 is better than 1-2)
- Check that samples are actually similar in style
- Review the AI-detected style in Step 2

---

## 📞 Need Help?

Use the **Bug Reporter** button in your profile to report any issues!

---

**Ready to teach Notissima YOUR style?** 🎨

Upload samples → Let AI learn → Generate perfect documents → Forever! ✨
