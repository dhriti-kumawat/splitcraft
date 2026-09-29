# Splitcraft backend (Supabase)

- `migrations/` — schema, Row Level Security, and the SQL functions behind the SDK endpoints.
- `functions/config` — `GET /functions/v1/config/<public key>.json`: the config the SDK loads.
- `functions/events` — `POST /functions/v1/events`: event batches from the SDK.
- `functions/_shared` — plain TypeScript used by both functions and tested in Node.
- `tests/` — Vitest on PGlite (Postgres in WebAssembly). No Docker needed.

## Test

```sh
npm run test -w supabase
```

## Deploy

Needs a Supabase project (free tier is fine) and the Supabase CLI via `npx`. No Docker.

```sh
npx supabase login
npx supabase link --project-ref <your-project-ref>
npx supabase db push
npx supabase functions deploy config --use-api
npx supabase functions deploy events --use-api
```

Then install the snippet with the config URL:

```html
<script
  src="https://splitcraft.vercel.app/sdk/v1.js"
  data-project="prj_…"
  data-config="https://<your-project-ref>.supabase.co/functions/v1/config/prj_….json"
  async
></script>
```
