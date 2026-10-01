import { ObjectId } from "mongodb";
import { getDb } from "@/lib/db/client";
import type { Idea, IdeaStatus } from "@/types";

export async function getActiveIdeas(): Promise<Idea[]> {
  const db = await getDb();
  const docs = await db
    .collection("ideas")
    .find({ status: "ACTIVE" })
    .sort({ createdAt: -1 })
    .toArray();
  return (docs as unknown) as Idea[];
}

export async function getIdeaById(id: string): Promise<Idea | null> {
  const db = await getDb();
  const doc = await db
    .collection("ideas")
    .findOne({ _id: new ObjectId(id) });
  return (doc as unknown) as Idea | null;
}

export async function createIdea(
  title: string,
  description: string | null,
  createdBy: string | null
): Promise<Idea> {
  const db = await getDb();
  const now = new Date();
  const idea = {
    title,
    description,
    status: "ACTIVE" as IdeaStatus,
    promotedTaskId: null,
    createdBy,
    createdAt: now,
    updatedAt: now,
  };
  const result = await db.collection("ideas").insertOne(idea as any);
  return ({ ...idea, _id: result.insertedId.toString() } as unknown) as Idea;
}

export async function updateIdeaStatus(
  ideaId: string,
  status: IdeaStatus,
  additionalFields: Partial<Idea> = {}
): Promise<void> {
  const db = await getDb();
  await db.collection("ideas").updateOne(
    { _id: new ObjectId(ideaId) },
    { $set: { status, updatedAt: new Date(), ...additionalFields } }
  );
}

export async function deleteIdea(ideaId: string): Promise<void> {
  const db = await getDb();
  await db.collection("ideas").updateOne(
    { _id: new ObjectId(ideaId) },
    { $set: { status: "ARCHIVED", updatedAt: new Date() } }
  );
}
