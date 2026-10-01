"use server";

import { revalidatePath } from "next/cache";
import {
  captureIdea,
  promoteIdeaToTask,
  removeIdea,
} from "@/server/services/idea.service";
import type { TaskSeverity, TaskView } from "@/types";
import { auditActor, requireCurrentUser } from "@/lib/auth/session";

export async function actionCaptureIdea(params: {
  title: string;
  description?: string;
}) {
  try {
    const actor = auditActor(await requireCurrentUser());
    const idea = await captureIdea({
      title: params.title,
      description: params.description,
      ...actor,
    });
    revalidatePath("/ideas");
    revalidatePath("/");
    return { success: true, idea };
  } catch (error: any) {
    return { success: false, error: error.message || "Failed to capture idea" };
  }
}

export async function actionPromoteIdea(params: {
  ideaId: string;
  severity?: TaskSeverity;
  sprintId?: string | null;
}): Promise<{ success: boolean; task?: TaskView; error?: string }> {
  try {
    const actor = auditActor(await requireCurrentUser());
    const res = await promoteIdeaToTask({
      ideaId: params.ideaId,
      severity: params.severity,
      sprintId: params.sprintId,
      ...actor,
    });
    revalidatePath("/ideas");
    revalidatePath("/");
    return res;
  } catch (error: any) {
    return { success: false, error: error.message || "Failed to promote idea" };
  }
}

export async function actionDeleteIdea(ideaId: string): Promise<{ success: boolean; error?: string }> {
  try {
    const actor = auditActor(await requireCurrentUser());
    const res = await removeIdea({
      ideaId,
      ...actor,
    });
    revalidatePath("/ideas");
    return res;
  } catch (error: any) {
    return { success: false, error: error.message || "Failed to delete idea" };
  }
}
