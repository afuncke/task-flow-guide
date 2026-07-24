import { CalendarDays } from "lucide-react";
import { cn } from "@/lib/utils";

const DAY = 1000 * 60 * 60 * 24;

export function DueBadge({ due }: { due?: string }) {
  if (!due) return null;
  const target = new Date(due + "T23:59:59").getTime();
  const days = Math.ceil((target - Date.now()) / DAY);

  let label = new Date(due).toLocaleDateString(undefined, { month: "short", day: "numeric" });
  let tone = "border-border bg-muted/60 text-muted-foreground";
  if (days < 0) {
    label = `Overdue ${Math.abs(days)}d`;
    tone = "border-destructive/30 bg-destructive/10 text-destructive";
  } else if (days === 0) {
    label = "Today";
    tone = "border-destructive/30 bg-destructive/10 text-destructive";
  } else if (days === 1) {
    label = "Tomorrow";
    tone = "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300";
  } else if (days <= 7) {
    label = `In ${days}d`;
    tone = "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300";
  }

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[10px] font-medium leading-none",
        tone,
      )}
    >
      <CalendarDays className="h-3 w-3" />
      {label}
    </span>
  );
}
