import type { Bucket, Task } from "./types";
import { rankTasks } from "./urgency";

export const BUCKET_LABEL: Record<Bucket, string> = {
  inbox: "Inbox",
  next: "Next actions",
  waiting: "Waiting for",
  someday: "Someday / maybe",
};

/** Legacy tasks (no bucket) are treated as clarified next actions. */
export function bucketOf(task: Task): Bucket {
  return task.bucket ?? "next";
}

/** Lives in Focus / Plan / Board — clarified, single-step, not a project header. */
export function isActionable(task: Task): boolean {
  return !task.archived && !task.isProject && bucketOf(task) === "next";
}

export function isInbox(task: Task): boolean {
  return !task.archived && bucketOf(task) === "inbox";
}

export function projectChildren(projectId: string, tasks: Task[]): Task[] {
  return tasks.filter((t) => !t.archived && t.projectId === projectId && !t.isProject);
}

/**
 * GTD's core rule: only one next action per project is in play. We pick the
 * highest-ranked open, clarified child.
 */
export function nextActionOf(projectId: string, tasks: Task[]): Task | undefined {
  const open = projectChildren(projectId, tasks).filter(
    (t) => t.status !== "done" && bucketOf(t) === "next",
  );
  return rankTasks(open)[0];
}

/** A project with no available next action — the thing weekly review hunts for. */
export function isStalled(projectId: string, tasks: Task[]): boolean {
  return !nextActionOf(projectId, tasks);
}

export function daysSince(iso?: string): number | undefined {
  if (!iso) return undefined;
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
}
