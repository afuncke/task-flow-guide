import { useEffect, useState } from "react";

/**
 * Progressive disclosure by time of day.
 *
 * The app shows less as the day winds down: mornings are for deciding,
 * middays for doing, evenings for closing, nights for nothing at all.
 * Phases never lock anything — they only change what is offered first.
 */
export type Phase = "morning" | "midday" | "evening" | "night";

export interface PhaseMeta {
  label: string;
  /** One short, non-prescriptive line. Never an instruction. */
  hint: string;
  /** Routes worth surfacing now; others are de-emphasised, not hidden. */
  surfaces: string[];
  /** How much detail to render: 3 = everything, 1 = the bare minimum. */
  detail: 1 | 2 | 3;
}

export const PHASE_META: Record<Phase, PhaseMeta> = {
  morning: {
    label: "Morning",
    hint: "Good time to decide what today is for.",
    surfaces: ["/plan", "/inbox", "/projects"],
    detail: 3,
  },
  midday: {
    label: "Midday",
    hint: "Heads-down hours. One thing at a time.",
    surfaces: ["/focus", "/plan", "/board"],
    detail: 2,
  },
  evening: {
    label: "Evening",
    hint: "Winding down. Close loops, don't open new ones.",
    surfaces: ["/plan", "/board", "/inbox"],
    detail: 2,
  },
  night: {
    label: "Night",
    hint: "It's late. Tomorrow can hold this.",
    surfaces: ["/focus", "/inbox"],
    detail: 1,
  },
};

export function phaseAt(d: Date = new Date()): Phase {
  const h = d.getHours();
  if (h >= 5 && h < 11) return "morning";
  if (h >= 11 && h < 17) return "midday";
  if (h >= 17 && h < 22) return "evening";
  return "night";
}

/**
 * Live clock + phase. Returns `now: null` until mounted so server and client
 * render the same markup.
 */
export function useTimeOfDay(): { now: Date | null; phase: Phase; meta: PhaseMeta } {
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    setNow(new Date());
    const id = window.setInterval(() => setNow(new Date()), 30_000);
    return () => window.clearInterval(id);
  }, []);

  const phase = phaseAt(now ?? new Date(0));
  return { now, phase: now ? phase : "midday", meta: PHASE_META[now ? phase : "midday"] };
}

/* ------------------------------------------------------------------ */
/* Time-blindness helpers                                              */
/* ------------------------------------------------------------------ */

/** "1h 25m", "40m", "now". Always short enough to read at a glance. */
export function humanDuration(minutes: number): string {
  const m = Math.round(minutes);
  if (m <= 0) return "now";
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  const rest = m % 60;
  return rest === 0 ? `${h}h` : `${h}h ${rest}m`;
}

export function clockTime(d: Date): string {
  return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

/** Minutes left inside the given work window today (0 when outside it). */
export function minutesLeftInWindow(now: Date, endHour: number): number {
  const end = new Date(now);
  end.setHours(endHour, 0, 0, 0);
  return Math.max(0, (end.getTime() - now.getTime()) / 60_000);
}

/** Fraction 0-1 of the way through the window, for a progress bar. */
export function windowProgress(now: Date, startHour: number, endHour: number): number {
  const hour = now.getHours() + now.getMinutes() / 60;
  if (hour <= startHour) return 0;
  if (hour >= endHour) return 1;
  return (hour - startHour) / (endHour - startHour);
}
