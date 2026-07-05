# Mobile-First UI Design Prompt for Gesprächsbericht

## 🎯 Project Context

**App Name:** Gesprächsbericht  
**Type:** Mobile-first PWA for audio transcription + AI report generation  
**Primary Use Case:** Social work, healthcare, and professional conversation documentation  
**Target Device:** 70% mobile (recording), 30% desktop (review)  
**Core Philosophy:** AI-first, minimal friction, user-controlled workflow  

---

## 📱 **Critical: Mobile-First Design Requirements**

### **Primary User Journey (Mobile)**
```
User opens PWA on phone
    ↓
Record conversation (hands-free, screen-off support)
    ↓
Save locally (no login required)
    ↓
Later: Login → Upload → Review → Generate Report
```

**Design Imperatives:**
- **Large tap targets** (min 44px height for buttons)
- **Thumb-friendly zones** (actions at bottom or center)
- **Vertical stacking** (no horizontal scrolling)
- **Collapsible sections** (reduce scroll length)
- **Offline-first** (local storage indicators)
- **Screen-off support** (recording continues when phone locked)
- **Single-column layouts** on mobile (responsive multi-column on desktop)

---

## 🛠️ **Tech Stack**

Build using:
- **Framework:** Next.js 13 App Router + React 18 + TypeScript
- **Styling:** Tailwind CSS
- **Components:** shadcn/ui (already installed)
- **Database:** Supabase (Auth, Storage, Postgres)
- **AI:** Anthropic Claude Sonnet 4.6
- **Transcription:** Speechmatics
- **Offline:** IndexedDB for local recordings
- **Language:** German primary (de), English secondary (en)

**No backend implementation needed** - focus on high-fidelity UI mockup with realistic data.

---

## 📂 **Current Route Structure** (Keep This)

```
/login                          - Simple auth (email/password)
/signup                         - Email signup
/record                         - PWA entry point (quick record)
/dashboard                      - Cases + standalone sessions
/cases/[id]                     - Case detail with sessions
/sessions/[id]                  - Session detail (core page)
/sessions/[id]/report           - Generated report view
/profile                        - User settings
```

**Do NOT create:** `/app` shell, `/templates`, `/outputs` - these don't fit our workflow.

---

## 🎨 **Page Designs & Mobile Patterns**

### **1. /record (PWA Quick Record)** ⭐ PRIMARY ENTRY POINT

**Mobile-First Layout:**
```
┌─────────────────────────────────┐
│ ← Anmelden (top left, subtle)  │ 
│                                 │
│ 🎙️ Schnellaufnahme             │
│ Aufnehmen ohne Anmeldung        │
│                                 │
│ ┌─────────────────────────────┐ │
│ │ 💾 3 Aufnahmen • 12.5 MB    │ │
│ │              [Alle hochladen]│ │
│ └─────────────────────────────┘ │
│                                 │
│ ┌─────────────────────────────┐ │
│ │       RECORDER CARD         │ │
│ │   (when active: full screen)│ │
│ │                             │ │
│ │      [◉ 12:34 recording]    │ │
│ │                             │ │
│ │   [Pause]  [Stop & Save]    │ │
│ └─────────────────────────────┘ │
│                                 │
│ [🎙️ Neue Aufnahme starten]    │ ← Large, 60px height
│    (full width button)          │
│                                 │
│ ── Gespeicherte Aufnahmen ──   │
│                                 │
│ ┌─────────────────────────────┐ │
│ │ 🕐 15:23  •  12.3 MB        │ │
│ │ Heute 09:34                 │ │
│ │              [▶] [🗑️]      │ │
│ └─────────────────────────────┘ │
│                                 │
│ (list continues...)             │
│                                 │
│ ┌─────────────────────────────┐ │
│ │ ℹ️ Wie funktioniert's?      │ │
│ │ ✅ Aufnehmen ohne Anmeldung │ │
│ │ ✅ Lokal auf deinem Gerät   │ │
│ │ ✅ Später hochladen         │ │
│ └─────────────────────────────┘ │
│                                 │
└─────────────────────────────────┘
```

**Key Features:**
- **Immediate action:** Record button dominates (60px height, bold)
- **Local storage indicator:** Shows count + size, updates live
- **Offline-first:** No login required, clear messaging
- **PWA install prompt:** Subtle banner at top (dismissible)
- **Audio playback:** Quick preview with minimal controls

**Desktop Adaptation:**
- Center content (max-width: 600px)
- Add sidebar with quick tips
- Larger recorder visualization

---

### **2. /dashboard (Cases + Sessions Hub)**

**Mobile Layout:**
```
┌─────────────────────────────────┐
│ 📄 Gesprächsbericht    [Profile]│ ← Sticky header
│ [✨ What's New]                 │
│─────────────────────────────────│
│ Dashboard                       │
│ Verwalten Sie Ihre Aufnahmen    │
│                                 │
│ [Projekte] [Einzelne Gespräche]│ ← Tabs
│─────────────────────────────────│
│                                 │
│        [+ Neues Projekt]        │ ← 48px height
│                                 │
│ ┌─────────────────────────────┐ │
│ │ 📁 Familie Müller           │ │
│ │ 5 Gespräche      [Aktiv]    │ │
│ │                             │ │
│ │ Letzte Aktualisierung:      │ │
│ │ vor 2 Stunden               │ │
│ └─────────────────────────────┘ │
│                                 │
│ ┌─────────────────────────────┐ │
│ │ 📁 HELOC-Beratung           │ │
│ │ 3 Gespräche      [Aktiv]    │ │
│ │                             │ │
│ │ Letzte Aktualisierung:      │ │
│ │ gestern                     │ │
│ └─────────────────────────────┘ │
│                                 │
│ (more cards...)                 │
│                                 │
└─────────────────────────────────┘
```

**Mobile Bottom Nav (Optional Enhancement):**
```
┌─────────────────────────────────┐
│ [📊 Dashboard] [🎙️ Record] [👤]│ ← Sticky bottom
└─────────────────────────────────┘
```

**Key Features:**
- **Tabs for organization:** Projects vs. standalone sessions
- **Card-based layout:** Easy tap targets, scannable
- **Status badges:** Color-coded (green=active, grey=closed)
- **Empty states:** Helpful prompts when no data
- **Pull-to-refresh:** Native mobile pattern

**Desktop Adaptation:**
- Grid layout (2-3 columns)
- Sidebar navigation (optional)
- Search bar in header

---

### **3. /sessions/[id] (Session Detail)** ⭐ CORE WORKFLOW PAGE

**Mobile Layout (Vertical Stack):**
```
┌─────────────────────────────────┐
│ ← Zurück    Gespräch #4829      │ ← Editable title
│ [Fertig ✓]        [🐛 Bug]      │
│─────────────────────────────────│
│                                 │
│ ✅ Transkription abgeschlossen! │ ← Success banner
│ Jetzt Report erstellen          │
│─────────────────────────────────│
│                                 │
│ 🌐 Report-Sprache [▼]          │ ← Collapsible
│ 🤖 Automatisch (empfohlen)      │
│─────────────────────────────────│
│                                 │
│ 💬 Kontext [▼]                  │ ← Collapsible
│ Teilnehmer, Agenda, Hintergründe│
│                                 │
│ [Shows when expanded:]          │
│ ┌─────────────────────────────┐ │
│ │ Teilnehmer:                 │ │
│ │ - Max Mustermann (CEO)      │ │
│ │ - Anna Schmidt (CFO)        │ │
│ │                             │ │
│ │ Agenda:                     │ │
│ │ 1. Q4 Review                │ │
│ │ 2. Budget Planning          │ │
│ └─────────────────────────────┘ │
│ [🎤 Live-Diktat] [✨ Verbessern]│
│ [🔒 Lock]                       │
│─────────────────────────────────│
│                                 │
│ 🎙️ Aufnahmen (2 Dateien) [▼]  │ ← Collapsible
│                                 │
│ [Shows when expanded:]          │
│ ┌─────────────────────────────┐ │
│ │ 💬 Besprechung #1           │ │
│ │ 12.3 MB • 31.01.2026 14:23  │ │
│ │ [👁️ Transkript] [📄 Bericht]│ │
│ └─────────────────────────────┘ │
│                                 │
│ ┌─────────────────────────────┐ │
│ │ 📝 Diktat #2                │ │
│ │ 2.1 MB • 31.01.2026 14:45   │ │
│ │ [👁️ Transkript] [🗑️]       │ │
│ └─────────────────────────────┘ │
│─────────────────────────────────│
│                                 │
│ 🎙️ Audio hinzufügen [▼]       │ ← Only if status=created
│                                 │
│ [Shows when expanded:]          │
│ Tabs: [Aufnehmen] [Hochladen]  │
│                                 │
│ (Recorder or uploader UI)       │
│─────────────────────────────────│
│                                 │
│ 🔒 Private Notizen [▼]         │ ← Collapsible
│ Persönliche Beobachtungen       │
│ (NICHT im Report)               │
│─────────────────────────────────│
│                                 │
│ 📋 Anweisungen [▼]             │ ← Collapsible
│ Wie soll der Report             │
│ strukturiert werden?            │
│─────────────────────────────────│
│                                 │
│ ┌─────────────────────────────┐ │
│ │ ✨ Bericht neu generieren   │ │
│ │ Erstelle einen neuen Bericht│ │
│ │ mit aktuellen Einstellungen │ │
│ │                             │ │
│ │        [✨ Neu generieren]   │ │ ← 48px height
│ └─────────────────────────────┘ │
│                                 │
└─────────────────────────────────┘
```

**Key Mobile Patterns:**
- **Collapsible sections:** Reduce scroll, focus on active task
- **Large action buttons:** Generate report is prominent (48px+)
- **Status banners:** Color-coded, dismissible
- **Transcribable fields:** 
  - Text input with voice dictation support
  - AI improve button (✨)
  - Lock toggle (prevents AI changes)
- **Inline editing:** Tap title to edit, no modal
- **Progress indicators:** Show status during transcription/summarization

**Desktop Adaptation:**
- 3-column layout option:
  - Left: Collapsible sections list
  - Center: Active section content
  - Right: AI suggestions (optional)
- Keep mobile version as default, desktop as enhancement

---

### **4. Transcript Viewer (Dialog/Modal)**

**Mobile-Optimized Dialog:**
```
┌─────────────────────────────────┐
│ 💬 Besprechung              [✕] │
│ 31.01.2026 14:23                │
│─────────────────────────────────│
│                                 │
│ [Search transcript...]          │
│ [PII: Redacted ✓] [Download]   │
│                                 │
│ ─────────────────────────────── │
│                                 │
│ 0:00  Speaker 1:                │
│       Guten Tag, ich bin...     │
│                                 │
│ 0:12  Speaker 2:                │
│       Danke für Ihre Zeit...    │
│                                 │
│ 0:34  Speaker 1:                │
│       Können wir über den...    │
│                                 │
│ (scrollable content)            │
│                                 │
│ [Show Unredacted] (if allowed)  │
│                                 │
└─────────────────────────────────┘
```

**Key Features:**
- **Readable text size:** 16px minimum
- **Speaker differentiation:** Color-coded or indented
- **Timestamp links:** Tap to jump in audio playback (future)
- **Search:** Highlight matching text
- **PII toggle:** Show/hide redacted content
- **Export options:** Copy, download, share

---

### **5. Report View (/sessions/[id]/report)**

**Mobile Layout:**
```
┌─────────────────────────────────┐
│ ← Zurück           [⋮ Actions]  │
│ Gesprächsbericht                │
│─────────────────────────────────│
│                                 │
│ Familie Müller - Gespräch #3    │
│ 31. Januar 2026 • 15 Minuten    │
│                                 │
│ [Detected: 🏥 Social Work]      │
│ [Language: 🇩🇪 Deutsch]         │
│                                 │
│ ─────────────────────────────── │
│                                 │
│ ## Zusammenfassung              │
│ (rendered markdown content)     │
│                                 │
│ ## Gesprächsverlauf             │
│ • Point 1...                    │
│ • Point 2...                    │
│                                 │
│ ## Kernaussagen & Zitate        │
│ > "Quote here..." (0:12)        │
│                                 │
│ (more sections...)              │
│                                 │
│ ─────────────────────────────── │
│                                 │
│ ⚠️ Hinweis: PII wurden reduziert│
│ Audio-Qualität: Gut             │
│ Transkript-Konfidenz: 95%       │
│                                 │
│ [📥 Download PDF]               │
│ [📤 Share]                      │
│ [✨ Neu generieren]             │
│                                 │
└─────────────────────────────────┘
```

**Key Features:**
- **Clean typography:** Readable body text (18px)
- **Metadata badges:** Domain, language, confidence
- **Structured sections:** Collapsible on mobile
- **Quality notes:** Transparency about AI confidence
- **Export options:** PDF, Word, copy markdown
- **Regenerate option:** Edit settings and recreate

---

### **6. /profile (User Settings)**

**Mobile Layout:**
```
┌─────────────────────────────────┐
│ ← Dashboard                     │
│ Profile                         │
│─────────────────────────────────│
│                                 │
│ 👤 max@example.com              │
│ Mitglied seit 25. Jan 2026      │
│                                 │
│ ─────────────────────────────── │
│                                 │
│ ⚙️ Workflow-Einstellungen       │
│                                 │
│ ┌─────────────────────────────┐ │
│ │ ⚡ Auto-Reports      [OFF]  │ │ ← Switch
│ │                             │ │
│ │ Automatisch Reports nach    │ │
│ │ Transkription erstellen     │ │
│ │                             │ │
│ │ 💡 Empfohlen: OFF           │ │
│ │ (Transkript erst prüfen)    │ │
│ └─────────────────────────────┘ │
│                                 │
│ ┌─────────────────────────────┐ │
│ │ 🌐 Report-Sprache           │ │
│ │ [🤖 Automatisch ▼]          │ │ ← Dropdown
│ │                             │ │
│ │ Standard-Sprache für neue   │ │
│ │ Reports (kann pro Session   │ │
│ │ überschrieben werden)       │ │
│ └─────────────────────────────┘ │
│                                 │
│ ─────────────────────────────── │
│                                 │
│ 🔒 Datenschutz                  │
│                                 │
│ ┌─────────────────────────────┐ │
│ │ 🛡️ PII-Redaktion     [ON]  │ │ ← Switch
│ │                             │ │
│ │ Automatisch persönliche     │ │
│ │ Daten in Transkripten       │ │
│ │ anonymisieren               │ │
│ │                             │ │
│ │ (Email, Telefon, Adressen)  │ │
│ └─────────────────────────────┘ │
│                                 │
│ ─────────────────────────────── │
│                                 │
│ 💾 Speicher & Cache             │
│                                 │
│ ┌─────────────────────────────┐ │
│ │ Lokale Aufnahmen: 24.5 MB   │ │
│ │                             │ │
│ │ [Cache leeren]              │ │
│ └─────────────────────────────┘ │
│                                 │
│ ─────────────────────────────── │
│                                 │
│ 🆘 Support                      │
│                                 │
│ [🐛 Fehler melden]              │
│ [📧 Kontakt aufnehmen]          │
│ [📚 Dokumentation]              │
│                                 │
│ ─────────────────────────────── │
│                                 │
│            [Logout]             │
│                                 │
└─────────────────────────────────┘
```

**Key Features:**
- **Grouped settings:** Logical sections with icons
- **Toggle switches:** Easy on/off for boolean settings
- **Explanatory text:** Help users understand each setting
- **Storage info:** Show local cache size
- **Quick actions:** Bug report, contact support

---

## 🎯 **AI-First UX Patterns** (Critical)

### **1. Defer Decisions, Suggest Later**
```
❌ BAD (v0 prompt approach):
User uploads → [Modal: Select role & audience] → Upload

✅ GOOD (Your approach):
User uploads → Transcribe → AI suggests: "Detected: Social worker ↔ Client" → User confirms/edits
```

**Implementation:**
- NO required dropdowns before upload
- NO blocking modals before generation
- YES AI suggestions after transcription
- YES easy override with one tap

### **2. Intelligent Defaults**
```typescript
// Example: File type classification
Upload audio → Default: "meeting"
After transcription → AI analyzes → Suggests: "Dictation (85% confidence)"
User can change if wrong (one tap)
```

### **3. Transparent AI Confidence**
Show AI reasoning:
```
🤖 AI-Vorschlag: Diktat (85%)
Grund: 1 Sprecher, 3 Minuten, persönliche Notizen
[✓ Correct] [Change ▼]
```

### **4. Progressive Disclosure**
Use collapsible sections:
- Start collapsed (minimal)
- Expand on demand (details)
- Remember user preference

### **5. One-Click Actions**
Prefer:
- Toggle switches over forms
- Inline editing over modals
- Badge chips over dropdowns

---

## 🎨 **Component Patterns (shadcn/ui)**

### **Required Components (Already Installed):**
- `Button` - Use size="lg" for primary actions on mobile
- `Card` - Main content container
- `Badge` - Status indicators (color-coded)
- `Tabs` - Navigation between views
- `Dialog` - Modals (transcript viewer, confirmations)
- `Sheet` - Bottom/side panels on mobile
- `Collapsible` - Expandable sections (CRITICAL for mobile)
- `Switch` - Boolean settings
- `Select` - Dropdowns (minimal use)
- `Input` / `Textarea` - Forms
- `Alert` - Success/error banners

### **Mobile-Specific Patterns:**

**1. Collapsible Sections:**
```tsx
<Collapsible defaultOpen={false}>
  <CollapsibleTrigger className="w-full p-4">
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-3">
        <Icon className="h-5 w-5" />
        <span className="font-semibold text-sm">Section Title</span>
        <Badge>Status</Badge>
      </div>
      <ChevronDown className="h-4 w-4" />
    </div>
  </CollapsibleTrigger>
  <CollapsibleContent>
    {/* Content here */}
  </CollapsibleContent>
</Collapsible>
```

**2. Bottom Sheet (Mobile Actions):**
```tsx
<Sheet>
  <SheetTrigger asChild>
    <Button>Actions</Button>
  </SheetTrigger>
  <SheetContent side="bottom">
    {/* Action menu */}
  </SheetContent>
</Sheet>
```

**3. Status Banners:**
```tsx
<Alert variant="success" className="border-green-200 bg-green-50">
  <AlertDescription>
    ✅ Transkription abgeschlossen!
  </AlertDescription>
</Alert>
```

---

## 📊 **Status & Progress Indicators**

### **Session Status Flow:**
```
created → uploading → transcribing → done
                                    ↓
                          (optional) summarizing → done
```

### **Status Badges:**
```typescript
const statusConfig = {
  created: { color: 'slate', text: 'Bereit', icon: '📝' },
  uploading: { color: 'blue', text: 'Hochladen...', icon: '⬆️', animated: true },
  transcribing: { color: 'blue', text: 'Transkribieren...', icon: '🎙️', animated: true },
  summarizing: { color: 'purple', text: 'Report erstellen...', icon: '✨', animated: true },
  done: { color: 'green', text: 'Fertig', icon: '✅' },
  error: { color: 'red', text: 'Fehler', icon: '⚠️' }
}
```

### **Progress Indicators:**
- Use `Loader2` icon with `animate-spin` for loading states
- Show progress banners for long operations
- Auto-refresh status every 3 seconds during processing
- Show estimated time remaining (if possible)

---

## 🔒 **Privacy & Security UI Elements**

### **PII Redaction Indicators:**
```
┌─────────────────────────────────┐
│ Transkript                      │
│ [PII: Redacted ✓]  [Show unredacted]│
│                                 │
│ "Ich wohne in [ADRESSE]..."     │
│ "Meine Email ist [EMAIL]..."    │
└─────────────────────────────────┘
```

**Show/Hide Toggle:**
- Only visible to owner
- Requires confirmation before showing unredacted
- Visual warning when unredacted data visible

### **Offline Indicators:**
```
┌─────────────────────────────────┐
│ 📶 Offline • Änderungen werden  │
│ synchronisiert, wenn online     │
└─────────────────────────────────┘
```

### **Sync Status:**
```
┌─────────────────────────────────┐
│ ☁️ Synchronisiert • 3 lokale    │
│ Aufnahmen warten auf Upload     │
└─────────────────────────────────┘
```

---

## 🚀 **Performance & UX Details**

### **1. Optimistic UI Updates**
- Update UI immediately, sync in background
- Show loading states for <300ms operations
- Rollback on error with clear message

### **2. Error Handling**
- Friendly error messages in German
- Actionable next steps ("Try again" button)
- Bug reporter for persistent issues

### **3. Empty States**
- Helpful illustrations or icons
- Clear call-to-action
- Explain what the section is for

### **4. Loading States**
```tsx
{loading ? (
  <div className="flex justify-center py-12">
    <Loader2 className="h-8 w-8 animate-spin" />
  </div>
) : (
  <Content />
)}
```

### **5. Touch Feedback**
- Use `active:scale-95` for buttons
- `hover:bg-slate-100` for tap targets
- Ripple effects on important actions

---

## 📐 **Responsive Breakpoints**

```css
/* Mobile-first approach */
.element {
  /* Mobile: default styles */
  padding: 1rem;
}

@media (min-width: 640px) {
  /* sm: tablets portrait */
  .element { padding: 1.5rem; }
}

@media (min-width: 1024px) {
  /* lg: desktop */
  .element { 
    padding: 2rem;
    /* Enable multi-column layouts here */
  }
}
```

**Layout Adaptations:**
- **Mobile (<640px):** Single column, collapsible sections
- **Tablet (640-1024px):** Two columns where appropriate
- **Desktop (>1024px):** Three columns, sidebar navigation

---

## 🎭 **Mock Data Examples**

### **Session Status Examples:**
```typescript
// Uploading
{ status: 'uploading', progress: 45 }

// Transcribing
{ status: 'transcribing', duration_sec: 0 }

// Done with report
{ status: 'done', duration_sec: 900, has_report: true }

// Error
{ status: 'error', last_error: 'Transcription failed: unsupported format' }
```

### **AI Suggestions:**
```typescript
{
  suggestedType: 'dictation',
  confidence: 0.85,
  reason: '1 Sprecher, 3 Minuten, persönliche Notizen',
  metadata: {
    speakerCount: 1,
    duration: 180,
    keywords: ['Notiz', 'erinnern', 'wichtig']
  }
}
```

---

## ✅ **Must-Have Features Checklist**

### **Core Functionality:**
- [ ] PWA installable (manifest.json configured)
- [ ] Quick record without login
- [ ] Local storage with size tracking
- [ ] Upload queue management
- [ ] Real-time status updates
- [ ] Collapsible session sections
- [ ] Transcribable text fields (context, notes, instructions)
- [ ] AI improve button for text fields
- [ ] Report generation (manual trigger)
- [ ] Transcript viewer with PII redaction
- [ ] Export options (PDF, copy)

### **Mobile-Specific:**
- [ ] Large tap targets (44px+ height)
- [ ] Bottom-aligned actions
- [ ] Pull-to-refresh (dashboard)
- [ ] Screen-off recording support
- [ ] Offline indicators
- [ ] Touch feedback animations
- [ ] Single-column layouts
- [ ] Collapsible everything

### **AI-First UX:**
- [ ] No required dropdowns before actions
- [ ] AI suggestions with confidence
- [ ] One-click overrides
- [ ] Transparent reasoning
- [ ] Defer non-critical decisions

---

## 🚫 **Don't Implement (Anti-Patterns)**

### **From v0 Prompt - DO NOT ADD:**
- ❌ Role + Audience gating modal (blocks workflow)
- ❌ Templates system (/app/templates)
- ❌ Multi-output reporting (/app/outputs)
- ❌ Template creation from samples wizard
- ❌ Required metadata before upload
- ❌ Desktop-first 3-column layouts
- ❌ Complex navigation (keep it simple)
- ❌ RLS/JWT info banners (backend concerns)

### **General Anti-Patterns:**
- ❌ Horizontal scrolling
- ❌ Small tap targets (<44px)
- ❌ Modal forms (prefer inline/sheet)
- ❌ Hidden navigation
- ❌ Unclear status indicators
- ❌ Desktop-first responsive design

---

## 📚 **Design References**

### **Color Scheme (Tailwind):**
```typescript
const colors = {
  primary: 'blue-600',      // Primary actions
  success: 'green-600',     // Success states
  warning: 'amber-600',     // Warnings
  error: 'red-600',         // Errors
  muted: 'slate-500',       // Secondary text
  background: 'slate-50',   // Page background
  card: 'white',            // Card backgrounds
}
```

### **Status Colors:**
```typescript
const statusColors = {
  created: 'slate-500',
  uploading: 'blue-500',
  transcribing: 'blue-600',
  summarizing: 'purple-600',
  done: 'green-600',
  error: 'red-600'
}
```

### **Typography:**
```css
/* Headings */
h1: text-2xl md:text-3xl font-bold
h2: text-xl md:text-2xl font-semibold
h3: text-lg font-semibold

/* Body */
body: text-base (16px)
small: text-sm (14px)
tiny: text-xs (12px)

/* Minimum readable size on mobile: 14px */
```

---

## 🎯 **Success Criteria**

This design succeeds when:

1. ✅ **User can record in <10 seconds from app open**
2. ✅ **Session detail page fits on one mobile screen (with scrolling)**
3. ✅ **All primary actions have 44px+ tap targets**
4. ✅ **No modals block critical workflows**
5. ✅ **AI suggestions are transparent and overrideable**
6. ✅ **Works offline (with clear indicators)**
7. ✅ **Responsive from 320px (iPhone SE) to 2560px (desktop)**
8. ✅ **Status is always visible and updates automatically**
9. ✅ **Error states are helpful, not scary**
10. ✅ **Zero horizontal scrolling on any screen size**

---

## 🚢 **Deliverables**

When implementing this design, provide:

1. **Full Next.js 13 project structure**
   - `app/` routes with page.tsx files
   - `components/` reusable UI components
   - `lib/mock/` realistic mock data
   - TypeScript types for all data structures

2. **Mobile-first responsive components**
   - Single-column mobile layouts
   - Collapsible sections
   - Touch-optimized interactions
   - Proper breakpoint handling

3. **shadcn/ui integration**
   - Properly styled components
   - Consistent color scheme
   - Accessible interactions

4. **No backend implementation**
   - Mock API calls
   - Simulated delays for realism
   - Client-side state management

5. **Production-ready patterns**
   - Loading states
   - Error handling
   - Empty states
   - Success/failure feedback

---

## 💡 **Final Notes**

**Remember:**
- This is a **mobile-first PWA** - prioritize mobile UX
- **AI-first philosophy** - suggest, don't require
- **User control** - never block workflows
- **Simple over complex** - one feature well beats ten features poorly
- **Responsive enhancement** - mobile works great, desktop adds polish

**Test on:**
- iPhone SE (320px width)
- iPhone 12/13/14 (390px width)
- Android mid-range (360px-400px width)
- iPad (768px width)
- Desktop (1280px+ width)

---

**Created:** February 2, 2026  
**Philosophy:** Mobile-First + AI-First  
**Stack:** Next.js 13 + shadcn/ui + Supabase  
**Purpose:** High-fidelity UI mockup for Gesprächsbericht PWA
