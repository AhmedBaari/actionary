import { describe, expect, it } from "vitest";
import {
  calculateApprovalResult,
  calculateMultipleChoiceResult,
  calculateRankedChoiceResult,
  generateReceiptToken,
  getVoteTimeRemaining,
  hashReceiptToken,
  isVoteOpen,
  validateBallot,
  validateCustomSlug,
  validateVoteOptions,
} from "../voting-domain";
import type { AnonymousBallot, VoteOption } from "@/types/voting";

describe("Voting Domain Logic", () => {
  const sampleOptions: VoteOption[] = [
    { id: "opt_mongo", text: "MongoDB" },
    { id: "opt_postgres", text: "PostgreSQL" },
    { id: "opt_mysql", text: "MySQL" },
  ];

  // ─── Mode A: Multiple Choice ───────────────────────────────

  describe("calculateMultipleChoiceResult", () => {
    it("determines the plurality winner correctly", () => {
      const ballots: AnonymousBallot[] = [
        { _id: "b1", voteId: "v1", mode: "MULTIPLE_CHOICE", payload: { selectedOptionId: "opt_mongo" }, receiptHash: "h1" },
        { _id: "b2", voteId: "v1", mode: "MULTIPLE_CHOICE", payload: { selectedOptionId: "opt_mongo" }, receiptHash: "h2" },
        { _id: "b3", voteId: "v1", mode: "MULTIPLE_CHOICE", payload: { selectedOptionId: "opt_mongo" }, receiptHash: "h3" },
        { _id: "b4", voteId: "v1", mode: "MULTIPLE_CHOICE", payload: { selectedOptionId: "opt_postgres" }, receiptHash: "h4" },
        { _id: "b5", voteId: "v1", mode: "MULTIPLE_CHOICE", payload: { selectedOptionId: "opt_mysql" }, receiptHash: "h5" },
      ];

      const res = calculateMultipleChoiceResult(sampleOptions, ballots);
      expect(res.totalVotes).toBe(5);
      expect(res.isTie).toBe(false);
      expect(res.winnerOptionId).toBe("opt_mongo");
      expect(res.optionCounts["opt_mongo"]).toBe(3);
      expect(res.optionCounts["opt_postgres"]).toBe(1);
      expect(res.optionCounts["opt_mysql"]).toBe(1);
      expect(res.optionPercentages["opt_mongo"]).toBe(60);
      expect(res.tiedOptionIds).toEqual([]);
    });

    it("detects an exact tie and does not choose an arbitrary winner", () => {
      const ballots: AnonymousBallot[] = [
        { _id: "b1", voteId: "v1", mode: "MULTIPLE_CHOICE", payload: { selectedOptionId: "opt_mongo" }, receiptHash: "h1" },
        { _id: "b2", voteId: "v1", mode: "MULTIPLE_CHOICE", payload: { selectedOptionId: "opt_mongo" }, receiptHash: "h2" },
        { _id: "b3", voteId: "v1", mode: "MULTIPLE_CHOICE", payload: { selectedOptionId: "opt_postgres" }, receiptHash: "h3" },
        { _id: "b4", voteId: "v1", mode: "MULTIPLE_CHOICE", payload: { selectedOptionId: "opt_postgres" }, receiptHash: "h4" },
      ];

      const res = calculateMultipleChoiceResult(sampleOptions, ballots);
      expect(res.totalVotes).toBe(4);
      expect(res.isTie).toBe(true);
      expect(res.winnerOptionId).toBeNull();
      expect(res.tiedOptionIds).toEqual(["opt_mongo", "opt_postgres"]);
    });

    it("handles 0 ballots gracefully", () => {
      const res = calculateMultipleChoiceResult(sampleOptions, []);
      expect(res.totalVotes).toBe(0);
      expect(res.winnerOptionId).toBeNull();
      expect(res.isTie).toBe(false);
    });
  });

  // ─── Mode B: Ranked Choice (Instant Runoff) ─────────────────

  describe("calculateRankedChoiceResult", () => {
    it("declares candidate with >50% first-choice votes as winner in round 1", () => {
      const ballots: AnonymousBallot[] = [
        { _id: "b1", voteId: "v1", mode: "RANKED_CHOICE", payload: { rankedOptionIds: ["opt_mongo", "opt_postgres", "opt_mysql"] }, receiptHash: "h1" },
        { _id: "b2", voteId: "v1", mode: "RANKED_CHOICE", payload: { rankedOptionIds: ["opt_mongo", "opt_mysql", "opt_postgres"] }, receiptHash: "h2" },
        { _id: "b3", voteId: "v1", mode: "RANKED_CHOICE", payload: { rankedOptionIds: ["opt_mongo", "opt_postgres", "opt_mysql"] }, receiptHash: "h3" },
        { _id: "b4", voteId: "v1", mode: "RANKED_CHOICE", payload: { rankedOptionIds: ["opt_postgres", "opt_mongo", "opt_mysql"] }, receiptHash: "h4" },
      ];

      const res = calculateRankedChoiceResult(sampleOptions, ballots);
      expect(res.totalBallots).toBe(4);
      expect(res.rounds.length).toBe(1);
      expect(res.winnerOptionId).toBe("opt_mongo");
      expect(res.isTie).toBe(false);
      expect(res.rounds[0].counts["opt_mongo"]).toBe(3);
    });

    it("eliminates lowest candidate and redistributes votes across rounds until majority", () => {
      // 5 voters:
      // Voter 1: MySQL -> Postgres -> Mongo
      // Voter 2: Postgres -> Mongo -> MySQL
      // Voter 3: Postgres -> MySQL -> Mongo
      // Voter 4: Mongo -> Postgres -> MySQL
      // Voter 5: Mongo -> MySQL -> Postgres
      // Round 1:
      //   Mongo: 2 (40%)
      //   Postgres: 2 (40%)
      //   MySQL: 1 (20%) -> MySQL eliminated!
      // Voter 1's vote transfers to Postgres!
      // Round 2:
      //   Postgres: 3 (60% > 50%) -> Postgres wins!
      const ballots: AnonymousBallot[] = [
        { _id: "b1", voteId: "v1", mode: "RANKED_CHOICE", payload: { rankedOptionIds: ["opt_mysql", "opt_postgres", "opt_mongo"] }, receiptHash: "h1" },
        { _id: "b2", voteId: "v1", mode: "RANKED_CHOICE", payload: { rankedOptionIds: ["opt_postgres", "opt_mongo", "opt_mysql"] }, receiptHash: "h2" },
        { _id: "b3", voteId: "v1", mode: "RANKED_CHOICE", payload: { rankedOptionIds: ["opt_postgres", "opt_mysql", "opt_mongo"] }, receiptHash: "h3" },
        { _id: "b4", voteId: "v1", mode: "RANKED_CHOICE", payload: { rankedOptionIds: ["opt_mongo", "opt_postgres", "opt_mysql"] }, receiptHash: "h4" },
        { _id: "b5", voteId: "v1", mode: "RANKED_CHOICE", payload: { rankedOptionIds: ["opt_mongo", "opt_mysql", "opt_postgres"] }, receiptHash: "h5" },
      ];

      const res = calculateRankedChoiceResult(sampleOptions, ballots);
      expect(res.totalBallots).toBe(5);
      expect(res.rounds.length).toBe(2);
      // Round 1 check
      expect(res.rounds[0].eliminatedOptionIds).toEqual(["opt_mysql"]);
      expect(res.rounds[0].counts["opt_mysql"]).toBe(1);
      // Round 2 check
      expect(res.rounds[1].counts["opt_postgres"]).toBe(3);
      expect(res.rounds[1].counts["opt_mongo"]).toBe(2);
      expect(res.winnerOptionId).toBe("opt_postgres");
      expect(res.isTie).toBe(false);
    });

    it("handles an exact tie in ranked choice calculation without arbitrary picking", () => {
      // 2 voters:
      // Voter 1: Mongo -> Postgres
      // Voter 2: Postgres -> Mongo
      // Round 1: Mongo: 1, Postgres: 1 (50% each, neither > 50%).
      // Exact tie!
      const twoOptions: VoteOption[] = [
        { id: "opt_mongo", text: "MongoDB" },
        { id: "opt_postgres", text: "PostgreSQL" },
      ];

      const ballots: AnonymousBallot[] = [
        { _id: "b1", voteId: "v1", mode: "RANKED_CHOICE", payload: { rankedOptionIds: ["opt_mongo", "opt_postgres"] }, receiptHash: "h1" },
        { _id: "b2", voteId: "v1", mode: "RANKED_CHOICE", payload: { rankedOptionIds: ["opt_postgres", "opt_mongo"] }, receiptHash: "h2" },
      ];

      const res = calculateRankedChoiceResult(twoOptions, ballots);
      expect(res.isTie).toBe(true);
      expect(res.winnerOptionId).toBeNull();
      expect(res.tiedOptionIds).toEqual(["opt_mongo", "opt_postgres"]);
    });

    it("handles 0 ballots gracefully in ranked choice", () => {
      const res = calculateRankedChoiceResult(sampleOptions, []);
      expect(res.totalBallots).toBe(0);
      expect(res.winnerOptionId).toBeNull();
      expect(res.isTie).toBe(false);
    });
  });

  // ─── Mode C: Approval Voting ───────────────────────────────

  describe("calculateApprovalResult", () => {
    it("determines winner by highest approval count", () => {
      const ballots: AnonymousBallot[] = [
        { _id: "b1", voteId: "v1", mode: "APPROVAL", payload: { selectedOptionIds: ["opt_mongo", "opt_postgres"] }, receiptHash: "h1" },
        { _id: "b2", voteId: "v1", mode: "APPROVAL", payload: { selectedOptionIds: ["opt_mongo"] }, receiptHash: "h2" },
        { _id: "b3", voteId: "v1", mode: "APPROVAL", payload: { selectedOptionIds: ["opt_postgres", "opt_mysql"] }, receiptHash: "h3" },
        { _id: "b4", voteId: "v1", mode: "APPROVAL", payload: { selectedOptionIds: ["opt_mongo", "opt_mysql"] }, receiptHash: "h4" },
      ];

      const res = calculateApprovalResult(sampleOptions, ballots);
      expect(res.totalBallots).toBe(4);
      expect(res.optionCounts["opt_mongo"]).toBe(3);
      expect(res.optionCounts["opt_postgres"]).toBe(2);
      expect(res.optionCounts["opt_mysql"]).toBe(2);
      expect(res.winnerOptionId).toBe("opt_mongo");
      expect(res.isTie).toBe(false);
    });

    it("detects tied approvals and reports a tie", () => {
      const ballots: AnonymousBallot[] = [
        { _id: "b1", voteId: "v1", mode: "APPROVAL", payload: { selectedOptionIds: ["opt_mongo", "opt_postgres"] }, receiptHash: "h1" },
        { _id: "b2", voteId: "v1", mode: "APPROVAL", payload: { selectedOptionIds: ["opt_mongo", "opt_postgres"] }, receiptHash: "h2" },
      ];

      const res = calculateApprovalResult(sampleOptions, ballots);
      expect(res.totalBallots).toBe(2);
      expect(res.isTie).toBe(true);
      expect(res.winnerOptionId).toBeNull();
      expect(res.tiedOptionIds).toEqual(["opt_mongo", "opt_postgres"]);
    });
  });

  // ─── Ballot Validation ──────────────────────────────────────

  describe("validateBallot", () => {
    it("validates Multiple Choice ballots properly", () => {
      expect(validateBallot("MULTIPLE_CHOICE", sampleOptions, { selectedOptionId: "opt_mongo" }).valid).toBe(true);
      expect(validateBallot("MULTIPLE_CHOICE", sampleOptions, { selectedOptionId: "opt_invalid" }).valid).toBe(false);
      expect(validateBallot("MULTIPLE_CHOICE", sampleOptions, {}).valid).toBe(false);
    });

    it("validates Approval ballots properly", () => {
      expect(validateBallot("APPROVAL", sampleOptions, { selectedOptionIds: ["opt_mongo", "opt_postgres"] }).valid).toBe(true);
      expect(validateBallot("APPROVAL", sampleOptions, { selectedOptionIds: [] }).valid).toBe(false);
      expect(validateBallot("APPROVAL", sampleOptions, { selectedOptionIds: ["opt_mongo", "opt_mongo"] }).valid).toBe(false);
      expect(validateBallot("APPROVAL", sampleOptions, { selectedOptionIds: ["fake"] }).valid).toBe(false);
    });

    it("validates Ranked Choice ballots properly", () => {
      expect(validateBallot("RANKED_CHOICE", sampleOptions, { rankedOptionIds: ["opt_postgres", "opt_mongo", "opt_mysql"] }).valid).toBe(true);
      // Missing an option
      expect(validateBallot("RANKED_CHOICE", sampleOptions, { rankedOptionIds: ["opt_postgres", "opt_mongo"] }).valid).toBe(false);
      // Duplicate rankings
      expect(validateBallot("RANKED_CHOICE", sampleOptions, { rankedOptionIds: ["opt_postgres", "opt_mongo", "opt_mongo"] }).valid).toBe(false);
    });

    it("enforces opinion length limits", () => {
      const longComment = "a".repeat(1001);
      const res = validateBallot("MULTIPLE_CHOICE", sampleOptions, { selectedOptionId: "opt_mongo" }, longComment);
      expect(res.valid).toBe(false);
      expect(res.error).toContain("1000 characters");
    });
  });

  // ─── Option Set Validation ──────────────────────────────────

  describe("validateVoteOptions", () => {
    it("accepts valid options and generates IDs", () => {
      const res = validateVoteOptions([{ text: "Alpha" }, { text: "Beta" }]);
      expect(res.valid).toBe(true);
      expect(res.cleanOptions?.length).toBe(2);
      expect(res.cleanOptions?.[0].id).toBe("opt_1");
    });

    it("rejects fewer than 2 options", () => {
      const res = validateVoteOptions([{ text: "Single" }]);
      expect(res.valid).toBe(false);
    });

    it("rejects duplicate options case-insensitively", () => {
      const res = validateVoteOptions([{ text: "Option A" }, { text: "option a" }]);
      expect(res.valid).toBe(false);
      expect(res.error).toContain("Duplicate option");
    });

    it("rejects blank option text", () => {
      const res = validateVoteOptions([{ text: "Valid" }, { text: "   " }]);
      expect(res.valid).toBe(false);
    });
  });

  // ─── Lifecycle & Deadline ───────────────────────────────────

  describe("isVoteOpen and getVoteTimeRemaining", () => {
    it("reports open when status is OPEN and deadline is in the future", () => {
      const future = new Date(Date.now() + 3600 * 1000);
      expect(isVoteOpen({ status: "OPEN", closesAt: future })).toBe(true);
    });

    it("reports closed when status is OPEN but deadline has passed", () => {
      const past = new Date(Date.now() - 3600 * 1000);
      expect(isVoteOpen({ status: "OPEN", closesAt: past })).toBe(false);
    });

    it("reports open indefinitely when closesAt is null", () => {
      expect(isVoteOpen({ status: "OPEN", closesAt: null })).toBe(true);
      const tr = getVoteTimeRemaining(null);
      expect(tr.label).toBe("No deadline");
      expect(tr.isExpired).toBe(false);
    });

    it("reports deadline reached when expired", () => {
      const past = new Date(Date.now() - 1000);
      const tr = getVoteTimeRemaining(past);
      expect(tr.isExpired).toBe(true);
      expect(tr.label).toBe("Deadline reached");
    });
  });

  // ─── Receipt Hashing ────────────────────────────────────────

  describe("Receipt Token & Hashing", () => {
    it("generates a secure receipt token starting with rcpt_", () => {
      const token = generateReceiptToken();
      expect(token.startsWith("rcpt_")).toBe(true);
      expect(token.length).toBeGreaterThan(20);
    });

    it("produces deterministic SHA-256 hash for receipts", () => {
      const token = "rcpt_test_secret_123";
      const hash1 = hashReceiptToken(token);
      const hash2 = hashReceiptToken(token);
      expect(hash1).toBe(hash2);
      expect(hash1).toHaveLength(64);
    });
  });

  // ─── Slug Validation ────────────────────────────────────────

  describe("validateCustomSlug", () => {
    it("accepts valid URL slugs", () => {
      expect(validateCustomSlug("database-choice-2026").valid).toBe(true);
      expect(validateCustomSlug("team-lunch").valid).toBe(true);
      expect(validateCustomSlug("8fk29a").valid).toBe(true);
    });

    it("rejects reserved slugs", () => {
      expect(validateCustomSlug("new").valid).toBe(false);
      expect(validateCustomSlug("api").valid).toBe(false);
      expect(validateCustomSlug("closed").valid).toBe(false);
    });

    it("rejects slugs with invalid characters or too short", () => {
      expect(validateCustomSlug("ab").valid).toBe(false);
      expect(validateCustomSlug("invalid slug!").valid).toBe(false);
    });
  });
});
