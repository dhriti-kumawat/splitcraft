---
title: Deployment
description: Vercel projects, environment variables, Supabase setup, sign-in providers and CI.
---

# Deployment

The live setup: the marketing site (which also serves the SDK and these docs) and the dashboard are
two Vercel projects from this repository; the backend is a Supabase project.

| Piece           | Where                                   | Deploys                        |
| --------------- | --------------------------------------- | ------------------------------ |
| Marketing site, SDK files, docs | Vercel project, root `apps/web` | Every push to `main`   |
| Dashboard       | Vercel project, root `apps/dashboard`   | Every push to `main`           |
| Database        | Supabase                                | `npx supabase db push`         |
| Edge Functions  | Supabase                                | `npx supabase functions deploy …` |

## Vercel

Import the repository twice and set **Root Directory** to `apps/web` and `apps/dashboard`. Each has a
`vercel.json`. The web project's `build:deploy` script builds the SDK, checks its size, builds the
preview extension (`apps/extension`), builds the site and docs, and copies `v1.js`,
`splitcraft-qa.iife.js`, `splitcraft-metrics.iife.js` and `splitcraft-preview.iife.js` to `/sdk/`
and the extension zip to `/extension/splitcraft-preview.zip`. The extension only talks to the
dashboards listed in `apps/extension/src/protocol.ts` and its manifest; add a new dashboard domain
in both.

Environment variables:

| Project        | Variable                  | Value                                         |
| -------------- | ------------------------- | --------------------------------------------- |
| dashboard      | `VITE_SUPABASE_URL`       | Supabase project URL                          |
| dashboard      | `VITE_SUPABASE_ANON_KEY`  | Supabase anon (publishable) key               |
| dashboard      | `VITE_SDK_URL`            | `https://<web domain>/sdk/v1.js`              |
| dashboard      | `VITE_SITE_URL`           | `https://<web domain>`                        |
| web            | `VITE_DASHBOARD_URL`      | `https://<dashboard domain>`                  |

## Supabase

```sh
npx supabase login
npx supabase link --project-ref <ref>
npx supabase db push
npx supabase functions deploy config --use-api
npx supabase functions deploy events --use-api
```

- **Authentication › URL Configuration**: Site URL = the dashboard URL; redirect URLs =
  `https://<dashboard domain>/**` and `http://localhost:5173/**`. These are also declared in
  `supabase/config.toml`.
- **Sign-in providers** (Authentication › Sign In / Providers):
  - GitHub: create an OAuth app (homepage = dashboard URL, callback =
    `https://<ref>.supabase.co/auth/v1/callback`) and paste its client id and secret.
  - Google: create an OAuth client (type Web application, JavaScript origin = dashboard URL, redirect
    URI = the same callback) and paste its id and secret.
  - Magic links use Supabase's default email template; nothing to set.
- The guardrail job uses `pg_cron`, which the migration enables and schedules.

## npm package

```sh
npm login
npm run build -w packages/sdk
npm publish -w packages/sdk --access public
```

The `@splitcraft` scope must belong to your npm account. The package's license is `UNLICENSED`
until the repository has one.

## CI

GitHub Actions (`.github/workflows`) runs, on every pull request and push to `main`: `npm ci`, lint,
format check, typecheck, all tests, build, and the SDK size check.
