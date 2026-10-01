import { describe, expect, it, beforeAll } from "vitest";
import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
dotenv.config();

import {
  cancelVoteService,
  castVoteService,
  closeVoteService,
  createVoteService,
  editVoteService,
  getVoteDetailsService,
  verifyReceiptService,
} from "../voting.service";
import { getDb } from "@/lib/db/client";

describe("Voting Service Full Integration Tests", () => {
  let db: any;

  beforeAll(async () => {
    db = await getDb();
  });

  it("creates a vote, casts ballots, enforces 1 vote per member, and verifies receipts", async () => {
    // 1. Create a vote
    const testActorId = "test_user_integration_1";
    const testActorName = "Integration Tester";

    const vote = await createVoteService({
      title: "Integration Test Vote: Framework Evaluation",
      description: "Testing end-to-end creation, casting, and receipt verification",
      mode: "MULTIPLE_CHOICE",
      options: [
        { id: "opt_next", text: "Next.js" },
        { id: "opt_remix", text: "Remix" },
        { id: "opt_astro", text: "Astro" },
      ],
      customSlug: `int-test-${Date.now()}`,
      actorId: testActorId,
      actorName: testActorName,
    });

    expect(vote.id).toBeDefined();
    expect(vote.status).toBe("OPEN");
    expect(vote.totalVotes).toBe(0);

    // 2. Cast ballot from Member 1
    const voter1Id = "member_alpha_1";
    const castRes1 = await castVoteService({
      voteIdOrSlug: vote.slug,
      memberId: voter1Id,
      payload: { selectedOptionId: "opt_next" },
      opinion: "Next.js provides App Router with RSCs.",
    });

    expect(castRes1.success).toBe(true);
    expect(castRes1.receiptToken.startsWith("rcpt_")).toBe(true);

    // 3. Attempt duplicate vote from Member 1 -> MUST BE REJECTED!
    await expect(
      castVoteService({
        voteIdOrSlug: vote.slug,
        memberId: voter1Id,
        payload: { selectedOptionId: "opt_remix" },
      })
    ).rejects.toThrow("already voted");

    // 4. Verify Privacy Separation in MongoDB Collections directly:
    // Participation collection must contain voter1Id, but NO choice or receipt!
    const partDoc = await db.collection("voteParticipation").findOne({
      voteId: vote.id,
      memberId: voter1Id,
    });
    expect(partDoc).not.toBeNull();
    expect(partDoc.selectedOptionId).toBeUndefined();
    expect(partDoc.payload).toBeUndefined();
    expect(partDoc.receiptHash).toBeUndefined();
    expect(partDoc.ballotId).toBeUndefined();

    // Anonymous ballots collection must contain the choice, but NO voter1Id!
    const ballotDocs = await db
      .collection("anonymousBallots")
      .find({ voteId: vote.id })
      .toArray();
    expect(ballotDocs.length).toBe(1);
    expect(ballotDocs[0].payload.selectedOptionId).toBe("opt_next");
    expect(ballotDocs[0].opinion).toBe("Next.js provides App Router with RSCs.");
    expect(ballotDocs[0].memberId).toBeUndefined();
    expect(ballotDocs[0].userId).toBeUndefined();

    // 5. Verify Receipt without exposing user identity
    const receiptCheck = await verifyReceiptService(vote.slug, castRes1.receiptToken);
    expect(receiptCheck.valid).toBe(true);
    expect(receiptCheck.payload?.selectedOptionId).toBe("opt_next");
    expect(receiptCheck.opinion).toBe("Next.js provides App Router with RSCs.");
    expect((receiptCheck as any).memberId).toBeUndefined();

    // Invalid receipt
    const fakeCheck = await verifyReceiptService(vote.slug, "rcpt_nonexistent_token");
    expect(fakeCheck.valid).toBe(false);

    // 6. Member 2 votes
    const voter2Id = "member_beta_2";
    await castVoteService({
      voteIdOrSlug: vote.slug,
      memberId: voter2Id,
      payload: { selectedOptionId: "opt_astro" },
    });

    // Details before 3 votes: voterNames must be hidden!
    const detailsBefore3 = await getVoteDetailsService(vote.slug, voter1Id);
    expect(detailsBefore3?.summary?.totalVotes).toBe(2);
    expect(detailsBefore3?.summary?.voterNames).toBeNull();
    expect(detailsBefore3?.summary?.votersHiddenNotice).toContain("at least 3 votes");

    // 7. Member 3 votes -> Threshold reached (>= 3 votes)!
    const voter3Id = "member_gamma_3";
    await castVoteService({
      voteIdOrSlug: vote.slug,
      memberId: voter3Id,
      payload: { selectedOptionId: "opt_next" },
    });

    const detailsAt3 = await getVoteDetailsService(vote.slug, voter1Id);
    expect(detailsAt3?.summary?.totalVotes).toBe(3);
    expect(detailsAt3?.summary?.voterNames).not.toBeNull();
    expect(detailsAt3?.summary?.voterNames?.length).toBe(3);
    expect(detailsAt3?.summary?.result.winnerOptionId).toBe("opt_next");

    // 8. Close vote
    await closeVoteService(vote.slug, "MANUAL", testActorId, testActorName);

    const closedDetails = await getVoteDetailsService(vote.slug);
    expect(closedDetails?.vote.status).toBe("CLOSED");

    // 9. Attempt vote on closed vote -> REJECTED!
    await expect(
      castVoteService({
        voteIdOrSlug: vote.slug,
        memberId: "member_late_4",
        payload: { selectedOptionId: "opt_remix" },
      })
    ).rejects.toThrow("closed");

    // Clean up test documents
    await db.collection("votes").deleteOne({ _id: vote.id });
    await db.collection("voteParticipation").deleteMany({ voteId: vote.id });
    await db.collection("anonymousBallots").deleteMany({ voteId: vote.id });
  });
});
