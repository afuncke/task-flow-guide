import { useMemo, useState } from "react";
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
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { ChevronRight, Check, Play, Pause, Clock, SkipForward, Plus } from "lucide-react";

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

  const active = useMemo(() => tasks.filter((t) => t.status !== "done"), [tasks]);
  const scoped = useMemo(
    () => (stored.hideMismatches ? active.filter((t) => contextFit(t, currentState)) : active),
    [active, currentState, stored.hideMismatches],
  );
  const ranked = useMemo(() => rankTasks(scoped, currentState), [scoped, currentState]);
  const visible = useMemo(() => ranked.filter((t) => !skipped.includes(t.id)), [ranked, skipped]);
  const current = visible[0];
  const upNext = visible.slice(1, 4);

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
