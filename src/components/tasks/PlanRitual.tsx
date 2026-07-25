import { useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import type { Task } from "@/lib/tasks/types";
import { rankTasks } from "@/lib/tasks/urgency";
import { useContextState } from "@/hooks/use-context-state";
import { autoSchedule, minutesToISO } from "@/lib/tasks/auto-schedule";
import { estimateInsight } from "@/lib/tasks/estimates";
import { dayBudget, areaSplit, untouchedAreas } from "@/lib/tasks/day-budget";
import { CapacityMeter } from "./CapacityMeter";
import { AreaBalance } from "./AreaBalance";
import { useAreas } from "@/hooks/use-areas";
import { useEvents, eventBusyRanges, eventMinutesInWindow } from "@/lib/tasks/events";


import { DueBadge } from "./DueBadge";
import { TagChip } from "./TagChip";
import { cn } from "@/lib/utils";
import { ArrowLeft, ArrowRight, Check, SkipForward } from "lucide-react";

type Step = "rollover" | "pick" | "block" | "review";

export function PlanRitual({
  open,
  onOpenChange,
  tasks,
  today,
  todayKey,
  onBulkUpdate,
  onSetStatus,
  onComplete,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  tasks: Task[];
  today: Date;
  todayKey: string;
  onBulkUpdate: (patches: Record<string, Partial<Task>>) => void;
  onSetStatus: (id: string, s: Task["status"]) => void;
  onComplete: () => void;
}) {
  const { stored, currentState } = useContextState();
  const { areas } = useAreas();

  const [step, setStep] = useState<Step>("rollover");
  // Picks made this session (task IDs to work on today)
  const [picks, setPicks] = useState<Set<string>>(() => new Set());

  const yesterdayKey = useMemo(() => {
    const y = new Date(today);
    y.setDate(y.getDate() - 1);
    return isoDate(y);
  }, [today]);

  // Rollover: unfinished tasks scheduled/due before today or yesterday specifically.
  const rollover = useMemo(
    () =>
      tasks.filter((t) => {
        if (t.status === "done") return false;
        const dueOverdue = t.due && t.due < todayKey;
        const scheduledYesterday =
          t.scheduledStart && isoDate(new Date(t.scheduledStart)) === yesterdayKey;
        return dueOverdue || scheduledYesterday;
      }),
    [tasks, todayKey, yesterdayKey],
  );

  // Candidates for the pick step
  const candidates = useMemo(() => {
    const already = tasks.filter((t) => t.myDay === todayKey && t.status !== "done");
    const rest = tasks.filter(
      (t) => t.status !== "done" && t.myDay !== todayKey,
    );
    const ranked = rankTasks(rest, currentState).slice(0, 15);
    return { alreadyPinned: already, suggested: ranked };
  }, [tasks, todayKey, currentState]);



  // Seed picks with anything already pinned to today
  useMemo(() => {
    setPicks((prev) => {
      if (prev.size > 0) return prev;
      const s = new Set<string>();
      for (const t of candidates.alreadyPinned) s.add(t.id);
      return s;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [candidates.alreadyPinned.length]);

  const togglePick = (id: string) =>
    setPicks((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  // Block step preview: run auto-schedule against picked tasks that aren't yet scheduled today
  const [autoRunUnplaced, setAutoRunUnplaced] = useState<string[] | null>(null);

  const pickedTasks = useMemo(
    () => tasks.filter((t) => picks.has(t.id)),
    [tasks, picks],
  );

  const totalPickedMin = pickedTasks.reduce(
    (n, t) => n + (t.scheduledDuration ?? 30),
    0,
  );
  // Meetings and appointments already own part of the day.
  const { events } = useEvents();
  const eventMinutes = useMemo(
    () => eventMinutesInWindow(events, todayKey, stored.schedule),
    [events, todayKey, stored.schedule],
  );
  const workWindowMin =
    (stored.schedule.end - stored.schedule.start) * 60 - eventMinutes;

  const overflow = totalPickedMin > workWindowMin;

  /* Live budget + area balance: feel the commitment while you're making it. */
  const factor = useMemo(() => estimateInsight(tasks).factor, [tasks]);
  const openPicks = useMemo(
    () => pickedTasks.filter((t) => t.status !== "done"),
    [pickedTasks],
  );
  const budget = useMemo(
    () =>
      dayBudget(openPicks, stored.schedule, {
        factor,
        isToday: true,
        busyMinutes: eventMinutes,
      }),
    [openPicks, stored.schedule, factor, eventMinutes],
  );

  const split = useMemo(
    () => areaSplit(openPicks, tasks, areas, factor),
    [openPicks, tasks, areas, factor],
  );
  const untouched = useMemo(() => untouchedAreas(split, areas, tasks), [split, areas, tasks]);



  const commitRollover = (
    action: "keep" | "push-today" | "unschedule" | "done",
    id: string,
  ) => {
    const patch: Partial<Task> = {};
    if (action === "push-today") {
      patch.due = todayKey;
      patch.scheduledStart = undefined;
    } else if (action === "unschedule") {
      patch.scheduledStart = undefined;
    } else if (action === "done") {
      onSetStatus(id, "done");
      return;
    }
    if (Object.keys(patch).length > 0) onBulkUpdate({ [id]: patch });
  };

  const runAutoSchedule = () => {
    // Take picked tasks that aren't already scheduled today
    const candidates = pickedTasks.filter((t) => {
      if (!t.scheduledStart) return true;
      return isoDate(new Date(t.scheduledStart)) !== todayKey;
    });
    // Existing busy = picked tasks already scheduled today
    const busy = pickedTasks
      .filter((t) => t.scheduledStart && isoDate(new Date(t.scheduledStart)) === todayKey)
      .map((t) => {
        const d = new Date(t.scheduledStart!);
        const startMin = d.getHours() * 60 + d.getMinutes();
        return { startMin, endMin: startMin + (t.scheduledDuration ?? 30) };
      });

    const { blocks, unplaced } = autoSchedule(candidates, stored.schedule, busy, {
      factor: estimateInsight(tasks).factor,
    });
    const patches: Record<string, Partial<Task>> = {};
    for (const [id, list] of Object.entries(blocks)) {
      if (!list.length) continue;
      patches[id] = {
        scheduledStart: minutesToISO(today, list[0].startMin),
        scheduledDuration: list[0].duration,
        sessions: list.slice(1).map((b) => ({
          start: minutesToISO(today, b.startMin),
          duration: b.duration,
        })),
        myDay: todayKey,
        due: todayKey,
      };
    }
    if (Object.keys(patches).length) onBulkUpdate(patches);
    setAutoRunUnplaced(unplaced);
  };

  const commitPicks = () => {
    // Pin the chosen tasks to today; unpin others that were pinned to today.
    const patches: Record<string, Partial<Task>> = {};
    for (const id of picks) {
      const t = tasks.find((x) => x.id === id);
      if (t && t.myDay !== todayKey) patches[id] = { myDay: todayKey };
    }
    for (const t of tasks) {
      if (t.myDay === todayKey && !picks.has(t.id)) {
        patches[t.id] = { myDay: undefined };
      }
    }
    if (Object.keys(patches).length) onBulkUpdate(patches);
  };

  const scheduledToday = pickedTasks.filter(
    (t) => t.scheduledStart && isoDate(new Date(t.scheduledStart)) === todayKey,
  );
  const scheduledMin = scheduledToday.reduce(
    (n, t) => n + (t.scheduledDuration ?? 30),
    0,
  );

  const advance = () => {
    if (step === "rollover") setStep("pick");
    else if (step === "pick") {
      commitPicks();
      setStep("block");
    } else if (step === "block") setStep("review");
    else if (step === "review") {
      onComplete();
      onOpenChange(false);
    }
  };
  const back = () => {
    if (step === "pick") setStep("rollover");
    else if (step === "block") setStep("pick");
    else if (step === "review") setStep("block");
  };

  const stepIdx = ["rollover", "pick", "block", "review"].indexOf(step);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Plan your day</DialogTitle>
        </DialogHeader>

        {/* Stepper */}
        <div className="mb-4 flex items-center gap-2 text-xs">
          {["Rollover", "My Day", "Block", "Review"].map((label, i) => (
            <div key={label} className="flex items-center gap-2">
              <span
                className={cn(
                  "flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-semibold",
                  i === stepIdx
                    ? "bg-primary text-primary-foreground"
                    : i < stepIdx
                      ? "bg-muted text-foreground"
                      : "border text-muted-foreground",
                )}
              >
                {i < stepIdx ? <Check className="h-3 w-3" /> : i + 1}
              </span>
              <span
                className={cn(
                  i === stepIdx ? "font-medium" : "text-muted-foreground",
                )}
              >
                {label}
              </span>
              {i < 3 && <span className="text-muted-foreground/50">›</span>}
            </div>
          ))}
        </div>

        {step === "rollover" && (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              {rollover.length === 0
                ? "Nothing left over from yesterday. Clean slate."
                : `${rollover.length} unfinished task${rollover.length === 1 ? "" : "s"} from before today. What should happen to them?`}
            </p>
            <div className="space-y-1.5">
              {rollover.map((t) => (
                <div
                  key={t.id}
                  className="flex items-start justify-between gap-3 rounded-md border p-2.5"
                >
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium">{t.title}</div>
                    <div className="mt-1 flex flex-wrap items-center gap-1">
                      <DueBadge due={t.due} />
                      {t.tags.slice(0, 3).map((tag) => (
                        <TagChip key={tag} tag={tag} />
                      ))}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    <MiniBtn onClick={() => commitRollover("push-today", t.id)}>
                      Today
                    </MiniBtn>
                    <MiniBtn onClick={() => commitRollover("unschedule", t.id)}>
                      Drop time
                    </MiniBtn>
                    <MiniBtn onClick={() => commitRollover("done", t.id)}>Done</MiniBtn>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {step === "pick" && (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Pick what you actually intend to do today. Tick to add to My Day.
            </p>
            {candidates.alreadyPinned.length > 0 && (
              <Section label="Already pinned to today">
                {candidates.alreadyPinned.map((t) => (
                  <PickRow
                    key={t.id}
                    task={t}
                    checked={picks.has(t.id)}
                    onToggle={() => togglePick(t.id)}
                  />
                ))}
              </Section>
            )}
            <Section
              label={`Suggested (${candidates.suggested.length})`}
            >
              {candidates.suggested.map((t) => (
                <PickRow
                  key={t.id}
                  task={t}
                  checked={picks.has(t.id)}
                  onToggle={() => togglePick(t.id)}
                />
              ))}
              {candidates.suggested.length === 0 && (
                <div className="rounded-md border border-dashed p-3 text-xs text-muted-foreground">
                  No more suggestions.
                </div>
              )}
            </Section>
            <div className="sticky bottom-0 space-y-2 border-t bg-background pt-3">
              <div className="text-xs text-muted-foreground">
                {picks.size} picked · {formatMin(totalPickedMin)} estimated
              </div>
              <CapacityMeter budget={budget} label="Picked" />
              <AreaBalance split={split} untouched={untouched} />
            </div>

          </div>
        )}

        {step === "block" && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Auto-schedule packs your picks into free slots inside{" "}
              {stored.schedule.start}:00–{stored.schedule.end}:00. You can drag them
              afterwards on the day grid.
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <Button onClick={runAutoSchedule} size="sm">
                Auto-schedule
              </Button>
              <div
                className={cn(
                  "text-xs",
                  overflow ? "text-amber-600 dark:text-amber-400" : "text-muted-foreground",
                )}
              >
                {formatMin(totalPickedMin)} picked · {formatMin(workWindowMin)} available
                {overflow && " · over capacity"}
              </div>
            </div>
            {autoRunUnplaced && autoRunUnplaced.length > 0 && (
              <div className="rounded-md border border-amber-500/40 bg-amber-500/10 p-2 text-xs">
                {autoRunUnplaced.length} task{autoRunUnplaced.length === 1 ? "" : "s"} didn't
                fit — trim durations or leave them unscheduled.
              </div>
            )}
            <div className="space-y-1.5">
              {pickedTasks.map((t) => (
                <div
                  key={t.id}
                  className="flex items-center justify-between gap-2 rounded-md border p-2 text-sm"
                >
                  <span className="truncate">{t.title}</span>
                  <span className="text-xs text-muted-foreground">
                    {t.scheduledStart &&
                    isoDate(new Date(t.scheduledStart)) === todayKey
                      ? new Date(t.scheduledStart).toLocaleTimeString(undefined, {
                          hour: "numeric",
                          minute: "2-digit",
                        }) +
                        " · " +
                        (t.scheduledDuration ?? 30) +
                        "m"
                      : "unscheduled"}
                  </span>
                </div>
              ))}
              {pickedTasks.length === 0 && (
                <div className="rounded-md border border-dashed p-3 text-xs text-muted-foreground">
                  No picks. Go back and pick some.
                </div>
              )}
            </div>
          </div>
        )}

        {step === "review" && (
          <div className="space-y-4">
            <div className="rounded-lg border p-4">
              <div className="text-2xl font-semibold tracking-tight">
                {scheduledToday.length} block{scheduledToday.length === 1 ? "" : "s"} ·{" "}
                {formatMin(scheduledMin)} scheduled
              </div>
              <div className="mt-1 text-xs text-muted-foreground">
                {formatMin(Math.max(0, workWindowMin - scheduledMin))} free in work hours
                {pickedTasks.length - scheduledToday.length > 0 &&
                  ` · ${pickedTasks.length - scheduledToday.length} unscheduled pick(s)`}
              </div>
            </div>
            <p className="text-sm text-muted-foreground">
              Ship it. You can re-plan anytime with <kbd className="rounded border bg-muted px-1 text-[10px]">R</kbd> or the Re-plan button.
            </p>
          </div>
        )}

        <div className="mt-4 flex items-center justify-between border-t pt-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              onComplete();
              onOpenChange(false);
            }}
          >
            <SkipForward className="mr-1 h-3.5 w-3.5" /> Skip ritual
          </Button>
          <div className="flex gap-2">
            {step !== "rollover" && (
              <Button variant="outline" size="sm" onClick={back}>
                <ArrowLeft className="mr-1 h-3.5 w-3.5" /> Back
              </Button>
            )}
            <Button size="sm" onClick={advance}>
              {step === "review" ? "Done" : "Next"}
              {step !== "review" && <ArrowRight className="ml-1 h-3.5 w-3.5" />}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Section({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
      <div className="space-y-1">{children}</div>
    </div>
  );
}

function PickRow({
  task,
  checked,
  onToggle,
}: {
  task: Task;
  checked: boolean;
  onToggle: () => void;
}) {
  return (
    <label className="flex cursor-pointer items-start gap-2 rounded-md border p-2 text-sm hover:bg-accent/40">
      <Checkbox checked={checked} onCheckedChange={onToggle} className="mt-0.5" />
      <div className="min-w-0 flex-1">
        <div className="truncate">{task.title}</div>
        <div className="mt-0.5 flex flex-wrap items-center gap-1">
          <DueBadge due={task.due} />
          {task.tags.slice(0, 3).map((tag) => (
            <TagChip key={tag} tag={tag} />
          ))}
          {task.scheduledDuration && (
            <span className="text-[10px] text-muted-foreground">
              {task.scheduledDuration}m
            </span>
          )}
        </div>
      </div>
    </label>
  );
}

function MiniBtn({
  onClick,
  children,
}: {
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className="rounded border px-2 py-0.5 text-[11px] text-muted-foreground hover:bg-accent hover:text-foreground"
    >
      {children}
    </button>
  );
}

function isoDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function formatMin(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}
