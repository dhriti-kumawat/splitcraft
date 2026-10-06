---
title: Dashboard internals
description: Routes, data access, workspaces and roles, and how to add a screen.
---

# Dashboard internals

`apps/dashboard` is React with React Router (data router), TanStack Query, Monaco (variant and
tracker code) and Recharts (results). Styles are CSS Modules with the tokens in `design/tokens.css`.

## Routes

| Route                                       | Screen                                    |
| ------------------------------------------- | ----------------------------------------- |
| `/login`, `/login/link`, `/signup`, `/forgot-password`, `/reset-password` | Auth (email and password, magic link, GitHub, Google) |
| `/invite/:token`                            | Accept a workspace invite                 |
| `/projects`                                 | Projects, recent activity                 |
| `/team`, `/workspace`                       | Team and invites; workspace settings      |
| `/p/:projectId/experiments`                 | Experiments list (status filters, Archived) |
| `/p/:projectId/experiments/:expId/{basics,variants,targeting,goals,results}` | The five steps |
| `/p/:projectId/audiences[/…]`               | Segments, `triggers/…`, `page-sets/…`      |
| `/p/:projectId/metrics`, `…/metrics/new?source=…`, `…/metrics/:metricId` | Metrics |
| `/p/:projectId/install`, `/p/:projectId/settings` | Install code and switches; project settings |

Heavy screens (Monaco, Recharts, the condition builder) load lazily. Breadcrumbs come from each
route's `handle.crumbs` and show record names (`layout/CrumbNames.tsx`).

## Data access

- `src/data/api.ts` defines `DataApi`: every read and write the UI needs.
- `src/data/supabaseData.ts` implements it with `@supabase/supabase-js` (anon key; Row Level Security
  decides what each user can see).
- `src/test/fakeData.ts` implements it in memory with the design's example data. Tests and
  `/preview.html` use it, so screens can be built and tested without Supabase.
- `src/data/queries.ts` wraps it in TanStack Query hooks with cache keys and invalidation.

To add a feature that needs data: add the method to `DataApi`, implement it in both
`supabaseData.ts` and `fakeData.ts`, add a hook in `queries.ts`, then use the hook in the page.

## Workspaces and roles

Every account belongs to one or more workspaces (new accounts get one named after their company, or
"My workspace"). Projects belong to a workspace.

| Role   | Can                                                                     |
| ------ | ----------------------------------------------------------------------- |
| Owner  | Everything, including renaming or deleting the workspace and managing owners |
| Admin  | Invite and remove members, change roles (not owners), delete projects and experiments |
| Member | Build and run experiments, audiences and metrics                        |

Invites are links (`/invite/<token>`) for one email address, valid for 7 days, used once. Every
workspace keeps at least one owner (a database trigger enforces it).

## Handy features

- **⌘K / Ctrl+K**: search pages, projects, experiments in every project, and the current project's
  audiences and metrics.
- **Responsive**: below 1024 px the sidebar becomes a drawer; below 720 px page actions wrap.
- **Feature flags** (Project › Feature flags): create a flag (it starts off), turn it on, set the
  rollout share and optionally a segment. Code checks `splitcraft.isEnabled('key')`. Flags reach
  the SDK as experiments with one `on` variant (`flag: true`), so raising the share only adds
  visitors.
- **Alerts** (Project › Settings): a Slack incoming webhook or any HTTPS webhook gets a message
  when a test has a clear winner on its primary goal (unique conversions or click-through, once
  every variant has the planned sample), reaches its planned sample, or is paused by a guardrail.
  Webhooks receive `{ event, text, experiment: { id, key, name, status }, sentAt }`.
- **Log in and sign up**: the form sits on white; on wide screens a light panel beside it shows
  what Splitcraft does (example numbers from a demo test), and phones get a soft green band at
  the top. Continue with GitHub comes first, as the fastest way in; the main button is green.
- **Preview page**: `/preview.html?path=…` renders any route with the fixtures (development only).

## Adding a screen

1. Find its design in `design/screens/` (see `design/README.md`) and match spacing, sizes and copy.
2. Add the route in `src/router.tsx` (lazy if it pulls in something heavy) with a crumb.
3. Build it with real `<button>`, `<input>` and `<label>` elements, visible focus, no emoji.
4. Test it with `renderApp(path, { data: fakeData().api })` and Testing Library.
