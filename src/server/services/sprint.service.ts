import { getClient } from "@/lib/db/client";
import {
  getActiveSprint,
  createSprint,
  updateSprintStatus,
  getLatestSprintNumber,
} from "@/server/repositories/sprints.repository";
import {
  getCarryOverCandidates,
  bulkAssignSprint,
  getBoardStats,
  getTasksBySprintId,
  getBacklogTasks,
} from "@/server/repositories/tasks.repository";
import {
  createAuditEvent,
  bulkCreateAuditEvents,
} from "@/server/repositories/audit.repository";
import { addDays } from "date-fns";
import type { Sprint, SprintView, TaskView } from "@/types";
import { serializeTask } from "@/lib/domain";

export async function getActiveSprintWithTasks(): Promise<{
  sprint: SprintView | null;
  tasks: TaskView[];
  stats: { todo: number; inProgress: number; done: number; overdue: number };
}> {
  let sprint = await getActiveSprint();

  if (!sprint) {
    const latestNum = await getLatestSprintNumber();
    const nextNum = latestNum + 1;
    const now = new Date();
    const endDate = addDays(now, 7);
    sprint = await createSprint({
      number: nextNum,
      sprintNumber: nextNum,
      name: `Sprint ${nextNum}`,
      startDate: now,
      endDate: endDate,
      status: "ACTIVE",
    });
  }

  const [tasks, stats] = await Promise.all([
    getTasksBySprintId(sprint._id.toString()),
    getBoardStats(sprint._id.toString()),
  ]);

  return {
    sprint: serializeSprint(sprint),
    tasks: tasks.map(serializeTask),
    stats,
  };
}

export async function carryOverSprint(
  currentSprintId: string,
  actorId: string,
  actorName: string
): Promise<{
  success: boolean;
  carriedCount: number;
  newSprintId: string | null;
  error?: string;
}> {
  const client = await getClient();
  const session = client.startSession();

  try {
    let carriedCount = 0;
    let newSprintId: string | null = null;

    await session.withTransaction(async () => {
      // 1. Get carry-over candidates
      const candidates = await getCarryOverCandidates(currentSprintId);
      if (candidates.length === 0) {
        return;
      }

      // 2. Get current sprint for date calculation
      const currentSprint = await getActiveSprint();
      if (!currentSprint) throw new Error("No active sprint found");

      // 3. Create next sprint
      const nextSprintNumber = await getLatestSprintNumber();
      const nextStartDate = new Date(currentSprint.endDate);
      nextStartDate.setDate(nextStartDate.getDate() + 1);
      const nextEndDate = addDays(nextStartDate, 6); // 7-day sprint

      const newSprint = await createSprint(
        {
          number: nextSprintNumber + 1,
          name: `Sprint ${nextSprintNumber + 1}`,
          startDate: nextStartDate,
          endDate: nextEndDate,
          status: "ACTIVE",
        },
        session
      );
      newSprintId = newSprint._id.toString();

      // 4. Mark current sprint as completed
      await updateSprintStatus(
        currentSprintId,
        "COMPLETED",
        { completedAt: new Date() },
        session
      );

      // 5. Bulk assign tasks to new sprint
      const taskIds = candidates.map((t) => t._id.toString());
      await bulkAssignSprint(taskIds, newSprintId, nextEndDate, session);
      carriedCount = candidates.length;

      // 6. Create per-task audit events
      await bulkCreateAuditEvents(
        candidates.map((task) => ({
          entityType: "task" as const,
          entityId: task._id.toString(),
          actorId,
          actorName,
          action: "task.carried_over" as const,
          metadata: {
            fromSprintId: currentSprintId,
            toSprintId: newSprintId,
            taskNumber: task.displayNumber,
            taskTitle: task.title,
          },
        })),
        session
      );

      // 7. Create sprint-level audit event
      await createAuditEvent(
        {
          entityType: "sprint",
          entityId: currentSprintId,
          actorId,
          actorName,
          action: "sprint.carry_over",
          metadata: {
            taskCount: carriedCount,
            toSprintId: newSprintId,
            taskNumbers: candidates.map((t) => t.displayNumber),
          },
        },
        session
      );
    });

    return { success: true, carriedCount, newSprintId };
  } catch (error) {
    console.error("[sprint.service] Carry-over failed:", error);
    return {
      success: false,
      carriedCount: 0,
      newSprintId: null,
      error: "Carry-over failed. Please try again.",
    };
  } finally {
    await session.endSession();
  }
}

export async function ensureActiveSprint(): Promise<Sprint | null> {
  const existing = await getActiveSprint();
  if (existing) return existing;

  // Auto-create if none exists (only happens on first run)
  const nextNumber = (await getLatestSprintNumber()) + 1;
  const now = new Date();
  const startDate = new Date(now);
  startDate.setDate(startDate.getDate() - startDate.getDay() + 1); // Monday
  const endDate = addDays(startDate, 6);

  return createSprint({
    number: nextNumber,
    name: `Sprint ${nextNumber}`,
    startDate,
    endDate,
    status: "ACTIVE",
  });
}

export function serializeSprint(sprint: Sprint): SprintView {
  return {
    id: sprint._id.toString(),
    number: sprint.sprintNumber ?? sprint.number ?? 1,
    name: sprint.name,
    startDate: sprint.startDate.toISOString(),
    endDate: sprint.endDate.toISOString(),
    status: sprint.status,
    createdAt: sprint.createdAt.toISOString(),
    completedAt: sprint.completedAt?.toISOString() ?? null,
  };
}
