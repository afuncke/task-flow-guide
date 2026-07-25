import { useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useTasks } from "@/hooks/use-tasks";
import { useContextState } from "@/hooks/use-context-state";
import { rankTasks, urgency } from "@/lib/tasks/urgency";
import { contextFit } from "@/lib/tasks/context";
import type { Task } from "@/lib/tasks/types";
import { Button } from "@/components/ui/button";
import { TagChip } from "@/components/tasks/TagChip";
import { DueBadge } from "@/components/tasks/DueBadge";
import { UrgencyBadge } from "@/components/tasks/UrgencyBadge";
import { ContextChips } from "@/components/tasks/ContextChips";
import { TaskDialog } from "@/components/tasks/TaskDialog";
import { FocusTimer } from "@/components/tasks/FocusTimer";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { CalendarClock, ChevronRight, Check, Play, Pause, Clock, SkipForward, Plus } from "lucide-react";

export const Route = createFileRoute("/focus")({
  head: () => ({
    meta: [
      { title: "Focus — Shenas" },
      { name: "description", content: "Your next task, without the noise." },
      { property: "og:title", content: "Focus — Shenas" },
      { property: "og:description", content: "Your next task, without the noise." },
    ],
  }),
  component: FocusPage,
});

function FocusPage() {
  const { tasks, hydrated, addTask, updateTask, setStatus, deleteTask } = useTasks();
  const { currentState, stored } = useContextState();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Task | null>(null);
  const [skipped, setSkipped] = useState<string[]>([]);
  const [upNextOpen, setUpNextOpen] = useState(false);
  const [pinnedId, setPinnedId] = useState<string | null>(null);

  const active = useMemo(() => tasks.filter((t) => t.status !== "done"), [tasks]);
  const scoped = useMemo(
    () => (stored.hideMismatches ? active.filter((t) => contextFit(t, currentState)) : active),
    [active, currentState, stored.hideMismatches],
  );
  const ranked = useMemo(() => rankTasks(scoped, currentState), [scoped, currentState]);
  const nextScheduled = useMemo(() => {
    const now = Date.now();
    return active
      .filter((t) => t.scheduledStart && new Date(t.scheduledStart).getTime() + (t.scheduledDuration ?? 0) * 60_000 >= now)
      .sort((a, b) => new Date(a.scheduledStart!).getTime() - new Date(b.scheduledStart!).getTime())[0];
  }, [active]);
  const visible = useMemo(() => {
    const base = ranked.filter((t) => !skipped.includes(t.id));
    if (pinnedId) {
      const pinned = base.find((t) => t.id === pinnedId);
      if (pinned) return [pinned, ...base.filter((t) => t.id !== pinnedId)];
    }
    return base;
  }, [ranked, skipped, pinnedId]);
  const current = visible[0];
  const upNext = visible.slice(1, 4);

  useEffect(() => {
    const onKey = (e: Event) => {
      const detail = (e as CustomEvent<string>).detail;
      if (detail === "jump-scheduled" && nextScheduled) {
        setSkipped([]);
        setPinnedId(nextScheduled.id);
      }
    };
    window.addEventListener("shenas:key", onKey);
    return () => window.removeEventListener("shenas:key", onKey);
  }, [nextScheduled]);

  const knownTags = useMemo(
    () => Array.from(new Set(tasks.flatMap((t) => t.tags))).sort(),
    [tasks],
  );

  if (!hydrated) return null;

  const openNew = () => {
    setEditing(null);
    setDialogOpen(true);
  };
  const openEdit = (t: Task) => {
    setEditing(t);
    setDialogOpen(true);
  };

  const snooze = (t: Task) => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    updateTask(t.id, { due: d.toISOString().slice(0, 10) });
  };

  return (
    <div className="mx-auto max-w-2xl px-4 py-10 sm:py-16">
      {nextScheduled && (
        <button
          onClick={() => {
            setSkipped([]);
            setPinnedId(nextScheduled.id);
          }}
          className={`mb-6 flex w-full items-center gap-3 rounded-lg border px-3 py-2 text-left text-sm transition-colors hover:bg-accent ${
            current?.id === nextScheduled.id ? "border-primary/40 bg-primary/5" : ""
          }`}
          title="Jump to next scheduled block (s)"
        >
          <CalendarClock className="h-4 w-4 shrink-0 text-muted-foreground" />
          <div className="min-w-0 flex-1">
            <div className="text-[11px] uppercase tracking-wide text-muted-foreground">
              Next scheduled · {formatWhen(nextScheduled.scheduledStart!)}
              {nextScheduled.scheduledDuration ? ` · ${nextScheduled.scheduledDuration}m` : ""}
            </div>
            <div className="truncate font-medium text-foreground">{nextScheduled.title}</div>
          </div>
          <kbd className="rounded border bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">s</kbd>
        </button>
      )}
      {!current ? (
        <div className="text-center">
          <h1 className="text-2xl font-semibold">Nothing to do right now.</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {active.length === 0
              ? "Add your first task and Shenas will pick what's next."
              : "You've cleared everything visible. Nice."}
          </p>
          <Button className="mt-6" onClick={openNew}>
            <Plus className="mr-1 h-4 w-4" /> Add a task
          </Button>
        </div>
      ) : (
        <div>
          <div className="mb-3 flex items-center justify-between text-xs text-muted-foreground">
            <span>Next up</span>
            <UrgencyBadge value={urgency(current)} />
          </div>

          <h1 className="text-3xl font-semibold leading-tight sm:text-4xl">{current.title}</h1>

          {current.notes && (
            <p className="mt-3 whitespace-pre-wrap text-sm text-muted-foreground">
              {current.notes}
            </p>
          )}

          <div className="mt-4 flex flex-wrap items-center gap-1.5">
            {current.tags.map((t) => (
              <TagChip key={t} tag={t} />
            ))}
            <DueBadge due={current.due} />
            <ContextChips context={current.context} muted={!contextFit(current, currentState)} />
            {current.priority && (
              <span className="rounded border px-1.5 text-[10px] font-semibold text-muted-foreground">
                {current.priority}
              </span>
            )}
          </div>

          <div className="mt-6 flex flex-wrap gap-2">
            <Button onClick={() => setStatus(current.id, "done")}>
              <Check className="mr-1 h-4 w-4" /> Done
            </Button>
            {current.status === "doing" ? (
              <Button variant="outline" onClick={() => setStatus(current.id, "todo")}>
                <Pause className="mr-1 h-4 w-4" /> Pause
              </Button>
            ) : (
              <Button variant="outline" onClick={() => setStatus(current.id, "doing")}>
                <Play className="mr-1 h-4 w-4" /> Start
              </Button>
            )}
            <Button variant="ghost" onClick={() => snooze(current)}>
              <Clock className="mr-1 h-4 w-4" /> Snooze 1d
            </Button>
            <Button variant="ghost" onClick={() => setSkipped((s) => [...s, current.id])}>
              <SkipForward className="mr-1 h-4 w-4" /> Skip
            </Button>
            <Button variant="ghost" onClick={() => openEdit(current)}>
              Edit
            </Button>
          </div>

          <div className="mt-6">
            <FocusTimer
              task={current}
              onStart={() => setStatus(current.id, "doing")}
              onPause={() => setStatus(current.id, "todo")}
              onDone={(actualMinutes) => {
                updateTask(current.id, { actualDuration: actualMinutes });
                setStatus(current.id, "done");
              }}
              onExtend={(extra) =>
                updateTask(current.id, {
                  scheduledDuration: (current.scheduledDuration ?? 25) + extra,
                })
              }
            />
          </div>


          {upNext.length > 0 && (
            <Collapsible open={upNextOpen} onOpenChange={setUpNextOpen} className="mt-10">
              <CollapsibleTrigger className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
                <ChevronRight
                  className={`h-3.5 w-3.5 transition-transform ${upNextOpen ? "rotate-90" : ""}`}
                />
                Up next ({upNext.length})
              </CollapsibleTrigger>
              <CollapsibleContent className="mt-3 space-y-1.5">
                {upNext.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => openEdit(t)}
                    className="flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left text-sm hover:bg-accent"
                  >
                    <span className="truncate">{t.title}</span>
                    <UrgencyBadge value={urgency(t)} />
                  </button>
                ))}
              </CollapsibleContent>
            </Collapsible>
          )}
        </div>
      )}

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
