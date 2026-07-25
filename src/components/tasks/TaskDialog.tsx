import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { TagChip } from "./TagChip";
import type { Task, TaskPriority } from "@/lib/tasks/types";
import {
  DURATIONS,
  DURATION_LABEL,
  ENERGIES,
  ENERGY_LABEL,
  LOCATIONS,
  LOCATION_LABEL,
  WORK_WINDOWS,
  WORK_WINDOW_LABEL,
  type Duration,
  type Energy,
  type Location,
  type TaskContext,
  type WorkWindow,
} from "@/lib/tasks/context";
import { useAreas } from "@/hooks/use-areas";
import { areaColor } from "@/lib/tasks/areas";

export interface TaskDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  task?: Task | null;
  defaultDue?: string;
  knownTags: string[];
  onSave: (data: {
    title: string;
    notes?: string;
    tags: string[];
    priority: TaskPriority;
    due?: string;
    context?: TaskContext;
    scheduledDuration?: number;
    areaId?: string;
  }) => void;
  onDelete?: () => void;
}


const DURATION_PRESETS = [15, 30, 45, 60, 90];

export function TaskDialog({
  open,
  onOpenChange,
  task,
  defaultDue,
  knownTags,
  onSave,
  onDelete,
}: TaskDialogProps) {
  const { areas } = useAreas();
  const [title, setTitle] = useState("");
  const [notes, setNotes] = useState("");
  const [areaId, setAreaId] = useState<string>("none");
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState("");
  const [priority, setPriority] = useState<TaskPriority>(null);
  const [due, setDue] = useState<string>("");
  const [duration, setDuration] = useState<number | "">("");
  const [ctxLocation, setCtxLocation] = useState<Location>("anywhere");
  const [ctxEnergy, setCtxEnergy] = useState<Energy>("any");
  const [ctxDuration, setCtxDuration] = useState<Duration>("any");
  const [ctxWorkWindow, setCtxWorkWindow] = useState<WorkWindow>("any");


  useEffect(() => {
    if (open) {
      setTitle(task?.title ?? "");
      setNotes(task?.notes ?? "");
      setTags(task?.tags ?? []);
      setTagInput("");
      setPriority(task?.priority ?? null);
      setDue(task?.due ?? defaultDue ?? "");
      setDuration(task?.scheduledDuration ?? "");
      setCtxLocation(task?.context?.location ?? "anywhere");
      setCtxEnergy(task?.context?.energy ?? "any");
      setCtxDuration(task?.context?.duration ?? "any");
      setCtxWorkWindow(task?.context?.workWindow ?? "any");
    }
  }, [open, task, defaultDue]);

  const commitTag = (raw: string) => {
    const t = raw.trim().replace(/^#/, "").toLowerCase();
    if (!t) return;
    if (tags.includes(t)) return;
    setTags([...tags, t]);
    setTagInput("");
  };

  const suggestions = tagInput
    ? knownTags.filter((t) => t.startsWith(tagInput.toLowerCase()) && !tags.includes(t)).slice(0, 5)
    : [];

  const submit = () => {
    if (!title.trim()) return;
    const context: TaskContext = {
      location: ctxLocation,
      energy: ctxEnergy,
      duration: ctxDuration,
      workWindow: ctxWorkWindow,
    };
    const hasCtx =
      ctxLocation !== "anywhere" ||
      ctxEnergy !== "any" ||
      ctxDuration !== "any" ||
      ctxWorkWindow !== "any";
    onSave({
      title: title.trim(),
      notes: notes.trim() || undefined,
      tags,
      priority,
      due: due || undefined,
      context: hasCtx ? context : undefined,
      scheduledDuration: typeof duration === "number" && duration > 0 ? duration : undefined,
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{task ? "Edit task" : "New task"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="title">Title</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              autoFocus
              placeholder="What needs to happen?"
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) submit();
              }}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              placeholder="Optional context"
            />
          </div>

          <div className="space-y-1.5">
            <Label>Tags</Label>
            <div className="flex flex-wrap gap-1.5">
              {tags.map((t) => (
                <TagChip key={t} tag={t} onRemove={() => setTags(tags.filter((x) => x !== t))} />
              ))}
            </div>
            <Input
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              placeholder="Add tag and press Enter"
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === ",") {
                  e.preventDefault();
                  commitTag(tagInput);
                } else if (e.key === "Backspace" && !tagInput && tags.length) {
                  setTags(tags.slice(0, -1));
                }
              }}
            />
            {suggestions.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {suggestions.map((s) => (
                  <TagChip key={s} tag={s} onClick={() => commitTag(s)} />
                ))}
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Priority</Label>
              <Select
                value={priority ?? "none"}
                onValueChange={(v) => setPriority(v === "none" ? null : (v as TaskPriority))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  <SelectItem value="L">Low</SelectItem>
                  <SelectItem value="M">Medium</SelectItem>
                  <SelectItem value="H">High</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="due">Due</Label>
              <Input id="due" type="date" value={due} onChange={(e) => setDue(e.target.value)} />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="duration">Estimated duration</Label>
            <div className="flex flex-wrap items-center gap-1.5">
              {DURATION_PRESETS.map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setDuration(m)}
                  className={`rounded-md border px-2 py-1 text-xs transition-colors ${
                    duration === m
                      ? "border-primary bg-primary/10 text-foreground"
                      : "text-muted-foreground hover:border-primary/40 hover:text-foreground"
                  }`}
                >
                  {m}m
                </button>
              ))}
              <Input
                id="duration"
                type="number"
                min={1}
                step={5}
                value={duration === "" ? "" : duration}
                onChange={(e) => {
                  const v = e.target.value;
                  setDuration(v === "" ? "" : Math.max(1, Number(v)));
                }}
                placeholder="Custom"
                className="h-8 w-24 text-xs"
              />
              {duration !== "" && (
                <button
                  type="button"
                  onClick={() => setDuration("")}
                  className="text-xs text-muted-foreground hover:text-foreground"
                >
                  Clear
                </button>
              )}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs uppercase tracking-wide text-muted-foreground">
              When it fits
            </Label>
            <div className="grid grid-cols-2 gap-3">
              <CtxSelect
                label="Location"
                value={ctxLocation}
                onChange={(v) => setCtxLocation(v as Location)}
                options={LOCATIONS.map((v) => ({ value: v, label: LOCATION_LABEL[v] }))}
              />
              <CtxSelect
                label="Energy"
                value={ctxEnergy}
                onChange={(v) => setCtxEnergy(v as Energy)}
                options={ENERGIES.map((v) => ({ value: v, label: ENERGY_LABEL[v] }))}
              />
              <CtxSelect
                label="Duration"
                value={ctxDuration}
                onChange={(v) => setCtxDuration(v as Duration)}
                options={DURATIONS.map((v) => ({ value: v, label: DURATION_LABEL[v] }))}
              />
              <CtxSelect
                label="Work window"
                value={ctxWorkWindow}
                onChange={(v) => setCtxWorkWindow(v as WorkWindow)}
                options={WORK_WINDOWS.map((v) => ({ value: v, label: WORK_WINDOW_LABEL[v] }))}
              />
            </div>
          </div>
        </div>

        <DialogFooter className="flex-col-reverse gap-2 sm:flex-row sm:justify-between">
          <div>
            {task && onDelete && (
              <Button
                variant="ghost"
                className="text-destructive"
                onClick={() => {
                  onDelete();
                  onOpenChange(false);
                }}
              >
                Delete
              </Button>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button onClick={submit} disabled={!title.trim()}>
              {task ? "Save" : "Add task"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CtxSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <div className="space-y-1">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="h-8 text-xs">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map((o) => (
            <SelectItem key={o.value} value={o.value} className="text-xs">
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
