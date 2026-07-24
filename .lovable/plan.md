## Goal
Add Taskwarrior-inspired task management to Shenas that reduces overwhelm by defaulting to a single "next task", while still letting the user zoom out to a Kanban board.

## Data model (localStorage)
Stored under key `shenas.tasks.v1` as JSON.

```text
Task {
  id: string (uuid)
  title: string
  notes?: string
  status: 'todo' | 'doing' | 'done'
  tags: string[]
  priority: 'H' | 'M' | 'L' | null
  due?: string (ISO date)
  createdAt: string
  completedAt?: string
}
```

A small `useTasks()` hook wraps read/write + subscribes to `storage` events so multiple tabs stay in sync.

## Urgency score (Taskwarrior-style, simplified)
```text
urgency =
   priority (H=6, M=3.9, L=1.8)
 + due proximity (overdue=12, ≤1d=8, ≤3d=5, ≤7d=3, ≤14d=1, else 0)
 + age boost (min(days_since_created / 7, 2))
 + status boost (doing=+4)
```
Ties broken by `createdAt` ascending.

## Routes
- `/` → redirect to `/focus`
- `/focus` — Focus view (default landing)
- `/board` — Kanban
- `/tasks` — flat list with filters

Nav lives in `__root.tsx` as a small top bar (Focus · Board · List + "+ New task" button opening a dialog).

## Screens

### Focus (`/focus`)
Shows ONLY the single top-urgency `todo`/`doing` task, big and centered:
- Title, tags as chips, due date, urgency score (subtle)
- Actions: **Done**, **Start/Pause** (toggles doing), **Snooze 1d**, **Skip** (temporarily de-ranks for the session)
- Collapsible "Up next" list showing the next 3 tasks (title only) to preserve a sense of what's coming without overwhelming
- Empty state: encouraging message + "Add a task"

### Board (`/board`)
Three columns: Todo · Doing · Done (Done capped to last 10, "show all" link).
- Cards sorted by urgency inside each column
- Drag between columns updates `status` (using `@dnd-kit/core`, already in deps if present — otherwise plain click menu "Move to…")
- Tag filter bar at top (multi-select chips) filters all columns
- Click card → edit dialog

### List (`/tasks`)
Table: title, tags, due, priority, urgency, status. Filter by tag, sort by urgency/due/created. Bulk complete.

## Components
- `TaskDialog` — create/edit (title, notes, tags input with autocomplete from existing tags, priority select, due date picker)
- `TaskCard` — used in board and up-next
- `TagChip`, `UrgencyBadge`, `DueBadge`
- `TagFilterBar`
- `useTasks()` hook + `lib/tasks/urgency.ts` + `lib/tasks/storage.ts`

## Anti-overwhelm choices
- Focus view is the default; Kanban is opt-in
- Focus shows exactly 1 task; up-next is collapsed
- Done column is truncated
- No projects, no dependencies, no recurrence in v1 — just tags + urgency

## Out of scope for v1
Sync/accounts, recurrence, dependencies, projects, notifications, search, import/export (easy to add later since storage is a single JSON blob).

## Files to add/change
- `src/routes/index.tsx` — redirect to `/focus`
- `src/routes/__root.tsx` — add nav bar + head metadata
- `src/routes/focus.tsx`, `src/routes/board.tsx`, `src/routes/tasks.tsx`
- `src/lib/tasks/{types.ts,storage.ts,urgency.ts}`
- `src/hooks/use-tasks.ts`
- `src/components/tasks/{TaskDialog,TaskCard,TagChip,UrgencyBadge,DueBadge,TagFilterBar,UpNext}.tsx`
- Install `@dnd-kit/core` + `@dnd-kit/sortable` for board drag (only if not already present)
