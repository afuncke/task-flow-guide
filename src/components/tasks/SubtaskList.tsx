import { useState } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { GripVertical, X } from "lucide-react";
import type { Subtask } from "@/lib/tasks/types";
import { newSubtask, toggleSubtask } from "@/lib/tasks/subtasks";

/**
 * Lightweight checklist inside a single action — for "book flight → passport,
 * seat, insurance". Deliberately not tasks: no dates, no urgency, no guilt.
 */
export function SubtaskList({
  value,
  onChange,
  editable = true,
  compact = false,
}: {
  value: Subtask[];
  onChange: (next: Subtask[]) => void;
  editable?: boolean;
  compact?: boolean;
}) {
  const [draft, setDraft] = useState("");

  const add = () => {
    const t = draft.trim();
    if (!t) return;
    onChange([...value, newSubtask(t)]);
    setDraft("");
  };

  const done = value.filter((s) => s.done).length;

  return (
    <div className="space-y-1.5">
      {value.length > 0 && (
        <div className="space-y-0.5">
          {value.map((s, i) => (
            <div
              key={s.id}
              className="group flex items-center gap-2 rounded-md px-1 py-1 hover:bg-accent/50"
            >
              {editable && !compact && (
                <GripVertical className="hidden h-3 w-3 shrink-0 text-muted-foreground/40 sm:block" />
              )}
              <Checkbox
                checked={s.done}
                onCheckedChange={() => onChange(toggleSubtask(value, s.id))}
                aria-label={s.title}
              />
              {editable && !compact ? (
                <Input
                  value={s.title}
                  onChange={(e) =>
                    onChange(
                      value.map((x) => (x.id === s.id ? { ...x, title: e.target.value } : x)),
                    )
                  }
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      if (i === value.length - 1) {
                        onChange([...value, newSubtask("New step")]);
                      }
                    }
                    if (e.key === "Backspace" && !s.title) {
                      e.preventDefault();
                      onChange(value.filter((x) => x.id !== s.id));
                    }
                  }}
                  className={`h-7 border-0 px-1 text-sm shadow-none focus-visible:ring-0 ${
                    s.done ? "text-muted-foreground line-through" : ""
                  }`}
                />
              ) : (
                <span
                  className={`flex-1 text-sm ${s.done ? "text-muted-foreground line-through" : ""}`}
                >
                  {s.title}
                </span>
              )}
              {editable && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 opacity-0 transition-opacity group-hover:opacity-100"
                  onClick={() => onChange(value.filter((x) => x.id !== s.id))}
                  aria-label={`Remove step ${s.title}`}
                >
                  <X className="h-3 w-3" />
                </Button>
              )}
            </div>
          ))}
        </div>
      )}

      {editable && (
        <Input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              add();
            }
          }}
          onBlur={add}
          placeholder={value.length ? "Add another step" : "Break it into steps (optional)"}
          className="h-8 text-sm"
        />
      )}

      {value.length > 0 && (
        <p className="px-1 text-xs text-muted-foreground">
          {done === value.length
            ? "All steps done — the task itself is still yours to close."
            : `${done} of ${value.length} steps done`}
        </p>
      )}
    </div>
  );
}
