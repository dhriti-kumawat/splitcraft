---
title: Overview
description: What Splitcraft is, how the pieces fit together, and where to start.
---

# Splitcraft developer docs

Splitcraft is an A/B testing platform in one repository:

- a small **SDK** that runs experiments on a live site (script tag or npm),
- a **dashboard** to build variants in code, target audiences, define metrics and read results,
- a **backend** on Supabase (Postgres with Row Level Security, SQL functions, two Edge Functions),
- a **marketing site** that also hosts the SDK files and these docs.

These pages are for developers: people installing Splitcraft on a site, and people working on
Splitcraft itself.

## How a test runs

1. A visitor opens a page with the snippet. The SDK reads (or creates) the visitor id, fetches the
   project's config and, if anti-flicker is on, hides the page for at most 400 ms.
2. For each live experiment it evaluates targeting (WHO / WHERE / HOW / WHEN), buckets the visitor
   with a hash of `visitorId + experimentKey`, applies the variant's CSS and JS, and sends an
   **exposure** event.
3. Goals (clicks, page views, custom events, dataLayer events, purchases, browsing, Web Vitals) are
   tracked and sent in batches to the events endpoint.
4. The dashboard's SQL functions turn exposures and goals into results: conversion rates or values
   per variant, uplift with its 95% range, chance to win, and a sample ratio check.
5. On single-page apps the SDK repeats steps 2–3 on every route change.

## Architecture

```
Customer site                         Supabase                          Dashboard
┌───────────────────────┐            ┌─────────────────────────────┐   ┌─────────────────┐
│ SDK  v1.js (< 8 KB)    │── config ─▶│ Edge Function /config/:key  │   │ React + Router  │
│  targeting · bucketing │            │ Edge Function /events       │   │ TanStack Query  │
│  apply · tracking      │── events ─▶│ Postgres + RLS              │◀──│ Supabase Auth   │
│ QA panel   (on demand) │            │ SQL functions (results…)    │   │ anon key + RLS  │
│ metrics    (on demand) │            │ pg_cron: guardrail pause    │   └─────────────────┘
└───────────────────────┘            └─────────────────────────────┘
```

## Repository

| Path                | What                                                                |
| ------------------- | ------------------------------------------------------------------- |
| `packages/sdk`      | The SDK: TypeScript, Vite library mode, Vitest                      |
| `apps/dashboard`    | The dashboard: React, React Router, TanStack Query, Monaco, Recharts |
| `apps/web`          | Marketing site (pre-rendered React), SDK hosting and these docs     |
| `supabase`          | Migrations, Edge Functions and database tests (PGlite, no Docker)   |
| `tools/simulator`   | Fills an experiment with simulated traffic for demos                |
| `design`            | Design screens and tokens the UI follows                            |
| `docs`              | Product spec, decision log, build plan, and these docs' sources     |

## Where to go next

- New to the code: [Getting started](getting-started).
- Putting Splitcraft on a site: [Install the SDK](install) and [SDK reference](sdk).
- Building tests in the dashboard: [Experiments](experiments), [Targeting](targeting),
  [Metrics](metrics), [Results and statistics](results).
- Working on the platform: [Dashboard internals](dashboard), [Backend](backend),
  [Deployment](deployment), [Contributing and troubleshooting](contributing).
- Why things are the way they are: `docs/DECISIONS.md` in the repository.
