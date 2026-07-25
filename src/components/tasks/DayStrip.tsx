import { useMemo } from "react";
import { Link } from "@tanstack/react-router";
import { Clock } from "lucide-react";
import { useTasks } from "@/hooks/use-tasks";
import { useContextState } from "@/hooks/use-context-state";
import {
  clockTime,
  humanDuration,
  minutesLeftInWindow,
  useTimeOfDay,
  windowProgress,
} from "@/lib/time-of-day";

/**
 * Time-blindness aids, in one calm strip.
 *
 * Makes three invisible things visible: what time it actually is, how much of
 * the day is left, and how far away the next commitment is. No countdown
 * pressure, no red — just the shape of the remaining day.
 */
export function DayStrip() {
  const { now, meta, phase } = useTimeOfDay();
  const { tasks, hydrated } = useTasks();
  const { stored } = useContextState();

  const next = useMemo(() => {
    if (!now) return undefined;
    const t = now.getTime();
    return tasks
      .filter((x) => x.status !== "done" && x.scheduledStart)
      .filter(
        (x) =>
          new Date(x.scheduledStart!).getTime() + (x.scheduledDuration ?? 0) * 60_000 >= t,
      )
      .sort(
        (a, b) =>
          new Date(a.scheduledStart!).getTime() - new Date(b.scheduledStart!).getTime(),
      )[0];
  }, [tasks, now]);

  if (!now || !hydrated) return null;

  const { start, end } = stored.schedule;
  const hour = now.getHours() + now.getMinutes() / 60;
  const inWindow = hour >= start && hour < end;
  const leftInWindow = minutesLeftInWindow(now, end);
  const progress = windowProgress(now, start, end);

  const nextStart = next ? new Date(next.scheduledStart!) : undefined;
  const minsToNext = nextStart ? (nextStart.getTime() - now.getTime()) / 60_000 : undefined;
  const running = minsToNext !== undefined && minsToNext <= 0;

  return (
    <div className="border-b bg-background/60">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-4 gap-y-1 px-4 py-1.5 text-xs">
        <span className="inline-flex items-center gap-1.5 font-medium">
          <Clock className="h-3.5 w-3.5 text-muted-foreground" />
          {clockTime(now)}
          <span className="text-muted-foreground">· {meta.label}</span>
        </span>

        <span className="text-muted-foreground" title={meta.hint}>
          {inWindow
            ? `${humanDuration(leftInWindow)} left of your day`
            : phase === "night"
              ? "The day is over. This can wait."
              : "Outside your work window"}
        </span>

        {inWindow && (
          <span className="hidden h-1 w-40 overflow-hidden rounded-full bg-muted sm:block">
            <span
              className="block h-full bg-primary/50"
              style={{ width: `${Math.round(progress * 100)}%` }}
            />
          </span>
        )}

        {next && nextStart && (
          <Link
            to="/plan"
            className="ml-auto inline-flex min-w-0 items-center gap-1.5 text-muted-foreground transition-colors hover:text-foreground"
            title={`Scheduled for ${clockTime(nextStart)}`}
          >
            <span className="shrink-0">
              {running ? "Now:" : `In ${humanDuration(minsToNext!)}:`}
            </span>
            <span className="truncate text-foreground">{next.title}</span>
            <span className="shrink-0 text-muted-foreground/80">{clockTime(nextStart)}</span>
          </Link>
        )}
      </div>
    </div>
  );
}
