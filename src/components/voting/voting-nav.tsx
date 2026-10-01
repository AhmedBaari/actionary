"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ThemeToggle } from "@/components/theme-toggle";

export function VotingNav() {
  const pathname = usePathname();

  const links = [
    { href: "/", label: "Board" },
    { href: "/pods", label: "Pods" },
    { href: "/ideas", label: "Ideas" },
    { href: "/feedback", label: "Feedback" },
    { href: "/voting", label: "Voting" },
  ];

  return (
    <nav className="mb-10 flex items-center justify-between rounded-full border border-[var(--color-border)] bg-[var(--color-surface)]/90 px-6 py-3.5 shadow-sm backdrop-blur transition-colors">
      <Link
        className="font-[family-name:var(--font-outfit)] text-xl font-bold tracking-tight text-[var(--color-text-primary)]"
        href="/"
      >
        Sastra<span className="text-[var(--color-brand)]">Net</span>
      </Link>
      <div className="flex items-center gap-5 text-sm font-semibold text-[var(--color-text-secondary)]">
        {links.map(({ href, label }) => {
          const isActive =
            href === "/voting"
              ? pathname.startsWith("/voting")
              : pathname === href;
          return (
            <Link
              key={href}
              className={`transition hover:text-[var(--color-text-primary)] ${
                isActive
                  ? "text-[var(--color-brand)] font-bold"
                  : ""
              }`}
              href={href}
            >
              {label}
            </Link>
          );
        })}
        <div className="pl-2 border-l border-[var(--color-border)]">
          <ThemeToggle />
        </div>
      </div>
    </nav>
  );
}
