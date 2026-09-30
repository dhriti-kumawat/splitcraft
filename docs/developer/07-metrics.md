---
title: Metrics and goals
description: Event sources, how to measure them, counting windows, and goal roles.
---

# Metrics and goals

A metric is an **event source** plus **how to measure it**. Metrics live in Project › **Metrics** and
are reused by experiments as goals. Each has an **event key** (unique per project).

## Event sources

| Source          | Defined by                                                        | Sent as                               |
| --------------- | ----------------------------------------------------------------- | ------------------------------------- |
| Click · selector | CSS selector list (comma = any). Every click or first per page. Health check warns on fragile selectors (`:nth-child`, generated classes). | Delegated capture listener on `document`; elements added later count |
| Pageview · URL  | A URL rule (is, contains, pattern, regex)                        | Matched in the browser, from launch on |
| Custom JS       | Tracker code that calls `splitcraft.trackEvent(key, props)`, on chosen pages | Runs once per page, in `try / catch` |
| dataLayer       | Event name, optional property filters (all must match), optional value path | Watches `window.dataLayer` pushes (works with GTM) |
| Transaction     | Purchase event (GA4 `purchase` by default), value / id / currency paths | Each transaction id counts once, even if the thank-you page reloads |
| Browsing        | Engaged visitors, pages per visitor, time on site, returning visitors | Fixed keys `browse.*`, from the on-demand metrics file |
| Web Vitals      | LCP, INP or CLS                                                  | Fixed keys `vitals.*`, measured with PerformanceObserver, sent when the page is hidden |

Browsing and Web Vitals code only loads when a live experiment uses them. Browsing goals send an event
per page, which counts toward the monthly allowance.

## How to measure

| Measure              | Per variant                                        | Test                  |
| -------------------- | -------------------------------------------------- | --------------------- |
| Unique conversions   | Visitors who fired it at least once ÷ visitors     | Two-proportion z-test + Bayesian |
| Total conversions    | Events per visitor                                 | Means (normal approximation) |
| Sum of value         | Value per visitor (capped at the 99th percentile)  | Means                 |
| Value per conversion | Average value among visitors who fired it          | Means                 |
| Click-through rate   | Clickers ÷ visitors who **saw** the element        | Proportion            |
| Time to first click  | Seconds from page load to each visitor's quickest first click | Means, lower is better |

Settings: **winning direction** (increase or decrease), and a **counting window** (1–90 days after the
visitor's first exposure; 7 by default).

Click-through rate makes the SDK send `<key>:view` once per page when a matching element is at least
half in view. Time to first click makes it send the seconds since page load (or the last SPA
navigation) as the value of each page's first click.

## Goals in an experiment

- **Primary**: exactly one; it calls the winner. Set it before launch; you can change it at any
  time, also while live or after the end, and results are recalculated for the new goal.
- **Secondary**: any number; reported only.
- **Guardrails**: a metric plus a limit (default: must not get worse by more than 2%). Crossing one
  with 95% confidence pauses the experiment automatically (see [Results](results)).

Action and custom-event goals only count from launch (or from when they were added): add them
before you launch. The goal types on the Goals step open the metric editor; the new metric then
becomes the experiment's primary goal if it has none, otherwise a secondary goal, and you return
to the experiment. The Goals step also has **or create a new metric** next to the primary goal.
