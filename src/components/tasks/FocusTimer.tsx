import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import type { Task } from "@/lib/tasks/types";
import { Play, Pause, Check, Plus, X } from "lucide-react";
import { clockTime } from "@/lib/time-of-day";

/**
 * Small session timer for the current focus task.
 * Starts when the task becomes `doing`; tracks elapsed seconds.
 * When the planned duration is reached, offers Done / Extend / Stop.
 */
export function FocusTimer({
  task,
  onStart,
  onPause,
  onDone,
  onExtend,
}: {
  task: Task;
  onStart: () => void;
  onPause: () => void;
  onDone: (actualMinutes: number) => void;
  onExtend: (extraMinutes: number) => void;
}) {
  const [elapsedSec, setElapsedSec] = useState(0);
  const startedAtRef = useRef<number | null>(null);

  const planned = task.scheduledDuration ?? 25;
  const running = task.status === "doing";

  // Reset when task changes
  useEffect(() => {
    setElapsedSec(0);
    startedAtRef.current = null;
  }, [task.id]);

  useEffect(() => {
    if (!running) {
      startedAtRef.current = null;
      return;
    }
    startedAtRef.current = Date.now() - elapsedSec * 1000;
    const id = window.setInterval(() => {
      if (startedAtRef.current != null) {
        setElapsedSec(Math.floor((Date.now() - startedAtRef.current) / 1000));
      }
    }, 500);
    return () => window.clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running]);

  const totalSec = planned * 60;
  const remainSec = Math.max(0, totalSec - elapsedSec);
  const overtime = elapsedSec > totalSec;
  const pct = Math.min(100, (elapsedSec / totalSec) * 100);
  // Time-blindness aid: name the wall-clock moment this block lands on,
  // not just an abstract countdown.
  const endsAt = running ? new Date(Date.now() + remainSec * 1000) : undefined;

  return (
    <div className="rounded-lg border bg-card p-4">
      <div className="flex items-baseline justify-between">
        <div className="font-mono text-2xl tabular-nums">
          {overtime ? "+" : ""}
          {formatClock(overtime ? elapsedSec - totalSec : remainSec)}
        </div>
        <div className="text-xs text-muted-foreground">
          {planned}m planned
          {elapsedSec > 0 && ` · ${Math.round(elapsedSec / 60)}m elapsed`}
          {endsAt && !overtime && ` · ends ${clockTime(endsAt)}`}
        </div>
      </div>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
        <div
          className={`h-full transition-all ${overtime ? "bg-amber-500" : "bg-primary"}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        {running ? (
          <Button size="sm" variant="outline" onClick={onPause}>
            <Pause className="mr-1 h-3.5 w-3.5" /> Pause
          </Button>
        ) : (
          <Button size="sm" onClick={onStart}>
            <Play className="mr-1 h-3.5 w-3.5" /> Start
          </Button>
        )}
        <Button
          size="sm"
          variant="outline"
          onClick={() => onDone(Math.max(1, Math.round(elapsedSec / 60)))}
        >
          <Check className="mr-1 h-3.5 w-3.5" /> Done
        </Button>
        {overtime && (
          <Button size="sm" variant="ghost" onClick={() => onExtend(10)}>
            <Plus className="mr-1 h-3.5 w-3.5" /> +10m
          </Button>
        )}
        {elapsedSec > 0 && (
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              setElapsedSec(0);
              startedAtRef.current = null;
            }}
          >
            <X className="mr-1 h-3.5 w-3.5" /> Reset
          </Button>
        )}
      </div>
    </div>
  );
}

function formatClock(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}
