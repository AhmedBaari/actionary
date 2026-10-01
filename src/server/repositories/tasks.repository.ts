import { ClientSession } from "mongodb";
import { getDb } from "@/lib/db/client";
import { idCandidates, idFilter, toDatabaseId } from "@/lib/db/ids";
import type { Task, TaskStatus, ChecklistItem } from "@/types";

export async function getTaskById(id: string): Promise<Task | null> {
  const db = await getDb();
  const doc = await db
    .collection("tasks")
    .findOne({ ...idFilter(id), deletedAt: null });
  return (doc as unknown) as Task | null;
}

export async function getTasksBySprintId(sprintId: string): Promise<Task[]> {
  const db = await getDb();
  const docs = await db
    .collection("tasks")
    .find({ sprintId: { $in: idCandidates(sprintId) }, deletedAt: null })
    .sort({ createdAt: 1 })
    .toArray();
  return (docs as unknown) as Task[];
}

/** Active kanban tasks — anything with status TODO | IN_PROGRESS | DONE (regardless of sprint). */
export async function getBoardTasks(): Promise<Task[]> {
  const db = await getDb();
  const docs = await db
    .collection("tasks")
    .find({ status: { $in: ["TODO", "IN_PROGRESS", "DONE"] }, deletedAt: null })
    .sort({ createdAt: 1 })
    .toArray();
  return (docs as unknown) as Task[];
}

/** Parked backlog tasks — status BACKLOG or tasks with no sprint assigned that aren't done. */
export async function getBacklogTasks(): Promise<Task[]> {
  const db = await getDb();
  const docs = await db
    .collection("tasks")
    .find({
      $or: [
        { status: "BACKLOG" },
        { sprintId: null, status: { $nin: ["TODO", "IN_PROGRESS", "DONE"] } },
      ],
      deletedAt: null,
    })
    .sort({ createdAt: -1 })
    .toArray();
  return (docs as unknown) as Task[];
}

export async function getCompletedTasks(limit = 50): Promise<Task[]> {
  const db = await getDb();
  const docs = await db
    .collection("tasks")
    .find({ status: "DONE", deletedAt: null })
    .sort({ completedAt: -1 })
    .limit(limit)
    .toArray();
  return (docs as unknown) as Task[];
}

export async function getNextDisplayNumber(): Promise<number> {
  const db = await getDb();
  const last = await db
    .collection("tasks")
    .findOne({}, { sort: { displayNumber: -1 }, projection: { displayNumber: 1 } });
  return (last?.displayNumber ?? 929) + 1;
}

export async function createTask(
  data: Omit<Task, "_id" | "displayNumber" | "version" | "createdAt" | "updatedAt">,
  session?: ClientSession
): Promise<Task> {
  const db = await getDb();
  const displayNumber = await getNextDisplayNumber();
  const now = new Date();

  const task: Omit<Task, "_id"> = {
    ...data,
    displayNumber,
    version: 1,
    createdAt: now,
    updatedAt: now,
  };

  const result = await db
    .collection("tasks")
    .insertOne(task as any, { session });

  return { ...task, _id: result.insertedId.toString() } as unknown as Task;
}

export async function updateTaskStatus(
  taskId: string,
  status: TaskStatus,
  additionalFields: Partial<Task> = {},
  expectedVersion?: number,
  session?: ClientSession
): Promise<{ modified: boolean }> {
  const db = await getDb();
  const now = new Date();

  const filter: Record<string, unknown> = {
    ...idFilter(taskId),
    deletedAt: null,
  };

  // Optimistic concurrency check
  if (expectedVersion !== undefined) {
    filter.version = expectedVersion;
  }

  const result = await db.collection("tasks").updateOne(
    filter,
    {
      $set: {
        status,
        updatedAt: now,
        ...additionalFields,
      },
      $inc: { version: 1 },
    },
    { session }
  );

  return { modified: result.modifiedCount > 0 };
}

export async function updateTaskFields(
  taskId: string,
  fields: Partial<Pick<Task, "title" | "description" | "severity" | "primaryOwnerId" | "assigneeIds" | "deadline" | "checklist" | "pivotReason">>,
  session?: ClientSession
): Promise<{ modified: boolean }> {
  const db = await getDb();
  const result = await db.collection("tasks").updateOne(
    { ...idFilter(taskId), deletedAt: null },
    {
      $set: { ...fields, updatedAt: new Date() },
      $inc: { version: 1 },
    },
    { session }
  );
  return { modified: result.modifiedCount > 0 };
}

export async function updateTaskChecklist(
  taskId: string,
  checklist: ChecklistItem[]
): Promise<{ modified: boolean }> {
  const db = await getDb();
  const result = await db.collection("tasks").updateOne(
    { ...idFilter(taskId), deletedAt: null },
    { $set: { checklist, updatedAt: new Date() }, $inc: { version: 1 } }
  );
  return { modified: result.modifiedCount > 0 };
}

export async function softDeleteTask(
  taskId: string,
  session?: ClientSession
): Promise<{ modified: boolean }> {
  const db = await getDb();
  const result = await db.collection("tasks").updateOne(
    { ...idFilter(taskId), deletedAt: null },
    { $set: { deletedAt: new Date(), updatedAt: new Date() } },
    { session }
  );
  return { modified: result.modifiedCount > 0 };
}

export async function bulkAssignSprint(
  taskIds: string[],
  sprintId: string,
  deadline: Date,
  session?: ClientSession
): Promise<number> {
  const db = await getDb();
  const result = await db.collection("tasks").updateMany(
    { _id: { $in: taskIds.flatMap(idCandidates) } as never, deletedAt: null },
    {
      $set: {
        sprintId: toDatabaseId(sprintId),
        deadline,
        updatedAt: new Date(),
      },
      $inc: { version: 1 },
    },
    { session }
  );
  return result.modifiedCount;
}

export async function getCarryOverCandidates(
  sprintId: string
): Promise<Task[]> {
  const db = await getDb();
  const docs = await db
    .collection("tasks")
    .find({
      sprintId: { $in: idCandidates(sprintId) },
      status: { $in: ["TODO", "IN_PROGRESS"] },
      deletedAt: null,
    })
    .toArray();
  return (docs as unknown) as Task[];
}

export async function getActiveMemberTaskCounts(
  sprintId: string
): Promise<Map<string, number>> {
  const db = await getDb();
  const pipeline = [
    {
      $match: {
        sprintId: { $in: idCandidates(sprintId) },
        status: { $in: ["TODO", "IN_PROGRESS"] },
        deletedAt: null,
      },
    },
    { $unwind: "$assigneeIds" },
    { $group: { _id: "$assigneeIds", count: { $sum: 1 } } },
  ];

  const results = await db
    .collection("tasks")
    .aggregate(pipeline)
    .toArray();

  const map = new Map<string, number>();
  for (const r of results) {
    map.set(r._id.toString(), r.count);
  }
  return map;
}

export async function getBoardStats(
  sprintId: string
): Promise<{ todo: number; inProgress: number; done: number; overdue: number }> {
  const db = await getDb();
  const pipeline = [
    {
      $match: {
        sprintId: { $in: idCandidates(sprintId) },
        deletedAt: null,
      },
    },
    {
      $group: {
        _id: "$status",
        count: { $sum: 1 },
      },
    },
  ];

  const results = await db
    .collection("tasks")
    .aggregate(pipeline)
    .toArray();

  const counts: Record<string, number> = {};
  for (const r of results) {
    counts[r._id] = r.count;
  }

  const overdueCount = await db.collection("tasks").countDocuments({
    sprintId: { $in: idCandidates(sprintId) },
    status: { $in: ["TODO", "IN_PROGRESS"] },
    deadline: { $lt: new Date() },
    deletedAt: null,
  });

  return {
    todo: counts["TODO"] ?? 0,
    inProgress: counts["IN_PROGRESS"] ?? 0,
    done: counts["DONE"] ?? 0,
    overdue: overdueCount,
  };
}

/** Sprint-free global stats across all board tasks. */
export async function getGlobalBoardStats(): Promise<{
  todo: number;
  inProgress: number;
  done: number;
  overdue: number;
  backlog: number;
}> {
  const db = await getDb();
  const pipeline = [
    { $match: { deletedAt: null } },
    { $group: { _id: "$status", count: { $sum: 1 } } },
  ];
  const results = await db.collection("tasks").aggregate(pipeline).toArray();
  const counts: Record<string, number> = {};
  for (const r of results) counts[r._id] = r.count;

  const overdueCount = await db.collection("tasks").countDocuments({
    status: { $in: ["TODO", "IN_PROGRESS"] },
    deadline: { $lt: new Date() },
    deletedAt: null,
  });

  return {
    todo: counts["TODO"] ?? 0,
    inProgress: counts["IN_PROGRESS"] ?? 0,
    done: counts["DONE"] ?? 0,
    overdue: overdueCount,
    backlog: counts["BACKLOG"] ?? 0,
  };
}
