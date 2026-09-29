---
title: SDK reference
description: Public API, helpers for variant code, QA mode, events, storage and bundle sizes.
---

# SDK reference

## Public API (`window.splitcraft` or the npm package)

```ts
splitcraft.trackEvent(key: string, props?: { value?: number; [k: string]: unknown }): void
splitcraft.waitForElement(selector: string, fn: (el: Element) => void, opts?: { timeout?: number }): void
splitcraft.onceInView(el: Element, fn: () => void): void
splitcraft.onRouteChange(fn: (url: string) => void): () => void
splitcraft.injectStyles(css: string, id?: string): () => void
```

| Function          | Notes                                                                                      |
| ----------------- | ------------------------------------------------------------------------------------------ |
| `trackEvent`      | Sends a goal event. `value` must be a finite number (NaN / Infinity are dropped). Other props are kept (up to 2 KB). Also pushed to `dataLayer` as `splitcraft_event` unless GA4 is off. |
| `waitForElement`  | Runs `fn` with the first matching element as soon as it exists (default wait 10 s).       |
| `onceInView`      | Runs `fn` once, the first time `el` enters the viewport.                                  |
| `onRouteChange`   | Calls `fn` on SPA navigation (History API and back / forward). Returns an unsubscribe.    |
| `injectStyles`    | Adds a `<style>`; calling again with the same `id` replaces it. Returns a remover.        |

Errors thrown inside your callbacks are caught and logged, never breaking the page.

npm-only: `init(options)`, `start(config)`, `variant(key)`, `ready()`, `subscribe(fn)`, and
`useExperiment(key)` from `@splitcraft/sdk/react` (see [Install](install)).

## Variant code

Each variant has JS and CSS, written in the dashboard (Monaco editor, with templates and version
history).

- **CSS** goes into one `<style>` per experiment.
- **JS** runs inside `try / catch` with a `splitcraft` object in scope: `waitForElement`,
  `onceInView`, `onRouteChange`, `injectStyles` and `trackEvent`. An error is logged and the page
  keeps working.
- JS runs once per URL, and again after an SPA navigation to a new URL.

```js
splitcraft.waitForElement('.book-now-btn', (btn) => {
  btn.insertAdjacentHTML('afterend', '<p class="trust">Free cancellation</p>');
});
splitcraft.injectStyles('.trust{font-size:13px;color:#0F6B57}');
```

## QA mode

Add `?splitcraft_force=<experimentKey>:<variantKey>` (several pairs separated by commas) to any page:

- the variant is forced, skipping WHO / HOW / WHEN and traffic, but still only on its pages;
- a QA panel opens (a separate 2 KB file) with the active experiments, how each was assigned
  (forced or bucketed), the events sent, and buttons to switch variant, reset or hide;
- forced variants are remembered for the browser tab (`sessionStorage`).

The dashboard's **Preview on site** button opens this link.

## Bucketing

`hash(visitorId + experimentKey)` → 0–9999 with FNV-1a and a MurmurHash3 finaliser, then mapped to
the variant weights. Traffic allocation uses a separate hash, so raising traffic never moves a
visitor to another variant. The same visitor gets the same variant on every visit.

## Events

The SDK batches events (up to 20, or every second) and sends them with `sendBeacon` (falling back to
`fetch` with `keepalive`), and flushes when the page is hidden.

| Type       | When                                                                       |
| ---------- | -------------------------------------------------------------------------- |
| `exposure` | The visitor saw a variant on this page (once per experiment and URL)      |
| `goal`     | A tracked goal fired (`key`, optional `value` and `props`)                |
| `ping`     | First page of each session: device, screen width, source, session number, UTMs and country, for reach estimates |

Batches go to the events endpoint as `text/plain` JSON `{ projectKey, events }` (at most 50 events,
64 KB). See [Backend](backend) for the responses.

## Storage the SDK uses

| Name                         | Where           | What                                                        |
| ---------------------------- | --------------- | ----------------------------------------------------------- |
| `splitcraft_vid`             | Cookie (and localStorage fallback) | Visitor id                                |
| `splitcraft_state`           | localStorage    | Session, page history (30 days / 50 entries), UTMs, exposures |
| `splitcraft_force`           | sessionStorage  | Forced variants in QA mode                                  |
| `splitcraft_tx`              | localStorage    | Last 50 transaction ids, so an order counts once            |
| `splitcraft_engaged_<n>` / `splitcraft_return_<n>` | sessionStorage | Browsing goals already sent this session |

If storage is blocked the SDK still works, with per-page state.

## Files and size budgets

| File                          | Gzipped budget | Loaded                                                  |
| ----------------------------- | -------------- | ------------------------------------------------------- |
| `v1.js` (`splitcraft.iife.js`) | 8 KB           | Always                                                  |
| `splitcraft-qa.iife.js`       | 3 KB           | Only with `?splitcraft_force`                           |
| `splitcraft-metrics.iife.js`  | 2 KB           | Only when a live experiment uses browsing or Web Vitals |

`npm run size -w packages/sdk` checks them; CI fails when a file is over budget. The SDK has no
runtime dependencies.
