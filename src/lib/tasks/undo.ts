import type { Task } from "./types";
import { loadTasks, newId, saveTasks } from "./storage";

/**
 * Undo instead of "Are you sure?".
 *
 * Every mutation snapshots the task list first, so anything — delete, archive,
 * complete, auto-schedule, a whole planning ritual — can be walked back.
 * Nothing in Shenas asks you to confirm; you just act, and the app remembers
 * how to put it back.
 */
export interface UndoEntry {
  id: string;
  label: string;
  snapshot: Task[];
  at: number;
}

const MAX = 25;
/** How long the undo bar stays on screen. */
export const UNDO_WINDOW_MS = 8000;

let stack: UndoEntry[] = [];
const listeners = new Set<() => void>();

function emit() {
  for (const l of listeners) l();
}

export const undoStore = {
  subscribe(l: () => void) {
    listeners.add(l);
    return () => {
      listeners.delete(l);
    };
  },
  getSnapshot(): UndoEntry[] {
    return stack;
  },
  getServerSnapshot(): UndoEntry[] {
    return [];
  },
  /** Record the state *before* a change. Call right before writing. */
  push(label: string, snapshot: Task[] = loadTasks()) {
    stack = [...stack, { id: newId(), label, snapshot, at: Date.now() }].slice(-MAX);
    emit();
  },
  /** Step back one change. Returns the label of what was undone. */
  undo(): string | undefined {
    const entry = stack[stack.length - 1];
    if (!entry) return undefined;
    stack = stack.slice(0, -1);
    saveTasks(entry.snapshot); // notifies every useTasks subscriber
    emit();
    return entry.label;
  },
  /** Hide the undo bar without losing the ability to undo later via `u`. */
  dismiss() {
    const entry = stack[stack.length - 1];
    if (!entry) return;
    stack = [...stack.slice(0, -1), { ...entry, at: 0 }];
    emit();
  },
  clear() {
    stack = [];
    emit();
  },
};

export function latestUndo(): UndoEntry | undefined {
  return stack[stack.length - 1];
}
