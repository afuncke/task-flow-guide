import { areaColor } from "@/lib/tasks/areas";
import { formatMinutes, type AreaShare } from "@/lib/tasks/day-budget";
import type { Area } from "@/lib/tasks/areas";
import { cn } from "@/lib/utils";

const NEUTRAL_HUE = 220;

/**
 * How today's committed time is spread across areas of responsibility.
 * Purely descriptive — it names the shape of the day so imbalance is a
 * choice rather than something you notice weeks later.
 */
export function AreaBalance({
  split,
  untouched = [],
  className,
}: {
  split: AreaShare[];
  untouched?: Area[];
  className?: string;
}) {
  if (split.length === 0) return null;

  return (
    <div className={cn("w-full", className)}>
      <div className="flex h-1.5 w-full overflow-hidden rounded-full bg-muted">
        {split.map((s) => (
          <div
            key={s.area?.id ?? "unassigned"}
            className="h-full"
            style={{
              width: `${s.share * 100}%`,
              backgroundColor: s.area
                ? areaColor(s.area.hue)
                : `hsl(${NEUTRAL_HUE} 8% 60%)`,
            }}
            title={`${s.area?.name ?? "No area"} · ${formatMinutes(s.minutes)}`}
          />
        ))}
      </div>
      <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px]">
        {split.map((s) => (
          <span
            key={s.area?.id ?? "unassigned"}
            className="inline-flex items-center gap-1 text-muted-foreground"
          >
            <span
              className="h-1.5 w-1.5 rounded-full"
              style={{
                backgroundColor: s.area
                  ? areaColor(s.area.hue)
                  : `hsl(${NEUTRAL_HUE} 8% 60%)`,
              }}
              aria-hidden
            />
            {s.area?.name ?? "No area"} {Math.round(s.share * 100)}%
          </span>
        ))}
        {untouched.length > 0 && (
          <span className="text-muted-foreground/70">
            No time today for {untouched.map((a) => a.name).join(", ")} — fine for
            one day.
          </span>
        )}
      </div>
    </div>
  );
}
