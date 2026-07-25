import { useCallback, useEffect, useState } from "react";

const KEY = "shenas.plan.v1";

interface PlanState {
  planned: Record<string, boolean>; // dateKey -> ritual completed
  autoReplan: boolean; // keep today's plan up to date as things change
}

const DEFAULT: PlanState = { planned: {}, autoReplan: true };

const listeners = new Set<() => void>();
function notify() {
  for (const l of listeners) l();
}

function load(): PlanState {
  if (typeof window === "undefined") return DEFAULT;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return DEFAULT;
    return { ...DEFAULT, ...JSON.parse(raw) };
  } catch {
    return DEFAULT;
  }
}

function save(s: PlanState) {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    /* ignore */
  }
}

export function usePlanState() {
  const [state, setState] = useState<PlanState>(DEFAULT);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setState(load());
    setHydrated(true);
    const refresh = () => setState(load());
    listeners.add(refresh);
    const onStorage = (e: StorageEvent) => {
      if (e.key === KEY) refresh();
    };
    window.addEventListener("storage", onStorage);
    return () => {
      listeners.delete(refresh);
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  const markPlanned = useCallback((dateKey: string, val = true) => {
    const next = { ...load(), planned: { ...load().planned, [dateKey]: val } };
    save(next);
    setState(next);
    notify();
  }, []);

  const setAutoReplan = useCallback((val: boolean) => {
    const next = { ...load(), autoReplan: val };
    save(next);
    setState(next);
    notify();
  }, []);

  const isPlanned = useCallback(
    (dateKey: string): boolean => Boolean(state.planned[dateKey]),
    [state],
  );

  return {
    hydrated,
    isPlanned,
    markPlanned,
    autoReplan: state.autoReplan,
    setAutoReplan,
  };
}
