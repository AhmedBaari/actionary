import { ObjectId, ClientSession } from "mongodb";
import { getDb } from "@/lib/db/client";
import type { AuditEvent, AuditAction } from "@/types";

export async function createAuditEvent(
  data: {
    entityType: AuditEvent["entityType"];
    entityId: string;
    actorId: string | null;
    actorName: string | null;
    action: AuditAction;
    metadata?: Record<string, unknown>;
  },
  session?: ClientSession
): Promise<void> {
  const db = await getDb();
  await db.collection("auditEvents").insertOne(
    {
      entityType: data.entityType,
      entityId: data.entityId,
      actorId: data.actorId,
      actorName: data.actorName,
      action: data.action,
      metadata: data.metadata ?? {},
      createdAt: new Date(),
    },
    { session }
  );
}

export async function getAuditEventsForEntity(
  entityType: string,
  entityId: string,
  limit = 50
): Promise<AuditEvent[]> {
  const db = await getDb();
  const docs = await db
    .collection("auditEvents")
    .find({ entityType, entityId })
    .sort({ createdAt: -1 })
    .limit(limit)
    .toArray();
  return (docs as unknown) as AuditEvent[];
}

export async function getRecentAuditEvents(limit = 100): Promise<AuditEvent[]> {
  const db = await getDb();
  const docs = await db
    .collection("auditEvents")
    .find({})
    .sort({ createdAt: -1 })
    .limit(limit)
    .toArray();
  return (docs as unknown) as AuditEvent[];
}

export async function bulkCreateAuditEvents(
  events: Array<{
    entityType: AuditEvent["entityType"];
    entityId: string;
    actorId: string | null;
    actorName: string | null;
    action: AuditAction;
    metadata?: Record<string, unknown>;
  }>,
  session?: ClientSession
): Promise<void> {
  if (events.length === 0) return;
  const db = await getDb();
  const now = new Date();
  await db.collection("auditEvents").insertMany(
    events.map((e) => ({
      entityType: e.entityType,
      entityId: e.entityId,
      actorId: e.actorId,
      actorName: e.actorName,
      action: e.action,
      metadata: e.metadata ?? {},
      createdAt: now,
    })),
    { session }
  );
}
