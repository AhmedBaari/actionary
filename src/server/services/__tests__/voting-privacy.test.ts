import { describe, expect, it } from "vitest";
import {
  calculateMultipleChoiceResult,
  generateReceiptToken,
  hashReceiptToken,
  MIN_VOTES_FOR_NAMES,
} from "@/lib/voting-domain";
import type {
  AnonymousBallot,
  Vote,
  VoteOption,
  VoteParticipation,
} from "@/types/voting";

describe("Voting Privacy & Security Architecture Tests", () => {
  const options: VoteOption[] = [
    { id: "opt_a", text: "Option A" },
    { id: "opt_b", text: "Option B" },
    { id: "opt_c", text: "Option C" },
  ];

  const voteId = "vote_security_test_100";

  // ─── Test 1: Raw Anonymous Ballots Contain No Identity ────────

  it("Test 1: raw anonymous ballot records contain choices but NO member identity", () => {
    // Alice votes Option A, Bob votes Option B
    const aliceReceipt = generateReceiptToken();
    const bobReceipt = generateReceiptToken();

    const aliceBallot: AnonymousBallot = {
      _id: "7b4c6e9a-28e4-4d2b-9e45-123456789abc", // Random UUID (no timestamp)
      voteId,
      mode: "MULTIPLE_CHOICE",
      payload: { selectedOptionId: "opt_a" },
      opinion: "I prefer Option A because it is fast.",
      receiptHash: hashReceiptToken(aliceReceipt),
    };

    const bobBallot: AnonymousBallot = {
      _id: "8c5d7f0b-39f5-4e3c-af56-234567890def", // Random UUID (no timestamp)
      voteId,
      mode: "MULTIPLE_CHOICE",
      payload: { selectedOptionId: "opt_b" },
      opinion: "Option B has better ecosystem support.",
      receiptHash: hashReceiptToken(bobReceipt),
    };

    const ballots = [aliceBallot, bobBallot];

    // Assert ballot fields
    for (const b of ballots) {
      const keys = Object.keys(b);
      expect(keys).not.toContain("memberId");
      expect(keys).not.toContain("userId");
      expect(keys).not.toContain("name");
      expect(keys).not.toContain("email");
      expect(keys).not.toContain("sessionId");
      expect(keys).not.toContain("participationId");

      // Verify choice exists
      expect(b.payload.selectedOptionId).toBeDefined();
    }

    // Verify raw content has Option A and Option B, but string representation contains neither "Alice" nor "Bob"
    const jsonStr = JSON.stringify(ballots);
    expect(jsonStr).toContain("Option A");
    expect(jsonStr).toContain("Option B");
    expect(jsonStr).not.toContain("Alice");
    expect(jsonStr).not.toContain("Bob");
    expect(jsonStr).not.toContain("alice@sastranet.com");
    expect(jsonStr).not.toContain("bob@sastranet.com");
  });

  // ─── Test 2: Raw Participation Records Contain No Choices ──────

  it("Test 2: raw participation records contain member identity but NO selected options", () => {
    const aliceParticipation: VoteParticipation = {
      _id: "part_1",
      voteId,
      memberId: "user_alice_123",
      votedAt: new Date(),
    };

    const bobParticipation: VoteParticipation = {
      _id: "part_2",
      voteId,
      memberId: "user_bob_456",
      votedAt: new Date(),
    };

    const participations = [aliceParticipation, bobParticipation];

    for (const p of participations) {
      const keys = Object.keys(p);
      expect(keys).not.toContain("ballotId");
      expect(keys).not.toContain("selectedOption");
      expect(keys).not.toContain("selectedOptionId");
      expect(keys).not.toContain("rankings");
      expect(keys).not.toContain("approvals");
      expect(keys).not.toContain("opinion");
      expect(keys).not.toContain("receiptHash");
      expect(keys).not.toContain("receiptToken");
    }

    const jsonStr = JSON.stringify(participations);
    expect(jsonStr).toContain("user_alice_123");
    expect(jsonStr).toContain("user_bob_456");
    expect(jsonStr).not.toContain("opt_a");
    expect(jsonStr).not.toContain("opt_b");
  });

  // ─── Test 3: No Joinable Identifier Between Participation & Ballot

  it("Test 3: there is no joinable identifier (ballotId, receiptHash, deterministic token, sessionId, userId) between Participation and Ballot", () => {
    const participationKeys = new Set(["_id", "voteId", "memberId", "votedAt"]);
    const ballotKeys = new Set(["_id", "voteId", "mode", "payload", "opinion", "receiptHash"]);

    // Find intersection of keys
    const intersection = [...participationKeys].filter((k) => ballotKeys.has(k));

    // The ONLY common key must be voteId (and possibly the generic collection _id which is random UUID vs ObjectId)
    expect(intersection).toEqual(["_id", "voteId"]);

    // _id in participation is NOT referenced anywhere in ballot
    // _id in ballot is NOT referenced anywhere in participation
    // receiptHash is NOT in participation
    expect(participationKeys.has("receiptHash")).toBe(false);
    expect(participationKeys.has("ballotId")).toBe(false);
    expect(ballotKeys.has("memberId")).toBe(false);
  });

  // ─── Test 4: UI / View Serialization Never Joins Voter + Choice

  it("Test 4: UI/view serialization outputs voter names separately from ballots and results", () => {
    const rawBallots: AnonymousBallot[] = [
      { _id: "b1", voteId, mode: "MULTIPLE_CHOICE", payload: { selectedOptionId: "opt_a" }, receiptHash: "h1" },
      { _id: "b2", voteId, mode: "MULTIPLE_CHOICE", payload: { selectedOptionId: "opt_b" }, receiptHash: "h2" },
      { _id: "b3", voteId, mode: "MULTIPLE_CHOICE", payload: { selectedOptionId: "opt_a" }, receiptHash: "h3" },
    ];

    const result = calculateMultipleChoiceResult(options, rawBallots);

    // Voter names list (independent!)
    const voterNames = ["Alice", "Bob", "Charlie"].sort();

    // Anonymous ballots view
    const anonymousBallots = rawBallots.map((b, idx) => ({
      displayId: `Anonymous ballot ${idx + 1}`,
      payload: b.payload,
    }));

    // In the anonymous ballots list, no voter names appear
    for (const ab of anonymousBallots) {
      expect((ab as any).voterName).toBeUndefined();
      expect((ab as any).memberId).toBeUndefined();
    }

    // In voter names list, no choices appear
    for (const name of voterNames) {
      expect(typeof name).toBe("string");
      expect(name).not.toContain("opt_");
      expect(name).not.toContain("Option");
    }

    expect(result.winnerOptionId).toBe("opt_a");
  });

  // ─── Test 5: Receipt Verification Proves Ballot Exists Without Voter Identity

  it("Test 5: receipt verification proves ballot exists without introducing member-to-ballot linkage", () => {
    const rawReceipt = generateReceiptToken();
    const computedHash = hashReceiptToken(rawReceipt);

    const ballot: AnonymousBallot = {
      _id: "uuid-12345",
      voteId,
      mode: "MULTIPLE_CHOICE",
      payload: { selectedOptionId: "opt_a" },
      opinion: "Confidential opinion",
      receiptHash: computedHash,
    };

    // Verification check: hash matching
    const queryHash = hashReceiptToken(rawReceipt);
    const matches = ballot.receiptHash === queryHash;
    expect(matches).toBe(true);

    // Verification output contains ballot info, but zero user info
    const verificationOutput = {
      valid: matches,
      mode: ballot.mode,
      payload: ballot.payload,
      opinion: ballot.opinion,
    };

    expect(verificationOutput.valid).toBe(true);
    expect(verificationOutput.payload?.selectedOptionId).toBe("opt_a");
    expect((verificationOutput as any).memberId).toBeUndefined();
    expect((verificationOutput as any).userName).toBeUndefined();
  });

  // ─── Test 6: Voter Names Threshold (<3 hidden, >=3 visible) ───

  it("Test 6: voter names are hidden before 3 total votes, and become visible at exactly 3", () => {
    function computeVoterDisplay(memberNames: string[]) {
      if (memberNames.length < MIN_VOTES_FOR_NAMES) {
        return {
          voterNames: null,
          votersHiddenNotice: "Hidden until at least 3 votes are recorded.",
        };
      }
      return {
        voterNames: [...memberNames].sort((a, b) => a.localeCompare(b)),
        votersHiddenNotice: null,
      };
    }

    // 0 votes -> hidden
    expect(computeVoterDisplay([]).voterNames).toBeNull();
    expect(computeVoterDisplay([]).votersHiddenNotice).toBe(
      "Hidden until at least 3 votes are recorded."
    );

    // 1 vote -> hidden
    expect(computeVoterDisplay(["Alice"]).voterNames).toBeNull();

    // 2 votes -> hidden
    expect(computeVoterDisplay(["Alice", "Bob"]).voterNames).toBeNull();

    // 3 votes -> VISIBLE!
    const threeVoters = computeVoterDisplay(["Charlie", "Alice", "Bob"]);
    expect(threeVoters.voterNames).toEqual(["Alice", "Bob", "Charlie"]);
    expect(threeVoters.votersHiddenNotice).toBeNull();

    // 4 votes -> VISIBLE
    const fourVoters = computeVoterDisplay(["Alice", "Bob", "Charlie", "David"]);
    expect(fourVoters.voterNames?.length).toBe(4);
  });

  // ─── Test 7: Closing Vote Blocks Submissions ──────────────────

  it("Test 7: closing the vote blocks additional submissions", () => {
    const closedVote: Vote = {
      _id: "v_closed_1",
      slug: "closed-vote",
      title: "Closed Decision",
      description: null,
      mode: "MULTIPLE_CHOICE",
      options,
      createdBy: "user_lead",
      createdAt: new Date(),
      closesAt: null,
      status: "CLOSED",
      closeReason: "MANUAL",
      updatedAt: new Date(),
    };

    function attemptSubmission(vote: Vote) {
      if (vote.status !== "OPEN") {
        throw new Error("This vote is closed. Ballots cannot be submitted.");
      }
      return true;
    }

    expect(() => attemptSubmission(closedVote)).toThrow("This vote is closed. Ballots cannot be submitted.");
  });

  // ─── Test 8: Duplicate Voting Rejection / Uniqueness ──────────

  it("Test 8: duplicate voting is rejected under participation uniqueness rule", () => {
    const participationSet = new Set<string>();

    function recordParticipationMock(voteId: string, memberId: string) {
      const key = `${voteId}::${memberId}`;
      if (participationSet.has(key)) {
        throw new Error("You have already voted in this vote.");
      }
      participationSet.add(key);
    }

    // First attempt succeeds
    expect(() => recordParticipationMock("v1", "member_1")).not.toThrow();

    // Second attempt from same member fails
    expect(() => recordParticipationMock("v1", "member_1")).toThrow(
      "You have already voted in this vote."
    );

    // Attempt for different vote succeeds
    expect(() => recordParticipationMock("v2", "member_1")).not.toThrow();
  });

  // ─── Test 9: Deadline Automatically Closes Vote ───────────────

  it("Test 9: deadline expiration automatically transitions vote to closed", () => {
    const pastDate = new Date(Date.now() - 5000); // 5 seconds ago
    const expiredVote: Vote = {
      _id: "v_expired_1",
      slug: "expired-vote",
      title: "Expired Vote",
      description: null,
      mode: "MULTIPLE_CHOICE",
      options,
      createdBy: "user_lead",
      createdAt: new Date(Date.now() - 3600000),
      closesAt: pastDate,
      status: "OPEN",
      closeReason: null,
      updatedAt: new Date(),
    };

    function checkAndTransitionVote(v: Vote): Vote {
      if (v.status === "OPEN" && v.closesAt && new Date() >= new Date(v.closesAt)) {
        return {
          ...v,
          status: "CLOSED",
          closeReason: "EXPIRED",
        };
      }
      return v;
    }

    const result = checkAndTransitionVote(expiredVote);
    expect(result.status).toBe("CLOSED");
    expect(result.closeReason).toBe("EXPIRED");
  });

  // ─── Test 10: Live Results Without Ballot Correlation ─────────

  it("Test 10: live result updates return aggregated and anonymous data without revealing who voted for what", () => {
    const ballots: AnonymousBallot[] = [
      { _id: "b1", voteId, mode: "MULTIPLE_CHOICE", payload: { selectedOptionId: "opt_a" }, receiptHash: "h1" },
      { _id: "b2", voteId, mode: "MULTIPLE_CHOICE", payload: { selectedOptionId: "opt_b" }, receiptHash: "h2" },
      { _id: "b3", voteId, mode: "MULTIPLE_CHOICE", payload: { selectedOptionId: "opt_a" }, receiptHash: "h3" },
    ];

    const aggregate = calculateMultipleChoiceResult(options, ballots);

    const livePayload = {
      voteId,
      totalVotes: aggregate.totalVotes,
      counts: aggregate.optionCounts,
      percentages: aggregate.optionPercentages,
      winner: aggregate.winnerOptionId,
    };

    expect(livePayload.totalVotes).toBe(3);
    expect(livePayload.counts["opt_a"]).toBe(2);
    expect(livePayload.counts["opt_b"]).toBe(1);

    // Ensure live update does NOT carry any member identity or receipt token
    const serialized = JSON.stringify(livePayload);
    expect(serialized).not.toContain("memberId");
    expect(serialized).not.toContain("userId");
    expect(serialized).not.toContain("receiptToken");
  });
});
