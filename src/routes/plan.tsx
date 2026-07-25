import { useEffect, useMemo, useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { ChevronLeft, ChevronRight, Sparkles, X, RotateCcw } from "lucide-react";
import { useTasks } from "@/hooks/use-tasks";
import { useContextState } from "@/hooks/use-context-state";
import { usePlanState } from "@/lib/tasks/plan-store";
import { autoSchedule, minutesToISO } from "@/lib/tasks/auto-schedule";
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
import { PlanRitual } from "@/components/tasks/PlanRitual";
import { taskDialogStore } from "@/lib/tasks/dialog-store";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/plan")({
  head: () => ({
    meta: [
      { title: "Plan your day — Shenas" },
      { name: "description", content: "Guided daily planning ritual and time-blocked day view." },
      { property: "og:title", content: "Plan your day — Shenas" },
      { property: "og:description", content: "Guided daily planning ritual and time-blocked day view." },
    ],
  }),
  component: PlanPage,
});

const HOUR_START = 6;
const HOUR_END = 23;
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

function formatMin(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

type ViewMode = "day" | "week";

function PlanPage() {
  const { tasks, hydrated, updateTask, setStatus, bulkUpdate } = useTasks();
  const { stored } = useContextState();
  const { hydrated: planHydrated, isPlanned, markPlanned } = usePlanState();
  const [day, setDay] = useState(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  });
  const [view, setView] = useState<ViewMode>("day");
  const [ritualOpen, setRitualOpen] = useState(false);
  const [ritualDismissedThisSession, setRitualDismissedThisSession] = useState(false);

  const todayKey = dateKey(new Date());
  const dayIsToday = dateKey(day) === todayKey;
  const key = dateKey(day);

  // Auto-open ritual once, when the day is today and not yet planned.
  useEffect(() => {
    if (!hydrated || !planHydrated) return;
    if (!dayIsToday) return;
    if (ritualDismissedThisSession) return;
    if (!isPlanned(todayKey)) setRitualOpen(true);
  }, [hydrated, planHydrated, dayIsToday, isPlanned, todayKey, ritualDismissedThisSession]);

  // Route keybindings: [ ] T R
  useEffect(() => {
    const on = (e: Event) => {
      const detail = (e as CustomEvent<string>).detail;
      if (detail === "prev-period") shiftDay(-1);
      else if (detail === "next-period") shiftDay(1);
      else if (detail === "today") {
        const d = new Date();
        d.setHours(0, 0, 0, 0);
        setDay(d);
      } else if (detail === "replan") setRitualOpen(true);
    };
    window.addEventListener("shenas:key", on);
    return () => window.removeEventListener("shenas:key", on);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [day]);

  const { scheduled, needsSlot, unscheduled } = useMemo(() => {
    const scheduled: { task: Task; slot: number; slots: number }[] = [];
    const needsSlot: Task[] = [];
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
      // Unscheduled bucket for this day: myDay pinned OR due here OR undue
      const pinnedHere = t.myDay === key;
      const dueHere = t.due === key;
      if (!t.scheduledStart) {
        if (pinnedHere || dueHere) {
          needsSlot.push(t);
        } else if (!t.due) {
          unscheduled.push(t);
        }
      }
    }
    scheduled.sort((a, b) => a.slot - b.slot);
    const byTitle = (a: Task, b: Task) => a.title.localeCompare(b.title);
    needsSlot.sort(byTitle);
    unscheduled.sort(byTitle);
    return { scheduled, needsSlot, unscheduled };
  }, [tasks, day, key]);

  const scheduledMin = scheduled.reduce(
    (n, s) => n + (s.task.scheduledDuration ?? 30),
    0,
  );
  const workWindowMin = (stored.schedule.end - stored.schedule.start) * 60;
  const overCapacity = scheduledMin > workWindowMin;

  const shiftDay = (delta: number) => {
    const d = new Date(day);
    d.setDate(d.getDate() + delta * (view === "week" ? 7 : 1));
    setDay(d);
  };

  if (!hydrated || !planHydrated) return null;

  const dayLabel = day.toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  const unschedule = (id: string) => {
    updateTask(id, { scheduledStart: undefined });
  };

  const setDuration = (id: string, minutes: number) => {
    updateTask(id, { scheduledDuration: minutes });
  };

  const runAutoScheduleForDay = () => {
    const candidates = [...needsSlot];
    const busy = scheduled.map((s) => {
      const start = s.slot * SLOT_MIN + HOUR_START * 60;
      return { startMin: start, endMin: start + (s.task.scheduledDuration ?? 30) };
    });
    const { assignments } = autoSchedule(candidates, stored.schedule, busy);
    const patches: Record<string, Partial<Task>> = {};
    for (const [id, a] of Object.entries(assignments)) {
      patches[id] = {
        scheduledStart: minutesToISO(day, a.startMin),
        scheduledDuration: a.duration,
        myDay: key,
        due: key,
      };
    }
    if (Object.keys(patches).length) bulkUpdate(patches);
  };

  return (
    <div className="mx-auto max-w-6xl px-4 py-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-semibold tracking-tight">{dayLabel}</h1>
            {dayIsToday && isPlanned(todayKey) && (
              <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">
                Planned
              </span>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            {scheduled.length} block{scheduled.length === 1 ? "" : "s"} ·{" "}
            <span className={overCapacity ? "text-amber-600 dark:text-amber-400" : ""}>
              {formatMin(scheduledMin)} scheduled / {formatMin(workWindowMin)} available
            </span>
            {needsSlot.length > 0 && (
              <> · {needsSlot.length} needs a slot</>
            )}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex rounded-md border p-0.5 text-xs">
            <button
              onClick={() => setView("day")}
              className={cn(
                "rounded px-2 py-0.5",
                view === "day" && "bg-primary text-primary-foreground",
              )}
            >
              Day
            </button>
            <button
              onClick={() => setView("week")}
              className={cn(
                "rounded px-2 py-0.5",
                view === "week" && "bg-primary text-primary-foreground",
              )}
            >
              Week
            </button>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setRitualOpen(true)}
            title="Re-run planning ritual (R)"
          >
            <RotateCcw className="mr-1 h-3.5 w-3.5" /> Re-plan
          </Button>
          <Button
            size="sm"
            onClick={runAutoScheduleForDay}
            disabled={needsSlot.length === 0}
            title="Pack unscheduled picks into free slots"
          >
            <Sparkles className="mr-1 h-3.5 w-3.5" /> Auto-schedule
          </Button>
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
      </div>

      {view === "day" ? (
        <DayView
          day={day}
          scheduled={scheduled}
          needsSlot={needsSlot}
          unscheduled={unscheduled}
          onUpdateTask={updateTask}
          onSetStatus={setStatus}
          onUnschedule={unschedule}
          onSetDuration={setDuration}
          tasks={tasks}
          dayKey={key}
        />
      ) : (
        <WeekView day={day} tasks={tasks} onSelectDay={setDay} />
      )}

      <PlanRitual
        open={ritualOpen}
        onOpenChange={(v) => {
          setRitualOpen(v);
          if (!v) setRitualDismissedThisSession(true);
        }}
        tasks={tasks}
        today={day}
        todayKey={key}
        onBulkUpdate={bulkUpdate}
        onSetStatus={setStatus}
        onComplete={() => markPlanned(key, true)}
      />
    </div>
  );
}

/* -------- Day view -------- */

function DayView({
  day,
  dayKey,
  scheduled,
  needsSlot,
  unscheduled,
  onUpdateTask,
  onSetStatus,
  onUnschedule,
  onSetDuration,
  tasks,
}: {
  day: Date;
  dayKey: string;
  scheduled: { task: Task; slot: number; slots: number }[];
  needsSlot: Task[];
  unscheduled: Task[];
  onUpdateTask: (id: string, patch: Partial<Task>) => void;
  onSetStatus: (id: string, s: Task["status"]) => void;
  onUnschedule: (id: string) => void;
  onSetDuration: (id: string, m: number) => void;
  tasks: Task[];
}) {
  const gridRef = useRef<HTMLDivElement>(null);
  const [dragOverSlot, setDragOverSlot] = useState<number | null>(null);
  const [resizing, setResizing] = useState<{
    id: string;
    startSlot: number;
    startY: number;
    origSlots: number;
    curSlots: number;
  } | null>(null);

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
    onUpdateTask(id, {
      scheduledStart: slotToISO(day, slot),
      scheduledDuration: tasks.find((t) => t.id === id)?.scheduledDuration ?? 30,
      due: dayKey,
      myDay: dayKey,
    });
  };

  // Resize handle listeners
  useEffect(() => {
    if (!resizing) return;
    const onMove = (e: MouseEvent) => {
      const dy = e.clientY - resizing.startY;
      const deltaSlots = Math.round(dy / SLOT_PX);
      const cur = Math.max(1, resizing.origSlots + deltaSlots);
      setResizing((r) => (r ? { ...r, curSlots: cur } : r));
    };
    const onUp = () => {
      if (resizing) {
        const minutes = resizing.curSlots * SLOT_MIN;
        onSetDuration(resizing.id, minutes);
      }
      setResizing(null);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [resizing, onSetDuration]);

  const laidOut = layoutBlocks(scheduled);
  const now = new Date();
  const nowLineTop =
    dateKey(now) === dayKey
      ? ((now.getHours() - HOUR_START) * 60 + now.getMinutes()) *
        (SLOT_PX / SLOT_MIN)
      : null;

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-[280px_1fr]">
      <aside
        className="space-y-3"
        onDragOver={(e) => {
          if (e.dataTransfer.types.includes("text/task-id")) e.preventDefault();
        }}
        onDrop={(e) => {
          e.preventDefault();
          const id = e.dataTransfer.getData("text/task-id");
          if (id) onUnschedule(id);
        }}
      >
        <SidebarSection
          label={`Needs a slot (${needsSlot.length})`}
          accent
          empty="Everything picked has a time."
          tasks={needsSlot}
        />
        <SidebarSection
          label={`Unscheduled (${unscheduled.length})`}
          empty="Drop scheduled blocks here to unschedule."
          tasks={unscheduled}
        />
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

          {nowLineTop != null && (
            <div
              className="pointer-events-none absolute left-0 right-0 z-10 flex items-center"
              style={{ top: nowLineTop }}
            >
              <div className="h-2 w-2 rounded-full bg-red-500" />
              <div className="h-px flex-1 bg-red-500" />
            </div>
          )}

          {laidOut.map(({ task, slot, slots, col, cols }) => {
            const effectiveSlots =
              resizing?.id === task.id ? resizing.curSlots : slots;
            const left = `calc(3rem + ${(col / cols) * 100}% - ${(col / cols) * 3}rem)`;
            const width = `calc(${(1 / cols) * 100}% - ${(1 / cols) * 3}rem - 4px)`;
            return (
              <div
                key={task.id}
                draggable={!resizing}
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
                  height: effectiveSlots * SLOT_PX - 2,
                  left,
                  width,
                }}
              >
                <div className="flex items-start justify-between gap-1">
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-medium">{task.title}</div>
                    <div className="text-[10px] text-muted-foreground">
                      {formatTime(task.scheduledStart!)} ·{" "}
                      {effectiveSlots * SLOT_MIN}m
                    </div>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onUnschedule(task.id);
                    }}
                    className="rounded p-0.5 text-muted-foreground opacity-0 hover:bg-background hover:text-foreground group-hover:opacity-100"
                    aria-label="Unschedule"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
                {effectiveSlots >= 2 && (
                  <div
                    className="mt-1 flex flex-wrap items-center gap-1"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <Select
                      value={String(task.scheduledDuration ?? 30)}
                      onValueChange={(v) => onSetDuration(task.id, Number(v))}
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
                        onSetStatus(
                          task.id,
                          task.status === "doing" ? "todo" : "doing",
                        )
                      }
                      className="rounded border px-1.5 py-0.5 text-[10px] hover:bg-background"
                    >
                      {task.status === "doing" ? "Pause" : "Start"}
                    </button>
                    <button
                      onClick={() => onSetStatus(task.id, "done")}
                      className="rounded border px-1.5 py-0.5 text-[10px] hover:bg-background"
                    >
                      Done
                    </button>
                  </div>
                )}
                {/* Resize handle */}
                <div
                  onMouseDown={(e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    setResizing({
                      id: task.id,
                      startSlot: slot,
                      startY: e.clientY,
                      origSlots: slots,
                      curSlots: slots,
                    });
                  }}
                  className="absolute bottom-0 left-0 right-0 h-1.5 cursor-ns-resize opacity-0 hover:bg-primary/30 group-hover:opacity-100"
                  aria-label="Resize"
                />
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function SidebarSection({
  label,
  tasks,
  empty,
  accent,
}: {
  label: string;
  tasks: Task[];
  empty: string;
  accent?: boolean;
}) {
  return (
    <div
      className={cn(
        "rounded-lg border bg-card p-3",
        accent && "border-primary/30 bg-primary/5",
      )}
    >
      <div className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
      <div className="space-y-1.5">
        {tasks.length === 0 && (
          <div className="rounded-md border border-dashed p-2 text-xs text-muted-foreground">
            {empty}
          </div>
        )}
        {tasks.map((t) => (
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
              {t.scheduledDuration && (
                <span className="text-[10px] text-muted-foreground">
                  {t.scheduledDuration}m
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* -------- Week view -------- */

function WeekView({
  day,
  tasks,
  onSelectDay,
}: {
  day: Date;
  tasks: Task[];
  onSelectDay: (d: Date) => void;
}) {
  // Start on Monday of the week containing `day`
  const start = useMemo(() => {
    const d = new Date(day);
    const dow = (d.getDay() + 6) % 7; // Mon = 0
    d.setDate(d.getDate() - dow);
    d.setHours(0, 0, 0, 0);
    return d;
  }, [day]);

  const days = useMemo(
    () =>
      Array.from({ length: 7 }, (_, i) => {
        const d = new Date(start);
        d.setDate(start.getDate() + i);
        return d;
      }),
    [start],
  );

  const blocksByDay = useMemo(() => {
    const map = new Map<string, { task: Task; slot: number; slots: number }[]>();
    for (const t of tasks) {
      if (!t.scheduledStart || t.status === "done") continue;
      const dk = dateKey(new Date(t.scheduledStart));
      const dDate = days.find((d) => dateKey(d) === dk);
      if (!dDate) continue;
      const slot = isoToSlot(t.scheduledStart, dDate);
      if (slot == null) continue;
      const dur = Math.max(SLOT_MIN, t.scheduledDuration ?? 30);
      const slots = Math.max(1, Math.round(dur / SLOT_MIN));
      const list = map.get(dk) ?? [];
      list.push({ task: t, slot, slots });
      map.set(dk, list);
    }
    return map;
  }, [tasks, days]);

  const now = new Date();
  const todayK = dateKey(now);

  return (
    <div className="rounded-lg border bg-card">
      <div className="grid grid-cols-[3rem_repeat(7,1fr)] border-b bg-muted/30 text-xs">
        <div />
        {days.map((d) => {
          const isToday = dateKey(d) === todayK;
          return (
            <button
              key={d.toISOString()}
              onClick={() => onSelectDay(d)}
              className={cn(
                "border-l px-2 py-2 text-left hover:bg-accent",
                isToday && "text-primary",
              )}
            >
              <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
                {d.toLocaleDateString(undefined, { weekday: "short" })}
              </div>
              <div className="text-sm font-medium">{d.getDate()}</div>
            </button>
          );
        })}
      </div>
      <div className="relative" style={{ height: TOTAL_SLOTS * SLOT_PX }}>
        {/* hour lines */}
        {Array.from({ length: TOTAL_SLOTS }).map((_, i) => {
          const hour = HOUR_START + Math.floor(i / SLOTS_PER_HOUR);
          const isHour = i % SLOTS_PER_HOUR === 0;
          return (
            <div
              key={i}
              className={cn(
                "absolute left-0 right-0 border-t",
                isHour ? "border-border" : "border-border/40",
              )}
              style={{ top: i * SLOT_PX, height: SLOT_PX }}
            >
              {isHour && (
                <span className="absolute -top-2 left-1 bg-card px-1 text-[10px] text-muted-foreground">
                  {formatHour(hour)}
                </span>
              )}
            </div>
          );
        })}
        {/* day columns */}
        <div className="grid h-full grid-cols-[3rem_repeat(7,1fr)]">
          <div />
          {days.map((d, di) => {
            const dk = dateKey(d);
            const blocks = blocksByDay.get(dk) ?? [];
            const laid = layoutBlocks(blocks);
            return (
              <div
                key={di}
                className="relative border-l"
                onClick={() => onSelectDay(d)}
              >
                {laid.map(({ task, slot, slots, col, cols }) => (
                  <div
                    key={task.id}
                    onClick={(e) => {
                      e.stopPropagation();
                      taskDialogStore.openEdit(task);
                    }}
                    className={cn(
                      "absolute overflow-hidden rounded border p-1 text-[10px] leading-tight",
                      task.status === "doing"
                        ? "border-primary/60 bg-primary/20"
                        : "border-primary/30 bg-primary/10",
                    )}
                    style={{
                      top: slot * SLOT_PX + 1,
                      height: slots * SLOT_PX - 2,
                      left: `${(col / cols) * 100}%`,
                      width: `calc(${(1 / cols) * 100}% - 2px)`,
                    }}
                    title={task.title}
                  >
                    <div className="truncate font-medium">{task.title}</div>
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/* -------- helpers -------- */

function formatHour(h: number): string {
  const d = new Date();
  d.setHours(h, 0, 0, 0);
  return d.toLocaleTimeString(undefined, { hour: "numeric" });
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
