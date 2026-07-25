import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useTasks } from "@/hooks/use-tasks";
import { useContextState } from "@/hooks/use-context-state";
import { rankTasks } from "@/lib/tasks/urgency";
import { contextFit } from "@/lib/tasks/context";
import type { Task, TaskStatus } from "@/lib/tasks/types";
import { TaskCard } from "@/components/tasks/TaskCard";
import { TaskDialog } from "@/components/tasks/TaskDialog";
import { TagFilterBar } from "@/components/tasks/TagFilterBar";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  useDroppable,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  arrayMove,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

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

type ColumnMap = Record<TaskStatus, Task[]>;

function BoardPage() {
  const { tasks, hydrated, addTask, updateTask, setStatus, deleteTask, bulkUpdate } = useTasks();
  const { currentState, stored } = useContextState();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Task | null>(null);
  const [activeTags, setActiveTags] = useState<string[]>([]);
  const [showAllDone, setShowAllDone] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);
  // Optimistic override of column contents while dragging (before persist)
  const [override, setOverride] = useState<ColumnMap | null>(null);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const knownTags = useMemo(
    () => Array.from(new Set(tasks.flatMap((t) => t.tags))).sort(),
    [tasks],
  );

  const filtered = useMemo(() => {
    let list = tasks;
    if (activeTags.length > 0) {
      list = list.filter((t) => activeTags.every((tag) => t.tags.includes(tag)));
    }
    if (stored.hideMismatches) {
      list = list.filter((t) => contextFit(t, currentState));
    }
    return list;
  }, [tasks, activeTags, stored.hideMismatches, currentState]);

  const baseByStatus = useMemo<ColumnMap>(() => {
    const map: ColumnMap = { todo: [], doing: [], done: [] };
    for (const t of filtered) map[t.status].push(t);
    map.todo = rankTasks(map.todo, currentState);
    map.doing = rankTasks(map.doing, currentState);
    map.done = [...map.done].sort((a, b) => {
      const ao = a.order ?? Number.POSITIVE_INFINITY;
      const bo = b.order ?? Number.POSITIVE_INFINITY;
      if (ao !== bo) return ao - bo;
      return (b.completedAt ?? b.createdAt).localeCompare(a.completedAt ?? a.createdAt);
    });
    return map;
  }, [filtered, currentState]);

  const byStatus = override ?? baseByStatus;

  if (!hydrated) return null;

  const openEdit = (t: Task) => {
    setEditing(t);
    setDialogOpen(true);
  };

  const findContainer = (id: string, source: ColumnMap): TaskStatus | null => {
    if (id === "todo" || id === "doing" || id === "done") return id;
    for (const s of ["todo", "doing", "done"] as TaskStatus[]) {
      if (source[s].some((t) => t.id === id)) return s;
    }
    return null;
  };

  const activeTask = activeId ? tasks.find((t) => t.id === activeId) ?? null : null;

  const handleDragStart = (e: DragStartEvent) => {
    setActiveId(String(e.active.id));
    setOverride(baseByStatus);
  };

  const handleDragOver = (e: DragOverEvent) => {
    const { active, over } = e;
    if (!over || !override) return;
    const activeIdStr = String(active.id);
    const overIdStr = String(over.id);
    const from = findContainer(activeIdStr, override);
    const to = findContainer(overIdStr, override);
    if (!from || !to || from === to) return;

    setOverride((prev) => {
      const src = prev ?? baseByStatus;
      const fromList = [...src[from]];
      const toList = [...src[to]];
      const idx = fromList.findIndex((t) => t.id === activeIdStr);
      if (idx === -1) return src;
      const [moved] = fromList.splice(idx, 1);
      const overIdx = toList.findIndex((t) => t.id === overIdStr);
      const insertAt = overIdx === -1 ? toList.length : overIdx;
      toList.splice(insertAt, 0, { ...moved, status: to });
      return { ...src, [from]: fromList, [to]: toList };
    });
  };

  const handleDragEnd = (e: DragEndEvent) => {
    const { active, over } = e;
    setActiveId(null);
    if (!over || !override) {
      setOverride(null);
      return;
    }
    const activeIdStr = String(active.id);
    const overIdStr = String(over.id);
    const container = findContainer(overIdStr, override);
    if (!container) {
      setOverride(null);
      return;
    }

    let finalMap = override;
    const list = [...override[container]];
    const activeIdx = list.findIndex((t) => t.id === activeIdStr);
    const overIdx = list.findIndex((t) => t.id === overIdStr);
    if (activeIdx !== -1 && overIdx !== -1 && activeIdx !== overIdx) {
      const reordered = arrayMove(list, activeIdx, overIdx);
      finalMap = { ...override, [container]: reordered };
    }

    // Persist: for each column that changed vs base, write order (and status where different).
    const patches: Record<string, Partial<Task>> = {};
    for (const status of ["todo", "doing", "done"] as TaskStatus[]) {
      finalMap[status].forEach((t, i) => {
        const orig = tasks.find((x) => x.id === t.id);
        if (!orig) return;
        const patch: Partial<Task> = {};
        if (orig.status !== status) {
          patch.status = status;
          if (status === "done") patch.completedAt = new Date().toISOString();
          else if (orig.status === "done") patch.completedAt = undefined;
        }
        if (orig.order !== i) patch.order = i;
        if (Object.keys(patch).length > 0) patches[t.id] = patch;
      });
    }
    if (Object.keys(patches).length > 0) bulkUpdate(patches);
    setOverride(null);
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
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
        onDragCancel={() => {
          setActiveId(null);
          setOverride(null);
        }}
      >
        <div className="grid gap-4 md:grid-cols-3">
          {COLUMNS.map((col) => {
            const items = byStatus[col.status];
            const display =
              col.status === "done" && !showAllDone ? items.slice(0, 10) : items;
            return (
              <SortableColumn
                key={col.status}
                status={col.status}
                label={col.label}
                count={items.length}
                itemIds={display.map((t) => t.id)}
                onQuickAdd={(title) =>
                  addTask({
                    title,
                    tags: [],
                    priority: null,
                    status: col.status,
                    order: -1,
                    ...(col.status === "done"
                      ? { completedAt: new Date().toISOString() }
                      : {}),
                  })
                }
              >
                {display.map((t) => (
                  <SortableTask key={t.id} id={t.id} dimmed={activeId === t.id}>
                    <TaskCard
                      task={t}
                      onEdit={() => openEdit(t)}
                      onMove={(s) => setStatus(t.id, s)}
                      onDelete={() => deleteTask(t.id)}
                      currentState={currentState}
                    />
                  </SortableTask>
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
              </SortableColumn>
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

function SortableColumn({
  status,
  label,
  count,
  itemIds,
  onQuickAdd,
  children,
}: {
  status: TaskStatus;
  label: string;
  count: number;
  itemIds: string[];
  onQuickAdd: (title: string) => void;
  children: React.ReactNode;
}) {
  const { isOver, setNodeRef } = useDroppable({ id: status });
  const [draft, setDraft] = useState("");
  const submit = () => {
    const v = draft.trim();
    if (!v) return;
    onQuickAdd(v);
    setDraft("");
  };
  return (
    <div
      ref={setNodeRef}
      className={`rounded-lg p-3 transition-colors ${isOver ? "bg-primary/10 ring-2 ring-primary/40" : "bg-muted/40"}`}
    >
      <div className="mb-3 flex items-center justify-between px-1">
        <h2 className="text-sm font-semibold">{label}</h2>
        <span className="text-xs text-muted-foreground">{count}</span>
      </div>
      <input
        type="text"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            submit();
          }
        }}
        placeholder={`+ Add to ${label.toLowerCase()}`}
        aria-label={`Quick add task to ${label}`}
        className="mb-2 w-full rounded-md border bg-background px-2 py-1.5 text-xs placeholder:text-muted-foreground focus:border-primary focus:outline-none"
      />
      <SortableContext items={itemIds} strategy={verticalListSortingStrategy}>
        <div className="space-y-2 min-h-[40px]">{children}</div>
      </SortableContext>
    </div>
  );
}

function SortableTask({
  id,
  dimmed,
  children,
}: {
  id: string;
  dimmed: boolean;
  children: React.ReactNode;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id });
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: dimmed || isDragging ? 0.4 : 1,
  };
  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      {children}
    </div>
  );
}
