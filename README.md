# SastraNet Workspace

> **"Let's Do The Impossible Together"**

A high-velocity, lightweight internal operating system for SastraNet built with Next.js 16 (App Router), React 19, MongoDB Atlas, and Tailwind CSS 4.

---

## Key Features

- **Current Weekly Sprint Execution**: Real-time Kanban board (To Do, In Progress, Done) with smooth drag-and-drop powered by `@dnd-kit`.
- **Monotonically Increasing Task IDs**: Human-friendly identifiers (e.g. `#930`) with strict severity classification (Critical Red, High Orange, Medium Yellow, Low Green, Random Idea).
- **Inline Checklist Toggling**: Update acceptance criteria directly on task cards without opening modals.
- **Overdue Tracking**: Deadlines default to the active sprint end and render in red/bold when overdue.
- **Member Filtering**: Horizontally scrollable filter pills showing real-time active task counts per member.
- **Backlog Rust Mechanic**: Visual rust treatment for tasks remaining untouched for &ge; 21 days to keep backlog grooming honest.
- **Pivot Reason Tracking**: Required rationale prompt when moving active tasks back to the backlog, recorded in the audit trail.
- **Dark Terminal Audit Stream**: Monospace terminal recording actor, action, status transitions, and pivot reasons.
- **Pods Organization**: Group members by pod leads with live active and completed task counters.
- **Product Sparks**: Frictionless idea capture with Enter-to-submit and one-click promotion to sprint tasks.
- **Monthly 360° Peer Feedback**:
  - 5/5 reviewer selection cohort
  - 5-circle numerical rating components (Effectiveness & Culture)
  - Continuous background autosave with visual status
  - Strengths and development areas structured in AIM format (Action, Impact, Measure)
  - 3/5 completion tracking state and executive AI synthesis view
- **Asynchronous n8n Webhook Outbox**: Non-blocking background event dispatch for reminders and alerts.
- **Email Allowlist Authentication**: Better Auth integration enforcing server-side allowlists before permitting signup or login.

---

## Tech Stack

- **Framework**: Next.js 16 (App Router, Server Actions, Server Components)
- **Runtime**: React 19
- **Styling**: Tailwind CSS 4 with custom SastraNet design tokens
- **Database**: MongoDB Atlas (official driver with connection pooling)
- **Auth**: Better Auth with MongoDB adapter & email allowlist hooks
- **Drag & Drop**: `@dnd-kit/core`, `@dnd-kit/sortable`, `@dnd-kit/utilities`
- **Automation**: External n8n webhook integration via signed HMAC headers

---

## Getting Started

### 1. Prerequisites
- Node.js >= 20.x
- MongoDB Atlas cluster or local MongoDB instance

### 2. Environment Setup
Create a `.env.local` file:
```bash
cp .env.example .env.local
```
Fill in your `MONGODB_URI` and `BETTER_AUTH_SECRET`.

### 3. Seed Database
Run the deterministic seed script:
```bash
npx tsx scripts/seed.ts
```
This sets up the SastraNet team members, pods, current sprint, tasks, backlog items (with a 24-day-old item to demonstrate rust), product ideas, and a 3/5 completed sample feedback cycle.

### 4. Run Development Server
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) to view the workspace.
