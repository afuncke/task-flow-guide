import { useSyncExternalStore } from "react";

const KEY = "shenas.playful";

let enabled = false;
let loaded = false;
const listeners = new Set<() => void>();

function emit() {
  for (const l of listeners) l();
}

function load() {
  if (loaded || typeof window === "undefined") return;
  loaded = true;
  try {
    enabled = window.localStorage.getItem(KEY) === "1";
  } catch {
    enabled = false;
  }
  applyClass();
}

function applyClass() {
  if (typeof document === "undefined") return;
  document.documentElement.classList.toggle("playful", enabled);
}

export const playfulStore = {
  subscribe(cb: () => void) {
    load();
    listeners.add(cb);
    return () => listeners.delete(cb);
  },
  getState() {
    return enabled;
  },
  getServerState() {
    return false;
  },
  set(next: boolean) {
    enabled = next;
    loaded = true;
    try {
      window.localStorage.setItem(KEY, next ? "1" : "0");
    } catch {
      /* ignore */
    }
    applyClass();
    emit();
  },
  toggle() {
    playfulStore.set(!enabled);
    return enabled;
  },
};

export function usePlayful() {
  return useSyncExternalStore(
    playfulStore.subscribe,
    playfulStore.getState,
    playfulStore.getServerState,
  );
}

/** Non-reactive read, safe in event handlers. */
export function isPlayful() {
  load();
  return enabled;
}
