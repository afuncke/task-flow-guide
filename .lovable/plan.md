# Shenas: Planning-First Overhaul

Centered on the daily planning ritual (the 85% flow), with smarter blocking, focus polish, vi-style keys, and a Google Calendar layer.

## 1. Planning ritual as the front door

Make `/plan` the default landing route (replace `/focus` as home), and open it directly into a guided ritual when today hasn't been planned yet.

**Ritual steps** (single page, staged, "Next" advances):
1. **Rollover** — list yesterday's overdue/unfinished scheduled tasks. Bulk actions: keep due, push to today, drop scheduled time, mark done.
2. **My Day pick** — shortlist ranked by urgency + context fit. User checkboxes what they intend to do today. `myDay: true` flag on task (separate from `due`, so due stays honest).
3. **Block it** — the picked tasks appear as a stack above the day grid; user drags them into slots, or hits **Auto-schedule** to pack them into free gaps respecting `context.workWindow`, `energy` (high-energy tasks in the morning window from `schedule`), and `scheduledDuration` (default 30m if unset).
4. **Review** — shows totals: "4 tasks · 3h 15m scheduled · 2h 45m free". Confirm → marks day as planned (stored per date), skips ritual on later visits.

A small "Re-plan" button in the `/plan` header re-opens the ritual any time. If the ritual was already done today, `/plan` opens directly to the day grid.

## 2. Smarter time blocking

- **Drag-to-resize** blocks on the grid via a bottom handle; snap to 15 min.
- **Duration presets** in TaskDialog (15/30/45/60/90 min) + freeform numeric input.
- **Collision handling** — dropping onto an occupied slot nudges the existing block down instead of overlapping.
- **Auto-schedule algorithm**: greedy fill of free windows within `schedule.workStart`–`workEnd`, matching energy to time-of-day (morning=high, midday=medium, late=low), longest tasks first.
- **Overflow indicator** in the day header: `3h 15m scheduled / 5h available`, turns amber when over.
- **Unscheduled panel** grouped by tag with a search box and context filter chips.

## 3. Focus polish

- **Inline timer** on `/focus` tied to `scheduledDuration` — starts when Start is clicked, ticks down, offers "Done / Extend 10m / Stop" at zero.
- **Next preview** — small "Then: <title> at 14:30" line below current task, pulled from today's scheduled blocks.
- **Session log** — completing via the timer stamps `completedAt` and records elapsed time on the block (new `actualDuration` field), surfaced in the ritual's Review step tomorrow.

## 4. Vi-style keyboard

Global handler registered in `__root.tsx` (skipped when an input/textarea is focused, `Esc` blurs any focused input).

Motion & views: `g f` focus · `g p` plan · `g b` board · `g t` tasks · `g c` calendar · `?` shortcut cheatsheet overlay.

Actions (context-aware to the active view):
- `n` new task · `/` focus quick-add · `Esc` close dialog/blur
- `j` / `k` move selection down/up in any list (unscheduled panel, board column, tasks list, Up-next)
- `h` / `l` move selection across columns on `/board`
- `Enter` open selected · `e` edit · `d` done · `x` delete (with confirm) · `s` start/pause
- `t` snooze to tomorrow · `T` jump to today (plan/calendar)
- `[` / `]` prev/next day on `/plan`, prev/next month on `/calendar`
- `:` opens a Vim-style command palette for less-common actions (`:schedule 14:00 45`, `:tag work`, `:auto`).

## 5. Calendar niceties + Google Calendar

- **Week view** toggle on `/plan` (7-day time grid) alongside single-day.
- **"Needs a slot" bucket** at top of `/plan`: tasks due today with no `scheduledStart`.
- **Month heat** on `/calendar`: dot density per day reflects scheduled load.
- **Google Calendar sync (read-only first)**:
  - App User Connector for `google_calendar` so each end-user connects their own account.
  - Requires Lovable Cloud for auth + encrypted per-user connection key storage.
  - Server fn pulls today's/this-week's events; render them as read-only ghost blocks on `/plan` so users see meetings while blocking.
  - Auto-schedule respects busy ranges from Google.
  - Later phase (not this plan): two-way push of Shenas blocks as Google events.

## Technical details

**Data model additions** (`src/lib/tasks/types.ts`):
- `myDay?: string` (ISO date the task is pinned to)
- `actualDuration?: number` (minutes, from focus timer)

**New state store** (`src/lib/tasks/plan-store.ts`): per-date planning status (`planned: Set<string>`), persisted to localStorage.

**Auto-schedule** (`src/lib/tasks/auto-schedule.ts`): pure function `(tasks, schedule, busyRanges) => ScheduledBlock[]`.

**Keyboard** (`src/hooks/use-keybindings.ts`): registers global handler, exposes per-view selection cursor via context; leader-sequence parser for `g f`, `g p`, etc.

**Google Calendar** (requires enabling Lovable Cloud first — user approval needed):
- `connector_app_user--connect_client` to link the Google connector to the project.
- Table `app_user_connections` for encrypted `lovack_*` keys (per user, per connector).
- Server fns `connectGoogle.functions.ts`, `disconnectGoogle.functions.ts`, `listGoogleEvents.functions.ts`.
- Scopes: `calendar.readonly` (read phase).
- Client "Connect Google Calendar" button in `/plan` settings; per-user consent.

**Landing route change**: `src/routes/index.tsx` becomes the ritual entrypoint (redirects to `/plan`), or `/plan` is set as the home directly.

**Route order to build**: (1) ritual + My Day + landing swap, (2) auto-schedule + resize + collisions, (3) focus timer, (4) vi keys + cheatsheet, (5) week view + needs-a-slot, (6) Google Calendar (last — biggest lift, needs Cloud approval).

## Open decisions

- Enable **Lovable Cloud** now to unlock Google Calendar sync? (Needed for step 5's Google integration; steps 1–4 don't require it.)
- Google Calendar scope: **read-only ghost events** only, or plan for **two-way sync** from the start?
- Should the ritual be **required** each morning (blocks the day grid until done) or **suggested** (banner at top, dismissible)?
