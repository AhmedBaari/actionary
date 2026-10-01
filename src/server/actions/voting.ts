"use server";

import { revalidatePath } from "next/cache";
import { auditActor, requireCurrentUser } from "@/lib/auth/session";
import {
  cancelVoteService,
  castVoteService,
  closeVoteService,
  createVoteService,
  editVoteService,
  getLiveResultsService,
  verifyReceiptService,
} from "@/server/services/voting.service";
import type { ActionResult } from "@/types";
import type {
  ReceiptVerificationResult,
  VoteOption,
  VoteResultsSummary,
  VoteView,
  VotingMode,
} from "@/types/voting";

export async function actionCreateVote(formData: {
  title: string;
  description?: string | null;
  mode: VotingMode;
  options: Array<{ id?: string; text: string }>;
  duration?: string | null;
  closesAt?: string | null;
  customSlug?: string | null;
}): Promise<ActionResult<VoteView>> {
  try {
    const user = await requireCurrentUser();
    const actor = auditActor(user);

    const vote = await createVoteService({
      title: formData.title,
      description: formData.description,
      mode: formData.mode,
      options: formData.options,
      duration: formData.duration,
      closesAt: formData.closesAt,
      customSlug: formData.customSlug,
      actorId: actor.actorId,
      actorName: actor.actorName,
    });

    revalidatePath("/voting");
    return { success: true, data: vote };
  } catch (error: any) {
    return {
      success: false,
      error: error.message || "Failed to create vote.",
    };
  }
}

export async function actionCastVote(params: {
  voteIdOrSlug: string;
  payload: any;
  opinion?: string | null;
}): Promise<
  ActionResult<{
    receiptToken: string;
    voteSlug: string;
  }>
> {
  try {
    const user = await requireCurrentUser();

    const res = await castVoteService({
      voteIdOrSlug: params.voteIdOrSlug,
      memberId: user._id.toString(),
      payload: params.payload,
      opinion: params.opinion,
    });

    revalidatePath(`/voting/${res.voteSlug}`);
    revalidatePath("/voting");

    return {
      success: true,
      data: {
        receiptToken: res.receiptToken,
        voteSlug: res.voteSlug,
      },
    };
  } catch (error: any) {
    return {
      success: false,
      error: error.message || "Failed to submit ballot.",
    };
  }
}

export async function actionCloseVote(
  voteIdOrSlug: string
): Promise<ActionResult<void>> {
  try {
    const user = await requireCurrentUser();
    const actor = auditActor(user);

    await closeVoteService(
      voteIdOrSlug,
      "MANUAL",
      actor.actorId,
      actor.actorName
    );

    revalidatePath(`/voting/${voteIdOrSlug}`);
    revalidatePath("/voting");
    return { success: true, data: undefined };
  } catch (error: any) {
    return {
      success: false,
      error: error.message || "Failed to close vote.",
    };
  }
}

export async function actionCancelVote(
  voteIdOrSlug: string
): Promise<ActionResult<void>> {
  try {
    const user = await requireCurrentUser();
    const actor = auditActor(user);

    await cancelVoteService(
      voteIdOrSlug,
      actor.actorId,
      actor.actorName
    );

    revalidatePath(`/voting/${voteIdOrSlug}`);
    revalidatePath("/voting");
    return { success: true, data: undefined };
  } catch (error: any) {
    return {
      success: false,
      error: error.message || "Failed to cancel vote.",
    };
  }
}

export async function actionEditVote(params: {
  slugOrId: string;
  updates: {
    title?: string;
    description?: string | null;
    closesAt?: string | null;
    options?: Array<{ id?: string; text: string }>;
    mode?: VotingMode;
  };
}): Promise<ActionResult<VoteView>> {
  try {
    const user = await requireCurrentUser();
    const actor = auditActor(user);

    const vote = await editVoteService({
      slugOrId: params.slugOrId,
      updates: params.updates,
      actorId: actor.actorId,
      actorName: actor.actorName,
    });

    revalidatePath(`/voting/${vote.slug}`);
    revalidatePath("/voting");
    return { success: true, data: vote };
  } catch (error: any) {
    return {
      success: false,
      error: error.message || "Failed to update vote.",
    };
  }
}

export async function actionVerifyReceipt(params: {
  voteIdOrSlug: string;
  receiptToken: string;
}): Promise<ActionResult<ReceiptVerificationResult>> {
  try {
    await requireCurrentUser();

    const res = await verifyReceiptService(
      params.voteIdOrSlug,
      params.receiptToken
    );

    return { success: true, data: res };
  } catch (error: any) {
    return {
      success: false,
      error: error.message || "Failed to verify receipt.",
    };
  }
}

export async function actionGetLiveResults(
  voteIdOrSlug: string
): Promise<ActionResult<VoteResultsSummary | null>> {
  try {
    const user = await requireCurrentUser();
    const summary = await getLiveResultsService(
      voteIdOrSlug,
      user._id.toString()
    );
    return { success: true, data: summary };
  } catch (error: any) {
    return {
      success: false,
      error: error.message || "Failed to load results.",
    };
  }
}
