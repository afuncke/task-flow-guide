import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useTasks } from "@/hooks/use-tasks";
import type { Task } from "@/lib/tasks/types";
import { Button } from "@/components/ui/button";
import { TaskDialog } from "@/components/tasks/TaskDialog";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/calendar")({
  head: () => ({
    meta: [
      { title: "Calendar — Shenas" },
      { name: "description", content: "See upcoming tasks laid out by due date." },
      { property: "og:title", content: "Calendar — Shenas" },
      { property: "og:description", content: "See upcoming tasks laid out by due date." },
    ],
  }),
  component: CalendarPage,
});

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function toKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function startOfMonthGrid(anchor: Date): Date {
  const first = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
  // Monday-first: JS getDay Sun=0..Sat=6 → Mon=0..Sun=6
  const offset = (first.getDay() + 6) % 7;
  const start = new Date(first);
  start.setDate(first.getDate() - offset);
  return start;
}

function CalendarPage() {
  const { tasks, hydrated, addTask, updateTask, deleteTask } = useTasks();
  const [anchor, setAnchor] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Task | null>(null);
  const [prefillDue, setPrefillDue] = useState<string | undefined>();

  const knownTags = useMemo(
    () => Array.from(new Set(tasks.flatMap((t) => t.tags))).sort(),
    [tasks],
  );

  const byDay = useMemo(() => {
    const map = new Map<string, Task[]>();
    for (const t of tasks) {
      if (!t.due) continue;
      const list = map.get(t.due) ?? [];
      list.push(t);
      map.set(t.due, list);
    }
    for (const list of map.values()) {
      list.sort((a, b) => {
        if (a.status === "done" && b.status !== "done") return 1;
        if (b.status === "done" && a.status !== "done") return -1;
        return a.title.localeCompare(b.title);
      });
    }
    return map;
  }, [tasks]);

  const days = useMemo(() => {
    const start = startOfMonthGrid(anchor);
    return Array.from({ length: 42 }, (_, i) => {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      return d;
    });
  }, [anchor]);

  const monthLabel = anchor.toLocaleDateString(undefined, { month: "long", year: "numeric" });
  const todayKey = toKey(new Date());

  if (!hydrated) return null;

  const openEdit = (t: Task) => {
    setEditing(t);
    setPrefillDue(undefined);
    setDialogOpen(true);
  };
  const openNewOn = (key: string) => {
    setEditing(null);
    setPrefillDue(key);
    setDialogOpen(true);
  };

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-semibold tracking-tight">{monthLabel}</h1>
        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              setAnchor(new Date(anchor.getFullYear(), anchor.getMonth() - 1, 1))
            }
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              const d = new Date();
              setAnchor(new Date(d.getFullYear(), d.getMonth(), 1));
            }}
          >
            Today
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              setAnchor(new Date(anchor.getFullYear(), anchor.getMonth() + 1, 1))
            }
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-px overflow-hidden rounded-lg border bg-border text-xs">
        {WEEKDAYS.map((d) => (
          <div key={d} className="bg-muted/50 px-2 py-1.5 text-muted-foreground">
            {d}
          </div>
        ))}
        {days.map((d) => {
          const key = toKey(d);
          const inMonth = d.getMonth() === anchor.getMonth();
          const isToday = key === todayKey;
          const items = byDay.get(key) ?? [];
          return (
            <div
              key={key}
              className={cn(
                "group min-h-24 bg-background p-1.5 sm:min-h-28",
                !inMonth && "bg-muted/30 text-muted-foreground",
              )}
            >
              <div className="mb-1 flex items-center justify-between">
                <span
                  className={cn(
                    "inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-[11px] font-medium",
                    isToday && "bg-primary text-primary-foreground",
                  )}
                >
                  {d.getDate()}
                </span>
                <button
                  onClick={() => openNewOn(key)}
                  className="text-muted-foreground opacity-0 transition-opacity hover:text-foreground group-hover:opacity-100"
                  aria-label="Add task on this day"
                >
                  +
                </button>
              </div>
              <div className="space-y-1">
                {items.slice(0, 3).map((t) => (
                  <button
                    key={t.id}
                    onClick={() => openEdit(t)}
                    className={cn(
                      "block w-full truncate rounded px-1.5 py-0.5 text-left text-[11px]",
                      t.status === "done"
                        ? "bg-muted text-muted-foreground line-through"
                        : t.status === "doing"
                          ? "bg-primary/15 text-foreground"
                          : "bg-accent text-foreground hover:bg-accent/80",
                    )}
                    title={t.title}
                  >
                    {t.title}
                  </button>
                ))}
                {items.length > 3 && (
                  <div className="px-1.5 text-[10px] text-muted-foreground">
                    +{items.length - 3} more
                  </div>
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
        defaultDue={prefillDue}
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
