# SastraNet Database Model

## Collections

### 1. `tasks`
- Primary work item collection.
- Key fields: `displayNumber`, `title`, `description`, `status` (TODO | IN_PROGRESS | DONE | BACKLOG), `severity` (RED | ORANGE | YELLOW | GREEN | RANDOM_IDEA), `sprintId`, `primaryOwnerId`, `assigneeIds`, `checklist`, `deadline`, `pivotReason`, `version`.

### 2. `sprints`
- Weekly sprint records.
- Fields: `sprintNumber`, `name`, `startDate`, `endDate`, `status` (UPCOMING | ACTIVE | COMPLETED), `createdAt`, `completedAt`.

### 3. `pods`
- Organizational groupings.
- Fields: `name`, `leadId`, `memberIds`, `createdAt`, `updatedAt`.

### 4. `ideas`
- Reservoir of product sparks.
- Fields: `title`, `description`, `status` (ACTIVE | PROMOTED | ARCHIVED), `promotedTaskId`, `createdBy`.

### 5. `feedbackCycles`
- 360° monthly review cycles.
- Fields: `recipientId`, `reviewerIds` (exactly 5), `status` (SELECTING_REVIEWERS | IN_PROGRESS | COMPLETED | FINALIZED), `aiSummary`, `finalizedAt`.

### 6. `feedbackResponses`
- Individual reviewer submissions.
- Fields: `cycleId`, `reviewerId`, `effectivenessRating` (1–5), `cultureRating` (1–5), `strengths` (array), `developmentAreas` (AIM format), `impactNarrative`, `completed`.

### 7. `auditEvents`
- Complete chronological audit stream.
- Fields: `entityType`, `entityId`, `actorId`, `actorName`, `action`, `metadata`, `createdAt`.

### 8. `allowedUsers`
- Pre-authorized email list enforcing the registration allowlist.
- Fields: `email`, `role`, `active`, `createdAt`.
