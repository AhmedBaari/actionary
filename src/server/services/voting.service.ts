import { randomUUID } from "crypto";
import {
  calculateApprovalResult,
  calculateMultipleChoiceResult,
  calculateRankedChoiceResult,
  generateRandomSlug,
  generateReceiptToken,
  getVoteTimeRemaining,
  hashReceiptToken,
  isVoteOpen,
  MIN_VOTES_FOR_NAMES,
  slugify,
  validateBallot,
  validateCustomSlug,
  validateVoteOptions,
} from "@/lib/voting-domain";
import {
  createVote,
  getAnonymousBallotByReceiptHash,
  getAnonymousBallotsByVoteId,
  getParticipationCount,
  getParticipatingMemberIds,
  getVoteById,
  getVoteBySlug,
  hasMemberVoted,
  listVotes,
  recordParticipation,
  saveAnonymousBallot,
  updateVoteMetadata,
  updateVoteStatus,
} from "@/server/repositories/voting.repository";
import { getAllUsers, getUserById } from "@/server/repositories/users.repository";
import { logAudit } from "@/server/services/audit.service";
import type {
  AnonymizedBallotView,
  ReceiptVerificationResult,
  Vote,
  VoteCloseReason,
  VoteOption,
  VoteResultsSummary,
  VoteView,
  VotingMode,
} from "@/types/voting";

// ─── Serialization ───────────────────────────────────────────

export function serializeVote(
  vote: Vote,
  totalVotes: number,
  hasVoted: boolean,
  creatorName?: string
): VoteView {
  return {
    id: vote._id.toString(),
    slug: vote.slug,
    title: vote.title,
    description: vote.description,
    mode: vote.mode,
    options: vote.options,
    createdBy: vote.createdBy,
    creatorName,
    createdAt: vote.createdAt.toISOString(),
    closesAt: vote.closesAt ? vote.closesAt.toISOString() : null,
    status: vote.status,
    closeReason: vote.closeReason,
    updatedAt: vote.updatedAt.toISOString(),
    totalVotes,
    hasVoted,
  };
}

// ─── Create Vote ──────────────────────────────────────────────

export async function createVoteService(params: {
  title: string;
  description?: string | null;
  mode: VotingMode;
  options: Array<{ id?: string; text: string }>;
  duration?: string | null; // e.g. "30m", "2h", "1d", "3d", "7d"
  closesAt?: string | Date | null;
  customSlug?: string | null;
  actorId: string;
  actorName?: string | null;
}): Promise<VoteView> {
  const cleanTitle = (params.title || "").trim();
  if (!cleanTitle) {
    throw new Error("Vote title is required.");
  }
  if (cleanTitle.length > 200) {
    throw new Error("Vote title must be at most 200 characters.");
  }

  const cleanDescription = params.description ? params.description.trim() : null;
  if (cleanDescription && cleanDescription.length > 2000) {
    throw new Error("Description must be at most 2000 characters.");
  }

  // Validate options
  const optResult = validateVoteOptions(params.options);
  if (!optResult.valid || !optResult.cleanOptions) {
    throw new Error(optResult.error || "Invalid options provided.");
  }

  // Calculate deadline
  let deadline: Date | null = null;
  const now = new Date();

  if (params.closesAt) {
    const parsed = new Date(params.closesAt);
    if (isNaN(parsed.getTime())) {
      throw new Error("Invalid deadline date provided.");
    }
    if (parsed.getTime() <= now.getTime()) {
      throw new Error("Deadline must be in the future.");
    }
    deadline = parsed;
  } else if (params.duration) {
    const dur = params.duration.trim().toLowerCase();
    const durations: Record<string, number> = {
      "30m": 30 * 60 * 1000,
      "1h": 60 * 60 * 1000,
      "2h": 2 * 60 * 60 * 1000,
      "1d": 24 * 60 * 60 * 1000,
      "3d": 3 * 24 * 60 * 60 * 1000,
      "7d": 7 * 24 * 60 * 60 * 1000,
    };
    const offset = durations[dur];
    if (offset) {
      deadline = new Date(now.getTime() + offset);
    }
  }

  // Slug generation / validation
  let slug = "";
  if (params.customSlug && params.customSlug.trim()) {
    const custom = params.customSlug.trim().toLowerCase();
    const slugCheck = validateCustomSlug(custom);
    if (!slugCheck.valid) {
      throw new Error(slugCheck.error);
    }
    const existing = await getVoteBySlug(custom);
    if (existing) {
      throw new Error(`The URL identifier "${custom}" is already in use.`);
    }
    slug = custom;
  } else {
    // Generate clean slug from title or random code
    const base = slugify(cleanTitle);
    let candidate = base.slice(0, 30);
    if (!candidate || candidate.length < 3) {
      candidate = generateRandomSlug(6);
    }

    let existing = await getVoteBySlug(candidate);
    if (existing) {
      candidate = `${candidate}-${generateRandomSlug(4).toLowerCase()}`;
    }
    slug = candidate;
  }

  const vote = await createVote({
    slug,
    title: cleanTitle,
    description: cleanDescription,
    mode: params.mode,
    options: optResult.cleanOptions,
    createdBy: params.actorId,
    closesAt: deadline,
    status: "OPEN",
    closeReason: null,
  });

  await logAudit({
    entityType: "vote",
    entityId: vote._id.toString(),
    actorId: params.actorId,
    actorName: params.actorName,
    action: "vote.created",
    metadata: {
      title: vote.title,
      mode: vote.mode,
      slug: vote.slug,
      optionsCount: vote.options.length,
    },
  });

  return serializeVote(vote, 0, false, params.actorName ?? undefined);
}

// ─── Cast Vote (Strict Anonymity Guarantee) ───────────────────

export async function castVoteService(params: {
  voteIdOrSlug: string;
  memberId: string;
  payload: any;
  opinion?: string | null;
}): Promise<{ success: true; receiptToken: string; voteSlug: string }> {
  const vote = await getVoteBySlug(params.voteIdOrSlug);
  if (!vote) {
    throw new Error("Vote not found.");
  }

  const voteId = vote._id.toString();

  // Lazy check: if deadline expired, mark closed immediately
  if (vote.status === "OPEN" && vote.closesAt && new Date() >= new Date(vote.closesAt)) {
    await updateVoteStatus(voteId, "CLOSED", "EXPIRED");
    throw new Error("This vote reached its deadline and is now closed.");
  }

  if (vote.status !== "OPEN") {
    throw new Error("This vote is closed. Ballots cannot be submitted.");
  }

  // Pre-check participation
  const alreadyVoted = await hasMemberVoted(voteId, params.memberId);
  if (alreadyVoted) {
    throw new Error("You have already voted in this vote.");
  }

  // Validate ballot payload
  const validation = validateBallot(
    vote.mode,
    vote.options,
    params.payload,
    params.opinion
  );
  if (!validation.valid) {
    throw new Error(validation.error || "Invalid ballot.");
  }

  // Generate private receipt token & hash
  const receiptToken = generateReceiptToken();
  const receiptHash = hashReceiptToken(receiptToken);

  // Random UUID identifier for anonymous ballot (NO timestamp encoding!)
  const ballotId = randomUUID();

  // 1. Record participation (atomic uniqueness in DB prevents concurrent double-voting)
  await recordParticipation(voteId, params.memberId);

  // 2. Save anonymous ballot (CRITICAL: ZERO memberId, ZERO session info, ZERO receiptToken)
  await saveAnonymousBallot({
    _id: ballotId,
    voteId,
    mode: vote.mode,
    payload: params.payload,
    opinion: params.opinion ? params.opinion.trim() : null,
    receiptHash,
  });

  // 3. Log audit event WITHOUT associating member identity to choice
  await logAudit({
    entityType: "vote",
    entityId: voteId,
    actorId: null, // Critical: deliberately null to avoid identity-to-action leakage
    actorName: null,
    action: "vote.cast",
    metadata: {
      mode: vote.mode,
    },
  });

  return {
    success: true,
    receiptToken,
    voteSlug: vote.slug,
  };
}

// ─── Get Vote Details ─────────────────────────────────────────

export async function getVoteDetailsService(
  slugOrId: string,
  currentUserId?: string | null
): Promise<{
  vote: VoteView;
  summary?: VoteResultsSummary;
} | null> {
  const vote = await getVoteBySlug(slugOrId);
  if (!vote) return null;

  const voteId = vote._id.toString();

  // Lazy check: automatically close if deadline expired
  if (vote.status === "OPEN" && vote.closesAt && new Date() >= new Date(vote.closesAt)) {
    await updateVoteStatus(voteId, "CLOSED", "EXPIRED");
    vote.status = "CLOSED";
    vote.closeReason = "EXPIRED";
  }

  const [totalVotes, hasVoted, creator] = await Promise.all([
    getParticipationCount(voteId),
    currentUserId ? hasMemberVoted(voteId, currentUserId) : Promise.resolve(false),
    getUserById(vote.createdBy),
  ]);

  const creatorName = creator?.name || creator?.email || "Teammate";
  const voteView = serializeVote(vote, totalVotes, hasVoted, creatorName);

  // Results visibility rule:
  // If user has voted OR vote is closed -> results are visible!
  // If user has not voted AND vote is open -> results are hidden!
  if (hasVoted || vote.status === "CLOSED") {
    const rawBallots = await getAnonymousBallotsByVoteId(voteId);

    let result: any;
    if (vote.mode === "MULTIPLE_CHOICE") {
      result = calculateMultipleChoiceResult(vote.options, rawBallots);
    } else if (vote.mode === "APPROVAL") {
      result = calculateApprovalResult(vote.options, rawBallots);
    } else {
      result = calculateRankedChoiceResult(vote.options, rawBallots);
    }

    // Voter names rule:
    // < 3 total votes -> voter names hidden!
    // >= 3 total votes -> voter names visible independent of ballot!
    let voterNames: string[] | null = null;
    let votersHiddenNotice: string | null = null;

    if (totalVotes < MIN_VOTES_FOR_NAMES) {
      votersHiddenNotice = "Hidden until at least 3 votes are recorded.";
    } else {
      const memberIds = await getParticipatingMemberIds(voteId);
      const allUsers = await getAllUsers();
      const userMap = new Map(allUsers.map((u) => [u._id.toString(), u.name || u.email]));
      voterNames = memberIds
        .map((id) => userMap.get(id) || "Member")
        .sort((a, b) => a.localeCompare(b));
    }

    // Anonymized ballots list
    const anonymousBallots: AnonymizedBallotView[] = rawBallots.map((b, idx) => ({
      displayId: `Anonymous ballot ${idx + 1}`,
      payload: b.payload,
      opinion: b.opinion,
    }));

    const summary: VoteResultsSummary = {
      voteId,
      mode: vote.mode,
      status: vote.status,
      closeReason: vote.closeReason,
      totalVotes,
      result,
      anonymousBallots,
      voterNames,
      votersHiddenNotice,
    };

    return { vote: voteView, summary };
  }

  // Not voted and still open: return vote without summary/results
  return { vote: voteView };
}

// ─── List Votes ───────────────────────────────────────────────

export async function listVotesService(
  statusFilter?: "ALL" | "OPEN" | "CLOSED",
  search?: string,
  currentUserId?: string | null
): Promise<VoteView[]> {
  const votes = await listVotes(statusFilter, search);
  const allUsers = await getAllUsers();
  const userMap = new Map(allUsers.map((u) => [u._id.toString(), u.name || u.email]));

  const views = await Promise.all(
    votes.map(async (v) => {
      const voteId = v._id.toString();
      // Lazy auto-close on listing
      if (v.status === "OPEN" && v.closesAt && new Date() >= new Date(v.closesAt)) {
        await updateVoteStatus(voteId, "CLOSED", "EXPIRED");
        v.status = "CLOSED";
        v.closeReason = "EXPIRED";
      }

      const totalVotes = await getParticipationCount(voteId);
      const hasVoted = currentUserId
        ? await hasMemberVoted(voteId, currentUserId)
        : false;

      return serializeVote(
        v,
        totalVotes,
        hasVoted,
        userMap.get(v.createdBy) || "Teammate"
      );
    })
  );

  return views;
}

// ─── Close / Cancel / Edit Vote ───────────────────────────────

export async function closeVoteService(
  slugOrId: string,
  reason: VoteCloseReason = "MANUAL",
  actorId?: string,
  actorName?: string
): Promise<boolean> {
  const vote = await getVoteBySlug(slugOrId);
  if (!vote) throw new Error("Vote not found.");

  if (vote.status === "CLOSED") return true;

  const success = await updateVoteStatus(vote._id.toString(), "CLOSED", reason);

  await logAudit({
    entityType: "vote",
    entityId: vote._id.toString(),
    actorId: actorId ?? null,
    actorName: actorName ?? null,
    action: reason === "CANCELLED" ? "vote.cancelled" : "vote.closed",
    metadata: {
      title: vote.title,
      reason,
    },
  });

  return success;
}

export async function cancelVoteService(
  slugOrId: string,
  actorId?: string,
  actorName?: string
): Promise<boolean> {
  return closeVoteService(slugOrId, "CANCELLED", actorId, actorName);
}

export async function editVoteService(params: {
  slugOrId: string;
  updates: {
    title?: string;
    description?: string | null;
    closesAt?: string | Date | null;
    options?: Array<{ id?: string; text: string }>;
    mode?: VotingMode;
  };
  actorId: string;
  actorName?: string | null;
}): Promise<VoteView> {
  const vote = await getVoteBySlug(params.slugOrId);
  if (!vote) throw new Error("Vote not found.");

  const voteId = vote._id.toString();

  if (vote.status === "CLOSED") {
    throw new Error("Cannot edit a closed vote.");
  }

  // Check ballot integrity: have any votes been cast?
  const totalVotes = await getParticipationCount(voteId);

  const finalUpdates: any = {};

  if (params.updates.title !== undefined) {
    const t = params.updates.title.trim();
    if (!t) throw new Error("Title cannot be empty.");
    finalUpdates.title = t;
  }

  if (params.updates.description !== undefined) {
    finalUpdates.description = params.updates.description
      ? params.updates.description.trim()
      : null;
  }

  if (params.updates.closesAt !== undefined) {
    if (params.updates.closesAt === null) {
      finalUpdates.closesAt = null;
    } else {
      const d = new Date(params.updates.closesAt);
      if (isNaN(d.getTime())) throw new Error("Invalid deadline.");
      finalUpdates.closesAt = d;
    }
  }

  // Critical ballot integrity protection
  if (params.updates.mode !== undefined && params.updates.mode !== vote.mode) {
    if (totalVotes > 0) {
      throw new Error(
        "Cannot change voting mode after ballots have been cast. Ballot integrity is protected."
      );
    }
    finalUpdates.mode = params.updates.mode;
  }

  if (params.updates.options !== undefined) {
    if (totalVotes > 0) {
      throw new Error(
        "Cannot modify options after ballots have been cast. Ballot integrity is protected."
      );
    }
    const optCheck = validateVoteOptions(params.updates.options);
    if (!optCheck.valid || !optCheck.cleanOptions) {
      throw new Error(optCheck.error || "Invalid options.");
    }
    finalUpdates.options = optCheck.cleanOptions;
  }

  await updateVoteMetadata(voteId, finalUpdates);

  await logAudit({
    entityType: "vote",
    entityId: voteId,
    actorId: params.actorId,
    actorName: params.actorName,
    action: "vote.updated",
    metadata: {
      changes: Object.keys(finalUpdates),
    },
  });

  const updatedVote = (await getVoteById(voteId))!;
  return serializeVote(updatedVote, totalVotes, false, params.actorName ?? undefined);
}

// ─── Receipt Verification ─────────────────────────────────────

export async function verifyReceiptService(
  voteIdOrSlug: string,
  receiptToken: string
): Promise<ReceiptVerificationResult> {
  const vote = await getVoteBySlug(voteIdOrSlug);
  if (!vote) {
    return { valid: false };
  }

  const receiptHash = hashReceiptToken(receiptToken);
  const ballot = await getAnonymousBallotByReceiptHash(
    vote._id.toString(),
    receiptHash
  );

  if (!ballot) {
    return { valid: false };
  }

  return {
    valid: true,
    voteTitle: vote.title,
    mode: ballot.mode,
    payload: ballot.payload,
    opinion: ballot.opinion,
  };
}

// ─── Live Results (Lightweight Poll) ──────────────────────────

export async function getLiveResultsService(
  slugOrId: string,
  currentUserId?: string | null
): Promise<VoteResultsSummary | null> {
  const details = await getVoteDetailsService(slugOrId, currentUserId);
  return details?.summary ?? null;
}
