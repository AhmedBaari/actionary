"use server";

import { revalidatePath } from "next/cache";
import {
  startFeedbackCycle,
  setCycleReviewers,
  autosaveResponse,
  submitResponse,
  finalizeCycle,
} from "@/server/services/feedback.service";
import type { AIMDevelopmentArea } from "@/types";

export async function actionCreateFeedbackCycle(recipientId: string) {
  try {
    const cycle = await startFeedbackCycle({
      recipientId,
      actorName: "SastraNet Lead",
    });
    revalidatePath("/feedback");
    return { success: true, cycleId: cycle._id.toString() };
  } catch (error: any) {
    return { success: false, error: error.message || "Failed to create feedback cycle" };
  }
}

export async function actionSelectReviewers(params: {
  cycleId: string;
  reviewerIds: string[];
}): Promise<{ success: boolean; error?: string }> {
  try {
    const res = await setCycleReviewers({
      cycleId: params.cycleId,
      reviewerIds: params.reviewerIds,
      actorName: "SastraNet Lead",
    });
    revalidatePath(`/feedback/${params.cycleId}`);
    revalidatePath("/feedback");
    return res;
  } catch (error: any) {
    return { success: false, error: error.message || "Failed to select reviewers" };
  }
}

export async function actionAutosaveFeedback(params: {
  cycleId: string;
  reviewerId: string;
  effectivenessRating?: number | null;
  cultureRating?: number | null;
  strengths?: string[];
  developmentAreas?: AIMDevelopmentArea[];
  impactNarrative?: string | null;
  additionalComments?: string | null;
}) {
  try {
    return await autosaveResponse(params);
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function actionSubmitFeedback(params: {
  cycleId: string;
  reviewerId: string;
}): Promise<{ success: boolean; error?: string }> {
  try {
    const res = await submitResponse({
      cycleId: params.cycleId,
      reviewerId: params.reviewerId,
      actorName: "Reviewer",
    });
    revalidatePath(`/feedback/${params.cycleId}`);
    revalidatePath("/feedback");
    return res;
  } catch (error: any) {
    return { success: false, error: error.message || "Failed to submit feedback" };
  }
}

export async function actionFinalizeFeedback(cycleId: string): Promise<{ success: boolean; error?: string }> {
  try {
    const res = await finalizeCycle({
      cycleId,
      actorName: "SastraNet Lead",
    });
    revalidatePath(`/feedback/${cycleId}`);
    revalidatePath("/feedback");
    return res;
  } catch (error: any) {
    return { success: false, error: error.message || "Failed to finalize feedback" };
  }
}
