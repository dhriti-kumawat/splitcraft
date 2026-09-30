---
title: Experiments
description: Test types, the five steps, variant code, previews, launching, and the experiment lifecycle.
---

# Experiments

An experiment belongs to a project and has a unique **key** (made from its name, e.g.
`sticky-book-now-bar`). The key is what the SDK, QA links and the npm hook use.

## Test types

Pick the type in **New experiment**. It can't change later; duplicate the experiment instead.

| Type              | Variants are                                         | Use it for                                  |
| ----------------- | ---------------------------------------------------- | ------------------------------------------- |
| A/B test          | JS and CSS that change the page                      | One idea, such as a sticky Book button      |
| Split URL test    | Separate page URLs; the SDK redirects to them        | Redesigned pages, different page templates  |
| Multivariate test | Every combination of section versions (generated)    | Several changes at once, to find the best mix |

### Split URL tests

- Step 2 (**Variant pages**) takes one URL per variant, as a path or a full URL on one of the
  project's domains. Control is the original page.
- Limit the **WHERE** rules to the original page. Launch is blocked until you do, because otherwise
  every page would redirect.
- A visitor bucketed into a variant is sent there with `location.replace`, after the exposure is
  queued. The page stays hidden until then, the query string (UTM tags, QA parameters) and hash are
  kept, and nothing happens when the visitor is already on that page.
- Install the snippet on the variant pages too, so goals count there.

### Multivariate tests (MVT)

- Step 2 (**Sections**) holds up to 3 sections (for example Headline, Hero image, Button), each with
  up to 4 versions. The first version of each section is the original page; the others get JS and CSS.
- **Save and build combinations** creates one variant per combination (the full factorial, at most
  16) with equal weights. All originals is Control. Keys are `v` plus one digit per section, so
  `v10` is version 2 of section 1 with the original of section 2. Each version's code runs in its
  own block, so versions can reuse variable names.
- Sections and versions can only be added or removed in a draft; code can change while live.
- Results list every combination, best first, and add a table per section: each version pooled over
  all combinations that show it, compared with that section's original (the main effect).

## The five steps

| Step            | What you set                                                                            |
| --------------- | --------------------------------------------------------------------------------------- |
| 1 Basics        | Name, hypothesis, **test page**, traffic split, sample-size planner, launch checklist   |
| 2 Variants      | A/B: JS and CSS per variant, templates, version history. Split URL: a page per variant. MVT: sections and versions |
| 3 Targeting     | WHO / WHERE / HOW / WHEN, evaluation settings, reach estimate, URL tester (see [Targeting](targeting)) |
| 4 Goals         | One primary goal, secondary goals, guardrails (see [Metrics](metrics))                  |
| 5 Results       | Verdict, uplift and range, chance to win, SRM, cumulative chart (see [Results](results)) |

A step shows a tick when it's done.

## Test page and preview

- **Test page** (Basics): the page the experiment runs on, as a path (`/trips/norway`) or a full URL
  on one of the project's domains. The dashboard warns when it isn't matched by the WHERE rules.
- **Preview on site** shows a variant on the real page, only to you, before launch. It opens the
  test page (or the home page) in a new tab. Three ways, most reliable first:

  | Way | Needs | Shows | Live edits |
  | --- | --- | --- | --- |
  | **Splitcraft Preview extension** | Chrome, Edge, Brave or Arc, installed once | Any page of the project's domains, snippet or not | Yes: CSS as you type, JS with an automatic reload |
  | **Preview bookmark** | Dragging a bookmark once | Pages without the snippet | Yes, while the dashboard tab that opened the page stays open; otherwise the saved code |
  | **With the snippet** | The snippet on the page | Saved code, with the QA panel | No: save, then reload |

  With the extension installed, **Preview on site** opens the preview at once; the arrow next to
  it shows the other ways. A floating **Splitcraft preview** panel on the page shows which variant
  is on, switches variants and stops the preview. While a preview is open, the dashboard shows
  **Previewing live**, and picking a variant in the editor shows it on the page.

- **Installing the extension**: in Preview on site, download the zip (served at
  `/extension/splitcraft-preview.zip` on the site), unzip it, open `chrome://extensions`, turn on
  **Developer mode**, click **Load unpacked** and choose the `splitcraft-preview` folder, then
  reload the dashboard. For sites whose Content-Security-Policy blocks running code, also turn on
  **Allow user scripts** in the extension's **Details**: variant JS then runs through
  `chrome.userScripts`, which the page can't block. CSS always applies (constructable style sheets).
- **With the snippet** the link is
  `?splitcraft_force=<experiment>:<variant>&splitcraft_preview=<token>`, repeated in the hash so it
  survives redirects that drop the query string. The force parameter picks the variant and opens
  the QA panel; the secret preview token makes the config include this experiment **even as a
  draft or paused**, with its targeting removed. Both are remembered for the browser tab.
- The extension and the bookmark own the experiment on that page: if the snippet is there too, it
  leaves that experiment alone. Previews never send events.

## Variant code

- Control is usually empty. Each other variant gets JS and CSS, with `splitcraft.*` helpers in scope
  (see [SDK reference](sdk#variant-code)).
- **Template** opens a gallery of working starting points (headline swap, button copy and colour,
  promo banner, sticky bar, reorder sections, image swap, trust row, hide element). If the variant
  already has code, you choose to replace it or add the template below.
- The editor checks syntax as you type; saving keeps the previous code as a version you can restore.
- **+ Add variant** asks for the variant's name first. An experiment can have up to 26 variants
  (Control plus keys `b` to `z`); names can be changed later, keys can't.
- **Traffic split** (on Basics and next to the variants) sets each variant's share. Adding or
  removing a variant splits traffic evenly again; change any share afterwards, as long as they add
  up to 100%, or use **Split evenly**. The split locks at launch. **Traffic** (Basics) sets how many
  matching visitors enter at all.
- With more than four variants, results list them best first and chart Control and the three
  leading variants.

## Launching

**Launch experiment** is enabled when the checklist passes: the snippet is installed, a primary goal
is set, and variant code is saved without errors (split URL: every variant has a URL and WHERE is
limited; MVT: at least one section with a new version). The checklist also reminds you to preview on the
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
