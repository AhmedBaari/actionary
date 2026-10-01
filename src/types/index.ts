// ============================================================
// SastraNet Domain Types
// Single source of truth for all TypeScript types
// ============================================================

// ─── Enumerations ───────────────────────────────────────────

export type TaskStatus = "TODO" | "IN_PROGRESS" | "DONE" | "BACKLOG";

export type TaskSeverity =
  | "RED"
  | "ORANGE"
  | "YELLOW"
  | "GREEN"
  | "RANDOM_IDEA";

export type SprintStatus = "UPCOMING" | "ACTIVE" | "COMPLETED";

export type UserRole = "ADMIN" | "LEAD" | "POD_LEAD" | "MEMBER";

export type IdeaStatus = "ACTIVE" | "PROMOTED" | "ARCHIVED";

export type FeedbackStatus =
  | "SELECTING_REVIEWERS"
  | "IN_PROGRESS"
  | "COMPLETED"
  | "FINALIZED";

export type AuditAction =
  | "task.created"
  | "task.status_changed"
  | "task.severity_changed"
  | "task.assigned"
  | "task.checklist_updated"
  | "task.deadline_changed"
  | "task.moved_to_sprint"
  | "task.carried_over"
  | "task.moved_to_backlog"
  | "task.deleted"
  | "task.pivoted"
  | "idea.created"
  | "idea.promoted"
  | "idea.deleted"
  | "sprint.created"
  | "sprint.carry_over"
  | "sprint.completed"
  | "pod.created"
  | "pod.updated"
  | "pod.member_added"
  | "pod.member_removed"
  | "pod.member_moved"
  | "feedback.cycle_created"
  | "feedback.reviewers_selected"
  | "feedback.response_submitted"
  | "feedback.finalized"
  | "user.created"
  | "user.role_changed"
  | "allowlist.entry_added"
  | "allowlist.entry_removed";

// ─── Checklist ──────────────────────────────────────────────

export interface ChecklistItem {
  id: string;
  label: string;
  done: boolean;
}

// ─── User ───────────────────────────────────────────────────

export interface User {
  _id: string;
  email: string;
  name: string;
  role: UserRole;
  podId: string | null;
  avatarUrl: string | null;
  active: boolean;
  emailVerified: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface AllowedUser {
  _id: string;
  email: string;
  role: UserRole;
  active: boolean;
  createdAt: Date;
  createdBy: string | null;
}

// ─── Pod ────────────────────────────────────────────────────

export interface Pod {
  _id: string;
  name: string;
  leadId: string | null;
  memberIds: string[];
  createdAt: Date;
  updatedAt: Date;
}

export interface PodWithMembers extends Pod {
  lead: User | null;
  members: User[];
  activeTaskCount: number;
  completedTaskCount: number;
}

// ─── Sprint ─────────────────────────────────────────────────

export interface Sprint {
  _id: string;
  number?: number;
  sprintNumber?: number;
  name: string;
  startDate: Date;
  endDate: Date;
  status: SprintStatus;
  createdAt: Date;
  completedAt: Date | null;
}

// ─── Task ───────────────────────────────────────────────────

export interface Task {
  _id: string;
  displayNumber: number;
  title: string;
  description: string | null;
  status: TaskStatus;
  severity: TaskSeverity;
  sprintId: string | null;
  createdFrom: "board" | "backlog" | "idea" | "SPRINT" | "BACKLOG" | "IDEA";
  createdBy: string | null;
  primaryOwnerId: string | null;
  assigneeIds: string[];
  checklist: ChecklistItem[];
  deadline: Date | null;
  completedAt: Date | null;
  completedSprintId: string | null;
  pivotReason: string | null;
  sourceIdeaId: string | null;
  version: number; // Optimistic concurrency
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}

// ─── Idea ───────────────────────────────────────────────────

export interface Idea {
  _id: string;
  title: string;
  description: string | null;
  status: IdeaStatus;
  promotedTaskId: string | null;
  createdBy: string | null;
  createdAt: Date;
  updatedAt: Date;
}

// ─── Audit ──────────────────────────────────────────────────

export interface AuditEvent {
  _id: string;
  entityType: "task" | "sprint" | "idea" | "pod" | "feedback" | "user" | "allowlist";
  entityId: string;
  actorId: string | null;
  actorName: string | null; // Denormalized for history readability
  action: AuditAction;
  metadata: Record<string, unknown>;
  createdAt: Date;
}

// ─── Feedback ───────────────────────────────────────────────

export interface FeedbackCycle {
  _id: string;
  recipientId: string;
  reviewerIds: string[];
  status: FeedbackStatus;
  createdBy: string | null;
  aiSummary: string | null;
  aiSummaryGeneratedAt: Date | null;
  createdAt: Date;
  finalizedAt: Date | null;
}

export interface AIMDevelopmentArea {
  area?: string;
  action: string;
  impact: string;
  measure: string;
}

export interface FeedbackResponse {
  _id: string;
  cycleId: string;
  reviewerId: string;
  // Ratings (1-5)
  effectivenessRating: number | null;
  cultureRating: number | null;
  // Strengths (1-3)
  strengths: string[];
  // Development areas (1-3) with AIM format
  developmentAreas: AIMDevelopmentArea[];
  // Free text
  impactNarrative: string | null;
  additionalComments: string | null;
  completed: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// ─── Culture ────────────────────────────────────────────────

export interface CulturePrinciple {
  id: string;
  title: string;
  description: string;
  examples: string[];
  order: number;
}

export interface Culture {
  _id: string;
  principles: CulturePrinciple[];
  updatedAt: Date;
  updatedBy: string | null;
}

// ─── Settings ───────────────────────────────────────────────

export interface Settings {
  _id: string;
  n8nEnabled: boolean;
  aiSummaryEnabled: boolean;
  timezone: string;
  updatedAt: Date;
  updatedBy: string | null;
}

// ─── Client-safe view types (no Dates, uses string) ─────────

export interface TaskView {
  id: string;
  displayNumber: number;
  title: string;
  description: string | null;
  status: TaskStatus;
  severity: TaskSeverity;
  sprintId: string | null;
  createdFrom: string;
  createdBy: string | null;
  primaryOwnerId: string | null;
  primaryOwner?: UserView | null;
  assigneeIds: string[];
  assignees?: UserView[];
  checklist: ChecklistItem[];
  deadline: string | null;
  completedAt: string | null;
  completedSprintId: string | null;
  pivotReason: string | null;
  sourceIdeaId: string | null;
  version: number;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

export interface UserView {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  podId: string | null;
  avatarUrl: string | null;
  active: boolean;
}

export interface SprintView {
  id: string;
  number: number;
  name: string;
  startDate: string;
  endDate: string;
  status: SprintStatus;
  createdAt: string;
  completedAt: string | null;
}

export interface PodView {
  id: string;
  name: string;
  leadId: string | null;
  lead?: UserView | null;
  memberIds: string[];
  members?: UserView[];
  activeTaskCount: number;
  completedTaskCount: number;
  updatedAt: string;
}

export interface IdeaView {
  id: string;
  title: string;
  description: string | null;
  status: IdeaStatus;
  promotedTaskId: string | null;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AuditEventView {
  id: string;
  entityType: string;
  entityId: string;
  actorId: string | null;
  actorName: string | null;
  action: AuditAction;
  metadata: Record<string, unknown>;
  createdAt: string;
}

export interface FeedbackCycleView {
  id: string;
  recipientId: string;
  recipient?: UserView | null;
  reviewerIds: string[];
  reviewers?: UserView[];
  status: FeedbackStatus;
  createdBy: string | null;
  aiSummary: string | null;
  createdAt: string;
  finalizedAt: string | null;
}

export interface FeedbackResponseView {
  id: string;
  cycleId: string;
  reviewerId: string;
  reviewer?: UserView | null;
  effectivenessRating: number | null;
  cultureRating: number | null;
  strengths: string[];
  developmentAreas: Array<{
    area: string;
    action: string;
    impact: string;
    measure: string;
  }>;
  impactNarrative: string | null;
  additionalComments: string | null;
  completed: boolean;
  createdAt: string;
  updatedAt: string;
}

// ─── n8n Event Types ────────────────────────────────────────

export type N8nEventType =
  | "feedback.review_requested"
  | "feedback.all_submitted"
  | "feedback.finalized"
  | "sprint.carry_over"
  | "task.overdue"
  | "task.created";

export interface N8nEvent<T = Record<string, unknown>> {
  type: N8nEventType;
  timestamp: string;
  payload: T;
}

// ─── Server Action Result ────────────────────────────────────

export type ActionResult<T = void> =
  | { success: true; data: T }
  | { success: false; error: string; code?: string };
