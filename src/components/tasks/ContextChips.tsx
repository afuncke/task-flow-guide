import { Briefcase, Coffee, MapPin, Timer, Zap } from "lucide-react";
import {
  DURATION_LABEL,
  ENERGY_LABEL,
  LOCATION_LABEL,
  WORK_WINDOW_LABEL,
  type TaskContext,
} from "@/lib/tasks/context";

export function ContextChips({
  context,
  muted = false,
}: {
  context?: TaskContext;
  muted?: boolean;
}) {
  if (!context) return null;
  const chips: { icon: React.ReactNode; label: string }[] = [];

  if (context.location && context.location !== "anywhere") {
    chips.push({ icon: <MapPin className="h-3 w-3" />, label: LOCATION_LABEL[context.location] });
  }
  if (context.energy && context.energy !== "any") {
    chips.push({ icon: <Zap className="h-3 w-3" />, label: ENERGY_LABEL[context.energy] });
  }
  if (context.duration && context.duration !== "any") {
    chips.push({ icon: <Timer className="h-3 w-3" />, label: DURATION_LABEL[context.duration] });
  }
  if (context.workWindow && context.workWindow !== "any") {
    chips.push({
      icon:
        context.workWindow === "work" ? (
          <Briefcase className="h-3 w-3" />
        ) : (
          <Coffee className="h-3 w-3" />
        ),
      label: WORK_WINDOW_LABEL[context.workWindow],
    });
  }

  if (chips.length === 0) return null;

  const base = muted
    ? "border-dashed text-muted-foreground/70"
    : "text-muted-foreground";

  return (
    <>
      {chips.map((c) => (
        <span
          key={c.label}
          className={`inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[10px] ${base}`}
        >
          {c.icon}
          {c.label}
        </span>
      ))}
    </>
  );
}
