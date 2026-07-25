import type { Task } from "./types";
import type { WorkSchedule, Energy } from "./context";

export interface BusyRange {
  startMin: number; // minutes since 00:00
  endMin: number;
}

export interface AutoScheduleResult {
  assignments: Record<string, { startMin: number; duration: number }>;
  unplaced: string[];
}

/**
 * Greedy packer: for each candidate task (longest first, energy-matched
 * to time-of-day), find the first free window inside work hours.
 *
 * Time-of-day energy: first third=high, middle=medium, last third=low.
 * A task requiring "high" energy is only placed in a slot whose window
 * energy is >= high.
 */
export function autoSchedule(
  tasks: Task[],
  schedule: WorkSchedule,
  existingBusy: BusyRange[] = [],
): AutoScheduleResult {
  const workStart = schedule.start * 60;
  const workEnd = schedule.end * 60;
  const totalMin = workEnd - workStart;

  // Merge & sort busy ranges
  const busy = [...existingBusy]
    .filter((b) => b.endMin > workStart && b.startMin < workEnd)
    .map((b) => ({
      startMin: Math.max(b.startMin, workStart),
      endMin: Math.min(b.endMin, workEnd),
    }))
    .sort((a, b) => a.startMin - b.startMin);

  // Sort tasks: longer first, then priority
  const ordered = [...tasks].sort((a, b) => {
    const da = a.scheduledDuration ?? 30;
    const db = b.scheduledDuration ?? 30;
    if (da !== db) return db - da;
    const pri = (p: Task["priority"]) => (p === "H" ? 3 : p === "M" ? 2 : p === "L" ? 1 : 0);
    return pri(b.priority) - pri(a.priority);
  });

  const assignments: Record<string, { startMin: number; duration: number }> = {};
  const unplaced: string[] = [];

  const windowEnergy = (min: number): Energy => {
    const rel = (min - workStart) / totalMin;
    if (rel < 1 / 3) return "high";
    if (rel < 2 / 3) return "medium";
    return "low";
  };
  const energyRank: Record<Energy, number> = { any: 0, low: 1, medium: 2, high: 3 };

  for (const t of ordered) {
    const dur = Math.max(15, t.scheduledDuration ?? 30);
    const reqEnergy = t.context?.energy;

    let placed = false;
    // Snap to 15-min grid
    for (let cursor = workStart; cursor + dur <= workEnd; cursor += 15) {
      // Check energy fit for this slot
      if (reqEnergy && reqEnergy !== "any") {
        const winE = windowEnergy(cursor);
        if (energyRank[winE] < energyRank[reqEnergy]) continue;
      }
      // Check busy overlap
      const overlap = busy.some(
        (b) => !(cursor + dur <= b.startMin || cursor >= b.endMin),
      );
      if (overlap) continue;
      // Place
      assignments[t.id] = { startMin: cursor, duration: dur };
      busy.push({ startMin: cursor, endMin: cursor + dur });
      busy.sort((a, b) => a.startMin - b.startMin);
      placed = true;
      break;
    }
    if (!placed) unplaced.push(t.id);
  }

  return { assignments, unplaced };
}

export function minutesToISO(day: Date, min: number): string {
  const d = new Date(day);
  d.setHours(Math.floor(min / 60), min % 60, 0, 0);
  return d.toISOString();
}

export function isoToMinutes(iso: string): number {
  const d = new Date(iso);
  return d.getHours() * 60 + d.getMinutes();
}
