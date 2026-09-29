# Design reference

These files are the exported source of the Splitly design canvas ("Splitly Dashboard").
Each one is a single screen at its real size. **Match them when building the app.**

## How to read them

- They are reference HTML, not production code. Styles are inline so every value
  (spacing, colours, font sizes, radii) is visible right in the markup.
- They were authored for the canvas runtime. `<x-dc>`, `<helmet>`, `<sc-if>`, `<sc-for>`
  and `{{holes}}` are canvas template syntax. Treat `<sc-if>` as conditional rendering,
  `<sc-for>` as a list map, and `{{name}}` as a prop/state value.
- The `<script type="text/x-dc">` block in the auth screens holds the real form logic
  (validation, password rules, loading, reset flow). Port it to React hooks.
- Numbers on screens are example data, but they are internally consistent
  (sample size, SRM, uplift ranges). Keep that honesty in real calculations.
- Opening a file directly in a browser shows most static screens roughly right.
  Interactive ones (auth) show `{{…}}` placeholders outside the canvas.
- Images of every screen: export them from the canvas (Share › Export) into `design/images/`.

## Screen map

| File | Screen | Route in the app | Size |
|---|---|---|---|
| 00-home.html | Marketing home page | `apps/web` `/` | 1440 × 4400 |
| 01-auth-desktop.html | Log in / Sign up / Forgot / Check email / Success (one component, mode state) | `/login`, `/signup`, `/forgot-password` | 1440 × 980 |
| 02-auth-mobile.html | Same auth at phone width | responsive version of above | 390 × 1000 |
| 10-projects.html | Workspace › Projects grid + New project drawer (install snippet) | `/projects` | 1440 × 900 |
| 11-experiments-list.html | Project › Experiments table with status filters | `/p/:projectId/experiments` | 1440 × 900 |
| 12-exp-step1-basics.html | Experiment step 1: hypothesis, targeting summary, traffic split, goals summary, sample size, launch checklist | `/p/:id/experiments/:expId/basics` | 1440 × 900 |
| 13-exp-step2-variant-code.html | Step 2: variants list + JS/CSS code editor (Monaco) + helpers + version history | `…/variants` | 1440 × 900 |
| 14-exp-step3-targeting.html | Step 3: WHO / WHERE / HOW / WHEN + reach + URL tester | `…/targeting` | 1440 × 900 |
| 15-exp-step4-goals.html | Step 4: primary goal, secondary goals table, guardrails, add-goal picker | `…/goals` | 1440 × 900 |
| 16-exp-step5-results.html | Step 5: verdict banner, KPIs, variant table, cumulative chart | `…/results` | 1440 × 900 |
| 17-qa-mode-mobile.html | QA panel the SDK injects on the customer site | SDK UI (`?splitly_force=`) | 390 × 844 |
| 20-segment-builder.html | Project › Audiences: segment builder (nested ALL/ANY/NONE groups) | `/p/:id/audiences/:segmentId` | 1440 × 900 |
| 21-metric-click-tracker.html | Project › Metrics: click tracker via CSS selector | `/p/:id/metrics/new?source=click` | 1440 × 900 |
| 22-metric-custom-js-tracker.html | Project › Metrics: custom JS tracker with code editor | `/p/:id/metrics/new?source=custom-js` | 1440 × 900 |

## Shared layout pieces (build once as components)

- **App shell**: 240 px dark sidebar (`#15171A`): logo, workspace switcher, Projects/Team,
  "Current project" label, project switcher, project nav (Experiments, Audiences, Metrics,
  Install, Settings), events usage meter, user row. White 64 px top bar with breadcrumb.
- **Experiment stepper**: tabs `1 Basics · 2 Variants & code · 3 Targeting · 4 Goals · 5 Results`
  with a done tick or step number.
- **Condition row** (used in segments and targeting): field button, operator button,
  value box with chips/code, remove button.
- **Pills**: Live (green), Draft (grey), Paused (amber), Ended (blue).
