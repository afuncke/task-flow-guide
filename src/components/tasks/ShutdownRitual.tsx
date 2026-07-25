import { useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import type { Task } from "@/lib/tasks/types";
import { formatMinutes } from "@/lib/tasks/day-budget";
import { taskMinutes } from "@/lib/tasks/estimates";
import { ArrowRight, Check, Moon, SkipForward, Sunset } from "lucide-react";
import { cn } from "@/lib/utils";

type Step = "done" | "carry" | "close";

/**
 * Shutdown ritual — the evening counterpart to planning.
 *
 * Sunsama's insight: a day needs an ending, not just a beginning. What is
 * unfinished gets carried deliberately, one item at a time, so tomorrow
 * inherits decisions instead of debt. Nothing here counts against the user.
 */
export function ShutdownRitual({
  open,
  onOpenChange,
  tasks,
  todayKey,
  onBulkUpdate,
  onArchive,
  onComplete,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  tasks: Task[];
  todayKey: string;
  onBulkUpdate: (patches: Record<string, Partial<Task>>) => void;
  onArchive: (id: string) => void;
  onComplete: () => void;
}) {
  const [step, setStep] = useState<Step>("done");
  const [handled, setHandled] = useState<Record<string, string>>({});

  const tomorrowKey = useMemo(() => {
    const d = new Date(`${todayKey}T12:00:00`);
    d.setDate(d.getDate() + 1);
    return isoDate(d);
  }, [todayKey]);

  const finished = useMemo(
    () =>
      tasks.filter(
        (t) => t.status === "done" && (t.completedAt ?? "").slice(0, 10) === todayKey,
      ),
    [tasks, todayKey],
  );

  const openToday = useMemo(
    () =>
      tasks.filter((t) => {
        if (t.status === "done" || t.archived) return false;
        const scheduledToday =
          (t.scheduledStart ?? "").slice(0, 10) === todayKey ||
          (t.sessions ?? []).some((s) => s.start.slice(0, 10) === todayKey);
        return t.myDay === todayKey || t.due === todayKey || scheduledToday;
      }),
    [tasks, todayKey],
  );

  const focusedMin = finished.reduce(
    (n, t) => n + (t.actualDuration ?? taskMinutes(t)),
    0,
  );

  const remaining = openToday.filter((t) => !handled[t.id]);

  const clearDay = (id: string): Partial<Task> => ({
    scheduledStart: undefined,
    sessions: undefined,
    myDay: undefined,
  });

  const carry = (t: Task) => {
    onBulkUpdate({
      [t.id]: {
        ...clearDay(t.id),
        myDay: tomorrowKey,
        due: t.due === todayKey ? tomorrowKey : t.due,
        rescheduleCount: (t.rescheduleCount ?? 0) + 1,
      },
    });
    setHandled((h) => ({ ...h, [t.id]: "Tomorrow" }));
  };

  const release = (t: Task) => {
    onBulkUpdate({ [t.id]: { ...clearDay(t.id), due: undefined } });
    setHandled((h) => ({ ...h, [t.id]: "No date" }));
  };

  const letGo = (t: Task) => {
    onArchive(t.id);
    setHandled((h) => ({ ...h, [t.id]: "Let go" }));
  };

  const carryAll = () => {
    const patches: Record<string, Partial<Task>> = {};
    const marks: Record<string, string> = {};
    for (const t of remaining) {
      patches[t.id] = {
        ...clearDay(t.id),
        myDay: tomorrowKey,
        due: t.due === todayKey ? tomorrowKey : t.due,
        rescheduleCount: (t.rescheduleCount ?? 0) + 1,
      };
      marks[t.id] = "Tomorrow";
    }
    if (Object.keys(patches).length) onBulkUpdate(patches);
    setHandled((h) => ({ ...h, ...marks }));
  };

  const finish = () => {
    onComplete();
    onOpenChange(false);
  };

  const advance = () => {
    if (step === "done") setStep("carry");
    else if (step === "carry") setStep("close");
    else finish();
  };

  const stepIdx = ["done", "carry", "close"].indexOf(step);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sunset className="h-4 w-4 text-muted-foreground" />
            Close the day
          </DialogTitle>
        </DialogHeader>

        <div className="mb-4 flex items-center gap-2 text-xs">
          {["Today", "Carry over", "Done for today"].map((label, i) => (
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
              <span className={cn(i === stepIdx ? "font-medium" : "text-muted-foreground")}>
                {label}
              </span>
              {i < 2 && <span className="text-muted-foreground/50">›</span>}
            </div>
          ))}
        </div>

        {step === "done" && (
          <div className="space-y-3">
            <div className="rounded-lg border p-4">
              <div className="text-2xl font-semibold tracking-tight">
                {finished.length} finished
                {focusedMin > 0 && ` · ${formatMinutes(focusedMin)} of real work`}
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                {finished.length === 0
                  ? "Nothing crossed off today. Days like this exist and they still count."
                  : "That happened. Worth a moment before you close it out."}
              </p>
            </div>
            <div className="space-y-1">
              {finished.map((t) => (
                <div
                  key={t.id}
                  className="flex items-center gap-2 rounded-md border p-2 text-sm"
                >
                  <Check className="h-3.5 w-3.5 shrink-0 text-primary" />
                  <span className="truncate line-through decoration-muted-foreground/50">
                    {t.title}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {step === "carry" && (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm text-muted-foreground">
                {remaining.length === 0
                  ? "Nothing left open from today."
                  : `${remaining.length} still open. Decide now so tomorrow doesn't inherit it silently.`}
              </p>
              {remaining.length > 1 && (
                <Button variant="outline" size="sm" onClick={carryAll}>
                  Move all to tomorrow
                </Button>
              )}
            </div>
            <div className="space-y-1.5">
              {openToday.map((t) => (
                <div
                  key={t.id}
                  className="flex items-start justify-between gap-3 rounded-md border p-2.5"
                >
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium">{t.title}</div>
                    <div className="mt-0.5 text-[11px] text-muted-foreground">
                      {handled[t.id] ? `→ ${handled[t.id]}` : "open"}
                    </div>
                  </div>
                  {!handled[t.id] && (
                    <div className="flex flex-wrap gap-1">
                      <MiniBtn onClick={() => carry(t)}>Tomorrow</MiniBtn>
                      <MiniBtn onClick={() => release(t)}>No date</MiniBtn>
                      <MiniBtn onClick={() => letGo(t)}>Let go</MiniBtn>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {step === "close" && (
          <div className="space-y-3">
            <div className="rounded-lg border p-6 text-center">
              <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-primary/10">
                <Moon className="h-5 w-5 text-primary" />
              </div>
              <div className="text-lg font-medium">You're done for today.</div>
              <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">
                Everything open has a place to land. Nothing here needs you again
                until morning.
              </p>
            </div>
          </div>
        )}

        <div className="mt-4 flex items-center justify-between border-t pt-3">
          <Button variant="ghost" size="sm" onClick={finish}>
            <SkipForward className="mr-1 h-3.5 w-3.5" /> Skip
          </Button>
          <div className="flex gap-2">
            {step !== "done" && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setStep(step === "close" ? "carry" : "done")}
              >
                Back
              </Button>
            )}
            <Button size="sm" onClick={advance}>
              {step === "close" ? "Close the day" : "Next"}
              {step !== "close" && <ArrowRight className="ml-1 h-3.5 w-3.5" />}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
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
