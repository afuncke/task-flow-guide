import { useCallback, useEffect, useState } from "react";
import type { Task, TaskStatus } from "@/lib/tasks/types";
import { STORAGE_KEY, loadTasks, newId, saveTasks } from "@/lib/tasks/storage";

export function useTasks() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setTasks(loadTasks());
    setHydrated(true);
    const onStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY) setTasks(loadTasks());
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const persist = useCallback((next: Task[]) => {
    setTasks(next);
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
      persist([task, ...loadTasks()]);
      return task;
    },
    [persist],
  );

  const updateTask = useCallback(
    (id: string, patch: Partial<Task>) => {
      persist(loadTasks().map((t) => (t.id === id ? { ...t, ...patch } : t)));
    },
    [persist],
  );

  const setStatus = useCallback(
    (id: string, status: TaskStatus) => {
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

  return { tasks, hydrated, addTask, updateTask, setStatus, deleteTask, bulkUpdate };
}
