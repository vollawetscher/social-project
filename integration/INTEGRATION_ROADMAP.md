# v0 UI Integration Roadmap

**Goal:** Integrate v0's polished UI with your existing backend (Supabase, Claude, Speechmatics)

**Status:** 🟡 In Progress

---

## 📋 Integration Phases

### ✅ Phase 0: Preparation (Complete)
- [x] Analyze both codebases
- [x] Identify what to keep/integrate
- [x] Create migration plan

---

### 🔄 Phase 1: Copy v0 UI Components (In Progress)

**Goal:** Copy all v0 UI components into your app

#### 1.1 Base UI Components
- [ ] Copy new UI components from v0
  - [ ] `empty.tsx` - Empty states
  - [ ] `spinner.tsx` - Loading spinner
  - [ ] `kbd.tsx` - Keyboard shortcuts
  - [ ] `button-group.tsx` - Button groups
  - [ ] `field.tsx` - Form fields
  - [ ] `input-group.tsx` - Input with addons
  - [ ] `item.tsx` - List items
  - [ ] `use-mobile.tsx` - Mobile detection hook
  - [ ] `sidebar.tsx` - Sidebar component

#### 1.2 App Components
- [ ] Copy app-specific components
  - [ ] `app-sidebar.tsx` - Main sidebar navigation
  - [ ] `app-topbar.tsx` - Top navigation bar
  - [ ] `app-layout-client.tsx` - App shell layout
  - [ ] `mobile-nav.tsx` - Mobile bottom navigation
  - [ ] `transcript-viewer.tsx` - Compare with existing, merge best
  - [ ] `generate-output-modal.tsx` - Output generation dialog
  - [ ] `session-setup-panel.tsx` - Template/output setup

#### 1.3 Update Existing Components
- [ ] Compare `transcript-viewer.tsx` (yours vs v0's)
- [ ] Merge best features from both

**Time Estimate:** 2-3 hours

---

### 🔄 Phase 2: Integrate App Structure

**Goal:** Add v0's page structure alongside your current app

#### 2.1 Create New Routes (Keep Old Ones)
- [ ] `/app-v0/` - New v0 UI (parallel to existing)
  - [ ] `/app-v0/sessions/` - Sessions list
  - [ ] `/app-v0/sessions/[id]/` - Session detail
  - [ ] `/app-v0/outputs/` - Outputs list (NEW)
  - [ ] `/app-v0/templates/` - Templates management (NEW)
  - [ ] `/app-v0/settings/` - Settings page

#### 2.2 Keep Your Current Routes
- [x] `/dashboard/` - Your current dashboard (keep as-is)
- [x] `/record/` - Your recording page (keep as-is)
- [x] `/sessions/[id]/` - Your session page (keep as-is)

**Strategy:** Run both UIs in parallel, migrate gradually

**Time Estimate:** 3-4 hours

---

### 🔄 Phase 3: Connect to Existing Backend

**Goal:** Replace v0's mock data with your real backend

#### 3.1 Sessions Integration
- [ ] Update v0's sessions list to use your Supabase `sessions` table
- [ ] Replace mock data with real API calls
- [ ] Connect to your existing session API routes
- [ ] Test with real data

#### 3.2 Auth Integration
- [ ] Update v0's layout to use your email/password auth
- [ ] Remove phone OTP references from v0 code
- [ ] Use your existing AuthProvider
- [ ] Ensure protected routes work

#### 3.3 Recording Integration
- [ ] Connect v0's recording UI to your AudioRecorder
- [ ] Use your existing Speechmatics integration
- [ ] Keep your real-time transcription

#### 3.4 Transcript Integration
- [ ] Use v0's TranscriptViewer UI
- [ ] Connected to your real transcript data
- [ ] Merge with your PII redaction features

**Time Estimate:** 4-6 hours

---

### 🔄 Phase 4: Build New Backend Features

**Goal:** Add templates and multiple outputs to your database

#### 4.1 Database Schema (Supabase)
- [ ] Create `templates` table
  ```sql
  - id, name, description
  - sections (jsonb)
  - domain_tags (text[])
  - intended_perspectives (text[])
  - style_rules (jsonb)
  - created_at, updated_at
  ```
- [ ] Create `outputs` table
  ```sql
  - id, session_id, template_id
  - perspective, audience, tone
  - content (text)
  - created_at
  ```
- [ ] Add foreign keys and indexes

#### 4.2 API Endpoints
- [ ] `GET /api/templates` - List templates
- [ ] `POST /api/templates` - Create template
- [ ] `GET /api/sessions/[id]/outputs` - List session outputs
- [ ] `POST /api/sessions/[id]/outputs` - Generate output
- [ ] `DELETE /api/outputs/[id]` - Delete output

#### 4.3 Services
- [ ] Extend Claude service to support templates
- [ ] Create template suggestion logic (AI-driven)
- [ ] Create output generation service
- [ ] Handle multiple output types

#### 4.4 Connect v0 UI to New Features
- [ ] Wire outputs page to real API
- [ ] Wire templates page to real API
- [ ] Wire generate output modal to real API
- [ ] Test end-to-end flow

**Time Estimate:** 8-12 hours

---

### 🔄 Phase 5: Polish & Testing

**Goal:** Ensure everything works smoothly

#### 5.1 Feature Testing
- [ ] Test full recording → transcript → multiple outputs flow
- [ ] Test template management
- [ ] Test AI suggestions
- [ ] Test on mobile and desktop

#### 5.2 Cleanup
- [ ] Remove phone OTP code (unused)
- [ ] Remove v0 mock data
- [ ] Clean up unused components
- [ ] Update documentation

#### 5.3 Migration Decision
- [ ] Decide: Keep both UIs or switch to v0 fully?
- [ ] If switching: redirect old routes to new
- [ ] Update all links and navigation

**Time Estimate:** 4-6 hours

---

### 🔄 Phase 6: Advanced Features (Optional)

**Goal:** Add desktop enhancements and polish

- [ ] Implement sidebar for desktop
- [ ] Add keyboard shortcuts
- [ ] Improve table layouts
- [ ] Add advanced search/filters
- [ ] Performance optimization

**Time Estimate:** 8-12 hours

---

## 📊 Total Time Estimate

| Phase | Time | Status |
|-------|------|--------|
| Phase 0: Preparation | 4 hours | ✅ Complete |
| Phase 1: Copy Components | 2-3 hours | 🔄 Next |
| Phase 2: App Structure | 3-4 hours | ⏳ Pending |
| Phase 3: Backend Connection | 4-6 hours | ⏳ Pending |
| Phase 4: New Features | 8-12 hours | ⏳ Pending |
| Phase 5: Polish & Testing | 4-6 hours | ⏳ Pending |
| Phase 6: Advanced (Optional) | 8-12 hours | ⏳ Optional |
| **Total** | **25-43 hours** | |
| **Essential (1-5)** | **17-31 hours** | |

---

## 🚀 Current Status

**Now starting:** Phase 1 - Copy v0 UI Components

**Ready to begin!** Should I start copying the UI components now?
