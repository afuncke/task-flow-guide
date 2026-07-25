import { CalendarClock } from "lucide-react";
import type { Task } from "@/lib/tasks/types";
import {
  formatMinutes,
  relativeDay,
  type DeadlineRisk,
} from "@/lib/tasks/forecast";
import { Button } from "@/components/ui/button";

/**
 * Early, gentle warning that a deadline and the available time disagree.
 * Framed as a choice, never as a failure.
 */
export function DeadlineForecast({
  risk,
  todayKey,
  tasks,
  onEase,
}: {
  risk: DeadlineRisk | null;
  todayKey: string;
  tasks: Task[];
  onEase: (id: string) => void;
}) {
  if (!risk) return null;

  const when = relativeDay(risk.dueKey, todayKey);
  const candidates = risk.taskIds
    .map((id) => tasks.find((t) => t.id === id))
    .filter((t): t is Task => Boolean(t));
  // Lightest commitment first: no priority, then L, then shortest.
  const easiest = [...candidates].sort((a, b) => {
    const pri = (p: Task["priority"]) => (p === "H" ? 3 : p === "M" ? 2 : p === "L" ? 1 : 0);
    if (pri(a.priority) !== pri(b.priority)) return pri(a.priority) - pri(b.priority);
    return (a.scheduledDuration ?? 30) - (b.scheduledDuration ?? 30);
  })[0];

  return (
    <div className="mb-4 rounded-lg border border-amber-500/40 bg-amber-500/5 p-3">
      <div className="flex flex-wrap items-start gap-3">
        <CalendarClock className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium">
            {risk.taskIds.length} thing{risk.taskIds.length === 1 ? "" : "s"} due by{" "}
            {when} need {formatMinutes(risk.requiredMin)}, and there&rsquo;s{" "}
            {formatMinutes(risk.availableMin)} of working time before then.
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Nothing is late yet — you&rsquo;re {formatMinutes(risk.shortfallMin)} over.
            Moving one date now is easier than moving three later.
          </p>
        </div>
        {easiest && (
          <Button
            variant="outline"
            size="sm"
            className="border-amber-500/40"
            onClick={() => onEase(easiest.id)}
            title={`Give "${easiest.title}" a later date`}
          >
            Give &ldquo;{truncate(easiest.title)}&rdquo; more room
          </Button>
        )}
      </div>
    </div>
  );
}

function truncate(s: string): string {
  return s.length > 24 ? `${s.slice(0, 23)}…` : s;
}
