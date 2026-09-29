# Splitcraft — product spec

Everything decided while designing Splitcraft. Screens live in `design/screens/`
(see `design/README.md` for the map). When this spec and a screen disagree, the screen wins
on look, this spec wins on behaviour.

## 1. What Splitcraft is

A small A/B testing platform, built as a portfolio project by a CRO developer to prove
how tools like Optimizely and AB Tasty work inside. Code-first: variants are written in
JS/CSS, not built in a visual editor.

**Positioning line:** "Know what works before you ship it."

**Honesty rules for the product and the site**
- No fake customer logos, testimonials or customer results.
- Numbers shown in the UI come from real calculations (or clearly marked demo data).
- Present Splitcraft as "built to understand experimentation platforms", not as an
  Optimizely replacement for production clients.

## 2. Information architecture

```
Workspace (Dhriti's Workspace)
├── Projects            one project = one site/app, one snippet
│   └── Project (e.g. Trip Demo · mytrips.dev)
│       ├── Experiments     list → 5-step flow per experiment
│       ├── Audiences       saved Segments + saved Triggers
│       ├── Metrics         click trackers, custom JS trackers, pageview, dataLayer, transaction
│       ├── Install         snippet + verification
│       └── Settings
└── Team
```

- A project has a **main domain** plus **allowed domains** (staging, localhost, wildcards).
- A project is "installed" when the SDK sends its first ping. Until then show
  "Waiting for first ping".
- Experiments only run on sites where the snippet is installed. Private previews on any site
  are a later Chrome extension (v1.1), not part of v1.

## 3. Experiment flow (5 steps)

1. **Basics**: name, hypothesis, traffic (% of matching visitors, split per variant),
   summaries of targeting and goals, sample-size card, pre-launch checklist.
2. **Variants & code**: Control (no code) + variants. Each variant has `variant.js` and
   `variant.css` in a Monaco editor, a template picker, built-in helpers list, save,
   version history, syntax check, "Preview on site" (opens the site with `?splitcraft_force=`).
3. **Targeting**: WHO / WHERE / HOW / WHEN (see §4).
4. **Goals**: one primary goal (locks at launch), any number of secondary goals,
   guardrails with auto-pause.
5. **Results**: see §6.

Statuses: Draft → Live → Paused → Ended. Launch is blocked until: snippet installed,
primary goal set, variant code saved without errors. QA preview is a warning, not a blocker.

## 4. Targeting model (inspired by AB Tasty's who/where/how/when)

| Part | Meaning | Persistence |
|---|---|---|
| **WHO** — Segments | Traits that stay true across visits | Stored per visitor (cookie/localStorage) |
| **WHERE** — Pages | URL rules + element rules | Checked per page |
| **HOW** — Triggers | Conditions in the current visit | Session only |
| **WHEN** — Frequency | Every page load / Once / Once per session / Every N days | Stored per visitor |

**Where rules**
- `INCLUDE` rules are ORed together; `EXCLUDE` always wins.
- Operators: is, contains, matches pattern (`/trips/*`), regex.
- "Element on page exists" (CSS selector) is ANDed, with a wait timeout (default 3 s).
- Saved page sets can be reused.

**Segments and triggers** are built in the same condition-group builder:
- Groups have a mode: **ALL**, **ANY**, **NONE** (NONE = exclude). Groups can nest.
  Top-level groups join with AND.
- Every group shows its own match %; the whole audience shows reach % and visitors/day,
  plus a warning when reach is too small for the planned sample.
- Show a plain-English summary of the rules.
- Evaluation settings: check on load + route change, wait for dataLayer up to N ms,
  "once matched, stay in audience".

**Condition catalogue** (v1 implement the bold ones)
- Navigation: **new/returning**, **session number**, days since last visit, **pages viewed this visit**
- Behaviour: **pages viewed matching X, N times in D days**, events fired, past experiment variant
- Purchase: last purchase, purchase frequency, cart abandoned
- Technology: **device type**, browser, OS, **screen width**, language
- Location: **country**, city, timezone, weather (later)
- Traffic: **UTM params** (first-touch or last-touch), **source type**, referrer, landing page
- External: GA4 audiences, Mixpanel, CRM ID list (later)
- Expert: **cookie**, localStorage, **dataLayer value**, **JS variable**, **custom JavaScript returns true**

## 5. Metrics and goals (inspired by AB Tasty trackers and Optimizely events)

A metric = **event source** + **how to measure**.

**Event sources**
| Source | Defined by | Notes |
|---|---|---|
| Click · selector | CSS selector list (comma = any) | Delegated listener on `document` so SPA re-renders work. Options: every click / first per page, keyboard Enter, elements added later. "Pick on page" picker. Selector health checks (warn on `:nth-child`, generated classes). |
| Pageview · URL | URL rule | Matched in the browser in v1, counted from launch (not retroactive; see DECISIONS #19) |
| Custom JS | Event key + tracker code that calls `splitcraft.trackEvent(key, props)` | Runs on chosen pages at DOM ready, sandboxed in try/catch. Checks: syntax, key present in code, selector exists, bad values (NaN). Live event log in preview. |
| dataLayer | Event name + property filters | |
| Transaction | Purchase event: value, currency, items, `transaction_id` for dedupe | |
| Browsing (auto) | Bounce, exit, pages per session, revisit, time on site | |
| Web Vitals (auto) | LCP, INP, CLS per variant | Used as guardrails |

**Measure as**
- Unique conversions (visitors who fired at least once)
- Total conversions (events per visitor)
- Sum of value (per visitor, capped at p99)
- Value per conversion
- Click-through rate / time to first click (click trackers)
- Settings: direction (increase/decrease), counting window (e.g. 7 days after exposure),
  property filters, dedupe key, unit, format.

**Goals in an experiment**
- Primary: exactly one; used to call the winner; locked after launch.
- Secondary: many; reported only.
- Guardrails: metric + limit (e.g. purchase rate must not drop > 2%, LCP p75 must not rise
  > 100 ms, CLS p75 < 0.1). Auto-pause when crossed with 95% confidence.
- Warning: action and custom-event metrics only count from launch (not retroactive).

## 6. Statistics

- Conversion metrics: two-proportion z-test **and** Bayesian chance-to-win (Beta-Binomial,
  flat prior). Show uplift with its 95% range, not just a point value.
- Revenue/value metrics: per-visitor means with outliers capped at p99.
- **SRM check** (chi-square) on every experiment; banner when p < 0.01.
- **Sample size planner**: baseline rate + smallest lift (MDE) → visitors per variant at
  95% confidence / 80% power, and days needed at current targeted traffic.
- Verdict banner in plain words, e.g. "Variant B is ahead, with a 96% chance to beat
  Control. 92% of the planned sample reached. Keep it running about 1 more day."
- Worked example used in the designs (keep tests consistent with it):
  Control 12,480 visitors / 622 conversions (4.98%), B 12,380 / 677 (5.47%),
  uplift +9.7%, 95% range −1.4% to +20.8%, chance to win ≈ 96%, SRM 50.2/49.8 p ≈ 0.53.

## 7. SDK (packages/sdk)

- Loaded by `<script src="https://splitcraft.app/sdk/v1.js" data-project="prj_xxx" async>`,
  or npm + `useExperiment(key)` React hook.
- < 7 KB gzipped (QA panel loaded separately, < 3 KB), no runtime dependencies.
- Flow: read/create visitor id cookie → fetch project config → evaluate targeting →
  bucket → anti-flicker (hide page max 400 ms) → apply variant JS/CSS → send exposure →
  listen for goals → push events to backend and `window.dataLayer`.
- Bucketing: FNV-1a or MurmurHash3 of `visitorId + experimentKey` → 0–9999 → traffic
  allocation. Same visitor, same variant, every visit.
- SPA: re-evaluate and re-apply on route changes (History API patch + popstate).
- QA: `?splitcraft_force=expKey:variant` forces a variant and shows the QA panel
  (see `17-qa-mode-mobile.html`): active experiments, how each was assigned
  (forced / bucketed), events sent, switch variant, reset, hide.
- Public API:
  ```ts
  splitcraft.trackEvent(key: string, props?: { value?: number; [k: string]: unknown }): void
  splitcraft.waitForElement(selector: string, fn: (el: Element) => void, opts?: { timeout?: number }): void
  splitcraft.onceInView(el: Element, fn: () => void): void
  splitcraft.onRouteChange(fn: (url: string) => void): () => void
  splitcraft.injectStyles(css: string, id?: string): () => void
  ```

## 8. Auth (apps/dashboard)

One component with modes: `login`, `signup`, `forgot`, `sent`, `welcome`, `created`.
Centered card on a light grid background (see `01-auth-desktop.html`).
- Social buttons: Google, GitHub, SSO (SSO can be a stub in v1).
- Validation on blur and on submit. Error text under each field, `aria-invalid`,
  `aria-describedby`. Messages:
  - "Enter your full name." / "Enter your email address." /
    "This email is missing something. Check for typos." / "Enter your password."
  - Sign-up password: "Use 8+ characters with a number and upper and lower case."
  - Terms: "Accept the terms to create your workspace."
  - Wrong login: "Email or password is incorrect. Try again or reset your password."
- Password: show/hide toggle (`aria-pressed`), Caps Lock warning, sign-up strength meter
  (4 bars) + checklist (8+ chars, number, upper+lower, symbol optional).
- Login: "Forgot password?", "Keep me logged in for 30 days".
- Forgot → "Check your email" with the address, "Resend link" with 30 s countdown.
- Loading state on submit button; success screens link to Projects.
- Real backend: Supabase Auth (email/password, magic link later, Google/GitHub OAuth,
  password reset).

## 9. Marketing site (apps/web)

Sections in order (see `00-home.html`): nav (Product, Developers, Statistics, Docs, Pricing,
Changelog, Log in, Start free) · hero with product screenshot · "Works with your stack" ·
3 product cards (Variants in real code, Targeting without limits, Any metric you can name) ·
dark developer section with install/track/hook code · 4 statistics points · 3-step how it
works · green CTA band · footer.
Pricing line used: "Free up to 100,000 events a month. No card needed."

## 10. Data model (Supabase, first draft)

```
workspaces(id, name, plan, created_at)
workspace_members(workspace_id, user_id, role)
projects(id, workspace_id, name, main_domain, allowed_domains text[], public_key, installed_at, settings jsonb)
segments(id, project_id, name, rules jsonb)          -- condition groups
triggers(id, project_id, name, rules jsonb)
page_sets(id, project_id, name, rules jsonb)
metrics(id, project_id, name, event_key, source, source_config jsonb, measure, measure_config jsonb)
experiments(id, project_id, key, name, hypothesis, status, traffic_pct,
            targeting jsonb,   -- {who:{mode,segmentIds}, where:[...], how:{mode,rules}, when:{...}}
            primary_metric_id, planned_sample, started_at, ended_at, archived_at)
experiment_metrics(experiment_id, metric_id, role)   -- 'secondary' | 'guardrail', limit jsonb
variants(id, experiment_id, key, name, weight, js, css, version)
variant_versions(id, variant_id, js, css, note, created_at)
events(id, project_id, visitor_id, experiment_id, variant_key, type, key, value, props jsonb, url, created_at)
  -- type: 'exposure' | 'goal' | 'ping'
```
- Row Level Security: members can only see their workspace's rows.
- SDK writes `events` through the `events` Edge Function, which validates the batch and
  checks the page's domain against the project (DECISIONS #20). The SDK reads its config from
  the `config` Edge Function by project public key. Never expose the service role key.
- Results are computed with SQL views or an Edge Function that aggregates `events`.

## 11. Out of scope for v1

Visual (point-and-click) editor · multivariate tests · server-side SDK · CUPED ·
sequential testing · native mobile SDKs · preview Chrome extension (v1.1) ·
custom formula metrics (removed in favour of event-source metrics; may return as
"combine metrics").
