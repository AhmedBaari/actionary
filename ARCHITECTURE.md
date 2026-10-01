# SastraNet Architecture

## System Overview

```text
                        ┌─────────────────────────────────────┐
                        │       Client Browser (React 19)     │
                        │  Floating Nav · Kanban · Autosave   │
                        └──────────────────┬──────────────────┘
                                           │
                        ┌──────────────────┴──────────────────┐
                        │        Next.js 16 App Router        │
                        │  RSC Data Layer · Server Actions    │
                        └─────────┬─────────────────┬─────────┘
                                  │                 │
                ┌─────────────────┴─────┐     ┌─────┴──────────────┐
                │ MongoDB Atlas         │     │ n8n Automation     │
                │ Tasks · Sprints · Pods│     │ Webhooks · Crons   │
                │ Audit · Feedback      │     │ Non-blocking Queue │
                └───────────────────────┘     └────────────────────┘
```

## Layered Architecture

1. **Presentation Layer (React Server Components + Client Islands)**
   - RSCs fetch directly from MongoDB repositories on the server.
   - Interactive islands (`KanbanBoard`, `FeedbackForm`, `TaskDetailSheet`) handle optimistic updates, drag-and-drop, and autosaving.

2. **Domain Logic Layer (`src/lib/domain.ts`)**
   - Pure, testable functions isolated from JSX and database drivers.
   - Calculates task overdue state, backlog rust, checklist completion, sprint formatting, and permission boundaries.

3. **Data Access Layer (`src/server/repositories/`)**
   - Official `mongodb` driver with pooled client singleton (`src/lib/db/client.ts`).
   - Strong typing across all collections.

4. **Service Layer (`src/server/services/`)**
   - Encapsulates transactional boundaries, carry-over rollover logic, and audit event emission.

5. **Mutation Layer (`src/server/actions/`)**
   - Validates input, coordinates service calls, and triggers `revalidatePath`.
