import { useState } from "react";
import { Compass, Settings2, X } from "lucide-react";
import { useAreas } from "@/hooks/use-areas";
import { useTasks } from "@/hooks/use-tasks";
import {
  QUIET_AFTER_DAYS,
  areaActivity,
  areaColor,
  areaStore,
  effectiveAreaId,
} from "@/lib/tasks/areas";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export function AreaBar() {
  const { areas, filter } = useAreas();
  const { aliveTasks, hydrated } = useTasks();
  const [manageOpen, setManageOpen] = useState(false);

  if (!hydrated) {
    return <div className="h-9 border-b" aria-hidden />;
  }

  const unassigned = aliveTasks.filter(
    (t) => t.status !== "done" && !t.isProject && !effectiveAreaId(t, aliveTasks),
  ).length;

  return (
    <div className="border-b">
      <div className="mx-auto flex max-w-6xl items-center gap-1.5 overflow-x-auto px-4 py-1.5 text-xs">
        <span
          className="mr-1 flex shrink-0 items-center gap-1 text-muted-foreground"
          title="Areas of responsibility — ongoing standards, not things to finish"
        >
          <Compass className="h-3 w-3" />
          <span className="hidden sm:inline">Areas</span>
        </span>

        <Pill active={filter === null} onClick={() => areaStore.setFilter(null)}>
          All
        </Pill>

        {areas.map((a) => {
          const act = areaActivity(a.id, aliveTasks, aliveTasks);
          const quiet = act.quietDays === undefined || act.quietDays >= QUIET_AFTER_DAYS;
          return (
            <Pill
              key={a.id}
              active={filter === a.id}
              onClick={() => areaStore.setFilter(filter === a.id ? null : a.id)}
              title={
                act.quietDays === undefined
                  ? `${a.name} — nothing planned or done yet`
                  : `${a.name} — last attention ${act.quietDays === 0 ? "today" : `${act.quietDays}d ago`}`
              }
            >
              <span
                className="h-1.5 w-1.5 shrink-0 rounded-full"
                style={{
                  backgroundColor: areaColor(a.hue),
                  opacity: quiet ? 0.35 : 1,
                }}
                aria-hidden
              />
              {a.name}
              {quiet && (
                <span className="text-[10px] text-muted-foreground" aria-label="quiet area">
                  ·
                </span>
              )}
            </Pill>
          );
        })}

        {unassigned > 0 && (
          <Pill
            active={filter === "unassigned"}
            onClick={() => areaStore.setFilter(filter === "unassigned" ? null : "unassigned")}
            title="Actions with no area yet"
          >
            No area
            <span className="text-muted-foreground">{unassigned}</span>
          </Pill>
        )}

        <button
          onClick={() => setManageOpen(true)}
          className="ml-auto shrink-0 rounded-md p-1 text-muted-foreground hover:text-foreground"
          aria-label="Manage areas"
          title="Manage areas"
        >
          <Settings2 className="h-3.5 w-3.5" />
        </button>
      </div>

      <ManageAreas open={manageOpen} onOpenChange={setManageOpen} />
    </div>
  );
}

function Pill({
  active,
  onClick,
  title,
  children,
}: {
  active: boolean;
  onClick: () => void;
  title?: string;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-0.5 transition-colors ${
        active
          ? "border-primary/50 bg-primary/10 text-foreground"
          : "text-muted-foreground hover:text-foreground"
      }`}
    >
      {children}
    </button>
  );
}

function ManageAreas({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const { areas } = useAreas();
  const [name, setName] = useState("");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Areas of responsibility</DialogTitle>
        </DialogHeader>
        <p className="text-xs text-muted-foreground">
          Areas are things you keep in good shape, not things you finish. Six or so is plenty —
          more than that and the balance view stops meaning anything.
        </p>
        <div className="space-y-2">
          {areas.map((a) => (
            <div key={a.id} className="flex items-center gap-2">
              <span
                className="h-2.5 w-2.5 shrink-0 rounded-full"
                style={{ backgroundColor: areaColor(a.hue) }}
                aria-hidden
              />
              <Input
                defaultValue={a.name}
                onBlur={(e) => areaStore.rename(a.id, e.target.value)}
                className="h-8 text-sm"
              />
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 shrink-0 text-muted-foreground"
                onClick={() => areaStore.remove(a.id)}
                aria-label={`Remove ${a.name}`}
              >
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>
          ))}
        </div>
        <div className="flex gap-2">
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Add an area — e.g. Community"
            className="h-8 text-sm"
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                areaStore.add(name);
                setName("");
              }
            }}
          />
          <Button
            size="sm"
            onClick={() => {
              areaStore.add(name);
              setName("");
            }}
            disabled={!name.trim()}
          >
            Add
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
