import { useMemo } from "react";
import { useTasks } from "@/hooks/use-tasks";
import { taskDialogStore, useTaskDialog } from "@/lib/tasks/dialog-store";
import { TaskDialog } from "./TaskDialog";

export function GlobalTaskDialog() {
  const { tasks, hydrated, addTask, updateTask, deleteTask } = useTasks();
  const { open, task, defaultDue } = useTaskDialog();

  const knownTags = useMemo(
    () => Array.from(new Set(tasks.flatMap((t) => t.tags))).sort(),
    [tasks],
  );

  if (!hydrated) return null;

  return (
    <TaskDialog
      open={open}
      onOpenChange={(v) => (v ? undefined : taskDialogStore.close())}
      task={task}
      defaultDue={defaultDue}
      knownTags={knownTags}
      onSave={(data) => {
        if (task) updateTask(task.id, data);
        else addTask(data);
      }}
      onDelete={task ? () => deleteTask(task.id) : undefined}
    />
  );
}
