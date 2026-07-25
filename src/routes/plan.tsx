import { useMemo, useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { useTasks } from "@/hooks/use-tasks";
import type { Task } from "@/lib/tasks/types";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { TagChip } from "@/components/tasks/TagChip";
import { DueBadge } from "@/components/tasks/DueBadge";
import { taskDialogStore } from "@/lib/tasks/dialog-store";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/plan")({
  head: () => ({
    meta: [
      { title: "Plan your day — Shenas" },
      { name: "description", content: "Time-block tasks into an hourly plan for the day." },
      { property: "og:title", content: "Plan your day — Shenas" },
      { property: "og:description", content: "Time-block tasks into an hourly plan for the day." },
    ],
  }),
  component: PlanPage,
});

const HOUR_START = 6;
const HOUR_END = 23; // exclusive
const SLOT_MIN = 30;
const SLOT_PX = 32;
const SLOTS_PER_HOUR = 60 / SLOT_MIN;
const TOTAL_SLOTS = (HOUR_END - HOUR_START) * SLOTS_PER_HOUR;
const DURATION_OPTIONS = [15, 30, 45, 60, 90, 120, 180, 240];

function dateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function slotToISO(day: Date, slotIdx: number): string {
  const d = new Date(day);
  const totalMin = HOUR_START * 60 + slotIdx * SLOT_MIN;
  d.setHours(Math.floor(totalMin / 60), totalMin % 60, 0, 0);
  return d.toISOString();
}

function isoToSlot(iso: string, day: Date): number | null {
  const d = new Date(iso);
  if (dateKey(d) !== dateKey(day)) return null;
  const min = d.getHours() * 60 + d.getMinutes();
  const startMin = HOUR_START * 60;
  const idx = Math.round((min - startMin) / SLOT_MIN);
  if (idx < 0 || idx >= TOTAL_SLOTS) return null;
  return idx;
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

function PlanPage() {
  const { tasks, hydrated, updateTask, setStatus, deleteTask } = useTasks();
  const [day, setDay] = useState(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  });
  const gridRef = useRef<HTMLDivElement>(null);
  const [dragOverSlot, setDragOverSlot] = useState<number | null>(null);

  const key = dateKey(day);

  const { scheduled, unscheduled } = useMemo(() => {
    const scheduled: { task: Task; slot: number; slots: number }[] = [];
    const unscheduled: Task[] = [];
    for (const t of tasks) {
      if (t.status === "done") continue;
      if (t.scheduledStart) {
        const slot = isoToSlot(t.scheduledStart, day);
        if (slot != null) {
          const dur = Math.max(SLOT_MIN, t.scheduledDuration ?? 30);
          const slots = Math.max(1, Math.round(dur / SLOT_MIN));
          scheduled.push({ task: t, slot, slots });
          continue;
        }
      }
      // unscheduled shows tasks with due on this day OR no due
      if (!t.scheduledStart) {
        if (!t.due || t.due === key) unscheduled.push(t);
      }
    }
    scheduled.sort((a, b) => a.slot - b.slot);
    unscheduled.sort((a, b) => {
      if (a.due && !b.due) return -1;
      if (!a.due && b.due) return 1;
      return a.title.localeCompare(b.title);
    });
    return { scheduled, unscheduled };
  }, [tasks, day, key]);

  if (!hydrated) return null;

  const shiftDay = (delta: number) => {
    const d = new Date(day);
    d.setDate(d.getDate() + delta);
    setDay(d);
  };

  const dayLabel = day.toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  const slotFromEvent = (e: React.DragEvent): number | null => {
    const rect = gridRef.current?.getBoundingClientRect();
    if (!rect) return null;
    const y = e.clientY - rect.top;
    const idx = Math.floor(y / SLOT_PX);
    if (idx < 0 || idx >= TOTAL_SLOTS) return null;
    return idx;
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOverSlot(null);
    const id = e.dataTransfer.getData("text/task-id");
    if (!id) return;
    const slot = slotFromEvent(e);
    if (slot == null) return;
    updateTask(id, {
      scheduledStart: slotToISO(day, slot),
      scheduledDuration:
        tasks.find((t) => t.id === id)?.scheduledDuration ?? 30,
      due: key,
    });
  };

  const unschedule = (id: string) => {
    updateTask(id, { scheduledStart: undefined });
  };

  const setDuration = (id: string, minutes: number) => {
    updateTask(id, { scheduledDuration: minutes });
  };

  // Detect overlaps → assign column (0/1) to overlapping blocks
  const laidOut = layoutBlocks(scheduled);

  const now = new Date();
  const nowLineTop =
    dateKey(now) === key
      ? ((now.getHours() - HOUR_START) * 60 + now.getMinutes()) *
        (SLOT_PX / SLOT_MIN)
      : null;

  return (
    <div className="mx-auto max-w-6xl px-4 py-6">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">{dayLabel}</h1>
          <p className="text-xs text-muted-foreground">
            Drag tasks from the sidebar into time slots.
          </p>
        </div>
        <div className="flex items-center gap-1">
          <Button variant="outline" size="sm" onClick={() => shiftDay(-1)}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              const d = new Date();
              d.setHours(0, 0, 0, 0);
              setDay(d);
            }}
          >
            Today
          </Button>
          <Button variant="outline" size="sm" onClick={() => shiftDay(1)}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-[260px_1fr]">
        <aside
          className="rounded-lg border bg-card p-3"
          onDragOver={(e) => {
            const id = e.dataTransfer.types.includes("text/task-id");
            if (id) e.preventDefault();
          }}
          onDrop={(e) => {
            e.preventDefault();
            const id = e.dataTransfer.getData("text/task-id");
            if (id) unschedule(id);
          }}
        >
          <div className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Unscheduled ({unscheduled.length})
          </div>
          <div className="space-y-1.5">
            {unscheduled.length === 0 && (
              <div className="rounded-md border border-dashed p-3 text-xs text-muted-foreground">
                Nothing to plan. Drop scheduled blocks here to unschedule.
              </div>
            )}
            {unscheduled.map((t) => (
              <div
                key={t.id}
                draggable
                onDragStart={(e) => {
                  e.dataTransfer.setData("text/task-id", t.id);
                  e.dataTransfer.effectAllowed = "move";
                }}
                onClick={() => taskDialogStore.openEdit(t)}
                className="cursor-grab rounded-md border bg-background p-2 text-sm shadow-sm transition-colors hover:border-primary/40 active:cursor-grabbing"
              >
                <div className="font-medium leading-snug">{t.title}</div>
                <div className="mt-1 flex flex-wrap items-center gap-1">
                  {t.tags.slice(0, 3).map((tag) => (
                    <TagChip key={tag} tag={tag} />
                  ))}
                  <DueBadge due={t.due} />
                </div>
              </div>
            ))}
          </div>
        </aside>

        <div className="rounded-lg border bg-card">
          <div
            ref={gridRef}
            className="relative"
            style={{ height: TOTAL_SLOTS * SLOT_PX }}
            onDragOver={(e) => {
              if (!e.dataTransfer.types.includes("text/task-id")) return;
              e.preventDefault();
              setDragOverSlot(slotFromEvent(e));
            }}
            onDragLeave={() => setDragOverSlot(null)}
            onDrop={handleDrop}
          >
            {/* Slot lines & hour labels */}
            {Array.from({ length: TOTAL_SLOTS }).map((_, i) => {
              const hour = HOUR_START + Math.floor(i / SLOTS_PER_HOUR);
              const isHour = i % SLOTS_PER_HOUR === 0;
              return (
                <div
                  key={i}
                  className={cn(
                    "absolute left-0 right-0 border-t",
                    isHour ? "border-border" : "border-border/40",
                    dragOverSlot === i && "bg-primary/10",
                  )}
                  style={{ top: i * SLOT_PX, height: SLOT_PX }}
                >
                  {isHour && (
                    <span className="absolute -top-2 left-2 bg-card px-1 text-[10px] text-muted-foreground">
                      {formatHour(hour)}
                    </span>
                  )}
                </div>
              );
            })}

            {/* Now line */}
            {nowLineTop != null && (
              <div
                className="pointer-events-none absolute left-0 right-0 z-10 flex items-center"
                style={{ top: nowLineTop }}
              >
                <div className="h-2 w-2 rounded-full bg-red-500" />
                <div className="h-px flex-1 bg-red-500" />
              </div>
            )}

            {/* Blocks */}
            {laidOut.map(({ task, slot, slots, col, cols }) => {
              const left = `calc(3rem + ${(col / cols) * 100}% - ${(col / cols) * 3}rem)`;
              const width = `calc(${(1 / cols) * 100}% - ${(1 / cols) * 3}rem - 4px)`;
              return (
                <div
                  key={task.id}
                  draggable
                  onDragStart={(e) => {
                    e.dataTransfer.setData("text/task-id", task.id);
                    e.dataTransfer.effectAllowed = "move";
                  }}
                  onClick={() => taskDialogStore.openEdit(task)}
                  className={cn(
                    "group absolute cursor-grab overflow-hidden rounded-md border p-1.5 text-xs shadow-sm active:cursor-grabbing",
                    task.status === "doing"
                      ? "border-primary/60 bg-primary/15"
                      : "border-primary/30 bg-primary/10 hover:bg-primary/15",
                  )}
                  style={{
                    top: slot * SLOT_PX + 1,
                    height: slots * SLOT_PX - 2,
                    left,
                    width,
                  }}
                >
                  <div className="flex items-start justify-between gap-1">
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-medium">{task.title}</div>
                      <div className="text-[10px] text-muted-foreground">
                        {formatTime(task.scheduledStart!)} ·{" "}
                        {task.scheduledDuration ?? 30}m
                      </div>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        unschedule(task.id);
                      }}
                      className="rounded p-0.5 text-muted-foreground opacity-0 hover:bg-background hover:text-foreground group-hover:opacity-100"
                      aria-label="Unschedule"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                  {slots >= 2 && (
                    <div
                      className="mt-1 flex flex-wrap items-center gap-1"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <Select
                        value={String(task.scheduledDuration ?? 30)}
                        onValueChange={(v) => setDuration(task.id, Number(v))}
                      >
                        <SelectTrigger className="h-6 w-20 text-[10px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {DURATION_OPTIONS.map((m) => (
                            <SelectItem key={m} value={String(m)} className="text-xs">
                              {m}m
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <button
                        onClick={() =>
                          setStatus(
                            task.id,
                            task.status === "doing" ? "todo" : "doing",
                          )
                        }
                        className="rounded border px-1.5 py-0.5 text-[10px] hover:bg-background"
                      >
                        {task.status === "doing" ? "Pause" : "Start"}
                      </button>
                      <button
                        onClick={() => setStatus(task.id, "done")}
                        className="rounded border px-1.5 py-0.5 text-[10px] hover:bg-background"
                      >
                        Done
                      </button>
                    </div>
                  )}
                  {slots < 2 && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setDuration(
                          task.id,
                          nextDuration(task.scheduledDuration ?? 30),
                        );
                      }}
                      className="absolute bottom-0.5 right-1 rounded text-[10px] text-muted-foreground opacity-0 hover:text-foreground group-hover:opacity-100"
                      aria-label="Extend"
                    >
                      +
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

function formatHour(h: number): string {
  const d = new Date();
  d.setHours(h, 0, 0, 0);
  return d.toLocaleTimeString(undefined, { hour: "numeric" });
}

function nextDuration(cur: number): number {
  const opts = DURATION_OPTIONS;
  const i = opts.findIndex((v) => v > cur);
  return i === -1 ? opts[opts.length - 1] : opts[i];
}

interface LaidBlock {
  task: Task;
  slot: number;
  slots: number;
  col: number;
  cols: number;
}

function layoutBlocks(
  blocks: { task: Task; slot: number; slots: number }[],
): LaidBlock[] {
  // Group overlapping blocks into clusters, then assign columns greedily.
  const sorted = [...blocks].sort((a, b) => a.slot - b.slot);
  const result: LaidBlock[] = [];
  let cluster: (typeof sorted[number] & { end: number })[] = [];
  const flush = () => {
    if (!cluster.length) return;
    const cols: (typeof cluster[number] | null)[] = [];
    const assignments: number[] = [];
    for (const b of cluster) {
      let placed = -1;
      for (let i = 0; i < cols.length; i++) {
        const other = cols[i];
        if (!other || other.end <= b.slot) {
          cols[i] = b;
          placed = i;
          break;
        }
      }
      if (placed === -1) {
        cols.push(b);
        placed = cols.length - 1;
      }
      assignments.push(placed);
    }
    const totalCols = cols.length;
    cluster.forEach((b, i) =>
      result.push({
        task: b.task,
        slot: b.slot,
        slots: b.slots,
        col: assignments[i],
        cols: totalCols,
      }),
    );
    cluster = [];
  };
  let clusterEnd = -1;
  for (const b of sorted) {
    const end = b.slot + b.slots;
    if (b.slot >= clusterEnd) flush();
    cluster.push({ ...b, end });
    clusterEnd = Math.max(clusterEnd, end);
  }
  flush();
  return result;
}
