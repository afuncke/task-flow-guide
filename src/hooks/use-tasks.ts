import { useCallback, useEffect, useState } from "react";
import type { Task, TaskStatus } from "@/lib/tasks/types";
import { bucketOf, isActionable, isInbox } from "@/lib/tasks/gtd";
import { STORAGE_KEY, loadTasks, newId, saveTasks, subscribeTasks } from "@/lib/tasks/storage";
import { undoStore } from "@/lib/tasks/undo";
import { celebrate } from "@/lib/playful/celebrate";
import { soundComplete } from "@/lib/playful/sound";

export function useTasks() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setTasks(loadTasks());
    setHydrated(true);
    const refresh = () => setTasks(loadTasks());
    const onStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY) refresh();
    };
    const unsubscribe = subscribeTasks(refresh);
    window.addEventListener("storage", onStorage);
    return () => {
      unsubscribe();
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  /**
   * Every write snapshots first, so nothing needs a confirm dialog —
   * the undo bar (and `u`) can always put it back.
   */
  const persist = useCallback((next: Task[], undoLabel?: string) => {
    if (undoLabel) undoStore.push(undoLabel, loadTasks());
    saveTasks(next);
  }, []);

  const addTask = useCallback(
    (input: Omit<Task, "id" | "createdAt" | "status"> & { status?: TaskStatus }) => {
      const task: Task = {
        id: newId(),
        createdAt: new Date().toISOString(),
        status: input.status ?? "todo",
        ...input,
      };
      persist([task, ...loadTasks()], `Added "${trim(task.title)}"`);
      return task;
    },
    [persist],
  );

  const updateTask = useCallback(
    (id: string, patch: Partial<Task>, label?: string) => {
      const before = loadTasks().find((t) => t.id === id);
      persist(
        loadTasks().map((t) => (t.id === id ? { ...t, ...patch } : t)),
        label ?? undoLabelFor(before, patch),
      );
      if (patch.status === "done" && before?.status !== "done") {
        soundComplete();
        celebrate();
      }
    },
    [persist],
  );

  const setStatus = useCallback(
    (id: string, status: TaskStatus) => {
      const before = loadTasks().find((t) => t.id === id);
      persist(
        loadTasks().map((t) =>
          t.id === id
            ? {
                ...t,
                status,
                completedAt: status === "done" ? new Date().toISOString() : undefined,
              }
            : t,
        ),
        status === "done"
          ? `Completed "${trim(before?.title)}"`
          : `Moved "${trim(before?.title)}"`,
      );
      if (status === "done" && before?.status !== "done") {
        soundComplete();
        celebrate();
      }
    },
    [persist],
  );

  const deleteTask = useCallback(
    (id: string) => {
      const before = loadTasks().find((t) => t.id === id);
      persist(
        loadTasks().filter((t) => t.id !== id),
        `Deleted "${trim(before?.title)}"`,
      );
    },
    [persist],
  );

  const bulkUpdate = useCallback(
    (patches: Record<string, Partial<Task>>, label = "Bulk change") => {
      persist(
        loadTasks().map((t) => (patches[t.id] ? { ...t, ...patches[t.id] } : t)),
        label,
      );
    },
    [persist],
  );

  const alive = tasks.filter((t) => !t.archived);
  // `tasks` = clarified, single-step actions. Inbox items, projects, waiting-for
  // and someday/maybe deliberately stay out of Focus / Plan / Board.
  const actionable = alive.filter(isActionable);

  return {
    tasks: actionable,
    allTasks: tasks,
    aliveTasks: alive,
    inbox: alive.filter(isInbox),
    waiting: alive.filter((t) => bucketOf(t) === "waiting" && !t.isProject),
    someday: alive.filter((t) => bucketOf(t) === "someday" && !t.isProject),
    projects: alive.filter((t) => t.isProject && t.status !== "done"),
    hydrated,
    addTask,
    updateTask,
    setStatus,
    deleteTask,
    bulkUpdate,
  };
}

function trim(title?: string): string {
  if (!title) return "task";
  return title.length > 32 ? `${title.slice(0, 31)}…` : title;
}

function undoLabelFor(before: Task | undefined, patch: Partial<Task>): string {
  const name = trim(before?.title);
  if (patch.archived === true) return `Let go of "${name}"`;
  if (patch.archived === false) return `Brought back "${name}"`;
  if (patch.status === "done") return `Completed "${name}"`;
  if (patch.due !== undefined) return `Re-dated "${name}"`;
  if (patch.scheduledStart !== undefined) return `Rescheduled "${name}"`;
  if (patch.myDay !== undefined) return `Changed My Day for "${name}"`;
  return `Edited "${name}"`;
}
