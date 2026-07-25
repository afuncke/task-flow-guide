import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useTasks } from "@/hooks/use-tasks";
import { useAreas } from "@/hooks/use-areas";
import { matchesArea } from "@/lib/tasks/areas";
import { daysSince, nextActionOf, projectChildren } from "@/lib/tasks/gtd";
import { taskDialogStore } from "@/lib/tasks/dialog-store";
import type { Task } from "@/lib/tasks/types";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { DueBadge } from "@/components/tasks/DueBadge";
import { AreaChip } from "@/components/tasks/AreaChip";

import {
  ChevronDown,
  ChevronRight,
  FolderOpen,
  Hourglass,
  Moon,
  Plus,
  RotateCcw,
} from "lucide-react";

export const Route = createFileRoute("/projects")({
  head: () => ({
    meta: [
      { title: "Projects & next actions — Shenas" },
      {
        name: "description",
        content:
          "Every multi-step outcome with its single next action, plus what you're waiting on and what's parked for someday.",
      },
      { property: "og:title", content: "Projects & next actions — Shenas" },
      {
        property: "og:description",
        content: "One next action per outcome. Stalled projects surfaced gently.",
      },
    ],
  }),
  component: ProjectsPage,
});

function ProjectsPage() {
  const {
    projects: allProjects,
    aliveTasks,
    waiting: allWaiting,
    someday: allSomeday,
    hydrated,
    addTask,
    updateTask,
    setStatus,
  } = useTasks();
  const { filter: areaFilter } = useAreas();
  const [newProject, setNewProject] = useState("");

  const inArea = (list: Task[]) =>
    areaFilter ? list.filter((t) => matchesArea(t, aliveTasks, areaFilter)) : list;
  const projects = useMemo(
    () => inArea(allProjects),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [allProjects, aliveTasks, areaFilter],
  );
  const waiting = useMemo(
    () => inArea(allWaiting),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [allWaiting, aliveTasks, areaFilter],
  );
  const someday = useMemo(
    () => inArea(allSomeday),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [allSomeday, aliveTasks, areaFilter],
  );

  const stalled = useMemo(
    () => projects.filter((p) => !nextActionOf(p.id, aliveTasks)),
    [projects, aliveTasks],
  );


  if (!hydrated) return null;

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <header className="mb-5">
        <h1 className="flex items-center gap-2 text-lg font-semibold tracking-tight">
          <FolderOpen className="h-4 w-4 text-muted-foreground" />
          Projects
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Any outcome with more than one step. Only its next action reaches your day — the rest
          can wait quietly here.
        </p>
      </header>

      <div className="mb-5 flex gap-2">
        <Input
          value={newProject}
          onChange={(e) => setNewProject(e.target.value)}
          placeholder="New outcome — e.g. Ship the newsletter redesign"
          onKeyDown={(e) => {
            if (e.key === "Enter" && newProject.trim()) {
              addTask({
                title: newProject.trim(),
                tags: [],
                priority: null,
                isProject: true,
                bucket: "next",
              });
              setNewProject("");
            }
          }}
        />
      </div>

      {stalled.length > 0 && (
        <div className="mb-5 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-300">
          {stalled.length} project{stalled.length === 1 ? "" : "s"} without a next action. Not a
          failure — just a decision that hasn't been made yet.
        </div>
      )}

      <div className="space-y-3">
        {projects.map((p) => (
          <ProjectRow
            key={p.id}
            project={p}
            all={aliveTasks}
            onAddAction={(title) =>
              addTask({
                title,
                tags: [],
                priority: null,
                bucket: "next",
                projectId: p.id,
                clarifiedAt: new Date().toISOString(),
              })
            }
            onToggle={(id, done) => setStatus(id, done ? "done" : "todo")}
            onComplete={() => setStatus(p.id, "done")}
          />
        ))}
        {projects.length === 0 && (
          <div className="rounded-xl border border-dashed p-10 text-center text-sm text-muted-foreground">
            No projects yet. Anything that takes more than one step belongs here.
          </div>
        )}
      </div>

      <Section
        title="Waiting for"
        icon={<Hourglass className="h-3.5 w-3.5" />}
        count={waiting.length}
        empty="Nothing hanging on anyone else."
      >
        {waiting.map((t) => {
          const d = daysSince(t.waitingSince ? `${t.waitingSince}T12:00:00` : undefined);
          return (
            <div key={t.id} className="flex items-center gap-2 border-t px-3 py-2 text-sm">
              <button
                className="min-w-0 flex-1 truncate text-left hover:underline"
                onClick={() => taskDialogStore.openEdit(t)}
              >
                {t.title}
              </button>
              {t.waitingOn && (
                <span className="text-xs text-muted-foreground">{t.waitingOn}</span>
              )}
              {d != null && d > 0 && (
                <span className="text-xs text-muted-foreground">{d}d</span>
              )}
              <button
                onClick={() => updateTask(t.id, { bucket: "next", waitingOn: undefined })}
                className="text-xs text-muted-foreground hover:text-foreground"
                title="It's mine again"
              >
                <RotateCcw className="h-3.5 w-3.5" />
              </button>
            </div>
          );
        })}
      </Section>

      <Section
        title="Someday / maybe"
        icon={<Moon className="h-3.5 w-3.5" />}
        count={someday.length}
        empty="Nothing parked. That's fine too."
      >
        {someday.map((t) => (
          <div key={t.id} className="flex items-center gap-2 border-t px-3 py-2 text-sm">
            <button
              className="min-w-0 flex-1 truncate text-left hover:underline"
              onClick={() => taskDialogStore.openEdit(t)}
            >
              {t.title}
            </button>
            <button
              onClick={() =>
                updateTask(t.id, { bucket: "next", clarifiedAt: new Date().toISOString() })
              }
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              Activate
            </button>
          </div>
        ))}
      </Section>
    </div>
  );
}

function ProjectRow({
  project,
  all,
  onAddAction,
  onToggle,
  onComplete,
}: {
  project: Task;
  all: Task[];
  onAddAction: (title: string) => void;
  onToggle: (id: string, done: boolean) => void;
  onComplete: () => void;
}) {
  const [open, setOpen] = useState(false);
  const { areaById } = useAreas();

  const [draft, setDraft] = useState("");
  const children = projectChildren(project.id, all);
  const next = nextActionOf(project.id, all);
  const openCount = children.filter((c) => c.status !== "done").length;
  const doneCount = children.length - openCount;

  return (
    <div className="rounded-xl border">
      <div className="flex items-start gap-2 p-3">
        <button
          onClick={() => setOpen((v) => !v)}
          className="mt-0.5 text-muted-foreground hover:text-foreground"
          aria-label={open ? "Collapse" : "Expand"}
        >
          {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        </button>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <button
              className="text-sm font-medium hover:underline"
              onClick={() => taskDialogStore.openEdit(project)}
            >
              {project.title}
            </button>
            <AreaChip area={areaById(project.areaId)} />
          </div>

          <div className="mt-1 text-xs">
            {next ? (
              <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                <span className="text-foreground">Next:</span> {next.title}
                <DueBadge due={next.due} />
              </span>
            ) : (
              <span className="text-amber-600 dark:text-amber-400">
                No next action — what's the smallest first step?
              </span>
            )}
          </div>
          <div className="mt-1 text-[11px] text-muted-foreground">
            {openCount} open · {doneCount} done
          </div>
        </div>
        <Button variant="ghost" size="sm" className="text-xs" onClick={onComplete}>
          Complete
        </Button>
      </div>

      {open && (
        <div className="border-t px-3 py-2">
          {children.map((c) => (
            <div key={c.id} className="flex items-center gap-2 py-1.5 text-sm">
              <Checkbox
                checked={c.status === "done"}
                onCheckedChange={(v) => onToggle(c.id, v === true)}
              />
              <button
                onClick={() => taskDialogStore.openEdit(c)}
                className={`min-w-0 flex-1 truncate text-left hover:underline ${
                  c.status === "done" ? "text-muted-foreground line-through" : ""
                }`}
              >
                {c.title}
              </button>
              <DueBadge due={c.due} />
            </div>
          ))}
          <div className="mt-2 flex items-center gap-2">
            <Plus className="h-3.5 w-3.5 text-muted-foreground" />
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="Add a next action"
              className="w-full bg-transparent py-1 text-sm outline-none placeholder:text-muted-foreground"
              onKeyDown={(e) => {
                if (e.key === "Enter" && draft.trim()) {
                  onAddAction(draft.trim());
                  setDraft("");
                }
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}

function Section({
  title,
  icon,
  count,
  empty,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  count: number;
  empty: string;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="mt-6 overflow-hidden rounded-xl border">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-accent/40"
      >
        {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        <span className="text-muted-foreground">{icon}</span>
        <span className="font-medium">{title}</span>
        <span className="ml-auto text-xs text-muted-foreground">{count}</span>
      </button>
      {open &&
        (count === 0 ? (
          <div className="border-t px-3 py-4 text-xs text-muted-foreground">{empty}</div>
        ) : (
          children
        ))}
    </div>
  );
}
