import type { Task } from "./types";
import { contextFit, type CurrentState } from "./context";

const DAY = 1000 * 60 * 60 * 24;

function daysUntil(iso: string): number {
  const target = new Date(iso + "T23:59:59").getTime();
  return (target - Date.now()) / DAY;
}

export function urgency(task: Task): number {
  let score = 0;

  if (task.priority === "H") score += 6;
  else if (task.priority === "M") score += 3.9;
  else if (task.priority === "L") score += 1.8;

  if (task.due) {
    const d = daysUntil(task.due);
    if (d < 0) score += 12;
    else if (d <= 1) score += 8;
    else if (d <= 3) score += 5;
    else if (d <= 7) score += 3;
    else if (d <= 14) score += 1;
  }

  const ageDays = (Date.now() - new Date(task.createdAt).getTime()) / DAY;
  score += Math.min(ageDays / 7, 2);

  if (task.status === "doing") score += 4;

  return Math.round(score * 10) / 10;
}

export function rankTasks(tasks: Task[], state?: CurrentState): Task[] {
  return [...tasks].sort((a, b) => {
    const ao = a.order ?? Number.POSITIVE_INFINITY;
    const bo = b.order ?? Number.POSITIVE_INFINITY;
    if (ao !== bo) return ao - bo;
    if (state) {
      const af = contextFit(a, state) ? 1 : 0;
      const bf = contextFit(b, state) ? 1 : 0;
      if (af !== bf) return bf - af; // fitting tasks first
    }
    const diff = urgency(b) - urgency(a);
    if (diff !== 0) return diff;
    return a.createdAt.localeCompare(b.createdAt);
  });
}
