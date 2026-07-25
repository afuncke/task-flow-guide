import type { Task, TaskStatus } from "@/lib/tasks/types";
import { TagChip } from "./TagChip";
import { DueBadge } from "./DueBadge";
import { UrgencyBadge } from "./UrgencyBadge";
import { ContextChips } from "./ContextChips";
import { urgency } from "@/lib/tasks/urgency";
import { contextFit, type CurrentState } from "@/lib/tasks/context";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { MoreHorizontal } from "lucide-react";

export function TaskCard({
  task,
  onEdit,
  onMove,
  onDelete,
}: {
  task: Task;
  onEdit: () => void;
  onMove: (status: TaskStatus) => void;
  onDelete: () => void;
}) {
  return (
    <div
      className="group cursor-pointer rounded-lg border bg-card p-3 shadow-sm transition-colors hover:border-primary/40"
      onClick={onEdit}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="text-sm font-medium leading-snug">{task.title}</div>
          {task.notes && (
            <div className="mt-1 line-clamp-2 text-xs text-muted-foreground">{task.notes}</div>
          )}
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 opacity-0 transition-opacity group-hover:opacity-100"
            >
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
            {task.status !== "todo" && (
              <DropdownMenuItem onClick={() => onMove("todo")}>Move to Todo</DropdownMenuItem>
            )}
            {task.status !== "doing" && (
              <DropdownMenuItem onClick={() => onMove("doing")}>Move to Doing</DropdownMenuItem>
            )}
            {task.status !== "done" && (
              <DropdownMenuItem onClick={() => onMove("done")}>Mark done</DropdownMenuItem>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={onDelete} className="text-destructive">
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        {task.tags.map((t) => (
          <TagChip key={t} tag={t} />
        ))}
        <DueBadge due={task.due} />
        {task.priority && (
          <span className="text-[10px] font-semibold text-muted-foreground">
            {task.priority}
          </span>
        )}
        <span className="ml-auto">
          <UrgencyBadge value={urgency(task)} />
        </span>
      </div>
    </div>
  );
}
