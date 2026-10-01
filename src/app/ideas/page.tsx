import Link from "next/link";
import { redirect } from "next/navigation";
import { requireCurrentUser } from "@/lib/auth/session";
import { getActiveIdeas } from "@/server/repositories/ideas.repository";
import { ThemeToggle } from "@/components/theme-toggle";
import { SASTRANetLogo } from "@/components/SASTRANetLogo";

export default async function IdeasPage() {
  try {
    await requireCurrentUser();
  } catch {
    redirect("/login?callbackUrl=/ideas");
  }

  const ideas = await getActiveIdeas();

  return (
    <main className="mx-auto min-h-screen max-w-5xl px-5 py-8 sm:px-10">
      {/* Navigation */}
      <nav className="mb-12 flex items-center justify-between rounded-full border border-[var(--color-border)] bg-[var(--color-surface)]/90 px-6 py-3.5 shadow-sm backdrop-blur transition-colors">
        <Link
          className="font-[family-name:var(--font-outfit)] text-xl font-bold tracking-tight text-[var(--color-text-primary)]"
          href="/"
        >
          <SASTRANetLogo size={30} />
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
            className="text-[var(--color-text-primary)] transition hover:text-[var(--color-brand)]"
            href="/ideas"
          >
            Ideas
          </Link>
          <Link
            className="transition hover:text-[var(--color-text-primary)]"
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

      <header className="mt-8 max-w-2xl">
        <p className="font-mono text-xs font-semibold uppercase tracking-[0.18em] text-[var(--color-brand)]">
          Ideas
        </p>
        <h1 className="mt-3 font-[family-name:var(--font-outfit)] text-4xl font-bold tracking-tight text-[var(--color-text-primary)] sm:text-5xl">
          Random Ideas
        </h1>
        <p className="mt-4 leading-7 text-[var(--color-text-secondary)]">
          A running list of ideas worth keeping until the team decides to build
          them.
        </p>
      </header>

      <section className="mt-10 grid gap-4 sm:grid-cols-2">
        {ideas.map((idea) => (
          <article
            className="rounded-3xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6 shadow-sm transition-colors"
            key={idea._id.toString()}
          >
            <p className="font-mono text-xs font-semibold text-[var(--color-brand)]">
              Captured{" "}
              {new Intl.DateTimeFormat("en-IN", {
                month: "short",
                day: "numeric",
              }).format(idea.createdAt)}
            </p>
            <h2 className="mt-3 text-xl font-bold text-[var(--color-text-primary)]">
              {idea.title}
            </h2>
            {idea.description ? (
              <p className="mt-3 text-sm leading-6 text-[var(--color-text-secondary)]">
                {idea.description}
              </p>
            ) : null}
          </article>
        ))}
        {ideas.length === 0 ? (
          <p className="text-[var(--color-text-secondary)]">
            No ideas yet. Capture the next spark from the board.
          </p>
        ) : null}
      </section>
    </main>
  );
}
