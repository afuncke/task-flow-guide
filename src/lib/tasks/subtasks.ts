import type { Subtask, Task } from "./types";
import { newId } from "./storage";

/** A step is a checklist item inside one action — never a task of its own. */
export function newSubtask(title: string): Subtask {
  return { id: newId(), title: title.trim(), done: false };
}

export function subtaskProgress(task: Task): { done: number; total: number } | null {
  const list = task.subtasks;
  if (!list || list.length === 0) return null;
  return { done: list.filter((s) => s.done).length, total: list.length };
}

export function toggleSubtask(list: Subtask[], id: string): Subtask[] {
  return list.map((s) => (s.id === id ? { ...s, done: !s.done } : s));
}

export function allStepsDone(task: Task): boolean {
  const p = subtaskProgress(task);
  return p !== null && p.done === p.total;
}
