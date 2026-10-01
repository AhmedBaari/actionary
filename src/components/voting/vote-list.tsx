"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  Clock,
  Plus,
  Search,
  Vote,
  CheckCircle2,
  ListOrdered,
  CheckSquare,
  Radio,
  XCircle,
  Archive,
} from "lucide-react";
import type { VoteView, VotingMode } from "@/types/voting";
import { getVoteTimeRemaining } from "@/lib/voting-domain";

export function VoteList({ initialVotes }: { initialVotes: VoteView[] }) {
  const [activeTab, setActiveTab] = useState<"ALL" | "OPEN" | "CLOSED">("ALL");
  const [search, setSearch] = useState("");
  const [modeFilter, setModeFilter] = useState<"ALL" | VotingMode>("ALL");

  const filteredVotes = useMemo(() => {
    return initialVotes.filter((vote) => {
      // Tab filter
      if (activeTab === "OPEN" && vote.status !== "OPEN") return false;
      if (activeTab === "CLOSED" && vote.status !== "CLOSED") return false;

      // Mode filter
      if (modeFilter !== "ALL" && vote.mode !== modeFilter) return false;

      // Search query
      if (search.trim()) {
        const q = search.toLowerCase();
        const matchesTitle = vote.title.toLowerCase().includes(q);
        const matchesDesc = (vote.description || "").toLowerCase().includes(q);
        const matchesCreator = (vote.creatorName || "").toLowerCase().includes(q);
        if (!matchesTitle && !matchesDesc && !matchesCreator) return false;
      }

      return true;
    });
  }, [initialVotes, activeTab, modeFilter, search]);

  const openCount = initialVotes.filter((v) => v.status === "OPEN").length;
  const closedCount = initialVotes.filter((v) => v.status === "CLOSED").length;

  return (
    <div className="space-y-6">
      {/* Controls Bar: Search + Filter Tabs + Create Button */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        {/* Tabs */}
        <div className="flex items-center gap-1.5 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-1.5 shadow-xs">
          <button
            onClick={() => setActiveTab("ALL")}
            className={`cursor-pointer rounded-xl px-4 py-2 text-xs font-bold transition ${
              activeTab === "ALL"
                ? "bg-[var(--color-text-primary)] text-[var(--color-primary-button-text)] shadow-xs"
                : "text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
            }`}
          >
            All ({initialVotes.length})
          </button>
          <button
            onClick={() => setActiveTab("OPEN")}
            className={`cursor-pointer rounded-xl px-4 py-2 text-xs font-bold transition ${
              activeTab === "OPEN"
                ? "bg-[var(--color-text-primary)] text-[var(--color-primary-button-text)] shadow-xs"
                : "text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
            }`}
          >
            Open ({openCount})
          </button>
          <button
            onClick={() => setActiveTab("CLOSED")}
            className={`cursor-pointer rounded-xl px-4 py-2 text-xs font-bold transition ${
              activeTab === "CLOSED"
                ? "bg-[var(--color-text-primary)] text-[var(--color-primary-button-text)] shadow-xs"
                : "text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
            }`}
          >
            Closed ({closedCount})
          </button>
        </div>

        {/* Search and Mode Filter */}
        <div className="flex flex-1 items-center gap-3 sm:max-w-md">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--color-text-secondary)]" />
            <input
              type="text"
              placeholder="Search votes by title or description..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] py-2.5 pl-10 pr-4 text-xs font-medium text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus:border-[var(--color-brand)] focus:outline-hidden transition"
            />
          </div>

          <Link
            href="/voting/new"
            className="flex items-center gap-2 shrink-0 rounded-2xl bg-[var(--color-brand)] px-4 py-2.5 text-xs font-bold text-white shadow-sm hover:opacity-90 active:scale-95 transition"
          >
            <Plus className="h-4 w-4" />
            <span>Create Vote</span>
          </Link>
        </div>
      </div>

      {/* Mode Filter Chips */}
      <div className="flex flex-wrap items-center gap-2 pt-1 text-xs">
        <span className="font-mono text-[11px] font-semibold uppercase tracking-wider text-[var(--color-text-muted)] mr-1">
          Mode:
        </span>
        {[
          { id: "ALL", label: "All Modes" },
          { id: "MULTIPLE_CHOICE", label: "Multiple Choice" },
          { id: "RANKED_CHOICE", label: "Ranked Choice" },
          { id: "APPROVAL", label: "Approval" },
        ].map((m) => (
          <button
            key={m.id}
            onClick={() => setModeFilter(m.id as any)}
            className={`cursor-pointer rounded-full px-3 py-1 text-xs font-medium transition border ${
              modeFilter === m.id
                ? "border-[var(--color-brand)] bg-[var(--color-brand)]/10 text-[var(--color-brand)] font-semibold"
                : "border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
            }`}
          >
            {m.label}
          </button>
        ))}
      </div>

      {/* Vote Cards Grid */}
      {filteredVotes.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-[var(--color-border)] bg-[var(--color-surface)]/50 p-12 text-center">
          <Vote className="mx-auto h-12 w-12 text-[var(--color-text-muted)] opacity-50 mb-3" />
          <h3 className="font-[family-name:var(--font-outfit)] text-lg font-bold text-[var(--color-text-primary)]">
            No votes found
          </h3>
          <p className="mt-1 text-xs text-[var(--color-text-secondary)] max-w-sm mx-auto">
            {search
              ? "No votes matched your search filter. Try clearing the search term."
              : "No votes in this category yet. Be the first to start a vote for the team!"}
          </p>
          {!search && (
            <Link
              href="/voting/new"
              className="mt-5 inline-flex items-center gap-2 rounded-2xl bg-[var(--color-brand)] px-4 py-2 text-xs font-bold text-white shadow-sm hover:opacity-90 transition"
            >
              <Plus className="h-4 w-4" />
              Create First Vote
            </Link>
          )}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filteredVotes.map((vote) => (
            <VoteCard key={vote.id} vote={vote} />
          ))}
        </div>
      )}
    </div>
  );
}

function VoteCard({ vote }: { vote: VoteView }) {
  const timeRemaining = getVoteTimeRemaining(vote.closesAt);
  const isClosed = vote.status === "CLOSED";
  const isCancelled = vote.closeReason === "CANCELLED";

  // Mode badge styling
  const modeMeta: Record<
    VotingMode,
    { label: string; icon: any; colorClass: string }
  > = {
    MULTIPLE_CHOICE: {
      label: "Multiple Choice",
      icon: Radio,
      colorClass: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-900/50",
    },
    RANKED_CHOICE: {
      label: "Ranked Choice",
      icon: ListOrdered,
      colorClass: "bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-200 dark:border-purple-900/50",
    },
    APPROVAL: {
      label: "Approval",
      icon: CheckSquare,
      colorClass: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-900/50",
    },
  };

  const modeInfo = modeMeta[vote.mode];
  const ModeIcon = modeInfo.icon;

  return (
    <Link
      href={`/voting/${vote.slug}`}
      className="group flex flex-col justify-between rounded-3xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5 shadow-xs transition duration-200 hover:border-[var(--color-brand)]/60 hover:shadow-md hover:-translate-y-0.5"
    >
      <div>
        {/* Top Badges */}
        <div className="flex items-center justify-between gap-2 mb-3">
          <span
            className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${modeInfo.colorClass}`}
          >
            <ModeIcon className="h-3 w-3" />
            {modeInfo.label}
          </span>

          {/* Status Badge */}
          {isCancelled ? (
            <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 dark:border-amber-900/50 bg-amber-500/10 px-2 py-0.5 text-[10px] font-bold text-amber-600 dark:text-amber-400">
              <XCircle className="h-3 w-3" />
              Cancelled
            </span>
          ) : isClosed ? (
            <span className="inline-flex items-center gap-1 rounded-full border border-zinc-200 dark:border-zinc-800 bg-zinc-500/10 px-2 py-0.5 text-[10px] font-bold text-[var(--color-text-secondary)]">
              <Archive className="h-3 w-3" />
              Closed
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 dark:border-emerald-900/50 bg-emerald-500/10 px-2.5 py-0.5 text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Open
            </span>
          )}
        </div>

        {/* Title */}
        <h3 className="font-[family-name:var(--font-outfit)] text-base font-bold text-[var(--color-text-primary)] group-hover:text-[var(--color-brand)] transition line-clamp-2">
          {vote.title}
        </h3>

        {/* Description snippet */}
        {vote.description ? (
          <p className="mt-2 text-xs leading-5 text-[var(--color-text-secondary)] line-clamp-2">
            {vote.description}
          </p>
        ) : null}

        {/* Options Preview */}
        <div className="mt-3 flex flex-wrap gap-1">
          {vote.options.slice(0, 3).map((opt) => (
            <span
              key={opt.id}
              className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface-elevated)] px-2 py-0.5 text-[10px] font-medium text-[var(--color-text-secondary)]"
            >
              {opt.text}
            </span>
          ))}
          {vote.options.length > 3 && (
            <span className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface-elevated)] px-1.5 py-0.5 text-[10px] font-medium text-[var(--color-text-muted)]">
              +{vote.options.length - 3} more
            </span>
          )}
        </div>
      </div>

      {/* Footer Info */}
      <div className="mt-5 pt-3.5 border-t border-[var(--color-divider)] flex items-center justify-between text-[11px] text-[var(--color-text-secondary)]">
        <div className="flex items-center gap-1.5">
          <Vote className="h-3.5 w-3.5 text-[var(--color-brand)]" />
          <span className="font-semibold text-[var(--color-text-primary)]">
            {vote.totalVotes} {vote.totalVotes === 1 ? "vote" : "votes"}
          </span>
          {vote.hasVoted && (
            <span className="ml-1 inline-flex items-center gap-0.5 rounded-full bg-emerald-500/10 px-1.5 py-0.2 text-[9px] font-bold text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="h-2.5 w-2.5" />
              Voted
            </span>
          )}
        </div>

        <div className="flex items-center gap-1 font-mono text-[10px]">
          <Clock className="h-3 w-3 text-[var(--color-text-muted)]" />
          <span
            className={
              !isClosed && timeRemaining.secondsRemaining < 3600 && timeRemaining.secondsRemaining > 0
                ? "text-amber-500 font-bold"
                : ""
            }
          >
            {isClosed ? "Ended" : timeRemaining.label}
          </span>
        </div>
      </div>
    </Link>
  );
}
