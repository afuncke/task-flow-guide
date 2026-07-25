import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import type { CalEvent } from "@/lib/tasks/events";

const DURATIONS = [15, 30, 45, 60, 90, 120, 180, 240];

function minToTime(min: number): string {
  const h = String(Math.floor(min / 60)).padStart(2, "0");
  const m = String(min % 60).padStart(2, "0");
  return `${h}:${m}`;
}

function timeToMin(v: string): number {
  const [h, m] = v.split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
}

/**
 * Add or edit a commitment on the calendar. Deliberately tiny: a name,
 * when it starts, how long it takes. Nothing to clarify, nothing to score.
 */
export function EventDialog({
  open,
  onOpenChange,
  dateKey,
  event,
  defaultStartMin = 9 * 60,
  onSave,
  onDelete,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  dateKey: string;
  event?: CalEvent | null;
  defaultStartMin?: number;
  onSave: (data: Omit<CalEvent, "id">) => void;
  onDelete?: (id: string) => void;
}) {
  const [title, setTitle] = useState("");
  const [start, setStart] = useState(minToTime(defaultStartMin));
  const [duration, setDuration] = useState(60);
  const [soft, setSoft] = useState(false);

  useEffect(() => {
    if (!open) return;
    setTitle(event?.title ?? "");
    setStart(minToTime(event?.startMin ?? defaultStartMin));
    setDuration(event?.duration ?? 60);
    setSoft(Boolean(event?.soft));
  }, [open, event, defaultStartMin]);

  const submit = () => {
    const name = title.trim();
    if (!name) return;
    onSave({
      title: name,
      date: event?.date ?? dateKey,
      startMin: timeToMin(start),
      duration,
      soft,
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{event ? "Edit commitment" : "New commitment"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="event-title">What is it?</Label>
            <Input
              id="event-title"
              autoFocus
              value={title}
              placeholder="Standup, dentist, school run…"
              onChange={(e) => setTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") submit();
              }}
            />
          </div>

          <div className="flex gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="event-start">Starts</Label>
              <Input
                id="event-start"
                type="time"
                step={900}
                value={start}
                onChange={(e) => setStart(e.target.value)}
                className="w-32"
              />
            </div>
            <div className="flex-1 space-y-1.5">
              <Label htmlFor="event-duration">For</Label>
              <div className="flex flex-wrap gap-1">
                {DURATIONS.map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setDuration(m)}
                    className={
                      "rounded border px-2 py-1 text-xs " +
                      (duration === m
                        ? "border-primary bg-primary/10 text-primary"
                        : "text-muted-foreground hover:bg-muted")
                    }
                  >
                    {m < 60 ? `${m}m` : `${m / 60}h`}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between rounded-md border p-3">
            <div>
              <div className="text-sm">Flexible</div>
              <p className="text-xs text-muted-foreground">
                Optional or movable — shown, but the day still counts as free.
              </p>
            </div>
            <Switch checked={soft} onCheckedChange={setSoft} />
          </div>
        </div>

        <DialogFooter className="gap-2 sm:justify-between">
          {event && onDelete ? (
            <Button
              variant="ghost"
              className="text-muted-foreground"
              onClick={() => {
                onDelete(event.id);
                onOpenChange(false);
              }}
            >
              Remove
            </Button>
          ) : (
            <span />
          )}
          <Button onClick={submit} disabled={!title.trim()}>
            {event ? "Save" : "Add to the day"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
