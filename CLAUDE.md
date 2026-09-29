# Splitly

A/B testing platform (portfolio project): a small client-side SDK plus a dashboard to create experiments, target audiences, define metrics and read results.

## Stack
- Monorepo with npm workspaces
- `packages/sdk` — TypeScript, Vite library mode, Vitest. Main bundle < 7 KB gzipped (QA panel is a separate file, < 3 KB), no runtime dependencies. `npm run size -w packages/sdk` checks it.
- `apps/dashboard` — React + Vite + TypeScript, React Router, Monaco editor for variant code, Recharts for results.
- `apps/web` — marketing site (home page).
- Backend — Supabase (Postgres, Auth, Row Level Security). No custom server in v1.

## Design
- Designs live in the Claude canvas "Splitly Dashboard". Match them.
- Colors: ink `#15171A`, ground `#F4F5F2`, surface `#FFFFFF`, line `#E3E5DF`, muted text `#5F6660`, accent `#0F6B57`, accent soft `#E4F1EC`, variant A `#3B5B8C`, variant B `#D97A2B`, highlight `#F2B37A`, danger `#B3261E`.
- Fonts: Instrument Sans (UI), JetBrains Mono (code, numbers, keys).
- No emoji in UI. Buttons, inputs and labels must be real elements with visible focus states.

## Domain rules
- Bucketing: deterministic hash (FNV-1a or MurmurHash3) of `userId + experimentKey` → 0–9999, mapped to traffic allocation.
- Targeting: Who (segments, persistent) / Where (URL + element rules) / How (session triggers) / When (frequency). Groups support ALL / ANY / NONE and nesting.
- Metrics: event source first (click selector, pageview, custom JS, dataLayer, transaction), then aggregation (unique conversions, total conversions, sum of value, value per conversion).
- Stats: two-proportion z-test and Bayesian chance-to-win for conversion metrics; SRM chi-square check on every experiment; show uplift with its 95% range.
- Public SDK API: `splitly.trackEvent(key, props)`, `splitly.waitForElement(sel, fn)`, `splitly.onceInView(el, fn)`, `splitly.onRouteChange(fn)`, `splitly.injectStyles(css)`, QA param `?splitly_force=exp:variant`.

## Commands
- `npm install` — install all workspaces
- `npm run dev -w apps/dashboard` — dashboard dev server
- `npm run test -w packages/sdk` — SDK tests
- `npm run test -w supabase` — database, RLS and Edge Function tests (PGlite, no Docker)
- `npm run build` — build everything

## Working rules
- Small, focused commits using Conventional Commits (`feat(sdk): add bucketing`, `fix(dashboard): …`, `test(sdk): …`).
- Write tests for every SDK function before marking it done.
- Never commit `.env` files or Supabase keys. Use `.env.example` for placeholders.
- Ask before adding a new dependency to `packages/sdk`.

## Where to look first
- `docs/PRODUCT_SPEC.md` — full behaviour spec: IA, experiment steps, targeting, metrics, stats, SDK API, auth, data model.
- `docs/DECISIONS.md` — why things are the way they are. Don't reverse a decision without asking.
- `docs/BUILD_PLAN.md` — phase order and the next task.
- `design/README.md` — screen → route map. `design/screens/*.html` are the exact designs; `design/tokens.css` holds colours and type.
- Before building any screen, open its file in `design/screens/` and match spacing, sizes and copy.
