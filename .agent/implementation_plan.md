# SastraNet Workspace — Full-Stack Build Implementation Plan

## Context & Current State

The workspace currently contains a **Vite + React + shadcn/ui** prototype scaffold. It has:
- A working design system (CSS tokens, Tailwind 4, shadcn/ui components)
- SastraNet color palette (bone/sand canvas, International Orange brand, dark typography)
- Type definitions in `supabase.ts` (currently wired to Supabase — will be replaced)
- Domain logic stubs in `domain.ts`
- `App.tsx` routing skeleton referencing pages that don't exist yet
- No actual page implementations

The build spec requires a **complete migration from Vite+Supabase → Next.js 15 App Router + MongoDB Atlas + Better Auth**.

---

## User Review Required

> [!IMPORTANT]
> **This build requires initializing a new Next.js project in the current workspace directory.** The current Vite scaffold will be replaced. The design system CSS tokens, shadcn/ui components, and TypeScript domain types from the existing prototype will be preserved and migrated into the Next.js project.

> [!WARNING]
> **Existing files will be replaced.** The following files from the prototype will be superseded:
> - `package.json` → replaced by Next.js equivalent
> - `vite.config.ts` → removed (Vite no longer needed)
> - `index.html` → moved inside `public/` or replaced by Next.js layout
> - `src/` → renamed/moved to `src/` under Next.js App Router conventions
> - `.env` → SUPABASE keys removed; MongoDB + Better Auth keys added
> The prototype's **design tokens, component library, and domain types** will be preserved.

> [!IMPORTANT]
> **MongoDB credential**: You must privately supply `MONGODB_URI` in your local `.env.local` and in Vercel environment settings. It will never appear in source code.

> [!CAUTION]
> **Implementation scope is very large.** This plan covers ~92 specification requirements. The implementation will proceed in ordered vertical slices (scaffold → auth → data → UI → features → testing → deployment), with typecheck/lint verification after each major slice. Estimate: this is a multi-session build.

---

## Open Questions

> [!IMPORTANT]
> **1. Build Strategy: Full Next.js migration vs. Vite frontend + Next.js API Routes**
> The spec requires Next.js App Router with RSC, Server Actions, and route handlers. This means the Vite scaffold must be replaced. My recommendation: **scaffold a fresh Next.js 15 project and migrate the design system assets** (CSS, shadcn config, component code) into it.
> 
> Do you confirm this approach?

> [!IMPORTANT]
> **2. Team member list for seed data**
> The spec references specific team member names (Abhinav, Daya, Punith, Akash, Siddharth, Anoohya, Vinay, Gautam). Please confirm the full, accurate team list including: name, email, role (ADMIN/LEAD/POD_LEAD/MEMBER), and pod assignment — so seed data matches reality.

> [!IMPORTANT]
> **3. Email allowlist**
> Which emails should be allowed at launch? The seed script will pre-populate these. Should all team member emails be allowlisted, or should a subset be specified?

> [!IMPORTANT]
> **4. AI summary provider**
> The spec mentions an optional AI summary for feedback finalization (spec §30). Which provider should be used: OpenAI, Anthropic, Google Gemini? Or should AI summary be scaffolded as a stub (disabled) for now?
> Recommendation: **scaffold it as a stub with a provider-agnostic interface**, enabled when `AI_API_KEY` is present.

> [!IMPORTANT]
> **5. Current sprint dates**
> What are the exact start and end dates for the current active sprint? Today is Sep 13, 2026 (IST). The sprint should be approximately Sep 14–20, 2026. Should this be seeded as Sprint 1 or is there a specific sprint number convention?

---

## Proposed Changes

### Architecture Overview

```
Next.js 15 App Router
  ├── React Server Components (data reads)
  ├── Server Actions (mutations)
  └── Route Handlers (webhooks, cron, n8n)

MongoDB Atlas (via official driver)
  └── Single reusable MongoClient singleton

Better Auth (email+password, allowlist hook)
  └── MongoDB adapter

n8n (async workflows via signed webhooks)
  └── Outbox pattern — fire-and-forget, non-blocking
```

---

### Phase 1 — Project Scaffold

#### [NEW] `package.json` (Next.js 15)
Replace Vite package.json. Dependencies:
- `next@^15`, `react@^19.2`, `react-dom@^19.2`
- `typescript`, `@types/node`, `@types/react`
- `tailwindcss@^4`, `@tailwindcss/postcss`
- `better-auth` (with MongoDB adapter)
- `mongodb` (official driver)
- `zod@^3`
- `@dnd-kit/core`, `@dnd-kit/sortable`, `@dnd-kit/utilities`
- `lucide-react`
- `date-fns`
- `sonner`
- All existing shadcn/ui radix dependencies
- `playwright` (devDependency, E2E)
- `vitest` (unit/integration tests)

#### [NEW] `next.config.ts`
- App Router enabled
- Turbopack for dev
- Font optimization
- Security headers

#### [NEW] `src/app/layout.tsx`
Root layout with font loading (Outfit, Plus Jakarta Sans, JetBrains Mono from Google Fonts), metadata, ThemeProvider.

#### [MODIFY] `src/index.css` → `src/app/globals.css`
Migrate existing design tokens exactly. Add severity token variables:
```
--severity-red, --severity-orange, --severity-yellow, --severity-green, --severity-random
--status-todo, --status-progress, --status-done
```

---

### Phase 2 — Database Layer

#### [NEW] `src/lib/db/client.ts`
Singleton MongoClient. Reuses connection across serverless invocations.

#### [NEW] `src/lib/db/indexes.ts`
All index definitions. Run-once setup script.

#### [NEW] `src/types/index.ts`
Complete TypeScript domain types for all collections:
- `User`, `Session`, `AllowedUser`
- `Sprint`, `Task`, `ChecklistItem`
- `Idea`, `Pod`, `AuditEvent`
- `FeedbackCycle`, `FeedbackResponse`
- `Culture`, `Settings`

#### [NEW] `src/server/repositories/`
- `tasks.repository.ts`
- `sprints.repository.ts`
- `ideas.repository.ts`
- `pods.repository.ts`
- `audit.repository.ts`
- `feedback.repository.ts`
- `users.repository.ts`

#### [NEW] `src/server/services/`
- `sprint.service.ts` — carry-over logic, sprint transitions
- `task.service.ts` — CRUD, status changes, deadline management
- `idea.service.ts` — promotion workflow
- `feedback.service.ts` — cycle lifecycle, completion checking, finalization
- `audit.service.ts` — event creation
- `n8n.service.ts` — typed event dispatch
- `permissions.service.ts` — role enforcement

---

### Phase 3 — Authentication

#### [NEW] `src/lib/auth/auth.ts`
Better Auth configuration with:
- MongoDB adapter
- Email+password strategy
- Allowlist hook (rejects non-allowlisted emails server-side)
- Role assignment from allowedUsers collection

#### [NEW] `src/app/api/auth/[...all]/route.ts`
Better Auth route handler.

#### [NEW] `src/app/(auth)/login/page.tsx`
Login page matching SastraNet design system:
- Email + password fields
- SastraNet logo/wordmark
- Error: "This account isn't part of the SastraNet workspace."
- No registration link

#### [NEW] `src/middleware.ts`
Auth middleware protecting all workspace routes.

---

### Phase 4 — App Shell & Navigation

#### [NEW] `src/app/(workspace)/layout.tsx`
Workspace layout with floating pill navigation.

#### [NEW] `src/components/app-shell/navigation.tsx`
Floating pill nav: SastraNet | Board | Pods | Ideas | Feedback
Mobile: bottom bar or hamburger.

#### [NEW] `src/components/app-shell/workspace-header.tsx`
Editorial metrics strip: Open Tasks · In Progress · Overdue · Backlog Size.

---

### Phase 5 — Board (Homepage)

#### [NEW] `src/app/(workspace)/page.tsx`
Server Component. Fetches current sprint + tasks + members. Passes to client board.

#### [NEW] `src/features/sprint/sprint-header.tsx`
Shows: "Current Sprint · Sep 14–20 · [8 tasks] · [Carry Over button]"

#### [NEW] `src/features/sprint/carry-over-dialog.tsx`
Confirmation dialog: "Carry over N unfinished tasks into Sprint X?"

#### [NEW] `src/features/board/kanban-board.tsx`
Client Component. dnd-kit DnDContext wrapping three columns.

#### [NEW] `src/features/board/kanban-column.tsx`
Droppable column (TODO, IN_PROGRESS, DONE).

#### [NEW] `src/features/board/task-card.tsx`
Draggable card. Shows: number, title, severity pill+border, owners, checklist progress, deadline (red+bold if overdue), status change control.

#### [NEW] `src/features/board/member-filter.tsx`
Horizontally scrollable pill row. "All · Name (N) · ..."

#### [NEW] `src/features/tasks/task-checklist.tsx`
Inline toggleable checklist. Optimistic update.

#### [NEW] `src/features/tasks/task-detail-sheet.tsx`
Full task detail: left panel (fields) + right panel (audit stream). Mobile: stacked.

---

### Phase 6 — Backlog

#### [NEW] `src/features/backlog/backlog-table.tsx`
Compact table: # · Task · Severity · Owner · Age · Created · Action
"Add Task" in header.

#### [NEW] `src/features/backlog/backlog-row.tsx`
Individual row. Rust treatment when age ≥ 21 days (muted, reduced energy).

---

### Phase 7 — Completed Tasks

#### [NEW] `src/features/board/completed-table.tsx`
Compact table at bottom: # · Task · Severity · Owner · Completed · Sprint.

---

### Phase 8 — Audit Stream

#### [NEW] `src/features/audit/audit-stream.tsx`
Dark terminal-style panel. Renders typed audit events with actor, action, timestamp.

---

### Phase 9 — Ideas

#### [NEW] `src/app/(workspace)/ideas/page.tsx`
Ideas page.

#### [NEW] `src/features/ideas/ideas-list.tsx`
Compact list of active ideas.

#### [NEW] `src/features/ideas/idea-card.tsx`
Card: title, age, promote/delete actions.

#### [NEW] `src/features/ideas/idea-capture.tsx`
Frictionless capture: "Got a spark? Type something brilliant..." — Enter submits.

---

### Phase 10 — Pods

#### [NEW] `src/app/(workspace)/pods/page.tsx`
Pods page.

#### [NEW] `src/features/pods/pod-card.tsx`
Pod grouping: pod name, lead, members list, task counts.

#### [NEW] `src/features/pods/edit-pods-dialog.tsx`
Pod management for authorized leads: rename, change lead, add/remove members.

---

### Phase 11 — Feedback

#### [NEW] `src/app/(workspace)/feedback/page.tsx`
Feedback overview: list of cycles, create new cycle.

#### [NEW] `src/app/(workspace)/feedback/[cycleId]/page.tsx`
Cycle detail. State machine: SELECTING_REVIEWERS → IN_PROGRESS → COMPLETED → FINALIZED.

#### [NEW] `src/features/feedback/reviewer-selector.tsx`
5/5 selector with avatar, name, pod, relationship, selected state.

#### [NEW] `src/features/feedback/feedback-form.tsx`
Autosaving form: Performance Impact ratings (5 circles), Strengths (1–3), Development Areas (1–3 AIM format).

#### [NEW] `src/features/feedback/feedback-ratings.tsx`
Five-circle rating component. Orange selected state. Accessible.

#### [NEW] `src/features/feedback/feedback-progress.tsx`
3/5 submitted state with named reviewers.

#### [NEW] `src/features/feedback/feedback-final.tsx`
Aggregate view + optional AI summary + Finalize button.

---

### Phase 12 — Server Actions

#### [NEW] `src/server/actions/tasks.ts`
- `createTask`
- `updateTaskStatus` (with audit + optimistic rollback support)
- `updateTaskSeverity`
- `updateChecklist`
- `moveToBacklog` (with pivot reason)
- `addToSprint`
- `deleteTask`

#### [NEW] `src/server/actions/sprints.ts`
- `carryOverSprint` (transactional)
- `getActiveSprint`

#### [NEW] `src/server/actions/ideas.ts`
- `createIdea`
- `promoteIdea`
- `deleteIdea`

#### [NEW] `src/server/actions/pods.ts`
- `updatePod`
- `moveMember`

#### [NEW] `src/server/actions/feedback.ts`
- `createCycle`
- `selectReviewers`
- `saveFeedbackResponse` (debounced autosave)
- `finalizeCycle`

---

### Phase 13 — API Routes

#### [NEW] `src/app/api/n8n/webhook/route.ts`
Signed webhook receiver for n8n callbacks.

#### [NEW] `src/app/api/cron/sprint-check/route.ts`
Daily cron: detect sprint ending, flag tasks.

#### [NEW] `src/app/api/cron/rust-update/route.ts`
Daily cron: update rust metadata if not computed dynamically.

#### [NEW] `src/app/api/cron/feedback-reminders/route.ts`
Daily cron: dispatch feedback reminders via n8n.

---

### Phase 14 — Settings

#### [NEW] `src/app/(workspace)/settings/page.tsx`
Settings overview.

#### [NEW] `src/app/(workspace)/settings/access/page.tsx`
Allowlist management (ADMIN only).

#### [NEW] `src/app/(workspace)/settings/pods/page.tsx`
Pod structure management.

#### [NEW] `src/app/(workspace)/settings/culture/page.tsx`
Culture principles viewer/editor.

#### [NEW] `src/app/(workspace)/settings/integrations/page.tsx`
n8n integration status, webhook configuration.

---

### Phase 15 — n8n Integration

#### [NEW] `src/lib/n8n/client.ts`
Typed n8n event dispatcher with retry logic and outbox pattern.

#### [NEW] `src/lib/n8n/events.ts`
Typed event contracts for all n8n events.

---

### Phase 16 — Permissions

#### [NEW] `src/lib/permissions/index.ts`
Role matrix enforcement. Server-side only.

---

### Phase 17 — Seed Script

#### [NEW] `scripts/seed.ts`
Deterministic seed:
- Allowed users with roles
- Pods structure
- Current sprint (Sep 14–20, 2026)
- Representative tasks (mix of severities/statuses)
- Backlog tasks (including one 22+ days old for rust demo)
- Ideas
- Sample feedback cycle

---

### Phase 18 — Tests

#### [NEW] `tests/unit/`
- `domain.test.ts` — severity, rust, overdue, carry-over eligibility, permissions
- `feedback.test.ts` — completion logic, finalization guards
- `sprint.test.ts` — carry-over logic

#### [NEW] `tests/integration/`
- `auth.test.ts` — allowlist enforcement
- `tasks.test.ts` — CRUD, status transitions
- `sprint.test.ts` — carry-over transaction
- `feedback.test.ts` — full lifecycle

#### [NEW] `tests/e2e/`
- `auth.spec.ts`
- `board.spec.ts`
- `backlog.spec.ts`
- `feedback.spec.ts`
- `pods.spec.ts`

---

### Phase 19 — Documentation

#### [NEW] `README.md`
#### [NEW] `ARCHITECTURE.md`
#### [NEW] `DATABASE.md`
#### [NEW] `AUTH.md`
#### [NEW] `DEPLOYMENT.md`
#### [NEW] `N8N.md`

---

### Phase 20 — Deployment Config

#### [NEW] `.env.example`
#### [NEW] `vercel.json`
Cron job configuration.

---

## Verification Plan

### Automated Tests
```bash
npx tsc --noEmit          # TypeScript strict check
npx eslint src/           # Lint
npx vitest run            # Unit + integration tests
npx playwright test       # E2E tests
npx next build            # Production build
```

### Manual Verification
- Login with allowed and disallowed email
- Create task in backlog and sprint
- Drag card between columns
- Toggle checklist inline
- Carry over unfinished tasks
- Verify overdue date turns red/bold
- Verify rust treatment at 21+ days
- Create and promote an idea
- Full feedback cycle (select reviewers → write → finalize)
- Pod editing
- Mobile layout at 390px

---

## Implementation Order (Vertical Slices)

1. **Scaffold** — Next.js 15 init, migrate design system, base layout
2. **Database** — MongoClient, type definitions, indexes
3. **Auth** — Better Auth, allowlist, login page, middleware
4. **User/Pod model** — Repositories + seed
5. **Sprint model** — Sprint CRUD, active sprint query
6. **Task CRUD** — Repository + server actions
7. **Kanban + DnD** — Board page, drag-and-drop, optimistic updates
8. **Checklist** — Inline toggle, autosave
9. **Backlog** — Table, rust mechanic, add task
10. **Completed history** — Compact table
11. **Audit system** — Event creation, terminal stream
12. **Ideas** — Capture, promote, delete
13. **Pods** — Pod page, edit dialog
14. **Feedback** — Full 3-stage workflow
15. **n8n** — Event dispatch, webhook receiver
16. **Cron** — Sprint check, rust update, feedback reminders
17. **Settings** — Allowlist, integrations
18. **Tests** — Unit, integration, E2E
19. **Accessibility** — Focus states, keyboard nav, ARIA
20. **Performance** — Streaming, caching, bundle optimization
21. **Vercel deployment** — Config, env vars, preview
22. **Visual QA** — Compare against design mockup
