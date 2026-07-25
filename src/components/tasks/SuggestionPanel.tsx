import { useEffect, useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Sparkles, Wand2, X } from "lucide-react";
import { TagChip } from "./TagChip";
import { areaColor } from "@/lib/tasks/areas";
import { useAreas } from "@/hooks/use-areas";
import { useTasks } from "@/hooks/use-tasks";
import { useContextState } from "@/hooks/use-context-state";
import {
  confidenceLabel,
  suggestTaskSettings,
  type SuggestedKind,
  type Suggestion,
} from "@/lib/tasks/suggest";
import {
  DURATION_LABEL,
  ENERGY_LABEL,
  LOCATION_LABEL,
  WORK_WINDOW_LABEL,
} from "@/lib/tasks/context";
import type { Task, TaskPriority } from "@/lib/tasks/types";

const KIND_LABEL: Record<SuggestedKind, string> = {
  "do-now": "Do it now",
  next: "Next action",
  project: "Project",
  waiting: "Waiting for",
  someday: "Someday / maybe",
};

/**
 * The clarify assistant. It proposes every setting at once so refining a
 * capture is one read-and-accept instead of six little decisions.
 */
export function SuggestionPanel({
  task,
  onAccept,
  onDecideMyself,
}: {
  task: Task;
  onAccept: (s: Suggestion) => void;
  onDecideMyself: () => void;
}) {
  const { areas } = useAreas();
  const { allTasks, projects } = useTasks();
  const { currentState } = useContextState();
  const [thinking, setThinking] = useState(true);
  const [draft, setDraft] = useState<Suggestion | null>(null);
  const [assisted, setAssisted] = useState(false);

  // Deliberately keyed on stable primitives: the surrounding hooks hand back
  // fresh object identities every render, which would otherwise restart the
  // "thinking" delay forever.
  const stateKey = JSON.stringify(currentState);
  const base = useMemo(
    () => suggestTaskSettings({ task, areas, allTasks, state: JSON.parse(stateKey) }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [task.id, task.title, task.notes, stateKey, areas.length, allTasks.length],
  );

  useEffect(() => {
    let cancelled = false;
    setThinking(true);
    setDraft(null);
    setAssisted(false);

    void (async () => {
      try {
        const ai = await suggestWithAssistant({
          data: {
            title: task.title,
            notes: task.notes,
            today: new Date().toISOString().slice(0, 10),
            state: JSON.parse(stateKey),
            areas: areas.map((a) => ({ id: a.id, name: a.name })),
            knownTags: Array.from(new Set(allTasks.flatMap((t) => t.tags))).slice(0, 40),
            projects: projects.map((p) => ({ id: p.id, title: p.title })),
          },
        });
        if (cancelled) return;
        if (ai) {
          setDraft(mergeAiSuggestion(base, ai, areas.map((a) => a.id), projects.map((p) => p.id)));
          setAssisted(true);
        } else {
          setDraft(base);
        }
      } catch {
        if (!cancelled) setDraft(base);
      } finally {
        if (!cancelled) setThinking(false);
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [base]);

  if (thinking || !draft) {
    return (
      <div className="mt-4 flex items-center gap-2 rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
        <Sparkles className="h-4 w-4 animate-pulse text-primary" />
        Reading it, and guessing the details…
      </div>
    );
  }


  const set = (patch: Partial<Suggestion>) => setDraft({ ...draft, ...patch });

  return (
    <div className="mt-4 space-y-3 rounded-lg border bg-accent/20 p-3">
      <div className="flex items-start gap-2">
        <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
        <div className="min-w-0">
          <div className="text-sm font-medium">{draft.headline}</div>
          <div className="text-xs text-muted-foreground">
            Suggested setup — {confidenceLabel(draft.confidence)}. Everything below is editable.
          </div>
        </div>
      </div>

      <Input value={draft.title} onChange={(e) => set({ title: e.target.value })} />

      <div className="grid grid-cols-2 gap-2">
        <Field label="File it as">
          <Select
            value={draft.kind}
            onValueChange={(v) => set({ kind: v as SuggestedKind })}
          >
            <SelectTrigger className="h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(KIND_LABEL) as SuggestedKind[]).map((k) => (
                <SelectItem key={k} value={k} className="text-xs">
                  {KIND_LABEL[k]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>

        <Field label="Area">
          <Select
            value={draft.areaId ?? "none"}
            onValueChange={(v) => set({ areaId: v === "none" ? undefined : v })}
          >
            <SelectTrigger className="h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none" className="text-xs">
                No area
              </SelectItem>
              {areas.map((a) => (
                <SelectItem key={a.id} value={a.id} className="text-xs">
                  <span className="flex items-center gap-2">
                    <span
                      className="h-2 w-2 rounded-full"
                      style={{ backgroundColor: areaColor(a.hue) }}
                      aria-hidden
                    />
                    {a.name}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>

        <Field label="Priority">
          <Select
            value={draft.priority ?? "none"}
            onValueChange={(v) => set({ priority: v === "none" ? null : (v as TaskPriority) })}
          >
            <SelectTrigger className="h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none" className="text-xs">
                None
              </SelectItem>
              <SelectItem value="L" className="text-xs">
                Low
              </SelectItem>
              <SelectItem value="M" className="text-xs">
                Medium
              </SelectItem>
              <SelectItem value="H" className="text-xs">
                High
              </SelectItem>
            </SelectContent>
          </Select>
        </Field>

        <Field label="Due">
          <Input
            type="date"
            className="h-8 text-xs"
            value={draft.due ?? ""}
            onChange={(e) => set({ due: e.target.value || undefined })}
          />
        </Field>
      </div>

      {draft.kind === "waiting" && (
        <Field label="Waiting on">
          <Input
            className="h-8 text-xs"
            value={draft.waitingOn ?? ""}
            placeholder="Who or what?"
            onChange={(e) => set({ waitingOn: e.target.value || undefined })}
          />
        </Field>
      )}

      {draft.kind === "project" && (
        <Field label="First action">
          <Input
            className="h-8 text-xs"
            value={draft.firstAction ?? ""}
            onChange={(e) => set({ firstAction: e.target.value })}
          />
        </Field>
      )}

      {draft.kind !== "project" && projects.length > 0 && (
        <Field label="Part of a project?">
          <Select
            value={draft.projectId ?? "none"}
            onValueChange={(v) => set({ projectId: v === "none" ? undefined : v })}
          >
            <SelectTrigger className="h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none" className="text-xs">
                Standalone
              </SelectItem>
              {projects.map((p) => (
                <SelectItem key={p.id} value={p.id} className="text-xs">
                  {p.title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
      )}

      <Field label="How long">
        <div className="flex flex-wrap gap-1.5">
          {[10, 15, 30, 45, 60, 90].map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => set({ scheduledDuration: m })}
              className={`rounded border px-2 py-1 text-xs transition-colors ${
                draft.scheduledDuration === m
                  ? "border-primary bg-primary/10 text-foreground"
                  : "text-muted-foreground hover:border-primary/40 hover:text-foreground"
              }`}
            >
              {m}m
            </button>
          ))}
        </div>
      </Field>

      {draft.tags.length > 0 && (
        <Field label="Tags">
          <div className="flex flex-wrap gap-1.5">
            {draft.tags.map((t) => (
              <TagChip
                key={t}
                tag={t}
                onRemove={() => set({ tags: draft.tags.filter((x) => x !== t) })}
              />
            ))}
          </div>
        </Field>
      )}

      <div className="flex flex-wrap gap-1.5 text-[11px] text-muted-foreground">
        <Pill>{LOCATION_LABEL[draft.context.location ?? "anywhere"]}</Pill>
        <Pill>{ENERGY_LABEL[draft.context.energy ?? "any"]}</Pill>
        <Pill>{DURATION_LABEL[draft.context.duration ?? "any"]}</Pill>
        <Pill>{WORK_WINDOW_LABEL[draft.context.workWindow ?? "any"]}</Pill>
      </div>

      <details className="text-xs text-muted-foreground">
        <summary className="cursor-pointer select-none">Why these settings?</summary>
        <ul className="mt-1 list-disc space-y-0.5 pl-4">
          {draft.reasons.map((r) => (
            <li key={r}>{r}</li>
          ))}
        </ul>
      </details>

      <div className="flex flex-wrap justify-end gap-2 pt-1">
        <Button size="sm" variant="ghost" onClick={onDecideMyself}>
          <X className="mr-1 h-3.5 w-3.5" /> I'll decide myself
        </Button>
        <Button size="sm" onClick={() => onAccept(draft)}>
          <Wand2 className="mr-1 h-3.5 w-3.5" /> Accept as {KIND_LABEL[draft.kind].toLowerCase()}
        </Button>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</div>
      {children}
    </div>
  );
}

function Pill({ children }: { children: React.ReactNode }) {
  return <span className="rounded-full border px-2 py-0.5">{children}</span>;
}
