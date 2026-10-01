// ============================================================
// SastraNet Voting Domain Types
// Single source of truth for all Voting types
// ============================================================

export type VotingMode = "MULTIPLE_CHOICE" | "RANKED_CHOICE" | "APPROVAL";

export type VoteStatus = "OPEN" | "CLOSED";

export type VoteCloseReason = "MANUAL" | "EXPIRED" | "CANCELLED";

export interface VoteOption {
  id: string;
  text: string;
}

export interface Vote {
  _id: string;
  slug: string;
  title: string;
  description: string | null;
  mode: VotingMode;
  options: VoteOption[];
  createdBy: string;
  createdAt: Date;
  closesAt: Date | null;
  status: VoteStatus;
  closeReason?: VoteCloseReason | null;
  updatedAt: Date;
}

/**
 * Participation record answering "Has member X voted in vote Y?"
 * CRITICAL PRIVACY REQUIREMENT:
 * MUST NOT contain: ballotId, selectedOption, rankings, approvals, opinion, receiptHash,
 * or ANY identifier joinable to the anonymous ballot.
 */
export interface VoteParticipation {
  _id: string;
  voteId: string;
  memberId: string;
  votedAt: Date;
}

/**
 * Anonymous ballot record answering "What anonymous ballot was submitted to vote Y?"
 * CRITICAL PRIVACY REQUIREMENT:
 * MUST NOT contain: memberId, username, email, sessionId, participationId.
 * Uses a random UUID _id (not an ObjectId that encodes timestamp).
 */
export interface AnonymousBallot {
  _id: string; // Random UUID
  voteId: string;
  mode: VotingMode;
  payload: {
    selectedOptionId?: string; // For MULTIPLE_CHOICE
    rankedOptionIds?: string[]; // For RANKED_CHOICE (ordered array)
    selectedOptionIds?: string[]; // For APPROVAL (selected options)
  };
  opinion?: string | null; // Optional free-text opinion
  receiptHash: string; // SHA-256 hash of private receipt token
}

// ─── Results Calculation Types ────────────────────────────────

export interface MultipleChoiceResult {
  mode: "MULTIPLE_CHOICE";
  totalVotes: number;
  optionCounts: Record<string, number>;
  optionPercentages: Record<string, number>;
  winnerOptionId: string | null; // null if tie or 0 votes
  isTie: boolean;
  tiedOptionIds: string[];
}

export interface ApprovalResult {
  mode: "APPROVAL";
  totalBallots: number;
  optionCounts: Record<string, number>;
  optionPercentages: Record<string, number>;
  winnerOptionId: string | null; // null if tie or 0 ballots
  isTie: boolean;
  tiedOptionIds: string[];
}

export interface RankedChoiceRound {
  roundNumber: number;
  counts: Record<string, number>;
  percentages: Record<string, number>;
  eliminatedOptionIds: string[];
  activeBallots: number;
  exhaustedBallots: number;
}

export interface RankedChoiceResult {
  mode: "RANKED_CHOICE";
  totalBallots: number;
  rounds: RankedChoiceRound[];
  winnerOptionId: string | null;
  isTie: boolean;
  tiedOptionIds: string[];
}

export type VoteResult =
  | MultipleChoiceResult
  | ApprovalResult
  | RankedChoiceResult;

// ─── Client Views ─────────────────────────────────────────────

export interface AnonymizedBallotView {
  displayId: string; // "Anonymous ballot 1", "Anonymous ballot 2", etc.
  payload: {
    selectedOptionId?: string;
    rankedOptionIds?: string[];
    selectedOptionIds?: string[];
  };
  opinion?: string | null;
}

export interface VoteResultsSummary {
  voteId: string;
  mode: VotingMode;
  status: VoteStatus;
  closeReason?: VoteCloseReason | null;
  totalVotes: number;
  result: VoteResult;
  anonymousBallots: AnonymizedBallotView[];
  voterNames: string[] | null; // null if < 3 votes, list of names if >= 3 votes
  votersHiddenNotice?: string | null;
}

export interface VoteView {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  mode: VotingMode;
  options: VoteOption[];
  createdBy: string;
  creatorName?: string;
  createdAt: string;
  closesAt: string | null;
  status: VoteStatus;
  closeReason?: VoteCloseReason | null;
  updatedAt: string;
  totalVotes: number;
  hasVoted: boolean;
  userReceipt?: string | null;
}

export interface ReceiptVerificationResult {
  valid: boolean;
  voteTitle?: string;
  mode?: VotingMode;
  payload?: {
    selectedOptionId?: string;
    rankedOptionIds?: string[];
    selectedOptionIds?: string[];
  };
  opinion?: string | null;
}
