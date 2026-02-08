# Template Learning System 🧠

## Overview

Notissima's **Template Learning System** allows users to create custom templates by uploading sample documents. The AI analyzes these samples and automatically extracts the structure, style, and requirements to generate similar documents in the future.

This is the **killer feature** that makes Notissima self-learning and adaptive to each user's specific needs.

---

## How It Works

### User Journey

1. **Upload Samples** (`/templates/new/from-samples`)
   - User uploads 1-5 sample documents (PDF, DOCX, TXT)
   - Examples: Past meeting minutes, client reports, summaries they've written

2. **AI Analysis**
   - Click "Analyze Samples" button
   - Claude AI examines the documents and extracts:
     - **Section structure** (headings, subheadings)
     - **Tone** (Professional/Casual/Technical)
     - **Perspective** (First person/Third person)
     - **Style characteristics** (bullet points, paragraph length, formality)
     - **Required inputs** (participants, agenda, venue, etc.)
     - **Generation instructions** (how to write this type of document)

3. **Review & Confirm Constraints**
   - User confirms or adjusts:
     - Intended perspectives (who can use this template)
     - Allowed audience (internal/external)
     - Required inputs checklist

4. **Save Template**
   - Name the template
   - Add description and tags
   - Template is saved and immediately available

5. **Use Template**
   - Template appears in output generation
   - AI uses learned structure, tone, and instructions
   - Generates documents matching the user's style

---

## Technical Implementation

### Architecture

```
User uploads samples
    ↓
Frontend → POST /api/templates/analyze-samples (FormData with files)
    ↓
API extracts text from files
    ↓
Claude AI analyzes text structure and style
    ↓
Returns structured analysis (JSON)
    ↓
Frontend displays results
    ↓
User confirms → POST /api/templates (creates template)
    ↓
Template stored in database with instructions
    ↓
Used for future output generation
```

### Key Components

#### 1. **Document Parser** (`lib/services/document-parser.ts`)
- Extracts text from TXT files
- Placeholder for PDF/DOCX parsing (would require additional libraries)
- Analyzes document structure (headings, sections)
- Calculates metadata (word count, etc.)

#### 2. **Analysis API** (`app/api/templates/analyze-samples/route.ts`)
- Accepts multiple files via FormData
- Extracts text from each file
- Sends combined text to Claude AI
- Parses AI response into structured format
- Returns analysis results to frontend

#### 3. **Claude AI Prompt**
Sophisticated prompt that asks Claude to identify:
- Section structure with descriptions
- Tone and writing style
- Perspective and language
- Style characteristics (bullets, lists, formality)
- Required inputs for generation
- Clear generation instructions

#### 4. **Wizard UI** (`app/(app)/templates/new/from-samples/page.tsx`)
- 4-step wizard with progress indicator
- File upload with drag-and-drop
- Real-time AI analysis with loading state
- Interactive constraints selection
- Template naming and tagging

#### 5. **Template Creation** (`app/api/templates/route.ts`)
- Accepts analyzed structure
- Stores sections, style rules, and **instructions**
- Saves to database with user ownership

#### 6. **Database Schema** (`templates` table)
- `instructions` column: TEXT field storing generation instructions
- Used by output generation API
- Migration: `20260208_add_template_instructions.sql`

---

## AI Analysis Output Format

```json
{
  "sections": [
    {
      "name": "Executive Summary",
      "detected": true,
      "description": "High-level overview of key points"
    },
    {
      "name": "Key Findings",
      "detected": true,
      "description": "Main discoveries or outcomes"
    }
  ],
  "tone": "Professional / Formal",
  "perspective": "Third Person",
  "language": "English",
  "styleCharacteristics": {
    "averageParagraphLength": "Medium",
    "usesBulletPoints": true,
    "usesNumberedLists": false,
    "formality": "Formal"
  },
  "requiredInputs": ["participants", "purpose", "key_topics", "decisions"],
  "suggestedInstructions": "Generate a professional summary documenting meeting outcomes, key decisions, and action items in a formal, third-person tone suitable for executive review."
}
```

---

## Use Cases

### 1. **Legal Professionals**
Upload 3 sample consultation notes → AI learns their structure → Generate identical format for future consultations

### 2. **Consultants**
Upload client meeting summaries → AI learns their style → Generate client-ready summaries matching their brand voice

### 3. **Team Managers**
Upload team meeting minutes → AI learns their format → Generate consistent meeting docs for the team

### 4. **Sales Teams**
Upload discovery call summaries → AI learns their structure → Generate uniform call notes

---

## Why This Is Powerful

### **Self-Perpetuating Templates**
- Users don't start from scratch
- They teach Notissima by example
- Each user's templates match their exact style

### **No Template Expertise Required**
- Don't need to understand template structure
- Just upload what you already have
- AI figures out the pattern

### **Continuous Improvement**
- Users can upload more samples later
- Refine templates based on new best examples
- Templates evolve with user needs

### **Personalization at Scale**
- Every user has unique templates
- AI learns individual writing styles
- Documents feel authentic, not AI-generated

---

## Current Limitations

### File Format Support
- ✅ **TXT files**: Fully supported
- ⏳ **PDF files**: Text extraction not yet implemented (requires `pdf-parse` library)
- ⏳ **DOCX files**: Text extraction not yet implemented (requires `mammoth` library)

### Future Enhancements
1. **Add PDF parsing**: Install `pdf-parse` npm package
2. **Add DOCX parsing**: Install `mammoth` npm package
3. **Multi-file comparison**: Highlight differences between samples
4. **Iterative refinement**: "Re-analyze with more samples" option
5. **Style preview**: Show before/after output comparison
6. **Template versioning**: Track template evolution over time

---

## Database Migration Required

Run this migration to add the `instructions` field:

```bash
# In Supabase SQL Editor:
/supabase/migrations/20260208_add_template_instructions.sql
```

Or use the auto-migration script:
```sql
ALTER TABLE public.templates
ADD COLUMN IF NOT EXISTS instructions TEXT;
```

---

## Testing Guide

### Test the Feature

1. **Prepare Sample Documents**
   - Create 2-3 TXT files with similar structure
   - Example: Meeting minutes with consistent sections
   - Save as: `sample1.txt`, `sample2.txt`, `sample3.txt`

2. **Navigate to Template Wizard**
   - Go to `/templates`
   - Click "Create from Samples" button
   - Should redirect to `/templates/new/from-samples`

3. **Upload Samples**
   - Drag and drop or click to upload TXT files
   - Should see uploaded files listed
   - Click "Next"

4. **Run AI Analysis**
   - Click "Analyze Samples" button
   - Should show loading spinner with progress bar
   - Wait 5-10 seconds for Claude response
   - Should display detected sections, tone, perspective, language

5. **Confirm Constraints**
   - Review and adjust intended perspectives
   - Select audience (internal/external)
   - Check/uncheck required inputs
   - Click "Next"

6. **Save Template**
   - Enter template name
   - Add description (optional)
   - Add tags (optional)
   - Review summary
   - Click "Save Template"
   - Should redirect to `/templates` with success message

7. **Use New Template**
   - Go to a session with transcript
   - Click "Generate Output"
   - Your new template should appear in the list
   - Select it and generate output
   - Output should match the style of your samples!

### Expected Results

✅ AI extracts consistent sections across samples  
✅ Detects writing tone and perspective accurately  
✅ Identifies required inputs for this document type  
✅ Generates clear instructions for future use  
✅ Template creation succeeds  
✅ Template appears in outputs generation  
✅ Generated outputs match sample style  

---

## Example Sample Content

**Sample Meeting Minutes (sample1.txt):**
```
Executive Summary
This meeting covered project timeline and budget allocation for Q1 2026.

Key Decisions
- Budget approved: €50,000
- Timeline extended by 2 weeks
- John to lead implementation

Action Items
- Sarah: Prepare budget breakdown by Friday
- Mike: Update project plan
- Team: Review requirements document

Next Meeting
February 15, 2026 at 2:00 PM
```

**AI Would Extract:**
- Sections: Executive Summary, Key Decisions, Action Items, Next Meeting
- Tone: Professional / Formal
- Perspective: Third Person
- Required Inputs: participants, decisions, action_items, next_meeting_date
- Instructions: "Generate structured meeting minutes documenting decisions, action items, and next steps in a professional tone suitable for stakeholders."

---

## Impact

This feature transforms Notissima from a **transcription tool** into a **knowledge platform** that learns and adapts to each user's unique documentation style.

**Result:** Users get AI-generated documents that sound like THEY wrote them, not like a generic AI.

🎯 **The secret sauce of Notissima!**
