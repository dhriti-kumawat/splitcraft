---
title: Results and statistics
description: How results are counted and tested, and what the verdict means.
---

# Results and statistics

## Counting

- Visitors belong to the variant of their **first exposure** in the experiment.
- A goal counts when it happens after that exposure and inside the metric's counting window.
- Per-visitor values (sums, totals) are capped at the **99th percentile**, so one huge order can't
  decide a test.
- The SQL function `experiment_results(experiment)` returns, per metric and variant: visitors,
  converters, events (and sum of squares), value sum (and sum of squares) and, for click-through
  rate, viewers. `experiment_daily` feeds the cumulative chart.

## Tests

| What                 | Method                                                                   |
| -------------------- | ------------------------------------------------------------------------ |
| Conversion metrics   | Two-proportion z-test; uplift = relative change vs control; 95% range from the unpooled standard error |
| Chance to win        | Bayesian, Beta(1, 1) priors, exact closed form (normal approximation above 50,000 conversions) |
| Value metrics        | Difference of means with a normal approximation; chance to win from the same |
| Sample ratio (SRM)   | Chi-square test of visitors per variant against the planned weights; flagged when p < 0.01 |
| Sample size planner  | Visitors per variant for a baseline rate and smallest lift, 95% confidence and 80% power |

Worked example (tested in `apps/dashboard/src/lib/stats.test.ts`): Control 12,480 visitors / 622
conversions and B 12,380 / 677 give +9.7% uplift (95% range −1.4% to +20.8%), 96% chance to beat
control, and an SRM p-value of 0.53.

## Multivariate tests

Each combination is a variant, so the table and tests above apply to it, with the best
combinations listed first and the top three in the chart. A table per section then pools each
variation over every combination that shows it and compares it with the section's original (the
main effect), with the same z-test and chance to win. Main effects assume the sections don't
interact much; the combination table shows when they do.

## The verdict

The results page says in plain words whether there is a winner, a loser, or not enough data yet,
using the planned sample and the chance to win. A test can be ahead and still "not ready".

## Guardrails and automatic pausing

A guardrail is **crossed** when the whole 95% range is beyond its limit in the bad direction, and
**at risk** when only the point estimate is. `guardrail_status(experiment)` computes this in SQL
with the same ranges as the dashboard, and `auto_pause_guardrails()` runs every 15 minutes
(`pg_cron`): it pauses live experiments with a crossed guardrail and stores why in
`experiments.auto_paused`. An experiment resumed by hand isn't paused again.
