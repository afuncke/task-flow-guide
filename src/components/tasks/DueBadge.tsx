import { cn } from "@/lib/utils";

const DAY = 1000 * 60 * 60 * 24;

export function DueBadge({ due }: { due?: string }) {
  if (!due) return null;
  const target = new Date(due + "T23:59:59").getTime();
  const days = Math.ceil((target - Date.now()) / DAY);

  let label = new Date(due).toLocaleDateString(undefined, { month: "short", day: "numeric" });
  let tone = "text-muted-foreground";
  if (days < 0) {
    label = `Overdue ${Math.abs(days)}d`;
    tone = "text-destructive";
  } else if (days === 0) {
    label = "Due today";
    tone = "text-destructive";
  } else if (days === 1) {
    label = "Due tomorrow";
    tone = "text-amber-600 dark:text-amber-400";
  } else if (days <= 7) {
    label = `Due in ${days}d`;
    tone = "text-amber-600 dark:text-amber-400";
  }

  return <span className={cn("text-xs", tone)}>{label}</span>;
}
