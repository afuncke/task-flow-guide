import { useCallback, useEffect, useState } from "react";
import {
  DEFAULT_SCHEDULE,
  computeAutoState,
  type CurrentState,
  type Duration,
  type Energy,
  type Location,
  type WorkSchedule,
} from "@/lib/tasks/context";

const KEY = "shenas-context-v1";

interface StoredState {
  location: Location;
  energy: Energy;
  duration: Duration;
  schedule: WorkSchedule;
  autoEnergy: boolean;
  hideMismatches: boolean;
}

const DEFAULT_STATE: StoredState = {
  location: "anywhere",
  energy: "any",
  duration: "any",
  schedule: DEFAULT_SCHEDULE,
  autoEnergy: true,
  hideMismatches: false,
};

function load(): StoredState {
  if (typeof window === "undefined") return DEFAULT_STATE;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return DEFAULT_STATE;
    return { ...DEFAULT_STATE, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_STATE;
  }
}

function save(s: StoredState) {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    /* ignore */
  }
}

export function useContextState() {
  const [state, setState] = useState<StoredState>(DEFAULT_STATE);
  const [hydrated, setHydrated] = useState(false);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    setState(load());
    setHydrated(true);
    const onStorage = (e: StorageEvent) => {
      if (e.key === KEY) setState(load());
    };
    window.addEventListener("storage", onStorage);
    // Re-derive auto fields every minute
    const id = window.setInterval(() => setTick((v) => v + 1), 60_000);
    return () => {
      window.removeEventListener("storage", onStorage);
      window.clearInterval(id);
    };
  }, []);

  const update = useCallback((patch: Partial<StoredState>) => {
    setState((prev) => {
      const next = { ...prev, ...patch };
      save(next);
      return next;
    });
  }, []);

  const auto = computeAutoState(state.schedule);
  const currentState: CurrentState = {
    location: state.location,
    energy: state.autoEnergy ? auto.suggestedEnergy : state.energy,
    duration: state.duration,
    workWindow: auto.workWindow,
  };

  // tick just triggers re-render; reference it so linters don't complain
  void tick;

  return {
    hydrated,
    stored: state,
    currentState,
    autoWorkWindow: auto.workWindow,
    autoEnergy: auto.suggestedEnergy,
    setLocation: (v: Location) => update({ location: v }),
    setEnergy: (v: Energy) => update({ energy: v, autoEnergy: false }),
    setAutoEnergy: (v: boolean) => update({ autoEnergy: v }),
    setDuration: (v: Duration) => update({ duration: v }),
    setSchedule: (v: WorkSchedule) => update({ schedule: v }),
    setHideMismatches: (v: boolean) => update({ hideMismatches: v }),
  };
}
