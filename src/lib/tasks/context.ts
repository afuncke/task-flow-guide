import type { Task } from "./types";

export const LOCATIONS = ["anywhere", "home", "office", "errands"] as const;
export const ENERGIES = ["any", "low", "medium", "high"] as const;
export const DURATIONS = ["any", "quick", "medium", "deep"] as const;
export const WORK_WINDOWS = ["any", "work", "personal"] as const;

export type Location = (typeof LOCATIONS)[number];
export type Energy = (typeof ENERGIES)[number];
export type Duration = (typeof DURATIONS)[number];
export type WorkWindow = (typeof WORK_WINDOWS)[number];

export interface TaskContext {
  location?: Location;
  energy?: Energy;
  duration?: Duration;
  workWindow?: WorkWindow;
}

export interface WorkSchedule {
  start: number; // hour 0-23
  end: number;
  days: number[]; // 0=Sun..6=Sat
}

export interface CurrentState {
  location: Location;
  energy: Energy;
  duration: Duration;
  workWindow: WorkWindow;
}

export const DEFAULT_SCHEDULE: WorkSchedule = {
  start: 9,
  end: 17,
  days: [1, 2, 3, 4, 5],
};

export const LOCATION_LABEL: Record<Location, string> = {
  anywhere: "Anywhere",
  home: "Home",
  office: "Office",
  errands: "Out & about",
};
export const ENERGY_LABEL: Record<Energy, string> = {
  any: "Any energy",
  low: "Low energy",
  medium: "Medium",
  high: "High energy",
};
export const DURATION_LABEL: Record<Duration, string> = {
  any: "Any length",
  quick: "Quick (<15m)",
  medium: "Medium (<1h)",
  deep: "Deep work",
};
export const WORK_WINDOW_LABEL: Record<WorkWindow, string> = {
  any: "Any time",
  work: "Work hours",
  personal: "Off hours",
};

export function computeAutoState(
  schedule: WorkSchedule,
  now: Date = new Date(),
): { workWindow: WorkWindow; suggestedEnergy: Energy } {
  const day = now.getDay();
  const hour = now.getHours() + now.getMinutes() / 60;
  const isWork =
    schedule.days.includes(day) && hour >= schedule.start && hour < schedule.end;
  const workWindow: WorkWindow = isWork ? "work" : "personal";
  let suggestedEnergy: Energy = "medium";
  if (hour >= 6 && hour < 11) suggestedEnergy = "high";
  else if (hour >= 21 || hour < 6) suggestedEnergy = "low";
  return { workWindow, suggestedEnergy };
}

const ENERGY_RANK: Record<Energy, number> = { any: 0, low: 1, medium: 2, high: 3 };
const DURATION_RANK: Record<Duration, number> = {
  any: 0,
  quick: 1,
  medium: 2,
  deep: 3,
};

/**
 * Returns true when the task can reasonably be done under the current state.
 * A missing task field ("anywhere"/"any" or undefined) never blocks the fit.
 */
export function contextFit(task: Task, state: CurrentState): boolean {
  const c = task.context;
  if (!c) return true;

  if (
    c.location &&
    c.location !== "anywhere" &&
    state.location !== "anywhere" &&
    c.location !== state.location
  ) {
    return false;
  }
  if (
    c.workWindow &&
    c.workWindow !== "any" &&
    state.workWindow !== "any" &&
    c.workWindow !== state.workWindow
  ) {
    return false;
  }
  // Task needs at least X energy; you have less → mismatch
  if (
    c.energy &&
    c.energy !== "any" &&
    state.energy !== "any" &&
    ENERGY_RANK[state.energy] < ENERGY_RANK[c.energy]
  ) {
    return false;
  }
  // Task needs a Y-size window; you only have shorter → mismatch
  if (
    c.duration &&
    c.duration !== "any" &&
    state.duration !== "any" &&
    DURATION_RANK[c.duration] > DURATION_RANK[state.duration]
  ) {
    return false;
  }
  return true;
}

export function hasAnyContext(c?: TaskContext): boolean {
  if (!c) return false;
  return Boolean(
    (c.location && c.location !== "anywhere") ||
      (c.energy && c.energy !== "any") ||
      (c.duration && c.duration !== "any") ||
      (c.workWindow && c.workWindow !== "any"),
  );
}
