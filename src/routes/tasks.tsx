import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useTasks } from "@/hooks/use-tasks";
import { useAreas } from "@/hooks/use-areas";
import { matchesArea } from "@/lib/tasks/areas";
import { useContextState } from "@/hooks/use-context-state";
import { rankTasks, urgency } from "@/lib/tasks/urgency";
import { contextFit } from "@/lib/tasks/context";
import type { Task } from "@/lib/tasks/types";
import { TaskDialog } from "@/components/tasks/TaskDialog";
import { TagFilterBar } from "@/components/tasks/TagFilterBar";
import { TagChip } from "@/components/tasks/TagChip";
import { DueBadge } from "@/components/tasks/DueBadge";
import { UrgencyBadge } from "@/components/tasks/UrgencyBadge";
import { ContextChips } from "@/components/tasks/ContextChips";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/tasks")({
  head: () => ({
    meta: [
      { title: "All tasks — Shenas" },
      { name: "description", content: "Flat list of every task with filters and sorting." },
      { property: "og:title", content: "All tasks — Shenas" },
      { property: "og:description", content: "Flat list of every task with filters and sorting." },
    ],
  }),
  component: ListPage,
});

type SortKey = "urgency" | "due" | "created";

function ListPage() {
  const { tasks, hydrated, addTask, updateTask, setStatus, deleteTask } = useTasks();
  const { currentState, stored } = useContextState();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Task | null>(null);
  const [activeTags, setActiveTags] = useState<string[]>([]);
  const [sort, setSort] = useState<SortKey>("urgency");
  const [showDone, setShowDone] = useState(false);

  const knownTags = useMemo(
    () => Array.from(new Set(tasks.flatMap((t) => t.tags))).sort(),
    [tasks],
  );

  const rows = useMemo(() => {
    let list = tasks;
    if (!showDone) list = list.filter((t) => t.status !== "done");
    if (activeTags.length > 0) {
      list = list.filter((t) => activeTags.every((tag) => t.tags.includes(tag)));
    }
    if (stored.hideMismatches) {
      list = list.filter((t) => contextFit(t, currentState));
    }
    if (sort === "urgency") return rankTasks(list, currentState);
    if (sort === "due") {
      return [...list].sort((a, b) => (a.due ?? "9999").localeCompare(b.due ?? "9999"));
    }
    return [...list].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }, [tasks, activeTags, sort, showDone, stored.hideMismatches, currentState]);

  if (!hydrated) return null;

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <TagFilterBar
          tags={knownTags}
          active={activeTags}
          onToggle={(t) =>
            setActiveTags((a) => (a.includes(t) ? a.filter((x) => x !== t) : [...a, t]))
          }
          onClear={() => setActiveTags([])}
        />
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Checkbox
              checked={showDone}
              onCheckedChange={(v) => setShowDone(v === true)}
            />
            Show done
          </label>
          <Select value={sort} onValueChange={(v) => setSort(v as SortKey)}>
            <SelectTrigger className="h-8 w-36 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="urgency">Sort: Urgency</SelectItem>
              <SelectItem value="due">Sort: Due date</SelectItem>
              <SelectItem value="created">Sort: Newest</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="overflow-hidden rounded-lg border">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-xs text-muted-foreground">
            <tr>
              <th className="w-8 px-3 py-2 text-left"></th>
              <th className="px-3 py-2 text-left">Title</th>
              <th className="px-3 py-2 text-left">Tags</th>
              <th className="px-3 py-2 text-left">Due</th>
              <th className="px-3 py-2 text-left">Pri</th>
              <th className="px-3 py-2 text-right">Urg</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((t) => (
              <tr
                key={t.id}
                className="cursor-pointer border-t hover:bg-accent/40"
                onClick={() => {
                  setEditing(t);
                  setDialogOpen(true);
                }}
              >
                <td className="px-3 py-2" onClick={(e) => e.stopPropagation()}>
                  <Checkbox
                    checked={t.status === "done"}
                    onCheckedChange={(v) => setStatus(t.id, v === true ? "done" : "todo")}
                  />
                </td>
                <td className={`px-3 py-2 ${t.status === "done" ? "text-muted-foreground line-through" : ""}`}>
                  {t.title}
                </td>
                <td className="px-3 py-2">
                  <div className="flex flex-wrap gap-1">
                    {t.tags.map((tag) => (
                      <TagChip key={tag} tag={tag} />
                    ))}
                  </div>
                </td>
                <td className="px-3 py-2">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <DueBadge due={t.due} />
                    <ContextChips context={t.context} muted={!contextFit(t, currentState)} />
                  </div>
                </td>
                <td className="px-3 py-2 text-xs text-muted-foreground">{t.priority ?? "—"}</td>
                <td className="px-3 py-2 text-right">
                  <UrgencyBadge value={urgency(t)} />
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={6} className="px-3 py-10 text-center text-sm text-muted-foreground">
                  No tasks match.{" "}
                  <Button
                    variant="link"
                    className="h-auto p-0"
                    onClick={() => {
                      setEditing(null);
                      setDialogOpen(true);
                    }}
                  >
                    Add one
                  </Button>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <TaskDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        task={editing}
        knownTags={knownTags}
        onSave={(data) => {
          if (editing) updateTask(editing.id, data);
          else addTask(data);
        }}
        onDelete={editing ? () => deleteTask(editing.id) : undefined}
      />
    </div>
  );
}
