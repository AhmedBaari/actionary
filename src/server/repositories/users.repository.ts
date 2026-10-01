import { ObjectId } from "mongodb";
import { getDb } from "@/lib/db/client";
import type { User, UserRole, AllowedUser } from "@/types";

export async function getUserById(id: string): Promise<User | null> {
  if (!id) return null;
  const db = await getDb();
  const query = ObjectId.isValid(id) ? { _id: new ObjectId(id) } : { _id: id };
  const doc = await db
    .collection("user")
    .findOne(query as any);
  return (doc as unknown) as User | null;
}

export async function getUserByEmail(email: string): Promise<User | null> {
  const db = await getDb();
  const doc = await db
    .collection("user")
    .findOne({ email: email.toLowerCase().trim() });
  return (doc as unknown) as User | null;
}

export async function getAllUsers(): Promise<User[]> {
  const db = await getDb();
  const docs = await db
    .collection("user")
    .find({ active: { $ne: false } })
    .sort({ name: 1 })
    .toArray();
  return (docs as unknown) as User[];
}

export async function getUsersByIds(ids: string[]): Promise<User[]> {
  if (ids.length === 0) return [];
  const db = await getDb();
  const docs = await db
    .collection("user")
    .find({ _id: { $in: ids.map((id) => new ObjectId(id)) } })
    .toArray();
  return (docs as unknown) as User[];
}

export async function updateUserRole(
  userId: string,
  role: UserRole
): Promise<void> {
  const db = await getDb();
  await db
    .collection("user")
    .updateOne({ _id: new ObjectId(userId) }, { $set: { role, updatedAt: new Date() } });
}

export async function getAllowedUsers(): Promise<AllowedUser[]> {
  const db = await getDb();
  const docs = await db
    .collection("allowedUsers")
    .find({})
    .sort({ email: 1 })
    .toArray();
  return (docs as unknown) as AllowedUser[];
}

export async function addAllowedUser(
  email: string,
  role: UserRole,
  createdBy: string | null
): Promise<AllowedUser> {
  const db = await getDb();
  const now = new Date();
  const entry = {
    email: email.toLowerCase().trim(),
    role,
    active: true,
    createdAt: now,
    createdBy,
  };
  const result = await db.collection("allowedUsers").insertOne(entry as any);
  return ({ ...entry, _id: result.insertedId.toString() } as unknown) as AllowedUser;
}

export async function deactivateAllowedUser(email: string): Promise<void> {
  const db = await getDb();
  await db
    .collection("allowedUsers")
    .updateOne(
      { email: email.toLowerCase().trim() },
      { $set: { active: false } }
    );
}
