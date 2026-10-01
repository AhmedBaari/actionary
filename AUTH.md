# SastraNet Authentication & Authorization

## Authentication Architecture

- Powered by **Better Auth** with the official MongoDB adapter.
- Enforces an **Email Allowlist** via a server-side `before` hook:
  - Any attempt to authenticate or register an email that does not exist in `allowedUsers` with `active: true` is rejected with `403 Forbidden`.
  - The client displays: *"This account isn't part of the SastraNet workspace."*
  - The API does not leak whether unallowlisted emails exist in the database.

## Roles & Permissions

- **ADMIN**: Manage workspace allowlist, global settings.
- **LEAD**: Initiate feedback cycles, finalize feedback, carry over sprints, edit all tasks.
- **POD_LEAD**: Manage pod assignments, edit pod tasks.
- **MEMBER**: Create tasks/ideas, drag cards, toggle checklists, provide feedback.
