import { useCallback, useEffect, useState } from "react";
import type { BusyRange } from "./auto-schedule";

/**
 * Calendar events: meetings, appointments, school runs — time that is already
 * spoken for. They are not tasks: no urgency, no priority, nothing to finish.
 * They exist so the plan tells the truth about how much day is actually left.
 */
export interface CalEvent {
  id: string;
  title: string;
  date: string; // yyyy-mm-dd
  startMin: number; // minutes since midnight
  duration: number; // minutes
  /** Present but not really occupied (optional meeting, travel buffer). */
  soft?: boolean;
}

const KEY = "shenas.events.v1";

const listeners = new Set<() => void>();
function notify() {
  for (const l of listeners) l();
}

function load(): CalEvent[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as CalEvent[]) : [];
  } catch {
    return [];
  }
}

function save(list: CalEvent[]) {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(list));
  } catch {
    /* ignore */
  }
}

export function eventsOn(events: CalEvent[], dateKey: string): CalEvent[] {
  return events
    .filter((e) => e.date === dateKey)
    .sort((a, b) => a.startMin - b.startMin);
}

/** Busy ranges the scheduler must pack around. Soft events don't block. */
export function eventBusyRanges(events: CalEvent[], dateKey: string): BusyRange[] {
  return eventsOn(events, dateKey)
    .filter((e) => !e.soft)
    .map((e) => ({ startMin: e.startMin, endMin: e.startMin + e.duration }));
}

/**
 * Minutes of the work window this day's events consume. Only the part that
 * overlaps the window counts — a 7am dentist doesn't shrink a 9–5 day.
 */
export function eventMinutesInWindow(
  events: CalEvent[],
  dateKey: string,
  schedule: { start: number; end: number },
  fromMin?: number,
): number {
  const winStart = Math.max(schedule.start * 60, fromMin ?? schedule.start * 60);
  const winEnd = schedule.end * 60;
  let total = 0;
  for (const e of eventBusyRanges(events, dateKey)) {
    const s = Math.max(e.startMin, winStart);
    const en = Math.min(e.endMin, winEnd);
    if (en > s) total += en - s;
  }
  return total;
}

export function useEvents() {
  const [events, setEvents] = useState<CalEvent[]>([]);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setEvents(load());
    setHydrated(true);
    const refresh = () => setEvents(load());
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

  const commit = useCallback((next: CalEvent[]) => {
    save(next);
    setEvents(next);
    notify();
  }, []);

  const addEvent = useCallback(
    (e: Omit<CalEvent, "id">) => {
      const ev: CalEvent = { ...e, id: crypto.randomUUID() };
      commit([...load(), ev]);
      return ev;
    },
    [commit],
  );

  const updateEvent = useCallback(
    (id: string, patch: Partial<CalEvent>) => {
      commit(load().map((e) => (e.id === id ? { ...e, ...patch } : e)));
    },
    [commit],
  );

  const removeEvent = useCallback(
    (id: string) => {
      commit(load().filter((e) => e.id !== id));
    },
    [commit],
  );

  return { events, hydrated, addEvent, updateEvent, removeEvent };
}
