"use client";

import {
  FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  DndContext,
  DragOverlay,
  useDraggable,
  useDroppable,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import {
  GripVertical,
  Plus,
  ArrowUpRight,
  X,
  ImagePlus,
  FileText,
} from "lucide-react";
import ReactMarkdown from "react-markdown";

import {
  actionCreateTask,
  actionToggleChecklist,
  actionUpdateTaskStatus,
  actionUpdateTaskDetails,
} from "@/server/actions/tasks";
import {
  formatDeadline,
  getChecklistProgress,
  isTaskOverdue,
  SEVERITY_CONFIG,
  STATUS_CONFIG,
} from "@/lib/domain";
import type { TaskSeverity, TaskStatus, TaskView, UserView } from "@/types";
import { ThemeToggle } from "@/components/theme-toggle";

// ─── Types ────────────────────────────────────────────────────────────────────

type Stats = { todo: number; inProgress: number; done: number; overdue: number; backlog: number };

type BoardProps = {
  tasks: TaskView[];
  backlog: TaskView[];
  completed: TaskView[];
  users: UserView[];
  stats: Stats;
};

const KANBAN_STATUSES: TaskStatus[] = ["TODO", "IN_PROGRESS", "DONE"];
const SEVERITIES: TaskSeverity[] = ["RED", "ORANGE", "YELLOW", "GREEN", "RANDOM_IDEA"];

// Separate droppable ID for completed section to avoid conflict with kanban DONE column
const COMPLETED_DROP_ID = "COMPLETED_SECTION";

// ─── WorkspaceBoard ───────────────────────────────────────────────────────────

export function WorkspaceBoard({ tasks, backlog, completed, users, stats }: BoardProps) {
  const router = useRouter();
  const [memberId, setMemberId] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [createDestination, setCreateDestination] = useState<"BOARD" | "BACKLOG">("BOARD");
  const [notice, setNotice] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [activeTask, setActiveTask] = useState<TaskView | null>(null);
  const [detailTask, setDetailTask] = useState<TaskView | null>(null);

  const people = useMemo(() => new Map(users.map((u) => [u.id, u])), [users]);

  const allTasksMap = useMemo(() => {
    const m = new Map<string, TaskView>();
    [...tasks, ...backlog, ...completed].forEach((t) => m.set(t.id, t));
    return m;
  }, [tasks, backlog, completed]);

  const filteredBoard = useMemo(
    () => (memberId ? tasks.filter((t) => t.assigneeIds.includes(memberId)) : tasks),
    [memberId, tasks]
  );
  const filteredBacklog = useMemo(
    () => (memberId ? backlog.filter((t) => t.assigneeIds.includes(memberId)) : backlog),
    [memberId, backlog]
  );
  const filteredCompleted = useMemo(
    () => (memberId ? completed.filter((t) => t.assigneeIds.includes(memberId)) : completed),
    [memberId, completed]
  );

  const activeMemberCount = (id: string) =>
    tasks.filter(
      (t) => t.assigneeIds.includes(id) && (t.status === "TODO" || t.status === "IN_PROGRESS")
    ).length;

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  function refreshAfter(action: () => Promise<{ success: boolean; error?: string }>) {
    startTransition(async () => {
      const result = await action();
      if (!result.success) {
        setNotice(result.error ?? "Change could not be saved. Please try again.");
        return;
      }
      setNotice(null);
      router.refresh();
    });
  }

  function changeStatus(task: TaskView, newStatus: TaskStatus) {
    if (newStatus === task.status) return;
    refreshAfter(() =>
      actionUpdateTaskStatus({ taskId: task.id, newStatus, expectedVersion: task.version })
    );
  }

  function handleDragStart(event: DragStartEvent) {
    const task = allTasksMap.get(String(event.active.id));
    if (task) setActiveTask(task);
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveTask(null);
    const { active, over } = event;
    if (!over) return;

    const task = allTasksMap.get(String(active.id));
    if (!task) return;

    let target: TaskStatus | null = null;
    const overId = String(over.id);

    if (overId === COMPLETED_DROP_ID) {
      target = "DONE";
    } else if ((["TODO", "IN_PROGRESS", "DONE", "BACKLOG"] as string[]).includes(overId)) {
      target = overId as TaskStatus;
    } else {
      const overTask = allTasksMap.get(overId);
      if (overTask) target = overTask.status;
    }

    if (target && target !== task.status) changeStatus(task, target);
  }

  // Keep detailTask in sync with latest data after router.refresh()
  useEffect(() => {
    if (!detailTask) return;
    const updated = allTasksMap.get(detailTask.id);
    if (updated) setDetailTask(updated);
  }, [allTasksMap]); // eslint-disable-line react-hooks/exhaustive-deps

  function handleCreateSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const title = String(form.get("title") ?? "").trim();
    if (!title) return;

    const owner = String(form.get("owner") || "");
    refreshAfter(async () => {
      const result = await actionCreateTask({
        title,
        severity: String(form.get("severity")) as TaskSeverity,
        destination: createDestination,
        primaryOwnerId: owner || null,
        assigneeIds: owner ? [owner] : [],
      });
      if (result.success) setShowCreate(false);
      return result;
    });
  }

  return (
    <DndContext onDragEnd={handleDragEnd} onDragStart={handleDragStart} sensors={sensors}>
      <main className="mx-auto min-h-screen max-w-[1440px] px-4 pb-24 pt-6 sm:px-8 lg:px-12">

        {/* ── Nav ── */}
        <nav className="mb-8 flex items-center justify-between rounded-full border border-[var(--color-border)] bg-[var(--color-surface)]/90 px-6 py-3.5 shadow-sm backdrop-blur transition-colors">
          <Link className="font-[family-name:var(--font-outfit)] text-xl font-bold tracking-tight text-[var(--color-text-primary)]" href="/">
            Sastra<span className="text-[var(--color-brand)]">Net</span>
          </Link>
          <div className="flex items-center gap-5 text-sm font-semibold text-[var(--color-text-secondary)]">
            {[{ href: "/", label: "Board" }, { href: "/pods", label: "Pods" }, { href: "/ideas", label: "Ideas" }, { href: "/feedback", label: "Feedback" }, { href: "/voting", label: "Voting" }].map(({ href, label }) => (
              <Link key={href} className="transition hover:text-[var(--color-text-primary)]" href={href}>
                {label}
              </Link>
            ))}
            <div className="border-l border-[var(--color-border)] pl-2">
              <ThemeToggle />
            </div>
          </div>
        </nav>

        {/* ── Error notice ── */}
        {notice ? (
          <p className="mb-6 rounded-2xl border border-[var(--severity-red)]/30 bg-[var(--severity-red)]/10 px-4 py-3 text-sm font-medium text-[var(--severity-red)]" role="alert">
            {notice}
          </p>
        ) : null}

        {/* ── Toolbar: stats + Add Task button ── */}
        <section className="mb-6 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] px-5 py-4 shadow-sm transition-colors sm:px-6">
          <div className="flex flex-wrap items-center gap-5">
            <StatPill label="To Do" value={stats.todo} />
            <StatPill label="In Progress" value={stats.inProgress} />
            <StatPill label="Overdue" value={stats.overdue} warning />
            <StatPill label="Backlog" value={stats.backlog} />
          </div>
          <button
            className="flex items-center gap-1.5 rounded-full bg-[var(--color-brand)] px-4 py-2 text-sm font-bold text-white shadow-sm transition hover:opacity-95"
            onClick={() => { setCreateDestination("BOARD"); setShowCreate((v) => !v); }}
            type="button"
          >
            <Plus className="h-4 w-4" />
            <span>Add Task</span>
          </button>
        </section>

        {/* ── Create Task Form ── */}
        {showCreate ? (
          <form
            className="mb-6 grid gap-3 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5 shadow-md sm:grid-cols-[1fr_160px_160px_140px_auto]"
            onSubmit={handleCreateSubmit}
          >
            <input
              autoFocus
              aria-label="Task title"
              className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-elevated)] px-3.5 py-2.5 text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] outline-none transition focus:border-[var(--color-brand)]"
              name="title"
              placeholder="What needs doing?"
              required
            />
            <select
              aria-label="Destination"
              className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-elevated)] px-3 py-2.5 text-sm font-semibold text-[var(--color-text-primary)] outline-none transition focus:border-[var(--color-brand)]"
              onChange={(e) => setCreateDestination(e.target.value as "BOARD" | "BACKLOG")}
              value={createDestination}
            >
              <option value="BOARD">Board (To Do)</option>
              <option value="BACKLOG">Backlog</option>
            </select>
            <select
              aria-label="Severity"
              className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-elevated)] px-3 py-2.5 text-sm text-[var(--color-text-primary)] outline-none transition focus:border-[var(--color-brand)]"
              defaultValue="YELLOW"
              name="severity"
            >
              {SEVERITIES.map((s) => (
                <option key={s} value={s}>{SEVERITY_CONFIG[s].label}</option>
              ))}
            </select>
            <select
              aria-label="Owner"
              className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-elevated)] px-3 py-2.5 text-sm text-[var(--color-text-primary)] outline-none transition focus:border-[var(--color-brand)]"
              name="owner"
            >
              <option value="">No owner</option>
              {users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
            </select>
            <div className="flex gap-2">
              <button className="rounded-xl bg-[var(--color-primary-button-bg)] px-4 py-2.5 text-sm font-bold text-[var(--color-primary-button-text)] shadow-sm transition hover:opacity-90 disabled:opacity-50" disabled={pending} type="submit">
                Create
              </button>
              <button className="rounded-xl border border-[var(--color-border)] px-3 py-2.5 text-sm font-semibold text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]" onClick={() => setShowCreate(false)} type="button">
                Cancel
              </button>
            </div>
          </form>
        ) : null}

        {/* ── Member filter pills ── */}
        <div aria-label="Filter by member" className="mb-6 flex gap-2 overflow-x-auto pb-1">
          <FilterPill active={!memberId} onClick={() => setMemberId(null)}>
            All ({tasks.length})
          </FilterPill>
          {users.map((u) => (
            <FilterPill active={memberId === u.id} key={u.id} onClick={() => setMemberId(u.id)}>
              {u.name} ({activeMemberCount(u.id)})
            </FilterPill>
          ))}
        </div>

        {/* ── Kanban board columns ── */}
        <section aria-label="Board columns" className="grid gap-5 pb-4 lg:grid-cols-3">
          {KANBAN_STATUSES.map((status) => {
            const col = filteredBoard.filter((t) => t.status === status);
            return (
              <KanbanColumn count={col.length} id={status} key={status} title={STATUS_CONFIG[status].label}>
                {col.map((task) => (
                  <DraggableCard
                    key={task.id}
                    onOpen={() => setDetailTask(task)}
                    onStatus={(s) => changeStatus(task, s)}
                    onToggle={(itemId) => refreshAfter(() => actionToggleChecklist({ taskId: task.id, itemId }))}
                    pending={pending}
                    people={people}
                    task={task}
                  />
                ))}
                {col.length === 0 && (
                  <div className="flex h-24 items-center justify-center rounded-xl border border-dashed border-[var(--color-border)] text-xs text-[var(--color-text-muted)]">
                    Drop tasks here
                  </div>
                )}
              </KanbanColumn>
            );
          })}
        </section>

        {/* ── Backlog ── */}
        <BacklogSection
          backlog={filteredBacklog}
          onAddClick={() => { setCreateDestination("BACKLOG"); setShowCreate(true); }}
          onOpen={setDetailTask}
          onStatusChange={changeStatus}
          people={people}
        />

        {/* ── Completed ── */}
        <CompletedSection
          completed={filteredCompleted}
          onOpen={setDetailTask}
          onStatusChange={changeStatus}
          people={people}
        />

        {/* ── Hero / workspace identity (bottom) ── */}
        <section className="mt-14 grid gap-6 rounded-[2rem] border border-[var(--color-border)] bg-[var(--color-surface)] p-6 shadow-sm transition-colors sm:p-9 lg:grid-cols-[1fr_auto]">
          <div>
            <p className="font-mono text-xs font-semibold uppercase tracking-[0.18em] text-[var(--color-brand)]">
              SastraNet
            </p>
            <h2 className="mt-3 font-[family-name:var(--font-outfit)] text-3xl font-bold tracking-tight text-[var(--color-text-primary)] sm:text-4xl">
              Let&apos;s Do The Impossible Together
            </h2>
            <p className="mt-2 text-sm text-[var(--color-text-secondary)]">
              A focused workspace for getting things shipped — one task at a time.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3 self-end sm:grid-cols-4 lg:grid-cols-2">
            <MetricCard label="To Do" value={stats.todo} />
            <MetricCard label="In Progress" value={stats.inProgress} />
            <MetricCard label="Overdue" value={stats.overdue} warning />
            <MetricCard label="Backlog" value={stats.backlog} />
          </div>
        </section>

        {/* ── Drag overlay ghost ── */}
        <DragOverlay>
          {activeTask ? (
            <div className="w-[340px] rotate-2 opacity-95 shadow-2xl">
              <CardInner isDragging onOpen={() => {}} onStatus={() => {}} onToggle={() => {}} pending={false} people={people} task={activeTask} />
            </div>
          ) : null}
        </DragOverlay>
      </main>

      {/* ── Task Detail Modal ── */}
      {detailTask && (
        <TaskDetailModal
          onClose={() => setDetailTask(null)}
          onSave={(fields) =>
            refreshAfter(() =>
              actionUpdateTaskDetails({ taskId: detailTask.id, fields })
            )
          }
          onStatus={(s) => changeStatus(detailTask, s)}
          pending={pending}
          people={people}
          task={detailTask}
          users={users}
        />
      )}
    </DndContext>
  );
}

// ─── Task Detail Modal ────────────────────────────────────────────────────────

function TaskDetailModal({
  task, people, users, pending, onClose, onSave, onStatus,
}: {
  task: TaskView; people: Map<string, UserView>; users: UserView[];
  pending: boolean;
  onClose: () => void;
  onSave: (fields: { description?: string }) => void;
  onStatus: (s: TaskStatus) => void;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState(task.description ?? "");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const color = severityColor(task.severity);

  useEffect(() => {
    if (!isEditing) setDraft(task.description ?? "");
  }, [task.description, isEditing]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  const handlePaste = useCallback(
    (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
      const items = Array.from(e.clipboardData.items);
      const imageItem = items.find((i) => i.type.startsWith("image/"));
      if (!imageItem) return;
      e.preventDefault();
      const file = imageItem.getAsFile();
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (ev) => {
        const dataUrl = ev.target?.result as string;
        const markdownImg = `\n![screenshot](${dataUrl})\n`;
        const ta = textareaRef.current;
        if (ta) {
          const start = ta.selectionStart;
          const end = ta.selectionEnd;
          const newVal = draft.slice(0, start) + markdownImg + draft.slice(end);
          setDraft(newVal);
          requestAnimationFrame(() => { ta.selectionStart = ta.selectionEnd = start + markdownImg.length; });
        } else {
          setDraft((prev) => prev + markdownImg);
        }
      };
      reader.readAsDataURL(file);
    },
    [draft]
  );

  function handleSave() {
    onSave({ description: draft });
    setIsEditing(false);
  }

  const ALL_STATUSES: TaskStatus[] = ["TODO", "IN_PROGRESS", "DONE", "BACKLOG"];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label={`Task: ${task.title}`}>
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 flex w-full max-w-3xl flex-col rounded-[1.75rem] border border-[var(--color-border)] bg-[var(--color-surface)] shadow-2xl max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-start gap-3 px-6 pt-6 pb-4 border-b border-[var(--color-border)]" style={{ borderTopColor: color, borderTopWidth: 3 }}>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="font-mono text-xs font-semibold text-[var(--color-text-secondary)]">#{task.displayNumber}</span>
              <SeverityBadge severity={task.severity} />
            </div>
            <h2 className="font-[family-name:var(--font-outfit)] text-xl font-bold text-[var(--color-text-primary)] leading-snug">{task.title}</h2>
          </div>
          <button className="shrink-0 rounded-full p-1.5 text-[var(--color-text-muted)] hover:bg-[var(--color-surface-elevated)] hover:text-[var(--color-text-primary)] transition" onClick={onClose} type="button" aria-label="Close">
            <X className="h-5 w-5" />
          </button>
        </div>
        {/* Meta row */}
        <div className="flex flex-wrap items-center gap-3 px-6 py-3 border-b border-[var(--color-border)] text-sm">
          <div className="flex items-center gap-1.5">
            <span className="text-[var(--color-text-muted)] text-xs font-semibold uppercase tracking-wider">Status</span>
            <select aria-label="Task status" className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-elevated)] px-2.5 py-1 text-xs font-semibold text-[var(--color-text-primary)] outline-none transition focus:border-[var(--color-brand)]" disabled={pending} onChange={(e) => onStatus(e.target.value as TaskStatus)} value={task.status}>
              {ALL_STATUSES.map((s) => (<option key={s} value={s}>{STATUS_CONFIG[s].label}</option>))}
            </select>
          </div>
          {task.primaryOwnerId && (
            <div className="flex items-center gap-1.5">
              <span className="text-[var(--color-text-muted)] text-xs font-semibold uppercase tracking-wider">Owner</span>
              <span className="text-[var(--color-text-primary)] font-semibold text-xs">{people.get(task.primaryOwnerId)?.name ?? "Unassigned"}</span>
            </div>
          )}
          {task.deadline && (
            <div className="flex items-center gap-1.5">
              <span className="text-[var(--color-text-muted)] text-xs font-semibold uppercase tracking-wider">Due</span>
              <span className={isTaskOverdue(task) ? "text-xs font-bold text-red-500" : "text-xs text-[var(--color-text-secondary)]"}>{formatDeadline(task.deadline, isTaskOverdue(task))}</span>
            </div>
          )}
        </div>
        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          <div>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--color-text-secondary)] flex items-center gap-1.5">
                <FileText className="h-3.5 w-3.5" /> Description / Notes
              </h3>
              {!isEditing ? (
                <button className="text-xs font-semibold text-[var(--color-brand)] hover:underline transition" onClick={() => { setIsEditing(true); requestAnimationFrame(() => textareaRef.current?.focus()); }} type="button">
                  {task.description ? "Edit" : "+ Add notes"}
                </button>
              ) : (
                <div className="flex gap-2">
                  <button className="text-xs font-semibold text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]" onClick={() => { setDraft(task.description ?? ""); setIsEditing(false); }} type="button">Cancel</button>
                  <button className="text-xs font-bold text-[var(--color-brand)] hover:underline disabled:opacity-50" disabled={pending} onClick={handleSave} type="button">Save</button>
                </div>
              )}
            </div>
            {isEditing ? (
              <div className="rounded-xl border border-[var(--color-brand)]/50 overflow-hidden">
                <textarea ref={textareaRef} className="w-full min-h-[200px] bg-[var(--color-surface-elevated)] px-4 py-3 text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] outline-none resize-y font-mono leading-relaxed" onChange={(e) => setDraft(e.target.value)} onPaste={handlePaste} placeholder="Write notes in Markdown… Paste screenshots with Ctrl+V" value={draft} />
                <div className="flex items-center gap-2 px-3 py-1.5 bg-[var(--color-surface-elevated)] border-t border-[var(--color-border)] text-[10px] text-[var(--color-text-muted)]">
                  <ImagePlus className="h-3 w-3" />
                  <span>Paste screenshot with <kbd className="rounded border border-[var(--color-border)] px-1 py-0.5 font-mono">Ctrl+V</kbd> · Markdown supported</span>
                </div>
              </div>
            ) : task.description ? (
              <div className="prose prose-sm dark:prose-invert max-w-none rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-elevated)] px-4 py-3 text-[var(--color-text-primary)] [&_img]:rounded-xl [&_img]:max-w-full [&_img]:my-2 [&_img]:border [&_img]:border-[var(--color-border)] [&_pre]:bg-[var(--color-canvas-subtle)] [&_pre]:rounded-lg [&_pre]:p-3 [&_code]:text-[var(--color-brand)] [&_a]:text-[var(--color-brand)]">
                <ReactMarkdown>{task.description}</ReactMarkdown>
              </div>
            ) : (
              <div className="rounded-xl border border-dashed border-[var(--color-border)] px-4 py-6 text-center text-sm text-[var(--color-text-muted)]">
                No notes yet. Click <strong>+ Add notes</strong> to write in Markdown or paste a screenshot.
              </div>
            )}
          </div>
          {task.checklist.length > 0 && (
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--color-text-secondary)] mb-2">Checklist ({task.checklist.filter((i) => i.done).length}/{task.checklist.length})</h3>
              <div className="space-y-1.5">
                {task.checklist.map((item) => (
                  <label className="flex cursor-pointer items-center gap-2 rounded-lg px-3 py-2 hover:bg-[var(--color-surface-elevated)] transition text-sm text-[var(--color-text-primary)]" key={item.id}>
                    <input checked={item.done} className="accent-[var(--color-brand)]" disabled={pending} readOnly type="checkbox" />
                    <span className={item.done ? "text-[var(--color-text-muted)] line-through" : ""}>{item.label}</span>
                  </label>
                ))}
              </div>
            </div>
          )}
          <div className="text-xs text-[var(--color-text-muted)] pt-2 border-t border-[var(--color-border)] flex flex-wrap gap-x-4 gap-y-1">
            <span>Created {new Date(task.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}</span>
            <span>Updated {new Date(task.updatedAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}</span>
            {task.completedAt && <span>Completed {new Date(task.completedAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}</span>}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Kanban Column ────────────────────────────────────────────────────────────

function KanbanColumn({ id, title, count, children }: { id: string; title: string; count: number; children: React.ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id });
  return (
    <section
      className={`min-w-[290px] rounded-[1.5rem] border p-4 transition-all ${
        isOver
          ? "border-[var(--color-brand)] bg-[var(--color-surface-elevated)] ring-2 ring-[var(--color-brand)]/25"
          : "border-[var(--color-border)] bg-[var(--color-canvas-subtle)]"
      }`}
      ref={setNodeRef}
    >
      <div className="mb-4 flex items-center justify-between px-1">
        <h2 className="text-sm font-bold uppercase tracking-[0.1em] text-[var(--color-text-primary)]">{title}</h2>
        <span className="rounded-full border border-[var(--color-border)] bg-[var(--color-surface)] px-2.5 py-0.5 font-mono text-xs font-semibold text-[var(--color-text-primary)]">
          {count}
        </span>
      </div>
      <div className="min-h-[200px] space-y-3">{children}</div>
    </section>
  );
}

// ─── Draggable Card ───────────────────────────────────────────────────────────

function DraggableCard({ task, people, pending, onStatus, onToggle, onOpen }: { task: TaskView; people: Map<string, UserView>; pending: boolean; onStatus: (s: TaskStatus) => void; onToggle: (id: string) => void; onOpen: () => void }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: task.id, data: { task } });
  return (
    <div
      className={isDragging ? "scale-95 opacity-30" : "opacity-100"}
      ref={setNodeRef}
      style={transform ? { transform: `translate3d(${transform.x}px,${transform.y}px,0)` } : undefined}
    >
      <CardInner dragHandleProps={{ ...attributes, ...listeners }} onOpen={onOpen} onStatus={onStatus} onToggle={onToggle} pending={pending} people={people} task={task} />
    </div>
  );
}

// ─── Card Inner ───────────────────────────────────────────────────────────────

function CardInner({
  task, people, pending, onStatus, onToggle, onOpen, dragHandleProps, isDragging = false,
}: {
  task: TaskView; people: Map<string, UserView>; pending: boolean;
  onStatus: (s: TaskStatus) => void; onToggle: (id: string) => void; onOpen: () => void;
  dragHandleProps?: Record<string, unknown>; isDragging?: boolean;
}) {
  const progress = getChecklistProgress(task);
  const color = severityColor(task.severity);
  return (
    <article
      className={`rounded-2xl border border-[var(--color-border)] border-l-4 bg-[var(--color-surface)] p-4 shadow-sm transition hover:shadow-md ${isDragging ? "ring-2 ring-[var(--color-brand)]" : ""}`}
      style={{ borderLeftColor: color }}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <button aria-label="Drag" className="cursor-grab text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] active:cursor-grabbing" type="button" {...dragHandleProps}>
            <GripVertical className="h-4 w-4" />
          </button>
          <span className="font-mono text-xs font-semibold text-[var(--color-text-secondary)]">#{task.displayNumber}</span>
        </div>
        <SeverityBadge severity={task.severity} />
      </div>

      <button
        className="mt-2.5 w-full text-left font-[family-name:var(--font-outfit)] text-base font-bold leading-snug text-[var(--color-text-primary)] hover:text-[var(--color-brand)] transition-colors"
        onClick={onOpen}
        type="button"
      >
        {task.title}
        {task.description && (
          <span className="ml-1.5 inline-block opacity-40"><FileText className="inline h-3.5 w-3.5" /></span>
        )}
      </button>

      {task.primaryOwnerId ? (
        <p className="mt-1.5 text-xs text-[var(--color-text-secondary)]">
          {people.get(task.primaryOwnerId)?.name ?? "Unassigned"}
        </p>
      ) : null}

      {task.checklist.length ? (
        <div className="mt-3.5 border-t border-[var(--color-divider)] pt-3">
          <p className="mb-2 text-xs font-bold uppercase tracking-wider text-[var(--color-text-secondary)]">
            Checklist {progress.done}/{progress.total}
          </p>
          {task.checklist.map((item) => (
            <label className="mb-1.5 flex cursor-pointer items-center gap-2 text-sm text-[var(--color-text-primary)]" key={item.id}>
              <input checked={item.done} className="accent-[var(--color-brand)]" disabled={pending} onChange={() => onToggle(item.id)} type="checkbox" />
              <span className={item.done ? "text-[var(--color-text-muted)] line-through" : ""}>{item.label}</span>
            </label>
          ))}
        </div>
      ) : null}

      <div className="mt-3.5 flex items-center justify-between gap-2">
        {task.deadline ? (
          <span className={isTaskOverdue(task) ? "text-xs font-bold text-red-500" : "text-xs text-[var(--color-text-secondary)]"}>
            {formatDeadline(task.deadline, isTaskOverdue(task))}
          </span>
        ) : <span />}
        <select
          aria-label={`Change status: ${task.title}`}
          className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-elevated)] px-2.5 py-1 text-xs font-semibold text-[var(--color-text-primary)] outline-none transition focus:border-[var(--color-brand)]"
          disabled={pending}
          onChange={(e) => onStatus(e.target.value as TaskStatus)}
          value={task.status}
        >
          {(["TODO", "IN_PROGRESS", "DONE", "BACKLOG"] as TaskStatus[]).map((s) => (
            <option key={s} value={s}>{STATUS_CONFIG[s].label}</option>
          ))}
        </select>
      </div>
    </article>
  );
}

// ─── Backlog Section ──────────────────────────────────────────────────────────

function BacklogSection({ backlog, people, onAddClick, onStatusChange, onOpen }: { backlog: TaskView[]; people: Map<string, UserView>; onAddClick: () => void; onStatusChange: (t: TaskView, s: TaskStatus) => void; onOpen: (t: TaskView) => void }) {
  const { setNodeRef, isOver } = useDroppable({ id: "BACKLOG" });
  return (
    <section
      className={`mt-10 rounded-[1.75rem] border p-5 shadow-sm transition-all sm:p-7 ${isOver ? "border-2 border-dashed border-[var(--color-brand)] bg-[var(--color-surface-elevated)] ring-2 ring-[var(--color-brand)]/20" : "border-[var(--color-border)] bg-[var(--color-surface)]"}`}
      ref={setNodeRef}
    >
      <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="font-mono text-xs font-semibold uppercase tracking-wider text-[var(--color-brand)]">Keep it honest</p>
          <h2 className="mt-1 text-2xl font-bold text-[var(--color-text-primary)]">Backlog ({backlog.length})</h2>
          <p className="text-xs text-[var(--color-text-secondary)]">Drag cards from the board to park them, or promote them back up.</p>
        </div>
        <div className="flex items-center gap-2">
          {isOver && <span className="rounded-full bg-[var(--color-brand)] px-2.5 py-1 text-xs font-bold text-white animate-pulse">Drop to park here</span>}
          <button className="flex items-center gap-1.5 rounded-full bg-[var(--color-brand)] px-4 py-2 text-sm font-bold text-white shadow-sm transition hover:opacity-95" onClick={onAddClick} type="button">
            <Plus className="h-4 w-4" /> Add to Backlog
          </button>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[700px] text-left text-sm">
          <thead className="border-b border-[var(--color-border)] font-mono text-xs uppercase tracking-wider text-[var(--color-text-secondary)]">
            <tr>
              <th className="w-8 py-3" />
              <th className="py-3">#</th>
              <th>Task</th>
              <th>Severity</th>
              <th>Owner</th>
              <th>Age</th>
              <th className="text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {backlog.length === 0 && (
              <tr><td className="py-8 text-center text-sm text-[var(--color-text-secondary)]" colSpan={7}>Backlog is clean — add new ideas or drag tasks here.</td></tr>
            )}
            {backlog.map((task) => (
              <BacklogRow key={task.id} onOpen={() => onOpen(task)} onStatusChange={(s) => onStatusChange(task, s)} people={people} task={task} />
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function BacklogRow({ task, people, onStatusChange, onOpen }: { task: TaskView; people: Map<string, UserView>; onStatusChange: (s: TaskStatus) => void; onOpen: () => void }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: task.id, data: { task } });
  const isRusted = daysSince(task.updatedAt) >= 21;
  return (
    <tr
      className={`border-b border-[var(--color-divider)] last:border-0 hover:bg-[var(--color-surface-elevated)]/50 transition-colors ${isDragging ? "opacity-30" : ""}`}
      ref={setNodeRef}
      style={transform ? { transform: `translate3d(${transform.x}px,${transform.y}px,0)` } : undefined}
    >
      <td className="py-4 pl-1">
        <button aria-label="Drag task" className="cursor-grab text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] active:cursor-grabbing" type="button" {...attributes} {...listeners}>
          <GripVertical className="h-4 w-4" />
        </button>
      </td>
      <td className="py-4 font-mono text-xs font-semibold text-[var(--color-text-secondary)]">#{task.displayNumber}</td>
      <td className={isRusted ? "text-[var(--color-text-secondary)]" : "font-semibold text-[var(--color-text-primary)]"}>
        <button className="text-left hover:text-[var(--color-brand)] transition-colors" onClick={onOpen} type="button">
          {task.title}
          {task.description && <FileText className="inline ml-1.5 h-3.5 w-3.5 opacity-40" />}
        </button>
        {isRusted && <span className="ml-2 rounded-md bg-amber-500/10 px-1.5 py-0.5 font-mono text-xs font-semibold text-amber-500">Rusted ({daysSince(task.updatedAt)}d)</span>}
      </td>
      <td><SeverityBadge severity={task.severity} /></td>
      <td className="text-[var(--color-text-primary)]">
        {task.primaryOwnerId ? people.get(task.primaryOwnerId)?.name ?? "Unassigned" : "Unassigned"}
      </td>
      <td className="font-mono text-xs text-[var(--color-text-secondary)]">{daysSince(task.createdAt)}d</td>
      <td className="text-right">
        <div className="flex items-center justify-end gap-2">
          <button
            className="inline-flex items-center gap-1 rounded-lg border border-[var(--color-brand)] bg-[var(--color-brand)]/10 px-2.5 py-1 text-xs font-bold text-[var(--color-brand)] transition hover:bg-[var(--color-brand)] hover:text-white"
            onClick={() => onStatusChange("TODO")}
            title="Move to board (To Do)"
            type="button"
          >
            To Board <ArrowUpRight className="h-3.5 w-3.5" />
          </button>
          <select
            aria-label={`Status: ${task.title}`}
            className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-elevated)] px-2 py-1 text-xs font-semibold text-[var(--color-text-primary)] outline-none transition focus:border-[var(--color-brand)]"
            onChange={(e) => onStatusChange(e.target.value as TaskStatus)}
            value={task.status}
          >
            {(["BACKLOG", "TODO", "IN_PROGRESS", "DONE"] as TaskStatus[]).map((s) => (
              <option key={s} value={s}>{STATUS_CONFIG[s].label}</option>
            ))}
          </select>
        </div>
      </td>
    </tr>
  );
}

// ─── Completed Section ────────────────────────────────────────────────────────

function CompletedSection({ completed, people, onStatusChange, onOpen }: { completed: TaskView[]; people: Map<string, UserView>; onStatusChange: (t: TaskView, s: TaskStatus) => void; onOpen: (t: TaskView) => void }) {
  const { setNodeRef, isOver } = useDroppable({ id: COMPLETED_DROP_ID });
  return (
    <section
      className={`mt-10 rounded-[1.75rem] border p-5 shadow-sm transition-all sm:p-7 ${isOver ? "border-2 border-dashed border-emerald-500 bg-[var(--color-surface-elevated)] ring-2 ring-emerald-500/20" : "border-[var(--color-border)] bg-[var(--color-surface)]"}`}
      ref={setNodeRef}
    >
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-[var(--color-text-primary)]">Ready for Release ({completed.length})</h2>
          <p className="text-xs text-[var(--color-text-secondary)]">Drag cards here to mark ready for release, or reopen them.</p>
        </div>
        {isOver && <span className="rounded-full bg-emerald-600 px-2.5 py-1 text-xs font-bold text-white animate-pulse">Drop to mark ready</span>}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[620px] text-left text-sm">
          <thead className="border-b border-[var(--color-border)] font-mono text-xs uppercase tracking-wider text-[var(--color-text-secondary)]">
            <tr>
              <th className="w-8 py-3" />
              <th className="py-3">#</th>
              <th>Task</th>
              <th>Owner</th>
              <th>Completed</th>
              <th className="text-right">Reopen</th>
            </tr>
          </thead>
          <tbody>
            {completed.length === 0 && (
              <tr><td className="py-6 text-center text-sm text-[var(--color-text-secondary)]" colSpan={6}>No completed tasks yet.</td></tr>
            )}
            {completed.map((task) => (
              <CompletedRow key={task.id} onOpen={() => onOpen(task)} onStatusChange={(s) => onStatusChange(task, s)} people={people} task={task} />
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function CompletedRow({ task, people, onStatusChange, onOpen }: { task: TaskView; people: Map<string, UserView>; onStatusChange: (s: TaskStatus) => void; onOpen: () => void }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: task.id, data: { task } });
  return (
    <tr
      className={`border-b border-[var(--color-divider)] last:border-0 hover:bg-[var(--color-surface-elevated)]/50 transition-colors ${isDragging ? "opacity-30" : ""}`}
      ref={setNodeRef}
      style={transform ? { transform: `translate3d(${transform.x}px,${transform.y}px,0)` } : undefined}
    >
      <td className="py-4 pl-1">
        <button aria-label="Drag task" className="cursor-grab text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] active:cursor-grabbing" type="button" {...attributes} {...listeners}>
          <GripVertical className="h-4 w-4" />
        </button>
      </td>
      <td className="py-4 font-mono text-xs font-semibold text-[var(--color-text-secondary)]">#{task.displayNumber}</td>
      <td className="font-semibold text-[var(--color-text-primary)]">
        <button className="text-left hover:text-[var(--color-brand)] transition-colors" onClick={onOpen} type="button">
          {task.title}
          {task.description && <FileText className="inline ml-1.5 h-3.5 w-3.5 opacity-40" />}
        </button>
      </td>
      <td className="text-[var(--color-text-primary)]">
        {task.primaryOwnerId ? people.get(task.primaryOwnerId)?.name ?? "Unassigned" : "Unassigned"}
      </td>
      <td className="font-mono text-xs text-[var(--color-text-secondary)]">
        {task.completedAt ? new Intl.DateTimeFormat("en-IN", { month: "short", day: "numeric" }).format(new Date(task.completedAt)) : "—"}
      </td>
      <td className="text-right">
        <select
          aria-label={`Reopen: ${task.title}`}
          className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-elevated)] px-2 py-1 text-xs font-semibold text-[var(--color-text-primary)] outline-none transition focus:border-[var(--color-brand)]"
          onChange={(e) => onStatusChange(e.target.value as TaskStatus)}
          value={task.status}
        >
          {(["DONE", "IN_PROGRESS", "TODO", "BACKLOG"] as TaskStatus[]).map((s) => (
            <option key={s} value={s}>{s === "DONE" ? "Ready for Release ✓" : `Reopen → ${STATUS_CONFIG[s].label}`}</option>
          ))}
        </select>
      </td>
    </tr>
  );
}

// ─── Helper components ────────────────────────────────────────────────────────

function SeverityBadge({ severity }: { severity: TaskSeverity }) {
  const color = severityColor(severity);
  return (
    <span className="rounded-full border px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider" style={{ backgroundColor: `${color}18`, borderColor: `${color}35`, color }}>
      {SEVERITY_CONFIG[severity].label}
    </span>
  );
}

function MetricCard({ label, value, warning = false }: { label: string; value: number; warning?: boolean }) {
  return (
    <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface-elevated)] px-4 py-3 transition-colors">
      <p className="text-xs font-semibold text-[var(--color-text-secondary)]">{label}</p>
      <p className={warning && value ? "mt-1 text-2xl font-bold text-red-500" : "mt-1 text-2xl font-bold text-[var(--color-text-primary)]"}>{value}</p>
    </div>
  );
}

function StatPill({ label, value, warning = false }: { label: string; value: number; warning?: boolean }) {
  return (
    <div className="flex items-center gap-2">
      <span className={`text-lg font-bold ${warning && value ? "text-red-500" : "text-[var(--color-text-primary)]"}`}>{value}</span>
      <span className="text-sm text-[var(--color-text-secondary)]">{label}</span>
    </div>
  );
}

function FilterPill({ active, children, onClick }: { active: boolean; children: React.ReactNode; onClick: () => void }) {
  return (
    <button
      className={active
        ? "shrink-0 rounded-full bg-[var(--color-primary-button-bg)] px-4 py-2 text-sm font-semibold text-[var(--color-primary-button-text)] shadow-sm transition"
        : "shrink-0 rounded-full border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-2 text-sm font-semibold text-[var(--color-text-secondary)] transition hover:border-[var(--color-border-hover)] hover:text-[var(--color-text-primary)]"}
      onClick={onClick}
      type="button"
    >
      {children}
    </button>
  );
}

// ─── Utilities ────────────────────────────────────────────────────────────────

function daysSince(value: string) {
  return Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 86_400_000));
}

function severityColor(severity: TaskSeverity) {
  return ({ RED: "#ef4444", ORANGE: "#f97316", YELLOW: "#eab308", GREEN: "#22c55e", RANDOM_IDEA: "#a855f7" } as const)[severity];
}
