import type { TaskContext } from "./context";

export type TaskStatus = "todo" | "doing" | "done";
export type TaskPriority = "H" | "M" | "L" | null;

/**
 * GTD bucket. `next` = a clarified, actionable next action (the default so
 * legacy tasks keep working). `inbox` = captured but not yet clarified.
 */
export type Bucket = "inbox" | "next" | "waiting" | "someday";


export interface Task {
  id: string;
  title: string;
  notes?: string;
  status: TaskStatus;
  tags: string[];
  priority: TaskPriority;
  due?: string; // ISO date (yyyy-mm-dd)
  createdAt: string; // ISO
  completedAt?: string;
  order?: number; // manual sort within its status column
  context?: TaskContext;
  scheduledStart?: string; // ISO datetime — planned block start
  scheduledDuration?: number; // minutes
  myDay?: string; // ISO date the user pinned this task to (separate from due)
  actualDuration?: number; // minutes actually spent, recorded by focus timer
  rescheduleCount?: number; // # times this task has been moved to a new day
  archived?: boolean; // "let it go" — hidden from lists but not deleted
  archivedAt?: string; // ISO

  /* ---- Horizons of focus ---- */
  areaId?: string; // Area of Responsibility (Health, Work, Family…)

  /* ---- GTD ---- */

  clarifiedAt?: string; // ISO — when it left the inbox
  isProject?: boolean; // an outcome needing more than one step
  projectId?: string; // parent project this action belongs to
  waitingOn?: string; // who/what we're waiting for (bucket === "waiting")
  waitingSince?: string; // ISO date the wait started

}
