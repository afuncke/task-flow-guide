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
}
