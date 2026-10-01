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

  return (
    <WorkspaceBoard
      backlog={backlog.map(serializeTask)}
      completed={completed.map(serializeTask)}
      stats={stats}
      tasks={tasks.map(serializeTask)}
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
