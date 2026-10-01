import {
  createFeedbackCycle,
  getFeedbackCycleById,
  getAllFeedbackCycles,
  updateCycleReviewers,
  updateCycleStatus,
  getOrCreateResponse,
  saveFeedbackResponse,
  getResponsesForCycle,
  getCompletedReviewerIds,
} from "@/server/repositories/feedback.repository";
import { logAudit } from "@/server/services/audit.service";
import { dispatchN8nEvent } from "@/lib/n8n/client";
import type { FeedbackCycle, FeedbackResponse, FeedbackStatus, AIMDevelopmentArea } from "@/types";

export async function startFeedbackCycle(params: {
  recipientId: string;
  actorId?: string | null;
  actorName?: string | null;
}) {
  const cycle = await createFeedbackCycle(params.recipientId, params.actorId ?? null);

  await logAudit({
    entityType: "feedback",
    entityId: cycle._id.toString(),
    actorId: params.actorId,
    actorName: params.actorName,
    action: "feedback.cycle_created",
    metadata: { recipientId: params.recipientId },
  });

  return cycle;
}

export async function setCycleReviewers(params: {
  cycleId: string;
  reviewerIds: string[];
  actorId?: string | null;
  actorName?: string | null;
}) {
  if (params.reviewerIds.length !== 5) {
    throw new Error("Exactly 5 reviewers are required.");
  }

  await updateCycleReviewers(params.cycleId, params.reviewerIds);

  await logAudit({
    entityType: "feedback",
    entityId: params.cycleId,
    actorId: params.actorId,
    actorName: params.actorName,
    action: "feedback.reviewers_selected",
    metadata: { reviewerIds: params.reviewerIds },
  });

  // Notify reviewers asynchronously via n8n
  await dispatchN8nEvent("feedback.cycle_started", {
    cycleId: params.cycleId,
    reviewerIds: params.reviewerIds,
  });

  return { success: true };
}

export async function autosaveResponse(params: {
  cycleId: string;
  reviewerId: string;
  effectivenessRating?: number | null;
  cultureRating?: number | null;
  strengths?: string[];
  developmentAreas?: AIMDevelopmentArea[];
  impactNarrative?: string | null;
  additionalComments?: string | null;
}) {
  await saveFeedbackResponse(params.cycleId, params.reviewerId, {
    effectivenessRating: params.effectivenessRating ?? null,
    cultureRating: params.cultureRating ?? null,
    strengths: params.strengths ?? [],
    developmentAreas: params.developmentAreas ?? [],
    impactNarrative: params.impactNarrative ?? null,
    additionalComments: params.additionalComments ?? null,
  });

  return { success: true, savedAt: new Date().toISOString() };
}

export async function submitResponse(params: {
  cycleId: string;
  reviewerId: string;
  actorName?: string | null;
}) {
  await saveFeedbackResponse(params.cycleId, params.reviewerId, {
    completed: true,
  });

  await logAudit({
    entityType: "feedback",
    entityId: params.cycleId,
    actorId: params.reviewerId,
    actorName: params.actorName,
    action: "feedback.response_submitted",
    metadata: { reviewerId: params.reviewerId },
  });

  // Check if all 5 reviewers completed
  const cycle = await getFeedbackCycleById(params.cycleId);
  if (cycle) {
    const completedIds = await getCompletedReviewerIds(params.cycleId);
    const allCompleted =
      cycle.reviewerIds.length === 5 &&
      cycle.reviewerIds.every((id) => completedIds.includes(id));

    if (allCompleted) {
      await updateCycleStatus(params.cycleId, "COMPLETED");

      await dispatchN8nEvent("feedback.completed", {
        cycleId: params.cycleId,
        recipientId: cycle.recipientId,
      });
    }
  }

  return { success: true };
}

export async function finalizeCycle(params: {
  cycleId: string;
  actorId?: string | null;
  actorName?: string | null;
}) {
  const cycle = await getFeedbackCycleById(params.cycleId);
  if (!cycle) throw new Error("Cycle not found");

  const completedIds = await getCompletedReviewerIds(params.cycleId);
  if (completedIds.length < 5) {
    throw new Error("Cannot finalize until all 5 reviewers have submitted.");
  }

  await updateCycleStatus(params.cycleId, "FINALIZED", {
    finalizedAt: new Date(),
  });

  await logAudit({
    entityType: "feedback",
    entityId: params.cycleId,
    actorId: params.actorId,
    actorName: params.actorName,
    action: "feedback.finalized",
    metadata: { recipientId: cycle.recipientId },
  });

  await dispatchN8nEvent("feedback.finalized", {
    cycleId: params.cycleId,
    recipientId: cycle.recipientId,
  });

  return { success: true };
}
