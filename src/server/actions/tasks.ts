"use server";

import { revalidatePath } from "next/cache";
import {
  createNewTask,
  changeTaskStatus,
  moveTaskToSprint,
  toggleTaskChecklistItem,
  removeTask,
  updateTaskDetailsWithAudit,
} from "@/server/services/task.service";
import type { TaskSeverity, TaskStatus, ChecklistItem } from "@/types";
import { auditActor, requireCurrentUser } from "@/lib/auth/session";
import { getEntityAuditStream } from "@/server/services/audit.service";

export async function actionCreateTask(formData: {
  title: string;
  description?: string;
  severity: TaskSeverity;
  destination?: "BOARD" | "BACKLOG";
  primaryOwnerId?: string | null;
  assigneeIds?: string[];
  deadline?: string | null;
  checklist?: ChecklistItem[];
}) {
  try {
    const actor = auditActor(await requireCurrentUser());
    const task = await createNewTask({
      title: formData.title,
      description: formData.description,
      severity: formData.severity,
      destination: formData.destination ?? "BOARD",
      primaryOwnerId: formData.primaryOwnerId,
      assigneeIds: formData.assigneeIds,
      deadline: formData.deadline ? new Date(formData.deadline) : null,
      checklist: formData.checklist,
      ...actor,
    });

    revalidatePath("/");
    return { success: true, task };
  } catch (error: any) {
    return { success: false, error: error.message || "Failed to create task" };
  }
}

export async function actionUpdateTaskStatus(params: {
  taskId: string;
  newStatus: TaskStatus;
  expectedVersion?: number;
}) {
  try {
    const actor = auditActor(await requireCurrentUser());
    const res = await changeTaskStatus({
      taskId: params.taskId,
      newStatus: params.newStatus,
      expectedVersion: params.expectedVersion,
      ...actor,
    });

    revalidatePath("/");
    return res;
  } catch (error: any) {
    return { success: false, error: error.message || "Failed to update task status" };
  }
}

/** @deprecated Sprint scheduling removed — this is a no-op stub kept for import compatibility. */
export async function actionMoveTaskToSprint(_params: {
  taskId: string;
  sprintId: string;
  sprintEndDate: string;
}): Promise<{ success: boolean; error?: string }> {
  return { success: false, error: "Sprint scheduling has been removed." };
}

export async function actionToggleChecklist(params: {
  taskId: string;
  itemId: string;
}): Promise<{ success: boolean; checklist?: ChecklistItem[]; error?: string }> {
  try {
    const actor = auditActor(await requireCurrentUser());
    const res = await toggleTaskChecklistItem({
      taskId: params.taskId,
      itemId: params.itemId,
      ...actor,
    });

    revalidatePath("/");
    return res;
  } catch (error: any) {
    return { success: false, error: error.message || "Failed to toggle checklist" };
  }
}

export async function actionDeleteTask(taskId: string): Promise<{ success: boolean; error?: string }> {
  try {
    const actor = auditActor(await requireCurrentUser());
    const res = await removeTask({
      taskId,
      ...actor,
    });

    revalidatePath("/");
    return res;
  } catch (error: any) {
    return { success: false, error: error.message || "Failed to delete task" };
  }
}

export async function actionUpdateTaskDetails(params: {
  taskId: string;
  fields: {
    title?: string;
    description?: string;
    severity?: TaskSeverity;
    primaryOwnerId?: string | null;
    assigneeIds?: string[];
    deadline?: string | null;
    checklist?: ChecklistItem[];
  };
}) {
  try {
    const actor = auditActor(await requireCurrentUser());
    const result = await updateTaskDetailsWithAudit({
      taskId: params.taskId,
      fields: {
        ...params.fields,
        deadline: params.fields.deadline === undefined ? undefined : params.fields.deadline ? new Date(params.fields.deadline) : null,
      },
      ...actor,
    });
    if (!result.success) return result;
    revalidatePath("/");
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message || "Failed to update task details" };
  }
}

export async function actionGetTaskAudit(taskId: string) {
  await requireCurrentUser();
  return getEntityAuditStream("task", taskId);
}
