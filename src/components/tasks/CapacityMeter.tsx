import { formatMinutes, type DayBudget } from "@/lib/tasks/day-budget";
import { cn } from "@/lib/utils";

/**
 * Live capacity budget. Shows what you've committed against what the day
 * actually holds, while you're still choosing.
 *
 * Never blocks, never scolds — over-commitment is shown as a plain fact
 * with a way out ("something can wait"), not as failure.
 */
export function CapacityMeter({
  budget,
  label = "Committed",
  className,
  compact = false,
}: {
  budget: DayBudget;
  label?: string;
  className?: string;
  compact?: boolean;
}) {
  const fit = Math.min(1, budget.committed / Math.max(1, budget.remaining));
  const overFrac = budget.over
    ? Math.min(1, budget.overBy / Math.max(1, budget.remaining))
    : 0;

  return (
    <div className={cn("w-full", className)}>
      <div className="flex h-2 w-full overflow-hidden rounded-full bg-muted">
        <div
          className={cn(
            "h-full rounded-l-full transition-all duration-300",
            budget.over ? "bg-amber-500" : "bg-primary",
          )}
          style={{ width: `${fit * 100}%` }}
        />
        {overFrac > 0 && (
          <div
            className="h-full bg-amber-500/35 transition-all duration-300"
            style={{ width: `${overFrac * 100}%` }}
          />
        )}
      </div>
      {!compact && (
        <div className="mt-1 flex flex-wrap items-baseline justify-between gap-x-2 text-[11px]">
          <span className="text-muted-foreground">
            {label} {formatMinutes(budget.committed)} of{" "}
            {formatMinutes(budget.remaining)} left today
          </span>
          <span
            className={cn(
              budget.over
                ? "text-amber-600 dark:text-amber-400"
                : "text-muted-foreground",
            )}
          >
            {budget.over
              ? `${formatMinutes(budget.overBy)} more than the day holds — something can wait`
              : `${formatMinutes(budget.free)} of room left`}
          </span>
        </div>
      )}
    </div>
  );
}
