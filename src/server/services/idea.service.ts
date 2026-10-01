import {
  createIdea,
  getIdeaById,
  updateIdeaStatus,
  deleteIdea,
} from "@/server/repositories/ideas.repository";
import { createNewTask } from "@/server/services/task.service";
import { logAudit } from "@/server/services/audit.service";
import type { Idea, TaskSeverity } from "@/types";

export async function captureIdea(params: {
  title: string;
  description?: string | null;
  actorId?: string | null;
  actorName?: string | null;
}) {
  const idea = await createIdea(
    params.title.trim(),
    params.description ?? null,
    params.actorId ?? null
  );

  await logAudit({
    entityType: "idea",
    entityId: idea._id.toString(),
    actorId: params.actorId,
    actorName: params.actorName,
    action: "idea.created",
    metadata: { title: idea.title },
  });

  return {
    id: idea._id.toString(),
    title: idea.title,
    description: idea.description,
    status: idea.status,
    promotedTaskId: null,
    createdBy: params.actorId ?? null,
    createdAt: idea.createdAt.toISOString(),
    updatedAt: idea.updatedAt.toISOString(),
  };
}

export async function promoteIdeaToTask(params: {
  ideaId: string;
  severity?: TaskSeverity;
  sprintId?: string | null;
  actorId?: string | null;
  actorName?: string | null;
}) {
  const idea = await getIdeaById(params.ideaId);
  if (!idea) return { success: false, error: "Idea not found" };

  const task = await createNewTask({
    title: idea.title,
    description: idea.description,
    severity: params.severity ?? "RANDOM_IDEA",
    sourceIdeaId: params.ideaId,
    actorId: params.actorId,
    actorName: params.actorName,
  });

  await updateIdeaStatus(params.ideaId, "PROMOTED", {
    promotedTaskId: task.id,
  });

  await logAudit({
    entityType: "idea",
    entityId: params.ideaId,
    actorId: params.actorId,
    actorName: params.actorName,
    action: "idea.promoted",
    metadata: {
      taskId: task.id,
      displayNumber: task.displayNumber,
    },
  });

  return { success: true, task };
}

export async function removeIdea(params: {
  ideaId: string;
  actorId?: string | null;
  actorName?: string | null;
}) {
  const idea = await getIdeaById(params.ideaId);
  if (!idea) return { success: false };

  await deleteIdea(params.ideaId);

  await logAudit({
    entityType: "idea",
    entityId: params.ideaId,
    actorId: params.actorId,
    actorName: params.actorName,
    action: "idea.deleted",
    metadata: { title: idea.title },
  });

  return { success: true };
}
