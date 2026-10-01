import { ObjectId } from "mongodb";
import { getDb } from "@/lib/db/client";
import { idCandidates, idFilter } from "@/lib/db/ids";
import type {
  AnonymousBallot,
  Vote,
  VoteCloseReason,
  VoteParticipation,
  VoteStatus,
} from "@/types/voting";

// ─── Votes Collection ─────────────────────────────────────────

export async function createVote(
  data: Omit<Vote, "_id" | "createdAt" | "updatedAt">
): Promise<Vote> {
  const db = await getDb();
  const now = new Date();
  const doc = {
    ...data,
    createdAt: now,
    updatedAt: now,
  };

  const res = await db.collection("votes").insertOne(doc);
  return {
    ...doc,
    _id: res.insertedId.toString(),
  } as Vote;
}

export async function getVoteById(id: string): Promise<Vote | null> {
  const db = await getDb();
  const doc = await db.collection("votes").findOne(idFilter(id));
  if (!doc) return null;
  return {
    ...doc,
    _id: doc._id.toString(),
  } as Vote;
}

export async function getVoteBySlug(slug: string): Promise<Vote | null> {
  const db = await getDb();
  const cleanSlug = slug.trim().toLowerCase();
  const doc = await db.collection("votes").findOne({
    $or: [{ slug: cleanSlug }, { _id: { $in: idCandidates(slug) as any } }],
  });
  if (!doc) return null;
  return {
    ...doc,
    _id: doc._id.toString(),
  } as Vote;
}

export async function listVotes(
  statusFilter?: "ALL" | "OPEN" | "CLOSED",
  search?: string
): Promise<Vote[]> {
  const db = await getDb();
  const query: any = {};

  if (statusFilter === "OPEN") {
    query.status = "OPEN";
  } else if (statusFilter === "CLOSED") {
    query.status = "CLOSED";
  }

  if (search && search.trim()) {
    const s = search.trim();
    query.$or = [
      { title: { $regex: s, $options: "i" } },
      { description: { $regex: s, $options: "i" } },
    ];
  }

  const docs = await db
    .collection("votes")
    .find(query)
    .sort({ createdAt: -1 })
    .toArray();

  return docs.map((doc) => ({
    ...doc,
    _id: doc._id.toString(),
  })) as Vote[];
}

export async function updateVoteStatus(
  voteId: string,
  status: VoteStatus,
  closeReason?: VoteCloseReason | null
): Promise<boolean> {
  const db = await getDb();
  const updateData: any = {
    status,
    updatedAt: new Date(),
  };
  if (closeReason !== undefined) {
    updateData.closeReason = closeReason;
  }

  const res = await db
    .collection("votes")
    .updateOne(idFilter(voteId), { $set: updateData });

  return res.modifiedCount > 0;
}

export async function updateVoteMetadata(
  voteId: string,
  updates: Partial<Pick<Vote, "title" | "description" | "closesAt" | "options" | "mode">>
): Promise<boolean> {
  const db = await getDb();
  const res = await db.collection("votes").updateOne(idFilter(voteId), {
    $set: {
      ...updates,
      updatedAt: new Date(),
    },
  });

  return res.modifiedCount > 0;
}

// ─── Participation Collection (Strictly Isolated) ─────────────

/**
 * Records that a member has participated in a vote.
 * CRITICAL PRIVACY BOUNDARY:
 * MUST NOT store ballotId, option, rankings, approvals, opinion, receiptHash.
 * Unique constraint on (voteId, memberId) guarantees 1 vote per member.
 */
export async function recordParticipation(
  voteId: string,
  memberId: string
): Promise<void> {
  const db = await getDb();
  try {
    await db.collection("voteParticipation").insertOne({
      voteId,
      memberId,
      votedAt: new Date(),
    });
  } catch (error: any) {
    if (error.code === 11000) {
      throw new Error("You have already voted in this vote.");
    }
    throw error;
  }
}

export async function hasMemberVoted(
  voteId: string,
  memberId: string
): Promise<boolean> {
  const db = await getDb();
  const count = await db.collection("voteParticipation").countDocuments({
    voteId,
    memberId,
  });
  return count > 0;
}

export async function getParticipationCount(voteId: string): Promise<number> {
  const db = await getDb();
  return await db.collection("voteParticipation").countDocuments({ voteId });
}

export async function getParticipatingMemberIds(
  voteId: string
): Promise<string[]> {
  const db = await getDb();
  const docs = await db
    .collection("voteParticipation")
    .find({ voteId }, { projection: { memberId: 1 } })
    .toArray();

  return docs.map((d) => d.memberId.toString());
}

// ─── Anonymous Ballots Collection (Strictly Isolated) ─────────

/**
 * Saves an anonymous ballot.
 * CRITICAL PRIVACY BOUNDARY:
 * - Uses random UUID _id (not ObjectId with timestamp encoding).
 * - Stores NO memberId, username, email, sessionId, or participationId.
 * - Stores SHA-256 receiptHash (never raw receipt token).
 */
export async function saveAnonymousBallot(
  ballot: AnonymousBallot
): Promise<void> {
  const db = await getDb();
  await db.collection("anonymousBallots").insertOne({
    _id: ballot._id as any,
    voteId: ballot.voteId,
    mode: ballot.mode,
    payload: ballot.payload,
    opinion: ballot.opinion ?? null,
    receiptHash: ballot.receiptHash,
  });
}

export async function getAnonymousBallotsByVoteId(
  voteId: string
): Promise<AnonymousBallot[]> {
  const db = await getDb();
  const docs = await db
    .collection("anonymousBallots")
    .find({ voteId })
    .sort({ _id: 1 }) // Sorted by random UUID to ensure deterministic, timestamp-free display
    .toArray();

  return docs.map((doc) => ({
    _id: doc._id.toString(),
    voteId: doc.voteId,
    mode: doc.mode,
    payload: doc.payload,
    opinion: doc.opinion,
    receiptHash: doc.receiptHash,
  }));
}

export async function getAnonymousBallotByReceiptHash(
  voteId: string,
  receiptHash: string
): Promise<AnonymousBallot | null> {
  const db = await getDb();
  const doc = await db.collection("anonymousBallots").findOne({
    voteId,
    receiptHash,
  });

  if (!doc) return null;
  return {
    _id: doc._id.toString(),
    voteId: doc.voteId,
    mode: doc.mode,
    payload: doc.payload,
    opinion: doc.opinion,
    receiptHash: doc.receiptHash,
  };
}
