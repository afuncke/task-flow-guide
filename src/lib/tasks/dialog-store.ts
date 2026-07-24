import { useSyncExternalStore } from "react";
import type { Task } from "./types";

type State = {
  open: boolean;
  task: Task | null;
  defaultDue?: string;
};

let state: State = { open: false, task: null };
const listeners = new Set<() => void>();

function emit() {
  for (const l of listeners) l();
}

export const taskDialogStore = {
  subscribe(cb: () => void) {
    listeners.add(cb);
    return () => listeners.delete(cb);
  },
  getState() {
    return state;
  },
  openNew(defaultDue?: string) {
    state = { open: true, task: null, defaultDue };
    emit();
  },
  openEdit(task: Task) {
    state = { open: true, task, defaultDue: undefined };
    emit();
  },
  close() {
    state = { ...state, open: false };
    emit();
  },
};

export function useTaskDialog() {
  return useSyncExternalStore(
    taskDialogStore.subscribe,
    taskDialogStore.getState,
    taskDialogStore.getState,
  );
}
