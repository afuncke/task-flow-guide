import type { Task, TaskPriority } from "./types";
import type { Area } from "./areas";
import type { CurrentState, Duration, Energy, Location, TaskContext, WorkWindow } from "./context";

/**
 * A stand-in for an LLM "clarify assistant".
 *
 * It reads the raw capture text plus the surrounding context (your areas, the
 * tags you already use, the time of day, your current state) and proposes a
 * complete set of task settings. Everything it returns is a *suggestion* —
 * the user accepts, tweaks, or ignores it. Swapping this file for a real model
 * call later means keeping `suggestTaskSettings`'s signature and shape.
 */

export type SuggestedKind = "next" | "project" | "waiting" | "someday" | "do-now";

export interface Suggestion {
  kind: SuggestedKind;
  title: string;
  tags: string[];
  priority: TaskPriority;
  due?: string;
  scheduledDuration?: number;
  context: TaskContext;
  areaId?: string;
  projectId?: string;
  waitingOn?: string;
  firstAction?: string;
  confidence: number; // 0-1
  headline: string; // one-sentence reasoning, non-judgemental
  reasons: string[];
}

const has = (text: string, words: string[]) =>
  words.some((w) => new RegExp(`\\b${w}\\b`, "i").test(text));

function iso(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate(),
  ).padStart(2, "0")}`;
}

function addDays(base: Date, n: number): Date {
  const d = new Date(base);
  d.setDate(d.getDate() + n);
  return d;
}

const WEEKDAYS = [
  "sunday",
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
];

/* ------------------------------------------------------------------ */
/* Date reading                                                        */
/* ------------------------------------------------------------------ */

function readDue(text: string, now: Date): { due?: string; reason?: string } {
  const explicit = text.match(/\b(\d{4}-\d{2}-\d{2})\b/);
  if (explicit) return { due: explicit[1], reason: `"${explicit[1]}" looks like the date` };

  if (/\btoday\b|\btonight\b/i.test(text)) return { due: iso(now), reason: `you wrote "today"` };
  if (/\btomorrow\b/i.test(text))
    return { due: iso(addDays(now, 1)), reason: `you wrote "tomorrow"` };
  if (/\bnext week\b/i.test(text))
    return { due: iso(addDays(now, 7)), reason: `"next week" — parked seven days out` };
  if (/\bthis week\b/i.test(text)) {
    const daysToFri = (5 - now.getDay() + 7) % 7 || 5;
    return { due: iso(addDays(now, daysToFri)), reason: `"this week" — landed on Friday` };
  }
  const inDays = text.match(/\bin (\d{1,2}) (day|days|weeks?)\b/i);
  if (inDays) {
    const n = Number(inDays[1]) * (/week/i.test(inDays[2]) ? 7 : 1);
    return { due: iso(addDays(now, n)), reason: `"${inDays[0]}"` };
  }
  for (let i = 0; i < WEEKDAYS.length; i++) {
    if (new RegExp(`\\b${WEEKDAYS[i]}\\b`, "i").test(text)) {
      const delta = (i - now.getDay() + 7) % 7 || 7;
      return { due: iso(addDays(now, delta)), reason: `"${WEEKDAYS[i]}"` };
    }
  }
  return {};
}

/* ------------------------------------------------------------------ */
/* Keyword tables                                                      */
/* ------------------------------------------------------------------ */

const PROJECT_WORDS = [
  "plan",
  "planning",
  "launch",
  "organise",
  "organize",
  "redesign",
  "renovate",
  "migrate",
  "trip",
  "holiday",
  "vacation",
  "move",
  "onboarding",
  "setup",
  "strategy",
  "campaign",
];
const SOMEDAY_WORDS = [
  "someday",
  "maybe",
  "one day",
  "eventually",
  "explore",
  "consider",
  "idea",
  "wishlist",
];
const WAITING_WORDS = ["waiting", "awaiting", "chase", "follow up", "reply from", "hear back"];
const URGENT_WORDS = ["urgent", "asap", "critical", "deadline", "overdue", "immediately"];
const LOW_WORDS = ["sometime", "whenever", "low priority", "nice to have", "tidy up"];

const DURATION_HINTS: { words: string[]; minutes: number }[] = [
  { words: ["reply", "email", "text", "message", "rsvp", "confirm"], minutes: 10 },
  { words: ["call", "phone", "ring", "book", "order", "pay", "renew"], minutes: 15 },
  { words: ["review", "read", "check", "clean", "tidy", "sort", "pack"], minutes: 30 },
  { words: ["draft", "write", "prepare", "outline", "fix", "update"], minutes: 45 },
  { words: ["research", "design", "build", "refactor", "analyse", "analyze"], minutes: 90 },
];

const AREA_HINTS: Record<string, string[]> = {
  health: ["gym", "run", "doctor", "dentist", "workout", "sleep", "therapy", "walk", "health"],
  work: ["client", "meeting", "standup", "invoice", "deck", "report", "boss", "deploy", "work"],
  family: ["mum", "mom", "dad", "kids", "school", "birthday", "partner", "family", "visit"],
  home: ["laundry", "dishes", "clean", "repair", "plumber", "garden", "grocery", "home"],
  money: ["bank", "tax", "budget", "invoice", "insurance", "pay", "bill", "savings"],
  growth: ["learn", "course", "book", "practice", "study", "read", "write", "language"],
};

const TAG_HINTS: Record<string, string[]> = {
  errand: ["buy", "pick up", "shop", "grocery", "post office", "collect"],
  call: ["call", "phone", "ring"],
  email: ["email", "reply", "inbox", "message"],
  admin: ["form", "renew", "invoice", "bill", "tax", "insurance", "book"],
  writing: ["draft", "write", "outline", "blog", "notes"],
  deep: ["design", "research", "architecture", "strategy", "refactor"],
};

/* ------------------------------------------------------------------ */
/* The "model"                                                          */
/* ------------------------------------------------------------------ */

export interface SuggestInput {
  task: Task;
  areas: Area[];
  allTasks: Task[];
  state: CurrentState;
  now?: Date;
}

export function suggestTaskSettings({
  task,
  areas,
  allTasks,
  state,
  now = new Date(),
}: SuggestInput): Suggestion {
  const text = `${task.title} ${task.notes ?? ""}`;
  const reasons: string[] = [];
  let signals = 0;

  /* --- kind ------------------------------------------------------- */
  let kind: SuggestedKind = "next";
  let waitingOn: string | undefined;
  let firstAction: string | undefined;

  if (has(text, SOMEDAY_WORDS)) {
    kind = "someday";
    signals++;
    reasons.push("Sounds like an idea rather than a commitment — parked as someday/maybe.");
  } else if (has(text, WAITING_WORDS)) {
    kind = "waiting";
    signals++;
    const who = text.match(/\b(?:from|for|on|with)\s+([A-Z][a-z]+)/);
    waitingOn = who?.[1];
    reasons.push(
      waitingOn
        ? `Reads as a hand-off — tracking it as waiting on ${waitingOn}.`
        : "Reads as a hand-off — tracking it as waiting for someone.",
    );
  } else if (has(text, PROJECT_WORDS) || /\band\b.*\band\b/i.test(text)) {
    kind = "project";
    signals++;
    firstAction = `List the first small step for "${task.title}"`;
    reasons.push("More than one step hides in here — treating it as a project with a first action.");
  } else if (/^\s*(reply|send|text|email)\b/i.test(text) && text.split(/\s+/).length <= 6) {
    kind = "do-now";
    signals++;
    reasons.push("Small enough that finishing it now beats filing it.");
  } else {
    reasons.push("Single, concrete step — filed as a next action.");
  }

  /* --- duration --------------------------------------------------- */
  let minutes = 30;
  for (const hint of DURATION_HINTS) {
    if (has(text, hint.words)) {
      minutes = hint.minutes;
      signals++;
      break;
    }
  }
  if (kind === "project") minutes = 60;
  reasons.push(`Estimated ${minutes} minutes from the kind of verb you used.`);

  const ctxDuration: Duration = minutes <= 15 ? "quick" : minutes <= 60 ? "medium" : "deep";

  /* --- energy ----------------------------------------------------- */
  let energy: Energy = "medium";
  if (has(text, ["research", "design", "write", "draft", "plan", "decide", "strategy"])) {
    energy = "high";
  } else if (has(text, ["file", "sort", "tidy", "renew", "pay", "book", "reply"])) {
    energy = "low";
  }

  /* --- location --------------------------------------------------- */
  let location: Location = "anywhere";
  if (has(text, ["buy", "shop", "grocery", "pick", "collect", "post"])) location = "errands";
  else if (has(text, ["laundry", "dishes", "clean", "garden", "cook", "repair"])) location = "home";
  else if (has(text, ["meeting", "standup", "colleague", "office", "desk"])) location = "office";
  if (location !== "anywhere") signals++;

  /* --- work window ------------------------------------------------ */
  let workWindow: WorkWindow = "any";
  if (has(text, AREA_HINTS.work)) workWindow = "work";
  else if (has(text, [...AREA_HINTS.family, ...AREA_HINTS.health, ...AREA_HINTS.home]))
    workWindow = "personal";

  /* --- area ------------------------------------------------------- */
  let areaId: string | undefined;
  let bestScore = 0;
  for (const area of areas) {
    const hints = AREA_HINTS[area.id] ?? [area.name.toLowerCase()];
    const score = hints.filter((w) => new RegExp(`\\b${w}`, "i").test(text)).length;
    if (score > bestScore) {
      bestScore = score;
      areaId = area.id;
    }
  }
  if (areaId) {
    signals++;
    const name = areas.find((a) => a.id === areaId)?.name ?? areaId;
    reasons.push(`Belongs with your ${name} area.`);
  } else if (state.workWindow === "work") {
    areaId = areas.find((a) => a.id === "work")?.id;
    if (areaId) reasons.push("No strong signal — defaulted to Work because you're in work hours.");
  }

  /* --- tags ------------------------------------------------------- */
  const knownTags = Array.from(new Set(allTasks.flatMap((t) => t.tags)));
  const tags = new Set<string>();
  for (const t of knownTags) {
    if (new RegExp(`\\b${t}`, "i").test(text)) tags.add(t);
  }
  for (const [tag, words] of Object.entries(TAG_HINTS)) {
    if (tags.size >= 3) break;
    if (has(text, words)) tags.add(tag);
  }
  if (tags.size) signals++;

  /* --- due & priority --------------------------------------------- */
  const { due, reason: dueReason } = kind === "someday" ? {} : readDue(text, now);
  if (dueReason) {
    signals++;
    reasons.push(`Due date read from ${dueReason}.`);
  }

  let priority: TaskPriority = null;
  if (has(text, URGENT_WORDS)) {
    priority = "H";
    signals++;
    reasons.push("You flagged urgency in the wording.");
  } else if (has(text, LOW_WORDS) || kind === "someday") {
    priority = "L";
  } else if (due) {
    priority = "M";
  }

  /* --- parent project --------------------------------------------- */
  let projectId: string | undefined;
  for (const p of allTasks.filter((t) => t.isProject && t.status !== "done")) {
    const key = p.title.toLowerCase().split(/\s+/).filter((w) => w.length > 4)[0];
    if (key && new RegExp(`\\b${key}`, "i").test(text)) {
      projectId = p.id;
      reasons.push(`Looks like part of "${p.title}".`);
      signals++;
      break;
    }
  }

  const context: TaskContext = { location, energy, duration: ctxDuration, workWindow };

  const confidence = Math.min(0.95, 0.35 + signals * 0.12);

  return {
    kind,
    title: cleanTitle(task.title),
    tags: Array.from(tags).slice(0, 3),
    priority,
    due,
    scheduledDuration: minutes,
    context,
    areaId,
    projectId: kind === "project" ? undefined : projectId,
    waitingOn,
    firstAction,
    confidence,
    headline: headlineFor(kind),
    reasons,
  };
}

function cleanTitle(title: string): string {
  const t = title.trim().replace(/\s+/g, " ");
  return t.charAt(0).toUpperCase() + t.slice(1);
}

function headlineFor(kind: SuggestedKind): string {
  switch (kind) {
    case "do-now":
      return "This one looks two-minutes-small.";
    case "project":
      return "This looks like an outcome, not a step.";
    case "waiting":
      return "This looks like it's in someone else's court.";
    case "someday":
      return "This looks like a maybe, not a must.";
    default:
      return "Here's a starting point — change anything.";
  }
}

export function confidenceLabel(c: number): string {
  if (c >= 0.75) return "fairly sure";
  if (c >= 0.55) return "a guess worth checking";
  return "a rough guess";
}
