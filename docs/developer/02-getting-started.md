---
title: Getting started
description: Run the whole platform locally, with or without Supabase.
---

# Getting started

## Requirements

- **Node 22** (see `.nvmrc`; `package.json` requires 20 or later) and npm.
- No Docker. Database tests run on [PGlite](https://pglite.dev), real Postgres compiled to WebAssembly.
- A Supabase project only if you want the dashboard to use real data (the free tier is enough).

## Install and run

```sh
npm install                    # every workspace
npm test                       # SDK, dashboard, site, database and simulator tests
npm run dev -w apps/dashboard  # http://localhost:5173
npm run dev -w apps/web        # http://localhost:5174
```

Other root scripts: `npm run build`, `npm run typecheck`, `npm run lint`, `npm run format` and
`npm run format:check`. CI runs lint, format check, typecheck, tests, build and the SDK size check
on every pull request.

## Look at any screen without Supabase

The dashboard has a development-only preview page that renders any route with the test fixtures
(example projects, experiments and results), signed in:

```
http://localhost:5173/preview.html?path=/p/marketing-site/experiments/sticky/results
http://localhost:5173/preview.html?path=/projects&workspaces=none   # first-run screen
```

## Connect a Supabase project

1. Create a project at [supabase.com](https://supabase.com).
2. Copy `apps/dashboard/.env.example` to `apps/dashboard/.env.local` and fill in:
   - `VITE_SUPABASE_URL`: the project URL
   - `VITE_SUPABASE_ANON_KEY`: the anon (publishable) key. It is public by design; Row Level Security protects the data.
   - optional `VITE_SDK_URL`: where the SDK file is hosted (install snippets show it)
   - optional `VITE_SITE_URL`: the marketing site (for "Back to site", Terms and Privacy links)
3. Apply the schema and deploy the SDK endpoints:
   ```sh
   npx supabase login
   npx supabase link --project-ref <your-project-ref>
   npx supabase db push
   npx supabase functions deploy config --use-api
   npx supabase functions deploy events --use-api
   ```
4. In Supabase, **Authentication › URL Configuration**: set the Site URL to your dashboard URL and add
   `http://localhost:5173/**` as a redirect URL.

Never put the service role key in a frontend `.env` file. The Edge Functions get it from Supabase
automatically.

The marketing site reads `VITE_DASHBOARD_URL` (where "Log in" and "Start free" go); see
`apps/web/.env.example`.

## Demo data

`tools/simulator` fills an experiment with simulated traffic, bucketed exactly like the SDK and marked
`props.simulated = true`:

```sh
SUPABASE_URL=… SUPABASE_SERVICE_ROLE_KEY=… npm run simulate -w tools/simulator -- \
  --project prj_… --experiment sticky-book-now-bar --goal book_click \
  --rates control=0.05,b=0.055 --visitors 20000 --days 14

# remove it again
SUPABASE_URL=… SUPABASE_SERVICE_ROLE_KEY=… npm run simulate -w tools/simulator -- --project prj_… --delete
```

Keep the service role key in your shell only.

## Try the SDK on a real page

1. Create a project in the dashboard and add your domain (and `localhost:<port>` for local testing).
2. Copy the snippet from **Install** into the page's `<head>`.
3. Open the page: the project card switches from "Waiting for the first ping" to "Snippet live".
4. Create an experiment, write variant code, set a primary goal, launch it, and open the page again.
   Add `?splitcraft_force=<experiment>:<variant>` to see a specific variant and the QA panel.
