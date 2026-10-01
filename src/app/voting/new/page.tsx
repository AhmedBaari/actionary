import { redirect } from "next/navigation";
import { requireCurrentUser } from "@/lib/auth/session";
import { VotingNav } from "@/components/voting/voting-nav";
import { CreateVoteForm } from "@/components/voting/create-vote-form";

export const metadata = {
  title: "Create Vote — SastraNet",
  description: "Create and immediately open a new vote for the workspace.",
};

export default async function NewVotePage() {
  try {
    await requireCurrentUser();
  } catch {
    redirect("/login?callbackUrl=/voting/new");
  }

  return (
    <main className="mx-auto min-h-screen max-w-4xl px-5 py-8 sm:px-10">
      {/* Navigation */}
      <VotingNav />

      {/* Page Header */}
      <header className="mt-8 mb-8">
        <p className="font-mono text-xs font-semibold uppercase tracking-[0.18em] text-[var(--color-brand)]">
          Decisions & Consensus
        </p>
        <h1 className="mt-2 font-[family-name:var(--font-outfit)] text-3xl font-bold tracking-tight text-[var(--color-text-primary)] sm:text-4xl">
          Create a Vote
        </h1>
        <p className="mt-2 text-xs leading-relaxed text-[var(--color-text-secondary)]">
          Any authenticated member can initiate a vote. The vote will open immediately with no draft or approval step.
        </p>
      </header>

      {/* Creation Form */}
      <CreateVoteForm />
    </main>
  );
}
