import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useTasks } from "@/hooks/use-tasks";
import { captureStore } from "@/lib/tasks/capture-store";
import type { Task } from "@/lib/tasks/types";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ArrowRight,
  Check,
  Clock,
  FolderPlus,
  Hourglass,
  Inbox as InboxIcon,
  Moon,
  Trash2,
  Zap,
} from "lucide-react";

export const Route = createFileRoute("/inbox")({
  head: () => ({
    meta: [
      { title: "Inbox — capture & clarify | Shenas" },
      {
        name: "description",
        content:
          "Dump anything on your mind, then clarify it one item at a time into next actions, projects, waiting-for or someday.",
      },
      { property: "og:title", content: "Inbox — capture & clarify | Shenas" },
      {
        property: "og:description",
        content: "Empty your head first, decide second. One item at a time.",
      },
    ],
  }),
  component: InboxPage,
});

type Mode = null | "next" | "project" | "waiting";

function todayKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate(),
  ).padStart(2, "0")}`;
}

function InboxPage() {
  const { inbox, projects, hydrated, addTask, updateTask, setStatus, deleteTask } = useTasks();
  const [quick, setQuick] = useState("");
  const [skipped, setSkipped] = useState<string[]>([]);

  const queue = useMemo(() => inbox.filter((t) => !skipped.includes(t.id)), [inbox, skipped]);
  const current = queue[0];

  if (!hydrated) return null;

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <header className="mb-5">
        <h1 className="flex items-center gap-2 text-lg font-semibold tracking-tight">
          <InboxIcon className="h-4 w-4 text-muted-foreground" />
          Inbox
          {inbox.length > 0 && (
            <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
              {inbox.length}
            </span>
          )}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Get it out of your head first. Decide later — nothing here counts against you.
        </p>
      </header>

      <div className="mb-6 flex gap-2">
        <Input
          value={quick}
          onChange={(e) => setQuick(e.target.value)}
          placeholder="Capture anything…"
          onKeyDown={(e) => {
            if (e.key === "Enter" && quick.trim()) {
              addTask({ title: quick.trim(), tags: [], priority: null, bucket: "inbox" });
              setQuick("");
            }
          }}
        />
        <Button
          variant="outline"
          onClick={() => captureStore.open()}
          title="Full-screen capture (c)"
        >
          Brain dump
        </Button>
      </div>

      {current ? (
        <ClarifyCard
          key={current.id}
          task={current}
          projects={projects}
          onSkip={() => setSkipped((s) => [...s, current.id])}
          onDoNow={() => {
            updateTask(current.id, { bucket: "next", clarifiedAt: new Date().toISOString() });
            setStatus(current.id, "done");
          }}
          onNextAction={(patch) =>
            updateTask(current.id, {
              ...patch,
              bucket: "next",
              clarifiedAt: new Date().toISOString(),
            })
          }
          onProject={(projectTitle, firstAction) => {
            updateTask(current.id, {
              title: projectTitle,
              isProject: true,
              bucket: "next",
              clarifiedAt: new Date().toISOString(),
            });
            if (firstAction.trim()) {
              addTask({
                title: firstAction.trim(),
                tags: [],
                priority: null,
                bucket: "next",
                projectId: current.id,
                clarifiedAt: new Date().toISOString(),
              });
            }
          }}
          onWaiting={(who) =>
            updateTask(current.id, {
              bucket: "waiting",
              waitingOn: who || undefined,
              waitingSince: todayKey(),
              clarifiedAt: new Date().toISOString(),
            })
          }
          onSomeday={() =>
            updateTask(current.id, {
              bucket: "someday",
              due: undefined,
              clarifiedAt: new Date().toISOString(),
            })
          }
          onTrash={() => deleteTask(current.id)}
        />
      ) : (
        <EmptyState
          hadSkips={skipped.length > 0}
          onUnskip={() => setSkipped([])}
          total={inbox.length}
        />
      )}

      {queue.length > 1 && (
        <p className="mt-4 text-center text-xs text-muted-foreground">
          {queue.length - 1} more after this one
        </p>
      )}
    </div>
  );
}

function ClarifyCard({
  task,
  projects,
  onSkip,
  onDoNow,
  onNextAction,
  onProject,
  onWaiting,
  onSomeday,
  onTrash,
}: {
  task: Task;
  projects: Task[];
  onSkip: () => void;
  onDoNow: () => void;
  onNextAction: (patch: Partial<Task>) => void;
  onProject: (projectTitle: string, firstAction: string) => void;
  onWaiting: (who: string) => void;
  onSomeday: () => void;
  onTrash: () => void;
}) {
  const [mode, setMode] = useState<Mode>(null);

  return (
    <div className="rounded-xl border p-4">
      <div className="text-[11px] uppercase tracking-wide text-muted-foreground">
        What is it?
      </div>
      <div className="mt-1 text-base font-medium">{task.title}</div>

      {mode === null && (
        <div className="mt-4 space-y-2">
          <Choice
            icon={<Zap className="h-4 w-4" />}
            label="Do it now"
            sub="Under two minutes? Just finish it."
            onClick={onDoNow}
          />
          <Choice
            icon={<ArrowRight className="h-4 w-4" />}
            label="It's one next action"
            sub="A single physical step you can start."
            onClick={() => setMode("next")}
          />
          <Choice
            icon={<FolderPlus className="h-4 w-4" />}
            label="It's a project"
            sub="More than one step — needs an outcome and a first action."
            onClick={() => setMode("project")}
          />
          <Choice
            icon={<Hourglass className="h-4 w-4" />}
            label="Waiting for someone"
            sub="Not yours to do right now. Track it, don't carry it."
            onClick={() => setMode("waiting")}
          />
          <Choice
            icon={<Moon className="h-4 w-4" />}
            label="Someday / maybe"
            sub="Might matter later. Parked, not lost."
            onClick={onSomeday}
          />
          <Choice
            icon={<Trash2 className="h-4 w-4" />}
            label="Not actually a thing"
            sub="Delete it. Most captures don't survive daylight."
            onClick={onTrash}
          />
        </div>
      )}

      {mode === "next" && (
        <NextActionPanel
          task={task}
          projects={projects}
          onCancel={() => setMode(null)}
          onConfirm={onNextAction}
        />
      )}

      {mode === "project" && (
        <ProjectPanel task={task} onCancel={() => setMode(null)} onConfirm={onProject} />
      )}

      {mode === "waiting" && (
        <WaitingPanel onCancel={() => setMode(null)} onConfirm={onWaiting} />
      )}

      <div className="mt-4 flex justify-end border-t pt-3">
        <button
          onClick={onSkip}
          className="text-xs text-muted-foreground hover:text-foreground"
        >
          Not now — skip
        </button>
      </div>
    </div>
  );
}

function NextActionPanel({
  task,
  projects,
  onCancel,
  onConfirm,
}: {
  task: Task;
  projects: Task[];
  onCancel: () => void;
  onConfirm: (patch: Partial<Task>) => void;
}) {
  const [title, setTitle] = useState(task.title);
  const [due, setDue] = useState(task.due ?? "");
  const [dur, setDur] = useState<number | "">(task.scheduledDuration ?? "");
  const [projectId, setProjectId] = useState<string>(task.projectId ?? "none");

  return (
    <div className="mt-4 space-y-3 rounded-lg border p-3">
      <div className="text-xs text-muted-foreground">
        Name the physical next step — the verb matters ("draft", "call", "open").
      </div>
      <Input value={title} onChange={(e) => setTitle(e.target.value)} />
      <div className="grid grid-cols-2 gap-3">
        <div>
          <div className="mb-1 text-xs text-muted-foreground">Due (optional)</div>
          <Input type="date" value={due} onChange={(e) => setDue(e.target.value)} />
        </div>
        <div>
          <div className="mb-1 text-xs text-muted-foreground">Part of a project?</div>
          <Select value={projectId} onValueChange={setProjectId}>
            <SelectTrigger className="text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Standalone</SelectItem>
              {projects.map((p) => (
                <SelectItem key={p.id} value={p.id} className="text-xs">
                  {p.title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div>
        <div className="mb-1 flex items-center gap-1 text-xs text-muted-foreground">
          <Clock className="h-3 w-3" /> How long, honestly?
        </div>
        <div className="flex flex-wrap gap-1.5">
          {[10, 15, 30, 45, 60].map((m) => (
            <button
              key={m}
              onClick={() => setDur(m)}
              className={`rounded border px-2 py-1 text-xs ${
                dur === m
                  ? "border-primary bg-primary/10 text-foreground"
                  : "text-muted-foreground hover:bg-accent"
              }`}
            >
              {m}m
            </button>
          ))}
        </div>
      </div>
      <div className="flex justify-end gap-2">
        <Button size="sm" variant="ghost" onClick={onCancel}>
          Back
        </Button>
        <Button
          size="sm"
          onClick={() =>
            onConfirm({
              title: title.trim() || task.title,
              due: due || undefined,
              scheduledDuration: typeof dur === "number" ? dur : undefined,
              projectId: projectId === "none" ? undefined : projectId,
            })
          }
        >
          <Check className="mr-1 h-3.5 w-3.5" /> Add to next actions
        </Button>
      </div>
    </div>
  );
}

function ProjectPanel({
  task,
  onCancel,
  onConfirm,
}: {
  task: Task;
  onCancel: () => void;
  onConfirm: (projectTitle: string, firstAction: string) => void;
}) {
  const [title, setTitle] = useState(task.title);
  const [first, setFirst] = useState("");

  return (
    <div className="mt-4 space-y-3 rounded-lg border p-3">
      <div>
        <div className="mb-1 text-xs text-muted-foreground">
          Outcome — what does "done" look like?
        </div>
        <Input value={title} onChange={(e) => setTitle(e.target.value)} />
      </div>
      <div>
        <div className="mb-1 text-xs text-muted-foreground">
          First next action (this is the only part that hits your lists)
        </div>
        <Input
          value={first}
          onChange={(e) => setFirst(e.target.value)}
          placeholder="e.g. Sketch the outline for 10 minutes"
        />
      </div>
      <div className="flex justify-end gap-2">
        <Button size="sm" variant="ghost" onClick={onCancel}>
          Back
        </Button>
        <Button size="sm" onClick={() => onConfirm(title.trim() || task.title, first)}>
          <Check className="mr-1 h-3.5 w-3.5" /> Create project
        </Button>
      </div>
    </div>
  );
}

function WaitingPanel({
  onCancel,
  onConfirm,
}: {
  onCancel: () => void;
  onConfirm: (who: string) => void;
}) {
  const [who, setWho] = useState("");
  return (
    <div className="mt-4 space-y-3 rounded-lg border p-3">
      <div className="text-xs text-muted-foreground">Who or what are you waiting on?</div>
      <Input
        value={who}
        onChange={(e) => setWho(e.target.value)}
        placeholder="e.g. Sam's reply"
        onKeyDown={(e) => {
          if (e.key === "Enter") onConfirm(who.trim());
        }}
      />
      <div className="flex justify-end gap-2">
        <Button size="sm" variant="ghost" onClick={onCancel}>
          Back
        </Button>
        <Button size="sm" onClick={() => onConfirm(who.trim())}>
          <Check className="mr-1 h-3.5 w-3.5" /> Track it
        </Button>
      </div>
    </div>
  );
}

function EmptyState({
  hadSkips,
  onUnskip,
  total,
}: {
  hadSkips: boolean;
  onUnskip: () => void;
  total: number;
}) {
  return (
    <div className="rounded-xl border border-dashed p-10 text-center">
      <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-primary/10">
        <Check className="h-5 w-5 text-primary" />
      </div>
      <div className="text-base font-medium">
        {total === 0 ? "Inbox empty." : "Nothing left to clarify."}
      </div>
      <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">
        An empty inbox isn't an empty life — it just means nothing is hiding from you right now.
      </p>
      {hadSkips && (
        <Button variant="ghost" size="sm" className="mt-3" onClick={onUnskip}>
          Revisit skipped items
        </Button>
      )}
    </div>
  );
}

function Choice({
  icon,
  label,
  sub,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  sub: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="flex w-full items-start gap-3 rounded-lg border p-3 text-left transition hover:border-primary/60 hover:bg-accent/40"
    >
      <span className="mt-0.5 text-muted-foreground">{icon}</span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-medium">{label}</span>
        <span className="block text-xs text-muted-foreground">{sub}</span>
      </span>
    </button>
  );
}
