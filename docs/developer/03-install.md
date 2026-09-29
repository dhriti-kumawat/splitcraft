---
title: Install the SDK
description: Script tag, Next.js, GTM, npm, the React hook, and the per-project switches.
---

# Install the SDK

Every project has a public key (`prj_…`). The dashboard's **Install** page (also in the New
project drawer) shows ready-to-copy code for HTML, Next.js, React and Google Tag Manager.

## Script tag (recommended)

Put it in `<head>`, as high as possible, so variants apply before the page paints:

```html
<script
  src="https://splitcraft.vercel.app/sdk/v1.js"
  data-project="prj_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
  data-config="https://<ref>.supabase.co/functions/v1/config/prj_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx.json"
  async
></script>
```

| Attribute               | Meaning                                                                  |
| ----------------------- | ------------------------------------------------------------------------ |
| `data-project`          | Required. The project's public key.                                      |
| `data-config`           | Where the config is served. Without it: `/v1/config/<key>.json` next to the SDK file. |
| `data-antiflicker="off"`| Don't hide the page while variants apply (set by the Anti-flicker switch). |

The script starts itself; there is nothing else to call. `window.splitcraft` holds the public API
(see [SDK reference](sdk)).

### Next.js

```tsx
// app/layout.tsx
import Script from 'next/script';

<Script
  src="https://splitcraft.vercel.app/sdk/v1.js"
  data-project="prj_…"
  data-config="https://<ref>.supabase.co/functions/v1/config/prj_….json"
  strategy="beforeInteractive"
/>
```

### Google Tag Manager

Tags › New › Custom HTML with the script tag, triggered on **All Pages (Page View)**. GTM loads later
than a direct install, so the page can flash before variants apply; prefer the direct tag when you can.

## npm

```sh
npm install @splitcraft/sdk
```

```ts
import { init, trackEvent } from '@splitcraft/sdk';

await init({
  project: 'prj_…',
  configUrl: 'https://<ref>.supabase.co/functions/v1/config/prj_….json',
  // base: 'https://splitcraft.vercel.app/sdk/',  // where v1.js, QA and metrics files live
  // antiFlicker: true,                           // off by default for npm use
});

trackEvent('signup_completed', { value: 1 });
```

`init` resolves with the runtime, or `null` when the config can't load (the page is never left
hidden). Calls to `trackEvent` made before `init` finishes are queued and sent once it has.

Other exports: `variant(key)`, `ready()`, `subscribe(fn)`, `start(config)` (start with a config you
already have) and the helpers from the [SDK reference](sdk).

## React: `useExperiment`

```tsx
import { useExperiment } from '@splitcraft/sdk/react';

function BookButton() {
  const { variant, ready } = useExperiment('sticky-book-bar');
  if (!ready) return <InlineButton />;           // same as control while deciding
  return variant === 'b' ? <StickyBar /> : <InlineButton />;
}
```

- Returns `{ variant: string | null, ready: boolean }`. `variant` is null when the visitor isn't in
  the test (targeting, traffic) or the SDK hasn't decided yet.
- Re-renders after SPA navigations, when targeting is checked again.
- On the server it returns `{ variant: null, ready: false }`: render the control there.
- React is an optional peer dependency (18 or later); apps without React never load this file.

With the hook you can leave the variant's code empty in the dashboard and branch in your components
instead. The exposure is still sent by the SDK, so results work the same way.

## Per-project switches

Under the install code:

| Switch                  | On (default)                                            | Off                                          |
| ----------------------- | ------------------------------------------------------- | -------------------------------------------- |
| Anti-flicker            | Hide the page until variants apply, at most 400 ms      | Adds `data-antiflicker="off"`: copy the new snippet |
| Single-page app mode    | Re-check targeting and re-apply on every route change   | Experiments run on the first page only       |
| Send events to GA4      | Push exposures and events to `window.dataLayer`         | No dataLayer pushes                          |

Switches other than anti-flicker reach visitors through the config within a minute.

## Allowed domains

The events endpoint only accepts events from the project's main domain (and `www.`), plus the
**Also allow on** list: staging domains, wildcards like `*.vercel.app`, and `localhost:3000`. Events
from anywhere else get `403 origin not allowed`.

## Verify the install

The Install page listens for the first event: **Listening for first ping…** turns into **Snippet
live**. The project card on Projects shows the same.
