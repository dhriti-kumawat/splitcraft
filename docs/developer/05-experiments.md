---
title: Experiments
description: The five steps, variant code, previews, launching, and the experiment lifecycle.
---

# Experiments

An experiment belongs to a project and has a unique **key** (made from its name, e.g.
`sticky-book-now-bar`). The key is what the SDK, QA links and the npm hook use.

## The five steps

| Step            | What you set                                                                            |
| --------------- | --------------------------------------------------------------------------------------- |
| 1 Basics        | Name, hypothesis, **test page**, traffic split, sample-size planner, launch checklist   |
| 2 Variants & code | Variants with weights, JS and CSS per variant, templates, version history             |
| 3 Targeting     | WHO / WHERE / HOW / WHEN, evaluation settings, reach estimate, URL tester (see [Targeting](targeting)) |
| 4 Goals         | One primary goal, secondary goals, guardrails (see [Metrics](metrics))                  |
| 5 Results       | Verdict, uplift and range, chance to win, SRM, cumulative chart (see [Results](results)) |

A step shows a tick when it's done.

## Test page and preview

- **Test page** (Basics): the page the experiment runs on, as a path (`/trips/norway`) or a full URL
  on one of the project's domains. The dashboard warns when it isn't matched by the WHERE rules.
- **Preview on site** opens the test page (or the home page) with
  `?splitcraft_force=<experiment>:<variant>&splitcraft_preview=<token>`. The force parameter picks
  the variant and opens the QA panel; the secret preview token makes the config include this
  experiment **even as a draft or paused**, with its targeting removed, so your change shows on
  whatever page you open. The token is remembered for the browser tab.
- **Pages without the snippet**: switch on **Preview on pages without the snippet** under the
  project's install code, drag the **Splitcraft preview** bookmark to your bookmarks bar, open
  Preview on site and click the bookmark. It loads the SDK on that page for you only (sites with a
  strict Content-Security-Policy block it). Visitors still need the snippet.

## Variant code

- Control is usually empty. Each other variant gets JS and CSS, with `splitcraft.*` helpers in scope
  (see [SDK reference](sdk#variant-code)).
- **Template** opens a gallery of working starting points (headline swap, button copy and colour,
  promo banner, sticky bar, reorder sections, image swap, trust row, hide element). If the variant
  already has code, you choose to replace it or add the template below.
- The editor checks syntax as you type; saving keeps the previous code as a version you can restore.
- Weights set the split (e.g. 50 / 50); **traffic** (Basics) sets how many matching visitors enter at all.

## Launching

**Launch experiment** is enabled when the checklist passes: the snippet is installed, a primary goal
is set, and variant code is saved without errors. The checklist also reminds you to preview on the
site first (recommended, not required). While live:

- **Pause** stops showing variants (visitors see the original) and **Resume** restarts.
- **End experiment** freezes the results. An ended experiment can't restart; duplicate it to test again.
- Targeting and code can change while live; new rules apply from each visitor's next page.
- Guardrails are checked every 15 minutes. A crossed guardrail **pauses the experiment
  automatically**, with the reason shown on the page. After you resume it, guardrails won't pause
  it again.

## Lifecycle actions

From the **⋯ More actions** menu on any experiment page:

| Action     | Rules                                                                              |
| ---------- | ---------------------------------------------------------------------------------- |
| Duplicate  | New draft "<name> (copy)" with key `<key>-copy`, same setup, code, goals and test page |
| Archive    | Only when not live. Hidden from the list's filters (see **Archived**); results kept |
| Unarchive  | Back to the list                                                                   |
| Delete     | Owners and admins only, never while live. Removes its events too; can't be undone |

## Statuses

`draft` → `live` ⇄ `paused` → `ended`, plus **archived** on top of draft, paused or ended. Only live
experiments are in the SDK config.
