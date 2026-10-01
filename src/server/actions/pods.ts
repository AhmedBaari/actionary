"use server";

import { revalidatePath } from "next/cache";
import {
  updatePod,
  createPod,
  addMemberToPod,
  removeMemberFromPod,
  getPodById,
} from "@/server/repositories/pods.repository";
import { logAudit } from "@/server/services/audit.service";

export async function actionUpdatePod(params: {
  podId: string;
  name?: string;
  leadId?: string | null;
  memberIds?: string[];
}) {
  try {
    const pod = await getPodById(params.podId);
    if (!pod) throw new Error("Pod not found");

    await updatePod(params.podId, {
      ...(params.name ? { name: params.name } : {}),
      ...(params.leadId !== undefined ? { leadId: params.leadId } : {}),
      ...(params.memberIds ? { memberIds: params.memberIds } : {}),
    });

    await logAudit({
      entityType: "pod",
      entityId: params.podId,
      actorName: "SastraNet Lead",
      action: "pod.updated",
      metadata: { podName: params.name ?? pod.name },
    });

    revalidatePath("/pods");
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message || "Failed to update pod" };
  }
}

export async function actionMoveMember(params: {
  fromPodId?: string;
  toPodId: string;
  userId: string;
  userName: string;
}) {
  try {
    if (params.fromPodId) {
      await removeMemberFromPod(params.fromPodId, params.userId);
    }
    await addMemberToPod(params.toPodId, params.userId);

    await logAudit({
      entityType: "pod",
      entityId: params.toPodId,
      actorName: "SastraNet Lead",
      action: "pod.member_moved",
      metadata: {
        userId: params.userId,
        userName: params.userName,
        fromPodId: params.fromPodId,
        toPodId: params.toPodId,
      },
    });

    revalidatePath("/pods");
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message || "Failed to move member" };
  }
}
