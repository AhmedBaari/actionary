"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  ArrowLeft,
  Check,
  CheckCircle2,
  Clock,
  Copy,
  ExternalLink,
  GripVertical,
  ListOrdered,
  Loader2,
  Lock,
  Radio,
  Search,
  Share2,
  ShieldCheck,
  Trophy,
  Users,
  Vote as VoteIcon,
  XCircle,
  CheckSquare,
  ChevronDown,
  ChevronUp,
  MessageSquare,
  Shield,
  HelpCircle,
} from "lucide-react";

import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

import {
  actionCancelVote,
  actionCastVote,
  actionCloseVote,
  actionEditVote,
  actionGetLiveResults,
  actionVerifyReceipt,
} from "@/server/actions/voting";
import { getVoteTimeRemaining } from "@/lib/voting-domain";
import type {
  MultipleChoiceResult,
  ApprovalResult,
  RankedChoiceResult,
  ReceiptVerificationResult,
  VoteOption,
  VoteResultsSummary,
  VoteView,
  VotingMode,
} from "@/types/voting";

interface VoteDetailViewProps {
  initialVote: VoteView;
  initialSummary?: VoteResultsSummary | null;
  currentUserId: string;
}

export function VoteDetailView({
  initialVote,
  initialSummary,
  currentUserId,
}: VoteDetailViewProps) {
  const router = useRouter();

  const [vote, setVote] = useState<VoteView>(initialVote);
  const [summary, setSummary] = useState<VoteResultsSummary | null>(
    initialSummary ?? null
  );

  // Voting input state
  const [selectedSingleOption, setSelectedSingleOption] = useState<string>("");
  const [selectedApprovals, setSelectedApprovals] = useState<Set<string>>(
    new Set()
  );
  const [rankedOptionIds, setRankedOptionIds] = useState<string[]>(
    initialVote.options.map((o) => o.id)
  );
  const [opinion, setOpinion] = useState<string>("");

  // Submission state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submissionError, setSubmissionError] = useState<string | null>(null);
  const [issuedReceipt, setIssuedReceipt] = useState<string | null>(null);
  const [hasCopiedReceipt, setHasCopiedReceipt] = useState(false);
  const [hasCopiedLink, setHasCopiedLink] = useState(false);

  // Verification modal / state
  const [verifyTokenInput, setVerifyTokenInput] = useState("");
  const [verificationResult, setVerificationResult] =
    useState<ReceiptVerificationResult | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);
  const [verifyError, setVerifyError] = useState<string | null>(null);

  // Edit modal state
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(vote.title);
  const [editDescription, setEditDescription] = useState(vote.description || "");
  const [editPending, setEditPending] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  // Live countdown state
  const [timeRemaining, setTimeRemaining] = useState(
    getVoteTimeRemaining(vote.closesAt)
  );

  useEffect(() => {
    const timer = setInterval(() => {
      const tr = getVoteTimeRemaining(vote.closesAt);
      setTimeRemaining(tr);
      if (tr.isExpired && vote.status === "OPEN") {
        setVote((prev) => ({ ...prev, status: "CLOSED", closeReason: "EXPIRED" }));
      }
    }, 1000);
    return () => clearInterval(timer);
  }, [vote.closesAt, vote.status]);

  // ─── Live Polling for Open Votes ───────────────────────────
  useEffect(() => {
    // Only poll when vote is OPEN and user has voted
    if (vote.status !== "OPEN" || !vote.hasVoted) return;

    let isMounted = true;

    const pollInterval = setInterval(async () => {
      // Pause polling if document tab is hidden
      if (typeof document !== "undefined" && document.visibilityState === "hidden") {
        return;
      }

      try {
        const res = await actionGetLiveResults(vote.slug);
        if (isMounted && res.success && res.data) {
          setSummary(res.data);
          setVote((prev) => ({
            ...prev,
            totalVotes: res.data!.totalVotes,
            status: res.data!.status,
            closeReason: res.data!.closeReason,
          }));
        }
      } catch (err) {
        // Silent poll error handling
      }
    }, 4000);

    return () => {
      isMounted = false;
      clearInterval(pollInterval);
    };
  }, [vote.slug, vote.status, vote.hasVoted]);

  // ─── DnD Sensors for Ranked Choice ─────────────────────────
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      setRankedOptionIds((items) => {
        const oldIndex = items.indexOf(active.id as string);
        const newIndex = items.indexOf(over.id as string);
        return arrayMove(items, oldIndex, newIndex);
      });
    }
  };

  const handleMoveRankItem = (index: number, direction: "up" | "down") => {
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= rankedOptionIds.length) return;
    setRankedOptionIds((items) => arrayMove(items, index, targetIndex));
  };

  // ─── Submit Ballot Handler ──────────────────────────────────
  const handleSubmitBallot = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmissionError(null);

    let payload: any = {};

    if (vote.mode === "MULTIPLE_CHOICE") {
      if (!selectedSingleOption) {
        setSubmissionError("Please select one option to vote.");
        return;
      }
      payload = { selectedOptionId: selectedSingleOption };
    } else if (vote.mode === "APPROVAL") {
      if (selectedApprovals.size === 0) {
        setSubmissionError("Please approve at least one option.");
        return;
      }
      payload = { selectedOptionIds: Array.from(selectedApprovals) };
    } else if (vote.mode === "RANKED_CHOICE") {
      payload = { rankedOptionIds };
    }

    setIsSubmitting(true);

    try {
      const res = await actionCastVote({
        voteIdOrSlug: vote.slug,
        payload,
        opinion: opinion.trim() || null,
      });

      if (!res.success) {
        setSubmissionError(res.error || "Failed to submit ballot.");
        setIsSubmitting(false);
        return;
      }

      setIssuedReceipt(res.data.receiptToken);
      setVote((prev) => ({
        ...prev,
        hasVoted: true,
        totalVotes: prev.totalVotes + 1,
      }));

      // Immediately fetch new summary/results
      const live = await actionGetLiveResults(vote.slug);
      if (live.success && live.data) {
        setSummary(live.data);
      }

      setIsSubmitting(false);
    } catch (err: any) {
      setSubmissionError(err.message || "An unexpected error occurred.");
      setIsSubmitting(false);
    }
  };

  // ─── Close / Cancel Handlers ────────────────────────────────
  const handleCloseVote = async () => {
    if (!confirm("Are you sure you want to close this vote? No further votes will be accepted.")) return;
    const res = await actionCloseVote(vote.slug);
    if (res.success) {
      setVote((prev) => ({ ...prev, status: "CLOSED", closeReason: "MANUAL" }));
      const live = await actionGetLiveResults(vote.slug);
      if (live.success && live.data) setSummary(live.data);
    } else {
      alert(res.error || "Failed to close vote.");
    }
  };

  const handleCancelVote = async () => {
    if (!confirm("Are you sure you want to cancel this vote? The vote will be permanently closed as Cancelled.")) return;
    const res = await actionCancelVote(vote.slug);
    if (res.success) {
      setVote((prev) => ({ ...prev, status: "CLOSED", closeReason: "CANCELLED" }));
      const live = await actionGetLiveResults(vote.slug);
      if (live.success && live.data) setSummary(live.data);
    } else {
      alert(res.error || "Failed to cancel vote.");
    }
  };

  // ─── Edit Vote Handler ──────────────────────────────────────
  const handleSaveEdit = async () => {
    setEditError(null);
    if (!editTitle.trim()) {
      setEditError("Title cannot be empty.");
      return;
    }
    setEditPending(true);
    const res = await actionEditVote({
      slugOrId: vote.slug,
      updates: {
        title: editTitle.trim(),
        description: editDescription.trim() || null,
      },
    });
    setEditPending(false);
    if (res.success) {
      setVote((prev) => ({
        ...prev,
        title: res.data.title,
        description: res.data.description,
      }));
      setIsEditing(false);
    } else {
      setEditError(res.error || "Failed to update vote.");
    }
  };

  // ─── Verify Receipt Handler ─────────────────────────────────
  const handleVerifyReceipt = async (e: React.FormEvent) => {
    e.preventDefault();
    setVerifyError(null);
    setVerificationResult(null);

    const token = verifyTokenInput.trim();
    if (!token) {
      setVerifyError("Please enter a receipt token.");
      return;
    }

    setIsVerifying(true);
    const res = await actionVerifyReceipt({
      voteIdOrSlug: vote.slug,
      receiptToken: token,
    });
    setIsVerifying(false);

    if (res.success) {
      setVerificationResult(res.data);
      if (!res.data.valid) {
        setVerifyError("No recorded anonymous ballot matched this receipt token.");
      }
    } else {
      setVerifyError(res.error || "Verification request failed.");
    }
  };

  // ─── Copy Link Handler ──────────────────────────────────────
  const handleCopyLink = () => {
    if (typeof window !== "undefined") {
      navigator.clipboard.writeText(window.location.href);
      setHasCopiedLink(true);
      setTimeout(() => setHasCopiedLink(false), 2000);
    }
  };

  const handleCopyReceipt = (token: string) => {
    if (typeof navigator !== "undefined") {
      navigator.clipboard.writeText(token);
      setHasCopiedReceipt(true);
      setTimeout(() => setHasCopiedReceipt(false), 2500);
    }
  };

  const isClosed = vote.status === "CLOSED";
  const isCancelled = vote.closeReason === "CANCELLED";
  const canEdit = !isClosed && vote.totalVotes === 0 && vote.createdBy === currentUserId;

  const optionMap = new Map(vote.options.map((o) => [o.id, o.text]));

  return (
    <div className="space-y-8">
      {/* ─── Breadcrumb & Actions Bar ─────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <Link
          href="/voting"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to all votes
        </Link>

        <div className="flex flex-wrap items-center gap-2">
          {/* Copy link */}
          <button
            onClick={handleCopyLink}
            className="cursor-pointer inline-flex items-center gap-1.5 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-1.5 text-xs font-bold text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition"
          >
            {hasCopiedLink ? (
              <>
                <Check className="h-3.5 w-3.5 text-emerald-500" />
                Copied!
              </>
            ) : (
              <>
                <Share2 className="h-3.5 w-3.5" />
                Share Link
              </>
            )}
          </button>

          {/* Edit (if allowed) */}
          {canEdit && (
            <button
              onClick={() => setIsEditing(true)}
              className="cursor-pointer inline-flex items-center gap-1.5 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-1.5 text-xs font-bold text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition"
            >
              Edit Vote
            </button>
          )}

          {/* Close vote (any member) */}
          {!isClosed && (
            <button
              onClick={handleCloseVote}
              className="cursor-pointer inline-flex items-center gap-1.5 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-1.5 text-xs font-bold text-[var(--color-text-secondary)] hover:text-red-500 hover:border-red-300 transition"
            >
              Close Vote
            </button>
          )}

          {/* Cancel vote (any member) */}
          {!isClosed && (
            <button
              onClick={handleCancelVote}
              className="cursor-pointer inline-flex items-center gap-1.5 rounded-xl border border-amber-200 dark:border-amber-900/50 bg-amber-500/10 px-3 py-1.5 text-xs font-bold text-amber-600 dark:text-amber-400 hover:opacity-80 transition"
            >
              Cancel
            </button>
          )}
        </div>
      </div>

      {/* ─── Header Card ───────────────────────────────────────── */}
      <header className="rounded-3xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6 sm:p-8 shadow-xs">
        {/* Status badges row */}
        <div className="flex flex-wrap items-center gap-2 mb-3">
          {/* Mode Badge */}
          <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--color-border)] bg-[var(--color-surface-elevated)] px-3 py-0.5 text-xs font-bold text-[var(--color-text-primary)]">
            {vote.mode === "MULTIPLE_CHOICE" && <Radio className="h-3.5 w-3.5 text-blue-500" />}
            {vote.mode === "RANKED_CHOICE" && <ListOrdered className="h-3.5 w-3.5 text-purple-500" />}
            {vote.mode === "APPROVAL" && <CheckSquare className="h-3.5 w-3.5 text-emerald-500" />}
            {vote.mode.replaceAll("_", " ")}
          </span>

          {/* Status Badge */}
          {isCancelled ? (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-200 dark:border-amber-900/50 bg-amber-500/10 px-3 py-0.5 text-xs font-bold text-amber-600 dark:text-amber-400">
              <XCircle className="h-3.5 w-3.5" />
              Cancelled
            </span>
          ) : isClosed ? (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-zinc-200 dark:border-zinc-800 bg-zinc-500/10 px-3 py-0.5 text-xs font-bold text-[var(--color-text-secondary)]">
              <Lock className="h-3.5 w-3.5" />
              Closed
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 dark:border-emerald-900/50 bg-emerald-500/10 px-3 py-0.5 text-xs font-bold text-emerald-600 dark:text-emerald-400">
              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
              Open for Voting
            </span>
          )}

          {/* Time Remaining Ticker */}
          <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--color-border)] bg-[var(--color-surface-elevated)] px-3 py-0.5 font-mono text-xs font-semibold text-[var(--color-text-secondary)]">
            <Clock className="h-3.5 w-3.5 text-[var(--color-text-muted)]" />
            {isClosed ? (isCancelled ? "Cancelled" : "Closed") : timeRemaining.label}
          </span>
        </div>

        {/* Title */}
        <h1 className="font-[family-name:var(--font-outfit)] text-2xl font-bold tracking-tight text-[var(--color-text-primary)] sm:text-3xl">
          {vote.title}
        </h1>

        {/* Description */}
        {vote.description && (
          <p className="mt-3 text-sm leading-relaxed text-[var(--color-text-secondary)] max-w-3xl whitespace-pre-wrap">
            {vote.description}
          </p>
        )}

        {/* Metadata footer */}
        <div className="mt-6 pt-4 border-t border-[var(--color-divider)] flex flex-wrap items-center justify-between gap-4 text-xs text-[var(--color-text-secondary)]">
          <div className="flex items-center gap-4">
            <span>
              Created by <strong className="text-[var(--color-text-primary)]">{vote.creatorName || "Teammate"}</strong>
            </span>
            <span>·</span>
            <span>
              {new Intl.DateTimeFormat("en-IN", {
                month: "short",
                day: "numeric",
                year: "numeric",
              }).format(new Date(vote.createdAt))}
            </span>
          </div>

          <div className="flex items-center gap-2 font-semibold">
            <VoteIcon className="h-4 w-4 text-[var(--color-brand)]" />
            <span>
              {vote.totalVotes} {vote.totalVotes === 1 ? "vote recorded" : "votes recorded"}
            </span>
          </div>
        </div>
      </header>

      {/* ─── Edit Modal ────────────────────────────────────────── */}
      {isEditing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div className="w-full max-w-lg rounded-3xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6 shadow-xl space-y-4">
            <h3 className="font-[family-name:var(--font-outfit)] text-lg font-bold text-[var(--color-text-primary)]">
              Edit Vote Details
            </h3>
            <p className="text-xs text-[var(--color-text-muted)]">
              You can update the title and context while 0 votes have been cast.
            </p>

            {editError && (
              <div className="text-xs text-red-500 font-medium">{editError}</div>
            )}

            <div>
              <label className="block text-xs font-bold text-[var(--color-text-secondary)] mb-1">
                Title
              </label>
              <input
                type="text"
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-elevated)] p-2.5 text-xs font-semibold text-[var(--color-text-primary)] focus:border-[var(--color-brand)] focus:outline-hidden"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-[var(--color-text-secondary)] mb-1">
                Description
              </label>
              <textarea
                rows={3}
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
                className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-elevated)] p-2.5 text-xs text-[var(--color-text-primary)] focus:border-[var(--color-brand)] focus:outline-hidden"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsEditing(false)}
                className="cursor-pointer rounded-xl px-4 py-2 text-xs font-bold text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={editPending}
                onClick={handleSaveEdit}
                className="cursor-pointer rounded-xl bg-[var(--color-brand)] px-4 py-2 text-xs font-bold text-white shadow-xs hover:opacity-90 disabled:opacity-50"
              >
                {editPending ? "Saving..." : "Save Changes"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── State 1: User Has NOT Voted & Vote is OPEN ─────────── */}
      {!vote.hasVoted && !isClosed ? (
        <form
          onSubmit={handleSubmitBallot}
          className="rounded-3xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6 sm:p-8 shadow-xs space-y-6"
        >
          <div className="border-b border-[var(--color-divider)] pb-4">
            <h2 className="font-[family-name:var(--font-outfit)] text-xl font-bold text-[var(--color-text-primary)]">
              Cast Your Anonymous Ballot
            </h2>
            <p className="mt-1 text-xs text-[var(--color-text-secondary)]">
              Your choice and optional opinion are recorded anonymously in an isolated collection.
            </p>
          </div>

          {submissionError && (
            <div className="flex items-start gap-3 rounded-2xl border border-red-200 dark:border-red-900/50 bg-red-500/10 p-4 text-xs text-red-600 dark:text-red-400">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
              <p className="font-medium">{submissionError}</p>
            </div>
          )}

          {/* Mode A: Multiple Choice */}
          {vote.mode === "MULTIPLE_CHOICE" && (
            <div className="space-y-3">
              <label className="block text-xs font-bold uppercase tracking-wider text-[var(--color-text-secondary)]">
                Select One Option
              </label>
              <div className="grid gap-2.5">
                {vote.options.map((opt) => {
                  const isSelected = selectedSingleOption === opt.id;
                  return (
                    <div
                      key={opt.id}
                      onClick={() => setSelectedSingleOption(opt.id)}
                      className={`cursor-pointer flex items-center justify-between rounded-2xl border p-4 transition ${
                        isSelected
                          ? "border-[var(--color-brand)] bg-[var(--color-brand)]/5 ring-1 ring-[var(--color-brand)]"
                          : "border-[var(--color-border)] bg-[var(--color-surface-elevated)] hover:border-[var(--color-border-hover)]"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <span
                          className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border transition ${
                            isSelected
                              ? "border-[var(--color-brand)] bg-[var(--color-brand)]"
                              : "border-[var(--color-border)]"
                          }`}
                        >
                          {isSelected && <span className="h-2 w-2 rounded-full bg-white" />}
                        </span>
                        <span className="text-sm font-semibold text-[var(--color-text-primary)]">
                          {opt.text}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Mode B: Ranked Choice */}
          {vote.mode === "RANKED_CHOICE" && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-bold uppercase tracking-wider text-[var(--color-text-secondary)]">
                  Rank Options (1st choice on top)
                </label>
                <span className="text-[11px] text-[var(--color-text-muted)]">
                  Drag or use arrows to reorder
                </span>
              </div>

              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleDragEnd}
              >
                <SortableContext
                  items={rankedOptionIds}
                  strategy={verticalListSortingStrategy}
                >
                  <div className="space-y-2">
                    {rankedOptionIds.map((optId, idx) => (
                      <SortableRankItem
                        key={optId}
                        id={optId}
                        index={idx}
                        text={optionMap.get(optId) || optId}
                        total={rankedOptionIds.length}
                        onMoveUp={() => handleMoveRankItem(idx, "up")}
                        onMoveDown={() => handleMoveRankItem(idx, "down")}
                      />
                    ))}
                  </div>
                </SortableContext>
              </DndContext>
            </div>
          )}

          {/* Mode C: Approval Voting */}
          {vote.mode === "APPROVAL" && (
            <div className="space-y-3">
              <label className="block text-xs font-bold uppercase tracking-wider text-[var(--color-text-secondary)]">
                Select All Acceptable Options
              </label>
              <div className="grid gap-2.5">
                {vote.options.map((opt) => {
                  const isChecked = selectedApprovals.has(opt.id);
                  return (
                    <div
                      key={opt.id}
                      onClick={() => {
                        const next = new Set(selectedApprovals);
                        if (isChecked) next.delete(opt.id);
                        else next.add(opt.id);
                        setSelectedApprovals(next);
                      }}
                      className={`cursor-pointer flex items-center justify-between rounded-2xl border p-4 transition ${
                        isChecked
                          ? "border-[var(--color-brand)] bg-[var(--color-brand)]/5 ring-1 ring-[var(--color-brand)]"
                          : "border-[var(--color-border)] bg-[var(--color-surface-elevated)] hover:border-[var(--color-border-hover)]"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <span
                          className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-lg border transition ${
                            isChecked
                              ? "border-[var(--color-brand)] bg-[var(--color-brand)] text-white"
                              : "border-[var(--color-border)]"
                          }`}
                        >
                          {isChecked && <Check className="h-3.5 w-3.5" />}
                        </span>
                        <span className="text-sm font-semibold text-[var(--color-text-primary)]">
                          {opt.text}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Optional Anonymous Opinion */}
          <div className="pt-2">
            <label className="block text-xs font-bold uppercase tracking-wider text-[var(--color-text-secondary)] mb-1">
              Your Opinion <span className="font-normal text-[var(--color-text-muted)]">(optional, 100% anonymous)</span>
            </label>
            <p className="text-[11px] text-[var(--color-text-muted)] mb-2">
              Attached to the anonymous ballot. It is never linked to your username or email in the database.
            </p>
            <textarea
              rows={3}
              maxLength={1000}
              placeholder="Share the reasoning behind your choice..."
              value={opinion}
              onChange={(e) => setOpinion(e.target.value)}
              className="w-full rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface-elevated)] p-4 text-xs font-medium text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus:border-[var(--color-brand)] focus:outline-hidden transition"
            />
            <div className="text-right text-[10px] text-[var(--color-text-muted)] mt-1">
              {opinion.length}/1000
            </div>
          </div>

          {/* Submit Button */}
          <div className="pt-2 flex justify-end">
            <button
              type="submit"
              disabled={isSubmitting}
              className="cursor-pointer flex items-center gap-2 rounded-2xl bg-[var(--color-brand)] px-6 py-3 text-xs font-bold text-white shadow-sm hover:opacity-90 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed transition"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Submitting Ballot...
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-4 w-4" />
                  Submit Anonymous Vote
                </>
              )}
            </button>
          </div>
        </form>
      ) : null}

      {/* ─── State 2: User Has Voted Banner & Receipt Card ──────── */}
      {vote.hasVoted && (
        <div className="space-y-4">
          <div className="flex items-center justify-between rounded-2xl border border-emerald-200 dark:border-emerald-900/50 bg-emerald-500/10 px-5 py-3.5 text-emerald-800 dark:text-emerald-300">
            <div className="flex items-center gap-2.5">
              <CheckCircle2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
              <span className="text-xs font-bold">
                You have voted in this vote. Your ballot has been recorded anonymously.
              </span>
            </div>
            {!isClosed && (
              <span className="text-[11px] font-medium opacity-80">
                Results update live
              </span>
            )}
          </div>

          {/* If user just received a receipt token */}
          {issuedReceipt && (
            <div className="rounded-3xl border border-[var(--color-brand)]/40 bg-[var(--color-surface)] p-6 shadow-md space-y-3">
              <div className="flex items-center gap-2 text-[var(--color-brand)]">
                <ShieldCheck className="h-5 w-5" />
                <h3 className="font-[family-name:var(--font-outfit)] text-sm font-bold uppercase tracking-wider">
                  Your Private Anonymous Ballot Receipt
                </h3>
              </div>
              <p className="text-xs text-[var(--color-text-secondary)] leading-relaxed">
                Save this unique receipt code. It is stored on the server only as a one-way cryptographic SHA-256 hash. You can use it below to verify that your ballot is recorded, without exposing your identity.
              </p>
              <div className="flex items-center gap-2 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface-elevated)] p-3">
                <code className="flex-1 font-mono text-xs font-bold text-[var(--color-text-primary)] select-all break-all">
                  {issuedReceipt}
                </code>
                <button
                  type="button"
                  onClick={() => handleCopyReceipt(issuedReceipt)}
                  className="cursor-pointer shrink-0 rounded-xl bg-[var(--color-text-primary)] px-3 py-1.5 text-[11px] font-bold text-[var(--color-primary-button-text)] hover:opacity-90 transition flex items-center gap-1.5"
                >
                  {hasCopiedReceipt ? (
                    <>
                      <Check className="h-3 w-3 text-emerald-400" />
                      Copied!
                    </>
                  ) : (
                    <>
                      <Copy className="h-3 w-3" />
                      Copy Receipt
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ─── State 3: Results Display ─────────────────────────── */}
      {(vote.hasVoted || isClosed) && summary && (
        <section className="space-y-6">
          {/* Winner Callout Card */}
          {isCancelled ? (
            <div className="rounded-3xl border border-amber-200 dark:border-amber-900/50 bg-amber-500/10 p-6 text-center">
              <XCircle className="mx-auto h-8 w-8 text-amber-500 mb-2" />
              <h3 className="font-[family-name:var(--font-outfit)] text-lg font-bold text-amber-800 dark:text-amber-300">
                Vote Cancelled
              </h3>
              <p className="text-xs text-amber-700 dark:text-amber-400 mt-1">
                This vote was cancelled before reaching a regular conclusion.
              </p>
            </div>
          ) : summary.result.isTie ? (
            <div className="rounded-3xl border border-purple-200 dark:border-purple-900/50 bg-purple-500/10 p-6 text-center space-y-2">
              <span className="font-mono text-xs font-bold uppercase tracking-widest text-purple-600 dark:text-purple-400">
                Result
              </span>
              <h3 className="font-[family-name:var(--font-outfit)] text-2xl font-bold text-purple-900 dark:text-purple-200">
                EXACT TIE
              </h3>
              <p className="text-xs text-purple-700 dark:text-purple-300 max-w-md mx-auto">
                No single option obtained a decisive lead. Tied options:{" "}
                <strong>
                  {summary.result.tiedOptionIds
                    .map((id) => optionMap.get(id) || id)
                    .join(", ")}
                </strong>
              </p>
            </div>
          ) : summary.result.winnerOptionId ? (
            <div className="rounded-3xl border border-[var(--color-brand)]/40 bg-[var(--color-surface)] p-6 shadow-sm flex items-center gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[var(--color-brand)]/10 text-[var(--color-brand)]">
                <Trophy className="h-6 w-6" />
              </div>
              <div>
                <span className="font-mono text-[11px] font-bold uppercase tracking-wider text-[var(--color-brand)]">
                  Leading Choice / Winner
                </span>
                <h3 className="font-[family-name:var(--font-outfit)] text-xl font-bold text-[var(--color-text-primary)]">
                  {optionMap.get(summary.result.winnerOptionId) ||
                    summary.result.winnerOptionId}
                </h3>
              </div>
            </div>
          ) : (
            <div className="rounded-3xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6 text-center">
              <p className="text-xs text-[var(--color-text-secondary)]">
                No votes have been recorded yet.
              </p>
            </div>
          )}

          {/* ─── Mode-Specific Breakdown ─── */}

          {/* Mode A: Multiple Choice Breakdown */}
          {summary.mode === "MULTIPLE_CHOICE" && (
            <div className="rounded-3xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6 sm:p-8 shadow-xs space-y-4">
              <div className="flex items-center justify-between border-b border-[var(--color-divider)] pb-3">
                <h3 className="font-[family-name:var(--font-outfit)] text-base font-bold text-[var(--color-text-primary)]">
                  Vote Distribution
                </h3>
                <span className="font-mono text-xs text-[var(--color-text-secondary)]">
                  Total: {summary.totalVotes} votes
                </span>
              </div>

              <div className="space-y-4 pt-2">
                {vote.options.map((opt) => {
                  const count = (summary.result as MultipleChoiceResult).optionCounts[opt.id] || 0;
                  const pct = (summary.result as MultipleChoiceResult).optionPercentages[opt.id] || 0;
                  const isWinner = summary.result.winnerOptionId === opt.id;

                  return (
                    <div key={opt.id} className="space-y-1.5">
                      <div className="flex items-center justify-between text-xs">
                        <span className={`font-semibold ${isWinner ? "text-[var(--color-brand)] font-bold" : "text-[var(--color-text-primary)]"}`}>
                          {opt.text} {isWinner && "★"}
                        </span>
                        <div className="flex items-center gap-2 font-mono text-[11px]">
                          <span className="text-[var(--color-text-secondary)]">
                            {count} {count === 1 ? "vote" : "votes"}
                          </span>
                          <span className="font-bold text-[var(--color-text-primary)] w-12 text-right">
                            {pct}%
                          </span>
                        </div>
                      </div>

                      <div className="h-2.5 w-full overflow-hidden rounded-full bg-[var(--color-canvas-bg)]">
                        <div
                          className={`h-full rounded-full transition-all duration-500 ${
                            isWinner ? "bg-[var(--color-brand)]" : "bg-[var(--color-text-secondary)]/60"
                          }`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Mode B: Ranked Choice (Instant Runoff) Breakdown */}
          {summary.mode === "RANKED_CHOICE" && (
            <div className="rounded-3xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6 sm:p-8 shadow-xs space-y-6">
              <div className="flex items-center justify-between border-b border-[var(--color-divider)] pb-3">
                <div>
                  <h3 className="font-[family-name:var(--font-outfit)] text-base font-bold text-[var(--color-text-primary)]">
                    Ranked Choice Instant-Runoff Rounds
                  </h3>
                  <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
                    Shows round-by-round candidate counts, lowest-ranked eliminations, and preference transfers.
                  </p>
                </div>
                <span className="font-mono text-xs text-[var(--color-text-secondary)]">
                  Total ballots: {summary.totalVotes}
                </span>
              </div>

              <div className="space-y-5">
                {(summary.result as RankedChoiceResult).rounds.map((round) => (
                  <div
                    key={round.roundNumber}
                    className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface-elevated)] p-4 space-y-3"
                  >
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold text-[var(--color-text-primary)] font-mono">
                        Round {round.roundNumber}
                      </span>
                      <span className="text-[11px] text-[var(--color-text-muted)] font-mono">
                        Active ballots: {round.activeBallots}
                        {round.exhaustedBallots > 0 && ` (${round.exhaustedBallots} exhausted)`}
                      </span>
                    </div>

                    <div className="space-y-2">
                      {vote.options.map((opt) => {
                        const count = round.counts[opt.id];
                        if (count === undefined) return null; // Eliminated in prior rounds
                        const pct = round.percentages[opt.id] || 0;
                        const isEliminatedThisRound = round.eliminatedOptionIds.includes(opt.id);

                        return (
                          <div key={opt.id} className="space-y-1">
                            <div className="flex items-center justify-between text-xs">
                              <span
                                className={`font-semibold ${
                                  isEliminatedThisRound
                                    ? "line-through text-red-500 opacity-70"
                                    : "text-[var(--color-text-primary)]"
                                }`}
                              >
                                {opt.text}
                                {isEliminatedThisRound && " (Eliminated)"}
                              </span>
                              <div className="flex items-center gap-2 font-mono text-[11px]">
                                <span className="text-[var(--color-text-secondary)]">
                                  {count} {count === 1 ? "vote" : "votes"}
                                </span>
                                <span className="font-bold text-[var(--color-text-primary)] w-12 text-right">
                                  {pct}%
                                </span>
                              </div>
                            </div>

                            <div className="h-2 w-full overflow-hidden rounded-full bg-[var(--color-canvas-bg)]">
                              <div
                                className={`h-full rounded-full transition-all duration-500 ${
                                  isEliminatedThisRound ? "bg-red-400" : "bg-purple-500"
                                }`}
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Mode C: Approval Voting Breakdown */}
          {summary.mode === "APPROVAL" && (
            <div className="rounded-3xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6 sm:p-8 shadow-xs space-y-4">
              <div className="flex items-center justify-between border-b border-[var(--color-divider)] pb-3">
                <h3 className="font-[family-name:var(--font-outfit)] text-base font-bold text-[var(--color-text-primary)]">
                  Approval Counts
                </h3>
                <span className="font-mono text-xs text-[var(--color-text-secondary)]">
                  Total voters: {summary.totalVotes}
                </span>
              </div>

              <div className="space-y-4 pt-2">
                {vote.options.map((opt) => {
                  const count = (summary.result as ApprovalResult).optionCounts[opt.id] || 0;
                  const pct = (summary.result as ApprovalResult).optionPercentages[opt.id] || 0;
                  const isWinner = summary.result.winnerOptionId === opt.id;

                  return (
                    <div key={opt.id} className="space-y-1.5">
                      <div className="flex items-center justify-between text-xs">
                        <span className={`font-semibold ${isWinner ? "text-emerald-600 font-bold" : "text-[var(--color-text-primary)]"}`}>
                          {opt.text} {isWinner && "★"}
                        </span>
                        <div className="flex items-center gap-2 font-mono text-[11px]">
                          <span className="text-[var(--color-text-secondary)]">
                            {count} {count === 1 ? "approval" : "approvals"}
                          </span>
                          <span className="font-bold text-[var(--color-text-primary)] w-12 text-right">
                            {pct}%
                          </span>
                        </div>
                      </div>

                      <div className="h-2.5 w-full overflow-hidden rounded-full bg-[var(--color-canvas-bg)]">
                        <div
                          className={`h-full rounded-full transition-all duration-500 ${
                            isWinner ? "bg-emerald-500" : "bg-[var(--color-text-secondary)]/60"
                          }`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ─── Anonymized Individual Ballots ─── */}
          <div className="rounded-3xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6 sm:p-8 shadow-xs space-y-4">
            <div className="border-b border-[var(--color-divider)] pb-3">
              <h3 className="font-[family-name:var(--font-outfit)] text-base font-bold text-[var(--color-text-primary)]">
                Anonymized Ballots ({summary.anonymousBallots.length})
              </h3>
              <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
                Individual ballot submissions are presented anonymously without any voter identity or timestamps.
              </p>
            </div>

            {summary.anonymousBallots.length === 0 ? (
              <p className="text-xs text-[var(--color-text-muted)] py-4 text-center">
                No ballots recorded yet.
              </p>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                {summary.anonymousBallots.map((ballot) => (
                  <div
                    key={ballot.displayId}
                    className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface-elevated)] p-4 space-y-2.5"
                  >
                    <div className="flex items-center justify-between text-xs font-mono font-bold text-[var(--color-text-secondary)]">
                      <span>{ballot.displayId}</span>
                    </div>

                    {/* Multiple Choice Selection */}
                    {ballot.payload.selectedOptionId && (
                      <p className="text-xs font-semibold text-[var(--color-text-primary)]">
                        Selected:{" "}
                        <span className="text-[var(--color-brand)]">
                          {optionMap.get(ballot.payload.selectedOptionId) ||
                            ballot.payload.selectedOptionId}
                        </span>
                      </p>
                    )}

                    {/* Approval Selections */}
                    {ballot.payload.selectedOptionIds && (
                      <div className="text-xs space-y-1">
                        <span className="text-[var(--color-text-secondary)] font-medium">Approved:</span>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {ballot.payload.selectedOptionIds.map((id) => (
                            <span
                              key={id}
                              className="rounded-md border border-emerald-200 dark:border-emerald-900/50 bg-emerald-500/10 px-2 py-0.5 text-[11px] font-semibold text-emerald-700 dark:text-emerald-400"
                            >
                              {optionMap.get(id) || id}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Ranked Choice Order */}
                    {ballot.payload.rankedOptionIds && (
                      <div className="text-xs space-y-1">
                        <span className="text-[var(--color-text-secondary)] font-medium">Ranking:</span>
                        <ol className="list-decimal list-inside space-y-0.5 text-[11px] font-medium text-[var(--color-text-primary)]">
                          {ballot.payload.rankedOptionIds.map((id) => (
                            <li key={id}>{optionMap.get(id) || id}</li>
                          ))}
                        </ol>
                      </div>
                    )}

                    {/* Anonymous Opinion */}
                    {ballot.opinion && (
                      <div className="mt-2 pt-2 border-t border-[var(--color-divider)]">
                        <div className="flex items-start gap-1.5 text-xs text-[var(--color-text-secondary)] italic">
                          <MessageSquare className="h-3.5 w-3.5 shrink-0 mt-0.5 text-[var(--color-text-muted)]" />
                          <p className="break-words">"{ballot.opinion}"</p>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* ─── Voters Section (<3 hidden, >=3 visible) ─── */}
          <div className="rounded-3xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6 sm:p-8 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-[var(--color-divider)] pb-3">
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-[var(--color-brand)]" />
                <h3 className="font-[family-name:var(--font-outfit)] text-base font-bold text-[var(--color-text-primary)]">
                  Voters
                </h3>
              </div>
              <span className="font-mono text-xs text-[var(--color-text-secondary)]">
                {summary.totalVotes} {summary.totalVotes === 1 ? "voter" : "voters"}
              </span>
            </div>

            {summary.votersHiddenNotice ? (
              <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface-elevated)] p-6 text-center">
                <Lock className="mx-auto h-6 w-6 text-[var(--color-text-muted)] opacity-60 mb-2" />
                <p className="text-xs font-semibold text-[var(--color-text-secondary)]">
                  {summary.votersHiddenNotice}
                </p>
                <p className="text-[11px] text-[var(--color-text-muted)] mt-1">
                  Voter identities remain completely hidden until at least 3 members participate to preserve privacy.
                </p>
              </div>
            ) : summary.voterNames && summary.voterNames.length > 0 ? (
              <div className="space-y-2">
                <p className="text-xs text-[var(--color-text-muted)]">
                  Members who have participated in this vote (displayed independently from ballot choices):
                </p>
                <div className="flex flex-wrap gap-2 pt-1">
                  {summary.voterNames.map((name, idx) => (
                    <span
                      key={idx}
                      className="inline-flex items-center gap-1.5 rounded-full border border-[var(--color-border)] bg-[var(--color-surface-elevated)] px-3 py-1 text-xs font-semibold text-[var(--color-text-primary)]"
                    >
                      <span className="h-1.5 w-1.5 rounded-full bg-[var(--color-brand)]" />
                      {name}
                    </span>
                  ))}
                </div>
              </div>
            ) : (
              <p className="text-xs text-[var(--color-text-muted)]">No voters yet.</p>
            )}
          </div>

          {/* ─── Receipt Verification Tool ─── */}
          <div className="rounded-3xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6 sm:p-8 shadow-xs space-y-4">
            <div>
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-emerald-500" />
                <h3 className="font-[family-name:var(--font-outfit)] text-base font-bold text-[var(--color-text-primary)]">
                  Verify a Ballot Receipt
                </h3>
              </div>
              <p className="text-xs text-[var(--color-text-muted)] mt-1">
                Enter your private receipt token to verify your ballot exists in the database. Verification does not expose or store voter identity.
              </p>
            </div>

            <form onSubmit={handleVerifyReceipt} className="flex flex-col sm:flex-row gap-3">
              <input
                type="text"
                placeholder="Paste receipt token (rcpt_...)"
                value={verifyTokenInput}
                onChange={(e) => setVerifyTokenInput(e.target.value)}
                className="flex-1 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface-elevated)] px-4 py-2.5 font-mono text-xs text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus:border-[var(--color-brand)] focus:outline-hidden"
              />
              <button
                type="submit"
                disabled={isVerifying}
                className="cursor-pointer shrink-0 rounded-2xl bg-[var(--color-text-primary)] px-5 py-2.5 text-xs font-bold text-[var(--color-primary-button-text)] hover:opacity-90 disabled:opacity-50 transition"
              >
                {isVerifying ? "Verifying..." : "Verify Receipt"}
              </button>
            </form>

            {verifyError && (
              <div className="text-xs text-red-500 font-medium">
                {verifyError}
              </div>
            )}

            {verificationResult && verificationResult.valid && (
              <div className="rounded-2xl border border-emerald-200 dark:border-emerald-900/50 bg-emerald-500/10 p-4 space-y-2 text-xs">
                <div className="flex items-center gap-2 font-bold text-emerald-800 dark:text-emerald-300">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                  <span>Valid Ballot Verified!</span>
                </div>
                <p className="text-[var(--color-text-secondary)]">
                  Your ballot is securely recorded for this vote.
                </p>
                {verificationResult.payload?.selectedOptionId && (
                  <p className="font-semibold text-[var(--color-text-primary)]">
                    Recorded Choice:{" "}
                    {optionMap.get(verificationResult.payload.selectedOptionId) ||
                      verificationResult.payload.selectedOptionId}
                  </p>
                )}
                {verificationResult.opinion && (
                  <p className="italic text-[var(--color-text-secondary)]">
                    Recorded Opinion: "{verificationResult.opinion}"
                  </p>
                )}
              </div>
            )}
          </div>
        </section>
      )}
    </div>
  );
}

// ─── DnD Item Component for Ranked Choice ─────────────────────

function SortableRankItem({
  id,
  index,
  text,
  total,
  onMoveUp,
  onMoveDown,
}: {
  id: string;
  index: number;
  text: string;
  total: number;
  onMoveUp: () => void;
  onMoveDown: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex items-center gap-3 rounded-2xl border p-3.5 transition select-none ${
        isDragging
          ? "border-[var(--color-brand)] bg-[var(--color-surface)] shadow-lg z-20 opacity-90"
          : "border-[var(--color-border)] bg-[var(--color-surface-elevated)] hover:border-[var(--color-border-hover)]"
      }`}
    >
      {/* Drag handle */}
      <button
        type="button"
        {...attributes}
        {...listeners}
        className="cursor-grab active:cursor-grabbing p-1 text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition"
        title="Drag to reorder"
      >
        <GripVertical className="h-4 w-4" />
      </button>

      {/* Rank number badge */}
      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-[var(--color-brand)]/10 font-mono text-xs font-bold text-[var(--color-brand)]">
        {index + 1}
      </span>

      {/* Option text */}
      <span className="flex-1 text-xs font-semibold text-[var(--color-text-primary)]">
        {text}
      </span>

      {/* Accessible fallback Move Up / Move Down buttons */}
      <div className="flex items-center gap-1 shrink-0">
        <button
          type="button"
          disabled={index === 0}
          onClick={onMoveUp}
          className="cursor-pointer rounded-lg p-1 text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] disabled:opacity-20 disabled:cursor-not-allowed transition"
          title="Move Up"
          aria-label={`Move ${text} up`}
        >
          <ChevronUp className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          disabled={index === total - 1}
          onClick={onMoveDown}
          className="cursor-pointer rounded-lg p-1 text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] disabled:opacity-20 disabled:cursor-not-allowed transition"
          title="Move Down"
          aria-label={`Move ${text} down`}
        >
          <ChevronDown className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}
