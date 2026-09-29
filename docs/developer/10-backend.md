---
title: Backend
description: Supabase schema, security, SQL functions, Edge Functions, limits and scheduled jobs.
---

# Backend

Everything lives in `supabase/`: migrations, two Edge Functions, and tests that run the real
migrations on PGlite (`npm run test -w supabase`, no Docker).

## Tables

`workspaces`, `workspace_members`, `workspace_invites`, `projects` (with `settings` for the SDK
switches), `experiments`, `variants`, `variant_versions`, `experiment_metrics` (secondary and
guardrail goals), `metrics`, `segments`, `triggers`, `page_sets`, `events` and `rate_limits`.

**Row Level Security is on for every table.** Users see workspaces they belong to and everything
inside them. Deleting projects and experiments is limited to owners and admins; `events` can only be
read by members and only written by the events function (service role).

## SQL functions

| Function                         | For                                                     |
| -------------------------------- | ------------------------------------------------------- |
| `experiment_results`, `experiment_daily` | Results page and cumulative chart               |
| `experiment_stats`               | Per-variant counts for the experiments list             |
| `guardrail_status`, `auto_pause_guardrails` | Guardrail checks and the 15-minute auto pause (pg_cron) |
| `project_overview`, `workspace_events_this_month` | Project cards and the usage meter      |
| `workspace_activity`             | Recent activity                                         |
| `project_session_sample`         | Reach estimates                                         |
| `duplicate_experiment`           | Duplicate                                               |
| `workspace_people`, `invite_details`, `accept_invite` | Team and invites                   |
| `sdk_config_source`, `ingest_events` | The two Edge Functions (service role only)          |

Most are `security invoker`, so RLS applies to them too.

## Edge Functions

**`GET /functions/v1/config/<public key>.json`**: the config the SDK fetches on every page: live
experiments with variants and resolved targeting (segments inlined), the goals they use, and project
switches that are off. Cached for 60 seconds (`public`, or `private` when it contains a country).

**`POST /functions/v1/events`**: batches from the SDK (`text/plain` JSON). Each event is validated
and trimmed; only pages on the project's domains are accepted.

| Response | Meaning                                                         |
| -------- | --------------------------------------------------------------- |
| 204      | Stored                                                          |
| 400 / 413 | Malformed batch / body over 64 KB                              |
| 403      | Page not on the project's domains                               |
| 404      | Unknown project key                                             |
| 429      | Monthly event limit reached, or rate limited (`Retry-After: 60`) |

Limits: the free plan stores 100,000 events a month per workspace (after that the config serves no
experiments, so visitors see the original site); at most 3,000 events a minute per project and 300
per visitor.

## Migrations

Files in `supabase/migrations/` run in name order. Add a new file for every change (never edit an
applied one), and a test in `supabase/tests/`. Apply with `npx supabase db push` from an up-to-date
`main`, and redeploy a function after changing its code:

```sh
npx supabase functions deploy config --use-api
npx supabase functions deploy events --use-api
```
