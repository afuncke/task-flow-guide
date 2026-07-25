import { useEffect, useMemo, useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { ChevronLeft, ChevronRight, Sparkles, X, RotateCcw, Heart, Repeat, Sunset, CalendarClock } from "lucide-react";
import { useTasks } from "@/hooks/use-tasks";
import { AreaRadar } from "@/components/tasks/AreaRadar";
import { useContextState } from "@/hooks/use-context-state";
import { useAreas } from "@/hooks/use-areas";
import { usePlanState } from "@/lib/tasks/plan-store";
import { autoSchedule, minutesToISO, type BusyRange } from "@/lib/tasks/auto-schedule";
import { estimateInsight, estimateNote } from "@/lib/tasks/estimates";
import { dayBudget, areaSplit, untouchedAreas, formatMinutes } from "@/lib/tasks/day-budget";
import { CapacityMeter } from "@/components/tasks/CapacityMeter";
import { AreaBalance } from "@/components/tasks/AreaBalance";
import { ShutdownRitual } from "@/components/tasks/ShutdownRitual";
import { EventDialog } from "@/components/tasks/EventDialog";
import {
  useEvents,
  eventsOn,
  eventBusyRanges,
  eventMinutesInWindow,
  type CalEvent,
} from "@/lib/tasks/events";
import { phaseAt } from "@/lib/time-of-day";
import { forecastDeadlines } from "@/lib/tasks/forecast";
import { DeadlineForecast } from "@/components/tasks/DeadlineForecast";
import { toast } from "@/lib/playful/celebrate";


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
import { SoftLandingWizard } from "@/components/tasks/SoftLandingWizard";
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

export interface DayBlock {
  key: string;
  task: Task;
  slot: number;
  slots: number;
  partIndex: number;
  partTotal: number;
}

/** Every block a task occupies: the first chunk plus any extra sessions. */
export function taskBlocks(t: Task): { start: string; duration: number }[] {
  const out: { start: string; duration: number }[] = [];
  if (t.scheduledStart) {
    out.push({ start: t.scheduledStart, duration: t.scheduledDuration ?? 30 });
  }
  for (const s of t.sessions ?? []) out.push(s);
  return out.sort((a, b) => a.start.localeCompare(b.start));
}

function PlanPage() {
  const { tasks, allTasks, hydrated, updateTask, setStatus, bulkUpdate } = useTasks();
  const { stored } = useContextState();
  const { areas } = useAreas();
  const {
    hydrated: planHydrated,
    isPlanned,
    markPlanned,
    isShutdown,
    markShutdown,
    autoReplan,
    setAutoReplan,
  } = usePlanState();
  const [day, setDay] = useState(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  });
  const [view, setView] = useState<ViewMode>("day");
  const [ritualOpen, setRitualOpen] = useState(false);
  const [ritualDismissedThisSession, setRitualDismissedThisSession] = useState(false);
  const [softLandingOpen, setSoftLandingOpen] = useState(false);
  const [shutdownOpen, setShutdownOpen] = useState(false);
  const [eventOpen, setEventOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<CalEvent | null>(null);
  const [eventStartMin, setEventStartMin] = useState(9 * 60);

  const { events, addEvent, updateEvent, removeEvent } = useEvents();

  const todayKey = dateKey(new Date());
  const dayIsToday = dateKey(day) === todayKey;
  const key = dateKey(day);

  const dayEvents = useMemo(() => eventsOn(events, key), [events, key]);
  const eventBusy = useMemo(() => eventBusyRanges(events, key), [events, key]);
  const eventMinutes = useMemo(
    () =>
      eventMinutesInWindow(
        events,
        key,
        stored.schedule,
        dayIsToday ? new Date().getHours() * 60 + new Date().getMinutes() : undefined,
      ),
    [events, key, stored.schedule, dayIsToday],
  );

  const openNewEvent = (startMin = 9 * 60) => {
    setEditingEvent(null);
    setEventStartMin(startMin);
    setEventOpen(true);
  };
  const openEditEvent = (ev: CalEvent) => {
    setEditingEvent(ev);
    setEventOpen(true);
  };


  // How long things really take, learned from finished work.
  const insight = useMemo(() => estimateInsight(allTasks), [allTasks]);

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
      else if (detail === "soft-landing") setSoftLandingOpen(true);
      else if (detail === "shutdown") setShutdownOpen(true);
      else if (detail === "new-event") {
        const now = new Date();
        openNewEvent(
          dateKey(now) === dateKey(day)
            ? Math.round((now.getHours() * 60 + now.getMinutes()) / 15) * 15
            : 9 * 60,
        );
      }


    };
    window.addEventListener("shenas:key", on);
    return () => window.removeEventListener("shenas:key", on);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [day]);

  const { scheduled, needsSlot, unscheduled } = useMemo(() => {
    const scheduled: DayBlock[] = [];
    const needsSlot: Task[] = [];
    const unscheduled: Task[] = [];
    for (const t of tasks) {
      if (t.status === "done") continue;
      const blocks = taskBlocks(t);
      if (blocks.length > 0) {
        let added = false;
        blocks.forEach((b, i) => {
          const slot = isoToSlot(b.start, day);
          if (slot == null) return;
          const dur = Math.max(SLOT_MIN, b.duration);
          scheduled.push({
            key: `${t.id}#${i}`,
            task: t,
            slot,
            slots: Math.max(1, Math.round(dur / SLOT_MIN)),
            partIndex: i,
            partTotal: blocks.length,
          });
          added = true;
        });
        if (added) continue;
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

  const scheduledMin = scheduled.reduce((n, s) => n + s.slots * SLOT_MIN, 0);
  const workWindowMin =
    (stored.schedule.end - stored.schedule.start) * 60 -
    eventMinutesInWindow(events, key, stored.schedule);
  const overCapacity = scheduledMin > workWindowMin;

  /* --- Live capacity budget + area balance for what's committed today --- */
  const committedTasks = useMemo(() => {
    const seen = new Map<string, Task>();
    for (const s of scheduled) if (!seen.has(s.task.id)) seen.set(s.task.id, s.task);
    for (const t of needsSlot) if (!seen.has(t.id)) seen.set(t.id, t);
    return [...seen.values()].filter((t) => t.status !== "done");
  }, [scheduled, needsSlot]);

  const budget = useMemo(
    () =>
      dayBudget(committedTasks, stored.schedule, {
        factor: insight.factor,
        isToday: dayIsToday,
        busyMinutes: eventMinutes,
      }),
    [committedTasks, stored.schedule, insight.factor, dayIsToday, eventMinutes],
  );


  const split = useMemo(
    () => areaSplit(committedTasks, allTasks, areas, insight.factor),
    [committedTasks, allTasks, areas, insight.factor],
  );

  const untouched = useMemo(
    () => untouchedAreas(split, areas, allTasks),
    [split, areas, allTasks],
  );

  const isEvening = dayIsToday && ["evening", "night"].includes(phaseAt());
  const dayClosed = dayIsToday && isShutdown(todayKey);


  const overdue = useMemo(
    () =>
      tasks
        .filter((t) => t.status !== "done" && t.due && t.due < todayKey)
        .sort((a, b) => (a.due ?? "").localeCompare(b.due ?? "")),
    [tasks, todayKey],
  );

  // Deadline vs. scheduled time: warn while there's still room to choose.
  const risk = useMemo(
    () =>
      forecastDeadlines(tasks, stored.schedule, { factor: insight.factor })[0] ?? null,
    [tasks, stored.schedule, insight.factor],
  );

  const shiftDay = (delta: number) => {
    const d = new Date(day);
    d.setDate(d.getDate() + delta * (view === "week" ? 7 : 1));
    setDay(d);
  };

  const packDay = (
    candidates: Task[],
    busy: BusyRange[],
    targetDay: Date,
    targetKey: string,
    label: string,
    earliestMin?: number,
  ): number => {
    if (candidates.length === 0) return 0;
    const { blocks } = autoSchedule(candidates, stored.schedule, busy, {
      factor: insight.factor,
      earliestMin,
    });
    const patches: Record<string, Partial<Task>> = {};
    for (const [id, list] of Object.entries(blocks)) {
      if (!list.length) continue;
      patches[id] = {
        scheduledStart: minutesToISO(targetDay, list[0].startMin),
        scheduledDuration: list[0].duration,
        sessions: list
          .slice(1)
          .map((b) => ({ start: minutesToISO(targetDay, b.startMin), duration: b.duration })),
        myDay: targetKey,
        due: targetKey,
      };
    }
    const n = Object.keys(patches).length;
    if (n) bulkUpdate(patches, label);
    return n;
  };

  const runAutoScheduleForDay = () => {
    const busy = scheduled.map((s) => {
      const start = s.slot * SLOT_MIN + HOUR_START * 60;
      return { startMin: start, endMin: start + s.slots * SLOT_MIN };
    });
    // Meetings hold their ground — tasks pack around them.
    packDay([...needsSlot], [...busy, ...eventBusy], day, key, "Auto-scheduled the day");
  };


  /**
   * Continuous reschedule — the plan keeps itself true.
   *
   * When something new lands on today, or a block slips into the past
   * unfinished, the day quietly re-packs from now onward. Always undoable,
   * never accusing.
   */
  const lastReplan = useRef<string>("");
  useEffect(() => {
    if (!hydrated || !planHydrated) return;
    if (!autoReplan || !dayIsToday) return;

    const timer = window.setTimeout(() => {
      const now = new Date();
      const nowMin = now.getHours() * 60 + now.getMinutes();
      if (nowMin >= stored.schedule.end * 60) return;

      const stale: Task[] = [];
      const busyEvents = eventBusyRanges(events, todayKey);
      const busy: BusyRange[] = [...busyEvents];
      const fresh: Task[] = [];



      for (const t of tasks) {
        if (t.status === "done") continue;
        const blocks = taskBlocks(t).filter(
          (b) => dateKey(new Date(b.start)) === todayKey,
        );
        if (blocks.length === 0) {
          if (!t.scheduledStart && (t.myDay === todayKey || t.due === todayKey)) {
            fresh.push(t);
          }
          continue;
        }
        const ends = blocks.map(
          (b) => new Date(b.start).getTime() + b.duration * 60_000,
        );
        const allPast = ends.every((e) => e <= now.getTime());
        // A block that a meeting now sits on top of has to move.
        const clashes = blocks.some((b) => {
          const s = new Date(b.start);
          const startMin = s.getHours() * 60 + s.getMinutes();
          const endMin = startMin + b.duration;
          return (
            endMin > nowMin &&
            busyEvents.some((ev) => startMin < ev.endMin && endMin > ev.startMin)
          );
        });
        if ((allPast && t.status !== "doing") || (clashes && t.status !== "doing")) {
          stale.push(t);
        } else {
          for (const b of blocks) {
            const s = new Date(b.start);
            const startMin = s.getHours() * 60 + s.getMinutes();
            busy.push({ startMin, endMin: startMin + b.duration });
          }
        }
      }

      const candidates = [...fresh, ...stale];
      if (candidates.length === 0) return;

      const signature = [
        ...candidates.map(
          (t) => `${t.id}:${t.scheduledStart ?? "-"}:${t.scheduledDuration ?? 0}`,
        ),
        ...busyEvents.map((b) => `e:${b.startMin}-${b.endMin}`),
      ]
        .sort()
        .join("|");
      if (signature === lastReplan.current) return;
      lastReplan.current = signature;

      const moved = packDay(
        candidates,
        busy,
        day,
        todayKey,
        "Plan updated",
        nowMin,
      );
      if (moved > 0) {
        toast(
          stale.length > 0
            ? "Plan updated — blocks moved around what's fixed · u to undo"
            : "Plan updated · u to undo",
        );
      }
    }, 700);

    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tasks, events, autoReplan, dayIsToday, hydrated, planHydrated, todayKey, insight.factor]);


  if (!hydrated || !planHydrated) return null;

  const dayLabel = day.toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  const unschedule = (id: string) => {
    updateTask(id, { scheduledStart: undefined, sessions: undefined });
  };

  const setDuration = (id: string, minutes: number) => {
    updateTask(id, { scheduledDuration: minutes });
  };

  const removeBlock = (task: Task, partIndex: number) => {
    if (partIndex === 0) {
      unschedule(task.id);
      return;
    }
    const blocks = taskBlocks(task);
    const kept = blocks.filter((_, i) => i !== partIndex);
    updateTask(task.id, {
      scheduledStart: kept[0]?.start,
      scheduledDuration: kept[0]?.duration ?? task.scheduledDuration,
      sessions: kept.slice(1),
    });
  };

  const easeDeadline = (id: string) => {
    const t = tasks.find((x) => x.id === id);
    if (!t?.due) return;
    const d = new Date(`${t.due}T00:00:00`);
    do {
      d.setDate(d.getDate() + 1);
    } while (!stored.schedule.days.includes(d.getDay()));
    updateTask(
      id,
      {
        due: dateKey(d),
        scheduledStart: undefined,
        sessions: undefined,
        rescheduleCount: (t.rescheduleCount ?? 0) + 1,
      },
      `Gave "${t.title.slice(0, 24)}" more room`,
    );
  };


  return (
    <div className="mx-auto max-w-6xl px-4 py-6">
      <AreaRadar />
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-semibold tracking-tight">{dayLabel}</h1>
            {dayIsToday && isPlanned(todayKey) && (
              <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">
                Planned
              </span>
            )}
            {dayClosed && (
              <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                Closed
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
            {dayEvents.length > 0 && (
              <>
                {" "}
                · {dayEvents.length} commitment{dayEvents.length === 1 ? "" : "s"} taking{" "}
                {formatMinutes(
                  eventMinutesInWindow(events, key, stored.schedule),
                )}
              </>
            )}
          </p>

          {estimateNote(insight) && (
            <p className="mt-0.5 text-[11px] text-muted-foreground/80">
              {estimateNote(insight)}
            </p>
          )}
          {committedTasks.length > 0 && (
            <div className="mt-2 max-w-md space-y-2">
              <CapacityMeter budget={budget} />
              <AreaBalance split={split} untouched={untouched} />
            </div>
          )}
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
            variant={autoReplan ? "secondary" : "outline"}
            size="sm"
            onClick={() => setAutoReplan(!autoReplan)}
            title={
              autoReplan
                ? "The day re-packs itself as things change. Click to keep it fixed."
                : "Let the day re-pack itself as things change."
            }
          >
            <Repeat className="mr-1 h-3.5 w-3.5" />
            {autoReplan ? "Keeps itself current" : "Fixed plan"}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setRitualOpen(true)}
            title="Re-run planning ritual (R)"
          >
            <RotateCcw className="mr-1 h-3.5 w-3.5" /> Re-plan
          </Button>
          {dayIsToday && (
            <Button
              variant={isEvening && !dayClosed ? "default" : "outline"}
              size="sm"
              onClick={() => setShutdownOpen(true)}
              title="Close the day (E)"
              className={cn(!isEvening && !dayClosed && "opacity-70")}
            >
              <Sunset className="mr-1 h-3.5 w-3.5" />
              {dayClosed ? "Day closed" : "Close the day"}
            </Button>
          )}

          {overdue.length > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSoftLandingOpen(true)}
              title="Soft landing for overdue tasks (L)"
              className="border-rose-500/40 text-rose-600 hover:bg-rose-500/10 hover:text-rose-700 dark:text-rose-400 dark:hover:text-rose-300"
            >
              <Heart className="mr-1 h-3.5 w-3.5" /> Soft landing
              <span className="ml-1 rounded-full bg-rose-500/15 px-1.5 text-[10px]">
                {overdue.length}
              </span>
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={() => openNewEvent()}
            title="Add a meeting or appointment (m)"
          >
            <CalendarClock className="mr-1 h-3.5 w-3.5" /> Commitment
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

      {dayIsToday && (
        <DeadlineForecast
          risk={risk}
          todayKey={todayKey}
          tasks={tasks}
          onEase={easeDeadline}
        />
      )}

      {view === "day" ? (
        <DayView
          day={day}
          scheduled={scheduled}
          needsSlot={needsSlot}
          unscheduled={unscheduled}
          onUpdateTask={updateTask}
          onSetStatus={setStatus}
          onUnschedule={unschedule}
          onRemoveBlock={removeBlock}
          onSetDuration={setDuration}
          tasks={tasks}
          dayKey={key}
          events={dayEvents}
          onEditEvent={openEditEvent}
          onNewEventAt={openNewEvent}
        />
      ) : (
        <WeekView day={day} tasks={tasks} onSelectDay={setDay} />
      )}

      <EventDialog
        open={eventOpen}
        onOpenChange={setEventOpen}
        dateKey={key}
        event={editingEvent}
        defaultStartMin={eventStartMin}
        onSave={(data) => {
          if (editingEvent) updateEvent(editingEvent.id, data);
          else addEvent(data);
        }}
        onDelete={removeEvent}
      />


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

      <SoftLandingWizard
        open={softLandingOpen}
        onOpenChange={setSoftLandingOpen}
        overdue={overdue}
        todayKey={todayKey}
        onReschedule={(id, newDue) => {
          const t = tasks.find((x) => x.id === id);
          const rc = (t?.rescheduleCount ?? 0) + 1;
          updateTask(id, { due: newDue, rescheduleCount: rc, scheduledStart: undefined });
        }}
        onShrink={(id, patch) => updateTask(id, patch)}
        onArchive={(id) =>
          updateTask(id, { archived: true, archivedAt: new Date().toISOString() })
        }
      />

      <ShutdownRitual
        open={shutdownOpen}
        onOpenChange={setShutdownOpen}
        tasks={allTasks}
        todayKey={todayKey}
        onBulkUpdate={bulkUpdate}
        onArchive={(id) =>
          updateTask(id, { archived: true, archivedAt: new Date().toISOString() })
        }
        onComplete={() => markShutdown(todayKey, true)}
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
  onRemoveBlock,
  onSetDuration,
  tasks,
  events,
  onEditEvent,
  onNewEventAt,
}: {
  day: Date;
  dayKey: string;
  scheduled: DayBlock[];
  needsSlot: Task[];
  unscheduled: Task[];
  onUpdateTask: (id: string, patch: Partial<Task>) => void;
  onSetStatus: (id: string, s: Task["status"]) => void;
  onUnschedule: (id: string) => void;
  onRemoveBlock: (task: Task, partIndex: number) => void;
  onSetDuration: (id: string, m: number) => void;
  tasks: Task[];
  events: CalEvent[];
  onEditEvent: (e: CalEvent) => void;
  onNewEventAt: (startMin: number) => void;
}) {

  const gridRef = useRef<HTMLDivElement>(null);
  const [dragOverSlot, setDragOverSlot] = useState<number | null>(null);
  const [resizing, setResizing] = useState<{
    id: string;
    taskId: string;
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
    const task = tasks.find((t) => t.id === id);
    const nextStart = slotToISO(day, slot);
    // Keep any extra chunks in step with the block being moved.
    let sessions = task?.sessions;
    if (task?.scheduledStart && sessions?.length) {
      const delta = new Date(nextStart).getTime() - new Date(task.scheduledStart).getTime();
      sessions = sessions.map((b) => ({
        ...b,
        start: new Date(new Date(b.start).getTime() + delta).toISOString(),
      }));
    }
    onUpdateTask(id, {
      scheduledStart: nextStart,
      scheduledDuration: task?.scheduledDuration ?? 30,
      sessions,
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
        onSetDuration(resizing.taskId, minutes);
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
                onDoubleClick={() => onNewEventAt(HOUR_START * 60 + i * SLOT_MIN)}
                title="Double-click to add a commitment"
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

          {/* Commitments: time already spoken for. Tasks pack around them. */}
          {events.map((ev) => {
            const top = ((ev.startMin - HOUR_START * 60) / SLOT_MIN) * SLOT_PX;
            const height = Math.max(SLOT_PX, (ev.duration / SLOT_MIN) * SLOT_PX);
            if (top + height < 0 || top > TOTAL_SLOTS * SLOT_PX) return null;
            return (
              <button
                key={ev.id}
                onClick={() => onEditEvent(ev)}
                className={cn(
                  "absolute left-12 right-1 overflow-hidden rounded-md border px-2 py-1 text-left text-xs",
                  ev.soft
                    ? "border-dashed border-muted-foreground/40 bg-muted/40 text-muted-foreground"
                    : "border-muted-foreground/30 bg-muted text-foreground/80",
                )}
                style={{
                  top: Math.max(0, top) + 1,
                  height: height - 2,
                  backgroundImage: ev.soft
                    ? undefined
                    : "repeating-linear-gradient(135deg, hsl(var(--muted-foreground)/0.07) 0 6px, transparent 6px 12px)",
                }}
              >
                <span className="block truncate font-medium">{ev.title}</span>
                <span className="block text-[10px] opacity-70">
                  {clockLabel(ev.startMin)} · {ev.duration}m{ev.soft ? " · flexible" : ""}
                </span>
              </button>
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

          {laidOut.map(({ task, slot, slots, col, cols, key: blockKey, partIndex, partTotal }) => {
            const isLead = partIndex === 0;
            const chunked = partTotal > 1;
            const effectiveSlots =
              resizing?.id === blockKey ? resizing.curSlots : slots;
            const left = `calc(3rem + ${(col / cols) * 100}% - ${(col / cols) * 3}rem)`;
            const width = `calc(${(1 / cols) * 100}% - ${(1 / cols) * 3}rem - 4px)`;
            return (
              <div
                key={blockKey}
                draggable={isLead && !resizing}
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
                      {formatTime(taskBlocks(task)[partIndex]?.start ?? task.scheduledStart!)} ·{" "}
                      {effectiveSlots * SLOT_MIN}m
                      {chunked && ` · part ${partIndex + 1}/${partTotal}`}
                    </div>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onRemoveBlock(task, partIndex);
                    }}
                    className="rounded p-0.5 text-muted-foreground opacity-0 hover:bg-background hover:text-foreground group-hover:opacity-100"
                    aria-label="Unschedule"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
                {isLead && effectiveSlots >= 2 && (
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
                {isLead && (
                <div
                  onMouseDown={(e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    setResizing({
                      id: blockKey,
                      taskId: task.id,
                      startSlot: slot,
                      startY: e.clientY,
                      origSlots: slots,
                      curSlots: slots,
                    });
                  }}
                  className="absolute bottom-0 left-0 right-0 h-1.5 cursor-ns-resize opacity-0 hover:bg-primary/30 group-hover:opacity-100"
                  aria-label="Resize"
                />
                )}
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
    const map = new Map<string, DayBlock[]>();
    for (const t of tasks) {
      if (t.status === "done") continue;
      const blocks = taskBlocks(t);
      blocks.forEach((b, i) => {
        const dk = dateKey(new Date(b.start));
        const dDate = days.find((d) => dateKey(d) === dk);
        if (!dDate) return;
        const slot = isoToSlot(b.start, dDate);
        if (slot == null) return;
        const dur = Math.max(SLOT_MIN, b.duration);
        const list = map.get(dk) ?? [];
        list.push({
          key: `${t.id}#${i}`,
          task: t,
          slot,
          slots: Math.max(1, Math.round(dur / SLOT_MIN)),
          partIndex: i,
          partTotal: blocks.length,
        });
        map.set(dk, list);
      });
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
                {laid.map(({ task, slot, slots, col, cols, key: bk }) => (
                  <div
                    key={bk}
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

function layoutBlocks<T extends { slot: number; slots: number }>(
  blocks: T[],
): (T & { col: number; cols: number })[] {
  const sorted = [...blocks].sort((a, b) => a.slot - b.slot);
  const result: (T & { col: number; cols: number })[] = [];
  let cluster: (T & { end: number })[] = [];
  const flush = () => {
    if (!cluster.length) return;
    const cols: ((T & { end: number }) | null)[] = [];
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
    cluster.forEach((b, i) => {
      const { end: _end, ...rest } = b;
      result.push({ ...(rest as unknown as T), col: assignments[i], cols: totalCols });
    });
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
