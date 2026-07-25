import { useSyncExternalStore } from "react";

let open = false;
const listeners = new Set<() => void>();

function emit() {
  for (const l of listeners) l();
}

/** Ubiquitous capture: one keystroke, no decisions, always available. */
export const captureStore = {
  subscribe(cb: () => void) {
    listeners.add(cb);
    return () => listeners.delete(cb);
  },
  getState() {
    return open;
  },
  open() {
    open = true;
    emit();
  },
  close() {
    open = false;
    emit();
  },
};

export function useCaptureOpen() {
  return useSyncExternalStore(captureStore.subscribe, captureStore.getState, () => false);
}
