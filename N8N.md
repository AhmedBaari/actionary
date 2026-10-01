# SastraNet n8n Workflow Integration

## Outbox Pattern
Workflows are triggered via non-blocking HTTP requests with a 5-second timeout, ensuring zero latency impact on user operations.

## Event Contracts
Events sent from SastraNet to n8n include:
- `sprint.rollover_warning`: Dispatched 24 hours prior to sprint completion
- `sprint.ended`: Dispatched when a weekly sprint concludes
- `task.pivoted`: Dispatched when an in-flight task moves back to backlog
- `feedback.cycle_started`: Dispatched when 5 reviewers are confirmed
- `feedback.reminder`: Automated reminders for pending reviewers
- `feedback.completed`: Dispatched when 5/5 reviewers have submitted
- `feedback.finalized`: Dispatched when the cycle is sealed by the lead

## Security
Every payload includes an `X-SastraNet-Signature` header matched against `N8N_WEBHOOK_SECRET`.
