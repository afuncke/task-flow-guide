import { useEffect, useState } from "react";
import { useSyncExternalStore } from "react";
import { RotateCcw, X } from "lucide-react";
import { UNDO_WINDOW_MS, undoStore } from "@/lib/tasks/undo";

/**
 * The app's answer to "Are you sure?": act first, offer the way back.
 * Sits above everything, disappears on its own, never blocks the page.
 */
export function UndoBar() {
  const stack = useSyncExternalStore(
    undoStore.subscribe,
    undoStore.getSnapshot,
    undoStore.getServerSnapshot,
  );
  const latest = stack[stack.length - 1];
  const [, tick] = useState(0);

  useEffect(() => {
    if (!latest) return;
    const id = window.setTimeout(() => tick((n) => n + 1), UNDO_WINDOW_MS + 50);
    return () => window.clearTimeout(id);
  }, [latest]);

  if (!latest) return null;
  if (Date.now() - latest.at > UNDO_WINDOW_MS) return null;

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-4 z-50 flex justify-center px-4">
      <div className="pointer-events-auto flex items-center gap-3 rounded-full border bg-card/95 py-1.5 pl-4 pr-1.5 text-sm shadow-lg backdrop-blur">
        <span className="max-w-[50vw] truncate text-muted-foreground">{latest.label}</span>
        <button
          onClick={() => undoStore.undo()}
          className="inline-flex items-center gap-1 rounded-full bg-primary px-3 py-1 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/90"
        >
          <RotateCcw className="h-3 w-3" /> Undo
          <kbd className="ml-1 font-mono text-[10px] opacity-70">u</kbd>
        </button>
        <button
          onClick={() => undoStore.dismiss()}
          className="rounded-full p-1.5 text-muted-foreground hover:text-foreground"
          aria-label="Dismiss"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}
