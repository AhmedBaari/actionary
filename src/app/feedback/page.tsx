import Link from "next/link";
import { redirect } from "next/navigation";
import { requireCurrentUser } from "@/lib/auth/session";
import {
  getAllFeedbackCycles,
  getCompletedReviewerIds,
} from "@/server/repositories/feedback.repository";
import { getAllUsers } from "@/server/repositories/users.repository";
import { ThemeToggle } from "@/components/theme-toggle";

export default async function FeedbackPage() {
  try {
    await requireCurrentUser();
  } catch {
    redirect("/login?callbackUrl=/feedback");
  }

  const [cycles, users] = await Promise.all([
    getAllFeedbackCycles(),
    getAllUsers(),
  ]);
  const people = new Map(users.map((user) => [user._id.toString(), user.name]));
  const progress = await Promise.all(
    cycles.map(async (cycle) => ({
      cycle,
      submitted: (await getCompletedReviewerIds(cycle._id.toString())).length,
    }))
  );

  return (
    <main className="mx-auto min-h-screen max-w-5xl px-5 py-8 sm:px-10">
      {/* Navigation */}
      <nav className="mb-12 flex items-center justify-between rounded-full border border-[var(--color-border)] bg-[var(--color-surface)]/90 px-6 py-3.5 shadow-sm backdrop-blur transition-colors">
        <Link
          className="font-[family-name:var(--font-outfit)] text-xl font-bold tracking-tight text-[var(--color-text-primary)]"
          href="/"
        >
          Sastra<span className="text-[var(--color-brand)]">Net</span>
        </Link>
        <div className="flex items-center gap-5 text-sm font-semibold text-[var(--color-text-secondary)]">
          <Link
            className="transition hover:text-[var(--color-text-primary)]"
            href="/"
          >
            Board
          </Link>
          <Link
            className="transition hover:text-[var(--color-text-primary)]"
            href="/pods"
          >
            Pods
          </Link>
          <Link
            className="transition hover:text-[var(--color-text-primary)]"
            href="/ideas"
          >
            Ideas
          </Link>
          <Link
            className="text-[var(--color-text-primary)] transition hover:text-[var(--color-brand)]"
            href="/feedback"
          >
            Feedback
          </Link>
          <Link
            className="transition hover:text-[var(--color-text-primary)]"
            href="/voting"
          >
            Voting
          </Link>
          <div className="pl-2 border-l border-[var(--color-border)]">
            <ThemeToggle />
          </div>
        </div>
      </nav>

      <header className="mt-8">
        <p className="font-mono text-xs font-semibold uppercase tracking-[0.18em] text-[var(--color-brand)]">
          Development
        </p>
        <h1 className="mt-3 font-[family-name:var(--font-outfit)] text-4xl font-bold tracking-tight text-[var(--color-text-primary)] sm:text-5xl">
          Feedback
        </h1>
        <p className="mt-4 max-w-xl leading-7 text-[var(--color-text-secondary)]">
          Constructive, thoughtful feedback cycles for the people doing the
          work.
        </p>
      </header>

      <section className="mt-10 space-y-4">
        {progress.map(({ cycle, submitted }) => (
          <article
            className="flex flex-wrap items-center justify-between gap-4 rounded-3xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6 shadow-sm transition-colors"
            key={cycle._id.toString()}
          >
            <div>
              <p className="font-mono text-xs uppercase tracking-[0.1em] text-[var(--color-brand)]">
                {cycle.status.replaceAll("_", " ")}
              </p>
              <h2 className="mt-2 text-xl font-bold text-[var(--color-text-primary)]">
                Feedback for{" "}
                {people.get(cycle.recipientId) ?? "a teammate"}
              </h2>
            </div>
            <p className="rounded-full border border-[var(--color-border)] bg-[var(--color-surface-elevated)] px-4 py-2 font-mono text-sm text-[var(--color-text-secondary)]">
              {submitted} / {cycle.reviewerIds.length} submitted
            </p>
          </article>
        ))}
        {progress.length === 0 ? (
          <p className="text-[var(--color-text-secondary)]">
            No feedback cycles have been started.
          </p>
        ) : null}
      </section>
    </main>
  );
}
