import type { Task } from "./types";

/**
 * Horizons of focus, level 2: Areas of Responsibility.
 * An Area is an ongoing standard to maintain (Health, Work, Family), not a
 * thing to finish. Tasks sit *inside* an area; tags stay free-form below it.
 */
export interface Area {
  id: string;
  name: string;
  hue: number; // 0-360, used for the chip colour
}

export const DEFAULT_AREAS: Area[] = [
  { id: "health", name: "Health", hue: 150 },
  { id: "work", name: "Work", hue: 215 },
  { id: "family", name: "Family", hue: 340 },
  { id: "home", name: "Home", hue: 30 },
  { id: "money", name: "Money", hue: 265 },
  { id: "growth", name: "Growth", hue: 190 },
];

/** Days of silence before an area is called "quiet". Gentle, not alarming. */
export const QUIET_AFTER_DAYS = 14;

const AREAS_KEY = "shenas-areas-v1";
const FILTER_KEY = "shenas-area-filter-v1";

export function areaColor(hue: number): string {
  return `hsl(${hue} 60% 45%)`;
}

export function slugify(name: string): string {
  return (
    name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") || `area-${Date.now().toString(36)}`
  );
}

/* ------------------------------------------------------------------ */
/* Resolution                                                          */
/* ------------------------------------------------------------------ */

/**
 * Actions inherit their project's area unless they set their own, so you only
 * have to make the decision once, at the outcome level.
 */
export function effectiveAreaId(task: Task, all: Task[]): string | undefined {
  if (task.areaId) return task.areaId;
  if (task.projectId) {
    const parent = all.find((t) => t.id === task.projectId);
    if (parent?.areaId) return parent.areaId;
  }
  return undefined;
}

export function matchesArea(task: Task, all: Task[], areaId: string | null): boolean {
  if (!areaId) return true;
  if (areaId === "unassigned") return !effectiveAreaId(task, all);
  return effectiveAreaId(task, all) === areaId;
}

/* ------------------------------------------------------------------ */
/* Neglect radar                                                       */
/* ------------------------------------------------------------------ */

export interface AreaActivity {
  areaId: string;
  openCount: number;
  /** Days since the area last got real attention; undefined = never. */
  quietDays?: number;
  lastTouched?: string; // ISO date
}

function touchDates(t: Task): string[] {
  const out: string[] = [];
  if (t.completedAt) out.push(t.completedAt.slice(0, 10));
  if (t.scheduledStart) out.push(t.scheduledStart.slice(0, 10));
  if (t.myDay) out.push(t.myDay.slice(0, 10));
  return out;
}

/**
 * "Attention" means a task in the area was completed, scheduled into a block,
 * or pinned to a day — plans count, not just finishes. Future plans count as
 * attention too: having something on the calendar means the area isn't quiet.
 */
export function areaActivity(areaId: string, tasks: Task[], all: Task[]): AreaActivity {
  const mine = tasks.filter((t) => !t.archived && effectiveAreaId(t, all) === areaId);
  let last: string | undefined;
  for (const t of mine) {
    for (const d of touchDates(t)) {
      if (!last || d > last) last = d;
    }
  }
  const openCount = mine.filter((t) => t.status !== "done" && !t.isProject).length;
  if (!last) return { areaId, openCount };
  const diff = Math.floor((Date.now() - new Date(`${last}T12:00:00`).getTime()) / 86_400_000);
  return { areaId, openCount, quietDays: Math.max(0, diff), lastTouched: last };
}

export function quietAreas(areas: Area[], tasks: Task[]): { area: Area; activity: AreaActivity }[] {
  return areas
    .map((area) => ({ area, activity: areaActivity(area.id, tasks, tasks) }))
    // An area with nothing in it at all isn't "neglected", it's just unused.
    .filter(({ activity }) =>
      activity.quietDays === undefined
        ? activity.openCount > 0
        : activity.quietDays >= QUIET_AFTER_DAYS,
    )
    .sort((a, b) => (b.activity.quietDays ?? 9999) - (a.activity.quietDays ?? 9999));
}

/* ------------------------------------------------------------------ */
/* Store                                                               */
/* ------------------------------------------------------------------ */

interface AreaState {
  areas: Area[];
  filter: string | null; // null = all areas
}

const initial: AreaState = { areas: DEFAULT_AREAS, filter: null };
let state: AreaState = initial;
let loaded = false;
const listeners = new Set<() => void>();

function read(): AreaState {
  if (typeof window === "undefined") return initial;
  let areas = DEFAULT_AREAS;
  let filter: string | null = null;
  try {
    const raw = window.localStorage.getItem(AREAS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) areas = parsed;
    }
    filter = window.localStorage.getItem(FILTER_KEY) || null;
  } catch {
    /* ignore */
  }
  return { areas, filter };
}

function commit(next: AreaState) {
  state = next;
  try {
    window.localStorage.setItem(AREAS_KEY, JSON.stringify(next.areas));
    if (next.filter) window.localStorage.setItem(FILTER_KEY, next.filter);
    else window.localStorage.removeItem(FILTER_KEY);
  } catch {
    /* ignore */
  }
  for (const l of listeners) l();
}

export const areaStore = {
  subscribe(l: () => void) {
    if (!loaded) {
      loaded = true;
      state = read();
    }
    listeners.add(l);
    return () => listeners.delete(l);
  },
  getSnapshot(): AreaState {
    return state;
  },
  getServerSnapshot(): AreaState {
    return initial;
  },
  setFilter(id: string | null) {
    commit({ ...state, filter: id });
  },
  cycleFilter(): string | null {
    const ids = [null, ...state.areas.map((a) => a.id)];
    const i = ids.indexOf(state.filter);
    const next = ids[(i + 1) % ids.length] ?? null;
    commit({ ...state, filter: next });
    return next;
  },
  add(name: string): Area | undefined {
    const trimmed = name.trim();
    if (!trimmed) return undefined;
    const id = slugify(trimmed);
    if (state.areas.some((a) => a.id === id)) return undefined;
    const area: Area = { id, name: trimmed, hue: (state.areas.length * 47 + 20) % 360 };
    commit({ ...state, areas: [...state.areas, area] });
    return area;
  },
  rename(id: string, name: string) {
    commit({
      ...state,
      areas: state.areas.map((a) => (a.id === id ? { ...a, name: name.trim() || a.name } : a)),
    });
  },
  remove(id: string) {
    commit({
      areas: state.areas.filter((a) => a.id !== id),
      filter: state.filter === id ? null : state.filter,
    });
  },
};
