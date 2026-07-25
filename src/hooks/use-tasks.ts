import { useCallback, useEffect, useState } from "react";
import type { Task, TaskStatus } from "@/lib/tasks/types";
import { bucketOf, isActionable, isInbox } from "@/lib/tasks/gtd";
import { STORAGE_KEY, loadTasks, newId, saveTasks } from "@/lib/tasks/storage";
import { celebrate } from "@/lib/playful/celebrate";
import { soundComplete } from "@/lib/playful/sound";

const listeners = new Set<() => void>();
function notify() {
  for (const l of listeners) l();
}

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
    listeners.add(refresh);
    window.addEventListener("storage", onStorage);
    return () => {
      listeners.delete(refresh);
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  const persist = useCallback((next: Task[]) => {
    saveTasks(next);
    notify();
  }, []);

  const addTask = useCallback(
    (input: Omit<Task, "id" | "createdAt" | "status"> & { status?: TaskStatus }) => {
      const task: Task = {
        id: newId(),
        createdAt: new Date().toISOString(),
        status: input.status ?? "todo",
        ...input,
      };
      persist([task, ...loadTasks()]);
      return task;
    },
    [persist],
  );

  const updateTask = useCallback(
    (id: string, patch: Partial<Task>) => {
      const before = loadTasks().find((t) => t.id === id);
      persist(loadTasks().map((t) => (t.id === id ? { ...t, ...patch } : t)));
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
      persist(loadTasks().filter((t) => t.id !== id));
    },
    [persist],
  );

  const bulkUpdate = useCallback(
    (patches: Record<string, Partial<Task>>) => {
      persist(
        loadTasks().map((t) => (patches[t.id] ? { ...t, ...patches[t.id] } : t)),
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

