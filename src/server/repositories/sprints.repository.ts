import { ClientSession } from "mongodb";
import { getDb } from "@/lib/db/client";
import { idFilter } from "@/lib/db/ids";
import type { Sprint, SprintStatus } from "@/types";

export async function getActiveSprint(): Promise<Sprint | null> {
  const db = await getDb();
  const doc = await db
    .collection("sprints")
    .findOne({ status: "ACTIVE" }, { sort: { number: -1, sprintNumber: -1 } });
  return (doc as unknown) as Sprint | null;
}

export async function getSprintById(id: string): Promise<Sprint | null> {
  const db = await getDb();
  const doc = await db
    .collection("sprints")
    .findOne(idFilter(id));
  return (doc as unknown) as Sprint | null;
}

export async function getLatestSprintNumber(): Promise<number> {
  const db = await getDb();
  const last = await db
    .collection("sprints")
    .findOne({}, { sort: { number: -1, sprintNumber: -1 }, projection: { number: 1, sprintNumber: 1 } });
  return last?.number ?? last?.sprintNumber ?? 0;
}

export async function createSprint(
  data: Omit<Sprint, "_id" | "createdAt" | "completedAt">,
  session?: ClientSession
): Promise<Sprint> {
  const db = await getDb();
  const now = new Date();
  const sprint: Omit<Sprint, "_id"> = {
    ...data,
    createdAt: now,
    completedAt: null,
  };
  const result = await db
    .collection("sprints")
    .insertOne(sprint as any, { session });
  return ({ ...sprint, _id: result.insertedId.toString() } as unknown) as Sprint;
}

export async function updateSprintStatus(
  sprintId: string,
  status: SprintStatus,
  additionalFields: Partial<Sprint> = {},
  session?: ClientSession
): Promise<{ modified: boolean }> {
  const db = await getDb();
  const result = await db.collection("sprints").updateOne(
    idFilter(sprintId),
    { $set: { status, ...additionalFields } },
    { session }
  );
  return { modified: result.modifiedCount > 0 };
}

export async function getSprintHistory(limit = 20): Promise<Sprint[]> {
  const db = await getDb();
  const docs = await db
    .collection("sprints")
    .find({ status: { $in: ["ACTIVE", "COMPLETED"] } })
    .sort({ number: -1 })
    .limit(limit)
    .toArray();
  return (docs as unknown) as Sprint[];
}
