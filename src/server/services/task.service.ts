import {
  createTask,
  getTaskById,
  updateTaskStatus,
  updateTaskFields,
  updateTaskChecklist,
  softDeleteTask,
} from "@/server/repositories/tasks.repository";
import { logAudit } from "@/server/services/audit.service";
import { serializeTask } from "@/lib/domain";
import type { TaskSeverity, TaskStatus, ChecklistItem, TaskView } from "@/types";
import { toDatabaseId } from "@/lib/db/ids";

export async function createNewTask(params: {
  title: string;
  description?: string | null;
  severity: TaskSeverity;
  /** "BACKLOG" destination = parked; anything else = active TODO in the board */
  destination?: "BOARD" | "BACKLOG";
  primaryOwnerId?: string | null;
  assigneeIds?: string[];
  deadline?: Date | null;
  checklist?: ChecklistItem[];
  sourceIdeaId?: string | null;
  actorId?: string | null;
  actorName?: string | null;
}): Promise<TaskView> {
  const status: TaskStatus =
    params.destination === "BACKLOG" ? "BACKLOG" : "TODO";

  const task = await createTask({
    title: params.title.trim(),
    description: params.description ?? null,
    status,
    severity: params.severity,
    sprintId: null,
    createdFrom: status === "BACKLOG" ? "BACKLOG" : "SPRINT",
    createdBy: params.actorId ?? null,
    primaryOwnerId: params.primaryOwnerId ?? null,
    assigneeIds: params.assigneeIds ?? [],
    checklist: params.checklist ?? [],
    deadline: params.deadline ?? null,
    completedAt: null,
    completedSprintId: null,
    pivotReason: null,
    sourceIdeaId: params.sourceIdeaId ?? null,
    deletedAt: null,
  });

  await logAudit({
    entityType: "task",
    entityId: task._id.toString(),
    actorId: params.actorId,
    actorName: params.actorName,
    action: "task.created",
    metadata: {
      displayNumber: task.displayNumber,
      title: task.title,
      severity: task.severity,
      status: task.status,
    },
  });

  return serializeTask(task);
}

export async function changeTaskStatus(params: {
  taskId: string;
  newStatus: TaskStatus;
  actorId?: string | null;
  actorName?: string | null;
  expectedVersion?: number;
}): Promise<{ success: boolean; error?: string }> {
  const task = await getTaskById(params.taskId);
  if (!task) return { success: false, error: "Task not found" };

  const oldStatus = task.status;
  if (oldStatus === params.newStatus) return { success: true };

  const additionalFields: Record<string, unknown> = {};

  if (params.newStatus === "DONE") {
    additionalFields.completedAt = new Date();
  } else if (oldStatus === "DONE") {
    additionalFields.completedAt = null;
    additionalFields.completedSprintId = null;
  }

  const result = await updateTaskStatus(
    params.taskId,
    params.newStatus,
    additionalFields,
    params.expectedVersion
  );

  if (!result.modified) {
    return { success: false, error: "Concurrent modification. Please reload." };
  }

  await logAudit({
    entityType: "task",
    entityId: params.taskId,
    actorId: params.actorId,
    actorName: params.actorName,
    action: "task.status_changed",
    metadata: {
      displayNumber: task.displayNumber,
      fromStatus: oldStatus,
      toStatus: params.newStatus,
    },
  });

  return { success: true };
}

export async function moveTaskToSprint(params: {
  taskId: string;
  sprintId: string;
  sprintEndDate: Date;
  actorId?: string | null;
  actorName?: string | null;
}): Promise<{ success: boolean }> {
  const task = await getTaskById(params.taskId);
  if (!task) return { success: false };

  // When moving to sprint, deadline defaults to sprint end date
  const update = await updateTaskFields(params.taskId, {
    sprintId: toDatabaseId(params.sprintId) as never,
    deadline: params.sprintEndDate,
  } as never);

  if (!update.modified) return { success: false };

  const statusUpdate = await updateTaskStatus(params.taskId, "TODO");
  if (!statusUpdate.modified && task.status !== "TODO") return { success: false };

  await logAudit({
    entityType: "task",
    entityId: params.taskId,
    actorId: params.actorId,
    actorName: params.actorName,
    action: "task.moved_to_sprint",
    metadata: {
      displayNumber: task.displayNumber,
      sprintId: params.sprintId,
    },
  });

  return { success: true };
}

export async function toggleTaskChecklistItem(params: {
  taskId: string;
  itemId: string;
  actorId?: string | null;
  actorName?: string | null;
}): Promise<{ success: boolean; checklist: ChecklistItem[] }> {
  const task = await getTaskById(params.taskId);
  if (!task) return { success: false, checklist: [] };

  const updatedChecklist = task.checklist.map((item) =>
    item.id === params.itemId ? { ...item, done: !item.done } : item
  );

  await updateTaskChecklist(params.taskId, updatedChecklist);

  // Lightweight audit only if meaningful
  return { success: true, checklist: updatedChecklist };
}

export async function updateTaskDetailsWithAudit(params: {
  taskId: string;
  fields: {
    title?: string;
    description?: string;
    severity?: TaskSeverity;
    primaryOwnerId?: string | null;
    assigneeIds?: string[];
    deadline?: Date | null;
  };
  actorId?: string | null;
  actorName?: string | null;
}): Promise<{ success: boolean; error?: string }> {
  const task = await getTaskById(params.taskId);
  if (!task) return { success: false, error: "Task not found" };

  const fields = { ...params.fields };
  if (fields.title !== undefined) fields.title = fields.title.trim();
  if (fields.title !== undefined && !fields.title) return { success: false, error: "A task needs a title" };
  if (fields.primaryOwnerId !== undefined && fields.assigneeIds === undefined) {
    fields.assigneeIds = fields.primaryOwnerId ? [fields.primaryOwnerId] : [];
  }

  const updated = await updateTaskFields(params.taskId, fields);
  if (!updated.modified) return { success: false, error: "Task could not be updated" };

  const metadata = { displayNumber: task.displayNumber };
  const events: Array<{ action: Parameters<typeof logAudit>[0]["action"]; metadata: Record<string, unknown> }> = [];
  if (fields.title !== undefined && fields.title !== task.title) {
    events.push({ action: "task.title_changed", metadata: { ...metadata, from: task.title, to: fields.title } });
  }
  if (fields.description !== undefined && fields.description !== (task.description ?? "")) {
    events.push({ action: "task.description_changed", metadata });
  }
  if (fields.severity !== undefined && fields.severity !== task.severity) {
    events.push({ action: "task.severity_changed", metadata: { ...metadata, from: task.severity, to: fields.severity } });
  }
  if (fields.primaryOwnerId !== undefined && fields.primaryOwnerId !== task.primaryOwnerId) {
    events.push({ action: "task.owner_changed", metadata: { ...metadata, fromOwnerId: task.primaryOwnerId, toOwnerId: fields.primaryOwnerId } });
  }
  if (fields.deadline !== undefined && (fields.deadline?.getTime() ?? null) !== (task.deadline?.getTime() ?? null)) {
    events.push({ action: "task.deadline_changed", metadata: { ...metadata, from: task.deadline?.toISOString() ?? null, to: fields.deadline?.toISOString() ?? null } });
  }
  await Promise.all(events.map(({ action, metadata: eventMetadata }) => logAudit({
    entityType: "task", entityId: params.taskId, actorId: params.actorId,
    actorName: params.actorName, action, metadata: eventMetadata,
  })));
  return { success: true };
}

export async function removeTask(params: {
  taskId: string;
  actorId?: string | null;
  actorName?: string | null;
}): Promise<{ success: boolean }> {
  const task = await getTaskById(params.taskId);
  if (!task) return { success: false };

  await softDeleteTask(params.taskId);

  await logAudit({
    entityType: "task",
    entityId: params.taskId,
    actorId: params.actorId,
    actorName: params.actorName,
    action: "task.deleted",
    metadata: {
      displayNumber: task.displayNumber,
      title: task.title,
    },
  });

  return { success: true };
}
