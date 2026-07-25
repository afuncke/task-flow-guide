import type { Task } from "./types";
import type { WorkSchedule, Energy } from "./context";
import { taskMinutes } from "./estimates";

export interface BusyRange {
  startMin: number; // minutes since 00:00
  endMin: number;
}

export interface ScheduledBlock {
  startMin: number;
  duration: number;
}

export interface AutoScheduleOptions {
  /** Estimate multiplier learned from actuals (see estimates.ts). */
  factor?: number;
  /** Longest single block before a task is chunked. */
  maxChunk?: number;
  /** Smallest useful chunk. */
  minChunk?: number;
  /** Don't place anything before this minute (e.g. "now" for today). */
  earliestMin?: number;
  /** Breathing room between chunks of the same task. */
  chunkGap?: number;
}

export interface AutoScheduleResult {
  /** First block per task — kept for callers that only need one slot. */
  assignments: Record<string, ScheduledBlock>;
  /** Every block per task, in order. Longer work gets several. */
  blocks: Record<string, ScheduledBlock[]>;
  unplaced: string[];
  /** Tasks that got some, but not all, of their chunks placed. */
  partial: string[];
}

const DEFAULT_MAX_CHUNK = 90;
const DEFAULT_MIN_CHUNK = 30;
const DEFAULT_CHUNK_GAP = 15;

/**
 * Split a total duration into work-sized chunks. A 4h task becomes
 * 3 × 80m rather than one intimidating wall of time.
 */
export function chunkDuration(
  total: number,
  maxChunk = DEFAULT_MAX_CHUNK,
  minChunk = DEFAULT_MIN_CHUNK,
): number[] {
  if (total <= maxChunk) return [Math.max(15, round15(total))];
  const parts = Math.ceil(total / maxChunk);
  const even = Math.max(minChunk, round15(total / parts));
  const chunks: number[] = [];
  let left = total;
  for (let i = 0; i < parts && left > 0; i++) {
    const take = i === parts - 1 ? round15(left) : Math.min(even, round15(left));
    if (take <= 0) break;
    chunks.push(Math.max(15, take));
    left -= take;
  }
  return chunks;
}

/**
 * Greedy packer: for each candidate task (longest first, energy-matched
 * to time-of-day), find the first free window inside work hours.
 *
 * Time-of-day energy: first third=high, middle=medium, last third=low.
 * A task requiring "high" energy is only placed in a slot whose window
 * energy is >= high. Long tasks are chunked across several blocks.
 */
export function autoSchedule(
  tasks: Task[],
  schedule: WorkSchedule,
  existingBusy: BusyRange[] = [],
  options: AutoScheduleOptions = {},
): AutoScheduleResult {
  const {
    factor = 1,
    maxChunk = DEFAULT_MAX_CHUNK,
    minChunk = DEFAULT_MIN_CHUNK,
    chunkGap = DEFAULT_CHUNK_GAP,
    earliestMin,
  } = options;

  const workStart = Math.max(
    schedule.start * 60,
    earliestMin != null ? roundUp15(earliestMin) : schedule.start * 60,
  );
  const workEnd = schedule.end * 60;
  const totalMin = Math.max(1, workEnd - schedule.start * 60);

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
    const da = taskMinutes(a, factor);
    const db = taskMinutes(b, factor);
    if (da !== db) return db - da;
    const pri = (p: Task["priority"]) => (p === "H" ? 3 : p === "M" ? 2 : p === "L" ? 1 : 0);
    return pri(b.priority) - pri(a.priority);
  });

  const assignments: Record<string, ScheduledBlock> = {};
  const blocks: Record<string, ScheduledBlock[]> = {};
  const unplaced: string[] = [];
  const partial: string[] = [];

  const windowEnergy = (min: number): Energy => {
    const rel = (min - schedule.start * 60) / totalMin;
    if (rel < 1 / 3) return "high";
    if (rel < 2 / 3) return "medium";
    return "low";
  };
  const energyRank: Record<Energy, number> = { any: 0, low: 1, medium: 2, high: 3 };

  for (const t of ordered) {
    const reqEnergy = t.context?.energy;
    const chunks = chunkDuration(taskMinutes(t, factor), maxChunk, minChunk);
    const placedBlocks: ScheduledBlock[] = [];
    let after = workStart;

    for (const dur of chunks) {
      let placed = false;
      for (let cursor = after; cursor + dur <= workEnd; cursor += 15) {
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
        placedBlocks.push({ startMin: cursor, duration: dur });
        busy.push({ startMin: cursor, endMin: cursor + dur });
        busy.sort((a, b) => a.startMin - b.startMin);
        after = cursor + dur + chunkGap;
        placed = true;
        break;
      }
      if (!placed) break;
    }

    if (placedBlocks.length === 0) {
      unplaced.push(t.id);
      continue;
    }
    assignments[t.id] = placedBlocks[0];
    blocks[t.id] = placedBlocks;
    if (placedBlocks.length < chunks.length) partial.push(t.id);
  }

  return { assignments, blocks, unplaced, partial };
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

function round15(n: number): number {
  return Math.round(n / 15) * 15;
}

function roundUp15(n: number): number {
  return Math.ceil(n / 15) * 15;
}
