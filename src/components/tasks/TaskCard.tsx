import type { Task, TaskStatus } from "@/lib/tasks/types";
import { TagChip } from "./TagChip";
import { DueBadge } from "./DueBadge";
import { UrgencyBadge } from "./UrgencyBadge";
import { ContextChips } from "./ContextChips";
import { AreaChip } from "./AreaChip";
import { useAreas } from "@/hooks/use-areas";
import { urgency } from "@/lib/tasks/urgency";
import { subtaskProgress } from "@/lib/tasks/subtasks";
import { contextFit, type CurrentState } from "@/lib/tasks/context";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { ListChecks, MoreHorizontal } from "lucide-react";

export function TaskCard({
  task,
  onEdit,
  onMove,
  onDelete,
  currentState,
}: {
  task: Task;
  onEdit: () => void;
  onMove: (status: TaskStatus) => void;
  onDelete: () => void;
  currentState?: CurrentState;
}) {
  const fits = currentState ? contextFit(task, currentState) : true;
  const steps = subtaskProgress(task);
  const { areaById } = useAreas();

  return (
    <div
      className={`group cursor-pointer rounded-lg border bg-card p-3 shadow-sm transition-colors hover:border-primary/40 ${fits ? "" : "opacity-60"}`}
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
        <AreaChip area={areaById(task.areaId)} />
        {task.tags.map((t) => (
          <TagChip key={t} tag={t} />
        ))}

        <DueBadge due={task.due} />
        {steps && (
          <span
            className="inline-flex items-center gap-1 rounded border px-1.5 text-[10px] text-muted-foreground"
            title={`${steps.done} of ${steps.total} steps done`}
          >
            <ListChecks className="h-3 w-3" />
            {steps.done}/{steps.total}
          </span>
        )}
        <ContextChips context={task.context} muted={!fits} />
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
