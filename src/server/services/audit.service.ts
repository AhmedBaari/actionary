"use server";

import { createAuditEvent, getAuditEventsForEntity } from "@/server/repositories/audit.repository";
import type { AuditAction, AuditEventView } from "@/types";

export interface LogAuditParams {
  entityType: "task" | "idea" | "sprint" | "pod" | "feedback" | "user" | "allowlist" | "vote";
  entityId: string;
  actorId?: string | null;
  actorName?: string | null;
  action: AuditAction;
  metadata?: Record<string, unknown>;
}

export async function logAudit(params: LogAuditParams) {
  try {
    return await createAuditEvent({
      entityType: params.entityType,
      entityId: params.entityId,
      actorId: params.actorId ?? null,
      actorName: params.actorName ?? null,
      action: params.action,
      metadata: params.metadata ?? {},
    });
  } catch (error) {
    // Audit logging should never crash the primary user flow, but log error
    console.error("[AuditService] Failed to log audit event:", error);
    return null;
  }
}

export async function getEntityAuditStream(
  entityType: "task" | "idea" | "sprint" | "pod" | "feedback" | "user" | "allowlist" | "vote",
  entityId: string
): Promise<AuditEventView[]> {
  try {
    const events = await getAuditEventsForEntity(entityType, entityId);
    return events.map((event) => ({
      id: event._id.toString(),
      entityType: event.entityType,
      entityId: event.entityId.toString(),
      actorId: event.actorId?.toString() ?? null,
      actorName: event.actorName,
      action: event.action,
      metadata: event.metadata,
      createdAt: event.createdAt.toISOString(),
    }));
  } catch (error) {
    console.error("[AuditService] Failed to fetch audit stream:", error);
    return [];
  }
}
