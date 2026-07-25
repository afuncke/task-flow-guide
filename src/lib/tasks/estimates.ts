import type { Task } from "./types";

/**
 * "Learn from actuals" — Shenas watches how long things really take and
 * quietly pads future estimates so the day stays honest.
 *
 * Deliberately gentle: it never scolds, it just makes the plan realistic.
 */

const MIN_SAMPLES = 3;
const MAX_SAMPLES = 30;
const CLAMP_LOW = 0.8;
const CLAMP_HIGH = 2.5;

export interface EstimateInsight {
  /** Multiplier applied to planned durations. 1 = estimates are on point. */
  factor: number;
  /** How many completed tasks the factor is based on. */
  samples: number;
  /** True once there's enough history to trust the factor. */
  confident: boolean;
}

export const NEUTRAL_ESTIMATE: EstimateInsight = {
  factor: 1,
  samples: 0,
  confident: false,
};

/** Median ratio of actual vs planned minutes across recent finished work. */
export function estimateInsight(tasks: Task[]): EstimateInsight {
  const ratios = tasks
    .filter(
      (t) =>
        typeof t.actualDuration === "number" &&
        t.actualDuration > 0 &&
        typeof t.scheduledDuration === "number" &&
        t.scheduledDuration > 0,
    )
    .sort((a, b) => (b.completedAt ?? "").localeCompare(a.completedAt ?? ""))
    .slice(0, MAX_SAMPLES)
    .map((t) => t.actualDuration! / t.scheduledDuration!)
    .sort((a, b) => a - b);

  if (ratios.length < MIN_SAMPLES) {
    return { ...NEUTRAL_ESTIMATE, samples: ratios.length };
  }

  const mid = Math.floor(ratios.length / 2);
  const median =
    ratios.length % 2 === 0 ? (ratios[mid - 1] + ratios[mid]) / 2 : ratios[mid];

  return {
    factor: Math.min(CLAMP_HIGH, Math.max(CLAMP_LOW, round2(median))),
    samples: ratios.length,
    confident: true,
  };
}

/** Planned minutes, padded by what history suggests and snapped to 15m. */
export function realisticMinutes(minutes: number, factor = 1): number {
  const padded = Math.max(15, minutes * factor);
  return Math.max(15, Math.round(padded / 15) * 15);
}

/** The minutes a task should really be given. */
export function taskMinutes(task: Task, factor = 1): number {
  return realisticMinutes(task.scheduledDuration ?? 30, factor);
}

/** Human phrasing for the insight, always neutral in tone. */
export function estimateNote(insight: EstimateInsight): string | null {
  if (!insight.confident) return null;
  if (insight.factor >= 1.15) {
    return `Your work usually takes about ${Math.round(
      insight.factor * 100,
    )}% of what you plan — blocks are padded to match.`;
  }
  if (insight.factor <= 0.9) {
    return "You tend to finish ahead of your estimates — blocks are trimmed a little.";
  }
  return "Your estimates match reality well.";
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
