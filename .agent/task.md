# SastraNet Build Tasks

## Phase 1 — Project Scaffold
- [/] Initialize Next.js 15 project (replace Vite)
- [ ] Migrate design system (CSS tokens, fonts, globals.css)
- [ ] Configure Tailwind 4 + PostCSS
- [ ] Configure TypeScript strict mode
- [ ] Configure ESLint
- [ ] Configure path aliases (@/)
- [ ] Create base layout.tsx with Google Fonts
- [ ] Create root error.tsx + not-found.tsx

## Phase 2 — Database Layer
- [ ] MongoClient singleton (src/lib/db/client.ts)
- [ ] Index definitions (src/lib/db/indexes.ts)
- [ ] Domain types (src/types/index.ts)
- [ ] Task repository
- [ ] Sprint repository
- [ ] Ideas repository
- [ ] Pods repository
- [ ] Audit repository
- [ ] Feedback repository
- [ ] Users repository

## Phase 3 — Authentication
- [ ] Better Auth config (auth.ts)
- [ ] Email allowlist hook
- [ ] Auth route handler
- [ ] Login page
- [ ] Middleware

## Phase 4 — App Shell
- [ ] Workspace layout
- [ ] Floating pill navigation
- [ ] Workspace header (metrics)

## Phase 5 — Board (Homepage)
- [ ] Board page (Server Component)
- [ ] Sprint header
- [ ] Carry-over dialog
- [ ] Kanban board (Client Component)
- [ ] Kanban columns (TODO, IN_PROGRESS, DONE)
- [ ] Task cards (draggable)
- [ ] Member filter row

## Phase 6 — Task Detail
- [ ] Task detail sheet/modal
- [ ] Inline checklist toggle
- [ ] Pivot reason dialog

## Phase 7 — Backlog
- [ ] Backlog table
- [ ] Backlog row with rust treatment
- [ ] Add task to backlog

## Phase 8 — Completed History
- [ ] Completed tasks table

## Phase 9 — Audit System
- [ ] Audit event creation service
- [ ] Audit terminal stream component

## Phase 10 — Ideas
- [ ] Ideas page
- [ ] Idea capture (frictionless)
- [ ] Idea promotion workflow

## Phase 11 — Pods
- [ ] Pods page
- [ ] Pod cards
- [ ] Edit pods dialog

## Phase 12 — Feedback
- [ ] Feedback overview page
- [ ] Cycle detail page
- [ ] Reviewer selector
- [ ] Feedback form (autosave)
- [ ] Rating circles
- [ ] Feedback progress
- [ ] Feedback final screen

## Phase 13 — Server Actions
- [ ] Task actions
- [ ] Sprint actions
- [ ] Idea actions
- [ ] Pod actions
- [ ] Feedback actions

## Phase 14 — API Routes
- [ ] n8n webhook receiver
- [ ] Cron: sprint-check
- [ ] Cron: rust-update
- [ ] Cron: feedback-reminders

## Phase 15 — n8n Integration
- [ ] n8n client (typed, retry)
- [ ] Event type contracts

## Phase 16 — Settings
- [ ] Settings overview
- [ ] Access (allowlist) management
- [ ] Culture page

## Phase 17 — Seed Script
- [ ] Deterministic seed with team, pods, sprint, tasks, ideas

## Phase 18 — Tests
- [ ] Unit tests (domain logic)
- [ ] Integration tests (MongoDB ops)
- [ ] E2E tests (Playwright)

## Phase 19 — Documentation
- [ ] README.md
- [ ] ARCHITECTURE.md
- [ ] DATABASE.md
- [ ] AUTH.md
- [ ] DEPLOYMENT.md
- [ ] N8N.md

## Phase 20 — Deployment Config
- [ ] .env.example
- [ ] vercel.json

## Phase 21 — Accessibility & Performance
- [ ] Keyboard nav
- [ ] Focus states
- [ ] ARIA labels
- [ ] prefers-reduced-motion

## Phase 22 — Visual QA
- [ ] Compare against design mockup
- [ ] Mobile responsive check
