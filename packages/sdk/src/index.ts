import {
  boot,
  start as startRuntime,
  type ProjectConfig,
  type Runtime,
  type StartOptions,
} from './runtime';

export const VERSION = '1.0.0';
const CDN = 'https://splitcraft.vercel.app/sdk/';

// Public API. In the CDN build these become `window.splitcraft.*`.
export { injectStyles, onceInView, onRouteChange, waitForElement } from './helpers';
export type { ExperimentConfig, ProjectConfig, StartOptions, VariantConfig } from './runtime';
export type { Targeting } from './targeting';

type TrackArgs = Parameters<Runtime['trackEvent']>;

let runtime: Runtime | null = null;
// Calls made before the config has loaded; replayed once it has. Capped to stay small.
const pending: TrackArgs[] = [];

export function trackEvent(...args: TrackArgs): void {
  if (runtime) runtime.trackEvent(...args);
  else if (pending.length < 100) pending.push(args);
}

/** Start with a config already in hand (npm use). The CDN script starts itself. */
export function start(config: ProjectConfig, opts?: StartOptions): Runtime {
  return attach(startRuntime(config, { metricsUrl: `${CDN}splitcraft-metrics.iife.js`, ...opts }));
}

/** Activates an experiment whose activation is "manual", on the current page. */
export function activate(experimentKey: string): void {
  if (runtime) runtime.activate(experimentKey);
  else pendingActivations.push(experimentKey);
}
const pendingActivations: string[] = [];

function attach(rt: Runtime): Runtime {
  runtime = rt;
  for (const args of pending.splice(0)) rt.trackEvent(...args);
  for (const key of pendingActivations.splice(0)) rt.activate(key);
  rt.subscribe(notify);
  notify();
  return rt;
}

// A store that exists before the runtime does, so React can subscribe right away.
const listeners = new Set<() => void>();
function notify(): void {
  for (const fn of listeners) fn();
}

/** Get told when variants or readiness change (the React hook uses this). */
export function subscribe(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/** The variant key this visitor sees, or null (not in the test, or not decided yet). */
export function variant(experimentKey: string): string | null {
  return runtime?.variant(experimentKey) ?? null;
}

/**
 * Whether a feature flag is on for this visitor. False until the config has loaded and
 * for flags that are off, rolled out to others, or outside their segments.
 */
export function isEnabled(flagKey: string): boolean {
  return runtime?.variant(flagKey) === 'on';
}

/** True once the first page's experiments have been decided. */
export function ready(): boolean {
  return runtime?.ready() ?? false;
}

export interface InitOptions {
  /** The project's public key, `prj_…`. */
  project: string;
  /** Where the SDK files are served; the config URL is derived from it. */
  base?: string;
  /** Config URL, when it isn't next to the SDK files (e.g. the Supabase function URL). */
  configUrl?: string;
  /** Hide the page until variants apply (max 400 ms). Off by default for npm use. */
  antiFlicker?: boolean;
}

/**
 * npm use: fetch the project's config and start, as the script tag does.
 * Resolves with the runtime, or null when the config can't load.
 */
export function init(opts: InitOptions): Promise<Runtime | null> {
  const s = document.createElement('script');
  s.setAttribute('src', new URL('v1.js', opts.base ?? CDN).href);
  s.setAttribute('data-project', opts.project);
  if (opts.configUrl) s.setAttribute('data-config', opts.configUrl);
  if (!opts.antiFlicker) s.setAttribute('data-antiflicker', 'off');
  return boot(s).then((rt) => rt && attach(rt));
}

const script = typeof document !== 'undefined' ? document.currentScript : null;
if (script?.tagName === 'SCRIPT' && script.hasAttribute('data-project')) {
  void boot(script as HTMLScriptElement).then((rt) => rt && attach(rt));
}
