import { MongoClient, ObjectId } from "mongodb";
import * as dotenv from "dotenv";
import { subDays, addDays } from "date-fns";

dotenv.config({ path: ".env.local" });
dotenv.config();

const uri = process.env.MONGODB_URI;
if (!uri) {
  console.error("Missing MONGODB_URI. Provide it in .env.local or environment variable.");
  process.exit(1);
}

async function runSeed() {
  const client = new MongoClient(uri!);
  await client.connect();
  const db = client.db("sastranet");

  console.log("Connected to MongoDB. Seeding SastraNet workspace...");

  // 1. Clear existing collections
  await db.collection("allowedUsers").deleteMany({});
  await db.collection("user").deleteMany({});
  await db.collection("users").deleteMany({});
  await db.collection("pods").deleteMany({});
  await db.collection("sprints").deleteMany({});
  await db.collection("tasks").deleteMany({});
  await db.collection("ideas").deleteMany({});
  await db.collection("feedbackCycles").deleteMany({});
  await db.collection("feedbackResponses").deleteMany({});
  await db.collection("auditEvents").deleteMany({});

  const now = new Date();

  // 2. Seed Users & AllowedUsers
  const team = [
    { name: "Abhinav", email: "abhinav@sastranet.com", role: "ADMIN" },
    { name: "Siddharth", email: "siddharth@sastranet.com", role: "POD_LEAD" },
    { name: "Daya", email: "daya@sastranet.com", role: "POD_LEAD" },
    { name: "Punith", email: "punith@sastranet.com", role: "POD_LEAD" },
    { name: "Akash", email: "akash@sastranet.com", role: "MEMBER" },
    { name: "Anoohya", email: "anoohya@sastranet.com", role: "MEMBER" },
    { name: "Vinay", email: "vinay@sastranet.com", role: "MEMBER" },
    { name: "Gautam", email: "gautam@sastranet.com", role: "MEMBER" },
  ];

  const userMap: Record<string, ObjectId> = {};

  for (const member of team) {
    const userId = new ObjectId();
    userMap[member.name] = userId;

    const userDoc = {
      _id: userId,
      name: member.name,
      email: member.email,
      role: member.role,
      podId: null,
      avatarUrl: null,
      active: true,
      emailVerified: true,
      createdAt: now,
      updatedAt: now,
    };

    await db.collection("user").insertOne(userDoc);
    await db.collection("users").insertOne({ ...userDoc });

    await db.collection("allowedUsers").insertOne({
      email: member.email,
      role: member.role,
      active: true,
      createdAt: now,
      createdBy: "seed",
    });
  }

  // 3. Seed Pods
  const podsData = [
    {
      name: "Siddharth's Pod",
      lead: "Siddharth",
      members: ["Siddharth", "Anoohya", "Vinay"],
    },
    {
      name: "Daya's Pod",
      lead: "Daya",
      members: ["Daya", "Akash"],
    },
    {
      name: "Punith's Pod",
      lead: "Punith",
      members: ["Punith", "Gautam"],
    },
  ];

  const podMap: Record<string, ObjectId> = {};

  for (const pod of podsData) {
    const podId = new ObjectId();
    podMap[pod.name] = podId;

    const memberIds = pod.members.map((m) => userMap[m].toString());
    const leadId = userMap[pod.lead].toString();

    await db.collection("pods").insertOne({
      _id: podId,
      name: pod.name,
      leadId,
      memberIds,
      createdAt: now,
      updatedAt: now,
    });

    // Update users with podId
    for (const memberName of pod.members) {
      await db.collection("user").updateOne(
        { _id: userMap[memberName] },
        { $set: { podId: podId.toString() } }
      );
      await db.collection("users").updateOne(
        { _id: userMap[memberName] },
        { $set: { podId: podId.toString() } }
      );
    }
  }

  // 4. Seed Current Sprint (Sep 14–20, 2026)
  const sprintId = new ObjectId();
  const sprintStart = new Date("2026-09-14T00:00:00.000Z");
  const sprintEnd = new Date("2026-09-20T23:59:59.000Z");

  await db.collection("sprints").insertOne({
    _id: sprintId,
    sprintNumber: 1,
    name: "Sprint 1",
    startDate: sprintStart,
    endDate: sprintEnd,
    status: "ACTIVE",
    createdAt: subDays(now, 2),
    completedAt: null,
  });

  // 5. Seed Tasks
  const sampleTasks = [
    {
      displayNumber: 930,
      title: "Optimize cold start latency for core search queries",
      description: "Ensure latency is consistently under 120ms by introducing connection caching and indexing key fields.",
      status: "IN_PROGRESS",
      severity: "RED",
      sprintId,
      primaryOwnerId: userMap["Abhinav"],
      assigneeIds: [userMap["Abhinav"], userMap["Akash"]],
      checklist: [
        { id: "c1", label: "Analyze slow query profiles", done: true },
        { id: "c2", label: "Add compound index on search keys", done: true },
        { id: "c3", label: "Verify p99 latency in staging", done: false },
      ],
      deadline: sprintEnd,
      createdFrom: "SPRINT",
      createdAt: subDays(now, 2),
      updatedAt: subDays(now, 1),
    },
    {
      displayNumber: 931,
      title: "Implement zero-friction idea quick capture with Enter-to-submit",
      description: "Users should be able to type a thought without clicking anything and hit Enter to store it.",
      status: "IN_PROGRESS",
      severity: "ORANGE",
      sprintId,
      primaryOwnerId: userMap["Daya"],
      assigneeIds: [userMap["Daya"]],
      checklist: [
        { id: "c4", label: "Build minimal floating input box", done: true },
        { id: "c5", label: "Add keyboard Enter listener", done: true },
        { id: "c6", label: "Add optimistic list update", done: false },
      ],
      deadline: sprintEnd,
      createdFrom: "SPRINT",
      createdAt: subDays(now, 2),
      updatedAt: now,
    },
    {
      displayNumber: 932,
      title: "Audit trail terminal stream component for task detail drawer",
      description: "Show who moved or changed the task in real-time dark terminal aesthetic.",
      status: "TODO",
      severity: "YELLOW",
      sprintId,
      primaryOwnerId: userMap["Punith"],
      assigneeIds: [userMap["Punith"], userMap["Gautam"]],
      checklist: [
        { id: "c7", label: "Design dark monospace terminal panel", done: true },
        { id: "c8", label: "Wire up event fetching", done: false },
      ],
      deadline: sprintEnd,
      createdFrom: "SPRINT",
      createdAt: subDays(now, 1),
      updatedAt: subDays(now, 1),
    },
    {
      displayNumber: 933,
      title: "Mobile drawer touch swipe dismiss handling",
      description: "Allow natural downward swipe gesture to close sheets on iOS and Android.",
      status: "TODO",
      severity: "GREEN",
      sprintId,
      primaryOwnerId: userMap["Anoohya"],
      assigneeIds: [userMap["Anoohya"]],
      checklist: [
        { id: "c9", label: "Add touch drag listener", done: false },
      ],
      deadline: sprintEnd,
      createdFrom: "SPRINT",
      createdAt: now,
      updatedAt: now,
    },
    {
      displayNumber: 934,
      title: "Automate weekly sprint rollover reminder to pod leads via n8n",
      description: "Trigger signed webhook when sprint has 24 hours remaining.",
      status: "DONE",
      severity: "ORANGE",
      sprintId,
      primaryOwnerId: userMap["Siddharth"],
      assigneeIds: [userMap["Siddharth"], userMap["Vinay"]],
      checklist: [
        { id: "c10", label: "Define webhook payload contract", done: true },
        { id: "c11", label: "Test HMAC header signature", done: true },
        { id: "c12", label: "Deploy n8n workflow", done: true },
      ],
      deadline: sprintEnd,
      completedAt: subDays(now, 1),
      completedSprintId: sprintId,
      createdFrom: "SPRINT",
      createdAt: subDays(now, 3),
      updatedAt: subDays(now, 1),
    },
    {
      displayNumber: 935,
      title: "Fix critical session invalidation bug on password reset",
      description: "Past sessions must immediately terminate across all devices.",
      status: "TODO",
      severity: "RED",
      sprintId,
      primaryOwnerId: userMap["Abhinav"],
      assigneeIds: [userMap["Abhinav"]],
      checklist: [
        { id: "c13", label: "Revoke auth tokens on password change", done: false },
      ],
      deadline: subDays(now, 1), // Overdue!
      createdFrom: "SPRINT",
      createdAt: subDays(now, 4),
      updatedAt: subDays(now, 2),
    },
    // Backlog tasks
    {
      displayNumber: 928,
      title: "Migrate legacy WhatsApp group notification bot into unified n8n stream",
      description: "Replace individual webhook scripts with centralized n8n relay.",
      status: "BACKLOG",
      severity: "YELLOW",
      sprintId: null,
      primaryOwnerId: userMap["Vinay"],
      assigneeIds: [userMap["Vinay"]],
      checklist: [],
      deadline: null,
      createdFrom: "BACKLOG",
      createdAt: subDays(now, 24), // 24 days old -> Rust demonstration!
      updatedAt: subDays(now, 24),
    },
    {
      displayNumber: 929,
      title: "Explore peer feedback aggregate sentiment analysis",
      description: "Optional summary generation for lead review before final signoff.",
      status: "BACKLOG",
      severity: "RANDOM_IDEA",
      sprintId: null,
      primaryOwnerId: userMap["Daya"],
      assigneeIds: [userMap["Daya"]],
      checklist: [],
      deadline: null,
      createdFrom: "BACKLOG",
      createdAt: subDays(now, 10),
      updatedAt: subDays(now, 5),
    },
    {
      displayNumber: 927,
      title: "Add keyboard navigation shortcuts for Kanban column switching",
      description: "Press 1, 2, 3 to navigate or move focused task card.",
      status: "BACKLOG",
      severity: "GREEN",
      sprintId: null,
      primaryOwnerId: userMap["Punith"],
      assigneeIds: [userMap["Punith"]],
      checklist: [],
      deadline: null,
      createdFrom: "BACKLOG",
      createdAt: subDays(now, 4),
      updatedAt: subDays(now, 4),
    },
  ];

  for (const t of sampleTasks) {
    const res = await db.collection("tasks").insertOne({
      ...t,
      version: 1,
      deletedAt: null,
      pivotReason: null,
    });

    // Seed sample audit events
    await db.collection("auditEvents").insertOne({
      entityType: "task",
      entityId: res.insertedId.toString(),
      actorId: t.primaryOwnerId ? t.primaryOwnerId.toString() : null,
      actorName: "Abhinav",
      action: "task.created",
      metadata: { displayNumber: t.displayNumber, title: t.title },
      createdAt: t.createdAt,
    });
  }

  // 6. Seed Ideas
  await db.collection("ideas").insertMany([
    {
      title: "Weekly automated digest email summarizing sprint accomplishments",
      description: "Send Friday 5pm recap with completed tasks and peer kudos.",
      status: "ACTIVE",
      promotedTaskId: null,
      createdBy: userMap["Abhinav"],
      createdAt: subDays(now, 3),
      updatedAt: subDays(now, 3),
    },
    {
      title: "Dark mode terminal theme switcher for engineer power users",
      description: "Add high-contrast amber/green CRT style themes.",
      status: "ACTIVE",
      promotedTaskId: null,
      createdBy: userMap["Punith"],
      createdAt: subDays(now, 1),
      updatedAt: now,
    },
  ]);

  // 7. Seed Sample Feedback Cycle
  const cycleId = new ObjectId();
  const recipientId = userMap["Gautam"].toString();
  const reviewerIds = [
    userMap["Abhinav"].toString(),
    userMap["Daya"].toString(),
    userMap["Akash"].toString(),
    userMap["Punith"].toString(),
    userMap["Vinay"].toString(),
  ];

  await db.collection("feedbackCycles").insertOne({
    _id: cycleId,
    recipientId,
    reviewerIds,
    status: "IN_PROGRESS",
    createdBy: userMap["Abhinav"].toString(),
    aiSummary: null,
    aiSummaryGeneratedAt: null,
    createdAt: subDays(now, 4),
    finalizedAt: null,
  });

  // Seed 3 completed responses (3/5 submitted state demonstration!)
  const completedReviewers = [
    { name: "Abhinav", id: userMap["Abhinav"].toString(), eff: 5, cul: 5 },
    { name: "Daya", id: userMap["Daya"].toString(), eff: 4, cul: 5 },
    { name: "Akash", id: userMap["Akash"].toString(), eff: 4, cul: 4 },
  ];

  for (const cr of completedReviewers) {
    await db.collection("feedbackResponses").insertOne({
      cycleId: cycleId.toString(),
      reviewerId: cr.id,
      effectivenessRating: cr.eff,
      cultureRating: cr.cul,
      strengths: ["Extreme technical velocity", "Clear and proactive communication"],
      developmentAreas: [
        {
          action: "Increase test coverage on critical payment edge cases",
          impact: "Prevents regression failures during late-night deploys",
          measure: "Target >85% unit coverage on transaction models",
        },
      ],
      impactNarrative: "Gautam demonstrated exceptional ownership throughout the sprint, delivering the search optimizations ahead of schedule.",
      additionalComments: null,
      completed: true,
      createdAt: subDays(now, 2),
      updatedAt: subDays(now, 1),
    });
  }

  // Seed 2 pending responses
  for (const pendingId of [userMap["Punith"].toString(), userMap["Vinay"].toString()]) {
    await db.collection("feedbackResponses").insertOne({
      cycleId: cycleId.toString(),
      reviewerId: pendingId,
      effectivenessRating: null,
      cultureRating: null,
      strengths: [],
      developmentAreas: [],
      impactNarrative: null,
      additionalComments: null,
      completed: false,
      createdAt: subDays(now, 4),
      updatedAt: subDays(now, 4),
    });
  }

  console.log("Successfully seeded SastraNet workspace with team, pods, sprint, tasks, ideas, and feedback!");
  await client.close();
}

runSeed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
