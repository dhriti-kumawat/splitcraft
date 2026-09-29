---
title: Contributing and troubleshooting
description: Conventions, where decisions live, and fixes for common problems.
---

# Contributing and troubleshooting

## Conventions

- Small, focused commits with [Conventional Commits](https://www.conventionalcommits.org):
  `feat(sdk): …`, `fix(dashboard): …`, `test(backend): …`, `docs: …`.
- Every SDK function has tests before it's done; the SDK stays dependency-free and inside its size
  budgets (`npm run size -w packages/sdk`).
- UI matches `design/screens/`; buttons, inputs and labels are real elements with visible focus; no emoji.
- Never commit `.env` files or keys. Placeholders go in `.env.example`.
- Read `docs/DECISIONS.md` before changing direction; add a row when you make a new decision.
- Product behaviour is specified in `docs/PRODUCT_SPEC.md`.

Before a pull request: `npm run lint && npm run format:check && npm run typecheck && npm test && npm run build`.

## Troubleshooting

| Problem                                         | Check                                                    |
| ----------------------------------------------- | -------------------------------------------------------- |
| Project stays "Waiting for the first ping"      | Snippet in `<head>` of a page on the project's domain; `data-config` URL correct; `localhost:<port>` added to **Also allow on** for local pages |
| Events rejected with 403                        | The page's domain isn't the main domain, `www.`, or in **Also allow on** |
| Events rejected with 429                        | Monthly limit (100,000 on free) or rate limit; the sidebar shows usage |
| Variant doesn't show                            | Experiment live; test page matched by WHERE (Basics warns); visitor in WHO / HOW; traffic below 100%?; try `?splitcraft_force=` |
| Variant code does nothing                       | Browser console shows `[splitcraft]` errors; use `waitForElement` for elements rendered later |
| Page flashes the original                       | Install the script directly in `<head>` (not via GTM) with anti-flicker on |
| Preview bookmark does nothing                   | The site's Content-Security-Policy blocks inline scripts or the SDK domain |
| Results say "not ready"                         | Planned sample not reached, or chance to win not decisive; keep it running |
| SRM warning                                     | Redirects or targeting that differ by variant, bots, or caching |
| Login fails with a provider error               | Callback URL and client secret in the provider and in Supabase |
| `supabase db push` asks for `--include-all`      | A migration was applied out of order; push from an up-to-date `main` |
| SDK size check fails in CI                      | Trim code, move it to an on-demand file, or agree a new budget in DECISIONS |
