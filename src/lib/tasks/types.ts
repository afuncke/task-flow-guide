import type { TaskContext } from "./context";

export type TaskStatus = "todo" | "doing" | "done";
export type TaskPriority = "H" | "M" | "L" | null;

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
}
