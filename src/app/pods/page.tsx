import Link from "next/link";
import { redirect } from "next/navigation";
import { requireCurrentUser } from "@/lib/auth/session";
import {
  getAllPods,
  getPodTaskStats,
} from "@/server/repositories/pods.repository";
import { getAllUsers } from "@/server/repositories/users.repository";
import { ThemeToggle } from "@/components/theme-toggle";
import { SASTRANetLogo } from "@/components/SASTRANetLogo";

export default async function PodsPage() {
  try {
    await requireCurrentUser();
  } catch {
    redirect("/login?callbackUrl=/pods");
  }

  const [pods, users] = await Promise.all([getAllPods(), getAllUsers()]);
  const people = new Map(users.map((user) => [user._id.toString(), user]));
  const podsWithStats = await Promise.all(
    pods.map(async (pod) => ({
      pod,
      stats: await getPodTaskStats(pod._id.toString()),
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
            className="text-[var(--color-text-primary)] transition hover:text-[var(--color-brand)]"
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

      <header className="mt-8">
        <p className="font-mono text-xs font-semibold uppercase tracking-[0.18em] text-[var(--color-brand)]">
          Team structure
        </p>
        <h1 className="mt-3 font-[family-name:var(--font-outfit)] text-4xl font-bold tracking-tight text-[var(--color-text-primary)] sm:text-5xl">
          Pods
        </h1>
        <p className="mt-3 text-sm text-[var(--color-text-secondary)]">
          Last edited{" "}
          {new Intl.DateTimeFormat("en-IN", {
            month: "short",
            day: "numeric",
            year: "numeric",
          }).format(new Date())}
        </p>
      </header>

      <section className="mt-10 grid gap-5 md:grid-cols-3">
        {podsWithStats.map(({ pod, stats }) => (
          <article
            className="rounded-3xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6 shadow-sm transition-colors"
            key={pod._id.toString()}
          >
            <h2 className="text-2xl font-bold text-[var(--color-text-primary)]">
              {pod.name}
            </h2>
            <p className="mt-6 font-mono text-xs uppercase tracking-[0.12em] text-[var(--color-text-secondary)]">
              Lead
            </p>
            <p className="mt-1 font-bold text-[var(--color-text-primary)]">
              {pod.leadId
                ? people.get(pod.leadId)?.name ?? "Unassigned"
                : "Unassigned"}
            </p>
            <p className="mt-6 font-mono text-xs uppercase tracking-[0.12em] text-[var(--color-text-secondary)]">
              Members
            </p>
            <ul className="mt-2 space-y-1 text-sm text-[var(--color-text-primary)]">
              {pod.memberIds.map((id) => (
                <li key={id}>{people.get(id)?.name ?? "Unknown member"}</li>
              ))}
            </ul>
            <p className="mt-6 border-t border-[var(--color-divider)] pt-4 text-sm text-[var(--color-text-secondary)]">
              {stats.active} active · {stats.completed} completed
            </p>
          </article>
        ))}
      </section>
    </main>
  );
}
