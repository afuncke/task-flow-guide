import { useEffect, useRef, useState } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Inbox } from "lucide-react";
import { captureStore, useCaptureOpen } from "@/lib/tasks/capture-store";
import { useTasks } from "@/hooks/use-tasks";
import { soundPop } from "@/lib/playful/sound";

/**
 * Ubiquitous capture (GTD): one line, no decisions, goes straight to the inbox.
 * Stays open after Enter so a brain-dump doesn't need re-opening.
 */
export function CaptureBar() {
  const open = useCaptureOpen();
  const { addTask } = useTasks();
  const [value, setValue] = useState("");
  const [count, setCount] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setValue("");
      setCount(0);
      const id = window.setTimeout(() => inputRef.current?.focus(), 50);
      return () => window.clearTimeout(id);
    }
  }, [open]);

  const commit = () => {
    const title = value.trim();
    if (!title) return;
    addTask({ title, tags: [], priority: null, bucket: "inbox" });
    setValue("");
    setCount((c) => c + 1);
    try {
      soundPop();
    } catch {
      /* ignore */
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => (v ? captureStore.open() : captureStore.close())}>
      <DialogContent className="top-24 translate-y-0 sm:max-w-xl">
        <div className="flex items-center gap-2">
          <Inbox className="h-4 w-4 shrink-0 text-muted-foreground" />
          <Input
            ref={inputRef}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="Get it out of your head…"
            className="border-0 px-0 text-base shadow-none focus-visible:ring-0"
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                commit();
              } else if (e.key === "Escape") {
                captureStore.close();
              }
            }}
          />
        </div>
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>
            {count === 0
              ? "Enter to capture — no need to decide anything yet."
              : `${count} captured. Keep going, or Esc to close.`}
          </span>
          <span className="hidden sm:inline">Sorts into Inbox</span>
        </div>
      </DialogContent>
    </Dialog>
  );
}
