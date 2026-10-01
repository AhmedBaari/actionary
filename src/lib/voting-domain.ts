import { createHash, randomBytes } from "crypto";
import type {
  AnonymousBallot,
  ApprovalResult,
  MultipleChoiceResult,
  RankedChoiceResult,
  RankedChoiceRound,
  VoteCloseReason,
  VoteOption,
  VoteStatus,
  VotingMode,
} from "@/types/voting";

// ─── Constants ───────────────────────────────────────────────

export const RESERVED_SLUGS = new Set([
  "new",
  "api",
  "edit",
  "all",
  "open",
  "closed",
  "login",
  "admin",
  "settings",
  "help",
  "results",
]);

export const MIN_OPTIONS = 2;
export const MAX_OPTIONS = 20;
export const MAX_OPINION_LENGTH = 1000;
export const MIN_VOTES_FOR_NAMES = 3;

// ─── Multiple Choice Calculation ──────────────────────────────

export function calculateMultipleChoiceResult(
  options: VoteOption[],
  ballots: AnonymousBallot[]
): MultipleChoiceResult {
  const optionCounts: Record<string, number> = {};
  for (const opt of options) {
    optionCounts[opt.id] = 0;
  }

  for (const ballot of ballots) {
    const selected = ballot.payload.selectedOptionId;
    if (selected && Object.prototype.hasOwnProperty.call(optionCounts, selected)) {
      optionCounts[selected] += 1;
    }
  }

  const totalVotes = ballots.length;
  const optionPercentages: Record<string, number> = {};

  for (const opt of options) {
    const count = optionCounts[opt.id] || 0;
    optionPercentages[opt.id] =
      totalVotes > 0 ? Math.round((count / totalVotes) * 1000) / 10 : 0;
  }

  if (totalVotes === 0) {
    return {
      mode: "MULTIPLE_CHOICE",
      totalVotes: 0,
      optionCounts,
      optionPercentages,
      winnerOptionId: null,
      isTie: false,
      tiedOptionIds: [],
    };
  }

  let maxVotes = -1;
  for (const opt of options) {
    const count = optionCounts[opt.id] || 0;
    if (count > maxVotes) {
      maxVotes = count;
    }
  }

  if (maxVotes <= 0) {
    return {
      mode: "MULTIPLE_CHOICE",
      totalVotes,
      optionCounts,
      optionPercentages,
      winnerOptionId: null,
      isTie: false,
      tiedOptionIds: [],
    };
  }

  const tied = options
    .filter((opt) => (optionCounts[opt.id] || 0) === maxVotes)
    .map((opt) => opt.id);

  const isTie = tied.length > 1;

  return {
    mode: "MULTIPLE_CHOICE",
    totalVotes,
    optionCounts,
    optionPercentages,
    winnerOptionId: isTie ? null : tied[0],
    isTie,
    tiedOptionIds: isTie ? tied : [],
  };
}

// ─── Approval Calculation ─────────────────────────────────────

export function calculateApprovalResult(
  options: VoteOption[],
  ballots: AnonymousBallot[]
): ApprovalResult {
  const optionCounts: Record<string, number> = {};
  for (const opt of options) {
    optionCounts[opt.id] = 0;
  }

  for (const ballot of ballots) {
    const selectedIds = ballot.payload.selectedOptionIds;
    if (Array.isArray(selectedIds)) {
      for (const id of selectedIds) {
        if (Object.prototype.hasOwnProperty.call(optionCounts, id)) {
          optionCounts[id] += 1;
        }
      }
    }
  }

  const totalBallots = ballots.length;
  const optionPercentages: Record<string, number> = {};

  for (const opt of options) {
    const count = optionCounts[opt.id] || 0;
    optionPercentages[opt.id] =
      totalBallots > 0 ? Math.round((count / totalBallots) * 1000) / 10 : 0;
  }

  if (totalBallots === 0) {
    return {
      mode: "APPROVAL",
      totalBallots: 0,
      optionCounts,
      optionPercentages,
      winnerOptionId: null,
      isTie: false,
      tiedOptionIds: [],
    };
  }

  let maxApprovals = -1;
  for (const opt of options) {
    const count = optionCounts[opt.id] || 0;
    if (count > maxApprovals) {
      maxApprovals = count;
    }
  }

  if (maxApprovals <= 0) {
    return {
      mode: "APPROVAL",
      totalBallots,
      optionCounts,
      optionPercentages,
      winnerOptionId: null,
      isTie: false,
      tiedOptionIds: [],
    };
  }

  const tied = options
    .filter((opt) => (optionCounts[opt.id] || 0) === maxApprovals)
    .map((opt) => opt.id);

  const isTie = tied.length > 1;

  return {
    mode: "APPROVAL",
    totalBallots,
    optionCounts,
    optionPercentages,
    winnerOptionId: isTie ? null : tied[0],
    isTie,
    tiedOptionIds: isTie ? tied : [],
  };
}

// ─── Ranked Choice Calculation (Instant Runoff) ───────────────

export function calculateRankedChoiceResult(
  options: VoteOption[],
  ballots: AnonymousBallot[]
): RankedChoiceResult {
  const totalBallots = ballots.length;

  if (totalBallots === 0 || options.length === 0) {
    return {
      mode: "RANKED_CHOICE",
      totalBallots: 0,
      rounds: [],
      winnerOptionId: null,
      isTie: false,
      tiedOptionIds: [],
    };
  }

  const validBallots: string[][] = [];
  for (const b of ballots) {
    if (Array.isArray(b.payload.rankedOptionIds)) {
      validBallots.push(b.payload.rankedOptionIds);
    }
  }

  const activeCandidates = new Set<string>(options.map((o) => o.id));
  const rounds: RankedChoiceRound[] = [];
  let roundNumber = 1;
  const maxRounds = options.length;

  while (roundNumber <= maxRounds) {
    const currentCounts: Record<string, number> = {};
    for (const optId of activeCandidates) {
      currentCounts[optId] = 0;
    }

    let activeBallots = 0;
    let exhaustedBallots = 0;

    for (const ranking of validBallots) {
      const topChoice = ranking.find((optId) => activeCandidates.has(optId));
      if (topChoice) {
        currentCounts[topChoice] = (currentCounts[topChoice] || 0) + 1;
        activeBallots += 1;
      } else {
        exhaustedBallots += 1;
      }
    }

    const percentages: Record<string, number> = {};
    for (const optId of activeCandidates) {
      percentages[optId] =
        activeBallots > 0
          ? Math.round(((currentCounts[optId] || 0) / activeBallots) * 1000) / 10
          : 0;
    }

    if (activeBallots === 0) {
      // All ballots exhausted without a single majority
      rounds.push({
        roundNumber,
        counts: currentCounts,
        percentages,
        eliminatedOptionIds: [],
        activeBallots: 0,
        exhaustedBallots: totalBallots,
      });
      return {
        mode: "RANKED_CHOICE",
        totalBallots,
        rounds,
        winnerOptionId: null,
        isTie: true,
        tiedOptionIds: Array.from(activeCandidates),
      };
    }

    // Check if an option has > 50% of active ballots
    let majorityWinner: string | null = null;
    for (const optId of activeCandidates) {
      if (currentCounts[optId] > activeBallots / 2) {
        majorityWinner = optId;
        break;
      }
    }

    if (majorityWinner) {
      rounds.push({
        roundNumber,
        counts: currentCounts,
        percentages,
        eliminatedOptionIds: [],
        activeBallots,
        exhaustedBallots,
      });

      return {
        mode: "RANKED_CHOICE",
        totalBallots,
        rounds,
        winnerOptionId: majorityWinner,
        isTie: false,
        tiedOptionIds: [],
      };
    }

    // Check if all remaining active candidates have the exact same count
    const uniqueCounts = new Set(Object.values(currentCounts));
    if (uniqueCounts.size === 1) {
      // Genuine tie among all remaining active candidates!
      rounds.push({
        roundNumber,
        counts: currentCounts,
        percentages,
        eliminatedOptionIds: [],
        activeBallots,
        exhaustedBallots,
      });

      const remainingCandidates = Array.from(activeCandidates);
      return {
        mode: "RANKED_CHOICE",
        totalBallots,
        rounds,
        winnerOptionId: null,
        isTie: true,
        tiedOptionIds: remainingCandidates,
      };
    }

    // If only 1 candidate left (can happen if prior eliminations reduced it)
    if (activeCandidates.size === 1) {
      const soleCandidate = Array.from(activeCandidates)[0];
      rounds.push({
        roundNumber,
        counts: currentCounts,
        percentages,
        eliminatedOptionIds: [],
        activeBallots,
        exhaustedBallots,
      });

      return {
        mode: "RANKED_CHOICE",
        totalBallots,
        rounds,
        winnerOptionId: soleCandidate,
        isTie: false,
        tiedOptionIds: [],
      };
    }

    // Find lowest count
    let minVotes = Infinity;
    for (const optId of activeCandidates) {
      const count = currentCounts[optId] || 0;
      if (count < minVotes) {
        minVotes = count;
      }
    }

    // Candidate(s) to eliminate
    const toEliminate = Array.from(activeCandidates).filter(
      (optId) => (currentCounts[optId] || 0) === minVotes
    );

    // If eliminating them leaves 0 candidates, it's a tie
    if (toEliminate.length === activeCandidates.size) {
      rounds.push({
        roundNumber,
        counts: currentCounts,
        percentages,
        eliminatedOptionIds: [],
        activeBallots,
        exhaustedBallots,
      });

      return {
        mode: "RANKED_CHOICE",
        totalBallots,
        rounds,
        winnerOptionId: null,
        isTie: true,
        tiedOptionIds: Array.from(activeCandidates),
      };
    }

    // Record round
    rounds.push({
      roundNumber,
      counts: currentCounts,
      percentages,
      eliminatedOptionIds: toEliminate,
      activeBallots,
      exhaustedBallots,
    });

    // Eliminate candidates
    for (const optId of toEliminate) {
      activeCandidates.delete(optId);
    }

    roundNumber += 1;
  }

  // Fallback if max rounds exceeded
  return {
    mode: "RANKED_CHOICE",
    totalBallots,
    rounds,
    winnerOptionId: null,
    isTie: true,
    tiedOptionIds: Array.from(activeCandidates),
  };
}

// ─── Validation Utilities ─────────────────────────────────────

export function validateBallot(
  mode: VotingMode,
  options: VoteOption[],
  payload: any,
  opinion?: string | null
): { valid: boolean; error?: string } {
  if (!payload || typeof payload !== "object") {
    return { valid: false, error: "Invalid ballot payload." };
  }

  const validOptionIds = new Set(options.map((o) => o.id));

  if (opinion && opinion.trim().length > MAX_OPINION_LENGTH) {
    return {
      valid: false,
      error: `Opinion comment must be at most ${MAX_OPINION_LENGTH} characters.`,
    };
  }

  switch (mode) {
    case "MULTIPLE_CHOICE": {
      const selected = payload.selectedOptionId;
      if (!selected || typeof selected !== "string" || !validOptionIds.has(selected)) {
        return { valid: false, error: "Please select a valid option." };
      }
      return { valid: true };
    }

    case "APPROVAL": {
      const selected = payload.selectedOptionIds;
      if (!Array.isArray(selected) || selected.length === 0) {
        return { valid: false, error: "Please approve at least one option." };
      }
      if (new Set(selected).size !== selected.length) {
        return { valid: false, error: "Duplicate approvals are not allowed." };
      }
      for (const id of selected) {
        if (!validOptionIds.has(id)) {
          return { valid: false, error: "Invalid option selected." };
        }
      }
      return { valid: true };
    }

    case "RANKED_CHOICE": {
      const ranked = payload.rankedOptionIds;
      if (!Array.isArray(ranked) || ranked.length !== options.length) {
        return {
          valid: false,
          error: "All options must be ranked in your ballot.",
        };
      }
      if (new Set(ranked).size !== options.length) {
        return {
          valid: false,
          error: "Duplicate ranked positions are not allowed.",
        };
      }
      for (const id of ranked) {
        if (!validOptionIds.has(id)) {
          return { valid: false, error: "Invalid option in ranking." };
        }
      }
      return { valid: true };
    }

    default:
      return { valid: false, error: "Unknown voting mode." };
  }
}

export function validateVoteOptions(
  options: Array<{ id?: string; text: string }>
): { valid: boolean; error?: string; cleanOptions?: VoteOption[] } {
  if (!Array.isArray(options) || options.length < MIN_OPTIONS) {
    return {
      valid: false,
      error: `A vote must have at least ${MIN_OPTIONS} options.`,
    };
  }

  if (options.length > MAX_OPTIONS) {
    return {
      valid: false,
      error: `A vote cannot have more than ${MAX_OPTIONS} options.`,
    };
  }

  const cleanOptions: VoteOption[] = [];
  const seenTexts = new Set<string>();

  for (let i = 0; i < options.length; i++) {
    const raw = options[i];
    const text = (raw?.text || "").trim();
    if (!text) {
      return {
        valid: false,
        error: `Option #${i + 1} cannot be blank.`,
      };
    }
    if (text.length > 120) {
      return {
        valid: false,
        error: `Option #${i + 1} is too long (max 120 characters).`,
      };
    }

    const lower = text.toLowerCase();
    if (seenTexts.has(lower)) {
      return {
        valid: false,
        error: `Duplicate option: "${text}". All options must be unique.`,
      };
    }
    seenTexts.add(lower);

    cleanOptions.push({
      id: raw.id && raw.id.trim() ? raw.id.trim() : `opt_${i + 1}`,
      text,
    });
  }

  return { valid: true, cleanOptions };
}

// ─── Lifecycle & Time Remaining ───────────────────────────────

export function isVoteOpen(vote: {
  status: VoteStatus;
  closesAt: Date | string | null;
}): boolean {
  if (vote.status !== "OPEN") return false;
  if (!vote.closesAt) return true;
  const closesAt = new Date(vote.closesAt);
  return new Date().getTime() < closesAt.getTime();
}

export function getVoteTimeRemaining(closesAt: Date | string | null): {
  isExpired: boolean;
  label: string;
  secondsRemaining: number;
} {
  if (!closesAt) {
    return {
      isExpired: false,
      label: "No deadline",
      secondsRemaining: Infinity,
    };
  }

  const deadline = new Date(closesAt).getTime();
  const now = Date.now();
  const diffMs = deadline - now;

  if (diffMs <= 0) {
    return {
      isExpired: true,
      label: "Deadline reached",
      secondsRemaining: 0,
    };
  }

  const totalSeconds = Math.floor(diffMs / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);

  let label: string;
  if (days > 0) {
    label = `${days}d ${hours}h remaining`;
  } else if (hours > 0) {
    label = `${hours}h ${minutes}m remaining`;
  } else if (minutes > 0) {
    label = `${minutes}m remaining`;
  } else {
    label = `${totalSeconds}s remaining`;
  }

  return {
    isExpired: false,
    label,
    secondsRemaining: totalSeconds,
  };
}

// ─── Slugs & Receipt Helpers ──────────────────────────────────

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function validateCustomSlug(
  slug: string
): { valid: boolean; error?: string } {
  const clean = slug.trim().toLowerCase();
  if (clean.length < 3 || clean.length > 64) {
    return {
      valid: false,
      error: "Vote URL identifier must be between 3 and 64 characters.",
    };
  }

  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(clean)) {
    return {
      valid: false,
      error:
        "Vote URL identifier can only contain lowercase letters, numbers, and hyphens.",
    };
  }

  if (RESERVED_SLUGS.has(clean)) {
    return {
      valid: false,
      error: `"${clean}" is a reserved word and cannot be used as a vote URL.`,
    };
  }

  return { valid: true };
}

export function generateRandomSlug(length = 6): string {
  // Uppercase alphanumeric (no confusing characters like 0/O or 1/I)
  const chars = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
  let result = "";
  const bytes = randomBytes(length);
  for (let i = 0; i < length; i++) {
    result += chars[bytes[i] % chars.length];
  }
  return result;
}

export function generateReceiptToken(): string {
  return "rcpt_" + randomBytes(16).toString("hex");
}

export function hashReceiptToken(token: string): string {
  return createHash("sha256").update(token.trim()).digest("hex");
}
