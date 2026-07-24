import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useTasks } from "@/hooks/use-tasks";
import { rankTasks } from "@/lib/tasks/urgency";
import type { Task, TaskStatus } from "@/lib/tasks/types";
import { TaskCard } from "@/components/tasks/TaskCard";
import { TaskDialog } from "@/components/tasks/TaskDialog";
import { TagFilterBar } from "@/components/tasks/TagFilterBar";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";

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
  const [activeId, setActiveId] = useState<string | null>(null);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

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

  const activeTask = activeId ? tasks.find((t) => t.id === activeId) ?? null : null;

  const handleDragStart = (e: DragStartEvent) => setActiveId(String(e.active.id));
  const handleDragEnd = (e: DragEndEvent) => {
    setActiveId(null);
    const over = e.over;
    if (!over) return;
    const nextStatus = over.id as TaskStatus;
    const task = tasks.find((t) => t.id === e.active.id);
    if (task && task.status !== nextStatus) setStatus(task.id, nextStatus);
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

      <DndContext
        sensors={sensors}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onDragCancel={() => setActiveId(null)}
      >
        <div className="grid gap-4 md:grid-cols-3">
          {COLUMNS.map((col) => {
            const items = byStatus[col.status];
            const display =
              col.status === "done" && !showAllDone ? items.slice(0, 10) : items;
            return (
              <DroppableColumn key={col.status} status={col.status} label={col.label} count={items.length}>
                {display.map((t) => (
                  <DraggableTask key={t.id} id={t.id} dimmed={activeId === t.id}>
                    <TaskCard
                      task={t}
                      onEdit={() => openEdit(t)}
                      onMove={(s) => setStatus(t.id, s)}
                      onDelete={() => deleteTask(t.id)}
                    />
                  </DraggableTask>
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
              </DroppableColumn>
            );
          })}
        </div>
        <DragOverlay>
          {activeTask ? (
            <div className="rotate-1 opacity-90">
              <TaskCard task={activeTask} onEdit={() => {}} onMove={() => {}} onDelete={() => {}} />
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>

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

function DroppableColumn({
  status,
  label,
  count,
  children,
}: {
  status: TaskStatus;
  label: string;
  count: number;
  children: React.ReactNode;
}) {
  const { isOver, setNodeRef } = useDroppable({ id: status });
  return (
    <div
      ref={setNodeRef}
      className={`rounded-lg p-3 transition-colors ${isOver ? "bg-primary/10 ring-2 ring-primary/40" : "bg-muted/40"}`}
    >
      <div className="mb-3 flex items-center justify-between px-1">
        <h2 className="text-sm font-semibold">{label}</h2>
        <span className="text-xs text-muted-foreground">{count}</span>
      </div>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

function DraggableTask({
  id,
  dimmed,
  children,
}: {
  id: string;
  dimmed: boolean;
  children: React.ReactNode;
}) {
  const { attributes, listeners, setNodeRef } = useDraggable({ id });
  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      className={dimmed ? "opacity-40" : undefined}
    >
      {children}
    </div>
  );
}
