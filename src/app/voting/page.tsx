import { redirect } from "next/navigation";
import { requireCurrentUser } from "@/lib/auth/session";
import { listVotesService } from "@/server/services/voting.service";
import { VotingNav } from "@/components/voting/voting-nav";
import { VoteList } from "@/components/voting/vote-list";

export const metadata = {
  title: "Voting — SastraNet",
  description: "Anonymous, decentralized decision-making for the team.",
};

export default async function VotingPage() {
  let user;
  try {
    user = await requireCurrentUser();
  } catch {
    redirect("/login?callbackUrl=/voting");
  }

  const votes = await listVotesService("ALL", undefined, user._id.toString());

  return (
    <main className="mx-auto min-h-screen max-w-5xl px-5 py-8 sm:px-10">
      {/* Navigation */}
      <VotingNav />

      {/* Page Header */}
      <header className="mt-8 mb-10">
        <p className="font-mono text-xs font-semibold uppercase tracking-[0.18em] text-[var(--color-brand)]">
          Decisions & Consensus
        </p>
        <h1 className="mt-2 font-[family-name:var(--font-outfit)] text-4xl font-bold tracking-tight text-[var(--color-text-primary)] sm:text-5xl">
          Voting
        </h1>
        <p className="mt-3 max-w-xl text-sm leading-relaxed text-[var(--color-text-secondary)]">
          Decentralized, anonymous decision-making for the team. Any member can create a vote, participate with an anonymous ballot, and verify outcomes with cryptographic receipts.
        </p>
      </header>

      {/* Main Votes Content */}
      <VoteList initialVotes={votes} />
    </main>
  );
}
