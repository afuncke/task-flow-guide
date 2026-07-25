import type { Task } from "./types";
import type { WorkSchedule } from "./context";
import { taskMinutes } from "./estimates";
import { effectiveAreaId, type Area } from "./areas";

/**
 * Sunsama-style day budget: you feel the commitment while you are making it,
 * not at six in the evening.
 *
 * Every number here is descriptive, never a verdict. "Over" is a fact about
 * the clock, not a judgement about the person.
 */

export interface DayBudget {
  /** Minutes of work window on this day. */
  capacity: number;
  /** Minutes still ahead of you (today only; equals capacity on other days). */
  remaining: number;
  /** Realistic minutes committed to this day. */
  committed: number;
  /** committed / capacity, clamped for rendering. */
  load: number;
  over: boolean;
  /** Minutes past capacity (0 when it fits). */
  overBy: number;
  /** Minutes of slack left inside the window. */
  free: number;
}

export function workWindowMinutes(schedule: WorkSchedule): number {
  return Math.max(0, (schedule.end - schedule.start) * 60);
}

/** Minutes left inside today's work window, from now. */
export function remainingWindowMinutes(schedule: WorkSchedule, now = new Date()): number {
  const hour = now.getHours() + now.getMinutes() / 60;
  if (hour >= schedule.end) return 0;
  const from = Math.max(hour, schedule.start);
  return Math.max(0, Math.round((schedule.end - from) * 60));
}

export function dayBudget(
  committedTasks: Task[],
  schedule: WorkSchedule,
  opts: { factor?: number; isToday?: boolean; now?: Date; busyMinutes?: number } = {},
): DayBudget {
  const factor = opts.factor ?? 1;
  // Meetings and appointments are time the day no longer holds for tasks.
  const busy = Math.max(0, opts.busyMinutes ?? 0);
  const capacity = Math.max(0, workWindowMinutes(schedule) - busy);
  const remaining = Math.max(
    0,
    (opts.isToday
      ? remainingWindowMinutes(schedule, opts.now ?? new Date())
      : workWindowMinutes(schedule)) - busy,
  );
  const committed = committedTasks.reduce((n, t) => n + taskMinutes(t, factor), 0);
  const reference = Math.max(1, remaining);
  return {
    capacity,
    remaining,
    committed,
    load: committed / reference,
    over: committed > remaining,
    overBy: Math.max(0, committed - remaining),
    free: Math.max(0, remaining - committed),
  };
}


/* ------------------------------------------------------------------ */
/* Area balance                                                        */
/* ------------------------------------------------------------------ */

export interface AreaShare {
  area?: Area; // undefined = unassigned
  minutes: number;
  count: number;
  share: number; // 0-1 of the committed total
}

/**
 * How today's commitment is spread across areas of responsibility.
 * Shown while planning so imbalance is a choice, not a discovery.
 */
export function areaSplit(
  committedTasks: Task[],
  allTasks: Task[],
  areas: Area[],
  factor = 1,
): AreaShare[] {
  const byId = new Map<string, { minutes: number; count: number }>();
  for (const t of committedTasks) {
    const id = effectiveAreaId(t, allTasks) ?? "";
    const cur = byId.get(id) ?? { minutes: 0, count: 0 };
    cur.minutes += taskMinutes(t, factor);
    cur.count += 1;
    byId.set(id, cur);
  }
  const total = [...byId.values()].reduce((n, v) => n + v.minutes, 0) || 1;
  return [...byId.entries()]
    .map(([id, v]) => ({
      area: id ? areas.find((a) => a.id === id) : undefined,
      minutes: v.minutes,
      count: v.count,
      share: v.minutes / total,
    }))
    .sort((a, b) => b.minutes - a.minutes);
}

/** Areas with open work that get no time at all today. Informational only. */
export function untouchedAreas(
  split: AreaShare[],
  areas: Area[],
  allTasks: Task[],
): Area[] {
  const present = new Set(split.map((s) => s.area?.id).filter(Boolean) as string[]);
  return areas.filter((a) => {
    if (present.has(a.id)) return false;
    return allTasks.some(
      (t) =>
        !t.archived &&
        t.status !== "done" &&
        !t.isProject &&
        effectiveAreaId(t, allTasks) === a.id,
    );
  });
}

export function formatMinutes(min: number): string {
  const m = Math.round(min);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  const rest = m % 60;
  return rest === 0 ? `${h}h` : `${h}h ${rest}m`;
}
