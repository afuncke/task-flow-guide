import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

interface Row {
  keys: string[];
  desc: string;
}

const NAV: Row[] = [
  { keys: ["g", "i"], desc: "Go to Inbox" },
  { keys: ["g", "p"], desc: "Go to Plan" },
  { keys: ["g", "f"], desc: "Go to Focus" },
  { keys: ["g", "r"], desc: "Go to Projects" },
  { keys: ["g", "b"], desc: "Go to Board" },
  { keys: ["g", "c"], desc: "Go to Calendar" },
  { keys: ["g", "t"], desc: "Go to All tasks" },
];

const ACTIONS: Row[] = [
  { keys: ["c"], desc: "Capture to inbox" },
  { keys: ["n"], desc: "Quick capture (same as c)" },
  { keys: ["a"], desc: "Cycle area filter" },
  { keys: ["u"], desc: "Undo last change" },
  { keys: ["s"], desc: "Jump to next scheduled block" },


  { keys: ["["], desc: "Previous day / month" },
  { keys: ["]"], desc: "Next day / month" },
  { keys: ["T"], desc: "Jump to today" },
  { keys: ["R"], desc: "Re-run planning ritual" },
  { keys: ["L"], desc: "Soft landing for overdue tasks" },
  { keys: ["E"], desc: "Close the day (shutdown ritual)" },
  { keys: ["m"], desc: "Add a meeting / commitment" },


  { keys: ["p"], desc: "Toggle playful mode" },
  { keys: ["Esc"], desc: "Close dialog / blur input" },
  { keys: ["?"], desc: "Show this help" },
];

export function KeyboardHelp({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Keyboard shortcuts</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 text-sm">
          <Section title="Navigation" rows={NAV} />
          <Section title="Actions" rows={ACTIONS} />
          <p className="text-xs text-muted-foreground">
            Shortcuts are ignored while typing in a field.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Section({ title, rows }: { title: string; rows: Row[] }) {
  return (
    <div>
      <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {title}
      </div>
      <div className="space-y-1.5">
        {rows.map((r) => (
          <div key={r.desc} className="flex items-center justify-between">
            <span className="text-sm">{r.desc}</span>
            <span className="flex gap-1">
              {r.keys.map((k, i) => (
                <kbd
                  key={i}
                  className="rounded border bg-muted px-1.5 py-0.5 font-mono text-[11px] text-foreground"
                >
                  {k}
                </kbd>
              ))}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
