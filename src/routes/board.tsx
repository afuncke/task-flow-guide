import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useTasks } from "@/hooks/use-tasks";
import { rankTasks } from "@/lib/tasks/urgency";
import type { Task, TaskStatus } from "@/lib/tasks/types";
import { TaskCard } from "@/components/tasks/TaskCard";
import { TaskDialog } from "@/components/tasks/TaskDialog";
import { TagFilterBar } from "@/components/tasks/TagFilterBar";

export const Route = createFileRoute("/board")({
  head: () => ({
    meta: [
      { title: "Board — Shenas" },
      { name: "description", content: "Kanban overview of your tasks." },
      { property: "og:title", content: "Board — Shenas" },
      { property: "og:description", content: "Kanban overview of your tasks." },
    ],
  }),
  component: BoardPage,
});

const COLUMNS: { status: TaskStatus; label: string }[] = [
  { status: "todo", label: "Todo" },
  { status: "doing", label: "Doing" },
  { status: "done", label: "Done" },
];

function BoardPage() {
  const { tasks, hydrated, addTask, updateTask, setStatus, deleteTask } = useTasks();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Task | null>(null);
  const [activeTags, setActiveTags] = useState<string[]>([]);
  const [showAllDone, setShowAllDone] = useState(false);

  const knownTags = useMemo(
    () => Array.from(new Set(tasks.flatMap((t) => t.tags))).sort(),
    [tasks],
  );

  const filtered = useMemo(() => {
    if (activeTags.length === 0) return tasks;
    return tasks.filter((t) => activeTags.every((tag) => t.tags.includes(tag)));
  }, [tasks, activeTags]);

  const byStatus = useMemo(() => {
    const map: Record<TaskStatus, Task[]> = { todo: [], doing: [], done: [] };
    for (const t of filtered) map[t.status].push(t);
    map.todo = rankTasks(map.todo);
    map.doing = rankTasks(map.doing);
    map.done = [...map.done].sort((a, b) =>
      (b.completedAt ?? b.createdAt).localeCompare(a.completedAt ?? a.createdAt),
    );
    return map;
  }, [filtered]);

  if (!hydrated) return null;

  const openEdit = (t: Task) => {
    setEditing(t);
    setDialogOpen(true);
  };

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <div className="mb-6">
        <TagFilterBar
          tags={knownTags}
          active={activeTags}
          onToggle={(t) =>
            setActiveTags((a) => (a.includes(t) ? a.filter((x) => x !== t) : [...a, t]))
          }
          onClear={() => setActiveTags([])}
        />
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {COLUMNS.map((col) => {
          const items = byStatus[col.status];
          const display =
            col.status === "done" && !showAllDone ? items.slice(0, 10) : items;
          return (
            <div key={col.status} className="rounded-lg bg-muted/40 p-3">
              <div className="mb-3 flex items-center justify-between px-1">
                <h2 className="text-sm font-semibold">{col.label}</h2>
                <span className="text-xs text-muted-foreground">{items.length}</span>
              </div>
              <div className="space-y-2">
                {display.map((t) => (
                  <TaskCard
                    key={t.id}
                    task={t}
                    onEdit={() => openEdit(t)}
                    onMove={(s) => setStatus(t.id, s)}
                    onDelete={() => deleteTask(t.id)}
                  />
                ))}
                {display.length === 0 && (
                  <div className="rounded-md border border-dashed py-6 text-center text-xs text-muted-foreground">
                    Nothing here
                  </div>
                )}
                {col.status === "done" && items.length > 10 && (
                  <button
                    className="w-full text-center text-xs text-muted-foreground hover:text-foreground"
                    onClick={() => setShowAllDone((v) => !v)}
                  >
                    {showAllDone ? "Show less" : `Show all (${items.length})`}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <TaskDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        task={editing}
        knownTags={knownTags}
        onSave={(data) => {
          if (editing) updateTask(editing.id, data);
          else addTask(data);
        }}
        onDelete={editing ? () => deleteTask(editing.id) : undefined}
      />
    </div>
  );
}
