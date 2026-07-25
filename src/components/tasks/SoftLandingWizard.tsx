import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { Task } from "@/lib/tasks/types";
import { TagChip } from "./TagChip";
import { cn } from "@/lib/utils";
import { Archive, CalendarClock, Scissors, ArrowRight, Check, Heart } from "lucide-react";

type Choice = "keep" | "shrink" | "let-go" | null;

export function SoftLandingWizard({
  open,
  onOpenChange,
  overdue,
  todayKey,
  onReschedule,
  onShrink,
  onArchive,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  overdue: Task[];
  todayKey: string;
  onReschedule: (id: string, newDue: string) => void;
  onShrink: (id: string, patch: { title: string; scheduledDuration?: number }) => void;
  onArchive: (id: string) => void;
}) {
  const [index, setIndex] = useState(0);
  const [choice, setChoice] = useState<Choice>(null);
  const [cleared, setCleared] = useState(0);

  // Queue is snapshotted at open so tasks acted on don't cause jumping.
  const [queue, setQueue] = useState<Task[]>([]);

  useEffect(() => {
    if (open) {
      setQueue(overdue);
      setIndex(0);
      setChoice(null);
      setCleared(0);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const task = queue[index];
  const done = !task;

  const advance = () => {
    setChoice(null);
    setCleared((c) => c + 1);
    setIndex((i) => i + 1);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Heart className="h-4 w-4 text-rose-500" />
            Soft landing
          </DialogTitle>
        </DialogHeader>

        {done ? (
          <FinishedPanel cleared={cleared} onClose={() => onOpenChange(false)} />
        ) : (
          <>
            <div className="mb-3 flex items-center justify-between text-xs text-muted-foreground">
              <span>
                {index + 1} of {queue.length}
              </span>
              <span>Gentle. One at a time.</span>
            </div>

            <TaskHeader task={task} />

            {task.rescheduleCount != null && task.rescheduleCount >= 2 && (
              <div className="mt-2 rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-300">
                This has been moved {task.rescheduleCount} times. It may need a
                smaller shape — or to be let go.
              </div>
            )}

            <div className="mt-4 space-y-2">
              {choice === null && (
                <>
                  <ChoiceButton
                    icon={<CalendarClock className="h-4 w-4" />}
                    label="Still matters"
                    sub="Pick a realistic new day."
                    onClick={() => setChoice("keep")}
                  />
                  <ChoiceButton
                    icon={<Scissors className="h-4 w-4" />}
                    label="Smaller version"
                    sub="Shrink the scope to something doable."
                    onClick={() => setChoice("shrink")}
                  />
                  <ChoiceButton
                    icon={<Archive className="h-4 w-4" />}
                    label="Let it go"
                    sub="Archive without shame. You can restore later."
                    onClick={() => setChoice("let-go")}
                  />
                </>
              )}

              {choice === "keep" && (
                <KeepPanel
                  task={task}
                  todayKey={todayKey}
                  onCancel={() => setChoice(null)}
                  onConfirm={(newDue) => {
                    onReschedule(task.id, newDue);
                    advance();
                  }}
                />
              )}

              {choice === "shrink" && (
                <ShrinkPanel
                  task={task}
                  onCancel={() => setChoice(null)}
                  onConfirm={(patch) => {
                    onShrink(task.id, patch);
                    advance();
                  }}
                />
              )}

              {choice === "let-go" && (
                <LetGoPanel
                  onCancel={() => setChoice(null)}
                  onConfirm={() => {
                    onArchive(task.id);
                    advance();
                  }}
                />
              )}
            </div>

            <div className="mt-4 flex justify-between border-t pt-3 text-xs">
              <button
                onClick={() => onOpenChange(false)}
                className="text-muted-foreground hover:text-foreground"
              >
                Pause — I'll come back
              </button>
              {choice === null && (
                <button
                  onClick={advance}
                  className="flex items-center gap-1 text-muted-foreground hover:text-foreground"
                >
                  Skip <ArrowRight className="h-3 w-3" />
                </button>
              )}
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

function TaskHeader({ task }: { task: Task }) {
  return (
    <div className="rounded-lg border p-3">
      <div className="text-sm font-medium">{task.title}</div>
      {task.notes && (
        <div className="mt-1 line-clamp-2 text-xs text-muted-foreground">{task.notes}</div>
      )}
      <div className="mt-2 flex flex-wrap items-center gap-1">
        {task.due && (
          <span className="text-[11px] text-muted-foreground">
            Was due {formatFriendly(task.due)}
          </span>
        )}
        {task.tags.slice(0, 4).map((tag) => (
          <TagChip key={tag} tag={tag} />
        ))}
      </div>
    </div>
  );
}

function ChoiceButton({
  icon,
  label,
  sub,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  sub: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="flex w-full items-start gap-3 rounded-lg border p-3 text-left transition hover:border-primary/60 hover:bg-accent/40"
    >
      <span className="mt-0.5 text-muted-foreground">{icon}</span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-medium">{label}</span>
        <span className="block text-xs text-muted-foreground">{sub}</span>
      </span>
    </button>
  );
}

function KeepPanel({
  task,
  todayKey,
  onCancel,
  onConfirm,
}: {
  task: Task;
  todayKey: string;
  onCancel: () => void;
  onConfirm: (newDue: string) => void;
}) {
  // Suggest a realistic date: if task has been moved 2+ times, default a week out;
  // if 1 time, default 3 days out; else tomorrow.
  const suggestion = useMemo(() => {
    const rc = task.rescheduleCount ?? 0;
    const offset = rc >= 2 ? 7 : rc === 1 ? 3 : 1;
    const d = fromKey(todayKey);
    d.setDate(d.getDate() + offset);
    return toKey(d);
  }, [task.rescheduleCount, todayKey]);

  const [value, setValue] = useState(suggestion);
  const rc = task.rescheduleCount ?? 0;

  const quick = useMemo(() => {
    const t = fromKey(todayKey);
    return [
      { label: "Tomorrow", key: shift(t, 1) },
      { label: "In 3 days", key: shift(t, 3) },
      { label: "Next week", key: shift(t, 7) },
    ];
  }, [todayKey]);

  return (
    <div className="space-y-3 rounded-lg border p-3">
      <div className="text-xs text-muted-foreground">
        {rc >= 1
          ? `Moved ${rc} time${rc === 1 ? "" : "s"} already — pick a slot you'll actually keep.`
          : "When can you honestly do this?"}
      </div>
      <div className="flex flex-wrap gap-1.5">
        {quick.map((q) => (
          <button
            key={q.key}
            onClick={() => setValue(q.key)}
            className={cn(
              "rounded border px-2 py-1 text-xs",
              value === q.key
                ? "border-primary bg-primary/10 text-foreground"
                : "text-muted-foreground hover:bg-accent",
            )}
          >
            {q.label}
          </button>
        ))}
      </div>
      <Input
        type="date"
        value={value}
        min={todayKey}
        onChange={(e) => setValue(e.target.value)}
      />
      <div className="flex justify-end gap-2">
        <Button size="sm" variant="ghost" onClick={onCancel}>
          Back
        </Button>
        <Button size="sm" onClick={() => onConfirm(value)}>
          <Check className="mr-1 h-3.5 w-3.5" /> Reschedule
        </Button>
      </div>
    </div>
  );
}

function ShrinkPanel({
  task,
  onCancel,
  onConfirm,
}: {
  task: Task;
  onCancel: () => void;
  onConfirm: (patch: { title: string; scheduledDuration?: number }) => void;
}) {
  const [title, setTitle] = useState(task.title);
  const [dur, setDur] = useState<number>(task.scheduledDuration ?? 15);

  return (
    <div className="space-y-3 rounded-lg border p-3">
      <div className="text-xs text-muted-foreground">
        What's the smallest version you'd actually do? Rename it to that thing.
      </div>
      <Textarea
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        rows={2}
        placeholder="e.g. Draft one paragraph of the memo"
      />
      <div>
        <div className="mb-1 text-xs text-muted-foreground">Duration</div>
        <div className="flex flex-wrap gap-1.5">
          {[10, 15, 25, 45].map((m) => (
            <button
              key={m}
              onClick={() => setDur(m)}
              className={cn(
                "rounded border px-2 py-1 text-xs",
                dur === m
                  ? "border-primary bg-primary/10 text-foreground"
                  : "text-muted-foreground hover:bg-accent",
              )}
            >
              {m}m
            </button>
          ))}
        </div>
      </div>
      <div className="flex justify-end gap-2">
        <Button size="sm" variant="ghost" onClick={onCancel}>
          Back
        </Button>
        <Button
          size="sm"
          onClick={() => onConfirm({ title: title.trim() || task.title, scheduledDuration: dur })}
        >
          <Check className="mr-1 h-3.5 w-3.5" /> Save smaller
        </Button>
      </div>
    </div>
  );
}

function LetGoPanel({
  onCancel,
  onConfirm,
}: {
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <div className="space-y-3 rounded-lg border p-3">
      <div className="text-xs text-muted-foreground">
        Not every task deserves to be done. Archiving isn't failing — it's
        making room. You can restore it from All tasks later.
      </div>
      <div className="flex justify-end gap-2">
        <Button size="sm" variant="ghost" onClick={onCancel}>
          Back
        </Button>
        <Button size="sm" variant="secondary" onClick={onConfirm}>
          <Archive className="mr-1 h-3.5 w-3.5" /> Let it go
        </Button>
      </div>
    </div>
  );
}

function FinishedPanel({ cleared, onClose }: { cleared: number; onClose: () => void }) {
  return (
    <div className="space-y-4 py-3 text-center">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
        <Check className="h-6 w-6 text-primary" />
      </div>
      <div>
        <div className="text-lg font-semibold">You're current.</div>
        <div className="mt-1 text-sm text-muted-foreground">
          {cleared === 0
            ? "Nothing to clear. That itself is progress."
            : `Cleared ${cleared} overdue item${cleared === 1 ? "" : "s"}. Come back to /plan when you're ready.`}
        </div>
      </div>
      <Button onClick={onClose} className="w-full">
        Close
      </Button>
    </div>
  );
}

/* ---- date helpers (local, no TZ surprises) ---- */
function toKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
function fromKey(key: string): Date {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d);
}
function shift(from: Date, days: number): string {
  const d = new Date(from);
  d.setDate(d.getDate() + days);
  return toKey(d);
}
function formatFriendly(key: string): string {
  const d = fromKey(key);
  return d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
}
