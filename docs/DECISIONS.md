# Decision log

Why things are the way they are. Read before changing direction.

| # | Decision | Why |
|---|---|---|
| 1 | Build Splitly as the flagship portfolio project | Proves understanding of how Optimizely / AB Tasty work inside, the strongest interview story for a CRO developer. |
| 2 | Code editor, **no visual editor** in v1 | Matches real CRO dev work (custom JS/CSS). Visual editors break on dynamic sites and would add 2+ weeks. Can return as v2. |
| 3 | Use libraries for commodity parts, write the core yourself | Monaco (editor), Recharts (charts), Supabase (db/auth), a hash function are fine. Bucketing, targeting, anti-flicker, tracking, QA mode and stats choices must be your own code, because that is what interviews ask about. Never fork GrowthBook and rename it. |
| 4 | Workspace → Projects, not "Sites" | A project can be a site, a web app or a staging copy; it owns snippet, audiences, metrics, experiments. |
| 5 | Snippet must be installed for real tests | Same rule as every platform. Private previews on any site come later via a Chrome extension (v1.1). |
| 6 | No hardcoded tests | Everything is created from the dashboard; the SDK only reads config. |
| 7 | Targeting follows Who / Where / How / When | Industry model (AB Tasty). Segments persist, triggers are per visit; mixing both makes tricky audiences possible. |
| 8 | Nested ALL / ANY / NONE groups, plus custom JS condition | "Any tricky audience, not limited." |
| 9 | Metrics start from an event source | Same mental model as AB Tasty trackers and Optimizely events: clicks via CSS selector, everything else via JS / dataLayer / transaction. |
| 10 | Formula metric builder removed | Replaced by event-source builders. A "combine metrics" ratio option may come back. |
| 11 | Guardrails include Web Vitals | CRO developer angle: a variant that hurts LCP/CLS is not a win. |
| 12 | Honest statistics are a feature | Show uplift ranges, SRM, planned sample and "not ready yet" states; designs deliberately show a test that is ahead but not finished. |
| 13 | Auth = centered minimal card | Split-screen brand panel didn't feel right; top platforms (GrowthBook, Optimizely) use minimal centered login. |
| 14 | No fake logos, testimonials or customer numbers on the marketing site | Portfolio credibility. "Works with your stack" lists integrations as text only. |
| 15 | Brand | Ink `#15171A`, accent `#0F6B57`, variant B `#D97A2B` / `#F2B37A`, control `#3B5B8C`, ground `#F4F5F2`. Instrument Sans + JetBrains Mono. Logo = rounded square with a white and an orange bar. |
| 16 | QA panel ships as a separate file (`splitly-qa.iife.js`) | The main SDK must stay under 5 KB gzipped. The panel is only needed when `?splitly_force` is in the URL, so it loads on demand and normal visitors never download it. |
