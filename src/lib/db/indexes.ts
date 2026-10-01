/**
 * MongoDB index setup script.
 * Run once during deployment setup: npx tsx scripts/setup-indexes.ts
 */
import { getDb } from "./client";

export async function setupIndexes() {
    const db = await getDb();

    // ─── tasks ──────────────────────────────────────────────────
    const tasks = db.collection("tasks");
    await tasks.createIndexes([
        {
            key: { displayNumber: 1 },
            name: "tasks_display_number",
            unique: true,
        },
        { key: { sprintId: 1, status: 1 }, name: "tasks_sprint_status" },
        {
            key: { assigneeIds: 1, status: 1 },
            name: "tasks_assignees_status",
        },
        {
            key: { primaryOwnerId: 1, status: 1 },
            name: "tasks_owner_status",
        },
        { key: { deadline: 1 }, name: "tasks_deadline", sparse: true },
        {
            key: { severity: 1, status: 1 },
            name: "tasks_severity_status",
        },
        { key: { status: 1, updatedAt: -1 }, name: "tasks_status_updated" },
        {
            key: { deletedAt: 1 },
            name: "tasks_deleted_at",
            sparse: true,
        },
        { key: { createdAt: -1 }, name: "tasks_created_at" },
    ]);

    // ─── sprints ─────────────────────────────────────────────────
    const sprints = db.collection("sprints");
    await sprints.createIndexes([
        { key: { status: 1 }, name: "sprints_status" },
        { key: { number: 1 }, name: "sprints_number", unique: true },
        { key: { startDate: -1 }, name: "sprints_start_date" },
    ]);

    // ─── auditEvents ─────────────────────────────────────────────
    const audit = db.collection("auditEvents");
    await audit.createIndexes([
        {
            key: { entityType: 1, entityId: 1, createdAt: -1 },
            name: "audit_entity_created",
        },
        { key: { actorId: 1, createdAt: -1 }, name: "audit_actor_created" },
        { key: { createdAt: -1 }, name: "audit_created_at" },
    ]);

    // ─── ideas ───────────────────────────────────────────────────
    const ideas = db.collection("ideas");
    await ideas.createIndexes([
        {
            key: { status: 1, createdAt: -1 },
            name: "ideas_status_created",
        },
        { key: { createdBy: 1 }, name: "ideas_created_by" },
    ]);

    // ─── pods ────────────────────────────────────────────────────
    const pods = db.collection("pods");
    await pods.createIndexes([
        { key: { leadId: 1 }, name: "pods_lead", sparse: true },
        { key: { memberIds: 1 }, name: "pods_members" },
    ]);

    // ─── users ───────────────────────────────────────────────────
    const users = db.collection("user");
    await users.createIndexes([
        { key: { email: 1 }, name: "users_email", unique: true },
        { key: { role: 1 }, name: "users_role" },
        { key: { podId: 1 }, name: "users_pod", sparse: true },
    ]);

    // ─── allowedUsers ────────────────────────────────────────────
    const allowed = db.collection("allowedUsers");
    await allowed.createIndexes([
        { key: { email: 1 }, name: "allowed_email", unique: true },
        { key: { active: 1 }, name: "allowed_active" },
    ]);

    // ─── feedbackCycles ──────────────────────────────────────────
    const cycles = db.collection("feedbackCycles");
    await cycles.createIndexes([
        {
            key: { recipientId: 1, status: 1 },
            name: "cycles_recipient_status",
        },
        { key: { reviewerIds: 1 }, name: "cycles_reviewers" },
        {
            key: { status: 1, createdAt: -1 },
            name: "cycles_status_created",
        },
    ]);

    // ─── feedbackResponses ───────────────────────────────────────
    const responses = db.collection("feedbackResponses");
    await responses.createIndexes([
        {
            key: { cycleId: 1, reviewerId: 1 },
            name: "responses_cycle_reviewer",
            unique: true,
        },
        { key: { cycleId: 1 }, name: "responses_cycle" },
        { key: { reviewerId: 1 }, name: "responses_reviewer" },
    ]);

    console.log("✓ MongoDB indexes created successfully");
}
