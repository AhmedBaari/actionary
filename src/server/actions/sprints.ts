"use server";

import { revalidatePath } from "next/cache";
import { carryOverSprint } from "@/server/services/sprint.service";
import { getActiveSprint } from "@/server/repositories/sprints.repository";
import { auditActor, requireCurrentUser } from "@/lib/auth/session";
import { canManageSprint } from "@/lib/domain";

export async function actionCarryOverSprint() {
  try {
    const user = await requireCurrentUser();
    if (!canManageSprint({
      id: user._id.toString(), email: user.email, name: user.name, role: user.role,
      podId: user.podId, avatarUrl: user.avatarUrl, active: user.active,
    })) {
      return { success: false, error: "Only leads can carry over a sprint." };
    }
    const sprint = await getActiveSprint();
    if (!sprint) {
      return { success: false, error: "No active sprint found to carry over" };
    }

    const actor = auditActor(user);
    const result = await carryOverSprint(sprint._id.toString(), actor.actorId, actor.actorName);
    revalidatePath("/");
    return {
      success: true,
      newSprintId: result.newSprintId,
      carriedCount: result.carriedCount,
    };
  } catch (error: any) {
    return { success: false, error: error.message || "Failed to carry over sprint" };
  }
}

export async function actionGetActiveSprint() {
  await requireCurrentUser();
  const sprint = await getActiveSprint();
  if (!sprint) return null;
  return {
    id: sprint._id.toString(),
    name: sprint.name,
    startDate: sprint.startDate.toISOString(),
    endDate: sprint.endDate.toISOString(),
    status: sprint.status,
    sprintNumber: sprint.sprintNumber,
  };
}
