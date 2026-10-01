"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Check,
  CheckSquare,
  ListOrdered,
  Plus,
  Radio,
  Trash2,
  ChevronDown,
  ChevronUp,
  AlertCircle,
  Loader2,
  Sparkles,
} from "lucide-react";
import { actionCreateVote } from "@/server/actions/voting";
import type { VotingMode } from "@/types/voting";

export function CreateVoteForm() {
  const router = useRouter();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [mode, setMode] = useState<VotingMode>("MULTIPLE_CHOICE");
  const [options, setOptions] = useState<string[]>([
    "Option 1",
    "Option 2",
    "Option 3",
  ]);
  const [deadlineType, setDeadlineType] = useState<string>("none");
  const [customDeadline, setCustomDeadline] = useState("");
  const [customSlug, setCustomSlug] = useState("");
  const [showAdvancedSlug, setShowAdvancedSlug] = useState(false);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Option handlers
  const handleOptionChange = (index: number, value: string) => {
    const updated = [...options];
    updated[index] = value;
    setOptions(updated);
  };

  const handleAddOption = () => {
    if (options.length >= 20) return;
    setOptions([...options, `Option ${options.length + 1}`]);
  };

  const handleRemoveOption = (index: number) => {
    if (options.length <= 2) return;
    setOptions(options.filter((_, i) => i !== index));
  };

  const handleMoveOption = (index: number, direction: "up" | "down") => {
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= options.length) return;
    const updated = [...options];
    const temp = updated[index];
    updated[index] = updated[targetIndex];
    updated[targetIndex] = temp;
    setOptions(updated);
  };

  // Submit handler
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const cleanTitle = title.trim();
    if (!cleanTitle) {
      setErrorMessage("Please provide a title for the vote.");
      return;
    }

    // Clean options
    const cleanOptions = options
      .map((opt, idx) => ({ id: `opt_${idx + 1}`, text: opt.trim() }))
      .filter((opt) => opt.text.length > 0);

    if (cleanOptions.length < 2) {
      setErrorMessage("Please provide at least 2 non-empty options.");
      return;
    }

    const uniqueTexts = new Set(cleanOptions.map((o) => o.text.toLowerCase()));
    if (uniqueTexts.size !== cleanOptions.length) {
      setErrorMessage("All options must be unique.");
      return;
    }

    // Deadline logic
    let durationParam: string | null = null;
    let closesAtParam: string | null = null;

    if (deadlineType === "custom") {
      if (!customDeadline) {
        setErrorMessage("Please select a custom deadline date and time.");
        return;
      }
      const d = new Date(customDeadline);
      if (d.getTime() <= Date.now()) {
        setErrorMessage("Deadline must be set in the future.");
        return;
      }
      closesAtParam = d.toISOString();
    } else if (deadlineType !== "none") {
      durationParam = deadlineType;
    }

    setIsSubmitting(true);

    try {
      const res = await actionCreateVote({
        title: cleanTitle,
        description: description.trim() || null,
        mode,
        options: cleanOptions,
        duration: durationParam,
        closesAt: closesAtParam,
        customSlug: customSlug.trim() || null,
      });

      if (!res.success) {
        setErrorMessage(res.error || "Failed to create vote.");
        setIsSubmitting(false);
        return;
      }

      router.push(`/voting/${res.data.slug}`);
    } catch (err: any) {
      setErrorMessage(err.message || "An unexpected error occurred.");
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      {/* Back button */}
      <div>
        <Link
          href="/voting"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to all votes
        </Link>
      </div>

      {errorMessage && (
        <div className="flex items-start gap-3 rounded-2xl border border-red-200 dark:border-red-900/50 bg-red-500/10 p-4 text-xs text-red-600 dark:text-red-400">
          <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
          <p className="font-medium">{errorMessage}</p>
        </div>
      )}

      {/* 1. Title & Description */}
      <section className="rounded-3xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6 shadow-xs space-y-4">
        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-[var(--color-text-secondary)] mb-2">
            Vote Title <span className="text-[var(--color-brand)]">*</span>
          </label>
          <input
            type="text"
            required
            maxLength={200}
            placeholder="e.g. Which database should we adopt for the new service?"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface-elevated)] px-4 py-3 text-sm font-semibold text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus:border-[var(--color-brand)] focus:outline-hidden transition"
          />
        </div>

        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-[var(--color-text-secondary)] mb-2">
            Context or Description <span className="font-normal text-[var(--color-text-muted)]">(optional)</span>
          </label>
          <textarea
            rows={3}
            maxLength={2000}
            placeholder="Provide context, constraints, or links to help teammates make an informed decision..."
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface-elevated)] p-4 text-xs font-medium text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus:border-[var(--color-brand)] focus:outline-hidden transition"
          />
        </div>
      </section>

      {/* 2. Voting Mode */}
      <section className="rounded-3xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6 shadow-xs">
        <label className="block text-xs font-bold uppercase tracking-wider text-[var(--color-text-secondary)] mb-1">
          Voting Mode <span className="text-[var(--color-brand)]">*</span>
        </label>
        <p className="text-xs text-[var(--color-text-muted)] mb-4">
          Choose the decision algorithm that best fits this decision.
        </p>

        <div className="grid gap-3 sm:grid-cols-3">
          {/* Multiple Choice */}
          <div
            onClick={() => setMode("MULTIPLE_CHOICE")}
            className={`cursor-pointer rounded-2xl border p-4 transition ${
              mode === "MULTIPLE_CHOICE"
                ? "border-[var(--color-brand)] bg-[var(--color-brand)]/5 ring-1 ring-[var(--color-brand)]"
                : "border-[var(--color-border)] bg-[var(--color-surface-elevated)] hover:border-[var(--color-border-hover)]"
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="flex items-center gap-2 font-bold text-xs text-[var(--color-text-primary)]">
                <Radio className="h-4 w-4 text-blue-500" />
                Multiple Choice
              </span>
              {mode === "MULTIPLE_CHOICE" && (
                <span className="h-2 w-2 rounded-full bg-[var(--color-brand)]" />
              )}
            </div>
            <p className="text-[11px] text-[var(--color-text-secondary)] leading-relaxed">
              Voter chooses exactly one option. The option with the highest vote count wins (plurality).
            </p>
          </div>

          {/* Ranked Choice */}
          <div
            onClick={() => setMode("RANKED_CHOICE")}
            className={`cursor-pointer rounded-2xl border p-4 transition ${
              mode === "RANKED_CHOICE"
                ? "border-[var(--color-brand)] bg-[var(--color-brand)]/5 ring-1 ring-[var(--color-brand)]"
                : "border-[var(--color-border)] bg-[var(--color-surface-elevated)] hover:border-[var(--color-border-hover)]"
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="flex items-center gap-2 font-bold text-xs text-[var(--color-text-primary)]">
                <ListOrdered className="h-4 w-4 text-purple-500" />
                Ranked Choice
              </span>
              {mode === "RANKED_CHOICE" && (
                <span className="h-2 w-2 rounded-full bg-[var(--color-brand)]" />
              )}
            </div>
            <p className="text-[11px] text-[var(--color-text-secondary)] leading-relaxed">
              Voters rank all options. Instant-runoff iteratively transfers votes until a candidate exceeds 50%.
            </p>
          </div>

          {/* Approval Voting */}
          <div
            onClick={() => setMode("APPROVAL")}
            className={`cursor-pointer rounded-2xl border p-4 transition ${
              mode === "APPROVAL"
                ? "border-[var(--color-brand)] bg-[var(--color-brand)]/5 ring-1 ring-[var(--color-brand)]"
                : "border-[var(--color-border)] bg-[var(--color-surface-elevated)] hover:border-[var(--color-border-hover)]"
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="flex items-center gap-2 font-bold text-xs text-[var(--color-text-primary)]">
                <CheckSquare className="h-4 w-4 text-emerald-500" />
                Approval Voting
              </span>
              {mode === "APPROVAL" && (
                <span className="h-2 w-2 rounded-full bg-[var(--color-brand)]" />
              )}
            </div>
            <p className="text-[11px] text-[var(--color-text-secondary)] leading-relaxed">
              Voters can approve any number of acceptable options. The option with the most approvals wins.
            </p>
          </div>
        </div>
      </section>

      {/* 3. Options Builder */}
      <section className="rounded-3xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6 shadow-xs space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-[var(--color-text-secondary)]">
              Options ({options.length}/20) <span className="text-[var(--color-brand)]">*</span>
            </label>
            <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
              Add at least 2 distinct choices for members to vote on.
            </p>
          </div>
          {options.length < 20 && (
            <button
              type="button"
              onClick={handleAddOption}
              className="cursor-pointer inline-flex items-center gap-1.5 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-elevated)] px-3 py-1.5 text-xs font-bold text-[var(--color-text-primary)] hover:border-[var(--color-brand)] transition"
            >
              <Plus className="h-3.5 w-3.5 text-[var(--color-brand)]" />
              Add Option
            </button>
          )}
        </div>

        <div className="space-y-2.5">
          {options.map((opt, idx) => (
            <div
              key={idx}
              className="flex items-center gap-2 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface-elevated)] p-2.5 transition focus-within:border-[var(--color-brand)]"
            >
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-[var(--color-canvas-bg)] font-mono text-[11px] font-bold text-[var(--color-text-secondary)]">
                {idx + 1}
              </span>
              <input
                type="text"
                required
                maxLength={120}
                placeholder={`Option ${idx + 1}`}
                value={opt}
                onChange={(e) => handleOptionChange(idx, e.target.value)}
                className="flex-1 bg-transparent px-2 text-xs font-semibold text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus:outline-hidden"
              />

              <div className="flex items-center gap-1 shrink-0">
                <button
                  type="button"
                  disabled={idx === 0}
                  onClick={() => handleMoveOption(idx, "up")}
                  className="cursor-pointer rounded-lg p-1 text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] disabled:opacity-30 disabled:cursor-not-allowed transition"
                  title="Move Up"
                >
                  <ChevronUp className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  disabled={idx === options.length - 1}
                  onClick={() => handleMoveOption(idx, "down")}
                  className="cursor-pointer rounded-lg p-1 text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] disabled:opacity-30 disabled:cursor-not-allowed transition"
                  title="Move Down"
                >
                  <ChevronDown className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  disabled={options.length <= 2}
                  onClick={() => handleRemoveOption(idx)}
                  className="cursor-pointer rounded-lg p-1 text-[var(--color-text-muted)] hover:text-red-500 disabled:opacity-30 disabled:cursor-not-allowed transition"
                  title="Remove Option"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* 4. Deadline / Duration */}
      <section className="rounded-3xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6 shadow-xs space-y-4">
        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-[var(--color-text-secondary)] mb-1">
            Deadline / Closing Duration
          </label>
          <p className="text-xs text-[var(--color-text-muted)]">
            When this deadline is reached, the vote automatically closes to submissions.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          {[
            { id: "none", label: "No deadline" },
            { id: "30m", label: "30 minutes" },
            { id: "2h", label: "2 hours" },
            { id: "1d", label: "1 day" },
            { id: "3d", label: "3 days" },
            { id: "7d", label: "7 days" },
            { id: "custom", label: "Custom date & time" },
          ].map((preset) => (
            <button
              key={preset.id}
              type="button"
              onClick={() => setDeadlineType(preset.id)}
              className={`cursor-pointer rounded-xl px-3 py-2 text-xs font-medium border transition ${
                deadlineType === preset.id
                  ? "border-[var(--color-brand)] bg-[var(--color-brand)]/10 text-[var(--color-brand)] font-bold"
                  : "border-[var(--color-border)] bg-[var(--color-surface-elevated)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
              }`}
            >
              {preset.label}
            </button>
          ))}
        </div>

        {deadlineType === "custom" && (
          <div className="pt-2">
            <label className="block text-[11px] font-semibold text-[var(--color-text-secondary)] mb-1.5">
              Select Closing Date & Time (Local Time)
            </label>
            <input
              type="datetime-local"
              required
              value={customDeadline}
              onChange={(e) => setCustomDeadline(e.target.value)}
              className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface-elevated)] px-4 py-2.5 text-xs font-semibold text-[var(--color-text-primary)] focus:border-[var(--color-brand)] focus:outline-hidden transition"
            />
          </div>
        )}
      </section>

      {/* 5. Custom URL Identifier (Collapsible) */}
      <section className="rounded-3xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6 shadow-xs">
        <button
          type="button"
          onClick={() => setShowAdvancedSlug(!showAdvancedSlug)}
          className="cursor-pointer flex w-full items-center justify-between text-left"
        >
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-[var(--color-text-secondary)]">
              Custom Vote Identifier / URL Slug
            </h4>
            <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
              Customize the shareable link for this vote (e.g. /voting/database-choice).
            </p>
          </div>
          <span className="text-xs font-semibold text-[var(--color-brand)]">
            {showAdvancedSlug ? "Hide" : "Customize"}
          </span>
        </button>

        {showAdvancedSlug && (
          <div className="mt-4 pt-4 border-t border-[var(--color-divider)]">
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs text-[var(--color-text-muted)] select-none">
                /voting/
              </span>
              <input
                type="text"
                placeholder="my-custom-slug (optional)"
                value={customSlug}
                onChange={(e) => setCustomSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))}
                className="flex-1 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface-elevated)] px-3 py-2 text-xs font-mono font-semibold text-[var(--color-text-primary)] focus:border-[var(--color-brand)] focus:outline-hidden transition"
              />
            </div>
            <p className="mt-2 text-[11px] text-[var(--color-text-muted)]">
              Lowercase alphanumeric characters and hyphens only (3–64 chars). If empty, a unique ID is automatically generated.
            </p>
          </div>
        )}
      </section>

      {/* Actions */}
      <div className="flex items-center justify-end gap-3 pt-2">
        <Link
          href="/voting"
          className="rounded-2xl border border-[var(--color-border)] px-5 py-3 text-xs font-bold text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition"
        >
          Cancel
        </Link>
        <button
          type="submit"
          disabled={isSubmitting}
          className="cursor-pointer flex items-center gap-2 rounded-2xl bg-[var(--color-brand)] px-6 py-3 text-xs font-bold text-white shadow-sm hover:opacity-90 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed transition"
        >
          {isSubmitting ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Opening Vote...
            </>
          ) : (
            <>
              <Sparkles className="h-4 w-4" />
              Create & Open Vote
            </>
          )}
        </button>
      </div>
    </form>
  );
}
