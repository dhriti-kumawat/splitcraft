---
title: Targeting
description: WHO / WHERE / HOW / WHEN, conditions, saved audiences, evaluation settings and reach.
---

# Targeting

| Part   | Meaning                                   | Remembered                          |
| ------ | ----------------------------------------- | ----------------------------------- |
| WHO    | Segments: traits that stay true across visits | Per visitor (cookie / localStorage) |
| WHERE  | Pages: URL rules and element rules        | Checked per page                    |
| HOW    | Triggers: conditions in the current visit | Session only                        |
| WHEN   | Frequency                                 | Per visitor                         |

A visitor is in the experiment when all four match; then traffic and bucketing decide the variant.

## WHERE

- **Include** rules are ORed; **exclude** rules always win. Operators: is, contains, matches
  pattern (`/trips/*`), regex.
- **Element on page exists** (CSS selector) is ANDed, with a wait (default 3 s).
- No rules: every page.

## Conditions (WHO and HOW)

Built from groups with a mode: **ALL**, **ANY** or **NONE** (exclude). Groups nest; top-level groups
are ANDed. Every group shows its match % from recent sessions.

| Category   | Conditions                                                                          |
| ---------- | ----------------------------------------------------------------------------------- |
| Navigation | New or returning, session number, pages viewed this visit, pages viewed matching X N times in D days |
| Technology | Device type, screen width                                                           |
| Location   | Country (see below)                                                                 |
| Traffic    | UTM parameter (first- or last-touch), source type (direct, organic, paid, social, email, referral) |
| Expert     | Cookie, dataLayer value, JS variable, custom JavaScript returning true              |

String operators: is, is not, contains, doesn't contain, starts with, ends with, matches regex,
exists, doesn't exist. Number operators: is, is not, is more than, is at least, is less than, is at most.

**Country** comes from the config endpoint: when a live experiment uses it, the endpoint looks up the
visitor's IP with api.country.is (800 ms timeout, one-hour cache; the IP isn't stored) and those
config responses are cached privately. If the lookup fails, the country is unknown.

## WHEN

Every page load, once, once per session, or every N days.

## Activation

When the test starts on a page that matches WHERE (like Optimizely's page activation):

| Mode | Starts when | Notes |
| --- | --- | --- |
| Immediately | The page loads or the route changes | The default |
| When an element appears | A CSS selector matches (watched with a MutationObserver) | For late content: cart drawers, modals, lazy sections |
| When a JS condition is true | Your code returns true; checked every 100 ms | e.g. `return window.cartLoaded === true;` |
| Manually | The site calls `splitcraft.activate('experiment-key')` | e.g. after an add-to-cart AJAX call; once per page |

Element and JS waits stop after a limit you set (0.1–60 s, default 10 s); if it passes, the
visitor isn't in the test on that page. Waiting tests never keep the page hidden, and a route
change cancels them. After activation, WHO, HOW and WHEN are checked as usual.

## Evaluation settings

- **Once matched, stay in audience**: after a visitor has seen the experiment, WHO and HOW aren't
  checked again (WHERE and WHEN still are).
- **Wait for dataLayer up to N ms** (0–5,000): before deciding, wait until every dataLayer key the
  rules use has a value.

## Saved audiences

Project › **Audiences** has three tabs:

- **Segments**: linked by id. Editing a segment changes every experiment that uses it, from the next page load.
- **Triggers** and **Page sets**: inserted as copies (**Insert saved trigger**, **Use saved page
  set**), so later edits don't change experiments. Save the current rules with **Save these
  conditions as a trigger** / **Save these rules as a page set**.
- **Insert saved audience** in the segment builder adds another segment's rules as extra groups.

## Reach estimate

**Who will see this** estimates reach from up to 2,000 sessions of the last 30 days (one SDK `ping`
per session), using the SDK's own matchers: "18% of sessions · ≈ 350 visitors a day", and how long
the planned sample takes at that rate. Rules that need the live page (cookies, dataLayer, JS, page
history, elements) can't be judged from a ping, so reach is then a range. Pages are judged by where
each session started.

## Test a URL

The URL tester runs the SDK's WHERE matcher against any URL and explains each rule. It starts with
the experiment's test page.
