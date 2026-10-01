import { ObjectId } from "mongodb";
import { getDb } from "@/lib/db/client";
import type { Pod } from "@/types";

export async function getAllPods(): Promise<Pod[]> {
  const db = await getDb();
  const docs = await db.collection("pods").find({}).sort({ name: 1 }).toArray();
  return (docs as unknown) as Pod[];
}

export async function getPodById(id: string): Promise<Pod | null> {
  const db = await getDb();
  const doc = await db.collection("pods").findOne({ _id: new ObjectId(id) });
  return (doc as unknown) as Pod | null;
}

export async function createPod(
  name: string,
  leadId: string | null
): Promise<Pod> {
  const db = await getDb();
  const now = new Date();
  const pod = {
    name,
    leadId,
    memberIds: leadId ? [leadId] : [],
    createdAt: now,
    updatedAt: now,
  };
  const result = await db.collection("pods").insertOne(pod as any);
  return ({ ...pod, _id: result.insertedId.toString() } as unknown) as Pod;
}

export async function updatePod(
  podId: string,
  fields: Partial<Pick<Pod, "name" | "leadId" | "memberIds">>
): Promise<void> {
  const db = await getDb();
  await db.collection("pods").updateOne(
    { _id: new ObjectId(podId) },
    { $set: { ...fields, updatedAt: new Date() } }
  );
}

export async function addMemberToPod(
  podId: string,
  userId: string
): Promise<void> {
  const db = await getDb();
  await db.collection("pods").updateOne(
    { _id: new ObjectId(podId) },
    {
      $addToSet: { memberIds: userId as any },
      $set: { updatedAt: new Date() },
    }
  );
}

export async function removeMemberFromPod(
  podId: string,
  userId: string
): Promise<void> {
  const db = await getDb();
  await db.collection("pods").updateOne(
    { _id: new ObjectId(podId) },
    {
      $pull: { memberIds: userId as any },
      $set: { updatedAt: new Date() },
    }
  );
}

export async function getPodTaskStats(
  podId: string
): Promise<{ active: number; completed: number }> {
  const db = await getDb();
  const pod = await getPodById(podId);
  if (!pod) return { active: 0, completed: 0 };

  const active = await db.collection("tasks").countDocuments({
    assigneeIds: { $in: pod.memberIds },
    status: { $in: ["TODO", "IN_PROGRESS"] },
    deletedAt: null,
  });

  const completed = await db.collection("tasks").countDocuments({
    assigneeIds: { $in: pod.memberIds },
    status: "DONE",
    deletedAt: null,
  });

  return { active, completed };
}
