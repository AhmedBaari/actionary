/**
 * SastraNet Domain Logic
 * All business rules as pure functions — server-safe, testable, no JSX.
 */
import {
  differenceInDays,
  isAfter,
  parseISO,
  format,
  isSameMonth,
} from "date-fns";
import { toZonedTime } from "date-fns-tz";
import type {
  Task,
  TaskView,
  TaskSeverity,
  TaskStatus,
  UserRole,
  UserView,
} from "@/types";

// ─── Constants ───────────────────────────────────────────────

export const RUST_THRESHOLD_DAYS = 21;
export const TEAM_TIMEZONE = "Asia/Kolkata";
export const SPRINT_DURATION_DAYS = 7;
export const REQUIRED_REVIEWERS = 5;

// ─── Task Business Rules ─────────────────────────────────────

export function isTaskOverdue(task: TaskView): boolean {
  if (!task.deadline || task.status === "DONE") return false;
  const now = new Date();
  const deadline = new Date(task.deadline);
  return isAfter(now, deadline);
}

export function shouldRustBacklogItem(task: TaskView): boolean {
  if (task.status !== "BACKLOG") return false;
  if (task.deletedAt) return false;
  // Use updatedAt (last meaningful activity) rather than createdAt
  const lastActivity = new Date(task.updatedAt);
  const age = differenceInDays(new Date(), lastActivity);
  return age >= RUST_THRESHOLD_DAYS;
}

export function getTaskAge(task: TaskView): number {
  return differenceInDays(new Date(), new Date(task.createdAt));
}

export function getTaskInactivityDays(task: TaskView): number {
  return differenceInDays(new Date(), new Date(task.updatedAt));
}

export function canCarryOverTask(task: TaskView): boolean {
  return task.status === "TODO" || task.status === "IN_PROGRESS";
}

export function getChecklistProgress(task: TaskView): {
  done: number;
  total: number;
} {
  const total = task.checklist.length;
  const done = task.checklist.filter((i) => i.done).length;
  return { done, total };
}

// ─── Sprint Logic ────────────────────────────────────────────

export function formatSprintRange(startDate: string, endDate: string): string {
  const start = new Date(startDate);
  const end = new Date(endDate);
  const startMonth = format(start, "MMM");
  const endMonth = format(end, "MMM");
  const startDay = start.getDate();
  const endDay = end.getDate();

  if (isSameMonth(start, end)) {
    return `${startMonth} ${startDay}–${endDay}`;
  }
  return `${startMonth} ${startDay} – ${endMonth} ${endDay}`;
}

export function getCurrentIST(): Date {
  return toZonedTime(new Date(), TEAM_TIMEZONE);
}

// ─── Permission System ───────────────────────────────────────

const ROLE_HIERARCHY: Record<UserRole, number> = {
  MEMBER: 1,
  POD_LEAD: 2,
  LEAD: 3,
  ADMIN: 4,
};

export function hasRole(userRole: UserRole, requiredRole: UserRole): boolean {
  return ROLE_HIERARCHY[userRole] >= ROLE_HIERARCHY[requiredRole];
}

export function canManageSprint(user: UserView): boolean {
  return hasRole(user.role, "LEAD");
}

export function canManagePods(user: UserView): boolean {
  return hasRole(user.role, "POD_LEAD");
}

export function canManageFeedbackCycles(user: UserView): boolean {
  return hasRole(user.role, "LEAD");
}

export function canFinalizeFeedback(user: UserView): boolean {
  return hasRole(user.role, "LEAD");
}

export function canManageAllowlist(user: UserView): boolean {
  return hasRole(user.role, "ADMIN");
}

export function canDeleteTask(user: UserView, task: TaskView): boolean {
  if (hasRole(user.role, "LEAD")) return true;
  return task.primaryOwnerId === user.id;
}

export function canEditTask(user: UserView, task: TaskView): boolean {
  if (hasRole(user.role, "LEAD")) return true;
  if (task.primaryOwnerId === user.id) return true;
  if (task.assigneeIds.includes(user.id)) return true;
  return false;
}

// ─── Feedback Logic ──────────────────────────────────────────

export function isFeedbackComplete(
  reviewerIds: string[],
  completedReviewerIds: string[]
): boolean {
  return (
    reviewerIds.length === REQUIRED_REVIEWERS &&
    reviewerIds.every((id) => completedReviewerIds.includes(id))
  );
}

export function canFinalizeCycle(
  reviewerIds: string[],
  completedReviewerIds: string[]
): boolean {
  return isFeedbackComplete(reviewerIds, completedReviewerIds);
}

// ─── Severity Config ──────────────────────────────────────────

export const SEVERITY_CONFIG: Record<
  TaskSeverity,
  {
    label: string;
    description: string;
    colorClass: string;
    bgClass: string;
    borderClass: string;
    dotClass: string;
    pillClass: string;
  }
> = {
  RED: {
    label: "Critical",
    description:
      "Dangerous bug or missing feature where failure could let competitors steal users.",
    colorClass: "text-red-700 dark:text-red-400",
    bgClass: "bg-red-50 dark:bg-red-950/30",
    borderClass: "border-red-200 dark:border-red-800",
    dotClass: "bg-red-500",
    pillClass:
      "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300 border border-red-200 dark:border-red-800",
  },
  ORANGE: {
    label: "High",
    description:
      "Major bug causing heavy user discomfort, or a highly important feature where competitors could catch up.",
    colorClass: "text-orange-700 dark:text-orange-400",
    bgClass: "bg-orange-50 dark:bg-orange-950/30",
    borderClass: "border-orange-200 dark:border-orange-800",
    dotClass: "bg-orange-500",
    pillClass:
      "bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300 border border-orange-200 dark:border-orange-800",
  },
  YELLOW: {
    label: "Medium",
    description:
      "Causes user discomfort or represents a non-urgent improvement.",
    colorClass: "text-yellow-700 dark:text-yellow-600",
    bgClass: "bg-yellow-50 dark:bg-yellow-950/30",
    borderClass: "border-yellow-200 dark:border-yellow-800",
    dotClass: "bg-yellow-500",
    pillClass:
      "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300 border border-yellow-200 dark:border-yellow-800",
  },
  GREEN: {
    label: "Low",
    description: "Minor issue or low-impact improvement.",
    colorClass: "text-green-700 dark:text-green-400",
    bgClass: "bg-green-50 dark:bg-green-950/30",
    borderClass: "border-green-200 dark:border-green-800",
    dotClass: "bg-green-500",
    pillClass:
      "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300 border border-green-200 dark:border-green-800",
  },
  RANDOM_IDEA: {
    label: "Idea",
    description: "New idea worth retaining for future consideration.",
    colorClass: "text-purple-700 dark:text-purple-400",
    bgClass: "bg-purple-50 dark:bg-purple-950/30",
    borderClass: "border-purple-200 dark:border-purple-800",
    dotClass: "bg-purple-500",
    pillClass:
      "bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300 border border-purple-200 dark:border-purple-800",
  },
};

export const STATUS_CONFIG: Record<
  TaskStatus,
  { label: string; colorClass: string }
> = {
  TODO: { label: "To Do", colorClass: "text-muted-foreground" },
  IN_PROGRESS: { label: "In Progress", colorClass: "text-brand" },
  DONE: { label: "Ready for Release", colorClass: "text-green-600" },
  BACKLOG: { label: "Backlog", colorClass: "text-muted-foreground" },
};

// ─── Formatting ───────────────────────────────────────────────

export function getInitials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

export function formatDeadline(
  deadline: string | null,
  isOverdue: boolean
): string {
  if (!deadline) return "";
  const date = new Date(deadline);
  return format(date, "MMM d");
}

export function formatRelativeTime(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return format(date, "MMM d");
}

export function formatAge(createdAt: string): string {
  const days = differenceInDays(new Date(), new Date(createdAt));
  if (days === 0) return "today";
  if (days === 1) return "1d";
  return `${days}d`;
}

// ─── Task serialization ───────────────────────────────────────

/**
 * Converts a MongoDB Task document to a plain client-safe TaskView.
 * This must only be called server-side.
 */
export function serializeTask(task: Task): TaskView {
  return {
    id: task._id.toString(),
    displayNumber: task.displayNumber,
    title: task.title,
    description: task.description,
    status: task.status,
    severity: task.severity,
    sprintId: task.sprintId?.toString() ?? null,
    createdFrom: task.createdFrom,
    createdBy: task.createdBy?.toString() ?? null,
    primaryOwnerId: task.primaryOwnerId?.toString() ?? null,
    assigneeIds: task.assigneeIds.map((id) => id.toString()),
    checklist: task.checklist,
    deadline: task.deadline?.toISOString() ?? null,
    completedAt: task.completedAt?.toISOString() ?? null,
    completedSprintId: task.completedSprintId?.toString() ?? null,
    pivotReason: task.pivotReason,
    sourceIdeaId: task.sourceIdeaId?.toString() ?? null,
    version: task.version,
    createdAt: task.createdAt.toISOString(),
    updatedAt: task.updatedAt.toISOString(),
    deletedAt: task.deletedAt?.toISOString() ?? null,
  };
}
