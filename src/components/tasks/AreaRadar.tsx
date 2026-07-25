import { useMemo } from "react";
import { Compass } from "lucide-react";
import { useAreas } from "@/hooks/use-areas";
import { useTasks } from "@/hooks/use-tasks";
import { QUIET_AFTER_DAYS, areaColor, areaStore, quietAreas } from "@/lib/tasks/areas";

/**
 * Neglect radar. Reports drift, never guilt: "Health has been quiet" — no
 * streaks, no red, no scolding.
 */
export function AreaRadar() {
  const { areas } = useAreas();
  const { aliveTasks, hydrated } = useTasks();

  const quiet = useMemo(() => quietAreas(areas, aliveTasks).slice(0, 3), [areas, aliveTasks]);

  if (!hydrated || quiet.length === 0) return null;

  return (
    <div className="mb-4 rounded-lg border bg-muted/30 px-3 py-2">
      <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-wide text-muted-foreground">
        <Compass className="h-3 w-3" />
        Quiet areas
      </div>
      <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs">
        {quiet.map(({ area, activity }) => (
          <button
            key={area.id}
            onClick={() => areaStore.setFilter(area.id)}
            className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-muted-foreground transition-colors hover:text-foreground"
            title={`Show only ${area.name}`}
          >
            <span
              className="h-1.5 w-1.5 rounded-full"
              style={{ backgroundColor: areaColor(area.hue) }}
              aria-hidden
            />
            {area.name}
            <span className="text-muted-foreground/80">
              {activity.quietDays === undefined
                ? "nothing planned yet"
                : `${activity.quietDays}d`}
            </span>
          </button>
        ))}
      </div>
      <p className="mt-1.5 text-[11px] text-muted-foreground">
        Nothing scheduled or finished here in {QUIET_AFTER_DAYS}+ days. Sometimes that's exactly
        right — if not, one small block today is enough.
      </p>
    </div>
  );
}
