# Build plan

Order matters: each phase uses the previous one. One branch + PR per task.
Prompts are written to paste into Claude Code as-is.

## Phase 0 · Repo setup
**Branch:** `chore/monorepo-setup`
> Read CLAUDE.md, docs/PRODUCT_SPEC.md and design/README.md. Set up an npm workspaces monorepo with `packages/sdk` (TypeScript, Vite library mode, Vitest), `apps/dashboard` (Vite + React + TS + React Router) and `apps/web` (Vite + React + TS). Add ESLint, Prettier, a root `.gitignore` that ignores `.env*` except `.env.example`, and a GitHub Actions workflow running lint, typecheck and tests. Add `design/tokens.css` as shared CSS variables. Commit in small steps and open a PR.

## Phase 1 · SDK core (packages/sdk)
1. `feat/sdk-visitor-and-bucketing`
   > Implement visitor id (cookie, localStorage fallback) and deterministic bucketing per PRODUCT_SPEC §7 (hash of visitorId + experimentKey → 0–9999 → weights). Tests: same input gives same variant; 100,000 visitors split within ±1% of the weights; traffic % excludes the right share.
2. `feat/sdk-targeting`
   > Implement the targeting evaluator for WHO/WHERE/HOW/WHEN with nested ALL/ANY/NONE groups (PRODUCT_SPEC §4). Start with the bold conditions. Rules are JSON; write a TypeScript type for them. Full unit tests, including include/exclude URL precedence and "element exists" with timeout.
3. `feat/sdk-apply-and-antiflicker`
   > Apply variant CSS/JS safely (try/catch, one-time per page), anti-flicker with a 400 ms cap, and the helpers `waitForElement`, `onceInView`, `onRouteChange`, `injectStyles`. SPA route handling. Tests with jsdom.
4. `feat/sdk-tracking`
   > Exposure events (once per page per experiment), goal tracking for click selectors (delegated listener), pageview rules and `trackEvent`. Batch and send with `navigator.sendBeacon` fallback to fetch; also push to `window.dataLayer`. Tests.
5. `feat/sdk-qa-mode`
   > `?splitly_force=exp:variant` support and the QA panel from design/screens/17-qa-mode-mobile.html, rendered in a shadow root so site CSS can't break it.
6. `chore/sdk-size-budget`
   > Add a size check in CI that fails above 7 KB gzipped (main bundle) and 3 KB (QA panel). Budget raised from 5 KB, see DECISIONS #17.

## Phase 2 · Backend (Supabase)
> Create SQL migrations for the data model in PRODUCT_SPEC §10 with Row Level Security. Add an Edge Function (or insert-only policy) for SDK events and a config endpoint the SDK fetches by project public key. Put keys in `.env.example` as placeholders only.

## Phase 3 · Dashboard (apps/dashboard) — match design/screens exactly
1. `feat/dashboard-shell` — app shell, sidebar, top bar, routing, tokens. (10-projects.html chrome)
2. `feat/auth` — port 01/02-auth screens to React with Supabase Auth; keep every message and state.
3. `feat/projects` — projects grid, new-project drawer with install tabs, install verification.
4. `feat/experiments-list` — table + status filters.
5. `feat/experiment-basics` — step 1 incl. sample-size planner.
6. `feat/variant-editor` — step 2 with Monaco, versions, preview link.
7. `feat/condition-builder` — shared nested group builder component, used by…
8. `feat/segments` and `feat/targeting` — 20-segment-builder and 14-targeting screens.
9. `feat/metrics` — click tracker (21) and custom JS tracker (22).
10. `feat/goals` — step 4 with guardrails.
11. `feat/results` — step 5: z-test, Bayesian chance to win, uplift range, SRM, chart (Recharts). Unit-test the stats with the worked example in PRODUCT_SPEC §6.

## Phase 4 · Marketing site (apps/web)
> Build the home page from design/screens/00-home.html as React components. Responsive down to 390 px. Lighthouse 95+.

## Phase 5 · Polish for portfolio
- Install Splitly on your own demo site and run one real test.
- Traffic simulator script to fill results for demos.
- README with architecture diagram, GIFs, bundle size, Lighthouse score.
- Write-up / LinkedIn post per phase.

## v1.1 (later)
Chrome preview extension · combine-metrics ratio · more condition types · visual editor (maybe).
