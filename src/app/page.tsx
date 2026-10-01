import { redirect } from "next/navigation";
import { WorkspaceBoard } from "@/components/workspace/board";
import { requireCurrentUser } from "@/lib/auth/session";
import { serializeTask } from "@/lib/domain";
import {
  getBoardTasks,
  getBacklogTasks,
  getCompletedTasks,
  getGlobalBoardStats,
} from "@/server/repositories/tasks.repository";
import { getAllUsers } from "@/server/repositories/users.repository";
import { getRecentAuditEventsForEntities } from "@/server/repositories/audit.repository";

function serializePlainValue(value: unknown): unknown {
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "bigint") return value.toString();
  if (Array.isArray(value)) return value.map(serializePlainValue);
  if (value && typeof value === "object") {
    const bsonId = value as { toHexString?: () => string };
    if (typeof bsonId.toHexString === "function") {
      return bsonId.toHexString();
    }

    return Object.fromEntries(
      Object.entries(value).map(([key, nestedValue]) => [
        key,
        serializePlainValue(nestedValue),
      ])
    );
  }
  return value;
}

export default async function Home() {
  try {
    await requireCurrentUser();
  } catch {
    redirect("/login");
  }

  const [tasks, backlog, completed, stats, users] = await Promise.all([
    getBoardTasks(),
    getBacklogTasks(),
    getCompletedTasks(),
    getGlobalBoardStats(),
    getAllUsers(),
  ]);
  const activity = await getRecentAuditEventsForEntities(
    "task",
    [...tasks, ...backlog, ...completed].map((task) => task._id.toString())
  );

  return (
    <WorkspaceBoard
      backlog={backlog.map(serializeTask)}
      completed={completed.map(serializeTask)}
      stats={stats}
      tasks={tasks.map(serializeTask)}
      activityByTask={Object.fromEntries([...activity].map(([taskId, events]) => [taskId, events.map((event) => ({
        id: event._id.toString(), entityType: event.entityType, entityId: event.entityId,
        actorId: event.actorId, actorName: event.actorName, action: event.action,
        metadata: serializePlainValue(event.metadata) as Record<string, unknown>,
        createdAt: event.createdAt.toISOString(),
      }))]))}
      users={users.map((user) => ({
        id: user._id.toString(),
        email: user.email,
        name: user.name,
        role: user.role,
        podId: user.podId,
        avatarUrl: user.avatarUrl,
        active: user.active,
      }))}
    />
  );
}
