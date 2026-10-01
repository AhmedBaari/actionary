import { ObjectId, ClientSession } from "mongodb";
import { getDb } from "@/lib/db/client";
import type { FeedbackCycle, FeedbackResponse, FeedbackStatus } from "@/types";

export async function createFeedbackCycle(
  recipientId: string,
  createdBy: string | null
): Promise<FeedbackCycle> {
  const db = await getDb();
  const now = new Date();
  const cycle = {
    recipientId,
    reviewerIds: [],
    status: "SELECTING_REVIEWERS" as FeedbackStatus,
    createdBy,
    aiSummary: null,
    aiSummaryGeneratedAt: null,
    createdAt: now,
    finalizedAt: null,
  };
  const result = await db.collection("feedbackCycles").insertOne(cycle as any);
  return ({ ...cycle, _id: result.insertedId.toString() } as unknown) as FeedbackCycle;
}

export async function getFeedbackCycleById(
  id: string
): Promise<FeedbackCycle | null> {
  const db = await getDb();
  const doc = await db
    .collection("feedbackCycles")
    .findOne({ _id: new ObjectId(id) });
  return (doc as unknown) as FeedbackCycle | null;
}

export async function getAllFeedbackCycles(): Promise<FeedbackCycle[]> {
  const db = await getDb();
  const docs = await db
    .collection("feedbackCycles")
    .find({})
    .sort({ createdAt: -1 })
    .toArray();
  return (docs as unknown) as FeedbackCycle[];
}

export async function updateCycleReviewers(
  cycleId: string,
  reviewerIds: string[]
): Promise<void> {
  const db = await getDb();
  await db.collection("feedbackCycles").updateOne(
    { _id: new ObjectId(cycleId) },
    {
      $set: {
        reviewerIds,
        status: "IN_PROGRESS" as FeedbackStatus,
      },
    }
  );
}

export async function updateCycleStatus(
  cycleId: string,
  status: FeedbackStatus,
  additionalFields: Partial<FeedbackCycle> = {},
  session?: ClientSession
): Promise<void> {
  const db = await getDb();
  await db.collection("feedbackCycles").updateOne(
    { _id: new ObjectId(cycleId) },
    { $set: { status, ...additionalFields } },
    { session }
  );
}

// ─── Feedback Responses ──────────────────────────────────────

export async function getOrCreateResponse(
  cycleId: string,
  reviewerId: string
): Promise<FeedbackResponse> {
  const db = await getDb();
  const existing = await db.collection("feedbackResponses").findOne({
    cycleId,
    reviewerId,
  });

  if (existing) return (existing as unknown) as FeedbackResponse;

  const now = new Date();
  const response = {
    cycleId,
    reviewerId,
    effectivenessRating: null,
    cultureRating: null,
    strengths: [],
    developmentAreas: [],
    impactNarrative: null,
    additionalComments: null,
    completed: false,
    createdAt: now,
    updatedAt: now,
  };

  const result = await db.collection("feedbackResponses").insertOne(response as any);
  return ({ ...response, _id: result.insertedId.toString() } as unknown) as FeedbackResponse;
}

export async function saveFeedbackResponse(
  cycleId: string,
  reviewerId: string,
  fields: Partial<FeedbackResponse>
): Promise<void> {
  const db = await getDb();
  await db.collection("feedbackResponses").updateOne(
    { cycleId, reviewerId },
    { $set: { ...fields, updatedAt: new Date() } },
    { upsert: true }
  );
}

export async function getResponsesForCycle(
  cycleId: string
): Promise<FeedbackResponse[]> {
  const db = await getDb();
  const docs = await db
    .collection("feedbackResponses")
    .find({ cycleId })
    .toArray();
  return (docs as unknown) as FeedbackResponse[];
}

export async function getCompletedReviewerIds(
  cycleId: string
): Promise<string[]> {
  const db = await getDb();
  const docs = await db
    .collection("feedbackResponses")
    .find({ cycleId, completed: true }, { projection: { reviewerId: 1 } })
    .toArray();
  return docs.map((d) => d.reviewerId);
}
