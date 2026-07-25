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
import { ChevronDown, ChevronRight } from "lucide-react";

export const Route = createFileRoute("/board")({
  head: () => ({
    meta: [
      { title: "Board — Shenas" },
      { name: "description", content: "Backlog, My Day, Focused, Done — your work at a glance." },
      { property: "og:title", content: "Board — Shenas" },
      { property: "og:description", content: "Backlog, My Day, Focused, Done — your work at a glance." },
    ],
  }),
  component: BoardPage,
});

type BoardColumn = "backlog" | "myday" | "focused" | "done";

const COLUMNS: { id: BoardColumn; label: string; hint?: string }[] = [
  { id: "backlog", label: "Backlog", hint: "Uncommitted" },
  { id: "myday", label: "My Day", hint: "Committed for today" },
  { id: "focused", label: "Focused", hint: "Now" },
  { id: "done", label: "Done" },
];

type ColumnMap = Record<BoardColumn, Task[]>;

function todayKey(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function columnOf(t: Task, today: string): BoardColumn {
  if (t.status === "doing") return "focused";
  if (t.status === "done") return "done";
  if (t.myDay === today) return "myday";
  return "backlog";
}

function patchForColumn(col: BoardColumn, orig: Task, today: string): Partial<Task> {
  const patch: Partial<Task> = {};
  switch (col) {
    case "backlog":
      if (orig.status !== "todo") patch.status = "todo";
      if (orig.myDay === today) patch.myDay = undefined;
      if (orig.status === "done") patch.completedAt = undefined;
      break;
    case "myday":
      if (orig.status !== "todo") patch.status = "todo";
      if (orig.myDay !== today) patch.myDay = today;
      if (orig.status === "done") patch.completedAt = undefined;
      break;
    case "focused":
      if (orig.status !== "doing") patch.status = "doing";
      if (orig.status === "done") patch.completedAt = undefined;
      break;
    case "done":
      if (orig.status !== "done") {
        patch.status = "done";
        patch.completedAt = new Date().toISOString();
      }
      break;
  }
  return patch;
}

function BoardPage() {
  const { tasks, allTasks, hydrated, addTask, updateTask, setStatus, deleteTask, bulkUpdate } =
    useTasks();
  const { currentState, stored } = useContextState();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Task | null>(null);
  const [activeTags, setActiveTags] = useState<string[]>([]);
  const [showAllDone, setShowAllDone] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [override, setOverride] = useState<ColumnMap | null>(null);
  const [deferredOpen, setDeferredOpen] = useState(false);
  const [letGoOpen, setLetGoOpen] = useState(false);
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

  const today = todayKey();

  const baseByColumn = useMemo<ColumnMap>(() => {
    const map: ColumnMap = { backlog: [], myday: [], focused: [], done: [] };
    for (const t of filtered) map[columnOf(t, today)].push(t);
    map.backlog = rankTasks(map.backlog, currentState);
    map.myday = rankTasks(map.myday, currentState);
    map.focused = rankTasks(map.focused, currentState);
    map.done = [...map.done].sort((a, b) => {
      const ao = a.order ?? Number.POSITIVE_INFINITY;
      const bo = b.order ?? Number.POSITIVE_INFINITY;
      if (ao !== bo) return ao - bo;
      return (b.completedAt ?? b.createdAt).localeCompare(a.completedAt ?? a.createdAt);
    });
    return map;
  }, [filtered, currentState, today]);

  const byColumn = override ?? baseByColumn;

  const deferred = useMemo(
    () =>
      tasks
        .filter((t) => (t.rescheduleCount ?? 0) >= 1 && t.status !== "done")
        .sort((a, b) => (b.rescheduleCount ?? 0) - (a.rescheduleCount ?? 0)),
    [tasks],
  );
  const letGo = useMemo(
    () =>
      allTasks
        .filter((t) => t.archived)
        .sort((a, b) => (b.archivedAt ?? "").localeCompare(a.archivedAt ?? "")),
    [allTasks],
  );

  if (!hydrated) return null;

  const openEdit = (t: Task) => {
    setEditing(t);
    setDialogOpen(true);
  };

  const findContainer = (id: string, source: ColumnMap): BoardColumn | null => {
    if (id === "backlog" || id === "myday" || id === "focused" || id === "done") return id;
    for (const s of ["backlog", "myday", "focused", "done"] as BoardColumn[]) {
      if (source[s].some((t) => t.id === id)) return s;
    }
    return null;
  };

  const activeTask = activeId ? tasks.find((t) => t.id === activeId) ?? null : null;

  const handleDragStart = (e: DragStartEvent) => {
    setActiveId(String(e.active.id));
    setOverride(baseByColumn);
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
      const src = prev ?? baseByColumn;
      const fromList = [...src[from]];
      const toList = [...src[to]];
      const idx = fromList.findIndex((t) => t.id === activeIdStr);
      if (idx === -1) return src;
      const [moved] = fromList.splice(idx, 1);
      const overIdx = toList.findIndex((t) => t.id === overIdStr);
      const insertAt = overIdx === -1 ? toList.length : overIdx;
      toList.splice(insertAt, 0, moved);
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

    const patches: Record<string, Partial<Task>> = {};
    for (const col of ["backlog", "myday", "focused", "done"] as BoardColumn[]) {
      finalMap[col].forEach((t, i) => {
        const orig = tasks.find((x) => x.id === t.id);
        if (!orig) return;
        const patch = patchForColumn(col, orig);
        if (orig.order !== i) patch.order = i;
        if (Object.keys(patch).length > 0) patches[t.id] = patch;
      });
    }
    if (Object.keys(patches).length > 0) bulkUpdate(patches);
    setOverride(null);
  };

  const focusedCount = byColumn.focused.length;

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
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {COLUMNS.map((col) => {
            const items = byColumn[col.id];
            const display =
              col.id === "done" && !showAllDone ? items.slice(0, 10) : items;
            const wipWarn = col.id === "focused" && focusedCount > 3;
            return (
              <SortableColumn
                key={col.id}
                id={col.id}
                label={col.label}
                hint={col.hint}
                count={items.length}
                itemIds={display.map((t) => t.id)}
                wipWarn={wipWarn}
                onQuickAdd={(title) => {
                  const base = {
                    title,
                    tags: [],
                    priority: null as Task["priority"],
                    order: -1,
                  };
                  if (col.id === "done") {
                    addTask({ ...base, status: "done", completedAt: new Date().toISOString() });
                  } else if (col.id === "focused") {
                    addTask({ ...base, status: "doing" });
                  } else if (col.id === "myday") {
                    addTask({ ...base, status: "todo", myDay: true });
                  } else {
                    addTask({ ...base, status: "todo" });
                  }
                }}
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
                {col.id === "done" && items.length > 10 && (
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

      <div className="mt-8 space-y-3">
        <Drawer
          label="Deferred"
          count={deferred.length}
          open={deferredOpen}
          onToggle={() => setDeferredOpen((v) => !v)}
          hint="Rescheduled at least once — gentle reminder, not a scolding."
        >
          {deferred.length === 0 ? (
            <p className="px-1 py-2 text-xs text-muted-foreground">Nothing deferred.</p>
          ) : (
            <ul className="space-y-1">
              {deferred.map((t) => (
                <li
                  key={t.id}
                  className="flex items-center justify-between rounded-md px-2 py-1.5 text-sm hover:bg-muted/60"
                >
                  <button
                    className="flex-1 truncate text-left"
                    onClick={() => openEdit(t)}
                  >
                    {t.title}
                  </button>
                  <span className="ml-2 shrink-0 text-xs text-muted-foreground">
                    moved {t.rescheduleCount ?? 0}×
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Drawer>

        <Drawer
          label="Let go"
          count={letGo.length}
          open={letGoOpen}
          onToggle={() => setLetGoOpen((v) => !v)}
          hint="Archived without guilt. Bring one back any time."
        >
          {letGo.length === 0 ? (
            <p className="px-1 py-2 text-xs text-muted-foreground">Nothing here yet.</p>
          ) : (
            <ul className="space-y-1">
              {letGo.map((t) => (
                <li
                  key={t.id}
                  className="flex items-center justify-between rounded-md px-2 py-1.5 text-sm hover:bg-muted/60"
                >
                  <span className="flex-1 truncate text-muted-foreground line-through">
                    {t.title}
                  </span>
                  <button
                    className="ml-2 shrink-0 text-xs text-primary hover:underline"
                    onClick={() =>
                      updateTask(t.id, { archived: false, archivedAt: undefined, status: "todo" })
                    }
                  >
                    bring back
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Drawer>
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

function SortableColumn({
  id,
  label,
  hint,
  count,
  itemIds,
  wipWarn,
  onQuickAdd,
  children,
}: {
  id: BoardColumn;
  label: string;
  hint?: string;
  count: number;
  itemIds: string[];
  wipWarn?: boolean;
  onQuickAdd: (title: string) => void;
  children: React.ReactNode;
}) {
  const { isOver, setNodeRef } = useDroppable({ id });
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
      <div className="mb-1 flex items-baseline justify-between px-1">
        <h2 className="text-sm font-semibold">{label}</h2>
        <span className="text-xs text-muted-foreground">{count}</span>
      </div>
      {hint && <p className="mb-2 px-1 text-[11px] text-muted-foreground">{hint}</p>}
      {wipWarn && (
        <p className="mb-2 rounded-md bg-amber-500/10 px-2 py-1 text-[11px] text-amber-700 dark:text-amber-400">
          {count} in focus — consider narrowing to one.
        </p>
      )}
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
        placeholder={`+ Add to ${label}`}
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

function Drawer({
  label,
  count,
  open,
  onToggle,
  hint,
  children,
}: {
  label: string;
  count: number;
  open: boolean;
  onToggle: () => void;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border bg-muted/20">
      <button
        onClick={onToggle}
        className="flex w-full items-center justify-between px-3 py-2 text-left"
      >
        <span className="flex items-center gap-2 text-sm font-medium">
          {open ? (
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          ) : (
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          )}
          {label}
          <span className="text-xs text-muted-foreground">({count})</span>
        </span>
      </button>
      {open && (
        <div className="border-t px-3 py-2">
          {hint && <p className="mb-2 text-[11px] text-muted-foreground">{hint}</p>}
          {children}
        </div>
      )}
    </div>
  );
}
