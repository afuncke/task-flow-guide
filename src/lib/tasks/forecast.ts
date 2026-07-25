import type { Task } from "./types";
import type { WorkSchedule } from "./context";
import { taskMinutes } from "./estimates";

/**
 * Deadline vs. scheduled time.
 *
 * A due date says "must be done by"; a block says "I'll work on it then".
 * This module notices, days ahead, when those two can't both be true —
 * so the news arrives while there's still room to choose, not afterwards.
 */

export interface DeadlineRisk {
  dueKey: string;
  /** Undone tasks due on or before this day. */
  taskIds: string[];
  titles: string[];
  requiredMin: number;
  availableMin: number;
  /** How many minutes short we are. */
  shortfallMin: number;
  daysAway: number;
}

export interface ForecastOptions {
  horizonDays?: number;
  factor?: number;
  now?: Date;
}

export function dateKeyOf(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Work minutes still available on a given day (today is counted from now). */
export function capacityForDay(
  day: Date,
  schedule: WorkSchedule,
  now: Date,
): number {
  if (!schedule.days.includes(day.getDay())) return 0;
  const startMin = schedule.start * 60;
  const endMin = schedule.end * 60;
  const isToday = dateKeyOf(day) === dateKeyOf(now);
  const from = isToday
    ? Math.max(startMin, now.getHours() * 60 + now.getMinutes())
    : startMin;
  return Math.max(0, endMin - from);
}

/**
 * Cumulative check: for every upcoming due date, is there enough working
 * time between now and then for everything due by that point?
 */
export function forecastDeadlines(
  tasks: Task[],
  schedule: WorkSchedule,
  options: ForecastOptions = {},
): DeadlineRisk[] {
  const { horizonDays = 14, factor = 1, now = new Date() } = options;
  const todayKey = dateKeyOf(now);

  const relevant = tasks
    .filter((t) => !t.archived && t.status !== "done" && t.due && t.due >= todayKey)
    .sort((a, b) => (a.due ?? "").localeCompare(b.due ?? ""));
  if (relevant.length === 0) return [];

  const dueKeys = Array.from(new Set(relevant.map((t) => t.due!)));
  const risks: DeadlineRisk[] = [];

  for (const dueKey of dueKeys) {
    const daysAway = dayDiff(todayKey, dueKey);
    if (daysAway < 0 || daysAway > horizonDays) continue;

    let availableMin = 0;
    for (let i = 0; i <= daysAway; i++) {
      const d = new Date(now);
      d.setDate(d.getDate() + i);
      d.setHours(0, 0, 0, 0);
      availableMin += capacityForDay(d, schedule, now);
    }

    const due = relevant.filter((t) => t.due! <= dueKey);
    const requiredMin = due.reduce((n, t) => n + taskMinutes(t, factor), 0);

    if (requiredMin > availableMin) {
      risks.push({
        dueKey,
        taskIds: due.map((t) => t.id),
        titles: due.map((t) => t.title),
        requiredMin,
        availableMin,
        shortfallMin: requiredMin - availableMin,
        daysAway,
      });
    }
  }

  // Only surface the earliest pinch point — one calm signal, not a pile.
  return risks.slice(0, 1);
}

export function dayDiff(fromKey: string, toKey: string): number {
  const a = new Date(`${fromKey}T00:00:00`);
  const b = new Date(`${toKey}T00:00:00`);
  return Math.round((b.getTime() - a.getTime()) / 86_400_000);
}

export function relativeDay(dueKey: string, todayKey: string): string {
  const d = dayDiff(todayKey, dueKey);
  if (d === 0) return "today";
  if (d === 1) return "tomorrow";
  if (d < 7) {
    return new Date(`${dueKey}T00:00:00`).toLocaleDateString(undefined, {
      weekday: "long",
    });
  }
  return new Date(`${dueKey}T00:00:00`).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

export function formatMinutes(min: number): string {
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}
