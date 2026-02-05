# Templates Screen Analysis - In-Depth Report

## Date: February 5, 2026
## Scope: `/templates` page, `/templates/new/from-samples` page, `/templates/[id]/edit` page

---

## 1. TEMPLATES LIST PAGE (`/app/(app)/templates/page.tsx`)

### ✅ WORKING FEATURES

1. **Data Fetching** - Fetches real templates from `/api/templates`
2. **Display** - Responsive table (desktop) and card (mobile) views
3. **Template Details** - Sheet/drawer shows full template info
4. **Delete Template** - Connected to `DELETE /api/templates/[id]` with confirmation
5. **Duplicate Template** - Connected to `POST /api/templates/[id]/duplicate`
6. **Domain-specific Coloring** - Visual tags for different domains

### ❌ MISSING/BROKEN FEATURES

#### 1. **Edit Template** (High Priority)
- **Status**: Links to `/templates/${id}/edit` but page doesn't exist
- **Current**: Click "Edit" → 404 error
- **Fix Required**: Create edit page component
- **Code Location**: Lines 327-330 (mobile), 438-443 (desktop)

#### 2. **Create from Output** Button (Medium Priority)
- **Status**: Button exists but no functionality
- **Current**: Button does nothing (line 274-277)
- **Fix Required**: Implement reverse-engineering from existing outputs
- **Expected Flow**: Select output → Extract template pattern → Create template

#### 3. **Toast Notifications** (Low Priority)
- **Status**: Uses `alert()` instead of toast
- **Current**: Line 221 (delete), line 239 (duplicate)
- **Fix Required**: Replace with `toast` from sonner

---

## 2. CREATE FROM SAMPLES PAGE (`/app/(app)/templates/new/from-samples/page.tsx`)

### ✅ WORKING FEATURES

1. **UI/UX** - Beautiful 4-step wizard
2. **Progress Tracking** - Visual step indicators
3. **Mock Data** - Sample files, analysis results displayed

### ❌ MISSING/BROKEN FEATURES

#### 1. **File Upload** (Critical)
- **Status**: Dropzone exists but no upload logic
- **Current**: No `onChange` or `onDrop` handler (line 200-208)
- **Fix Required**: 
  - Add file input with actual upload
  - Handle PDF, DOCX, TXT files
  - Store uploaded files temporarily

#### 2. **AI Analysis** (Critical)
- **Status**: "Analyze Samples" button just shows mock data
- **Current**: `setTimeout` mock (lines 78-84)
- **Fix Required**:
  - Create API endpoint `/api/templates/analyze-samples`
  - Use Claude AI to extract:
    - Document structure (sections)
    - Tone and style
    - Formatting patterns
    - Key elements

#### 3. **Save Template** (Critical)
- **Status**: "Save Template" button just links back to list
- **Current**: No actual save operation (lines 503-508)
- **Fix Required**:
  - Call `POST /api/templates` with all wizard data
  - Create template with:
    - Name, description, tags
    - Sections from analysis
    - Perspectives, audience, required inputs
    - Style rules from AI analysis

---

## 3. EDIT TEMPLATE PAGE (`/app/(app)/templates/[id]/edit/page.tsx`)

### ❌ STATUS: **DOES NOT EXIST**

**Required**: Create entire page from scratch

**Expected Features**:
1. Load existing template data
2. Edit form with sections:
   - Basic info (name, description, tags)
   - Sections (add/edit/remove/reorder)
   - Perspectives and audience
   - Required inputs
   - Style rules
   - Domain tags
3. Save button → `PATCH /api/templates/[id]`
4. Cancel/Back button → Return to list

---

## 4. API ROUTES STATUS

| Route | Method | Status | Notes |
|-------|--------|--------|-------|
| `/api/templates` | GET | ✅ Working | Returns all templates |
| `/api/templates` | POST | ✅ Working | Creates new template |
| `/api/templates/[id]` | GET | ✅ Working | Gets single template |
| `/api/templates/[id]` | PATCH | ✅ Working | Updates template |
| `/api/templates/[id]` | DELETE | ✅ Working | Deletes template |
| `/api/templates/[id]/duplicate` | POST | ✅ Working | Duplicates template |
| `/api/templates/analyze-samples` | POST | ❌ Missing | Need to create for AI analysis |

---

## 5. PRIORITY FIXES

### 🔴 **CRITICAL (Must Fix)**

1. **Create Edit Template Page** - Users can't edit templates
2. **Implement File Upload in Wizard** - Can't upload samples
3. **Implement AI Analysis** - Core feature of "create from samples"
4. **Implement Save Template** - Wizard doesn't actually create templates

### 🟡 **HIGH (Should Fix)**

5. **Create from Output** - Reverse-engineer templates from existing outputs
6. **Toast Notifications** - Replace alert() with proper toasts

### 🟢 **MEDIUM (Nice to Have)**

7. **Template Preview** - Show sample output before saving
8. **Template Validation** - Ensure required fields are filled
9. **Drag-and-Drop Reordering** - For sections in edit page

---

## 6. IMPLEMENTATION PLAN

### Phase A: Critical Fixes (Edit Page + Wizard Functionality)

**Estimated Changes**: 3 new files, 2 modified files

1. **Create Edit Template Page**
   - NEW FILE: `/app/(app)/templates/[id]/edit/page.tsx`
   - Form with all template fields
   - Load existing data
   - Save via PATCH API

2. **Implement Wizard File Upload**
   - MODIFY: `/app/(app)/templates/new/from-samples/page.tsx`
   - Add file input handler
   - Upload files to temporary storage or process immediately

3. **Implement AI Analysis**
   - NEW FILE: `/app/api/templates/analyze-samples/route.ts`
   - Accept uploaded files (PDF, DOCX, TXT)
   - Extract text content
   - Use Claude AI to analyze structure, tone, style
   - Return sections, style rules, suggestions

4. **Implement Save Template**
   - MODIFY: `/app/(app)/templates/new/from-samples/page.tsx`
   - Collect all wizard data
   - Call `POST /api/templates`
   - Redirect to template list or new template detail

### Phase B: Polish & Enhancement

**Estimated Changes**: 2 modified files

5. **Replace Alerts with Toasts**
   - MODIFY: `/app/(app)/templates/page.tsx`
   - Import and use `toast` from sonner

6. **Create from Output**
   - MODIFY: `/app/(app)/templates/page.tsx`
   - Add modal/page for selecting output
   - Extract template pattern from output
   - Pre-fill wizard with extracted data

---

## 7. NEXT STEPS

1. Start with Phase A (Critical Fixes)
2. Focus on Edit Page first (highest user impact)
3. Then wizard functionality (file upload → AI analysis → save)
4. User testing after Phase A
5. Move to Phase B after Phase A completion

---

**END OF ANALYSIS**
